#!/usr/bin/env python3
"""
Project Mew-1A: Fine-tune Llama-3.2-3B for Pokemon TCG Pricing

This script fine-tunes meta-llama/Llama-3.2-3B-Instruct on the PokeDAO
training dataset using LoRA (Low-Rank Adaptation) for efficient training.

Prerequisites:
1. pip3 install torch transformers datasets peft accelerate bitsandbytes trl
2. HuggingFace account with Llama access approval
3. GPU with at least 16GB VRAM (or use Colab/RunPod)

Usage:
  export HUGGINGFACE_TOKEN=hf_...
  python3 apps/mew1a/train-mew1a.py
"""

import os
import torch
from datetime import datetime
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# Configuration
HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"
DATASET_NAME = "ChicoPanama/pokedao-mew1a-training-data-layered"
OUTPUT_DIR = "./mew1a-model"
HF_REPO_NAME = "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"

# Training hyperparameters
LORA_RANK = 8
LORA_ALPHA = 16
LORA_DROPOUT = 0.05
LEARNING_RATE = 2e-4
NUM_EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION_STEPS = 4
MAX_SEQ_LENGTH = 512

def format_training_example(example):
    """
    Convert dataset example to instruction-tuning format for Llama.

    Format:
    <|begin_of_text|><|start_header_id|>system<|end_header_id|>
    You are a Pokemon TCG pricing expert...<|eot_id|>
    <|start_header_id|>user<|end_header_id|>
    [card details]<|eot_id|>
    <|start_header_id|>assistant<|end_header_id|>
    [analysis]<|eot_id|>
    """

    # Parse sample listings
    import json
    listings = json.loads(example['sample_listings']) if example['sample_listings'] else []

    # Build listing summary
    listing_text = ""
    for i, listing in enumerate(listings[:3], 1):
        price = listing.get('priceFormatted', 'N/A')
        source = listing.get('source', 'Unknown')
        grade = f"{listing.get('gradeCompany', '')} {listing.get('grade', '')}".strip()
        condition = listing.get('condition', '')

        listing_text += f"\n  {i}. {source}: {price}"
        if grade:
            listing_text += f" ({grade})"
        elif condition:
            listing_text += f" ({condition})"

    # System prompt
    system = """You are an expert Pokemon TCG pricing analyst. Analyze card listings and provide price tier classifications based on market data.

Price Tiers:
- 🌟 SECRET RARE: $100,000+ (Ultra-premium grails)
- 💫 ULTRA RARE: $10,000-100k (High-value collectibles)
- ✨ FULL ART: $1,000-10k (Premium cards)
- ⚡ HOLO RARE: $100-1k (Standard collectibles)
- 📦 UNCOMMON: $10-100 (Common playables)
- 📄 COMMON: $1-10 (Bulk cards)"""

    # User query
    user_query = f"""Analyze this Pokemon card:

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
- Data Quality: {example['data_quality']:.1%}

Sample Listings:{listing_text}

What price tier does this card belong to?"""

    # Assistant response
    assistant_response = f"""Based on the market analysis:

**Price Tier**: {example['price_tier_emoji']} {example['price_tier']}

**Analysis**:
- Average market price: {example['avg_price_formatted']}
- Market depth: {example['total_listings']} active listings
- Classification: {example['price_tier']}

This card falls into the **{example['price_tier']}** tier based on its average price of {example['avg_price_formatted']}. The {example['total_listings']} active listings provide {"strong" if example['total_listings'] > 10 else "moderate" if example['total_listings'] > 3 else "limited"} market liquidity."""

    # Format for Llama-3.2 chat template
    text = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{system}<|eot_id|><|start_header_id|>user<|end_header_id|>

{user_query}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{assistant_response}<|eot_id|>"""

    return {"text": text}


def main():
    print("🧬 PROJECT MEW-1A: Fine-tuning Llama-3.2-3B")
    print("=" * 70)
    print()

    # Validate token
    if not HUGGINGFACE_TOKEN:
        print("❌ Error: HUGGINGFACE_TOKEN not set")
        print()
        print("Setup:")
        print("1. Get token: https://huggingface.co/settings/tokens")
        print("2. Request Llama access: https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct")
        print("3. Run: export HUGGINGFACE_TOKEN=hf_...")
        return

    print(f"✅ Using base model: {BASE_MODEL}")
    print(f"✅ Training dataset: {DATASET_NAME}")
    print()

    # Load dataset
    print("📥 Loading dataset from HuggingFace...")
    dataset = load_dataset(DATASET_NAME, token=HUGGINGFACE_TOKEN)
    train_dataset = dataset['train']

    print(f"   ✓ Loaded {len(train_dataset)} training examples")
    print()

    # Format dataset
    print("🔄 Formatting for instruction tuning...")
    formatted_dataset = train_dataset.map(
        format_training_example,
        remove_columns=train_dataset.column_names,
        desc="Formatting examples"
    )
    print(f"   ✓ Formatted {len(formatted_dataset)} examples")
    print()

    # Show example
    print("📝 Example training instance:")
    print("-" * 70)
    print(formatted_dataset[0]['text'][:500] + "...")
    print("-" * 70)
    print()

    # Configure 4-bit quantization for efficient training
    print("⚙️  Configuring 4-bit quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    print("   ✓ 4-bit quantization configured")
    print()

    # Load model
    print(f"📦 Loading base model: {BASE_MODEL}")
    print("   (This may take a few minutes...)")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        token=HUGGINGFACE_TOKEN,
        trust_remote_code=True,
    )
    model.config.use_cache = False
    model.config.pretraining_tp = 1
    print("   ✓ Model loaded")
    print()

    # Load tokenizer
    print("📝 Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
        token=HUGGINGFACE_TOKEN,
        trust_remote_code=True,
    )
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    print("   ✓ Tokenizer loaded")
    print()

    # Prepare model for LoRA
    print("🔧 Preparing model for LoRA training...")
    model = prepare_model_for_kbit_training(model)

    # Configure LoRA
    peft_config = LoraConfig(
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        r=LORA_RANK,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )

    model = get_peft_model(model, peft_config)
    print("   ✓ LoRA configured")
    print()

    # Print trainable parameters
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"📊 Model statistics:")
    print(f"   Total parameters: {total_params:,}")
    print(f"   Trainable parameters: {trainable_params:,}")
    print(f"   Trainable %: {100 * trainable_params / total_params:.2f}%")
    print()

    # Training arguments
    print("⚙️  Configuring training...")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION_STEPS,
        learning_rate=LEARNING_RATE,
        fp16=True,
        save_strategy="epoch",
        logging_steps=10,
        warmup_ratio=0.1,
        weight_decay=0.01,
        optim="paged_adamw_8bit",
        lr_scheduler_type="cosine",
        report_to="none",  # Can enable "wandb" or "tensorboard"
        push_to_hub=False,  # We'll push manually after training
    )

    print(f"   Learning rate: {LEARNING_RATE}")
    print(f"   Epochs: {NUM_EPOCHS}")
    print(f"   Batch size: {BATCH_SIZE}")
    print(f"   Gradient accumulation: {GRADIENT_ACCUMULATION_STEPS}")
    print(f"   Effective batch size: {BATCH_SIZE * GRADIENT_ACCUMULATION_STEPS}")
    print()

    # Create trainer
    print("🎯 Initializing trainer...")
    trainer = SFTTrainer(
        model=model,
        train_dataset=formatted_dataset,
        peft_config=peft_config,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        tokenizer=tokenizer,
        args=training_args,
    )
    print("   ✓ Trainer ready")
    print()

    # Start training
    print("=" * 70)
    print("🚀 STARTING TRAINING")
    print("=" * 70)
    print()

    start_time = datetime.now()

    trainer.train()

    duration = datetime.now() - start_time
    print()
    print("=" * 70)
    print("✅ TRAINING COMPLETE!")
    print("=" * 70)
    print(f"⏱️  Duration: {duration}")
    print()

    # Save model
    print("💾 Saving model...")
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"   ✓ Saved to: {OUTPUT_DIR}")
    print()

    # Push to HuggingFace Hub
    print("📤 Pushing to HuggingFace Hub...")
    try:
        trainer.model.push_to_hub(
            HF_REPO_NAME,
            token=HUGGINGFACE_TOKEN,
            commit_message=f"Project Mew-1A v1.0 - Trained on {len(train_dataset)} examples"
        )
        tokenizer.push_to_hub(HF_REPO_NAME, token=HUGGINGFACE_TOKEN)
        print(f"   ✓ Uploaded to: https://huggingface.co/{HF_REPO_NAME}")
    except Exception as e:
        print(f"   ⚠️  Upload failed: {e}")
        print(f"   You can manually upload from: {OUTPUT_DIR}")

    print()
    print("=" * 70)
    print("🎉 PROJECT MEW-1A TRAINING COMPLETE")
    print("=" * 70)
    print()
    print("Next steps:")
    print("1. Test the model with inference script")
    print("2. Deploy to HuggingFace Inference API")
    print("3. Integrate with PokeDAO AI Ensemble")
    print()


if __name__ == "__main__":
    main()
