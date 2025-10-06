#!/usr/bin/env python3
"""
Add formatted 'text' column to Mew-1A dataset for AutoTrain compatibility

This reformats the dataset to have a 'text' column with proper instruction format.
"""

import os
from datasets import load_dataset
from huggingface_hub import HfApi

HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN", "")
DATASET_NAME = "ChicoPanama/pokedao-mew1a-training-data-layered"

def format_example(example):
    """Format dataset row into instruction-tuning text"""

    import json

    # Parse sample listings
    try:
        listings = json.loads(example['sample_listings']) if example['sample_listings'] else []
    except:
        listings = []

    # Build listing summary
    listing_text = ""
    for i, listing in enumerate(listings[:3], 1):
        price = listing.get('priceFormatted', 'N/A')
        source = listing.get('source', 'Unknown')
        grade = f"{listing.get('gradeCompany', '')} {listing.get('grade', '')}".strip()

        listing_text += f"\n  {i}. {source}: {price}"
        if grade:
            listing_text += f" ({grade})"

    # Create instruction-tuning format
    text = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are an expert Pokemon TCG pricing analyst. Analyze card listings and provide price tier classifications.

Price Tiers:
- 🌟 SECRET RARE: $100,000+ (Ultra-premium grails)
- 💫 ULTRA RARE: $10,000-100k (High-value collectibles)
- ✨ FULL ART: $1,000-10k (Premium cards)
- ⚡ HOLO RARE: $100-1k (Standard collectibles)
- 📦 UNCOMMON: $10-100 (Common playables)
- 📄 COMMON: $1-10 (Bulk cards)<|eot_id|><|start_header_id|>user<|end_header_id|>

Analyze this Pokemon card:

Card: {example['card_name']}
Set: {example['card_set']}
Number: {example['card_number'] or 'N/A'}
Variant: {example['variant'] or 'Standard'}
Rarity: {example['rarity'] or 'Unknown'}

Characteristics:
- First Edition: {example['is_first_edition']}
- Holo: {example['is_holo']}
- Reverse Holo: {example['is_reverse_holo']}
- Shadowless: {example['is_shadowless']}

Market Data:
- Average Price: {example['avg_price_formatted']}
- Total Listings: {example['total_listings']}
- Data Quality: {example['data_quality']:.0%}

Sample Listings:{listing_text}

What price tier does this card belong to?<|eot_id|><|start_header_id|>assistant<|end_header_id|>

Based on the market analysis:

**Price Tier**: {example['price_tier_emoji']} {example['price_tier']}

**Analysis**:
- Average market price: {example['avg_price_formatted']}
- Market depth: {example['total_listings']} active listings
- Classification: {example['price_tier']}

This card falls into the **{example['price_tier']}** tier based on its average price of {example['avg_price_formatted']}. The {example['total_listings']} active listings provide {"strong" if example['total_listings'] > 10 else "moderate" if example['total_listings'] > 3 else "limited"} market liquidity.<|eot_id|>"""

    return {"text": text}

def main():
    print("🔧 Adding 'text' column to Mew-1A dataset...")
    print()

    # Load dataset
    print("📥 Loading dataset from HuggingFace...")
    dataset = load_dataset(DATASET_NAME, token=HUGGINGFACE_TOKEN)
    train_dataset = dataset['train']
    print(f"   ✓ Loaded {len(train_dataset)} examples")
    print()

    # Add text column
    print("🔄 Formatting examples with instruction template...")
    formatted_dataset = train_dataset.map(
        format_example,
        desc="Adding text column"
    )
    print(f"   ✓ Formatted {len(formatted_dataset)} examples")
    print()

    # Show sample
    print("📝 Sample formatted text:")
    print("-" * 70)
    print(formatted_dataset[0]['text'][:500] + "...")
    print("-" * 70)
    print()

    # Push to hub
    print("📤 Pushing updated dataset to HuggingFace...")
    formatted_dataset.push_to_hub(
        DATASET_NAME,
        token=HUGGINGFACE_TOKEN,
        private=False
    )
    print("   ✓ Dataset updated successfully")
    print()

    print("✅ COMPLETE!")
    print()
    print(f"Dataset now has 'text' column ready for AutoTrain")
    print(f"URL: https://huggingface.co/datasets/{DATASET_NAME}")
    print()
    print("You can now use in AutoTrain:")
    print(f"  Hub dataset path: {DATASET_NAME}")
    print(f"  Column mapping: text -> text")

if __name__ == "__main__":
    main()
