#!/bin/bash
# =============================================================================
# RunPod Quick Start - Mew-1A v4.3 Data Processing
# =============================================================================
# Copy-paste these commands directly into your RunPod terminal
# =============================================================================

# 1. CHECK GPU
echo "=== Checking GPU ==="
nvidia-smi
echo ""

# 2. INSTALL DEPENDENCIES
echo "=== Installing dependencies ==="
pip install --quiet --upgrade pip
pip install --quiet torch transformers tqdm bitsandbytes accelerate
echo "✅ Dependencies installed"
echo ""

# 3. VERIFY CUDA
echo "=== Verifying CUDA ==="
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python3 -c "import torch; print(f'GPU name: {torch.cuda.get_device_name(0)}')" 2>/dev/null
echo ""

# 4. CREATE DIRECTORIES
echo "=== Creating directories ==="
mkdir -p /workspace/pokedao/data/training/runpod-outputs
mkdir -p /workspace/pokedao/data/training/runpod-logs
mkdir -p /workspace/pokedao/scripts
echo "✅ Directories created"
echo ""

# 5. NEXT STEPS
echo "================================================================================"
echo "SETUP COMPLETE!"
echo "================================================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Upload your files to /workspace/pokedao/:"
echo "   - scripts/runpod-pseudo-label-salvaged.py"
echo "   - scripts/runpod-generate-refusal-examples.py"
echo "   - scripts/runpod-generate-buy-pass-examples.py"
echo "   - scripts/runpod-deploy-all.sh"
echo "   - data/training/salvaged-cards.jsonl"
echo ""
echo "2. Run the deployment script:"
echo "   cd /workspace/pokedao"
echo "   chmod +x scripts/runpod-deploy-all.sh"
echo "   bash scripts/runpod-deploy-all.sh"
echo ""
echo "3. Or run steps individually:"
echo "   python3 scripts/runpod-pseudo-label-salvaged.py \\"
echo "     --input data/training/salvaged-cards.jsonl \\"
echo "     --output data/training/runpod-outputs/cleaned-salvaged.jsonl \\"
echo "     --min-confidence 0.75"
echo ""
echo "================================================================================"
