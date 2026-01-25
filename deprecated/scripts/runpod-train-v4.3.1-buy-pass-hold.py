#!/usr/bin/env python3
"""
Mew-1A v4.3.1 LoRA Patch Training Script
===========================================

Train LoRA patch to fix BUY bias and reduce contradiction rate from 37.5% to <5%

Training Data: 200 examples (100 BUY, 50 PASS, 50 HOLD)
Target: Align model text output with Policy Engine decisions
Platform: RunPod A6000 (48GB VRAM)
Expected Time: 15-20 minutes
"""

import os
import json
import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

print("=" * 80)
print("MEW-1A v4.3.1 LoRA PATCH TRAINING - BUY/PASS/HOLD ALIGNMENT")
print("=" * 80)

# Configuration
BASE_MODEL = "ChicoPanama/mew1a-v4.3"
OUTPUT_DIR = "./mew1a-v4.3.1-lora"
DATASET_PATH = "./data/mew1a-v4.3.1-lora-patch.jsonl"
HF_REPO = "ChicoPanama/mew1a-v4.3.1"

# LoRA configuration (small patch for targeted fix)
lora_config = LoraConfig(
    r=16,  # Rank (slightly higher for decision alignment)
    lora_alpha=32,  # Scaling factor (2x rank)
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

# Quantization config (4-bit to fit in memory)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True
)

# Load base model
print(f"\n📦 Loading base model: {BASE_MODEL}")
model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

# Prepare for k-bit training
model = prepare_model_for_kbit_training(model)

# Apply LoRA
print("\n🔧 Applying LoRA configuration...")
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Load tokenizer
print(f"\n📝 Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

# Load dataset
print(f"\n📊 Loading training dataset: {DATASET_PATH}")
with open(DATASET_PATH, 'r') as f:
    data = [json.loads(line) for line in f]

print(f"   {len(data)} training examples loaded")

# Count decision types
buy_count = sum(1 for ex in data if "BUY\n\nReasoning:" in ex["messages"][1]["content"])
pass_count = sum(1 for ex in data if "PASS\n\nReasoning:" in ex["messages"][1]["content"])
hold_count = sum(1 for ex in data if "HOLD\n\nReasoning:" in ex["messages"][1]["content"])

print(f"   BUY examples: {buy_count}")
print(f"   PASS examples: {pass_count}")
print(f"   HOLD examples: {hold_count}")

# Convert to Dataset
dataset = Dataset.from_list(data)

# Format function (Llama-3.2 chat format)
def formatting_func(example):
    """Format messages into Llama-3.2 chat template"""
    messages = example["messages"]
    user_msg = messages[0]["content"]
    assistant_msg = messages[1]["content"]

    text = f"""<|begin_of_text|><|start_header_id|>user<|end_header_id|>

{user_msg}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{assistant_msg}<|eot_id|>"""

    return text

# Training arguments (optimized for small LoRA patch)
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,  # Effective batch size: 16
    gradient_checkpointing=True,
    learning_rate=2e-4,  # Higher LR for focused patch
    fp16=False,
    bf16=True,
    logging_steps=5,
    save_strategy="epoch",
    save_total_limit=2,
    warmup_ratio=0.1,
    lr_scheduler_type="cosine",
    optim="paged_adamw_8bit",
    report_to="none",
    max_grad_norm=0.3,  # Gradient clipping
    weight_decay=0.01
)

# Initialize trainer
print("\n🚀 Initializing trainer...")
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    tokenizer=tokenizer,
    args=training_args,
    formatting_func=formatting_func,
    max_seq_length=1024,  # Shorter for this focused task
    packing=False
)

# Train
print("\n🏋️  Starting training...")
print(f"   Epochs: {training_args.num_train_epochs}")
print(f"   Batch size: {training_args.per_device_train_batch_size} (effective: {training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps})")
print(f"   Learning rate: {training_args.learning_rate}")
print(f"   Expected time: 15-20 minutes on A6000")
print(f"   Goal: Reduce contradiction rate from 37.5% to <5%")
print("=" * 80)

trainer.train()

# Save LoRA adapters
print("\n💾 Saving LoRA adapters...")
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print("\n✅ Training complete!")
print(f"   LoRA adapters saved to: {OUTPUT_DIR}")
print("=" * 80)

# Merge LoRA adapters with base model
print("\n🔀 Merging LoRA adapters with base model...")
from peft import PeftModel

print("Loading base model for merging...")
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True
)

print("Loading LoRA adapters...")
model = PeftModel.from_pretrained(base_model, OUTPUT_DIR)

print("Merging...")
merged_model = model.merge_and_unload()

print("Saving merged model...")
MERGED_DIR = "./mew1a-v4.3.1-merged"
merged_model.save_pretrained(MERGED_DIR)
tokenizer.save_pretrained(MERGED_DIR)

print(f"✅ Merge complete! Model saved to: {MERGED_DIR}")

# Upload to Hugging Face
if os.environ.get("HUGGINGFACE_TOKEN"):
    print(f"\n📤 Uploading to Hugging Face: {HF_REPO}")
    from huggingface_hub import HfApi

    api = HfApi()
    api.upload_folder(
        folder_path=MERGED_DIR,
        repo_id=HF_REPO,
        repo_type="model",
        token=os.environ["HUGGINGFACE_TOKEN"]
    )
    print(f"✅ Model uploaded to: https://huggingface.co/{HF_REPO}")
else:
    print("\n⚠️  HUGGINGFACE_TOKEN not set, skipping upload")
    print(f"   To upload: huggingface-cli upload {HF_REPO} {MERGED_DIR} --repo-type model")

print("\n" + "=" * 80)
print("✅ V4.3.1 LORA PATCH TRAINING COMPLETE!")
print("=" * 80)
print("\nNext steps:")
print("1. Test locally or deploy to Modal Labs")
print("2. Run Rules Baseline evaluator: python3 scripts/rules-baseline-evaluator.py")
print("3. Verify contradiction rate drops from 37.5% to <5%")
print("4. Monitor production metrics for 24h")
print("=" * 80)
