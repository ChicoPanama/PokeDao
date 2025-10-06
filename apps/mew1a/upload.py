#!/usr/bin/env python3
"""
Upload Project Mew-1A training data to HuggingFace (PRIVATE)
"""

import os
from huggingface_hub import HfApi, create_repo

# Configuration
TOKEN = os.environ.get("HUGGINGFACE_TOKEN", "")
USERNAME = "ChicoPanama"  # Your HuggingFace username
DATASET_NAME = f"{USERNAME}/pokedao-mew1a-training-data"
TRAINING_DATA_PATH = "../../data/mew1a-training-data.jsonl"

def upload_dataset():
    print("🧬 PROJECT MEW-1A: HuggingFace Dataset Upload")
    print("=" * 60)
    print()

    # Initialize API
    api = HfApi(token=TOKEN)

    # Step 1: Check if repository exists
    print("📦 Checking dataset repository...")
    try:
        repo_url = create_repo(
            repo_id=DATASET_NAME,
            token=TOKEN,
            repo_type="dataset",
            private=True,  # PRIVATE!
            exist_ok=True,  # Don't fail if exists
        )
        print(f"✅ Repository ready: {repo_url}")
    except Exception as e:
        print(f"⚠️  Using existing repository: {DATASET_NAME}")

    print()

    # Step 2: Upload training data
    print("📤 Uploading training data...")
    api.upload_file(
        path_or_fileobj=TRAINING_DATA_PATH,
        path_in_repo="train.jsonl",
        repo_id=DATASET_NAME,
        repo_type="dataset",
        token=TOKEN,
    )
    print("✅ Training data uploaded: train.jsonl")
    print()

    # Step 3: Create and upload README
    print("📝 Creating README...")
    readme_content = """# Project Mew-1A Training Dataset 🧬

> **PRIVATE DATASET** - The world's first AI training dataset for Pokemon TCG pricing analysis

## Dataset Description

This dataset contains **258 high-quality examples** extracted from **400,000+ real market listings** across 5 major marketplaces:
- eBay: 11,795 listings
- Courtyard: 353,201 tokenized assets
- Collector Crypt: 22,442 listings
- Phygitals: 20,487 NFTs
- TCGPlayer: 1 listing

## Task

**Instruction-tuned text generation** for TCG market analysis:
- **Input:** Card details, pricing data, market metrics
- **Output:** Investment recommendation with conviction score and analysis

## Format

JSONL with instruction-tuning format:

```json
{
  "instruction": "You are a TCG market analyst. Analyze this Pokemon card listing and provide a recommendation.",
  "input": "Card: Charizard - Base Set PSA 10\\nListed Price: $5000\\nFair Value: $6500 (based on 127 comps)\\nDiscount: -23.1%...",
  "output": "RECOMMENDATION: STRONG_BUY\\nCONVICTION: 85%\\nANALYSIS: Strong buy opportunity with 23.1% discount..."
}
```

## Statistics

- **Total Examples:** 258
- **Distribution:**
  - STRONG_BUY: 152 (58.9%)
  - HOLD: 69 (26.7%)
  - BUY: 25 (9.7%)
  - PASS: 12 (4.7%)
- **Avg Input Length:** 217 characters
- **Avg Output Length:** 233 characters

## Recommended Base Model

`meta-llama/Llama-3.2-3B-Instruct`

## Training Configuration (HuggingFace AutoTrain)

```python
{
  "base_model": "meta-llama/Llama-3.2-3B-Instruct",
  "task": "text-generation",
  "learning_rate": 2e-4,
  "num_epochs": 3,
  "batch_size": 4,
  "gradient_accumulation_steps": 4,
  "max_seq_length": 512,
  "lora_r": 8,
  "lora_alpha": 16,
  "lora_dropout": 0.05,
  "warmup_ratio": 0.1,
  "weight_decay": 0.01
}
```

## Fine-Tuning Instructions

### Using HuggingFace AutoTrain

1. Go to: https://huggingface.co/autotrain
2. Create new project → "Text Generation"
3. Select this dataset
4. Base model: `meta-llama/Llama-3.2-3B-Instruct`
5. Configure parameters above
6. Train! (~$20-30, 2-4 hours)

### Expected Results

- **Inference Speed:** <500ms per analysis
- **Accuracy:** 85%+ on TCG pricing tasks
- **Cost:** $0.001 per API call (HuggingFace Inference)
- **Deployment:** HuggingFace Inference API (no GPU needed)

## Model Architecture

**Project Mew-1A** will be fine-tuned using LoRA (Low-Rank Adaptation):
- Efficiently adapts base model with <1% parameters
- Faster training, lower cost
- Maintains base model's general knowledge
- Specialized for TCG domain

## Use Case

Powers PokeDAO's AI Ensemble:
- **Layer 1:** Mew-1A (fast TCG-specialized analysis)
- **Layer 2:** DeepSeek R1 (deep reasoning)
- **Layer 3:** Ensemble voting with conviction scoring

## Privacy & Access

🔒 **This dataset is PRIVATE** and for PokeDAO internal use only.

When Mew-1A proves successful, this may be open-sourced to benefit the TCG community.

## License

Proprietary - PokeDAO 2025

## Contact

- **GitHub:** https://github.com/ChicoPanama/PokeDao
- **Project:** PokeDAO - Systematic Pokemon TCG Investment Platform

---

**Built with ❤️ for the TCG community**
"""

    api.upload_file(
        path_or_fileobj=readme_content.encode('utf-8'),
        path_in_repo="README.md",
        repo_id=DATASET_NAME,
        repo_type="dataset",
        token=TOKEN,
    )
    print("✅ README uploaded")
    print()

    # Success!
    print("🎉 Upload Complete!")
    print("=" * 60)
    print()
    print("📊 Your PRIVATE dataset:")
    print(f"   https://huggingface.co/datasets/ChicoPanama/{DATASET_NAME}")
    print()
    print("🚀 Next Steps:")
    print("1. Go to: https://huggingface.co/autotrain")
    print("2. Create new project → Text Generation")
    print(f"3. Select dataset: ChicoPanama/{DATASET_NAME}")
    print("4. Base model: meta-llama/Llama-3.2-3B-Instruct")
    print("5. Configure training (see README)")
    print("6. Train! (~$20-30, 2-4 hours)")
    print()
    print("💡 After training:")
    print("   - Deploy to HuggingFace Inference API")
    print("   - Update AI Ensemble to use Mew-1A")
    print("   - Make dataset public when ready to announce!")

if __name__ == "__main__":
    upload_dataset()
