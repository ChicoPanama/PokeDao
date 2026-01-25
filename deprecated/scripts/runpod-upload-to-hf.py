#!/usr/bin/env python3
"""
Upload merged model to HuggingFace FROM RUNPOD
This is faster than downloading locally then uploading.
"""

import os
from huggingface_hub import HfApi, create_repo

print("="*70)
print("📤 UPLOADING MEW-1A v4.3 TO HUGGINGFACE")
print("="*70)
print()

# Configuration
MODEL_PATH = "/workspace/pokedao/mew1a-v4.3-merged"
REPO_ID = "ChicoPanama/mew1a-v4.3"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

if not HF_TOKEN:
    print("❌ ERROR: HUGGINGFACE_TOKEN environment variable not set!")
    print("   Set it with: export HUGGINGFACE_TOKEN=your_token_here")
    exit(1)

print(f"📂 Model path: {MODEL_PATH}")
print(f"🎯 Target repo: {REPO_ID}")
print()

# Initialize API
api = HfApi(token=HF_TOKEN)

print("🔧 Creating repository (if it doesn't exist)...")
try:
    create_repo(REPO_ID, token=HF_TOKEN, exist_ok=True)
    print("✅ Repository ready")
except Exception as e:
    print(f"⚠️  Repository might already exist: {e}")

print()
print("📤 Uploading model files...")
print("   (This will take 5-10 minutes for 6.1GB)")
print()

try:
    api.upload_folder(
        folder_path=MODEL_PATH,
        repo_id=REPO_ID,
        repo_type="model",
        token=HF_TOKEN
    )

    print()
    print("="*70)
    print("🎉 UPLOAD COMPLETE!")
    print("="*70)
    print(f"✅ Model available at: https://huggingface.co/{REPO_ID}")
    print()
    print("Next steps:")
    print("  1. Deploy to Modal Labs")
    print("  2. Run evaluation framework")
    print("  3. Generate performance report")
    print("="*70)

except Exception as e:
    print(f"❌ Upload failed: {e}")
    exit(1)
