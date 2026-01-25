#!/usr/bin/env python3

"""
Mew-1A v4.3 Training Script - PRODUCTION QUALITY DATASET
=========================================================

Fine-tune Llama-3.2-3B-Instruct on 253,810 examples with enhanced quality controls.

v4.3 Improvements:
- Removed BID hallucinations (was 22.7K, now 15K genuine BUY/PASS examples)
- Fixed card name parsing (92.15% valid vs 91.50% in v4.2)
- Better price sanity (62.54% vs 60.15% in v4.2)
- Overall Quality Score: 82.24/100 (vs 79.48 in v4.2)

Dataset Composition:
- 238,810 examples: Temporal eBay + Reddit + Internal + Marketplace
- 15,000 examples: BUY/PASS decisions (no hallucinations)
- Total: 253,810 examples

Target Performance:
- Final Loss: < 0.140 (improvement over v4.2)
- Training Time: ~16-20 hours on RTX 4090
- Cost: ~$45-60 on RunPod

Model Output: ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg
"""

import os
import sys
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model
from huggingface_hub import login

# =============================================================================
# CONFIGURATION
# =============================================================================

MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"
DATASET_NAME = "ChicoPanama/mew1a-v4.3-training-data"
OUTPUT_DIR = "./mew1a-v4.3-output"
HF_MODEL_ID = "ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

# Training hyperparameters (optimized for 253K examples)
LEARNING_RATE = 2e-4
NUM_EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4  # Effective batch size = 16
MAX_LENGTH = 512
WARMUP_STEPS = 200
SAVE_STEPS = 1000
LOGGING_STEPS = 100

# LoRA configuration
LORA_R = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.05

# =============================================================================
# FORMATTING FUNCTION
# =============================================================================

def format_instruction(example):
    """Format example for instruction tuning"""
    if example.get('input') and example['input'].strip():
        text = f"""Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{example['instruction']}

### Input:
{example['input']}

### Response:
{example['output']}"""
    else:
        text = f"""Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{example['instruction']}

### Response:
{example['output']}"""

    return {"text": text}

# =============================================================================
# MAIN TRAINING FUNCTION
# =============================================================================

def main():
    """Main training loop"""
    print("=" * 80)
    print("MEW-1A V4.3 TRAINING - PRODUCTION QUALITY DATASET")
    print("=" * 80)
    print(f"\nBase Model: {MODEL_NAME}")
    print(f"Dataset: {DATASET_NAME}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"HuggingFace Model ID: {HF_MODEL_ID}")
    print(f"\nv4.3 Quality Improvements:")
    print(f"  • Removed BID hallucinations (15K genuine BUY/PASS)")
    print(f"  • Fixed card name parsing (92.15% valid)")
    print(f"  • Better price sanity (62.54%)")
    print(f"  • Overall Quality Score: 82.24/100")
    print(f"\nTraining Config:")
    print(f"  • Epochs: {NUM_EPOCHS}")
    print(f"  • Batch Size: {BATCH_SIZE} (effective: {BATCH_SIZE * GRADIENT_ACCUMULATION})")
    print(f"  • Learning Rate: {LEARNING_RATE}")
    print(f"  • Max Length: {MAX_LENGTH} tokens")
    print(f"\nLoRA Config:")
    print(f"  • r: {LORA_R}")
    print(f"  • alpha: {LORA_ALPHA}")
    print(f"  • dropout: {LORA_DROPOUT}")
    print("=" * 80)

    # Login to HuggingFace
    if HF_TOKEN:
        login(token=HF_TOKEN)
        print("\n✅ Authenticated with HuggingFace")
    else:
        print("\n❌ HUGGINGFACE_TOKEN not set - cannot proceed")
        print("   Please set HUGGINGFACE_TOKEN environment variable")
        sys.exit(1)

    # Load dataset
    print("\n📂 Loading dataset from HuggingFace Hub...")
    print(f"   Dataset: {DATASET_NAME}")
    dataset = load_dataset(DATASET_NAME)

    print(f"\n✅ Loaded {len(dataset['train']):,} training examples")
    print(f"\nDataset structure: {dataset}")

    # Category distribution
    print("\n📊 Analyzing dataset...")
    categories = {}
    for example in dataset['train']:
        cat = example.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1

    print("\n📊 Category Distribution:")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        pct = (count / len(dataset['train'])) * 100
        print(f"  • {cat:40s}: {count:6,} ({pct:5.2f}%)")

    # Load tokenizer
    print("\n🔤 Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    print("✅ Tokenizer loaded")

    # Format dataset
    print("\n🔄 Formatting dataset for instruction tuning...")
    formatted_dataset = dataset['train'].map(
        format_instruction,
        remove_columns=dataset['train'].column_names
    )
    print("✅ Dataset formatted")

    # Tokenize
    print("\n🔄 Tokenizing dataset...")
    def tokenize_function(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=MAX_LENGTH,
            padding="max_length"
        )

    tokenized_dataset = formatted_dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"]
    )
    print(f"✅ Dataset tokenized ({len(tokenized_dataset):,} examples)")

    # Load model (no quantization for RTX 4090 with 24GB VRAM)
    print(f"\n🤖 Loading base model: {MODEL_NAME}")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True
    )
    print("✅ Model loaded")

    # Configure LoRA
    print("\n⚙️  Configuring LoRA...")
    lora_config = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=LORA_DROPOUT,
        bias="none",
        task_type="CAUSAL_LM"
    )

    # Apply LoRA without kbit training (model already in bfloat16)
    model = get_peft_model(model, lora_config)

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"✅ LoRA configured")
    print(f"   Trainable params: {trainable_params:,} ({100 * trainable_params / total_params:.2f}%)")
    print(f"   Total params: {total_params:,}")

    # Training arguments
    print("\n⚙️  Configuring training...")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        learning_rate=LEARNING_RATE,
        fp16=False,
        bf16=True,
        logging_steps=LOGGING_STEPS,
        save_steps=SAVE_STEPS,
        save_total_limit=3,
        warmup_steps=WARMUP_STEPS,
        lr_scheduler_type="cosine",
        optim="adamw_torch",
        report_to="none",
        push_to_hub=True,
        hub_model_id=HF_MODEL_ID,
        hub_strategy="checkpoint",
        load_best_model_at_end=False,
    )

    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )

    # Initialize trainer
    print("\n🚀 Initializing trainer...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        data_collator=data_collator,
    )

    print("✅ Trainer initialized")
    print("\n" + "=" * 80)
    print("🚀 STARTING TRAINING")
    print("=" * 80)
    print(f"\nEstimated time: 16-20 hours on RTX 4090")
    print(f"Training {len(tokenized_dataset):,} examples for {NUM_EPOCHS} epochs")
    print(f"Expected final loss: < 0.140 (improvement over v4.2)\n")

    # Train!
    trainer.train()

    print("\n" + "=" * 80)
    print("✅ TRAINING COMPLETE!")
    print("=" * 80)

    # Save final model
    print("\n💾 Saving final model...")
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"✅ Model saved to {OUTPUT_DIR}")

    # Push to Hub
    print("\n⬆️  Pushing to HuggingFace Hub...")
    trainer.push_to_hub(commit_message="Mew-1A v4.3 training complete - production quality dataset")
    print(f"✅ Model uploaded to {HF_MODEL_ID}")

    print("\n" + "=" * 80)
    print("🎉 MEW-1A V4.3 TRAINING COMPLETE!")
    print("=" * 80)
    print("\n📊 Training Summary:")
    print(f"  • Total Examples: {len(tokenized_dataset):,}")
    print(f"  • Epochs: {NUM_EPOCHS}")
    print(f"  • Dataset Quality: 82.24/100")
    print(f"  • BUY/PASS Examples: 15,000 (no hallucinations)")
    print("\n🎯 Next Steps:")
    print("  1. Review training loss curve")
    print("  2. Merge LoRA weights with base model")
    print("  3. Deploy to Modal Labs with Vector RAG")
    print("  4. A/B test vs Mew-1A v4.2")
    print("  5. Evaluate with NanoChat framework")
    print(f"\n📦 Model URL: https://huggingface.co/{HF_MODEL_ID}")
    print("=" * 80)

if __name__ == "__main__":
    main()
