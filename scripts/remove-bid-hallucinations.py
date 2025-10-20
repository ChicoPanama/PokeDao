#!/usr/bin/env python3
"""
Remove Bid Count Hallucinations from Training Data

Issue: 166,571 examples (34%) have outputs mentioning bid counts when
inputs don't provide them. This teaches the model to fabricate bid counts.

Strategy:
1. If output mentions bids but instruction/input doesn't → Remove bid mentions
2. Preserve examples where bids ARE in instruction/input (legitimate)
3. Clean up formatting after removal

Example Fix:
BEFORE:
  input: "Charizard sold for $140.23 on 2025-06-18"
  output: "Premium price point. Strong demand with 16 bids."

AFTER:
  input: "Charizard sold for $140.23 on 2025-06-18"
  output: "Premium price point. Strong collector interest indicated."
"""

import json
import re
from pathlib import Path
from typing import Dict, Any

# Patterns for detecting bid counts
BID_PATTERN = re.compile(r'\b(\d+)\s+(bid|bids)\b', re.IGNORECASE)
DEMAND_BID_PATTERN = re.compile(r'strong demand with \d+ bids?\.?', re.IGNORECASE)

# Patterns for removing bid-related sentences
BID_SENTENCE_PATTERN = re.compile(r'[^.!?]*\d+\s+bids?[^.!?]*[.!?]', re.IGNORECASE)
DEMAND_SENTENCE_PATTERN = re.compile(r'[^.!?]*strong demand with[^.!?]*[.!?]', re.IGNORECASE)

# Replacement phrases (neutral market commentary)
NEUTRAL_REPLACEMENTS = [
    "Strong collector interest indicated.",
    "Price reflects market demand.",
    "Competitive pricing observed.",
    "Active market interest noted.",
    "Price point reflects collector value.",
]

def has_bid_mention(text: str) -> bool:
    """Check if text mentions bid counts"""
    return bool(BID_PATTERN.search(text) or DEMAND_BID_PATTERN.search(text))

def remove_bid_mentions(output: str) -> str:
    """Remove bid count mentions from output"""
    original = output

    # Remove sentences with specific bid counts (e.g., "16 bids")
    output = BID_SENTENCE_PATTERN.sub('', output)

    # Remove "Strong demand with X bids" patterns
    output = DEMAND_SENTENCE_PATTERN.sub('', output)

    # Clean up extra whitespace and multiple periods
    output = re.sub(r'\s+', ' ', output)
    output = re.sub(r'\.{2,}', '.', output)
    output = output.strip()

    # If output is now too short or empty, add neutral replacement
    if len(output) < 20:
        # Use first part of original if available
        parts = original.split('.')
        if parts and len(parts[0]) > 10:
            output = parts[0] + '.'
        else:
            output = NEUTRAL_REPLACEMENTS[0]

    return output

def process_example(example: Dict[str, Any]) -> Dict[str, Any]:
    """Process a single training example"""
    instruction = example.get('instruction', '')
    input_text = example.get('input', '')
    output = example.get('output', '')

    # Check if output has bid mentions
    output_has_bids = has_bid_mention(output)

    if not output_has_bids:
        # No bids in output, return as-is
        return example

    # Check if instruction or input legitimately mentions bids
    input_has_bids = has_bid_mention(instruction) or has_bid_mention(input_text)

    if input_has_bids:
        # Legitimate bid mention (input provides bid count), keep as-is
        return example

    # HALLUCINATION DETECTED: Output mentions bids but input doesn't
    # Remove bid mentions from output
    cleaned_output = remove_bid_mentions(output)

    # Update example
    example['output'] = cleaned_output
    example['_bid_hallucination_removed'] = True

    return example

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Remove bid count hallucinations from training data')
    parser.add_argument('--input', required=True, help='Input JSONL file')
    parser.add_argument('--output', required=True, help='Output JSONL file')
    parser.add_argument('--report', help='Optional report file (JSON)')
    args = parser.parse_args()

    print("=" * 80)
    print("REMOVE BID COUNT HALLUCINATIONS")
    print("=" * 80)
    print(f"\nInput: {args.input}")
    print(f"Output: {args.output}")

    # Load data
    print("\n📖 Loading training data...")
    examples = []
    with open(args.input, 'r') as f:
        for i, line in enumerate(f):
            try:
                examples.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"⚠️  Skipping line {i+1}: {e}")

    total = len(examples)
    print(f"✅ Loaded {total:,} examples")

    # Process examples
    print("\n🔧 Processing examples...")
    fixed_count = 0
    legitimate_bids = 0
    no_bids = 0

    processed = []
    for i, example in enumerate(examples):
        if (i + 1) % 50000 == 0:
            print(f"   Processed {i+1:,}/{total:,} ({(i+1)/total*100:.1f}%)")

        original_output = example.get('output', '')
        processed_example = process_example(example)
        new_output = processed_example.get('output', '')

        if processed_example.get('_bid_hallucination_removed'):
            fixed_count += 1
        elif has_bid_mention(original_output):
            legitimate_bids += 1
        else:
            no_bids += 1

        # Remove internal flag before saving
        processed_example.pop('_bid_hallucination_removed', None)
        processed.append(processed_example)

    print(f"✅ Processing complete!")
    print(f"\n📊 Results:")
    print(f"   Total examples: {total:,}")
    print(f"   Bid hallucinations fixed: {fixed_count:,} ({fixed_count/total*100:.1f}%)")
    print(f"   Legitimate bid mentions: {legitimate_bids:,} ({legitimate_bids/total*100:.1f}%)")
    print(f"   No bid mentions: {no_bids:,} ({no_bids/total*100:.1f}%)")

    # Save cleaned data
    print(f"\n💾 Saving cleaned data to {args.output}...")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for example in processed:
            f.write(json.dumps(example) + '\n')

    print(f"✅ Saved {len(processed):,} examples")

    # Save report if requested
    if args.report:
        report = {
            'input_file': args.input,
            'output_file': args.output,
            'total_examples': total,
            'fixed_count': fixed_count,
            'legitimate_bids': legitimate_bids,
            'no_bid_mentions': no_bids,
            'fix_rate': f"{fixed_count/total*100:.2f}%",
            'samples_before_after': []
        }

        # Add sample fixes
        samples = [ex for ex in examples if has_bid_mention(ex.get('output', ''))][:10]
        for original in samples:
            fixed = process_example(original.copy())
            if fixed.get('_bid_hallucination_removed'):
                report['samples_before_after'].append({
                    'before': original['output'],
                    'after': fixed['output']
                })

        with open(args.report, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"✅ Report saved to {args.report}")

    print("\n" + "=" * 80)
    print("COMPLETE!")
    print("=" * 80)
    print(f"\n✅ Fixed {fixed_count:,} bid count hallucinations")
    print(f"✅ Preserved {legitimate_bids:,} legitimate bid mentions")
    print(f"\nNext step: Fix invalid card names")
    print(f"  python3 scripts/fix-invalid-card-names.py --input {args.output}")

if __name__ == '__main__':
    main()
