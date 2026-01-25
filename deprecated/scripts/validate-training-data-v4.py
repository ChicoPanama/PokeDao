#!/usr/bin/env python3
"""
Mew-1A v4 Pre-Training Validation Script

Runs comprehensive quality checks on the training dataset before
starting the expensive RunPod training.

Checks:
1. JSONL format validity
2. Required fields present
3. Category distribution
4. Output quality (no nulls, n/a, too short)
5. Instruction clarity
6. Example length distribution
"""

import json
import sys
from collections import Counter

DATASET_FILE = "data/training/mew1a-v4-comprehensive-internal.jsonl"

def validate_dataset():
    print("=" * 80)
    print("🔍 MEW-1A V4 PRE-TRAINING VALIDATION")
    print("=" * 80)
    print(f"\nDataset: {DATASET_FILE}\n")

    examples = []
    issues = []
    line_num = 0

    # Load and validate JSON
    print("📂 Loading dataset...")
    try:
        with open(DATASET_FILE, 'r') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    ex = json.loads(line)
                    examples.append(ex)
                except json.JSONDecodeError as e:
                    issues.append(f"Line {line_num}: Invalid JSON - {e}")
    except FileNotFoundError:
        print(f"❌ File not found: {DATASET_FILE}")
        sys.exit(1)

    print(f"✅ Loaded {len(examples):,} examples from {line_num:,} lines\n")

    # Check required fields
    print("🔍 Checking required fields...")
    required_fields = ['instruction', 'input', 'output', 'category']
    for i, ex in enumerate(examples[:1000], 1):  # Check first 1000
        missing = [f for f in required_fields if f not in ex]
        if missing:
            issues.append(f"Example {i}: Missing fields {missing}")

    if not issues:
        print("✅ All examples have required fields\n")
    else:
        print(f"⚠️  Found {len(issues)} field issues (showing first 5):")
        for issue in issues[:5]:
            print(f"   {issue}")
        print()

    # Category distribution
    print("📊 Category Distribution:")
    categories = Counter(ex['category'] for ex in examples)
    for cat, count in categories.most_common():
        pct = (count / len(examples)) * 100
        print(f"   • {cat:25s}: {count:6,} ({pct:5.2f}%)")
    print()

    # Check for low-quality outputs
    print("🔍 Checking output quality...")
    quality_issues = []

    for i, ex in enumerate(examples[:1000], 1):
        output = ex.get('output', '')

        # Check for null/empty
        if not output or output.lower() in ['null', 'none', 'n/a', '']:
            quality_issues.append(f"Example {i}: Empty or null output")

        # Check for too short
        elif len(output) < 50:
            quality_issues.append(f"Example {i}: Output too short ({len(output)} chars)")

        # Check for instruction clarity
        instruction = ex.get('instruction', '')
        if len(instruction) < 10:
            quality_issues.append(f"Example {i}: Instruction too short")

    if quality_issues:
        print(f"⚠️  Found {len(quality_issues)} quality issues (showing first 10):")
        for issue in quality_issues[:10]:
            print(f"   {issue}")
    else:
        print("✅ Output quality looks good")
    print()

    # Length distribution
    print("📏 Example Length Distribution:")
    lengths = [len(ex['instruction']) + len(ex['output']) for ex in examples]
    avg_len = sum(lengths) / len(lengths)
    min_len = min(lengths)
    max_len = max(lengths)

    print(f"   • Average: {int(avg_len)} characters")
    print(f"   • Min: {min_len} characters")
    print(f"   • Max: {max_len} characters")
    print(f"   • Total: {sum(lengths):,} characters (~{sum(lengths)//4:,} tokens)")
    print()

    # Sample examples from each category
    print("📝 Sample Examples (one per category):\n")
    for cat in categories.keys():
        sample = next(ex for ex in examples if ex['category'] == cat)
        print(f"Category: {cat}")
        print(f"Instruction: {sample['instruction'][:100]}...")
        print(f"Output: {sample['output'][:150]}...")
        print("-" * 80)
    print()

    # Final verdict
    print("=" * 80)
    if len(issues) == 0 and len(quality_issues) < 10:
        print("✅ VALIDATION PASSED - Dataset ready for training!")
        print("=" * 80)
        print("\n🚀 Next Steps:")
        print("   1. Upload training script to RunPod")
        print("   2. Set HUGGINGFACE_TOKEN environment variable")
        print("   3. Start training: python3 mew1a-train-v4.py")
        print("   4. Monitor training.log for loss curve")
        print("\n💰 Expected Cost: ~$30-40 for 12-16 hours on RTX 4090")
        print("🎯 Target Loss: < 0.130")
        return 0
    else:
        print(f"⚠️  VALIDATION ISSUES: {len(issues) + len(quality_issues)} total")
        print("=" * 80)
        print("\nFix issues before training to avoid wasted GPU time!")
        return 1

if __name__ == "__main__":
    exit_code = validate_dataset()
    sys.exit(exit_code)
