#!/usr/bin/env python3
"""
MEW-1A v4.2 ULTIMATE - Upload to HuggingFace

Uploads the final v4.2 ULTIMATE dataset (424,220 examples) to HuggingFace.
This includes ALL data sources:
- v4.1 base + Reddit (113K)
- PostgreSQL UnifiedMarketListing (100K)
- Research JSON files (75K)
- TCGdex metadata (65K)
- SQLite databases (25K)
- eBay massive database (925K → 273K after dedup)
- Analysis outputs (300)
"""

import json
import os
from datasets import Dataset
from huggingface_hub import HfApi

def clean_unicode(obj):
    """Recursively clean Unicode issues in nested structures."""
    if isinstance(obj, dict):
        return {k: clean_unicode(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_unicode(item) for item in obj]
    elif isinstance(obj, str):
        # Clean emoji and problematic Unicode
        return obj.encode('utf-8', 'ignore').decode('utf-8')
    else:
        return obj

def load_jsonl_with_unicode_fix(file_path):
    """Load JSONL file with Unicode error handling."""
    examples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            try:
                # Fix emoji encoding issues
                line_clean = line.encode('utf-8', 'surrogatepass').decode('utf-8', 'ignore')
                example = json.loads(line_clean)

                # Clean all Unicode in the example
                example_clean = clean_unicode(example)
                examples.append(example_clean)

                if (i + 1) % 50000 == 0:
                    print(f"  Loaded {i + 1:,} examples...")
            except Exception as e:
                print(f"  Warning: Skipping line {i + 1} due to error: {e}")
                continue

    return examples

def upload_to_huggingface():
    print("🚀 MEW-1A v4.2 ULTIMATE - HuggingFace Upload\n")

    # Load the dataset
    file_path = '/Users/arcadio/dev/pokedao/data/training/mew1a-v4.2-ULTIMATE-FINAL.jsonl'
    print(f"📁 Loading dataset from: {file_path}\n")

    examples = load_jsonl_with_unicode_fix(file_path)
    print(f"\n✓ Loaded {len(examples):,} examples\n")

    # Create HuggingFace dataset
    print("🔄 Creating HuggingFace dataset...\n")
    dataset = Dataset.from_list(examples)

    print(f"✓ Dataset created with {len(dataset):,} examples\n")
    print("Dataset features:")
    print(dataset)

    # Category breakdown
    categories = {}
    for example in examples:
        cat = example.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1

    print("\n📊 Category Distribution:\n")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        percentage = (count / len(examples)) * 100
        print(f"  {cat:30} {count:>10,} ({percentage:>5.1f}%)")

    # Upload to HuggingFace
    repo_id = "ChicoPanama/mew1a-v4.2-pokemon-tcg-ultimate-complete"
    print(f"\n☁️  Uploading to HuggingFace: {repo_id}\n")

    # Get HuggingFace token from environment
    hf_token = os.environ.get('HUGGINGFACE_TOKEN')
    if not hf_token:
        print("❌ HUGGINGFACE_TOKEN not found in environment!")
        print("   Please set: export HUGGINGFACE_TOKEN=your_token")
        return

    try:
        dataset.push_to_hub(
            repo_id,
            token=hf_token,
            private=False,
        )

        print(f"\n✅ Dataset uploaded successfully!")
        print(f"📁 HuggingFace: https://huggingface.co/datasets/{repo_id}")
        print(f"\n📈 Dataset Statistics:")
        print(f"   Total examples:       {len(examples):,}")
        print(f"   Comparable sales:     {categories.get('comparable_sales', 0):,}")
        print(f"   Card knowledge:       {categories.get('card_knowledge', 0):,}")
        print(f"   Market analysis:      {categories.get('market_analysis', 0):,}")
        print(f"   Reddit sentiment:     {categories.get('reddit_sentiment', 0):,}")
        print(f"   Pricing advice:       {categories.get('pricing_advice', 0):,}")
        print(f"\n🎉 Mew-1A v4.2 ULTIMATE is ready for training!")

    except Exception as e:
        print(f"\n❌ Upload failed: {e}")
        print("   Check your HuggingFace token and permissions")

if __name__ == "__main__":
    upload_to_huggingface()
