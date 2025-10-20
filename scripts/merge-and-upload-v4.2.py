"""
Merge Mew-1A v4.2 LoRA Adapters with Base Model and Upload to HuggingFace

Run this on RunPod after training completes:

export HUGGINGFACE_TOKEN=your_token_here
python3 /workspace/merge-and-upload-v4.2.py
"""

import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from huggingface_hub import HfApi

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"
LORA_DIR = "/workspace/mew1a-v4.2/final"  # Where your LoRA adapters are
OUTPUT_DIR = "/workspace/mew1a-v4.2-merged"  # Where to save merged model
REPO_NAME = "ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate-merged"

HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

if not HF_TOKEN:
    raise ValueError("❌ HUGGINGFACE_TOKEN environment variable not set!")

# =============================================================================
# STEP 1: LOAD BASE MODEL
# =============================================================================

print("=" * 80)
print("MEW-1A V4.2 MODEL MERGER")
print("=" * 80)
print()
print(f"📦 Loading base model: {BASE_MODEL}")

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    token=HF_TOKEN,
)

tokenizer = AutoTokenizer.from_pretrained(
    BASE_MODEL,
    token=HF_TOKEN,
)

print(f"✅ Base model loaded")
print(f"   Parameters: {base_model.num_parameters():,}")
print()

# =============================================================================
# STEP 2: LOAD LORA ADAPTERS
# =============================================================================

print(f"🔧 Loading LoRA adapters from: {LORA_DIR}")

model = PeftModel.from_pretrained(
    base_model,
    LORA_DIR,
    torch_dtype=torch.bfloat16,
)

print(f"✅ LoRA adapters loaded")
print()

# =============================================================================
# STEP 3: MERGE ADAPTERS INTO BASE MODEL
# =============================================================================

print("🔀 Merging LoRA adapters into base model...")
print("   This may take a few minutes...")

merged_model = model.merge_and_unload()

print(f"✅ Merge complete!")
print()

# =============================================================================
# STEP 4: SAVE MERGED MODEL
# =============================================================================

print(f"💾 Saving merged model to: {OUTPUT_DIR}")

merged_model.save_pretrained(
    OUTPUT_DIR,
    safe_serialization=True,
)

tokenizer.save_pretrained(OUTPUT_DIR)

print(f"✅ Model saved")
print()

# Check file sizes
import subprocess
result = subprocess.run(
    f"du -sh {OUTPUT_DIR}",
    shell=True,
    capture_output=True,
    text=True,
)
print(f"   Merged model size: {result.stdout.strip().split()[0]}")
print()

# =============================================================================
# STEP 5: UPLOAD TO HUGGINGFACE
# =============================================================================

print(f"📤 Uploading to HuggingFace: {REPO_NAME}")
print()

api = HfApi()

# Create repo
api.create_repo(
    repo_id=REPO_NAME,
    token=HF_TOKEN,
    exist_ok=True,
    private=False,
)

print(f"✅ Repository created/verified")
print()

# Upload
print("📤 Uploading files (this may take 10-15 minutes)...")

api.upload_folder(
    folder_path=OUTPUT_DIR,
    repo_id=REPO_NAME,
    token=HF_TOKEN,
    commit_message="Mew-1A v4.2 MERGED - 509K examples, 3 epochs, trained on RunPod RTX 4090",
)

print()
print("=" * 80)
print("✅ UPLOAD COMPLETE!")
print("=" * 80)
print()
print(f"🔗 Model URL: https://huggingface.co/{REPO_NAME}")
print()
print("Next steps:")
print("1. Update apps/mew1a/vllm_deploy_v4.2_streaming.py with new model name")
print("2. Deploy to Modal: modal deploy apps/mew1a/vllm_deploy_v4.2_streaming.py")
print("3. Test streaming UI: open apps/mew1a-chat/chat.html")
print()
