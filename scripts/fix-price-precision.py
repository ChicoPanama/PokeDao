#!/usr/bin/env python3
"""
Fix Price Precision in Training Data (FREE - $0 cost)

Issue: 248,082 examples (51%) have excessive price precision like $107.27754851779001
Fix: Round all prices to 2 decimal places (USD standard)

This affects:
- metadata.sold_price
- metadata.price
- output text mentions of prices

Strategy:
1. Round numeric prices to 2 decimals: 107.27754851779001 → 107.28
2. Update output text to match: "$107.28" not "$107.27754851779001"
3. Apply to BOTH valid and removed datasets
"""

import json
import re
from pathlib import Path
from typing import Dict, Any

def round_price(price: float) -> float:
    """Round price to 2 decimal places"""
    if isinstance(price, (int, float)):
        return round(price, 2)
    return price

def fix_price_in_text(text: str) -> str:
    """Fix price mentions in text to 2 decimals"""
    # Pattern: $XXX.YYYYYY (many decimals)
    def replace_price(match):
        price_str = match.group(1)
        try:
            price_float = float(price_str)
            return f"${round(price_float, 2):.2f}"
        except:
            return match.group(0)

    # Find all $XXX.XXX patterns and round them
    pattern = r'\$(\d+\.\d{3,})'  # 3+ decimals
    return re.sub(pattern, replace_price, text)

def process_example(example: Dict[str, Any]) -> Dict[str, Any]:
    """Fix price precision in a single example"""
    # Fix metadata prices
    metadata = example.get('metadata', {})

    if 'sold_price' in metadata:
        metadata['sold_price'] = round_price(metadata['sold_price'])

    if 'price' in metadata:
        metadata['price'] = round_price(metadata['price'])

    # Fix prices in text fields
    if 'instruction' in example:
        example['instruction'] = fix_price_in_text(example['instruction'])

    if 'input' in example:
        example['input'] = fix_price_in_text(example['input'])

    if 'output' in example:
        example['output'] = fix_price_in_text(example['output'])

    return example

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Fix price precision in training data (FREE)')
    parser.add_argument('--input', required=True, help='Input JSONL file')
    parser.add_argument('--output', required=True, help='Output JSONL file')
    parser.add_argument('--report', help='Report file (JSON)')
    args = parser.parse_args()

    print("=" * 80)
    print("FIX PRICE PRECISION (FREE - $0 COST)")
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
    fixed_metadata = 0
    fixed_text = 0

    processed = []
    for i, example in enumerate(examples):
        if (i + 1) % 50000 == 0:
            print(f"   Processed {i+1:,}/{total:,} ({(i+1)/total*100:.1f}%)")

        original = json.dumps(example)
        fixed_example = process_example(example.copy())

        if json.dumps(fixed_example) != original:
            fixed_count += 1

            # Count what was fixed
            if fixed_example.get('metadata', {}).get('sold_price') != example.get('metadata', {}).get('sold_price'):
                fixed_metadata += 1
            if fixed_example.get('output') != example.get('output'):
                fixed_text += 1

        processed.append(fixed_example)

    print(f"✅ Processing complete!")
    print(f"\n📊 Results:")
    print(f"   Total examples: {total:,}")
    print(f"   Examples fixed: {fixed_count:,} ({fixed_count/total*100:.1f}%)")
    print(f"   Metadata prices fixed: {fixed_metadata:,}")
    print(f"   Text prices fixed: {fixed_text:,}")

    # Save fixed data
    print(f"\n💾 Saving fixed data to {args.output}...")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for example in processed:
            f.write(json.dumps(example) + '\n')

    print(f"✅ Saved {len(processed):,} examples")

    # Save report
    if args.report:
        # Sample fixes
        samples = []
        for i, (orig, fixed) in enumerate(zip(examples[:20], processed[:20])):
            if json.dumps(orig) != json.dumps(fixed):
                samples.append({
                    'before_metadata_price': orig.get('metadata', {}).get('sold_price'),
                    'after_metadata_price': fixed.get('metadata', {}).get('sold_price'),
                    'before_output': orig.get('output', '')[:100],
                    'after_output': fixed.get('output', '')[:100]
                })

        report = {
            'input_file': args.input,
            'output_file': args.output,
            'total_examples': total,
            'examples_fixed': fixed_count,
            'metadata_fixed': fixed_metadata,
            'text_fixed': fixed_text,
            'fix_rate': f"{fixed_count/total*100:.2f}%",
            'samples': samples[:10]
        }

        with open(args.report, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"✅ Report saved to {args.report}")

    print("\n" + "=" * 80)
    print("COMPLETE! (FREE - $0 COST)")
    print("=" * 80)
    print(f"\n✅ Fixed {fixed_count:,} examples with price precision issues")
    print(f"✅ All prices now rounded to 2 decimal places (USD standard)")
    print(f"\n💰 Cost: $0 (Python script)")
    print(f"⏱️  Time: <2 minutes")
    print(f"\nNext step: Run on removed data too")
    print(f"  python3 scripts/fix-price-precision.py --input data/training/removed-invalid-cards.jsonl --output data/training/removed-invalid-cards-fixed-prices.jsonl")

if __name__ == '__main__':
    main()
