#!/usr/bin/env python3
"""
Fix Invalid Card Names in Training Data

Issue: 162,696 examples (33.6%) have invalid card names like "1999", "Pokemon", etc.

Strategy:
1. Identify invalid card names (years, generic terms, empty)
2. REMOVE these examples entirely (data quality too poor to salvage)
3. Better to have 321k clean examples than 484k dirty ones

Invalid patterns:
- Years: "1999", "2000", "2001", etc.
- Generic: "Pokemon", "Card", "Holo", "Rare", "Set"
- Garbage: "Unknown", "N/A", "", null
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, Set

# Invalid card names (years, generic terms, garbage)
INVALID_CARD_NAMES = {
    # Years
    "1999", "2000", "2001", "2002", "2003", "2004", "2005", "2006", "2007",
    "2008", "2009", "2010", "2011", "2012", "2013", "2014", "2015", "2016",
    "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025",

    # Generic terms
    "Pokemon", "Card", "Holo", "Rare", "Set", "Edition", "Collection",
    "Base", "Fossil", "Jungle", "Team Rocket", "Gym", "Neo",

    # Garbage
    "Unknown", "N/A", "None", "null", "", " ", "undefined",
    "Error", "Missing", "Test", "Sample"
}

# Pattern for detecting year-like card names (4 digits)
YEAR_PATTERN = re.compile(r'^\d{4}$')

def is_invalid_card_name(card_name: str) -> bool:
    """Check if card name is invalid"""
    if not card_name or not isinstance(card_name, str):
        return True

    card_name = card_name.strip()

    # Empty or too short
    if len(card_name) < 2:
        return True

    # In blacklist
    if card_name in INVALID_CARD_NAMES:
        return True

    # Looks like a year
    if YEAR_PATTERN.match(card_name):
        return True

    # All uppercase generic terms (SET, CARD, etc.)
    if card_name.upper() in INVALID_CARD_NAMES:
        return True

    return False

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Fix invalid card names in training data')
    parser.add_argument('--input', required=True, help='Input JSONL file')
    parser.add_argument('--output', required=True, help='Output JSONL file')
    parser.add_argument('--removed', help='File for removed examples (optional)')
    parser.add_argument('--report', help='Report file (JSON)')
    args = parser.parse_args()

    print("=" * 80)
    print("FIX INVALID CARD NAMES")
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
    valid_examples = []
    removed_examples = []
    invalid_names_found = set()

    for i, example in enumerate(examples):
        if (i + 1) % 50000 == 0:
            print(f"   Processed {i+1:,}/{total:,} ({(i+1)/total*100:.1f}%)")

        metadata = example.get('metadata', {})
        card_name = metadata.get('card_name', '').strip()

        if is_invalid_card_name(card_name):
            removed_examples.append(example)
            invalid_names_found.add(card_name if card_name else "[empty]")
        else:
            valid_examples.append(example)

    removed_count = len(removed_examples)
    kept_count = len(valid_examples)

    print(f"✅ Processing complete!")
    print(f"\n📊 Results:")
    print(f"   Total examples: {total:,}")
    print(f"   Valid examples kept: {kept_count:,} ({kept_count/total*100:.1f}%)")
    print(f"   Invalid examples removed: {removed_count:,} ({removed_count/total*100:.1f}%)")
    print(f"   Unique invalid names: {len(invalid_names_found)}")

    # Show top invalid names
    from collections import Counter
    invalid_name_counts = Counter(
        ex.get('metadata', {}).get('card_name', '[empty]')
        for ex in removed_examples
    )
    print(f"\n   Top 10 invalid card names:")
    for name, count in invalid_name_counts.most_common(10):
        print(f"      '{name}': {count:,} examples")

    # Save valid examples
    print(f"\n💾 Saving cleaned data to {args.output}...")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for example in valid_examples:
            f.write(json.dumps(example) + '\n')

    print(f"✅ Saved {kept_count:,} valid examples")

    # Save removed examples if requested
    if args.removed:
        print(f"\n💾 Saving removed examples to {args.removed}...")
        removed_path = Path(args.removed)
        removed_path.parent.mkdir(parents=True, exist_ok=True)

        with open(removed_path, 'w') as f:
            for example in removed_examples:
                f.write(json.dumps(example) + '\n')

        print(f"✅ Saved {removed_count:,} removed examples")

    # Save report
    if args.report:
        report = {
            'input_file': args.input,
            'output_file': args.output,
            'total_examples': total,
            'valid_kept': kept_count,
            'invalid_removed': removed_count,
            'removal_rate': f"{removed_count/total*100:.2f}%",
            'invalid_names_found': list(invalid_names_found)[:50],
            'top_invalid_names': dict(invalid_name_counts.most_common(20))
        }

        with open(args.report, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"✅ Report saved to {args.report}")

    print("\n" + "=" * 80)
    print("COMPLETE!")
    print("=" * 80)
    print(f"\n✅ Removed {removed_count:,} examples with invalid card names")
    print(f"✅ Dataset reduced from {total:,} to {kept_count:,} examples")
    print(f"\nQuality over quantity: Clean data → Better model")
    print(f"\nNext step: Fix price precision")
    print(f"  python3 scripts/fix-price-precision.py --input {args.output}")

if __name__ == '__main__':
    main()
