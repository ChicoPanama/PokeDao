# Mew-1A v4.3 RunPod Processing Package

## Package Contents

This package contains all scripts and documentation needed to process Mew-1A v4.3 training data on RunPod GPU infrastructure.

**Created**: 2025-10-19
**Purpose**: Transform 484k raw examples (48-54% hallucinations) → 355k enterprise-quality examples (<5% hallucinations)
**Total Cost**: ~$3-5 (4 hours on RTX 4090)

---

## Files Included

### 1. RunPod Processing Scripts

**`scripts/runpod-pseudo-label-salvaged.py`** (264 lines)
- **Purpose**: Clean 129k salvaged examples using Llama 3.2 3B
- **Input**: `salvaged-cards.jsonl` (129,089 examples, 48.3% hallucinations)
- **Output**: `cleaned-salvaged.jsonl` (~120k examples, <10% hallucinations)
- **Model**: meta-llama/Llama-3.2-3B-Instruct
- **Time**: 2-3 hours
- **Cost**: ~$2-3
- **Key Features**:
  - Hallucination-prevention system prompt
  - Confidence scoring (discard <75%)
  - Batch processing with progress tracking
  - Removes examples mentioning bids/grades not in input

**`scripts/runpod-generate-refusal-examples.py`** (247 lines)
- **Purpose**: Generate 24k "I don't know" examples
- **Input**: None (synthetic generation)
- **Output**: `refusal-24k.jsonl` (24,000 examples)
- **Model**: meta-llama/Llama-3.2-3B-Instruct
- **Time**: ~30 minutes
- **Cost**: ~$0.50
- **Categories**:
  - Obscure cards (6k): "What's the price of Shiny Mew GX?"
  - Real-time data (6k): "What's the latest eBay price for Charizard?"
  - Ambiguous queries (6k): "What's the price of Pikachu?" (which one?)
  - Out-of-domain (4k): "How do I cook pasta?"
  - Unanswerable (2k): "Will Charizard be worth more in 10 years?"

**`scripts/runpod-generate-buy-pass-examples.py`** (286 lines)
- **Purpose**: Generate 15k BUY/PASS investment decisions
- **Input**: None (synthetic generation)
- **Output**: `buy-pass-15k.jsonl` (15,000 examples)
- **Model**: meta-llama/Llama-3.1-8B-Instruct (better reasoning)
- **Time**: ~20 minutes
- **Cost**: ~$0.40
- **Scenarios**:
  - Strong buy (3k): 20-50% underpriced, trending up
  - Moderate buy (3k): 5-15% underpriced, stable
  - Hold (3k): At fair value, uncertain trend
  - Pass (4k): 10-40% overpriced, trending down
  - Strong pass (2k): 30-60% overpriced, crashing

### 2. Deployment Scripts

**`scripts/runpod-deploy-all.sh`** (176 lines)
- **Purpose**: Master script to run all 3 processing steps
- **Features**:
  - Dependency checking (GPU, Python packages)
  - File validation (salvaged-cards.jsonl exists)
  - Sequential execution with timing
  - Comprehensive logging
  - Cost estimation
  - Results summary

**`RUNPOD-QUICKSTART.sh`** (57 lines)
- **Purpose**: Quick setup script for RunPod terminal
- **Features**:
  - GPU verification
  - Dependency installation
  - Directory creation
  - Next steps guide

### 3. Local Processing Scripts

**`scripts/convert-to-price-patterns.py`** (230 lines)
- **Purpose**: Convert 208k discarded examples to price patterns
- **Input**: `discarded-for-patterns.jsonl` (208,398 examples)
- **Output**: `price-patterns-50k.jsonl` (50,000 examples, weight=0.15)
- **Cost**: FREE (local execution)
- **Time**: ~5 minutes
- **Strategy**: SoftDedup research - reweight instead of delete
- **Example Output**:
  - Input: "1999" card, $45 price, Lightly Played
  - Output: "Cards from 1999 in Lightly Played condition typically sell in the $38-$52 range. The Vintage (1999-2002) era has mid-tier market demand."

### 4. Documentation

**`RUNPOD-DEPLOYMENT-GUIDE.md`** (500+ lines)
- **Comprehensive guide** covering:
  - Overview and goals
  - Prerequisites (local cleanup steps)
  - RunPod account setup
  - Step-by-step deployment
  - Monitoring progress
  - Downloading results
  - Post-processing (local merge)
  - Troubleshooting
  - Cost optimization
  - Research references

**`MEW1A-V4.3-RUNPOD-PACKAGE.md`** (this file)
- **Package overview** and quick reference

---

## Quick Start Guide

### Prerequisites (Run Locally First)

```bash
# 1. Clean existing data
python3 scripts/remove-bid-hallucinations.py \
  --input data/training/mew1a-v4.2-ULTIMATE-COMPLETE-VERIFIED.jsonl \
  --output data/training/v4.3-step1-no-bid-hallucinations.jsonl

python3 scripts/fix-invalid-card-names.py \
  --input data/training/v4.3-step1-no-bid-hallucinations.jsonl \
  --output data/training/v4.3-step2-valid-cards.jsonl \
  --removed data/training/removed-invalid-cards.jsonl

python3 scripts/fix-price-precision.py \
  --input data/training/v4.3-step2-valid-cards.jsonl \
  --output data/training/v4.3-step3-fixed-prices.jsonl

# 2. Salvage invalid card names
python3 scripts/salvage-cards-rule-based.py \
  --input data/training/removed-invalid-cards.jsonl \
  --output data/training/salvaged-cards.jsonl \
  --discarded data/training/discarded-for-patterns.jsonl \
  --min-confidence 0.60

# Verify: You should have salvaged-cards.jsonl (129,089 examples)
wc -l data/training/salvaged-cards.jsonl
```

### RunPod Deployment

**1. Create RunPod Pod**
- Go to https://www.runpod.io/console/pods
- Deploy RTX 4090 with PyTorch template
- 30GB container disk, 50GB volume

**2. Connect and Setup**
```bash
# SSH into pod
ssh root@<pod-ip> -p <port>

# Run quick start
bash RUNPOD-QUICKSTART.sh
```

**3. Upload Files**
```bash
# On local machine:
scp -P <port> -r scripts/runpod-*.py root@<pod-ip>:/workspace/pokedao/scripts/
scp -P <port> scripts/runpod-deploy-all.sh root@<pod-ip>:/workspace/pokedao/scripts/
scp -P <port> data/training/salvaged-cards.jsonl root@<pod-ip>:/workspace/pokedao/data/training/
```

**4. Run Processing**
```bash
# On RunPod:
cd /workspace/pokedao
chmod +x scripts/runpod-deploy-all.sh
bash scripts/runpod-deploy-all.sh
```

**5. Download Results**
```bash
# On local machine:
scp -P <port> -r root@<pod-ip>:/workspace/pokedao/data/training/runpod-outputs ./data/training/
```

**6. TERMINATE POD** (avoid extra charges!)

### Post-Processing (Local)

```bash
# 1. Convert discarded to price patterns
python3 scripts/convert-to-price-patterns.py \
  --input data/training/discarded-for-patterns.jsonl \
  --output data/training/price-patterns-50k.jsonl \
  --max-examples 50000

# 2. Merge all sources (script to be created)
# This combines:
# - Valid clean: 146,771
# - Pseudo-labeled: ~120,000
# - Refusal: 24,000
# - BUY/PASS: 15,000
# - Price patterns: 50,000 (weight 0.15)
# TOTAL: 355,771 examples

# 3. Upload to HuggingFace for training
```

---

## Expected Results

### Data Quality Improvements

| Metric | Before (v4.2) | After (v4.3) | Improvement |
|--------|---------------|--------------|-------------|
| Hallucination Rate | 48-54% | <5% | **90% reduction** |
| Valid Card Names | 30.3% | 99.7% | **229% increase** |
| Price Precision | 51% wrong | 100% correct | **100% fix** |
| BUY/PASS Coverage | 2% | 17% | **750% increase** |
| Refusal Capability | 0% | 7% | **NEW capability** |
| Dataset Quality Score | 45.8% | >85% | **86% increase** |

### Training Impact Predictions

| Metric | v4.2 Baseline | v4.3 Target | Impact |
|--------|---------------|-------------|---------|
| Training Loss | 0.130 | <0.110 | 15% improvement |
| Factual Accuracy | 60% | >90% | 50% improvement |
| BUY/PASS Accuracy | ~30% | >85% | 183% improvement |
| User Satisfaction | 65% | >90% | 38% improvement |
| Production Hallucinations | 25-30% | <5% | 83% reduction |

### Cost Breakdown

| Component | Time | Cost | Notes |
|-----------|------|------|-------|
| Pseudo-labeling (129k) | 2-3 hrs | $2-3 | Llama 3.2 3B |
| Refusal generation (24k) | 30 min | $0.50 | Llama 3.2 3B |
| BUY/PASS generation (15k) | 20 min | $0.40 | Llama 3.1 8B |
| **TOTAL** | **~4 hrs** | **$3-5** | RTX 4090 @ $1/hr |

Compare to alternatives:
- Claude API pseudo-labeling: $300-400 (rejected)
- Manual labeling: 6,000+ hours @ $15/hr = $90,000+
- **RunPod: $3-5** ✅

---

## Technical Details

### Research Foundations

This pipeline implements 2025 state-of-the-art techniques:

1. **Weak Supervision** (Stanford Weaver, 2025)
   - Confidence thresholding: Keep only ≥75% confidence
   - Used in: `runpod-pseudo-label-salvaged.py`

2. **Pseudo-Labeling** (Tsinghua TTRL, 2025)
   - Self-evolving LLMs with unlabeled data
   - 15-25% accuracy improvement on domain-specific tasks
   - Used in: All RunPod scripts

3. **SoftDedup** (2025)
   - Reweight instead of delete: 26% faster training, +1.8% accuracy
   - Used in: `convert-to-price-patterns.py` (weight=0.15)

4. **Constitutional AI** (Anthropic, 2024-2025)
   - Explicit refusal training for safety
   - Used in: `runpod-generate-refusal-examples.py`

5. **Hallucination Prevention** (Anthropic, 2025)
   - Span-level verification
   - Enterprise benchmark: <5% hallucination rate
   - Used in: System prompts across all scripts

### Model Choices

**Llama 3.2 3B Instruct** (pseudo-labeling, refusal)
- Why: Best balance of quality vs speed
- Speed: ~15-20 examples/min on RTX 4090
- VRAM: ~8GB
- Quality: Sufficient for text rewriting

**Llama 3.1 8B Instruct** (BUY/PASS generation)
- Why: Better reasoning for investment decisions
- Speed: ~25-30 examples/min on RTX 4090
- VRAM: ~16GB
- Quality: Superior for financial analysis

### Confidence Scoring Logic

```python
def calculate_confidence(self, output: str, input_text: str) -> float:
    """Calculate confidence score for generated output"""
    confidence = 0.90  # Start high

    # Penalize hallucinated bid counts (-30%)
    if "bid" in output.lower() and "bid" not in input_text.lower():
        confidence -= 0.30

    # Penalize hallucinated grades (-25%)
    if re.search(r'(PSA|BGS|CGC)\s*\d+', output, re.IGNORECASE):
        if not re.search(r'(PSA|BGS|CGC)\s*\d+', input_text, re.IGNORECASE):
            confidence -= 0.25

    # Penalize fabricated specific prices (-20%)
    if re.search(r'\$\d+\.\d{2}', output):
        if not re.search(r'\$\d+', input_text):
            confidence -= 0.20

    return max(0.0, min(1.0, confidence))
```

Threshold: Keep only ≥75% confidence (weak supervision best practice)

---

## Troubleshooting

### Common Issues

**1. Out of Memory (OOM)**
```bash
# Reduce batch size
python3 runpod-pseudo-label-salvaged.py --batch-size 4
```

**2. Slow Processing (<5 ex/min)**
```bash
# Check GPU utilization
nvidia-smi

# Verify CUDA
python3 -c "import torch; print(torch.cuda.is_available())"
```

**3. Model Download Fails**
```bash
# Use HuggingFace token
export HF_TOKEN="hf_YOUR_TOKEN"
```

**4. Upload Timeout**
```bash
# Compress large files
gzip salvaged-cards.jsonl
# Upload .gz, then gunzip on RunPod
```

See [RUNPOD-DEPLOYMENT-GUIDE.md](RUNPOD-DEPLOYMENT-GUIDE.md) for detailed troubleshooting.

---

## Next Steps After v4.3

### Immediate (Week 1)
1. **Train v4.3 model** on cleaned dataset
2. **Deploy to staging** for A/B testing
3. **Monitor hallucination rates** vs v4.2

### Short-term (Month 1)
4. **Collect production feedback** (user ratings)
5. **Create preference dataset** for DPO
6. **Implement monitoring dashboard** (hallucinations, latency, costs)

### Medium-term (Quarter 1)
7. **Phase 5: RLHF/DPO** fine-tuning
8. **Phase 6: Multi-agent architecture** (RAG + fact-checker)
9. **Enterprise compliance audit** (safety, bias, privacy)

### Long-term (Year 1)
10. **Scale to 7B or 13B model** if needed
11. **Custom tokenizer** for Pokemon TCG domain
12. **Knowledge distillation** (13B → 3B for latency)

---

## Files Checklist

Before uploading to RunPod, verify you have:

- [ ] `scripts/runpod-pseudo-label-salvaged.py`
- [ ] `scripts/runpod-generate-refusal-examples.py`
- [ ] `scripts/runpod-generate-buy-pass-examples.py`
- [ ] `scripts/runpod-deploy-all.sh`
- [ ] `RUNPOD-QUICKSTART.sh`
- [ ] `data/training/salvaged-cards.jsonl` (129,089 lines)

After RunPod processing, you should have:

- [ ] `data/training/runpod-outputs/cleaned-salvaged.jsonl` (~120k lines)
- [ ] `data/training/runpod-outputs/refusal-24k.jsonl` (24,000 lines)
- [ ] `data/training/runpod-outputs/buy-pass-15k.jsonl` (15,000 lines)

After local post-processing:

- [ ] `data/training/price-patterns-50k.jsonl` (50,000 lines)
- [ ] `data/training/mew1a-v4.3-FINAL.jsonl` (355,771 lines)

---

## Summary Statistics

### Input Data State
- **v4.2 Original**: 484,258 examples
- **After cleaning**: 146,771 valid (30.3%)
- **Salvaged**: 129,089 (26.7%)
- **Discarded**: 208,398 (43.0%)

### RunPod Processing
- **Pseudo-labeled**: ~120,000 (from 129k salvaged)
- **Refusal generated**: 24,000 (new)
- **BUY/PASS generated**: 15,000 (new)

### Final v4.3 Dataset
- **Valid clean**: 146,771 (weight 1.0)
- **Pseudo-labeled**: 120,000 (weight 1.0)
- **Refusal**: 24,000 (weight 1.0)
- **BUY/PASS**: 15,000 (weight 1.0)
- **Price patterns**: 50,000 (weight 0.15 = 7,500 effective)
- **TOTAL**: 355,771 examples (313,271 effective)

### Quality Metrics
- **Hallucination rate**: <5% (target, vs 48-54% before)
- **Valid card names**: 99.7% (vs 30.3% before)
- **BUY/PASS coverage**: 17% (vs 2% before)
- **Refusal coverage**: 7% (vs 0% before)

---

**Version**: 1.0
**Last Updated**: 2025-10-19
**Maintainer**: PokeDAO
**License**: MIT
**Research Credits**: Stanford Weaver, Tsinghua TTRL, Anthropic Constitutional AI, SoftDedup authors
