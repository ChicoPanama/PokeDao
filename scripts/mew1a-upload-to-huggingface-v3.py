#!/usr/bin/env python3

"""
Upload Mew-1A v3 MAXIMIZED Training Dataset to HuggingFace

Uploads 200,000+ training examples extracted from ALL 216,848 usable records

Improvements over v2:
- 5x more training examples (200k vs 40k)
- Better set coverage via title parsing
- Enhanced data quality and diversity
- Covers all price ranges and card types

Dataset: ChicoPanama/mew1a-v3-pokemon-tcg-pricing-maximized
"""

import json
import os
from pathlib import Path
from typing import List, Dict
from datasets import Dataset
from huggingface_hub import login, HfApi

# Configuration
DATASET_PATH = Path(__file__).parent.parent / "data" / "training" / "mew1a-v3-training-data-maximized.jsonl"
DATASET_NAME = "ChicoPanama/mew1a-v3-pokemon-tcg-pricing-maximized"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

def load_jsonl_dataset(file_path: Path) -> List[Dict]:
    """Load JSONL training data"""
    print(f"📂 Loading dataset from: {file_path}")

    if not file_path.exists():
        raise FileNotFoundError(f"Dataset not found: {file_path}")

    data = []
    with open(file_path, 'r') as f:
        for line_num, line in enumerate(f, 1):
            try:
                example = json.loads(line.strip())
                data.append(example)
            except json.JSONDecodeError as e:
                print(f"⚠️  Error parsing line {line_num}: {e}")
                continue

    print(f"✅ Loaded {len(data):,} training examples")
    return data

def analyze_dataset(data: List[Dict]):
    """Analyze dataset composition"""
    print("\n📊 DATASET ANALYSIS")
    print("─" * 80)

    # Category distribution
    categories = {}
    price_ranges = {}
    total_chars = 0
    unique_cards = set()
    unique_sets = set()
    with_grades = 0

    for example in data:
        cat = example.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1

        if 'metadata' in example:
            meta = example['metadata']
            if 'priceRange' in meta:
                pr = meta['priceRange']
                price_ranges[pr] = price_ranges.get(pr, 0) + 1
            if 'cardName' in meta and meta['cardName']:
                unique_cards.add(meta['cardName'])
            if 'setName' in meta and meta['setName']:
                unique_sets.add(meta['setName'])
            if meta.get('hasGrade'):
                with_grades += 1

        # Calculate total character count
        total_chars += len(example['instruction']) + len(example['output'])

    print("\nCategory Distribution:")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        pct = (count / len(data)) * 100
        print(f"  • {cat:30s}: {count:6,} ({pct:5.2f}%)")

    print("\nPrice Range Distribution:")
    for pr, count in sorted(price_ranges.items(), key=lambda x: x[1], reverse=True):
        pct = (count / len(data)) * 100
        print(f"  • {pr:10s}: {count:6,} ({pct:5.2f}%)")

    avg_chars = total_chars / len(data)
    print(f"\nDataset Statistics:")
    print(f"  • Total examples: {len(data):,}")
    print(f"  • Unique cards: {len(unique_cards):,}")
    print(f"  • Unique sets: {len(unique_sets):,}")
    print(f"  • With grades: {with_grades:,} ({100*with_grades/len(data):.1f}%)")
    print(f"  • Avg example length: {avg_chars:.0f} characters")
    print(f"  • Total characters: {total_chars:,}")
    print(f"  • Estimated tokens: ~{total_chars // 4:,}")

def create_huggingface_dataset(data: List[Dict]) -> Dataset:
    """Convert to HuggingFace Dataset format"""
    print("\n🔄 Converting to HuggingFace Dataset format...")

    # Extract fields for Dataset
    dataset_dict = {
        'instruction': [ex['instruction'] for ex in data],
        'input': [ex['input'] for ex in data],
        'output': [ex['output'] for ex in data],
        'category': [ex['category'] for ex in data],
    }

    # Add metadata fields if they exist
    if data and 'metadata' in data[0]:
        dataset_dict['card_name'] = [ex.get('metadata', {}).get('cardName', '') for ex in data]
        dataset_dict['set_name'] = [ex.get('metadata', {}).get('setName', '') for ex in data]
        dataset_dict['price_range'] = [ex.get('metadata', {}).get('priceRange', '') for ex in data]
        dataset_dict['has_grade'] = [ex.get('metadata', {}).get('hasGrade', False) for ex in data]

    dataset = Dataset.from_dict(dataset_dict)
    print(f"✅ Created HuggingFace Dataset with {len(dataset):,} examples")

    return dataset

def upload_to_huggingface(dataset: Dataset, dataset_name: str):
    """Upload dataset to HuggingFace Hub"""
    print(f"\n🚀 Uploading to HuggingFace: {dataset_name}")
    print("─" * 80)

    if not HF_TOKEN:
        print("❌ Error: HUGGINGFACE_TOKEN environment variable not set")
        print("\nTo upload, set your HuggingFace token:")
        print("  export HUGGINGFACE_TOKEN=your_token_here")
        print("\nGet your token at: https://huggingface.co/settings/tokens")
        return False

    try:
        # Login to HuggingFace
        login(token=HF_TOKEN)
        print("✅ Authenticated with HuggingFace")

        # Push dataset to Hub
        print(f"\n⬆️  Pushing dataset to {dataset_name}...")
        dataset.push_to_hub(
            dataset_name,
            private=False,
            commit_message="Upload Mew-1A v3 maximized dataset (200,000+ examples from all 216k records)"
        )

        print(f"\n✅ UPLOAD COMPLETE!")
        print(f"📦 Dataset URL: https://huggingface.co/datasets/{dataset_name}")
        print("\n📈 Improvements over v2:")
        print("  • 5x more training examples (200k vs 40k)")
        print("  • Better set coverage via title parsing")
        print("  • Utilizes ALL 216k usable database records")
        print("  • Enhanced data quality and diversity")
        print("\n🎯 Next Steps:")
        print("  1. View dataset on HuggingFace Hub")
        print("  2. Update training script to use v3 dataset")
        print("  3. Launch training on RunPod RTX 4090 (10-14 hours)")
        print("  4. Monitor training metrics (target loss < 0.140)")
        print("  5. Deploy Mew-1A v3 to Modal Labs")

        return True

    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return False

def main():
    """Main execution"""
    print("═" * 80)
    print("MEW-1A V3 MAXIMIZED TRAINING DATASET UPLOAD")
    print("═" * 80)
    print(f"\nDataset: {DATASET_NAME}")
    print(f"Source: {DATASET_PATH}")
    print("Target: 200,000+ examples from ALL usable records")
    print("═" * 80)

    # Load dataset
    if not DATASET_PATH.exists():
        print(f"❌ Error: Dataset not found at {DATASET_PATH}")
        print(f"\nPlease run extraction first:")
        print(f"  pnpm tsx scripts/mew1a-extract-training-data-v3-maximized.ts")
        return 1

    data = load_jsonl_dataset(DATASET_PATH)

    # Analyze
    analyze_dataset(data)

    # Convert to HuggingFace format
    dataset = create_huggingface_dataset(data)

    # Upload
    success = upload_to_huggingface(dataset, DATASET_NAME)

    if success:
        print("\n" + "═" * 80)
        print("✅ ALL DONE! Mew-1A v3 dataset ready for training.")
        print("═" * 80)
        return 0
    else:
        print("\n" + "═" * 80)
        print("⚠️  Upload skipped. Set HUGGINGFACE_TOKEN to upload.")
        print("═" * 80)
        return 0

if __name__ == "__main__":
    exit(main())
