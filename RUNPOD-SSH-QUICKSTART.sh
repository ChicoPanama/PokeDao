#!/bin/bash
# MEW-1A v4.2 ULTIMATE - RunPod SSH Quick Start
# Run this script on your RunPod instance to start training

set -e

echo "======================================================================="
echo "MEW-1A v4.2 ULTIMATE - TRAINING SETUP"
echo "======================================================================="
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pip install -q transformers datasets peft accelerate wandb bitsandbytes

# Set HuggingFace token
echo ""
echo "🔑 Setting HuggingFace token..."
export HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN

# Create training script
echo ""
echo "📝 Creating training script..."
cat > mew1a-train-v4.2.py << 'EOFPYTHON'
#!/usr/bin/env python3
"""
MEW-1A v4.2 ULTIMATE - TRAINING SCRIPT
Enterprise-grade Pokemon TCG AI with 509,746 examples
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
from peft import LoraConfig, get_peft_model
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
print(f"Temporal Data: 84.8%\n")

# Initialize wandb
wandb.init(
    project="mew1a-v4.2-ultimate",
    name="mew1a-v4.2-3b-pokemon-tcg",
    config={"model": MODEL_NAME, "dataset": DATASET_NAME, "examples": 509746}
)

# Load dataset
print("📦 Loading dataset from HuggingFace...")
dataset = load_dataset(DATASET_NAME, token=HF_TOKEN)
print(f"✅ Loaded {len(dataset['train'])} examples\n")

# Load tokenizer
print("🔤 Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, token=HF_TOKEN)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"
print("✅ Tokenizer loaded\n")

# Load model
print("🤖 Loading base model...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    token=HF_TOKEN,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
print("✅ Model loaded\n")

# Configure LoRA
print("⚙️  Configuring LoRA...")
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Tokenization
def format_instruction(example):
    text = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are Mew-1A, an expert Pokemon TCG investment analyst.<|eot_id|><|start_header_id|>user<|end_header_id|>

{example['instruction']}

{example['input']}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{example['output']}<|eot_id|>"""
    return text

def tokenize_function(examples):
    texts = [format_instruction({
        'instruction': examples['instruction'][i],
        'input': examples['input'][i],
        'output': examples['output'][i]
    }) for i in range(len(examples['instruction']))]

    return tokenizer(texts, truncation=True, max_length=1024, padding=False)

print("\n🔄 Tokenizing dataset...")
tokenized_dataset = dataset.map(
    tokenize_function,
    batched=True,
    remove_columns=dataset["train"].column_names,
    desc="Tokenizing",
)
print("✅ Tokenization complete\n")

# Training arguments
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    logging_steps=50,
    save_strategy="steps",
    save_steps=1000,
    save_total_limit=3,
    bf16=True,
    gradient_checkpointing=True,
    optim="adamw_torch",
    report_to="wandb",
)

# Data collator
data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset["train"],
    data_collator=data_collator,
)

print("=" * 80)
print("STARTING TRAINING")
print("=" * 80)
print(f"Total steps: {len(tokenized_dataset['train']) // 32 * 3:,}")
print("Estimated time: 18-24 hours\n")

# Train
trainer.train()

print("\n✅ TRAINING COMPLETE!\n")

# Save
print("💾 Saving model...")
trainer.save_model(f"{OUTPUT_DIR}/final")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/final")

# Upload
print("☁️  Uploading to HuggingFace...")
model.push_to_hub("ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate", token=HF_TOKEN)
tokenizer.push_to_hub("ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate", token=HF_TOKEN)

wandb.finish()

print("\n🎉 COMPLETE! Model uploaded to HuggingFace\n")
EOFPYTHON

chmod +x mew1a-train-v4.2.py

echo ""
echo "======================================================================="
echo "✅ SETUP COMPLETE!"
echo "======================================================================="
echo ""
echo "🚀 To start training, run:"
echo ""
echo "    python3 mew1a-train-v4.2.py 2>&1 | tee training.log"
echo ""
echo "📊 Monitor progress:"
echo "    - tail -f training.log"
echo "    - nvidia-smi -l 1"
echo "    - https://wandb.ai"
echo ""
echo "⏱️  Estimated time: 18-24 hours"
echo "💰 Cost: ~\$10.56 on RTX 4090"
echo ""
echo "======================================================================="
