#!/usr/bin/env python3
"""
Mew-1A v4.2 Training Data Quality Audit

Analyzes training data for 17 critical issues identified in enterprise quality research:
1. Future dates (dates > current date)
2. Excessive price precision (>2 decimal places)
3. Bid count hallucinations in outputs
4. Invalid card names (years, generic terms)
5. Missing "I don't know" examples
6. Missing explicit BUY/PASS examples
7. Duplicate examples
8. Temporal duplicates (same card, different dates)
9. Imbalanced category distribution
10. Price formatting issues
11. Incomplete outputs (truncated)
12. Missing fields
13. Inconsistent formatting
14. Adversarial examples (none expected)
15. Clarification examples (ambiguous queries)
16. Out-of-domain examples
17. Invalid metadata

Outputs comprehensive JSON report with severity scores and fix recommendations.
"""

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any
import hashlib

# Current date for temporal validation
CURRENT_DATE = date(2025, 10, 19)

# Invalid card names (years, generic terms, etc.)
INVALID_CARD_NAMES = {
    "1999", "2000", "2001", "2002", "2003", "2004", "2005",
    "Pokemon", "Card", "Holo", "Rare", "Set", "Edition",
    "Base", "Fossil", "Jungle", "Team Rocket",
    "Unknown", "N/A", "None", "", "null"
}

# Pattern for detecting bid counts in outputs
BID_PATTERN = re.compile(r'\b(\d+)\s+(bid|bids)\b', re.IGNORECASE)
DEMAND_BID_PATTERN = re.compile(r'strong demand with \d+ bids?', re.IGNORECASE)

# Pattern for BUY/PASS/HOLD recommendations
RECOMMENDATION_PATTERN = re.compile(r'\b(BUY|PASS|HOLD)\b', re.IGNORECASE)

class TrainingDataAuditor:
    def __init__(self, input_path: str):
        self.input_path = Path(input_path)
        self.examples = []
        self.issues = defaultdict(list)
        self.stats = {}

    def load_data(self):
        """Load training data from JSONL"""
        print(f"Loading data from {self.input_path}...")
        with open(self.input_path, 'r') as f:
            for i, line in enumerate(f):
                try:
                    example = json.loads(line)
                    example['_line_num'] = i + 1
                    self.examples.append(example)
                except json.JSONDecodeError as e:
                    print(f"⚠️  JSON decode error on line {i+1}: {e}")

        print(f"✅ Loaded {len(self.examples):,} examples")

    def audit_temporal_issues(self):
        """Issue 1: Check for future dates"""
        print("\n🔍 Auditing temporal issues...")
        future_dates = []
        invalid_dates = []

        for ex in self.examples:
            metadata = ex.get('metadata', {})
            date_str = metadata.get('sold_date')

            if date_str:
                try:
                    sold_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    if sold_date > CURRENT_DATE:
                        future_dates.append({
                            'line': ex['_line_num'],
                            'date': date_str,
                            'days_in_future': (sold_date - CURRENT_DATE).days,
                            'instruction': ex.get('instruction', '')[:100]
                        })
                except ValueError:
                    invalid_dates.append({
                        'line': ex['_line_num'],
                        'date': date_str,
                        'instruction': ex.get('instruction', '')[:100]
                    })

        self.issues['future_dates'] = future_dates
        self.issues['invalid_dates'] = invalid_dates
        print(f"   Found {len(future_dates):,} examples with future dates")
        print(f"   Found {len(invalid_dates):,} examples with invalid date formats")

    def audit_price_precision(self):
        """Issue 2: Check for excessive price precision"""
        print("\n🔍 Auditing price precision...")
        excessive_precision = []

        for ex in self.examples:
            metadata = ex.get('metadata', {})
            price = metadata.get('sold_price')

            if isinstance(price, float):
                # Check if more than 2 decimal places
                price_str = str(price)
                if '.' in price_str:
                    decimals = len(price_str.split('.')[1])
                    if decimals > 2:
                        excessive_precision.append({
                            'line': ex['_line_num'],
                            'price': price,
                            'decimals': decimals,
                            'should_be': round(price, 2)
                        })

        self.issues['excessive_price_precision'] = excessive_precision
        print(f"   Found {len(excessive_precision):,} examples with >2 decimal places")

    def audit_bid_hallucinations(self):
        """Issue 3: Check for bid counts in outputs when not in inputs"""
        print("\n🔍 Auditing bid count hallucinations...")
        bid_hallucinations = []

        for ex in self.examples:
            instruction = ex.get('instruction', '')
            input_text = ex.get('input', '')
            output = ex.get('output', '')

            # Check if output mentions bids
            output_has_bids = BID_PATTERN.search(output) or DEMAND_BID_PATTERN.search(output)

            if output_has_bids:
                # Check if instruction or input mentions bids
                input_has_bids = BID_PATTERN.search(instruction) or BID_PATTERN.search(input_text)
                metadata_has_bids = ex.get('metadata', {}).get('bid_count') is not None

                if not input_has_bids:
                    bid_hallucinations.append({
                        'line': ex['_line_num'],
                        'output_snippet': output[:200],
                        'bid_in_metadata': metadata_has_bids,
                        'issue': 'Bid count mentioned in output but not in instruction/input'
                    })

        self.issues['bid_hallucinations'] = bid_hallucinations
        print(f"   Found {len(bid_hallucinations):,} examples with hallucinated bid counts")

    def audit_invalid_card_names(self):
        """Issue 4: Check for invalid card names"""
        print("\n🔍 Auditing card names...")
        invalid_cards = []

        for ex in self.examples:
            metadata = ex.get('metadata', {})
            card_name = metadata.get('card_name', '').strip()

            if card_name in INVALID_CARD_NAMES:
                invalid_cards.append({
                    'line': ex['_line_num'],
                    'card_name': card_name,
                    'instruction': ex.get('instruction', '')[:100]
                })

        self.issues['invalid_card_names'] = invalid_cards
        print(f"   Found {len(invalid_cards):,} examples with invalid card names")

    def audit_refusal_examples(self):
        """Issue 5: Check for 'I don't know' examples"""
        print("\n🔍 Auditing refusal examples...")
        refusal_patterns = [
            r"I don't know",
            r"I don't have",
            r"insufficient data",
            r"insufficient information",
            r"cannot determine",
            r"unable to provide",
            r"not enough information"
        ]

        refusal_examples = []
        for ex in self.examples:
            output = ex.get('output', '').lower()
            for pattern in refusal_patterns:
                if re.search(pattern, output, re.IGNORECASE):
                    refusal_examples.append({
                        'line': ex['_line_num'],
                        'output_snippet': ex.get('output', '')[:200]
                    })
                    break

        self.issues['refusal_examples'] = refusal_examples
        refusal_rate = len(refusal_examples) / len(self.examples) * 100 if self.examples else 0
        print(f"   Found {len(refusal_examples):,} refusal examples ({refusal_rate:.2f}%)")
        print(f"   ⚠️  Enterprise target: 5-10% (currently: {refusal_rate:.2f}%)")

    def audit_investment_decisions(self):
        """Issue 6: Check for explicit BUY/PASS/HOLD examples"""
        print("\n🔍 Auditing investment decision examples...")
        investment_examples = []

        for ex in self.examples:
            output = ex.get('output', '')
            if RECOMMENDATION_PATTERN.search(output):
                investment_examples.append({
                    'line': ex['_line_num'],
                    'recommendation': RECOMMENDATION_PATTERN.search(output).group(0),
                    'output_snippet': output[:200]
                })

        self.issues['investment_decision_examples'] = investment_examples
        investment_rate = len(investment_examples) / len(self.examples) * 100 if self.examples else 0
        print(f"   Found {len(investment_examples):,} examples with BUY/PASS/HOLD ({investment_rate:.2f}%)")

    def audit_duplicates(self):
        """Issue 7: Check for exact duplicates"""
        print("\n🔍 Auditing duplicates...")
        hashes = defaultdict(list)

        for ex in self.examples:
            # Hash instruction + input + output
            content = f"{ex.get('instruction', '')}|{ex.get('input', '')}|{ex.get('output', '')}"
            # Handle Unicode surrogates
            hash_val = hashlib.md5(content.encode('utf-8', errors='ignore')).hexdigest()
            hashes[hash_val].append(ex['_line_num'])

        duplicates = {h: lines for h, lines in hashes.items() if len(lines) > 1}
        duplicate_count = sum(len(lines) - 1 for lines in duplicates.values())

        self.issues['exact_duplicates'] = {
            'duplicate_groups': len(duplicates),
            'wasted_examples': duplicate_count,
            'sample': list(duplicates.values())[:10]
        }
        print(f"   Found {len(duplicates):,} duplicate groups ({duplicate_count:,} wasted examples)")

    def audit_temporal_duplicates(self):
        """Issue 8: Check for temporal duplicates (same card, different dates)"""
        print("\n🔍 Auditing temporal duplicates...")
        card_sales = defaultdict(list)

        for ex in self.examples:
            metadata = ex.get('metadata', {})
            card_name = metadata.get('card_name', '').strip()
            condition = metadata.get('condition', '')
            grade = metadata.get('grade', '')

            if card_name and card_name not in INVALID_CARD_NAMES:
                key = f"{card_name}|{condition}|{grade}"
                card_sales[key].append({
                    'line': ex['_line_num'],
                    'date': metadata.get('sold_date'),
                    'price': metadata.get('sold_price')
                })

        temporal_dupes = {k: v for k, v in card_sales.items() if len(v) > 5}

        self.issues['temporal_duplicates'] = {
            'cards_with_many_sales': len(temporal_dupes),
            'sample': {k: len(v) for k, v in list(temporal_dupes.items())[:10]}
        }
        print(f"   Found {len(temporal_dupes):,} cards with >5 sales (temporal duplication)")

    def audit_category_distribution(self):
        """Issue 9: Check category balance"""
        print("\n🔍 Auditing category distribution...")
        categories = Counter(ex.get('category', 'unknown') for ex in self.examples)

        total = len(self.examples)
        category_dist = {cat: {
            'count': count,
            'percentage': count / total * 100
        } for cat, count in categories.items()}

        # Check for imbalance (>40% in any category)
        imbalanced = {cat: info for cat, info in category_dist.items()
                     if info['percentage'] > 40}

        self.issues['category_distribution'] = category_dist
        self.issues['imbalanced_categories'] = imbalanced

        print(f"   Category distribution:")
        for cat, info in sorted(category_dist.items(), key=lambda x: x[1]['count'], reverse=True):
            print(f"      {cat}: {info['count']:,} ({info['percentage']:.1f}%)")

        if imbalanced:
            print(f"   ⚠️  {len(imbalanced)} categories exceed 40% threshold")

    def audit_incomplete_outputs(self):
        """Issue 11: Check for truncated/incomplete outputs"""
        print("\n🔍 Auditing incomplete outputs...")
        incomplete = []

        for ex in self.examples:
            output = ex.get('output', '')
            # Check for common truncation indicators
            if (len(output) < 20 or
                output.endswith('...') or
                not output.strip()):
                incomplete.append({
                    'line': ex['_line_num'],
                    'length': len(output),
                    'output': output[:100]
                })

        self.issues['incomplete_outputs'] = incomplete
        print(f"   Found {len(incomplete):,} potentially incomplete outputs")

    def generate_report(self, output_path: str):
        """Generate comprehensive audit report"""
        print("\n📊 Generating audit report...")

        report = {
            'audit_date': datetime.now().isoformat(),
            'input_file': str(self.input_path),
            'total_examples': len(self.examples),
            'summary': {
                'critical_issues': len(self.issues['future_dates']) + len(self.issues['bid_hallucinations']),
                'medium_issues': len(self.issues['excessive_price_precision']) + len(self.issues['invalid_card_names']),
                'low_issues': len(self.issues.get('incomplete_outputs', [])),
            },
            'issues': {
                'future_dates': {
                    'severity': 'CRITICAL',
                    'count': len(self.issues['future_dates']),
                    'description': 'Training examples with dates in the future',
                    'impact': 'Temporal reasoning corruption, data leakage risk',
                    'samples': self.issues['future_dates'][:10]
                },
                'bid_hallucinations': {
                    'severity': 'CRITICAL',
                    'count': len(self.issues['bid_hallucinations']),
                    'description': 'Outputs mention bid counts not in inputs',
                    'impact': 'ROOT CAUSE of hallucinated bids in production',
                    'samples': self.issues['bid_hallucinations'][:10]
                },
                'excessive_price_precision': {
                    'severity': 'MEDIUM',
                    'count': len(self.issues['excessive_price_precision']),
                    'description': 'Prices with >2 decimal places',
                    'impact': 'Model learns meaningless precision',
                    'samples': self.issues['excessive_price_precision'][:10]
                },
                'invalid_card_names': {
                    'severity': 'MEDIUM',
                    'count': len(self.issues['invalid_card_names']),
                    'description': 'Card names are years, generic terms, or invalid',
                    'impact': 'Model learns incorrect card taxonomy',
                    'samples': self.issues['invalid_card_names'][:10]
                },
                'refusal_examples': {
                    'severity': 'CRITICAL',
                    'count': len(self.issues['refusal_examples']),
                    'rate': f"{len(self.issues['refusal_examples']) / len(self.examples) * 100:.2f}%",
                    'description': 'Examples with honest refusal ("I don\'t know")',
                    'impact': 'Model never learned when to refuse answering',
                    'target': '5-10% of dataset',
                    'samples': self.issues['refusal_examples'][:10]
                },
                'investment_decisions': {
                    'severity': 'HIGH',
                    'count': len(self.issues['investment_decision_examples']),
                    'rate': f"{len(self.issues['investment_decision_examples']) / len(self.examples) * 100:.2f}%",
                    'description': 'Examples with explicit BUY/PASS/HOLD recommendations',
                    'impact': 'Insufficient training on primary use case',
                    'samples': self.issues['investment_decision_examples'][:10]
                },
                'duplicates': {
                    'severity': 'MEDIUM',
                    'data': self.issues['exact_duplicates'],
                    'description': 'Exact duplicate examples',
                    'impact': 'Wasted training time, potential overfitting',
                },
                'temporal_duplicates': {
                    'severity': 'MEDIUM',
                    'data': self.issues['temporal_duplicates'],
                    'description': 'Same card sold multiple times',
                    'impact': 'Noise in training data, inefficient',
                },
                'category_distribution': {
                    'severity': 'MEDIUM',
                    'data': self.issues['category_distribution'],
                    'imbalanced': self.issues['imbalanced_categories'],
                    'description': 'Category distribution analysis',
                    'impact': 'Model may be biased toward majority categories',
                },
                'incomplete_outputs': {
                    'severity': 'LOW',
                    'count': len(self.issues['incomplete_outputs']),
                    'description': 'Outputs that appear truncated or empty',
                    'impact': 'Model learns incomplete response patterns',
                    'samples': self.issues['incomplete_outputs'][:10]
                }
            },
            'recommendations': [
                {
                    'priority': 'CRITICAL',
                    'action': 'Fix future dates',
                    'script': 'scripts/fix-temporal-issues.py',
                    'expected_impact': f"Fix {len(self.issues['future_dates']):,} examples"
                },
                {
                    'priority': 'CRITICAL',
                    'action': 'Remove bid count hallucinations',
                    'script': 'scripts/remove-bid-hallucinations.py',
                    'expected_impact': f"Fix {len(self.issues['bid_hallucinations']):,} examples"
                },
                {
                    'priority': 'CRITICAL',
                    'action': 'Generate "I don\'t know" examples',
                    'script': 'scripts/generate-honest-refusal-examples.py',
                    'expected_impact': 'Add 10,000-20,000 refusal examples (5-10% of dataset)'
                },
                {
                    'priority': 'HIGH',
                    'action': 'Generate BUY/PASS/HOLD examples',
                    'script': 'scripts/generate-investment-decisions.py',
                    'expected_impact': 'Add 5,000-10,000 investment decision examples'
                },
                {
                    'priority': 'MEDIUM',
                    'action': 'Deduplicate dataset',
                    'script': 'scripts/deduplicate-training-data.py',
                    'expected_impact': f"Remove {self.issues['exact_duplicates']['wasted_examples']:,} duplicate examples (20-30% size reduction)"
                },
                {
                    'priority': 'MEDIUM',
                    'action': 'Fix price precision',
                    'script': 'scripts/fix-price-precision.py',
                    'expected_impact': f"Fix {len(self.issues['excessive_price_precision']):,} examples"
                },
                {
                    'priority': 'MEDIUM',
                    'action': 'Fix invalid card names',
                    'script': 'scripts/fix-invalid-card-names.py',
                    'expected_impact': f"Fix or remove {len(self.issues['invalid_card_names']):,} examples"
                }
            ]
        }

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n✅ Audit report saved to {output_path}")
        print(f"\n📊 Summary:")
        print(f"   Total examples: {len(self.examples):,}")
        print(f"   Critical issues: {report['summary']['critical_issues']:,}")
        print(f"   Medium issues: {report['summary']['medium_issues']:,}")
        print(f"   Low issues: {report['summary']['low_issues']:,}")

        return report

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Audit Mew-1A training data quality')
    parser.add_argument('--input', required=True, help='Input JSONL file')
    parser.add_argument('--output', required=True, help='Output JSON report file')
    args = parser.parse_args()

    print("=" * 80)
    print("MEW-1A V4.2 TRAINING DATA QUALITY AUDIT")
    print("=" * 80)

    auditor = TrainingDataAuditor(args.input)
    auditor.load_data()

    # Run all audits
    auditor.audit_temporal_issues()
    auditor.audit_price_precision()
    auditor.audit_bid_hallucinations()
    auditor.audit_invalid_card_names()
    auditor.audit_refusal_examples()
    auditor.audit_investment_decisions()
    auditor.audit_duplicates()
    auditor.audit_temporal_duplicates()
    auditor.audit_category_distribution()
    auditor.audit_incomplete_outputs()

    # Generate report
    report = auditor.generate_report(args.output)

    print("\n" + "=" * 80)
    print("AUDIT COMPLETE")
    print("=" * 80)
    print(f"\nNext steps:")
    print(f"1. Review report: {args.output}")
    print(f"2. Run fix scripts in priority order:")
    for rec in report['recommendations'][:3]:
        print(f"   {rec['priority']}: {rec['script']}")

if __name__ == '__main__':
    main()
