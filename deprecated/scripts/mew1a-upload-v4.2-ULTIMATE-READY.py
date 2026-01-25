#!/usr/bin/env python3
"""
MEW-1A v4.2 ULTIMATE - HuggingFace Upload
Enterprise-grade dataset: 509,746 examples
"""

import json
import os
from datasets import Dataset
from huggingface_hub import HfApi

def clean_unicode(obj):
    """Recursively clean Unicode issues."""
    if isinstance(obj, dict):
        return {k: clean_unicode(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_unicode(item) for item in obj]
    elif isinstance(obj, str):
        return obj.encode('utf-8', 'ignore').decode('utf-8')
    return obj

def load_jsonl_with_unicode_fix(file_path):
    """Load JSONL with Unicode handling."""
    examples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            try:
                line_clean = line.encode('utf-8', 'surrogatepass').decode('utf-8', 'ignore')
                example = json.loads(line_clean)
                example_clean = clean_unicode(example)
                examples.append(example_clean)

                if (i + 1) % 100000 == 0:
                    print(f"  Loaded {i + 1:,} examples...")
            except Exception as e:
                print(f"  Warning: Skipping line {i + 1}: {e}")
                continue

    return examples

def main():
    print("\n" + "=" * 70)
    print("MEW-1A v4.2 ULTIMATE - HUGGINGFACE UPLOAD")
    print("ENTERPRISE-GRADE DATASET")
    print("=" * 70 + "\n")

    file_path = '/Users/arcadio/dev/pokedao/data/training/mew1a-v4.2-ULTIMATE-READY.jsonl'
    print(f"📁 Loading: {file_path}\n")

    examples = load_jsonl_with_unicode_fix(file_path)
    print(f"\n✅ Loaded {len(examples):,} examples\n")

    # Statistics
    categories = {}
    temporal_count = 0
    for ex in examples:
        cat = ex.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1

        if ex.get('metadata', {}).get('sold_date') or ex.get('metadata', {}).get('date') or ex.get('metadata', {}).get('timestamp'):
            temporal_count += 1

    print("📊 DATASET STATISTICS:\n")
    print(f"   Total examples:        {len(examples):,}")
    print(f"   Temporal records:      {temporal_count:,} ({(temporal_count/len(examples)*100):.1f}%)")
    print(f"\n📈 CATEGORY BREAKDOWN:\n")

    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        percentage = (count / len(examples)) * 100
        print(f"   {cat:30} {count:>10,} ({percentage:>5.1f}%)")

    print("\n" + "=" * 70)

    # Create HuggingFace dataset
    print("\n🔄 Creating HuggingFace dataset...")
    dataset = Dataset.from_list(examples)
    print(f"✅ Dataset created\n")
    print(dataset)

    # Upload
    repo_id = "ChicoPanama/mew1a-v4.2-pokemon-tcg-ultimate-complete"
    print(f"\n☁️  Uploading to: {repo_id}\n")

    hf_token = os.environ.get('HUGGINGFACE_TOKEN')
    if not hf_token:
        print("❌ HUGGINGFACE_TOKEN not found!")
        return

    try:
        dataset.push_to_hub(
            repo_id,
            token=hf_token,
            private=False,
        )

        print("\n" + "=" * 70)
        print("✅ UPLOAD SUCCESSFUL!")
        print("=" * 70)
        print(f"\n📁 Dataset: https://huggingface.co/datasets/{repo_id}")
        print(f"\n📊 FINAL STATISTICS:")
        print(f"   Total examples:       {len(examples):,}")
        print(f"   Temporal data:        {temporal_count:,} ({(temporal_count/len(examples)*100):.1f}%)")
        print(f"   Market analysis:      {categories.get('market_analysis', 0):,}")
        print(f"   Card knowledge:       {categories.get('card_knowledge', 0):,}")
        print(f"   Reddit sentiment:     {categories.get('reddit_sentiment', 0):,}")
        print(f"   Price trends:         {categories.get('price_trends', 0):,}")
        print("\n🎉 Mew-1A v4.2 ULTIMATE is ready for training!\n")

    except Exception as e:
        print(f"\n❌ Upload failed: {e}\n")

if __name__ == "__main__":
    main()
