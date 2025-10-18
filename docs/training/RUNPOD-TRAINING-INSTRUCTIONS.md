# MEW-1A v4.2 ULTIMATE - RunPod Training Instructions

## 🚀 Quick Start

### 1. Launch RunPod Instance

**GPU**: RTX 4090 (24GB VRAM) - $0.44/hour
**Template**: RunPod Pytorch 2.0.1
**Container Disk**: 50GB
**Volume**: 100GB (recommended for checkpoints)

### 2. Setup Environment

```bash
# Connect via SSH or web terminal
# Install dependencies
pip install transformers datasets peft accelerate wandb bitsandbytes

# Set HuggingFace token
export HUGGINGFACE_TOKEN=YOUR_HUGGINGFACE_TOKEN

# Login to wandb (optional but recommended for tracking)
wandb login
```

### 3. Download Training Script

```bash
# Create working directory
mkdir -p ~/mew1a-training
cd ~/mew1a-training

# Download training script
wget https://raw.githubusercontent.com/YOUR_REPO/main/scripts/mew1a-train-v4.2.py

# Or copy the script from your local machine
```

### 4. Start Training

```bash
# Run training
python3 mew1a-train-v4.2.py 2>&1 | tee training.log
```

## 📊 Training Specifications

**Dataset**: ChicoPanama/mew1a-v4.2-pokemon-tcg-ultimate-complete
- Total examples: 509,746
- Temporal data: 84.8% (432,107 with dates)
- Categories: Market analysis (85.6%), Card knowledge (7.4%), Reddit sentiment (4.7%)

**Model**: Llama-3.2-3B-Instruct
- Base: meta-llama/Llama-3.2-3B-Instruct
- Adapter: LoRA (r=16, alpha=32)
- Precision: bfloat16 (optimal for RTX 4090)

**Training Config**:
- Epochs: 3
- Batch size: 4 per device
- Gradient accumulation: 8 (effective batch = 32)
- Learning rate: 2e-4
- Scheduler: Cosine with warmup
- Estimated time: 18-24 hours on RTX 4090

## 💰 Cost Estimate

**RTX 4090**: $0.44/hour × 24 hours = **$10.56**

Compared to:
- A100 40GB: $1.89/hour × 12 hours = $22.68 (faster but more expensive)
- RTX 3090: $0.29/hour × 36 hours = $10.44 (cheaper but slower)

**RTX 4090 is optimal** - best performance/cost ratio for this model size.

## 📈 Monitoring Progress

### WandB Dashboard
Training metrics are logged to Weights & Biases:
```
https://wandb.ai/YOUR_USERNAME/mew1a-v4.2-ultimate
```

### Local Logs
```bash
# Monitor training in real-time
tail -f training.log

# Check GPU usage
nvidia-smi -l 1

# Check disk usage
df -h
```

### Expected Output
```
Step 1000/47,795 | Loss: 0.85 | LR: 0.00019
Step 2000/47,795 | Loss: 0.62 | LR: 0.00018
Step 3000/47,795 | Loss: 0.45 | LR: 0.00017
...
Final Loss: ~0.17 (target)
```

## 💾 Checkpoints

Checkpoints are saved every 1,000 steps to:
```
./mew1a-v4.2-pokemon-tcg-ultimate/checkpoint-{step}/
```

**Storage**: Each checkpoint ~6GB, keeps last 3 checkpoints (18GB total)

## ✅ After Training

### 1. Verify Model Output
```bash
# Final model location
ls -lh mew1a-v4.2-pokemon-tcg-ultimate/final/

# Should see:
# - adapter_config.json
# - adapter_model.safetensors (~48MB)
# - tokenizer files
```

### 2. Test Inference (optional)
```python
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

# Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

# Load LoRA adapters
model = PeftModel.from_pretrained(
    base_model,
    "mew1a-v4.2-pokemon-tcg-ultimate/final",
)

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

# Test
prompt = "What is Charizard worth?"
inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_length=200)
print(tokenizer.decode(outputs[0]))
```

### 3. Upload Complete
The script automatically uploads to HuggingFace:
```
ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate
```

## 🔧 Troubleshooting

### Out of Memory (OOM)
```bash
# Reduce batch size in script (line ~145)
per_device_train_batch_size=2  # Instead of 4
gradient_accumulation_steps=16  # Instead of 8 (keep effective batch = 32)
```

### Slow Training
```bash
# Enable flash attention (if available)
pip install flash-attn --no-build-isolation

# Add to model loading:
model = AutoModelForCausalLM.from_pretrained(
    ...,
    attn_implementation="flash_attention_2",  # Add this
)
```

### Dataset Download Issues
```bash
# Pre-download dataset
from datasets import load_dataset
dataset = load_dataset("ChicoPanama/mew1a-v4.2-pokemon-tcg-ultimate-complete", token=HF_TOKEN)
# Then run training script
```

## 📞 Support

If training fails or you need help:
1. Check `training.log` for errors
2. Verify GPU is detected: `nvidia-smi`
3. Check disk space: `df -h`
4. Review WandB dashboard for anomalies

## 🎯 Next Steps After Training

1. **Deploy to Modal Labs** - See `modal-deploy-v4.2.py`
2. **A/B Test vs v4.1** - Compare performance
3. **Production Integration** - Update PokeDAO API

---

**Dataset**: https://huggingface.co/datasets/ChicoPanama/mew1a-v4.2-pokemon-tcg-ultimate-complete
**Training Time**: 18-24 hours
**Cost**: ~$10.56 on RTX 4090
**Output**: Production-ready Pokemon TCG AI 🚀
