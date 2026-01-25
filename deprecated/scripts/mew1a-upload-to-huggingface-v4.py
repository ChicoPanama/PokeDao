#!/usr/bin/env python3
"""
Mew-1A v4 Comprehensive Dataset Upload to HuggingFace

Uploads the 89,256 example comprehensive TCG assistant dataset.

Dataset covers:
- Market Analysis (40k)
- Card Knowledge (29k)
- Deck Building (20k)
- Collection Management (400)
- Cross-Marketplace (250)
"""

import os
import json
from datasets import Dataset
from huggingface_hub import login

# Configuration
DATASET_FILE = "data/training/mew1a-v4-comprehensive-internal.jsonl"
HF_DATASET_NAME = "ChicoPanama/mew1a-v4-pokemon-tcg-comprehensive"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

def main():
    print("=" * 80)
    print("MEW-1A V4 COMPREHENSIVE DATASET UPLOAD")
    print("=" * 80)
    print(f"\nDataset: {HF_DATASET_NAME}")
    print(f"Source: {DATASET_FILE}")
    print(f"Description: Complete Pokémon TCG assistant with 5 domain expertise")
    print("=" * 80)

    # Authenticate
    if HF_TOKEN:
        login(token=HF_TOKEN)
        print("✅ Authenticated with HuggingFace\n")
    else:
        print("⚠️  HUGGINGFACE_TOKEN not set - upload may fail\n")

    # Load dataset
    print(f"📂 Loading dataset from: {DATASET_FILE}")
    examples = []
    with open(DATASET_FILE, 'r') as f:
        for line in f:
            examples.append(json.loads(line))

    print(f"✅ Loaded {len(examples):,} training examples\n")

    # Analyze dataset
    print("📊 DATASET ANALYSIS")
    print("-" * 80)

    # Category distribution
    categories = {}
    for ex in examples:
        cat = ex['category']
        categories[cat] = categories.get(cat, 0) + 1

    print("\nCategory Distribution:")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        pct = (count / len(examples)) * 100
        print(f"  • {cat:25s}: {count:6,} ({pct:5.2f}%)")

    # Price range distribution (market analysis only)
    price_ranges = {}
    for ex in examples:
        if ex['category'] == 'market_analysis' and 'metadata' in ex:
            pr = ex['metadata'].get('priceRange', 'unknown')
            price_ranges[pr] = price_ranges.get(pr, 0) + 1

    print("\nPrice Range Distribution (Market Analysis):")
    for pr, count in sorted(price_ranges.items(), key=lambda x: x[1], reverse=True):
        pct = (count / categories.get('market_analysis', 1)) * 100
        print(f"  • {pr:10s}: {count:6,} ({pct:5.2f}%)")

    # Dataset statistics
    total_chars = sum(len(ex['instruction']) + len(ex['output']) for ex in examples)
    avg_length = total_chars / len(examples)
    estimated_tokens = total_chars / 4  # Rough estimate: 4 chars per token

    print(f"\nDataset Statistics:")
    print(f"  • Total examples: {len(examples):,}")
    print(f"  • Avg example length: {int(avg_length)} characters")
    print(f"  • Total characters: {total_chars:,}")
    print(f"  • Estimated tokens: ~{int(estimated_tokens):,}")

    # Convert to HuggingFace Dataset
    print("\n🔄 Converting to HuggingFace Dataset format...")
    hf_dataset = Dataset.from_list(examples)
    print(f"✅ Created HuggingFace Dataset with {len(hf_dataset):,} examples")

    # Upload
    print(f"\n🚀 Uploading to HuggingFace: {HF_DATASET_NAME}")
    print("-" * 80)

    hf_dataset.push_to_hub(
        HF_DATASET_NAME,
        commit_message="Mew-1A v4: Comprehensive Pokémon TCG assistant dataset (89k examples)"
    )

    print("\n✅ UPLOAD COMPLETE!")
    print(f"📦 Dataset URL: https://huggingface.co/datasets/{HF_DATASET_NAME}")

    print("\n📈 Improvements over v3:")
    print("  • 45% more training examples (89k vs 62k)")
    print("  • 5 comprehensive domains (not just pricing)")
    print("  • Deck building & strategy expertise (20k examples)")
    print("  • Multi-marketplace knowledge (eBay, TCGPlayer, JustTCG, Collector Crypt)")
    print("  • Ready for complete TCG assistant deployment")

    print("\n🎯 Next Steps:")
    print("  1. Update training script dataset name to v4")
    print("  2. Launch RunPod training (12-16 hours on RTX 4090)")
    print("  3. Expected final loss: < 0.130 (vs v3: ~0.140, v2: ~0.150)")
    print("  4. Deploy with vLLM for multi-user Discord/Web access")
    print("  5. Mew-1A will be a COMPLETE Pokémon TCG expert!")

    print("\n" + "=" * 80)
    print("✅ ALL DONE! Mew-1A v4 dataset ready for training.")
    print("=" * 80)

if __name__ == "__main__":
    main()
