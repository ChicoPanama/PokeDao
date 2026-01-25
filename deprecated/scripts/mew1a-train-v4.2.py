#!/usr/bin/env python3
"""
MEW-1A v4.2 ULTIMATE - TRAINING SCRIPT
Enterprise-grade Pokemon TCG AI with 509,746 examples

Training on RunPod RTX 4090 (24GB VRAM)
Estimated time: 18-24 hours for 3 epochs
"""

import os
import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import wandb

# Configuration
MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"
DATASET_NAME = "ChicoPanama/mew1a-v4.2-pokemon-tcg-ultimate-complete"
OUTPUT_DIR = "./mew1a-v4.2-pokemon-tcg-ultimate"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

print("=" * 80)
print("MEW-1A v4.2 ULTIMATE TRAINING")
print("=" * 80)
print(f"\nBase Model: {MODEL_NAME}")
print(f"Dataset: {DATASET_NAME}")
print(f"Total Examples: 509,746")
print(f"Temporal Data: 84.8% (432,107 examples)")
print("\n" + "=" * 80 + "\n")

# Initialize wandb for tracking
wandb.init(
    project="mew1a-v4.2-ultimate",
    name="mew1a-v4.2-3b-pokemon-tcg-ultimate",
    config={
        "model": MODEL_NAME,
        "dataset": DATASET_NAME,
        "total_examples": 509746,
        "temporal_data_pct": 84.8,
        "lora_r": 16,
        "lora_alpha": 32,
        "epochs": 3,
    }
)

# Load dataset
print("📦 Loading dataset from HuggingFace...")
dataset = load_dataset(DATASET_NAME, token=HF_TOKEN)
print(f"✅ Loaded {len(dataset['train'])} examples")
print(f"\nDataset structure:")
print(dataset)
print()

# Load tokenizer
print("🔤 Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME,
    token=HF_TOKEN,
    trust_remote_code=True,
)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"
print("✅ Tokenizer loaded\n")

# Load model in 16-bit (bfloat16 for RTX 4090)
print("🤖 Loading base model (Llama-3.2-3B-Instruct)...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    token=HF_TOKEN,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)
print("✅ Model loaded\n")

# Configure LoRA
print("⚙️  Configuring LoRA adapters...")
lora_config = LoraConfig(
    r=16,                           # Rank
    lora_alpha=32,                  # Alpha scaling
    target_modules=[
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
    ],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
print()

# Tokenization function
def format_instruction(example):
    """Format example as Llama-3 instruction"""
    text = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are Mew-1A, an expert Pokemon TCG investment analyst with deep knowledge of card values, market trends, and collecting strategies.<|eot_id|><|start_header_id|>user<|end_header_id|>

{example['instruction']}

{example['input']}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{example['output']}<|eot_id|>"""
    return text

def tokenize_function(examples):
    """Tokenize examples"""
    texts = [format_instruction(ex) for ex in [
        {
            'instruction': examples['instruction'][i],
            'input': examples['input'][i],
            'output': examples['output'][i]
        }
        for i in range(len(examples['instruction']))
    ]]

    return tokenizer(
        texts,
        truncation=True,
        max_length=1024,
        padding=False,
    )

print("🔄 Tokenizing dataset...")
tokenized_dataset = dataset.map(
    tokenize_function,
    batched=True,
    remove_columns=dataset["train"].column_names,
    desc="Tokenizing",
)
print("✅ Tokenization complete\n")

# Split dataset (use train split, will auto-create eval)
train_dataset = tokenized_dataset["train"]

# Training arguments optimized for RTX 4090
print("⚙️  Configuring training arguments...")
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,       # Batch size per GPU
    gradient_accumulation_steps=8,        # Effective batch = 4 * 8 = 32
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    logging_steps=50,
    save_strategy="steps",
    save_steps=1000,
    save_total_limit=3,
    evaluation_strategy="steps",
    eval_steps=1000,
    bf16=True,                            # Use bfloat16 on RTX 4090
    gradient_checkpointing=True,
    optim="adamw_torch",
    report_to="wandb",
    load_best_model_at_end=True,
    metric_for_best_model="loss",
    greater_is_better=False,
)
print("✅ Training arguments configured\n")

# Data collator
data_collator = DataCollatorForLanguageModeling(
    tokenizer=tokenizer,
    mlm=False,
)

# Initialize trainer
print("🚀 Initializing trainer...")
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    data_collator=data_collator,
)
print("✅ Trainer initialized\n")

# Training info
print("=" * 80)
print("TRAINING CONFIGURATION")
print("=" * 80)
print(f"Total examples:              {len(train_dataset):,}")
print(f"Batch size (per device):     {training_args.per_device_train_batch_size}")
print(f"Gradient accumulation:       {training_args.gradient_accumulation_steps}")
print(f"Effective batch size:        {training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps}")
print(f"Epochs:                      {training_args.num_train_epochs}")
print(f"Learning rate:               {training_args.learning_rate}")
print(f"Total training steps:        {len(train_dataset) // (training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps) * training_args.num_train_epochs:,}")
print(f"Precision:                   bfloat16")
print(f"LoRA rank:                   16")
print("=" * 80 + "\n")

# Start training
print("🔥 STARTING TRAINING...\n")
print("Estimated time: 18-24 hours on RTX 4090")
print("Monitor progress at: https://wandb.ai\n")

trainer.train()

print("\n✅ TRAINING COMPLETE!\n")

# Save final model
print("💾 Saving final model...")
trainer.save_model(f"{OUTPUT_DIR}/final")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/final")
print(f"✅ Model saved to: {OUTPUT_DIR}/final\n")

# Upload to HuggingFace
print("☁️  Uploading to HuggingFace...")
model.push_to_hub(
    "ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate",
    token=HF_TOKEN,
)
tokenizer.push_to_hub(
    "ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate",
    token=HF_TOKEN,
)
print("✅ Model uploaded to HuggingFace\n")

wandb.finish()

print("=" * 80)
print("🎉 MEW-1A v4.2 ULTIMATE TRAINING COMPLETE!")
print("=" * 80)
print(f"\nModel: ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate")
print(f"Dataset: {DATASET_NAME}")
print(f"Examples trained: {len(train_dataset):,}")
print("\nNext: Deploy to Modal Labs for production inference\n")
