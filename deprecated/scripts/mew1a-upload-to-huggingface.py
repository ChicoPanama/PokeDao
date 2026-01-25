#!/usr/bin/env python3
"""
Upload Project Mew-1A training data to HuggingFace Dataset Hub

Prerequisites:
1. pip3 install huggingface_hub datasets
2. Set HUGGINGFACE_TOKEN env var

Usage:
  export HUGGINGFACE_TOKEN=hf_...
  python3 scripts/mew1a-upload-to-huggingface.py
"""

import json
import os
from datetime import datetime
from pathlib import Path

try:
    from huggingface_hub import HfApi, create_repo
    from datasets import Dataset
except ImportError:
    print("❌ Error: Required packages not installed")
    print("")
    print("Install with:")
    print("  pip3 install huggingface_hub datasets")
    print("")
    exit(1)

HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")
DATASET_NAME = "ChicoPanama/pokedao-mew1a-training-data-layered"
TRAINING_DATA_PATH = "data/mew1a/training-data-v1.json"

def main():
    print("🚀 MEW-1A TRAINING DATA: HuggingFace Upload")
    print("=" * 60)
    print("")

    # Step 1: Validate token
    if not HUGGINGFACE_TOKEN:
        print("❌ Error: HUGGINGFACE_TOKEN environment variable not set")
        print("")
        print("Setup:")
        print("1. Go to: https://huggingface.co/settings/tokens")
        print("2. Create new token with 'write' access")
        print("3. Run: export HUGGINGFACE_TOKEN=hf_...")
        print("")
        exit(1)

    print("✅ HuggingFace token found")

    # Step 2: Load training data
    print("📂 Loading training data...")

    if not Path(TRAINING_DATA_PATH).exists():
        print(f"❌ Error: Training data not found at {TRAINING_DATA_PATH}")
        print("")
        print("Run first:")
        print("  pnpm tsx scripts/mew1a-extract-training-data.ts")
        print("")
        exit(1)

    with open(TRAINING_DATA_PATH, 'r') as f:
        data = json.load(f)

    examples = data['examples']
    metadata = data['metadata']

    print(f"   ✓ Loaded {len(examples)} training examples")
    print(f"   ✓ Tier System: {metadata['tierSystem']}")
    print(f"   ✓ Source: {metadata['source']}")
    print("")

    # Step 3: Prepare dataset for HuggingFace
    print("🔧 Preparing HuggingFace dataset...")

    # Convert to HuggingFace Dataset format
    dataset_dict = {
        'id': [],
        'card_name': [],
        'card_set': [],
        'card_number': [],
        'variant': [],
        'rarity': [],
        'is_first_edition': [],
        'is_holo': [],
        'is_reverse_holo': [],
        'is_shadowless': [],
        'avg_price_cents': [],
        'avg_price_formatted': [],
        'total_listings': [],
        'price_tier': [],
        'price_tier_emoji': [],
        'sample_listings': [],
        'data_quality': []
    }

    for ex in examples:
        dataset_dict['id'].append(ex['id'])
        dataset_dict['card_name'].append(ex['card']['canonicalName'])
        dataset_dict['card_set'].append(ex['card']['canonicalSet'])
        dataset_dict['card_number'].append(ex['card'].get('cardNumber'))
        dataset_dict['variant'].append(ex['card'].get('variant'))
        dataset_dict['rarity'].append(ex['card'].get('rarity'))
        dataset_dict['is_first_edition'].append(ex['card'].get('isFirstEdition', False))
        dataset_dict['is_holo'].append(ex['card'].get('isHolo', False))
        dataset_dict['is_reverse_holo'].append(ex['card'].get('isReverseHolo', False))
        dataset_dict['is_shadowless'].append(ex['card'].get('isShadowless', False))
        dataset_dict['avg_price_cents'].append(ex['pricing']['avgPriceCents'])
        dataset_dict['avg_price_formatted'].append(ex['pricing']['avgPriceFormatted'])
        dataset_dict['total_listings'].append(ex['pricing']['totalListings'])
        dataset_dict['price_tier'].append(ex['pricing']['tier'])
        dataset_dict['price_tier_emoji'].append(ex['pricing']['tierEmoji'])
        dataset_dict['sample_listings'].append(json.dumps(ex['sampleListings']))
        dataset_dict['data_quality'].append(ex['metadata'].get('dataQuality', 0.5))

    dataset = Dataset.from_dict(dataset_dict)

    print(f"   ✓ Dataset prepared: {len(dataset)} rows")
    print(f"   ✓ Columns: {len(dataset.column_names)} fields")
    print("")

    # Step 4: Create repository
    print("📦 Creating HuggingFace repository...")

    try:
        api = HfApi(token=HUGGINGFACE_TOKEN)

        create_repo(
            repo_id=DATASET_NAME,
            token=HUGGINGFACE_TOKEN,
            repo_type="dataset",
            exist_ok=True,
            private=False
        )

        print(f"   ✓ Repository created/verified: {DATASET_NAME}")
        print("")

    except Exception as e:
        print(f"❌ Failed to create repository: {e}")
        exit(1)

    # Step 5: Upload dataset
    print("📤 Uploading dataset to HuggingFace...")

    try:
        dataset.push_to_hub(
            DATASET_NAME,
            token=HUGGINGFACE_TOKEN,
            private=False
        )

        print("   ✓ Dataset uploaded successfully")
        print("")

    except Exception as e:
        print(f"❌ Failed to upload dataset: {e}")
        exit(1)

    # Step 6: Upload dataset card (README)
    print("📄 Creating dataset card...")

    tier_distribution = metadata['tierDistribution']
    tier_table = "\n".join([
        f"| {metadata['tiers'][tier]['emoji']} {metadata['tiers'][tier]['label']} | {count:,} | {(count/len(examples)*100):.1f}% |"
        for tier, count in tier_distribution.items()
    ])

    readme = f"""# PokeDAO Mew-1A Training Dataset (Layered Architecture)

🧬 **Project Mew-1A**: The world's first AI training dataset specifically for Pokemon TCG pricing analysis, extracted from a production-ready layered database architecture.

## Dataset Description

This dataset contains **{len(examples):,} high-quality training examples** extracted from PokeDAO's layered database containing **116,744 market listings** across multiple marketplaces.

### Layered Architecture

The data is sourced from a 6-layer database architecture:

- **Layer 0**: Official Pokemon TCG metadata (21,626 cards from TCGdex)
- **Layer 1**: Canonical card registry (35,421 unique card variants)
- **Layer 2**: Market listings (116,744 listings - SOURCE OF THIS DATASET)
- **Layer 3**: Sale records (pending)
- **Layer 4**: Consensus pricing (pending)
- **Layer 5**: Signals & alerts (pending)

## Price Tier Classification

Each card is classified into **TCG Rarity-Based Price Tiers**:

| Tier | Count | Percentage |
|------|-------|------------|
{tier_table}

### Tier Definitions

- 🌟 **SECRET RARE**: $100,000+ (Ultra-premium grails)
- 💫 **ULTRA RARE**: $10,000-100k (High-value collectibles)
- ✨ **FULL ART**: $1,000-10k (Premium cards)
- ⚡ **HOLO RARE**: $100-1k (Standard collectibles)
- 📦 **UNCOMMON**: $10-100 (Common playables)
- 📄 **COMMON**: $1-10 (Bulk cards)

## Dataset Structure

### Features

- `id`: Unique example identifier
- `card_name`: Canonical card name
- `card_set`: TCG set name
- `card_number`: Card number in set
- `variant`: Card variant (holo, reverse holo, etc.)
- `rarity`: Official TCG rarity
- `is_first_edition`: First edition flag
- `is_holo`: Holographic flag
- `is_reverse_holo`: Reverse holo flag
- `is_shadowless`: Shadowless variant flag
- `avg_price_cents`: Average price in cents
- `avg_price_formatted`: Human-readable price
- `total_listings`: Number of market listings
- `price_tier`: TCG-based price tier
- `price_tier_emoji`: Tier emoji indicator
- `sample_listings`: JSON array of sample listings
- `data_quality`: Data quality score (0-1)

### Example Row

```python
{{
  'id': 'mew1a-1',
  'card_name': 'Charizard',
  'card_set': 'Base Set',
  'card_number': '4/102',
  'variant': 'Holo',
  'rarity': 'Rare Holo',
  'avg_price_cents': 50000,
  'avg_price_formatted': '$500.00',
  'total_listings': 42,
  'price_tier': 'HOLO RARE',
  'price_tier_emoji': '⚡',
  ...
}}
```

## Use Cases

1. **Price Prediction Models**: Train models to predict card prices based on attributes
2. **Market Analysis**: Analyze pricing trends across tiers and sets
3. **Investment Recommendations**: Build systems to identify undervalued cards
4. **Price Tier Classification**: Classify cards into value tiers
5. **Anomaly Detection**: Identify mispriced listings

## Recommended Models

- **Base Model**: `meta-llama/Llama-3.2-3B-Instruct`
- **Task**: Text generation / Classification
- **Fine-tuning**: LoRA (rank 8, alpha 16)

## Metadata

- **Version**: {metadata['version']}
- **Created**: {metadata['createdAt']}
- **Source**: {metadata['source']}
- **Tier System**: {metadata['tierSystem']}
- **Total Examples**: {metadata['totalExamples']:,}
- **Duration**: {metadata['duration']}

## Data Sources

- eBay Browse API
- Courtyard (Ethereum + Polygon tokenized cards)
- Collector Crypt (Helius/Solana NFTs)
- Phygitals (Solana NFT marketplace)
- TCG Player API

## License

Proprietary - PokeDAO 2025

## Citation

```bibtex
@dataset{{pokedao_mew1a_2025,
  title={{PokeDAO Mew-1A Training Dataset}},
  author={{PokeDAO}},
  year={{2025}},
  publisher={{HuggingFace}},
  url={{https://huggingface.co/datasets/{DATASET_NAME}}}
}}
```

## Links

- **PokeDAO**: [GitHub](https://github.com/pokedao)
- **Project Mew-1A**: Fine-tuned Llama-3.2-3B for TCG pricing
- **Database Architecture**: 6-layer canonical system

---

Generated with Project Mew-1A | {datetime.now().strftime('%Y-%m-%d')}
"""

    try:
        api.upload_file(
            path_or_fileobj=readme.encode('utf-8'),
            path_in_repo="README.md",
            repo_id=DATASET_NAME,
            repo_type="dataset",
            token=HUGGINGFACE_TOKEN,
        )

        print("   ✓ Dataset card uploaded")
        print("")

    except Exception as e:
        print(f"⚠️  Warning: Failed to upload README: {e}")
        print("")

    # Success!
    print("=" * 60)
    print("🎉 UPLOAD COMPLETE!")
    print("=" * 60)
    print("")
    print(f"📊 Dataset URL:")
    print(f"   https://huggingface.co/datasets/{DATASET_NAME}")
    print("")
    print("📈 Tier Distribution:")
    for tier, count in tier_distribution.items():
        tier_info = metadata['tiers'][tier]
        percentage = (count / len(examples) * 100)
        print(f"   {tier_info['emoji']} {tier_info['label']:12s} {count:5,} ({percentage:5.1f}%)")
    print("")
    print("🚀 Next Steps:")
    print("1. Visit the dataset page to verify upload")
    print("2. Use HuggingFace AutoTrain or custom training script")
    print("3. Fine-tune Llama-3.2-3B on this dataset")
    print("4. Deploy as Project Mew-1A inference endpoint")
    print("")

if __name__ == "__main__":
    main()
