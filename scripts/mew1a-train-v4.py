#!/usr/bin/env python3

"""
Mew-1A v4 Training Script

Fine-tune Llama-3.2-3B-Instruct on 89,256 comprehensive Pokemon TCG examples.

Target Performance:
- Final Loss: < 0.130 (vs v3: ~0.140, v2: ~0.150, v1: 0.170)
- Training Time: 12-16 hours on RTX 4090
- Cost: ~$30-40 on RunPod

Comprehensive TCG Assistant covering:
- Market Analysis (40k examples)
- Card Knowledge (29k examples)
- Deck Building & Strategy (20k examples)
- Collection Management (400 examples)
- Cross-Marketplace (250 examples)

Model will be uploaded to: ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive
"""

import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from huggingface_hub import login

# Configuration
MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"
DATASET_NAME = "ChicoPanama/mew1a-v4-pokemon-tcg-comprehensive"
OUTPUT_DIR = "./mew1a-v4-output"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

# Training hyperparameters (optimized for 40k examples)
LEARNING_RATE = 2e-4
NUM_EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4  # Effective batch size = 16
MAX_LENGTH = 512
WARMUP_STEPS = 100
SAVE_STEPS = 500
LOGGING_STEPS = 50

# LoRA configuration
LORA_R = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.05

def format_instruction(example):
    """Format example for instruction tuning"""
    if example['input']:
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

def main():
    """Main training loop"""
    print("=" * 80)
    print("MEW-1A V2 TRAINING")
    print("=" * 80)
    print(f"\nBase Model: {MODEL_NAME}")
    print(f"Dataset: {DATASET_NAME}")
    print(f"Output: {OUTPUT_DIR}")
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
        print("✅ Authenticated with HuggingFace\n")
    else:
        print("⚠️  HUGGINGFACE_TOKEN not set - may have issues downloading models\n")

    # Load dataset
    print("📂 Loading dataset from HuggingFace Hub...")
    dataset = load_dataset(DATASET_NAME)

    print(f"✅ Loaded {len(dataset['train']):,} training examples")
    print(f"\nDataset structure: {dataset}")

    # Category distribution
    categories = {}
    for example in dataset['train']:
        cat = example['category']
        categories[cat] = categories.get(cat, 0) + 1

    print("\n📊 Category Distribution:")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        pct = (count / len(dataset['train'])) * 100
        print(f"  • {cat:30s}: {count:6,} ({pct:5.2f}%)")

    # Load tokenizer
    print("\n🔤 Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    print("✅ Tokenizer loaded")

    # Format dataset
    print("\n🔄 Formatting dataset for instruction tuning...")
    formatted_dataset = dataset['train'].map(format_instruction, remove_columns=dataset['train'].column_names)
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

    # Load model
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

    model = prepare_model_for_kbit_training(model)
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
        report_to="none",  # Can enable wandb if desired
        push_to_hub=True,
        hub_model_id="ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive",
        hub_strategy="checkpoint",
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
    print(f"\nThis will take approximately 8-12 hours on RTX 4090")
    print(f"Training {len(tokenized_dataset):,} examples for {NUM_EPOCHS} epochs\n")

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
    trainer.push_to_hub(commit_message="Mew-1A v2 training complete")
    print("✅ Model uploaded to HuggingFace Hub")

    print("\n" + "=" * 80)
    print("🎉 ALL DONE!")
    print("=" * 80)
    print("\n📊 Final Training Stats:")
    print(f"  • Total Examples: {len(tokenized_dataset):,}")
    print(f"  • Epochs: {NUM_EPOCHS}")
    print(f"  • Final Loss: Check output above")
    print("\n🎯 Next Steps:")
    print("  1. Review training metrics (loss curve)")
    print("  2. Test model on validation examples")
    print("  3. Deploy to Modal Labs for production inference")
    print("  4. A/B test vs Mew-1A v1")
    print("\n📦 Model URL: https://huggingface.co/ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive")
    print("=" * 80)

if __name__ == "__main__":
    main()
