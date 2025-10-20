# RunPod - Execute Now Guide

**You have RunPod open and ready to go. Follow these steps exactly.**

---

## Step 1: Check Your Setup (RunPod Terminal)

Copy-paste these commands one at a time:

```bash
# Check GPU
nvidia-smi
```

**Expected**: Should show your GPU (RTX 4090, A100, etc.)

```bash
# Check Python
python3 --version
```

**Expected**: Python 3.8 or higher

```bash
# Check if PyTorch/CUDA works
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

**Expected**: `CUDA available: True`

---

## Step 2: Install Dependencies (RunPod Terminal)

```bash
pip install --quiet --upgrade pip
pip install --quiet torch transformers tqdm accelerate
```

**Wait**: ~2-3 minutes for installation

**Verify**:
```bash
python3 -c "from transformers import AutoModelForCausalLM; print('Transformers OK')"
```

---

## Step 3: Create Directories (RunPod Terminal)

```bash
mkdir -p /workspace/pokedao/data/training/runpod-outputs
mkdir -p /workspace/pokedao/data/training/runpod-logs
mkdir -p /workspace/pokedao/scripts
```

**Verify**:
```bash
ls -la /workspace/pokedao/
```

---

## Step 4: Upload Files from Your Local Machine

**On your LOCAL terminal** (NOT RunPod), run these commands:

First, find your RunPod SSH details:
- Look at your RunPod pod
- Click "Connect" → "SSH over exposed TCP"
- You'll see something like: `ssh root@X.X.X.X -p XXXXX -i ~/.ssh/id_ed25519`

**Copy the IP and PORT**, then run:

```bash
# Replace <POD-IP> and <PORT> with your actual values

# Upload processing scripts
scp -P <PORT> /Users/arcadio/dev/pokedao/scripts/runpod-pseudo-label-salvaged.py root@<POD-IP>:/workspace/pokedao/scripts/

scp -P <PORT> /Users/arcadio/dev/pokedao/scripts/runpod-generate-refusal-examples.py root@<POD-IP>:/workspace/pokedao/scripts/

scp -P <PORT> /Users/arcadio/dev/pokedao/scripts/runpod-generate-buy-pass-examples.py root@<POD-IP>:/workspace/pokedao/scripts/

scp -P <PORT> /Users/arcadio/dev/pokedao/scripts/runpod-deploy-all.sh root@<POD-IP>:/workspace/pokedao/scripts/

# Upload data file (this is the big one - will take a few minutes)
scp -P <PORT> /Users/arcadio/dev/pokedao/data/training/salvaged-cards.jsonl root@<POD-IP>:/workspace/pokedao/data/training/
```

**Wait**: Data upload may take 5-10 minutes depending on file size

---

## Step 5: Verify Uploads (RunPod Terminal)

```bash
# Check scripts uploaded
ls -lh /workspace/pokedao/scripts/runpod-*.py
ls -lh /workspace/pokedao/scripts/runpod-deploy-all.sh

# Check data uploaded
ls -lh /workspace/pokedao/data/training/salvaged-cards.jsonl

# Count lines in data file (should be 129,089)
wc -l /workspace/pokedao/data/training/salvaged-cards.jsonl
```

**Expected**:
- 4 files in scripts/
- salvaged-cards.jsonl with 129,089 lines

---

## Step 6: Run the Processing Pipeline (RunPod Terminal)

**IMPORTANT**: This will take ~4 hours and cost ~$3-5. Make sure you're ready!

```bash
cd /workspace/pokedao
chmod +x scripts/runpod-deploy-all.sh
bash scripts/runpod-deploy-all.sh
```

**The script will**:
1. Ask you to confirm (type `y` and press Enter)
2. Check GPU and dependencies
3. Run Step 1: Pseudo-label 129k examples (2-3 hours)
4. Run Step 2: Generate 24k refusal examples (30 min)
5. Run Step 3: Generate 15k BUY/PASS examples (20 min)
6. Show you a summary when done

---

## Step 7: Monitor Progress (While Running)

**Open a NEW RunPod terminal tab** (don't close the running one!) and run:

```bash
# Watch GPU usage (should be 80-100%)
watch -n 2 nvidia-smi
```

**Or monitor output files**:
```bash
# Check how many examples processed so far
watch -n 10 'wc -l /workspace/pokedao/data/training/runpod-outputs/*.jsonl 2>/dev/null'
```

**Or check logs**:
```bash
tail -f /workspace/pokedao/data/training/runpod-logs/step1-pseudo-label.log
```

**Expected progress**:
- Step 1: ~15-20 examples/minute (will show progress bar)
- Step 2: ~40-50 examples/minute
- Step 3: ~25-30 examples/minute

---

## Step 8: When Complete (After ~4 Hours)

The script will print a completion message with file locations.

**Verify outputs**:
```bash
ls -lh /workspace/pokedao/data/training/runpod-outputs/
wc -l /workspace/pokedao/data/training/runpod-outputs/*.jsonl
```

**Expected files**:
- `cleaned-salvaged.jsonl` (~120,000 lines)
- `refusal-24k.jsonl` (24,000 lines)
- `buy-pass-15k.jsonl` (15,000 lines)

---

## Step 9: Download Results (Local Terminal)

**On your LOCAL machine**, run:

```bash
# Download all outputs
scp -P <PORT> -r root@<POD-IP>:/workspace/pokedao/data/training/runpod-outputs /Users/arcadio/dev/pokedao/data/training/

# Download logs (optional)
scp -P <PORT> -r root@<POD-IP>:/workspace/pokedao/data/training/runpod-logs /Users/arcadio/dev/pokedao/data/training/
```

**Verify downloads**:
```bash
ls -lh /Users/arcadio/dev/pokedao/data/training/runpod-outputs/
wc -l /Users/arcadio/dev/pokedao/data/training/runpod-outputs/*.jsonl
```

---

## Step 10: TERMINATE POD (IMPORTANT!)

**Go to RunPod dashboard**: https://www.runpod.io/console/pods

1. Find your running pod
2. Click **"Stop"** or **"Terminate"**
3. Confirm termination

**Don't forget this step or you'll keep paying!**

---

## Quick Troubleshooting

### If uploads fail
```bash
# Try compressing first
cd /Users/arcadio/dev/pokedao/data/training/
gzip salvaged-cards.jsonl
scp -P <PORT> salvaged-cards.jsonl.gz root@<POD-IP>:/workspace/pokedao/data/training/

# Then decompress on RunPod
gunzip /workspace/pokedao/data/training/salvaged-cards.jsonl.gz
```

### If "salvaged-cards.jsonl not found"
```bash
# Check if you have it locally first
ls -lh /Users/arcadio/dev/pokedao/data/training/salvaged-cards.jsonl

# If not, you need to run the salvage script first (locally)
python3 /Users/arcadio/dev/pokedao/scripts/salvage-cards-rule-based.py \
  --input /Users/arcadio/dev/pokedao/data/training/removed-invalid-cards.jsonl \
  --output /Users/arcadio/dev/pokedao/data/training/salvaged-cards.jsonl \
  --discarded /Users/arcadio/dev/pokedao/data/training/discarded-for-patterns.jsonl \
  --min-confidence 0.60
```

### If out of memory
```bash
# Edit the scripts to use smaller batch size
# Edit scripts/runpod-pseudo-label-salvaged.py line with --batch-size
# Change from 8 to 4
```

---

## What to Do After Download

Come back to me and I'll help you:
1. Convert discarded examples to price patterns (5 min, free)
2. Merge all sources into final v4.3 dataset
3. Upload to HuggingFace
4. Train the v4.3 model

---

**Ready? Start with Step 1 above!**

Let me know if you hit any issues or need help with the SSH connection details.
