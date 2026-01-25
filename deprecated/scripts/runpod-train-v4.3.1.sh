#!/bin/bash
###############################################################################
# Mew-1A v4.3.1 LoRA Training Script for RunPod
#
# Run this on a RunPod A6000 pod (48GB VRAM recommended)
# Training time: ~10-15 minutes
# Cost: ~$0.10-0.15
###############################################################################

set -e

echo "=========================================="
echo "Mew-1A v4.3.1 LoRA Training on RunPod"
echo "=========================================="

# Check if running on RunPod
if [ ! -d "/workspace" ]; then
    echo "⚠️  Warning: Not running on RunPod (no /workspace directory)"
    echo "   Proceeding anyway..."
fi

# Install dependencies (Ubuntu 24.04 requires --break-system-packages)
echo "📦 Installing dependencies..."
pip install --break-system-packages -q transformers==4.46.3 \
    datasets==3.1.0 \
    peft==0.13.2 \
    trl==0.12.1 \
    accelerate==1.1.1 \
    bitsandbytes==0.44.1 \
    huggingface_hub==0.27.1

# Set Hugging Face token (you'll need to set this as env var or pass it)
if [ -z "$HUGGINGFACE_TOKEN" ]; then
    echo "❌ ERROR: HUGGINGFACE_TOKEN environment variable not set"
    echo "   Run: export HUGGINGFACE_TOKEN=hf_your_token_here"
    exit 1
fi

# Login to Hugging Face
echo "🔑 Logging in to Hugging Face..."
huggingface-cli login --token $HUGGINGFACE_TOKEN

# Create training script
cat > /tmp/train_v4.3.1.py << 'PYTHON_SCRIPT'
import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

print("=" * 80)
print("MEW-1A v4.3.1 LoRA TRAINING")
print("=" * 80)

# Configuration
BASE_MODEL = "ChicoPanama/mew1a-v4.3"
OUTPUT_DIR = "./mew1a-v4.3.1-lora"
DATASET_PATH = "./v4.3.1_training_set.jsonl"

# LoRA configuration (targeting TFV terminology fix)
lora_config = LoraConfig(
    r=8,  # Low rank for small patch
    lora_alpha=16,  # Scaling factor
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],  # Attention layers
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
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
print(f"   {len(dataset)} training examples loaded")

# Format function (Llama-3.2 instruction format)
def formatting_func(example):
    instruction = example["instruction"]
    input_text = example.get("input", "")
    output = example["output"]

    if input_text:
        text = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{instruction}\n{input_text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{output}<|eot_id|>"
    else:
        text = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{instruction}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{output}<|eot_id|>"

    return text

# Training arguments
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=2,
    gradient_checkpointing=True,
    learning_rate=5e-5,
    fp16=False,  # Use bf16 instead
    bf16=True,
    logging_steps=10,
    save_strategy="epoch",
    save_total_limit=2,
    warmup_steps=10,
    lr_scheduler_type="cosine",
    optim="paged_adamw_8bit",
    report_to="none"
)

# Initialize trainer
print("\n🚀 Initializing trainer...")
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    tokenizer=tokenizer,
    args=training_args,
    formatting_func=formatting_func,
    max_seq_length=2048,
    packing=False
)

# Train
print("\n🏋️  Starting training...")
print(f"   Epochs: 3")
print(f"   Batch size: 4 (effective: 8 with grad accumulation)")
print(f"   Learning rate: 5e-5")
print(f"   Expected time: 10-15 minutes on A6000")
print("=" * 80)

trainer.train()

# Save LoRA adapters
print("\n💾 Saving LoRA adapters...")
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print("\n✅ Training complete!")
print(f"   LoRA adapters saved to: {OUTPUT_DIR}")
print(f"   Trainable parameters: {model.print_trainable_parameters()}")
print("=" * 80)
PYTHON_SCRIPT

# Dataset should already be in /workspace/ from upload
echo "📋 Checking training dataset..."
if [ ! -f "./v4.3.1_training_set.jsonl" ]; then
    echo "❌ ERROR: v4.3.1_training_set.jsonl not found in /workspace/"
    exit 1
fi
echo "✅ Dataset found: $(wc -l < ./v4.3.1_training_set.jsonl) examples"

# Run training
echo "🚀 Starting training..."
python /tmp/train_v4.3.1.py

# Merge LoRA adapters with base model (for easier deployment)
echo "🔀 Merging LoRA adapters with base model..."
cat > /tmp/merge_adapters.py << 'MERGE_SCRIPT'
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

print("Loading base model...")
base_model = AutoModelForCausalLM.from_pretrained(
    "ChicoPanama/mew1a-v4.3",
    torch_dtype="auto",
    device_map="auto",
    trust_remote_code=True
)

print("Loading LoRA adapters...")
model = PeftModel.from_pretrained(base_model, "./mew1a-v4.3.1-lora")

print("Merging...")
merged_model = model.merge_and_unload()

print("Saving merged model...")
merged_model.save_pretrained("./mew1a-v4.3.1-merged")

print("Saving tokenizer...")
tokenizer = AutoTokenizer.from_pretrained("ChicoPanama/mew1a-v4.3", trust_remote_code=True)
tokenizer.save_pretrained("./mew1a-v4.3.1-merged")

print("✅ Merge complete! Model saved to: ./mew1a-v4.3.1-merged")
MERGE_SCRIPT

python /tmp/merge_adapters.py

# Upload to Hugging Face
echo "📤 Uploading to Hugging Face..."
huggingface-cli upload ChicoPanama/mew1a-v4.3.1 ./mew1a-v4.3.1-merged --repo-type model

echo "=========================================="
echo "✅ TRAINING COMPLETE!"
echo "=========================================="
echo ""
echo "Model uploaded to: ChicoPanama/mew1a-v4.3.1"
echo ""
echo "Next steps:"
echo "1. Test locally: python scripts/test-v4.3.1.py"
echo "2. Deploy to Modal: modal deploy apps/mew1a/vllm_deploy_vector_rag.py"
echo "3. Run smoke tests: bash scripts/tfv-smoke-tests.sh"
echo ""
echo "=========================================="
