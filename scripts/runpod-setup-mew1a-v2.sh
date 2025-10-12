#!/bin/bash

###############################################################################
# RunPod Setup Script for Mew-1A v2 Training
#
# This script sets up a RunPod RTX 4090 instance for training Mew-1A v2
#
# Usage:
#   1. Launch RunPod RTX 4090 pod (PyTorch 2.x template)
#   2. SSH into the pod
#   3. Run: bash <(curl -s https://raw.githubusercontent.com/ChicoPanama/PokeDao/main/scripts/runpod-setup-mew1a-v2.sh)
#   4. Or manually copy this script and run it
###############################################################################

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════════════════════"
echo "MEW-1A V2 RUNPOD SETUP"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Check for GPU
echo "🔍 Checking GPU availability..."
if ! nvidia-smi > /dev/null 2>&1; then
    echo "❌ Error: No NVIDIA GPU detected!"
    exit 1
fi

nvidia-smi
echo ""

# Install required packages
echo "📦 Installing required packages..."
pip install --upgrade pip
pip install transformers>=4.36.0
pip install datasets
pip install accelerate
pip install peft
pip install bitsandbytes
pip install scipy
pip install huggingface_hub

echo "✅ Packages installed"
echo ""

# Set up HuggingFace token
echo "🔑 HuggingFace Authentication"
echo "────────────────────────────────────────────────────────────────────────────────"
if [ -z "$HUGGINGFACE_TOKEN" ]; then
    echo "⚠️  HUGGINGFACE_TOKEN environment variable not set"
    echo ""
    echo "Please set your HuggingFace token:"
    echo "  export HUGGINGFACE_TOKEN=your_token_here"
    echo ""
    echo "Get your token at: https://huggingface.co/settings/tokens"
    echo ""
    read -p "Enter your HuggingFace token (or press Enter to skip): " token
    if [ -n "$token" ]; then
        export HUGGINGFACE_TOKEN="$token"
        echo "✅ Token set for this session"
    else
        echo "⚠️  Skipping token setup - you'll need to set it manually"
    fi
else
    echo "✅ HUGGINGFACE_TOKEN already set"
fi
echo ""

# Download training script
echo "📥 Downloading training script..."
mkdir -p /workspace/mew1a-v2
cd /workspace/mew1a-v2

if [ -f "mew1a-train-v2.py" ]; then
    echo "⚠️  Training script already exists, skipping download"
else
    curl -o mew1a-train-v2.py https://raw.githubusercontent.com/ChicoPanama/PokeDao/main/scripts/mew1a-train-v2.py
    echo "✅ Training script downloaded"
fi
echo ""

# Create training launcher script
echo "📝 Creating training launcher..."
cat > train.sh << 'EOF'
#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════════════════════════"
echo "LAUNCHING MEW-1A V2 TRAINING"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Training Configuration:"
echo "  • Base Model: Llama-3.2-3B-Instruct"
echo "  • Dataset: 40,328 examples from HuggingFace"
echo "  • GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader)"
echo "  • Estimated Time: 8-12 hours"
echo "  • Output: ./mew1a-v2-output"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Check token
if [ -z "$HUGGINGFACE_TOKEN" ]; then
    echo "❌ Error: HUGGINGFACE_TOKEN not set!"
    echo "Run: export HUGGINGFACE_TOKEN=your_token_here"
    exit 1
fi

# Run training
python3 mew1a-train-v2.py 2>&1 | tee training.log

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "✅ TRAINING COMPLETE!"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Model saved to: ./mew1a-v2-output"
echo "Training log: ./training.log"
echo ""
echo "Next steps:"
echo "  1. Review training metrics in training.log"
echo "  2. Test the model"
echo "  3. Deploy to Modal Labs"
echo ""
EOF

chmod +x train.sh
echo "✅ Launcher created: train.sh"
echo ""

# Create testing script
echo "📝 Creating test script..."
cat > test.py << 'EOF'
#!/usr/bin/env python3

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

print("Loading model...")
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)

model = PeftModel.from_pretrained(base_model, "./mew1a-v2-output")
tokenizer = AutoTokenizer.from_pretrained("./mew1a-v2-output")

print("✅ Model loaded\n")

# Test prompt
prompt = """Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
Analyze: Charizard ex - Obsidian Flames. Listed at $45.00, 15 active listings, fair value $52.00

### Response:
"""

print("Testing model with example prompt...")
print("-" * 80)
print(prompt)
print("-" * 80)

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=300, temperature=0.7)
response = tokenizer.decode(outputs[0], skip_special_tokens=True)

print(response)
print("-" * 80)
print("\n✅ Test complete!")
EOF

chmod +x test.py
echo "✅ Test script created: test.py"
echo ""

echo "════════════════════════════════════════════════════════════════════════════════"
echo "✅ SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📂 Working directory: /workspace/mew1a-v2"
echo ""
echo "🚀 To start training:"
echo "   1. Set HuggingFace token (if not already set):"
echo "      export HUGGINGFACE_TOKEN=your_token_here"
echo ""
echo "   2. Start training:"
echo "      ./train.sh"
echo ""
echo "   3. Monitor progress:"
echo "      tail -f training.log"
echo ""
echo "   4. After training completes, test the model:"
echo "      python3 test.py"
echo ""
echo "💰 Cost Estimate:"
echo "   • RTX 4090: ~$0.34/hour"
echo "   • Training time: 8-12 hours"
echo "   • Total cost: ~$20-30"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
