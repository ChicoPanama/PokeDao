#!/bin/bash
###############################################################################
# RunPod Quickstart - Upload files and start training
###############################################################################

set -e

RUNPOD_HOST="194.68.245.86"
RUNPOD_PORT="22025"
RUNPOD_USER="root"
SSH_KEY="~/.ssh/id_ed25519"

echo "=========================================="
echo "RunPod Mew-1A v4.3.1 Training - Quickstart"
echo "=========================================="
echo ""

# Step 1: Upload training files
echo "📤 Step 1: Uploading training files to RunPod..."
echo ""

scp -P $RUNPOD_PORT -i $SSH_KEY \
    data/tfv/v4.3.1_training_set.jsonl \
    $RUNPOD_USER@$RUNPOD_HOST:/workspace/

scp -P $RUNPOD_PORT -i $SSH_KEY \
    scripts/runpod-train-v4.3.1.sh \
    $RUNPOD_USER@$RUNPOD_HOST:/workspace/

echo "✅ Files uploaded!"
echo ""

# Step 2: Set Hugging Face token and start training
echo "🚀 Step 2: Starting training on RunPod..."
echo ""

ssh -p $RUNPOD_PORT -i $SSH_KEY $RUNPOD_USER@$RUNPOD_HOST << 'ENDSSH'
cd /workspace

# Set Hugging Face token (replace placeholder before running)
export HUGGINGFACE_TOKEN="<YOUR_HF_TOKEN>"

# Make script executable
chmod +x runpod-train-v4.3.1.sh

# Start training (this will run for ~15 minutes)
echo "🏋️  Training starting... (this will take ~15 minutes)"
echo ""
bash runpod-train-v4.3.1.sh
ENDSSH

echo ""
echo "=========================================="
echo "✅ TRAINING COMPLETE!"
echo "=========================================="
echo ""
echo "Model uploaded to: ChicoPanama/mew1a-v4.3.1"
echo ""
echo "Next steps:"
echo "1. Verify at: https://huggingface.co/ChicoPanama/mew1a-v4.3.1"
echo "2. TERMINATE RunPod pod to stop billing!"
echo "3. Let me know when done, and I'll deploy v4.3.1"
echo ""
