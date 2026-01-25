"""
Upload Mew-1A v4.1 ULTIMATE Dataset to HuggingFace
Includes 113,354 examples with 24,100 Reddit sentiment examples
"""

import json
from datasets import Dataset
import os

print("═" * 60)
print("   MEW-1A v4.1 ULTIMATE - HUGGINGFACE UPLOAD")
print("═" * 60)
print()

# Configuration
DATASET_FILE = "data/training/mew1a-v4.1-FINAL-ULTIMATE.jsonl"
HF_DATASET_NAME = "ChicoPanama/mew1a-v4.1-pokemon-tcg-ultimate-with-reddit"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

if not HF_TOKEN:
    print("❌ ERROR: HUGGINGFACE_TOKEN not set!")
    print("Set it with: export HUGGINGFACE_TOKEN=your_token")
    exit(1)

print(f"📂 Loading dataset: {DATASET_FILE}")

# Load JSONL file
examples = []
with open(DATASET_FILE, 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f, 1):
        if line.strip():
            try:
                # Fix emoji encoding issues
                line_clean = line.encode('utf-8', 'surrogatepass').decode('utf-8', 'ignore')
                example = json.loads(line_clean)

                # Clean all string fields to remove invalid unicode
                def clean_unicode(obj):
                    if isinstance(obj, dict):
                        return {k: clean_unicode(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [clean_unicode(item) for item in obj]
                    elif isinstance(obj, str):
                        return obj.encode('utf-8', 'ignore').decode('utf-8')
                    return obj

                examples.append(clean_unicode(example))
            except json.JSONDecodeError as e:
                print(f"⚠️  Skipping malformed line {i}: {e}")
            except Exception as e:
                print(f"⚠️  Skipping line {i}: {e}")

print(f"✅ Loaded {len(examples)} examples")
print()

# Analyze dataset
print("📊 Dataset Analysis:")
print("-" * 60)

categories = {}
for ex in examples:
    cat = ex.get('category', 'unknown')
    categories[cat] = categories.get(cat, 0) + 1

print(f"Total examples: {len(examples)}")
print()
print("By category:")
for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
    pct = (count / len(examples)) * 100
    print(f"  {cat}: {count:,} ({pct:.1f}%)")

print()
print("-" * 60)
print()

# Create HuggingFace dataset
print("📤 Creating HuggingFace dataset...")
hf_dataset = Dataset.from_list(examples)

print(f"✅ Dataset created with {len(hf_dataset)} examples")
print()

# Upload to HuggingFace Hub
print(f"🚀 Uploading to HuggingFace: {HF_DATASET_NAME}")
print("   (This may take a few minutes for 70 MB...)")
print()

hf_dataset.push_to_hub(
    HF_DATASET_NAME,
    token=HF_TOKEN,
    private=False  # Set to True if you want private
)

print()
print("═" * 60)
print("   UPLOAD COMPLETE!")
print("═" * 60)
print()
print(f"✅ Dataset uploaded successfully!")
print(f"📁 HuggingFace: https://huggingface.co/datasets/{HF_DATASET_NAME}")
print()
print("Dataset details:")
print(f"  - Total examples: {len(examples):,}")
print(f"  - File size: 70 MB")
print(f"  - Reddit sentiment: {categories.get('reddit_sentiment', 0):,} (21%)")
print(f"  - Market analysis: {categories.get('market_analysis', 0):,}")
print(f"  - Card knowledge: {categories.get('card_knowledge', 0):,}")
print(f"  - Deck building: {categories.get('deck_building', 0):,}")
print()
print("Next steps:")
print("  1. Update training script to use this dataset")
print("  2. Train Mew-1A v4.1 on RunPod (14-18 hours)")
print("  3. Deploy to Modal Labs")
print()
print("🎯 You now have the most comprehensive Pokemon TCG AI dataset!")
print()
