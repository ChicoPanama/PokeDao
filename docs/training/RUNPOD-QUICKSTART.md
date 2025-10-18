# RunPod Quick Start: Mew-1A v4 Training

**Copy-paste commands for fast setup**

---

## 🚀 Step 1: Start RunPod Instance

1. Go to https://runpod.io
2. Click "Deploy" → "GPU Pods"
3. Select: **RTX 4090** (24GB VRAM)
4. Template: **RunPod PyTorch 2.1**
5. Volume: **50GB Container Disk**
6. Click "Deploy On-Demand"
7. Wait for "Running" status (~30 seconds)
8. Copy SSH command (looks like: `ssh root@...`)

---

## 🔧 Step 2: Setup Environment (on RunPod)

```bash
# SSH into RunPod (paste the SSH command from dashboard)
ssh root@<runpod-ip> -p <port> -i ~/.ssh/id_ed25519

# Install dependencies (takes ~3 minutes)
pip install transformers>=4.36.0 datasets accelerate peft bitsandbytes scipy huggingface_hub

# Create workspace
mkdir -p /workspace/mew1a-v4
cd /workspace/mew1a-v4

# Set your HuggingFace token (REQUIRED!)
export HUGGINGFACE_TOKEN=hf_your_token_here

# Verify authentication
huggingface-cli whoami
# Should show: ChicoPanama

# Keep terminal open, proceed to Step 3 on your LOCAL machine
```

---

## 📤 Step 3: Upload Training Script (on LOCAL machine)

**Open a NEW terminal on your Mac** (keep RunPod terminal open):

```bash
# Get RunPod connection details from dashboard:
# - IP address
# - Port number

# Upload training script (replace <runpod-ip> and <port>)
scp -P <port> -i ~/.ssh/id_ed25519 \
  /Users/arcadio/dev/pokedao/scripts/mew1a-train-v4.py \
  root@<runpod-ip>:/workspace/mew1a-v4/

# Example:
# scp -P 12345 -i ~/.ssh/id_ed25519 \
#   /Users/arcadio/dev/pokedao/scripts/mew1a-train-v4.py \
#   root@123.456.78.90:/workspace/mew1a-v4/
```

**Wait for upload to complete** (~1 second for 10KB file)

---

## 🏋️ Step 4: Start Training (back on RunPod)

**Go back to your RunPod SSH terminal**:

```bash
cd /workspace/mew1a-v4

# Verify training script is present
ls -lh mew1a-train-v4.py
# Should show: -rw-r--r-- 1 root root 10K mew1a-train-v4.py

# IMPORTANT: Set HuggingFace token again if terminal restarted
export HUGGINGFACE_TOKEN=hf_your_token_here

# Start training in background (runs for 12-16 hours)
nohup python3 mew1a-train-v4.py > training.log 2>&1 &

# Get process ID
echo "Training PID: $!"

# You should see: Training PID: 12345 (some number)
# Write this down in case you need to check/kill the process
```

**Training has started!** ✅

---

## 📊 Step 5: Monitor Training

### Watch Live Progress
```bash
# Stream training logs (Ctrl+C to stop watching, training continues)
tail -f /workspace/mew1a-v4/training.log

# You should see output like:
# ================================================================================
# MEW-1A V2 TRAINING
# ================================================================================
# Base Model: meta-llama/Llama-3.2-3B-Instruct
# Dataset: ChicoPanama/mew1a-v4-pokemon-tcg-comprehensive
# ...
# {'loss': 0.1650, 'learning_rate': 0.00019, 'epoch': 0.5}
```

### Check GPU Utilization
```bash
# In a NEW terminal (SSH into RunPod again)
nvidia-smi -l 1

# Should show:
# GPU 0: RTX 4090
# Memory-Usage: 22GB / 24GB (90%+)
# GPU-Util: 95%+
```

### Check Training Status
```bash
# Is training still running?
ps aux | grep python
# Should show: python3 mew1a-train-v4.py

# How many lines in log? (grows over time)
wc -l /workspace/mew1a-v4/training.log

# Recent loss values
grep "{'loss':" /workspace/mew1a-v4/training.log | tail -n 10

# Expected pattern:
# {'loss': 0.1800, ...}  (start)
# {'loss': 0.1650, ...}  (decreasing)
# {'loss': 0.1500, ...}  (good progress)
```

### Estimated Timeline
```
0:00 - Setup complete, training starting
0:05 - First checkpoint (step 50), loss ~0.180
0:30 - Checkpoint 500, loss ~0.175
2:00 - Checkpoint 2000, loss ~0.165
5:00 - End of Epoch 1 (step 5467), loss ~0.155
10:00 - End of Epoch 2 (step 10934), loss ~0.140
15:00 - End of Epoch 3 (step 16401), loss ~0.130 ✅
15:10 - Uploading to HuggingFace
15:15 - TRAINING COMPLETE!
```

---

## ✅ Step 6: Verify Training Completed

### Check Final Status
```bash
cd /workspace/mew1a-v4

# Is training process finished?
ps aux | grep python
# Should show: NO python processes (training finished)

# Check final lines of log
tail -n 50 training.log

# Should see:
# ✅ TRAINING COMPLETE!
# ✅ Model saved to ./mew1a-v4-output
# ✅ Model uploaded to HuggingFace Hub
# ...
# 🎉 ALL DONE!
```

### Verify Output Directory
```bash
ls -lh /workspace/mew1a-v4/mew1a-v4-output/

# Should show:
# adapter_config.json
# adapter_model.safetensors  (~48MB)
# tokenizer_config.json
# tokenizer.json
# special_tokens_map.json
```

### Quick Smoke Test
```bash
cd /workspace/mew1a-v4

python3 << 'EOF'
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

print("Loading model...")
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)
model = PeftModel.from_pretrained(base_model, "./mew1a-v4-output")
tokenizer = AutoTokenizer.from_pretrained("./mew1a-v4-output")

prompt = """Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
Analyze: Charizard ex - Obsidian Flames. Listed at $45.00, fair value $52.00

### Response:
"""

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=200, temperature=0.7)
response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print("\n" + "="*80)
print("SMOKE TEST OUTPUT:")
print("="*80)
print(response.split("### Response:")[-1].strip())
print("="*80)
EOF
```

**Expected Output**: Should recommend BUY with discount calculation

---

## 📥 Step 7: Download Trained Model

**On your LOCAL machine** (new terminal):

```bash
# Download trained model
scp -r -P <port> -i ~/.ssh/id_ed25519 \
  root@<runpod-ip>:/workspace/mew1a-v4/mew1a-v4-output \
  /Users/arcadio/dev/pokedao/data/mew1a/v4-trained/

# Download training logs
scp -P <port> -i ~/.ssh/id_ed25519 \
  root@<runpod-ip>:/workspace/mew1a-v4/training.log \
  /Users/arcadio/dev/pokedao/data/mew1a/v4-training.log

# Example:
# scp -r -P 12345 -i ~/.ssh/id_ed25519 \
#   root@123.456.78.90:/workspace/mew1a-v4/mew1a-v4-output \
#   /Users/arcadio/dev/pokedao/data/mew1a/v4-trained/
```

**Verify local download**:
```bash
ls -lh /Users/arcadio/dev/pokedao/data/mew1a/v4-trained/
# Should show: adapter_model.safetensors (~48MB)

ls -lh /Users/arcadio/dev/pokedao/data/mew1a/v4-training.log
# Should show: training.log (several KB)
```

---

## 🛑 Step 8: STOP RunPod Instance

**IMPORTANT**: Shut down RunPod to stop billing!

### On RunPod Dashboard:
1. Go to https://runpod.io/console/pods
2. Find your instance
3. Click "Stop" or "Terminate"
4. Confirm

**Billing stops immediately** ✅

---

## 🚨 Troubleshooting

### Training Not Starting
```bash
# Check if script exists
ls -lh /workspace/mew1a-v4/mew1a-train-v4.py

# Check if HuggingFace token is set
echo $HUGGINGFACE_TOKEN
# Should show: hf_xxxxx...

# Try running directly (not in background)
cd /workspace/mew1a-v4
python3 mew1a-train-v4.py
```

### Out of Memory
```bash
# Stop current training
ps aux | grep python  # Find PID
kill <PID>

# Edit training script to reduce batch size
nano mew1a-train-v4.py
# Change: BATCH_SIZE = 2 (from 4)
# Change: GRADIENT_ACCUMULATION = 8 (from 4)

# Restart training
nohup python3 mew1a-train-v4.py > training.log 2>&1 &
```

### Training Crashed Mid-Way
```bash
# Check if checkpoint exists
ls -lh /workspace/mew1a-v4/mew1a-v4-output/checkpoint-*/

# Find latest checkpoint
ls -lh /workspace/mew1a-v4/mew1a-v4-output/ | grep checkpoint

# Resume from checkpoint (add to training script or restart)
# Training script auto-resumes from last checkpoint
python3 mew1a-train-v4.py --resume_from_checkpoint ./mew1a-v4-output/checkpoint-<STEP>
```

### Can't Connect via SSH
```bash
# On RunPod dashboard, get fresh SSH command
# Click "Connect" → "SSH over exposed TCP"
# Copy the full command and try again

# If using custom SSH key, make sure it's added to RunPod:
# Settings → SSH Keys → Add Public Key
```

---

## 📞 Quick Reference

### Important Paths
```
Training Script: /workspace/mew1a-v4/mew1a-train-v4.py
Training Log: /workspace/mew1a-v4/training.log
Output Model: /workspace/mew1a-v4/mew1a-v4-output/
Checkpoints: /workspace/mew1a-v4/mew1a-v4-output/checkpoint-<STEP>/
```

### Key Commands
```bash
# Monitor training
tail -f /workspace/mew1a-v4/training.log

# Check GPU
nvidia-smi

# Check process
ps aux | grep python

# Check disk space
df -h /workspace

# Kill training
pkill -f mew1a-train-v4.py
```

### Expected Metrics
```
Training Time: 12-16 hours
Final Loss: < 0.130
GPU Usage: 90%+ (22GB / 24GB)
Total Steps: 16,401
Checkpoints: ~33 (every 500 steps)
Cost: $30-40 ($0.34/hour)
```

---

## ✅ Success Checklist

- [ ] RunPod instance started (RTX 4090)
- [ ] Dependencies installed
- [ ] HuggingFace token set
- [ ] Training script uploaded
- [ ] Training started (verify with `ps aux | grep python`)
- [ ] GPU at 90%+ utilization (`nvidia-smi`)
- [ ] Loss decreasing in logs (`tail -f training.log`)
- [ ] Training completed (check log for "ALL DONE!")
- [ ] Model exists (`ls /workspace/mew1a-v4/mew1a-v4-output/`)
- [ ] Smoke test passes
- [ ] Model downloaded to local machine
- [ ] Training log downloaded
- [ ] **RunPod instance STOPPED** (stop billing!)

---

## 🎉 You're Done!

After training completes and you download the model:

1. **Review logs**: Check `v4-training.log` for loss curve
2. **Run evaluation**: Use [MEW1A-V4-EVALUATION-PROTOCOL.md](MEW1A-V4-EVALUATION-PROTOCOL.md)
3. **Deploy to Modal**: Follow deployment guide
4. **A/B test**: Compare v4 vs v1 performance

**Model also auto-uploaded to**:
https://huggingface.co/ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive

---

**Need help?** See [MEW1A-V4-FINAL-CONFIG.md](MEW1A-V4-FINAL-CONFIG.md) for detailed troubleshooting.
