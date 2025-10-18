# Mew-1A v2 Training Guide

Complete guide to train and deploy Mew-1A v2 with 4x more training data.

## Overview

**Mew-1A v2** is the second iteration of our Pokemon TCG pricing AI model, trained on **40,328 examples** (4x the v1 dataset of 10,000 examples).

### Improvements Over v1

| Metric | v1 | v2 | Improvement |
|--------|----|----|-------------|
| **Training Examples** | 10,000 | 40,328 | **4x** |
| **Data Sources** | 2 | 5 | **2.5x** |
| **Training Categories** | General | 5 specialized | More comprehensive |
| **Target Loss** | 0.170 | < 0.150 | **12%+ better** |
| **Price Coverage** | 68% | 90.4% | **+22.4%** |

### Training Categories (40,328 examples)

1. **Arbitrage Detection** (5,780 examples)
   - Compare listing price vs market average
   - Identify underpriced/overpriced cards
   - Calculate discount percentages

2. **Liquidity Analysis** (15,920 examples)
   - Market depth analysis
   - Sales velocity estimates
   - Time-to-sell predictions

3. **Price Trend Analysis** (2,239 examples)
   - Historical price movements
   - Volatility assessment
   - Trend direction classification

4. **Multi-Source Consensus** (13,681 examples)
   - Cross-marketplace pricing
   - Fair value determination
   - Arbitrage opportunity detection

5. **Condition/Grade Adjustments** (2,708 examples)
   - PSA/CGC premium calculations
   - Graded vs ungraded differentials
   - Condition impact on pricing

## Dataset

**HuggingFace Hub**: [ChicoPanama/mew1a-v2-pokemon-tcg-pricing](https://huggingface.co/datasets/ChicoPanama/mew1a-v2-pokemon-tcg-pricing)

### Dataset Statistics

- **Total Examples**: 40,328
- **Avg Example Length**: 421 characters
- **Estimated Tokens**: ~4.2M tokens
- **Format**: Instruction-tuning (Alpaca format)
- **File Size**: 23.89 MB (JSONL)

### Price Range Distribution

| Range | Count | Percentage |
|-------|-------|------------|
| Low ($1-10) | 15,832 | 39.26% |
| Budget ($0-1) | 9,496 | 23.55% |
| Mid ($10-50) | 9,049 | 22.44% |
| High ($50-250) | 4,701 | 11.66% |
| Premium ($250+) | 1,250 | 3.10% |

## Training Setup

### Option 1: RunPod (Recommended)

**GPU**: RTX 4090 (24GB VRAM)
**Cost**: ~$0.34/hour
**Training Time**: 8-12 hours
**Total Cost**: ~$20-30

#### Quick Start

```bash
# 1. Launch RunPod RTX 4090 pod with PyTorch 2.x template
# 2. SSH into the pod
# 3. Run setup script:
bash <(curl -s https://raw.githubusercontent.com/ChicoPanama/PokeDao/main/scripts/runpod-setup-mew1a-v2.sh)

# 4. Set HuggingFace token
export HUGGINGFACE_TOKEN=your_token_here

# 5. Start training
./train.sh

# 6. Monitor progress
tail -f training.log
```

#### Manual Setup

```bash
# Install dependencies
pip install transformers datasets accelerate peft bitsandbytes scipy huggingface_hub

# Download training script
wget https://raw.githubusercontent.com/ChicoPanama/PokeDao/main/scripts/mew1a-train-v2.py

# Set token
export HUGGINGFACE_TOKEN=your_token_here

# Run training
python3 mew1a-train-v2.py
```

### Option 2: Local Training

**Requirements**:
- NVIDIA GPU with 16GB+ VRAM (RTX 3090/4090 recommended)
- CUDA 11.8 or 12.1
- Python 3.9+
- 50GB free disk space

```bash
cd /Users/arcadio/dev/pokedao

# Set HuggingFace token
export HUGGINGFACE_TOKEN=your_token_here

# Run training
python3 scripts/mew1a-train-v2.py
```

## Training Configuration

### Hyperparameters

```python
# Model
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"

# Training
LEARNING_RATE = 2e-4
NUM_EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4  # Effective batch size = 16
MAX_LENGTH = 512
WARMUP_STEPS = 100

# LoRA
LORA_R = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.05
```

### Expected Training Metrics

| Epoch | Loss | Time (RTX 4090) |
|-------|------|-----------------|
| 1 | ~0.180 | 3-4 hours |
| 2 | ~0.160 | 3-4 hours |
| 3 | **< 0.150** | 3-4 hours |

**Target**: Final loss < 0.150 (12%+ improvement over v1's 0.170)

## Model Output

### Files Generated

```
mew1a-v2-output/
├── adapter_config.json          # LoRA configuration
├── adapter_model.safetensors    # LoRA weights (~48MB)
├── tokenizer.json
├── tokenizer_config.json
├── special_tokens_map.json
└── training_args.bin
```

### HuggingFace Hub

Model will be automatically uploaded to:
**[ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing](https://huggingface.co/ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing)**

## Testing the Model

### Quick Test

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

# Load model
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)

model = PeftModel.from_pretrained(base_model, "./mew1a-v2-output")
tokenizer = AutoTokenizer.from_pretrained("./mew1a-v2-output")

# Test prompt
prompt = """Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
Analyze: Charizard ex - Obsidian Flames. Listed at $45.00, 15 active listings, fair value $52.00

### Response:
"""

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=300, temperature=0.7)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

### Expected Output

```
ANALYSIS: Strong BUY opportunity

PRICING:
• Listed: $45.00
• Fair Value: $52.00 (based on 15 listings)
• Discount: 13.5% below market

LIQUIDITY:
• Market Depth: 15 active listings
• Liquidity Grade: C

RECOMMENDATION: BUY
Reasoning: Significant discount with proven demand. High probability of selling within 2-3 weeks at market value for 15%+ profit.
```

## Deployment

### Option 1: Modal Labs (Production)

Deploy to serverless GPU for production inference:

```python
# scripts/mew1a-deploy-v2-modal.py
import modal

stub = modal.Stub("mew1a-v2-tcg-pricing")

@stub.function(
    gpu="T4",
    image=modal.Image.debian_slim().pip_install(
        "transformers", "peft", "torch"
    )
)
def analyze_card(prompt: str, max_tokens: int = 300):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    import torch

    base_model = AutoModelForCausalLM.from_pretrained(
        "meta-llama/Llama-3.2-3B-Instruct",
        torch_dtype=torch.bfloat16
    )
    model = PeftModel.from_pretrained(
        base_model,
        "ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing"
    )
    tokenizer = AutoTokenizer.from_pretrained(
        "ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing"
    )

    inputs = tokenizer(prompt, return_tensors="pt")
    outputs = model.generate(**inputs, max_new_tokens=max_tokens)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

@stub.web_endpoint(method="POST")
def analyze_card_endpoint(data: dict):
    return analyze_card.call(data["prompt"], data.get("max_tokens", 300))
```

Deploy:
```bash
modal deploy scripts/mew1a-deploy-v2-modal.py
```

### Option 2: Local API Server

```bash
# Use vLLM or text-generation-inference
pip install vllm

vllm serve ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype bfloat16
```

## A/B Testing v1 vs v2

### Test Script

```python
import requests

def test_both_versions(prompt):
    # v1 endpoint
    v1_response = requests.post(
        "https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run",
        json={"prompt": prompt, "max_tokens": 300}
    ).json()

    # v2 endpoint (after deployment)
    v2_response = requests.post(
        "https://chicopanama--mew1a-v2-tcg-pricing-analyze-card.modal.run",
        json={"prompt": prompt, "max_tokens": 300}
    ).json()

    print("=== v1 Response ===")
    print(v1_response)
    print("\n=== v2 Response ===")
    print(v2_response)

# Test
test_both_versions("Analyze: Pikachu VMAX - Listed $120, Fair Value $95")
```

### Success Metrics

- **Accuracy**: v2 should provide more accurate pricing analysis
- **Detail**: v2 should give more comprehensive reasoning
- **Consistency**: v2 should be more consistent across similar cards
- **Loss**: v2 final loss < 0.150 vs v1's 0.170

## Troubleshooting

### Out of Memory

Reduce batch size:
```python
BATCH_SIZE = 2
GRADIENT_ACCUMULATION = 8
```

### Slow Training

Check GPU utilization:
```bash
nvidia-smi -l 1
```

### Authentication Errors

Verify HuggingFace token:
```bash
echo $HUGGINGFACE_TOKEN
huggingface-cli whoami
```

## Cost Breakdown

### RunPod RTX 4090

| Item | Cost |
|------|------|
| GPU Time (10 hours) | $3.40 |
| Storage (50GB x 10 hours) | $0.05 |
| **Total** | **~$3.45** |

*Note: Actual cost may vary based on training time and region*

### Alternative: Lambda Labs

| Item | Cost |
|------|------|
| RTX 4090 (10 hours) | $5.50 |
| **Total** | **~$5.50** |

## Results & Evaluation

After training completes:

1. **Review Loss Curve**: Should show steady decrease to < 0.150
2. **Test on Validation Examples**: Compare v1 vs v2 outputs
3. **Production Testing**: Deploy and monitor real-world performance
4. **Update Documentation**: Record final metrics and learnings

## Next Steps

1. ✅ Dataset uploaded to HuggingFace
2. 🚀 **Launch training on RunPod** (8-12 hours)
3. ⏳ Monitor training progress
4. ✅ Test trained model
5. 🚀 Deploy v2 to Modal Labs
6. 📊 A/B test v1 vs v2
7. 📈 Update production if v2 outperforms

---

**Questions?** Open an issue on [GitHub](https://github.com/ChicoPanama/PokeDao/issues)

**Last Updated**: 2025-10-12
