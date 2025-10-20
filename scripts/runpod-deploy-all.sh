#!/bin/bash
set -e  # Exit on error

# =============================================================================
# RunPod Master Deployment Script - Mew-1A v4.3 Data Processing
# =============================================================================
# This script runs all data processing steps on RunPod GPU
# Expected time: 4 hours on RTX 4090
# Expected cost: $3-5 total
# =============================================================================

echo "================================================================================"
echo "RUNPOD: MEW-1A V4.3 DATA PROCESSING PIPELINE"
echo "================================================================================"
echo ""
echo "This will process:"
echo "  1. Pseudo-label 129k salvaged examples (2-3 hours, ~$2-3)"
echo "  2. Generate 24k refusal examples (30 min, ~$0.50)"
echo "  3. Generate 15k BUY/PASS examples (20 min, ~$0.40)"
echo ""
echo "Total time: ~4 hours"
echo "Total cost: ~$3-5 (RTX 4090 @ $1/hr)"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check required files exist
echo ""
echo "📋 Checking required files..."

if [ ! -f "data/training/salvaged-cards.jsonl" ]; then
    echo "❌ Missing: data/training/salvaged-cards.jsonl"
    echo "   Run salvage-cards-rule-based.py first!"
    exit 1
fi

echo "✅ All required files present"

# Check GPU availability
echo ""
echo "🔍 Checking GPU availability..."
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
    echo "✅ GPU detected"
else
    echo "⚠️  No GPU detected (nvidia-smi not found)"
    echo "   This script requires CUDA GPU. Running on CPU will take 100+ hours."
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Python dependencies
echo ""
echo "📦 Checking Python dependencies..."
python3 -c "import torch; import transformers; from tqdm import tqdm" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Missing dependencies. Installing..."
    pip3 install --quiet torch transformers tqdm
    echo "✅ Dependencies installed"
fi

# Create output directories
mkdir -p data/training/runpod-outputs
mkdir -p data/training/runpod-logs

# =============================================================================
# STEP 1: Pseudo-Label Salvaged Data (2-3 hours)
# =============================================================================
echo ""
echo "================================================================================"
echo "STEP 1/3: PSEUDO-LABEL SALVAGED DATA"
echo "================================================================================"
echo "Input: 129,089 salvaged examples (48.3% hallucinations)"
echo "Model: Llama 3.2 3B Instruct"
echo "Expected: ~120k cleaned examples (<10% hallucinations)"
echo "Time: 2-3 hours"
echo "Cost: ~$2-3"
echo ""

START_TIME=$(date +%s)

python3 scripts/runpod-pseudo-label-salvaged.py \
    --input data/training/salvaged-cards.jsonl \
    --output data/training/runpod-outputs/cleaned-salvaged.jsonl \
    --discarded data/training/runpod-outputs/pseudo-label-discarded.jsonl \
    --min-confidence 0.75 \
    --batch-size 8 \
    2>&1 | tee data/training/runpod-logs/step1-pseudo-label.log

STEP1_END=$(date +%s)
STEP1_DURATION=$((STEP1_END - START_TIME))
echo ""
echo "✅ Step 1 complete in $((STEP1_DURATION / 60)) minutes"
echo ""

# =============================================================================
# STEP 2: Generate Refusal Examples (30 min)
# =============================================================================
echo ""
echo "================================================================================"
echo "STEP 2/3: GENERATE REFUSAL EXAMPLES"
echo "================================================================================"
echo "Model: Llama 3.2 3B Instruct"
echo "Target: 24,000 'I don't know' examples"
echo "Categories: Obscure cards, real-time data, ambiguous queries"
echo "Time: 30 minutes"
echo "Cost: ~$0.50"
echo ""

python3 scripts/runpod-generate-refusal-examples.py \
    --output data/training/runpod-outputs/refusal-24k.jsonl \
    --count 24000 \
    2>&1 | tee data/training/runpod-logs/step2-refusal.log

STEP2_END=$(date +%s)
STEP2_DURATION=$((STEP2_END - STEP1_END))
echo ""
echo "✅ Step 2 complete in $((STEP2_DURATION / 60)) minutes"
echo ""

# =============================================================================
# STEP 3: Generate BUY/PASS Examples (20 min)
# =============================================================================
echo ""
echo "================================================================================"
echo "STEP 3/3: GENERATE BUY/PASS INVESTMENT EXAMPLES"
echo "================================================================================"
echo "Model: Llama 3.1 8B Instruct (better reasoning)"
echo "Target: 15,000 BUY/PASS examples"
echo "Scenarios: Strong buy, moderate buy, hold, pass, strong pass"
echo "Time: 20 minutes"
echo "Cost: ~$0.40"
echo ""

python3 scripts/runpod-generate-buy-pass-examples.py \
    --output data/training/runpod-outputs/buy-pass-15k.jsonl \
    --count 15000 \
    2>&1 | tee data/training/runpod-logs/step3-buy-pass.log

STEP3_END=$(date +%s)
STEP3_DURATION=$((STEP3_END - STEP2_END))
echo ""
echo "✅ Step 3 complete in $((STEP3_DURATION / 60)) minutes"
echo ""

# =============================================================================
# SUMMARY
# =============================================================================
TOTAL_DURATION=$((STEP3_END - START_TIME))

echo ""
echo "================================================================================"
echo "RUNPOD PROCESSING COMPLETE!"
echo "================================================================================"
echo ""
echo "📊 Results:"
echo "   Step 1 (Pseudo-label): $((STEP1_DURATION / 60)) minutes"
echo "   Step 2 (Refusal): $((STEP2_DURATION / 60)) minutes"
echo "   Step 3 (BUY/PASS): $((STEP3_DURATION / 60)) minutes"
echo ""
echo "   Total time: $((TOTAL_DURATION / 60)) minutes ($((TOTAL_DURATION / 3600)) hours)"
echo "   Estimated cost: \$$(echo "scale=2; $TOTAL_DURATION / 3600 * 1.00" | bc) (RTX 4090)"
echo ""
echo "📁 Output files:"
echo "   - data/training/runpod-outputs/cleaned-salvaged.jsonl"
echo "   - data/training/runpod-outputs/refusal-24k.jsonl"
echo "   - data/training/runpod-outputs/buy-pass-15k.jsonl"
echo ""
echo "📝 Logs saved to:"
echo "   - data/training/runpod-logs/"
echo ""
echo "================================================================================"
echo "NEXT STEP: Download outputs and merge into v4.3 dataset"
echo "================================================================================"
echo ""
echo "Run locally:"
echo "  1. Download runpod-outputs/ directory"
echo "  2. Run merge script: python3 scripts/merge-v4.3-final.py"
echo "  3. Upload to HuggingFace"
echo "  4. Train v4.3 model"
echo ""
echo "Expected v4.3 dataset size:"
echo "  - Valid clean: 146,771"
echo "  - Pseudo-labeled: ~120,000"
echo "  - Refusal: 24,000"
echo "  - BUY/PASS: 15,000"
echo "  - Price patterns: ~50,000 (0.15 weight)"
echo "  TOTAL: ~355,771 examples"
echo ""
echo "Expected improvements:"
echo "  - Hallucination rate: <5% (vs current 48-54%)"
echo "  - Training loss: <0.110 (vs v4.2: 0.130)"
echo "  - BUY/PASS accuracy: >85% (vs current 30%)"
echo "  - Refusal capability: >95% (vs current 0%)"
echo ""
