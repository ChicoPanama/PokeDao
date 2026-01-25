---
language:
- en
license: other
task_categories:
- text-classification
- text-generation
- tabular-classification
tags:
- pokemon
- tcg
- trading-cards
- pricing
- market-analysis
- collectibles
- finance
pretty_name: PokeDAO Mew-1A Training Dataset (Layered)
size_categories:
- 1K<n<10K
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*
dataset_info:
  features:
  - name: id
    dtype: string
  - name: card_name
    dtype: string
  - name: card_set
    dtype: string
  - name: card_number
    dtype: string
  - name: variant
    dtype: string
  - name: rarity
    dtype: string
  - name: is_first_edition
    dtype: bool
  - name: is_holo
    dtype: bool
  - name: is_reverse_holo
    dtype: bool
  - name: is_shadowless
    dtype: bool
  - name: avg_price_cents
    dtype: int64
  - name: avg_price_formatted
    dtype: string
  - name: total_listings
    dtype: int64
  - name: price_tier
    dtype: string
  - name: price_tier_emoji
    dtype: string
  - name: sample_listings
    dtype: string
  - name: data_quality
    dtype: float64
  splits:
  - name: train
    num_bytes: 5213440
    num_examples: 10000
  download_size: 2145280
  dataset_size: 5213440
---

# PokeDAO Mew-1A Training Dataset (Layered Architecture)

🧬 **Project Mew-1A**: The world's first AI training dataset specifically for Pokemon TCG pricing analysis, extracted from a production-ready layered database architecture.

## Dataset Description

This dataset contains **10,000 high-quality training examples** extracted from PokeDAO's layered database containing **116,744 market listings** across multiple marketplaces.

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
| 🌟 SECRET RARE | 13 | 0.1% |
| 💫 ULTRA RARE | 203 | 2.0% |
| ✨ FULL ART | 1,156 | 11.6% |
| ⚡ HOLO RARE | 6,930 | 69.3% |
| 📦 UNCOMMON | 1,698 | 17.0% |
| 📄 COMMON | 0 | 0.0% |

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
{
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
}
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

## Training Configuration

```yaml
model: meta-llama/Llama-3.2-3B-Instruct
task: text-generation
method: LoRA
parameters:
  lora_rank: 8
  lora_alpha: 16
  learning_rate: 2e-4
  epochs: 3
  batch_size: 4
  gradient_accumulation_steps: 4
```

## Metadata

- **Version**: v1
- **Created**: 2025-10-05
- **Source**: Layered Database (canonical_cards + market_listings)
- **Tier System**: TCG Rarity-Based (Option B)
- **Total Examples**: 10,000
- **File Size**: ~5MB

## Data Sources

- eBay Browse API
- Courtyard (Ethereum + Polygon tokenized cards)
- Collector Crypt (Helius/Solana NFTs)
- Phygitals (Solana NFT marketplace)
- TCG Player API

## License

Proprietary - PokeDAO 2025

For commercial use, please contact: [PokeDAO Team]

## Citation

```bibtex
@dataset{pokedao_mew1a_2025,
  title={PokeDAO Mew-1A Training Dataset},
  author={PokeDAO},
  year={2025},
  publisher={HuggingFace},
  url={https://huggingface.co/datasets/ChicoPanama/pokedao-mew1a-training-data-layered}
}
```

## Links

- **PokeDAO**: [GitHub](https://github.com/pokedao)
- **Project Mew-1A**: Fine-tuned Llama-3.2-3B for TCG pricing
- **Database Architecture**: 6-layer canonical system

---

Generated with Project Mew-1A | 2025-10-05
