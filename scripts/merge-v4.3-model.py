#!/usr/bin/env python3
"""
Merge LoRA adapters with base Llama-3.2-3B model
and prepare for HuggingFace upload.
"""

import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

print("="*70)
print("🔧 MEW-1A v4.3 MODEL MERGE")
print("="*70)
print()

# Paths
LORA_PATH = "/Users/arcadio/dev/pokedao/models/mew1a-v4.3-lora"
OUTPUT_PATH = "/Users/arcadio/dev/pokedao/models/mew1a-v4.3-merged"
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"

print(f"📥 Loading base model: {BASE_MODEL}")
print("   (This will download ~6.4GB if not cached)")

# Load base model (using CPU to avoid memory issues)
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    low_cpu_mem_usage=True,
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
print("   (This creates a single merged model)")

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

print("💾 Copying tokenizer files...")

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
print("Next steps:")
print("  1. Upload to HuggingFace: huggingface-cli upload ChicoPanama/mew1a-v4.3")
print("  2. Deploy to Modal Labs")
print("  3. Run evaluation framework")
print("="*70)
