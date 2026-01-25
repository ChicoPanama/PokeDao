#!/usr/bin/env python3
"""
Mew-1A v4 Pre-Training Validation & Quality Assurance

Runs comprehensive checks before training:
1. JSONL format validation
2. Content quality checks (null outputs, short instructions, etc.)
3. Category distribution analysis
4. Train/validation split creation
5. Example length analysis
6. Final report generation
"""

import json
import random
from pathlib import Path
from collections import Counter, defaultdict

# Configuration
DATASET_FILE = "data/training/mew1a-v4-comprehensive-internal.jsonl"
VAL_SPLIT = 0.02  # 2% for validation
TRAIN_OUTPUT = "data/training/mew1a-v4-train.jsonl"
VAL_OUTPUT = "data/training/mew1a-v4-val.jsonl"

def load_dataset(filepath):
    """Load and validate JSONL dataset"""
    examples = []
    errors = []

    with open(filepath, 'r') as f:
        for i, line in enumerate(f, 1):
            try:
                example = json.loads(line.strip())
                examples.append(example)
            except json.JSONDecodeError as e:
                errors.append(f"Line {i}: {str(e)}")

    return examples, errors

def check_content_quality(examples):
    """Check for quality issues"""
    issues = defaultdict(list)

    for i, ex in enumerate(examples):
        # Check for null/empty outputs
        if not ex.get('output') or ex['output'].lower() in ['null', 'n/a', '', 'none']:
            issues['null_output'].append(i)

        # Check for short instructions
        if len(ex.get('instruction', '')) < 10:
            issues['short_instruction'].append(i)

        # Check for very short outputs
        if len(ex.get('output', '')) < 50:
            issues['short_output'].append(i)

        # Check for category presence
        if 'category' not in ex:
            issues['missing_category'].append(i)

        # Check for repetitive patterns
        if ex.get('output', '').count('\\n\\n') > 10:
            issues['excessive_newlines'].append(i)

    return issues

def analyze_categories(examples):
    """Analyze category distribution"""
    categories = Counter(ex['category'] for ex in examples)
    return categories

def analyze_lengths(examples):
    """Analyze example lengths"""
    stats = {
        'instruction_lengths': [],
        'output_lengths': [],
        'total_lengths': []
    }

    for ex in examples:
        inst_len = len(ex.get('instruction', ''))
        out_len = len(ex.get('output', ''))

        stats['instruction_lengths'].append(inst_len)
        stats['output_lengths'].append(out_len)
        stats['total_lengths'].append(inst_len + out_len)

    return {
        'instruction': {
            'min': min(stats['instruction_lengths']),
            'max': max(stats['instruction_lengths']),
            'avg': sum(stats['instruction_lengths']) / len(stats['instruction_lengths']),
        },
        'output': {
            'min': min(stats['output_lengths']),
            'max': max(stats['output_lengths']),
            'avg': sum(stats['output_lengths']) / len(stats['output_lengths']),
        },
        'total': {
            'min': min(stats['total_lengths']),
            'max': max(stats['total_lengths']),
            'avg': sum(stats['total_lengths']) / len(stats['total_lengths']),
        }
    }

def create_train_val_split(examples, val_ratio=0.02):
    """Create stratified train/val split by category"""
    # Group by category
    by_category = defaultdict(list)
    for ex in examples:
        by_category[ex['category']].append(ex)

    train_examples = []
    val_examples = []

    # Stratified split
    for category, cat_examples in by_category.items():
        random.shuffle(cat_examples)
        split_idx = int(len(cat_examples) * (1 - val_ratio))

        train_examples.extend(cat_examples[:split_idx])
        val_examples.extend(cat_examples[split_idx:])

    # Shuffle final sets
    random.shuffle(train_examples)
    random.shuffle(val_examples)

    return train_examples, val_examples

def save_split(examples, filepath):
    """Save examples to JSONL file"""
    with open(filepath, 'w') as f:
        for ex in examples:
            f.write(json.dumps(ex) + '\n')

def main():
    print("=" * 80)
    print("MEW-1A V4 PRE-TRAINING VALIDATION")
    print("=" * 80)
    print(f"\nDataset: {DATASET_FILE}\n")

    # 1. Load and validate JSONL
    print("🔍 1. JSONL Format Validation")
    print("-" * 80)
    examples, errors = load_dataset(DATASET_FILE)

    if errors:
        print(f"❌ Found {len(errors)} parsing errors:")
        for error in errors[:10]:  # Show first 10
            print(f"  {error}")
        return
    else:
        print(f"✅ All {len(examples):,} lines are valid JSON")

    # 2. Content quality checks
    print(f"\n🔍 2. Content Quality Analysis")
    print("-" * 80)
    issues = check_content_quality(examples)

    if any(issues.values()):
        print("⚠️  Quality issues found:")
        for issue_type, indices in issues.items():
            if indices:
                print(f"  • {issue_type}: {len(indices)} examples")
                if len(indices) <= 5:
                    print(f"    Indices: {indices}")
    else:
        print("✅ No quality issues detected")

    # 3. Category distribution
    print(f"\n📊 3. Category Distribution")
    print("-" * 80)
    categories = analyze_categories(examples)
    for cat, count in categories.most_common():
        pct = (count / len(examples)) * 100
        print(f"  • {cat:30s}: {count:6,} ({pct:5.2f}%)")

    # 4. Length analysis
    print(f"\n📏 4. Example Length Analysis")
    print("-" * 80)
    length_stats = analyze_lengths(examples)

    print("Instruction lengths:")
    print(f"  Min: {length_stats['instruction']['min']}")
    print(f"  Avg: {length_stats['instruction']['avg']:.1f}")
    print(f"  Max: {length_stats['instruction']['max']}")

    print("\nOutput lengths:")
    print(f"  Min: {length_stats['output']['min']}")
    print(f"  Avg: {length_stats['output']['avg']:.1f}")
    print(f"  Max: {length_stats['output']['max']}")

    print("\nTotal lengths:")
    print(f"  Min: {length_stats['total']['min']}")
    print(f"  Avg: {length_stats['total']['avg']:.1f}")
    print(f"  Max: {length_stats['total']['max']}")

    # Estimate tokens
    avg_chars = length_stats['total']['avg']
    estimated_tokens = avg_chars / 4
    print(f"\nEstimated avg tokens per example: ~{estimated_tokens:.0f}")

    # 5. Create train/val split
    print(f"\n✂️  5. Creating Train/Validation Split ({int(VAL_SPLIT*100)}% val)")
    print("-" * 80)

    train_examples, val_examples = create_train_val_split(examples, VAL_SPLIT)

    print(f"Training set: {len(train_examples):,} examples")
    print(f"Validation set: {len(val_examples):,} examples")

    # Check val split has all categories
    val_categories = Counter(ex['category'] for ex in val_examples)
    print(f"\nValidation set categories:")
    for cat, count in val_categories.most_common():
        print(f"  • {cat}: {count}")

    # 6. Save splits
    print(f"\n💾 6. Saving Train/Val Splits")
    print("-" * 80)

    save_split(train_examples, TRAIN_OUTPUT)
    save_split(val_examples, VAL_OUTPUT)

    print(f"✅ Training set saved: {TRAIN_OUTPUT}")
    print(f"✅ Validation set saved: {VAL_OUTPUT}")

    # 7. Sample examples
    print(f"\n📋 7. Sample Examples")
    print("-" * 80)

    print("\n[Market Analysis Example]")
    market_ex = next((ex for ex in examples if ex['category'] == 'market_analysis'), None)
    if market_ex:
        print(f"Instruction: {market_ex['instruction'][:100]}...")
        print(f"Output: {market_ex['output'][:150]}...")

    print("\n[Deck Building Example]")
    deck_ex = next((ex for ex in examples if ex['category'] == 'deck_building'), None)
    if deck_ex:
        print(f"Instruction: {deck_ex['instruction'][:100]}...")
        print(f"Output: {deck_ex['output'][:150]}...")

    # Final summary
    print("\n" + "=" * 80)
    print("✅ PRE-TRAINING VALIDATION COMPLETE")
    print("=" * 80)

    print(f"\n📊 Final Summary:")
    print(f"  • Total examples: {len(examples):,}")
    print(f"  • Training set: {len(train_examples):,}")
    print(f"  • Validation set: {len(val_examples):,}")
    print(f"  • Categories: {len(categories)}")
    print(f"  • Avg example length: {int(length_stats['total']['avg'])} chars")
    print(f"  • Est. total tokens: ~{int(len(examples) * estimated_tokens):,}")

    if issues:
        print(f"\n⚠️  Quality Issues Summary:")
        total_issues = sum(len(v) for v in issues.values())
        print(f"  • Total flagged: {total_issues} ({(total_issues/len(examples)*100):.2f}%)")
        for issue_type, indices in issues.items():
            if indices:
                print(f"  • {issue_type}: {len(indices)}")
    else:
        print(f"\n✅ No quality issues detected!")

    print(f"\n🚀 Ready for Training!")
    print(f"  • Use {TRAIN_OUTPUT} for training")
    print(f"  • Use {VAL_OUTPUT} for validation")
    print(f"  • Expected training time: 12-16 hours on RTX 4090")
    print(f"  • Target loss: < 0.130")
    print("=" * 80)

if __name__ == "__main__":
    random.seed(42)  # For reproducible splits
    main()
