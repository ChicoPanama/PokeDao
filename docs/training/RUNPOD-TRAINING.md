# RunPod v4.3.1 Training - Quickstart Guide

**Objective:** Train Mew-1A v4.3.1 LoRA patch to fix TFV terminology hallucinations
**Time:** ~10-15 minutes training + 5-10 minutes setup
**Cost:** ~$0.10-0.15 on RunPod A6000

---

## Step 1: Spin Up RunPod Pod (5 min)

1. Go to https://www.runpod.io/console/pods
2. Click **"+ Deploy"**
3. Select template: **"RunPod Pytorch 2.1"** or **"RunPod PyTorch"**
4. Choose GPU: **RTX A6000 (48GB)** (recommended) or **RTX 4090 (24GB)** (works but tight)
5. Storage: **50GB Container Disk** (default is fine)
6. Click **"Deploy On-Demand"**
7. Wait ~60-90 seconds for pod to start
8. Click **"Connect"** → **"Start Jupyter Lab"** or **"SSH via Web Terminal"**

---

## Step 2: Upload Files to RunPod (3 min)

### Option A: Via Jupyter Lab (Easiest)
1. In Jupyter Lab, click the **Upload** button (↑ icon)
2. Upload these files from your local machine:
   - `data/tfv/v4.3.1_training_set.jsonl` (200 examples)
   - `scripts/runpod-train-v4.3.1.sh` (training script)

### Option B: Via SCP (If you have SSH access)
```bash
# From your local machine:
scp data/tfv/v4.3.1_training_set.jsonl root@<runpod-ip>:/workspace/
scp scripts/runpod-train-v4.3.1.sh root@<runpod-ip>:/workspace/
```

### Option C: Via Git (Clone the repo)
```bash
# In RunPod terminal:
cd /workspace
git clone https://github.com/yourusername/pokedao.git
cd pokedao
```

---

## Step 3: Set Hugging Face Token (1 min)

```bash
# In RunPod terminal (replace placeholder):
export HUGGINGFACE_TOKEN="<YOUR_HF_TOKEN>"
```

**Where to find your token:**
1. Go to https://huggingface.co/settings/tokens
2. Create a token with **"Write"** permission
3. Copy and paste into the export command above

---

## Step 4: Run Training (10-15 min)

```bash
# In RunPod terminal:
cd /workspace
chmod +x scripts/runpod-train-v4.3.1.sh
bash scripts/runpod-train-v4.3.1.sh
```

**What happens:**
1. Installs dependencies (2-3 min)
2. Loads `ChicoPanama/mew1a-v4.3` base model (2-3 min)
3. Trains LoRA adapters (10-15 min)
   - 3 epochs
   - 200 examples
   - 4-bit quantized training
4. Merges LoRA with base model (2-3 min)
5. Uploads to `ChicoPanama/mew1a-v4.3.1` (1-2 min)

**Expected output:**
```
==========================================
MEW-1A v4.3.1 LoRA TRAINING
==========================================
📦 Loading base model: ChicoPanama/mew1a-v4.3
🔧 Applying LoRA configuration...
trainable params: 4,194,304 || all params: 3,257,323,648 || trainable%: 0.1288
📊 Loading training dataset: ./v4.3.1_training_set.jsonl
   200 training examples loaded
🚀 Initializing trainer...
🏋️  Starting training...
   Epochs: 3
   Batch size: 4 (effective: 8 with grad accumulation)
   Learning rate: 5e-5
   Expected time: 10-15 minutes on A6000
==========================================
[TRAINING PROGRESS BARS...]
✅ Training complete!
📤 Uploading to Hugging Face...
==========================================
✅ TRAINING COMPLETE!
==========================================

Model uploaded to: ChicoPanama/mew1a-v4.3.1
```

---

## Step 5: Verify Upload (1 min)

1. Go to https://huggingface.co/ChicoPanama/mew1a-v4.3.1
2. Verify files exist:
   - `config.json`
   - `model.safetensors` (or `pytorch_model.bin`)
   - `tokenizer.json`
   - `tokenizer_config.json`

3. Check file sizes (should be similar to v4.3):
   - Model: ~6.5GB (merged with LoRA)
   - Config: ~1KB
   - Tokenizer: ~200KB

---

## Step 6: Terminate RunPod Pod (Save Money!)

**IMPORTANT:** Don't forget to terminate the pod to stop billing!

1. Go to https://www.runpod.io/console/pods
2. Find your pod
3. Click **"..."** → **"Terminate"**
4. Confirm termination

**Cost Summary:**
- Setup + Upload: 5-10 min × $0.00079/min ≈ $0.004-0.008
- Training: 10-15 min × $0.00079/min ≈ $0.008-0.012
- **Total: ~$0.10-0.15**

---

## Troubleshooting

### Error: "CUDA out of memory"
- **Solution:** Reduce batch size in training script
- Edit `/tmp/train_v4.3.1.py`, change `per_device_train_batch_size=4` → `2`
- Or use RTX A6000 (48GB) instead of RTX 4090 (24GB)

### Error: "huggingface-cli: command not found"
- **Solution:** Install transformers first
- Run: `pip install transformers huggingface-hub`

### Error: "Invalid credentials"
- **Solution:** Check your Hugging Face token
- Ensure token has **"Write"** permission
- Re-run: `export HUGGINGFACE_TOKEN=hf_your_token`

### Training is very slow (>30 min)
- **Check GPU:** Run `nvidia-smi` to confirm A6000 is being used
- **Check batch size:** Larger batch = faster training (if memory allows)
- **Expected time:** 10-15 min on A6000, 20-25 min on RTX 4090

---

## Next Steps After Training

Once `ChicoPanama/mew1a-v4.3.1` is uploaded:

1. **Test Locally** (optional):
   ```bash
   python scripts/test-v4.3.1.py
   ```

2. **Deploy to Modal**:
   ```bash
   cd apps/mew1a
   modal deploy vllm_deploy_vector_rag.py
   ```

3. **Run Smoke Tests**:
   ```bash
   bash scripts/tfv-smoke-tests.sh
   ```

4. **Expect Results**:
   - TFV smoke tests: 5/5 pass WITHOUT repairs
   - `tfv_repaired_rate`: ~0% (down from 100%)
   - BUY/PASS logic: Unchanged (no regression)

---

## Alternative: Train on Modal (Instead of RunPod)

If you prefer Modal over RunPod:

```bash
# From your local machine:
modal run scripts/modal-train-v4.3.1.py
```

**Pros:**
- No manual pod management
- Automatic shutdown when done
- Integrated with existing Modal setup

**Cons:**
- Slightly more expensive (~$0.15-0.20 vs ~$0.10-0.15)
- Longer cold start (model download each time)

---

## Files Created/Used

**Training Dataset:**
- `data/tfv/v4.3.1_training_set.jsonl` (200 examples, 150 TFV + 50 BUY/PASS)

**Scripts:**
- `scripts/runpod-train-v4.3.1.sh` - RunPod training automation
- `scripts/generate-tfv-training-data.py` - Dataset generation

**Output:**
- `ChicoPanama/mew1a-v4.3.1` - Trained model on Hugging Face

---

**Ready to start?** Go to Step 1 and spin up your RunPod pod!
