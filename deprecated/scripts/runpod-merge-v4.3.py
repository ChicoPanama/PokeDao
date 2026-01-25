#!/usr/bin/env python3
"""
Merge LoRA adapters with base Llama-3.2-3B model ON RUNPOD
Run this script on RunPod to merge the model there.
"""

import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

print("="*70)
print("🔧 MEW-1A v4.3 MODEL MERGE (RunPod)")
print("="*70)
print()

# Paths (RunPod paths)
LORA_PATH = "/workspace/pokedao/mew1a-v4.3-output/checkpoint-47592"
OUTPUT_PATH = "/workspace/pokedao/mew1a-v4.3-merged"
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"

print(f"📥 Loading base model: {BASE_MODEL}")

# Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True
)

print("✅ Base model loaded")
print()

print(f"📥 Loading LoRA adapters from: {LORA_PATH}")

# Load LoRA adapters
model = PeftModel.from_pretrained(base_model, LORA_PATH)

print("✅ LoRA adapters loaded")
print()

print("🔀 Merging LoRA adapters with base model...")

# Merge and unload
merged_model = model.merge_and_unload()

print("✅ Merge complete!")
print()

print(f"💾 Saving merged model to: {OUTPUT_PATH}")

# Create output directory
os.makedirs(OUTPUT_PATH, exist_ok=True)

# Save merged model
merged_model.save_pretrained(
    OUTPUT_PATH,
    safe_serialization=True,
    max_shard_size="2GB"
)

print("✅ Merged model saved")
print()

print("💾 Saving tokenizer...")

# Load and save tokenizer
tokenizer = AutoTokenizer.from_pretrained(LORA_PATH)
tokenizer.save_pretrained(OUTPUT_PATH)

print("✅ Tokenizer saved")
print()

# Check output size
import subprocess
result = subprocess.run(['du', '-sh', OUTPUT_PATH], capture_output=True, text=True)
size = result.stdout.split()[0]

print("="*70)
print("🎉 MERGE COMPLETE!")
print("="*70)
print(f"📂 Output: {OUTPUT_PATH}")
print(f"💾 Size: {size}")
print()
print("Next: Download merged model to local machine:")
print(f"  scp -r -P 22025 -i ~/.ssh/id_ed25519 root@194.68.245.86:{OUTPUT_PATH} models/")
print("="*70)
