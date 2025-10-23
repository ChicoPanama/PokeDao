#!/bin/bash

################################################################################
# Deploy Mew-1A v4.3 Training to RunPod
################################################################################
#
# This script:
# 1. Uploads training script to RunPod
# 2. Starts training in background
# 3. Sets up monitoring
#
# Prerequisites:
# - RunPod instance running
# - SSH access configured
# - HuggingFace token set on RunPod
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# RunPod SSH details (updated for A6000 instance)
RUNPOD_HOST="194.68.245.86"
RUNPOD_PORT="22025"
RUNPOD_USER="root"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/workspace/pokedao"

echo "================================================================================"
echo -e "${BLUE}MEW-1A V4.3 RUNPOD DEPLOYMENT${NC}"
echo "================================================================================"
echo ""
echo "Target: $RUNPOD_USER@$RUNPOD_HOST:$RUNPOD_PORT"
echo "Remote Directory: $REMOTE_DIR"
echo ""

# Step 1: Test SSH connection
echo -e "${YELLOW}[1/6] Testing SSH connection...${NC}"
if ssh -p $RUNPOD_PORT -i "$SSH_KEY" $RUNPOD_USER@$RUNPOD_HOST "echo 'SSH connection successful'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH connection successful${NC}"
else
    echo -e "${RED}❌ SSH connection failed${NC}"
    echo "Please check:"
    echo "  - RunPod instance is running"
    echo "  - SSH port $RUNPOD_PORT is correct"
    echo "  - SSH key exists at $SSH_KEY"
    exit 1
fi
echo ""

# Step 2: Create remote directory
echo -e "${YELLOW}[2/6] Creating remote directory...${NC}"
ssh -p $RUNPOD_PORT -i "$SSH_KEY" $RUNPOD_USER@$RUNPOD_HOST "mkdir -p $REMOTE_DIR/scripts"
echo -e "${GREEN}✅ Remote directory ready${NC}"
echo ""

# Step 3: Upload training script
echo -e "${YELLOW}[3/6] Uploading training script...${NC}"
scp -P $RUNPOD_PORT -i "$SSH_KEY" \
    scripts/mew1a-train-v4.3.py \
    $RUNPOD_USER@$RUNPOD_HOST:$REMOTE_DIR/scripts/
echo -e "${GREEN}✅ Training script uploaded${NC}"
echo ""

# Step 4: Check HuggingFace token
echo -e "${YELLOW}[4/6] Checking HuggingFace token...${NC}"
HF_TOKEN_SET=$(ssh -p $RUNPOD_PORT -i "$SSH_KEY" $RUNPOD_USER@$RUNPOD_HOST \
    "if [ -n \"\$HUGGINGFACE_TOKEN\" ]; then echo 'yes'; else echo 'no'; fi")

if [ "$HF_TOKEN_SET" = "yes" ]; then
    echo -e "${GREEN}✅ HuggingFace token is set${NC}"
else
    echo -e "${RED}❌ HuggingFace token NOT set${NC}"
    echo ""
    echo "To set the token on RunPod, run:"
    echo "  ssh -p $RUNPOD_PORT -i \"$SSH_KEY\" $RUNPOD_USER@$RUNPOD_HOST"
    echo "  export HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN"
    echo "  echo 'export HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN' >> ~/.bashrc"
    echo ""
    read -p "Continue anyway? (y/N): " continue_anyway
    if [ "$continue_anyway" != "y" ]; then
        exit 1
    fi
fi
echo ""

# Step 5: Install dependencies
echo -e "${YELLOW}[5/6] Installing Python dependencies...${NC}"
ssh -p $RUNPOD_PORT -i "$SSH_KEY" $RUNPOD_USER@$RUNPOD_HOST << 'EOF'
cd /workspace/pokedao
echo "Installing required packages..."
pip3 install --quiet --upgrade \
    transformers \
    datasets \
    peft \
    accelerate \
    bitsandbytes \
    huggingface-hub \
    torch
echo "Dependencies installed"
EOF
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 6: Start training
echo -e "${YELLOW}[6/6] Starting v4.3 training...${NC}"
echo ""
echo "This will:"
echo "  • Train on 253,810 examples (v4.3 dataset)"
echo "  • Run for 3 epochs (~16-20 hours)"
echo "  • Upload checkpoints to HuggingFace during training"
echo "  • Save final model to ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg"
echo ""
read -p "Start training now? (y/N): " start_training

if [ "$start_training" = "y" ]; then
    echo ""
    echo "Starting training in background..."

    # Start training in background with nohup
    ssh -p $RUNPOD_PORT -i "$SSH_KEY" $RUNPOD_USER@$RUNPOD_HOST << 'EOF'
cd /workspace/pokedao
nohup python3 scripts/mew1a-train-v4.3.py > training-v4.3.log 2>&1 &
TRAIN_PID=$!
echo "Training started with PID: $TRAIN_PID"
echo $TRAIN_PID > training-v4.3.pid
EOF

    echo -e "${GREEN}✅ Training started in background${NC}"
    echo ""
    echo "================================================================================"
    echo -e "${GREEN}🚀 MEW-1A V4.3 TRAINING DEPLOYED${NC}"
    echo "================================================================================"
    echo ""
    echo "Monitor progress with:"
    echo "  ssh -p $RUNPOD_PORT -i \"$SSH_KEY\" $RUNPOD_USER@$RUNPOD_HOST \"tail -f $REMOTE_DIR/training-v4.3.log\""
    echo ""
    echo "Check if training is running:"
    echo "  ssh -p $RUNPOD_PORT -i \"$SSH_KEY\" $RUNPOD_USER@$RUNPOD_HOST \"ps aux | grep mew1a-train-v4.3\""
    echo ""
    echo "Stop training (if needed):"
    echo "  ssh -p $RUNPOD_PORT -i \"$SSH_KEY\" $RUNPOD_USER@$RUNPOD_HOST \"kill \\\$(cat $REMOTE_DIR/training-v4.3.pid)\""
    echo ""
    echo "Expected completion: 16-20 hours from now"
    echo "Model will be uploaded to: https://huggingface.co/ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg"
    echo ""
    echo "================================================================================"
else
    echo "Training not started. Run this script again when ready."
fi
