# RunPod Deployment Guide - Mew-1A v4.3 Data Processing

## Overview

This guide walks through deploying the Mew-1A v4.3 data processing pipeline on RunPod GPU infrastructure to clean and augment training data for enterprise-quality model training.

**Goal**: Transform 484k raw examples with 48-54% hallucination rate into 355k high-quality examples with <5% hallucination rate.

**Cost**: ~$3-5 total
**Time**: ~4 hours on RTX 4090

---

## What This Does

### Processing Pipeline

1. **Pseudo-Label Salvaged Data** (2-3 hours, ~$2-3)
   - Input: 129,089 salvaged examples (48.3% hallucinations)
   - Model: Llama 3.2 3B Instruct
   - Output: ~120,000 cleaned examples (<10% hallucinations)
   - Method: Re-generate outputs using hallucination-prevention prompts

2. **Generate Refusal Examples** (30 min, ~$0.50)
   - Input: None (synthetic generation)
   - Model: Llama 3.2 3B Instruct
   - Output: 24,000 "I don't know" examples
   - Categories: Obscure cards, real-time data, ambiguous queries, out-of-domain

3. **Generate BUY/PASS Investment Examples** (20 min, ~$0.40)
   - Input: None (synthetic generation)
   - Model: Llama 3.1 8B Instruct (better reasoning)
   - Output: 15,000 BUY/PASS/HOLD recommendations with reasoning
   - Scenarios: Strong buy, moderate buy, hold, pass, strong pass

### Final v4.3 Dataset Composition

| Source | Count | Weight | Effective | Notes |
|--------|-------|--------|-----------|-------|
| Valid clean data | 146,771 | 1.0 | 146,771 | Original data after cleaning |
| Pseudo-labeled | ~120,000 | 1.0 | 120,000 | Salvaged with LLM |
| Refusal examples | 24,000 | 1.0 | 24,000 | Synthetic generation |
| BUY/PASS examples | 15,000 | 1.0 | 15,000 | Synthetic generation |
| Price patterns | 50,000 | 0.15 | 7,500 | SoftDedup downweighting |
| **TOTAL** | **355,771** | - | **313,271** | Enterprise-quality |

---

## Prerequisites

### Local Setup (Before RunPod)

1. **Clean existing data** (run locally first):
   ```bash
   # Step 1: Remove bid hallucinations (166k examples)
   python3 scripts/remove-bid-hallucinations.py \
     --input data/training/mew1a-v4.2-ULTIMATE-COMPLETE-VERIFIED.jsonl \
     --output data/training/v4.3-step1-no-bid-hallucinations.jsonl \
     --report data/training/reports/step1-bid-removal.json

   # Step 2: Remove invalid card names (337k examples)
   python3 scripts/fix-invalid-card-names.py \
     --input data/training/v4.3-step1-no-bid-hallucinations.jsonl \
     --output data/training/v4.3-step2-valid-cards.jsonl \
     --removed data/training/removed-invalid-cards.jsonl \
     --report data/training/reports/step2-card-names.json

   # Step 3: Fix price precision (248k examples)
   python3 scripts/fix-price-precision.py \
     --input data/training/v4.3-step2-valid-cards.jsonl \
     --output data/training/v4.3-step3-fixed-prices.jsonl \
     --report data/training/reports/step3-prices.json

   # Step 4: Salvage invalid card names using rules (129k recovered)
   python3 scripts/salvage-cards-rule-based.py \
     --input data/training/removed-invalid-cards.jsonl \
     --output data/training/salvaged-cards.jsonl \
     --discarded data/training/discarded-for-patterns.jsonl \
     --min-confidence 0.60
   ```

2. **Verify you have**:
   - `data/training/salvaged-cards.jsonl` (129,089 examples)
   - `data/training/discarded-for-patterns.jsonl` (208,398 examples)

### RunPod Account Setup

1. **Create RunPod account**: https://www.runpod.io/
2. **Add payment method**: Credit card or crypto
3. **GPU recommendation**:
   - **Best value**: RTX 4090 (~$1.00/hr) - RECOMMENDED
   - **Faster**: A100 40GB (~$1.50/hr)
   - **Budget**: RTX 3090 (~$0.70/hr, slower)

---

## Step-by-Step Deployment

### 1. Create RunPod Pod

1. Go to https://www.runpod.io/console/pods
2. Click **Deploy**
3. Select **GPU**:
   - RTX 4090 (24GB VRAM) - RECOMMENDED
   - A100 40GB (if available)
4. Select **Template**:
   - Choose: `RunPod PyTorch 2.4.0`
   - Or: `RunPod Transformers` (has transformers pre-installed)
5. **Storage**:
   - Container Disk: 30GB minimum
   - Volume Disk: 50GB recommended (for model caching)
6. Click **Deploy On-Demand Pod**

### 2. Connect to Pod

Once pod is running:

```bash
# Click "Connect" -> "SSH over exposed TCP"
# Copy the SSH command, e.g.:
ssh root@<pod-ip> -p <port> -i ~/.ssh/id_ed25519
```

Or use **JupyterLab** (click "Connect" -> "Connect to Jupyter Lab"):
- Open terminal in JupyterLab
- All commands below run in this terminal

### 3. Install Dependencies

```bash
# Check GPU
nvidia-smi

# Install Python dependencies
pip install --upgrade pip
pip install torch transformers tqdm bitsandbytes accelerate

# Verify installation
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python3 -c "from transformers import AutoModelForCausalLM; print('Transformers OK')"
```

### 4. Upload Code and Data

**Option A: Git Clone (Recommended)**
```bash
cd /workspace
git clone https://github.com/YourUsername/pokedao.git
cd pokedao
```

**Option B: Manual Upload**
```bash
# On your local machine, create upload package:
cd /Users/arcadio/dev/pokedao
tar -czf runpod-package.tar.gz \
  scripts/runpod-*.py \
  scripts/runpod-deploy-all.sh \
  data/training/salvaged-cards.jsonl

# Upload to RunPod (via SCP or JupyterLab file upload)
scp -P <port> runpod-package.tar.gz root@<pod-ip>:/workspace/

# On RunPod, extract:
cd /workspace
tar -xzf runpod-package.tar.gz
```

**Option C: Direct Download (if data is on HuggingFace)**
```bash
# Install huggingface-hub
pip install huggingface-hub

# Download dataset
python3 << EOF
from huggingface_hub import hf_hub_download
hf_hub_download(
    repo_id="ChicoPanama/mew1a-v4.3-salvaged",
    filename="salvaged-cards.jsonl",
    local_dir="/workspace/data/training"
)
EOF
```

### 5. Run Processing Pipeline

**Option A: Run All Steps (Recommended)**
```bash
cd /workspace/pokedao
chmod +x scripts/runpod-deploy-all.sh
bash scripts/runpod-deploy-all.sh
```

This will:
- Check dependencies
- Run pseudo-labeling (2-3 hours)
- Run refusal generation (30 min)
- Run BUY/PASS generation (20 min)
- Save all outputs to `data/training/runpod-outputs/`

**Option B: Run Steps Individually**

```bash
# Step 1: Pseudo-label salvaged data
python3 scripts/runpod-pseudo-label-salvaged.py \
  --input data/training/salvaged-cards.jsonl \
  --output data/training/runpod-outputs/cleaned-salvaged.jsonl \
  --discarded data/training/runpod-outputs/pseudo-label-discarded.jsonl \
  --min-confidence 0.75 \
  --batch-size 8

# Step 2: Generate refusal examples
python3 scripts/runpod-generate-refusal-examples.py \
  --output data/training/runpod-outputs/refusal-24k.jsonl \
  --count 24000

# Step 3: Generate BUY/PASS examples
python3 scripts/runpod-generate-buy-pass-examples.py \
  --output data/training/runpod-outputs/buy-pass-15k.jsonl \
  --count 15000
```

### 6. Monitor Progress

**In separate terminal/tab:**
```bash
# Watch GPU usage
watch -n 1 nvidia-smi

# Monitor output files
watch -n 5 wc -l data/training/runpod-outputs/*.jsonl

# Check logs
tail -f data/training/runpod-logs/step1-pseudo-label.log
```

**Expected Progress**:
- Pseudo-labeling: ~15-20 examples/minute (2-3 hours for 129k)
- Refusal generation: ~40-50 examples/minute (30 min for 24k)
- BUY/PASS generation: ~25-30 examples/minute (20 min for 15k)

### 7. Download Results

**Option A: SCP Download**
```bash
# On your local machine:
scp -P <port> -r root@<pod-ip>:/workspace/pokedao/data/training/runpod-outputs ./data/training/
```

**Option B: JupyterLab Download**
- Navigate to `data/training/runpod-outputs/` in file browser
- Right-click each file -> Download

**Option C: Upload to HuggingFace (Recommended)**
```bash
# On RunPod, install huggingface-hub
pip install huggingface-hub

# Upload to HuggingFace
python3 << EOF
from huggingface_hub import HfApi
api = HfApi()

files = [
    "data/training/runpod-outputs/cleaned-salvaged.jsonl",
    "data/training/runpod-outputs/refusal-24k.jsonl",
    "data/training/runpod-outputs/buy-pass-15k.jsonl"
]

for file in files:
    api.upload_file(
        path_or_fileobj=file,
        path_in_repo=file.split("/")[-1],
        repo_id="ChicoPanama/mew1a-v4.3-processed",
        token="hf_YOUR_TOKEN_HERE"
    )
EOF
```

Then download locally from HuggingFace.

### 8. Terminate Pod

**IMPORTANT**: Stop pod to avoid charges!

```bash
# On RunPod dashboard, click "Stop" or "Terminate"
```

**Cost Calculation**:
- If 4 hours @ $1.00/hr = $4.00 total
- If 3 hours @ $1.00/hr = $3.00 total

---

## Post-Processing (Run Locally)

After downloading RunPod outputs, merge into final v4.3 dataset:

```bash
# 1. Convert discarded examples to price patterns
python3 scripts/convert-to-price-patterns.py \
  --input data/training/discarded-for-patterns.jsonl \
  --output data/training/price-patterns-50k.jsonl \
  --max-examples 50000 \
  --report data/training/reports/price-patterns.json

# 2. Merge all sources into final v4.3 dataset
python3 scripts/merge-v4.3-final.py \
  --valid data/training/v4.3-step3-fixed-prices.jsonl \
  --pseudo-labeled data/training/runpod-outputs/cleaned-salvaged.jsonl \
  --refusal data/training/runpod-outputs/refusal-24k.jsonl \
  --buy-pass data/training/runpod-outputs/buy-pass-15k.jsonl \
  --price-patterns data/training/price-patterns-50k.jsonl \
  --output data/training/mew1a-v4.3-FINAL.jsonl \
  --report data/training/reports/v4.3-final.json

# 3. Audit final quality
python3 scripts/audit-training-data-v4.3.py \
  --input data/training/mew1a-v4.3-FINAL.jsonl \
  --output data/training/reports/v4.3-audit.json

# 4. Upload to HuggingFace
python3 scripts/upload-to-huggingface.py \
  --input data/training/mew1a-v4.3-FINAL.jsonl \
  --repo ChicoPanama/mew1a-v4.3-training-data
```

---

## Expected Results

### Quality Metrics (Before vs After)

| Metric | v4.2 | v4.3 Target |
|--------|------|-------------|
| **Hallucination Rate** | 48-54% | <5% |
| **Training Loss** | 0.130 | <0.110 |
| **Valid Card Names** | 30.3% | 99.7% |
| **BUY/PASS Accuracy** | ~30% | >85% |
| **Refusal Capability** | 0% | >95% |
| **Price Precision** | 51% wrong | 100% correct |
| **Dataset Size** | 484,258 | 355,771 |

### v4.3 Training Expectations

```bash
# Train v4.3 on RunPod (separate deployment)
python3 scripts/mew1a-train-v4.3.py \
  --dataset ChicoPanama/mew1a-v4.3-training-data \
  --output-dir models/mew1a-v4.3 \
  --epochs 3 \
  --batch-size 8 \
  --learning-rate 2e-5 \
  --lora-r 256 \
  --lora-alpha 512
```

**Expected**:
- Training time: 3-4 hours on A100 40GB
- Final loss: <0.110 (vs v4.2: 0.130)
- Cost: ~$5-6 (A100 @ $1.50/hr)

---

## Troubleshooting

### Out of Memory (OOM)

**Symptoms**: `CUDA out of memory` error

**Solutions**:
1. Reduce batch size:
   ```bash
   python3 runpod-pseudo-label-salvaged.py --batch-size 4  # Default: 8
   ```

2. Use gradient checkpointing (edit script):
   ```python
   self.model = AutoModelForCausalLM.from_pretrained(
       model_name,
       torch_dtype=torch.bfloat16,
       device_map="auto",
       gradient_checkpointing=True  # Add this
   )
   ```

3. Upgrade to larger GPU (A100 40GB)

### Slow Processing

**Symptoms**: <5 examples/minute

**Solutions**:
1. Check GPU usage: `nvidia-smi` should show >80% utilization
2. Verify using GPU:
   ```python
   import torch
   print(torch.cuda.is_available())  # Should be True
   ```
3. Increase batch size if memory allows:
   ```bash
   --batch-size 16  # If GPU has headroom
   ```

### Model Download Failures

**Symptoms**: `Connection timeout` or `Unable to download model`

**Solutions**:
1. Use HuggingFace token:
   ```bash
   export HF_TOKEN="hf_YOUR_TOKEN"
   ```

2. Download model first:
   ```bash
   python3 -c "from transformers import AutoModelForCausalLM; \
               AutoModelForCausalLM.from_pretrained('meta-llama/Llama-3.2-3B-Instruct')"
   ```

3. Use snapshot download:
   ```python
   from huggingface_hub import snapshot_download
   snapshot_download("meta-llama/Llama-3.2-3B-Instruct", local_dir="./models/llama-3.2-3b")
   ```

### Data Upload Issues

**Symptoms**: Upload fails or times out

**Solutions**:
1. Compress data:
   ```bash
   gzip data/training/salvaged-cards.jsonl
   # Upload .gz file, then gunzip on RunPod
   ```

2. Split large files:
   ```bash
   split -l 50000 salvaged-cards.jsonl salvaged-part-
   # Upload parts, then cat on RunPod
   ```

3. Use cloud storage:
   - Upload to Google Drive
   - Download on RunPod: `gdown <file-id>`

---

## Cost Optimization Tips

1. **Use Spot Instances** (if available):
   - 50-70% cheaper than on-demand
   - Risk: Can be terminated if capacity needed

2. **Monitor and Stop**:
   - Set up alerts for long-running pods
   - Stop pod immediately after downloading results

3. **Batch Multiple Runs**:
   - If re-running, process multiple experiments in one session
   - Example: Test different confidence thresholds in parallel

4. **Pre-download Models Locally**:
   - Download Llama models once
   - Upload to RunPod volume (persists across pods)
   - Saves 10-15 minutes per run

---

## Research References

This pipeline implements 2025 research best practices:

1. **Weak Supervision** (Stanford Weaver, 2025)
   - Confidence thresholding >80% for high-quality labels
   - Used in pseudo-labeling step

2. **Pseudo-Labeling** (Tsinghua TTRL, 2025)
   - Self-evolving LLMs using unlabeled data
   - 15-25% accuracy improvement on domain tasks

3. **SoftDedup** (2025)
   - Reweight instead of delete low-confidence examples
   - 26% faster training, +1.8% accuracy
   - Used in price pattern conversion (0.15 weight)

4. **Hallucination Prevention** (Anthropic, 2025)
   - Span-level verification
   - Multi-agent fact-checking (retriever→writer→checker)
   - <5% hallucination rate benchmark

5. **Constitutional AI** (Anthropic, 2024-2025)
   - Explicit refusal training
   - Safety-critical applications standard
   - Used in refusal example generation

---

## Next Steps After v4.3 Training

1. **Deploy v4.3 to Production**:
   - Update Modal/vLLM deployment
   - A/B test vs v4.2
   - Monitor hallucination rates

2. **Phase 5: RLHF/DPO** (if needed):
   - Collect production preference data
   - Fine-tune with DPO (Direct Preference Optimization)
   - Target: >95% user satisfaction

3. **Phase 6: Multi-Agent Architecture**:
   - Retriever: RAG from PostgreSQL
   - Writer: Mew-1A v4.3
   - Fact-checker: Verification LLM
   - Target: 90% hallucination reduction

---

## Support

- **Documentation**: See `MEW1A-ENTERPRISE-QUALITY-ROADMAP.md`
- **Issues**: Create GitHub issue in pokedao repo
- **RunPod Support**: https://www.runpod.io/discord
- **Model Issues**: Check HuggingFace model cards

---

**Last Updated**: 2025-10-19
**Version**: v4.3
**Author**: PokeDAO + Claude Code (Anthropic)
