# RunPod Commands Cheatsheet - Mew-1A v4.3

Quick reference for RunPod deployment commands.

---

## Initial Setup (RunPod Terminal)

```bash
# Check GPU
nvidia-smi

# Install dependencies
pip install --quiet torch transformers tqdm bitsandbytes accelerate

# Verify CUDA
python3 -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"

# Create directories
mkdir -p /workspace/pokedao/{data/training/runpod-outputs,data/training/runpod-logs,scripts}
```

---

## File Upload (Local Terminal)

```bash
# Replace <pod-ip> and <port> with your RunPod SSH details

# Upload scripts
scp -P <port> scripts/runpod-*.py root@<pod-ip>:/workspace/pokedao/scripts/
scp -P <port> scripts/runpod-deploy-all.sh root@<pod-ip>:/workspace/pokedao/scripts/

# Upload data
scp -P <port> data/training/salvaged-cards.jsonl root@<pod-ip>:/workspace/pokedao/data/training/

# Verify uploads
ssh root@<pod-ip> -p <port> "ls -lh /workspace/pokedao/data/training/salvaged-cards.jsonl"
```

---

## Run Processing (RunPod Terminal)

### Option A: Run All Steps (Recommended)

```bash
cd /workspace/pokedao
chmod +x scripts/runpod-deploy-all.sh
bash scripts/runpod-deploy-all.sh
```

### Option B: Run Steps Individually

```bash
# Step 1: Pseudo-label salvaged data (2-3 hours)
python3 scripts/runpod-pseudo-label-salvaged.py \
  --input data/training/salvaged-cards.jsonl \
  --output data/training/runpod-outputs/cleaned-salvaged.jsonl \
  --min-confidence 0.75

# Step 2: Generate refusal examples (30 min)
python3 scripts/runpod-generate-refusal-examples.py \
  --output data/training/runpod-outputs/refusal-24k.jsonl \
  --count 24000

# Step 3: Generate BUY/PASS examples (20 min)
python3 scripts/runpod-generate-buy-pass-examples.py \
  --output data/training/runpod-outputs/buy-pass-15k.jsonl \
  --count 15000
```

---

## Monitor Progress (RunPod Terminal)

```bash
# Watch GPU usage (Ctrl+C to exit)
watch -n 1 nvidia-smi

# Check output file progress
watch -n 5 wc -l data/training/runpod-outputs/*.jsonl

# View logs
tail -f data/training/runpod-logs/step1-pseudo-label.log
tail -f data/training/runpod-logs/step2-refusal.log
tail -f data/training/runpod-logs/step3-buy-pass.log
```

---

## Download Results (Local Terminal)

```bash
# Download all outputs
scp -P <port> -r root@<pod-ip>:/workspace/pokedao/data/training/runpod-outputs ./data/training/

# Download logs (optional)
scp -P <port> -r root@<pod-ip>:/workspace/pokedao/data/training/runpod-logs ./data/training/

# Verify downloads
ls -lh data/training/runpod-outputs/
wc -l data/training/runpod-outputs/*.jsonl
```

Expected outputs:
```
cleaned-salvaged.jsonl    ~120,000 lines
refusal-24k.jsonl          24,000 lines
buy-pass-15k.jsonl         15,000 lines
```

---

## Terminate Pod (RunPod Dashboard)

**IMPORTANT**: Stop pod immediately after downloading to avoid charges!

1. Go to https://www.runpod.io/console/pods
2. Find your pod
3. Click **"Stop"** or **"Terminate"**
4. Confirm termination

---

## Post-Processing (Local Terminal)

```bash
# Convert discarded examples to price patterns
python3 scripts/convert-to-price-patterns.py \
  --input data/training/discarded-for-patterns.jsonl \
  --output data/training/price-patterns-50k.jsonl \
  --max-examples 50000

# Merge all sources into v4.3 (script to be created)
# python3 scripts/merge-v4.3-final.py ...

# Verify final dataset
wc -l data/training/mew1a-v4.3-FINAL.jsonl
# Expected: ~355,771 lines
```

---

## Troubleshooting

### Out of Memory

```bash
# Reduce batch size
python3 runpod-pseudo-label-salvaged.py --batch-size 4
```

### Slow Processing

```bash
# Check GPU utilization (should be >80%)
nvidia-smi

# Increase batch size if memory allows
python3 runpod-pseudo-label-salvaged.py --batch-size 16
```

### Model Download Failed

```bash
# Set HuggingFace token
export HF_TOKEN="hf_YOUR_TOKEN"

# Pre-download model
python3 -c "from transformers import AutoModelForCausalLM; AutoModelForCausalLM.from_pretrained('meta-llama/Llama-3.2-3B-Instruct')"
```

### Upload Timeout

```bash
# Compress large files
gzip data/training/salvaged-cards.jsonl

# Upload compressed
scp -P <port> data/training/salvaged-cards.jsonl.gz root@<pod-ip>:/workspace/pokedao/data/training/

# Decompress on RunPod
gunzip /workspace/pokedao/data/training/salvaged-cards.jsonl.gz
```

---

## Quick Stats

| Step | Time | Cost | Output |
|------|------|------|--------|
| Pseudo-label | 2-3 hrs | $2-3 | ~120k examples |
| Refusal | 30 min | $0.50 | 24k examples |
| BUY/PASS | 20 min | $0.40 | 15k examples |
| **TOTAL** | **~4 hrs** | **$3-5** | **~159k examples** |

---

## Need Help?

- **Full guide**: [RUNPOD-DEPLOYMENT-GUIDE.md](RUNPOD-DEPLOYMENT-GUIDE.md)
- **Package overview**: [MEW1A-V4.3-RUNPOD-PACKAGE.md](MEW1A-V4.3-RUNPOD-PACKAGE.md)
- **RunPod support**: https://www.runpod.io/discord
