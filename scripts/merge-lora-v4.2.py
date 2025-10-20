#!/usr/bin/env python3
"""
MEW-1A v4.2 LoRA MERGE SCRIPT
Merges LoRA adapters into base Llama-3.2-3B-Instruct model for vLLM deployment

Run this AFTER training completes to create a merged model for vLLM.
This eliminates the need for base model access during inference.
"""

import os
import sys
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

# Configuration
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"
LORA_MODEL = "ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate"
OUTPUT_DIR = "./mew1a-v4.2-merged"
OUTPUT_HF_REPO = "ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

if not HF_TOKEN:
    print("❌ ERROR: HUGGINGFACE_TOKEN environment variable not set!")
    print("   Set it with: export HUGGINGFACE_TOKEN=your_token_here")
    sys.exit(1)

print("=" * 80)
print("MEW-1A v4.2 LoRA MERGE")
print("=" * 80)
print(f"\nBase Model: {BASE_MODEL}")
print(f"LoRA Adapters: {LORA_MODEL}")
print(f"Output Directory: {OUTPUT_DIR}")
print(f"HuggingFace Repo: {OUTPUT_HF_REPO}")
print("\n" + "=" * 80 + "\n")

# Step 1: Load base model
print("📦 Step 1/5: Loading base model...")
print(f"   Loading {BASE_MODEL}...")
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    token=HF_TOKEN,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)
print("✅ Base model loaded\n")

# Step 2: Load tokenizer
print("🔤 Step 2/5: Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(
    BASE_MODEL,
    token=HF_TOKEN,
    trust_remote_code=True,
)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"
print("✅ Tokenizer loaded\n")

# Step 3: Load and merge LoRA adapters
print("🔗 Step 3/5: Loading LoRA adapters...")
print(f"   Loading from {LORA_MODEL}...")
model = PeftModel.from_pretrained(
    base_model,
    LORA_MODEL,
    token=HF_TOKEN,
)
print("✅ LoRA adapters loaded")

print("\n⚙️  Merging LoRA weights into base model...")
merged_model = model.merge_and_unload()
print("✅ Model merged successfully\n")

# Step 4: Save merged model locally
print(f"💾 Step 4/5: Saving merged model to {OUTPUT_DIR}...")
os.makedirs(OUTPUT_DIR, exist_ok=True)
merged_model.save_pretrained(OUTPUT_DIR, safe_serialization=True)
tokenizer.save_pretrained(OUTPUT_DIR)
print("✅ Model saved locally\n")

# Step 5: Upload to HuggingFace
print(f"☁️  Step 5/5: Uploading to HuggingFace ({OUTPUT_HF_REPO})...")
print("   This may take 10-15 minutes depending on connection speed...")

try:
    merged_model.push_to_hub(
        OUTPUT_HF_REPO,
        token=HF_TOKEN,
        commit_message="Mew-1A v4.2 merged model - ready for vLLM deployment",
        private=False,
    )
    tokenizer.push_to_hub(
        OUTPUT_HF_REPO,
        token=HF_TOKEN,
        commit_message="Mew-1A v4.2 tokenizer",
        private=False,
    )
    print("✅ Model uploaded to HuggingFace\n")
except Exception as e:
    print(f"❌ Upload failed: {e}")
    print("   You can manually upload later from:", OUTPUT_DIR)
    print("\n")

# Step 6: Verification
print("=" * 80)
print("✅ MERGE COMPLETE!")
print("=" * 80)
print(f"\n📁 Local files: {OUTPUT_DIR}")
print(f"☁️  HuggingFace: https://huggingface.co/{OUTPUT_HF_REPO}")
print(f"\n📊 Model size: ~6.5 GB (full merged weights)")
print(f"🎯 Ready for vLLM deployment!")
print("\n" + "=" * 80)

print("\n🚀 NEXT STEPS:")
print("1. Update vLLM deployment script with merged model name:")
print(f'   MODEL_NAME = "{OUTPUT_HF_REPO}"')
print("\n2. Deploy to Modal:")
print("   modal deploy apps/mew1a/vllm_deploy_v4.2.py")
print("\n3. Test deployment:")
print("   modal run apps/mew1a/vllm_deploy_v4.2.py::test")
print("\n" + "=" * 80 + "\n")
