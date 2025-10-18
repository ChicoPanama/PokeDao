# Mew-1A v2 Retraining Status & Next Steps

**Last Updated**: 2025-10-17
**Current Status**: 🟡 Ready to Upload & Train
**Last Action**: You started RunPod instance

---

## 📊 Current State Summary

### ✅ **Completed Steps**

1. **Data Consolidation**: ✅ COMPLETE
   - 355,000+ records consolidated into PostgreSQL
   - Sources: eBay, Collector Crypt, TCGPlayer, JustTCG, Official Pokemon

2. **Training Data Extraction**: ✅ COMPLETE
   - **40,328 training examples** generated and saved
   - File: `/Users/arcadio/dev/pokedao/data/training/mew1a-v2-training-data.jsonl`
   - Size: 24 MB
   - Categories:
     - Arbitrage Detection
     - Liquidity Analysis
     - Price Trend Analysis
     - Multi-Source Consensus
     - Condition/Grade Adjustments

3. **Training Scripts**: ✅ COMPLETE
   - RunPod setup script: `scripts/runpod-setup-mew1a-v2.sh`
   - Training script: `scripts/mew1a-train-v2.py`
   - Upload script: `scripts/mew1a-upload-to-huggingface-v2.py`

4. **RunPod Instance**: 🟢 ACTIVE
   - You mentioned: "Ok I started the runpod"
   - Recommended GPU: RTX 4090 (24GB VRAM)
   - Cost: ~$0.34/hour (~$20-30 for full training)

---

## 🎯 Next Steps (In Order)

### **Step 1: Upload Training Dataset to HuggingFace** (5 minutes)

This makes the dataset accessible from your RunPod instance.

```bash
# On your local machine (/Users/arcadio/dev/pokedao)
cd /Users/arcadio/dev/pokedao

# Set your HuggingFace token
export HUGGINGFACE_TOKEN=your_token_here

# Upload dataset
python3 scripts/mew1a-upload-to-huggingface-v2.py
```

**Expected Output**:
- Dataset uploaded to: `ChicoPanama/mew1a-v2-pokemon-tcg-pricing`
- Will show category distribution and stats
- Confirmation: "✅ UPLOAD COMPLETE!"

---

### **Step 2: Set Up RunPod Instance** (10 minutes)

SSH into your RunPod instance and run the setup script.

```bash
# SSH into your RunPod instance (use their SSH command from the dashboard)
ssh root@<your-runpod-ip> -p <port> -i ~/.ssh/id_ed25519

# Once inside RunPod, run setup script
cd /workspace
bash <(curl -s https://raw.githubusercontent.com/ChicoPanama/PokeDao/main/scripts/runpod-setup-mew1a-v2.sh)

# Or if the script isn't pushed to GitHub yet, manually set up:
pip install transformers>=4.36.0 datasets accelerate peft bitsandbytes scipy huggingface_hub
mkdir -p /workspace/mew1a-v2
cd /workspace/mew1a-v2
```

**Then copy your training script to RunPod**:

```bash
# On your local machine, copy training script to RunPod
scp -P <port> -i ~/.ssh/id_ed25519 \
  /Users/arcadio/dev/pokedao/scripts/mew1a-train-v2.py \
  root@<your-runpod-ip>:/workspace/mew1a-v2/
```

---

### **Step 3: Start Training on RunPod** (8-12 hours)

```bash
# On RunPod instance
cd /workspace/mew1a-v2

# Set HuggingFace token
export HUGGINGFACE_TOKEN=your_token_here

# Start training (will run for 8-12 hours)
python3 mew1a-train-v2.py 2>&1 | tee training.log

# Or run in background with nohup
nohup python3 mew1a-train-v2.py > training.log 2>&1 &

# Monitor progress in real-time
tail -f training.log
```

**Training Configuration**:
- Base Model: `meta-llama/Llama-3.2-3B-Instruct`
- Training Examples: 40,328 (4x more than v1)
- Epochs: 3
- Batch Size: 4 (effective: 16 with gradient accumulation)
- Learning Rate: 2e-4
- Expected Time: 8-12 hours on RTX 4090
- Expected Final Loss: < 0.150 (vs v1's 0.170)

**What to Monitor**:
```
Epoch 1/3: Loss should start around ~0.180 and decrease
Epoch 2/3: Loss should be around ~0.160
Epoch 3/3: Loss should reach < 0.150 (target)
```

---

### **Step 4: Test Trained Model** (5 minutes)

After training completes:

```bash
# On RunPod instance
cd /workspace/mew1a-v2

# Quick test
cat > test.py << 'EOF'
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

print("Loading model...")
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)
model = PeftModel.from_pretrained(base_model, "./mew1a-v2-output")
tokenizer = AutoTokenizer.from_pretrained("./mew1a-v2-output")

prompt = """Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
Analyze: Charizard ex - Obsidian Flames. Listed at $45.00, 15 active listings, fair value $52.00

### Response:
"""

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=300, temperature=0.7)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
EOF

python3 test.py
```

**Expected Output**: Should provide a detailed analysis with BUY recommendation, pricing breakdown, and reasoning.

---

### **Step 5: Download Trained Model** (10 minutes)

```bash
# On your local machine
# Download the trained LoRA adapters from RunPod
scp -r -P <port> -i ~/.ssh/id_ed25519 \
  root@<your-runpod-ip>:/workspace/mew1a-v2/mew1a-v2-output \
  /Users/arcadio/dev/pokedao/data/mew1a/

# Or the model will auto-upload to HuggingFace if training completes successfully
# It will be available at: ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing
```

---

### **Step 6: Deploy to Modal Labs** (30 minutes)

After confirming the model works:

```bash
# On your local machine
cd /Users/arcadio/dev/pokedao

# Deploy to Modal
modal deploy scripts/mew1a-deploy-v2-modal.py
```

---

## 📝 Quick Reference Commands

### Check RunPod Training Status
```bash
# SSH into RunPod
ssh root@<your-runpod-ip> -p <port> -i ~/.ssh/id_ed25519

# Check if training is running
ps aux | grep python

# Monitor live progress
tail -f /workspace/mew1a-v2/training.log

# Check GPU usage
nvidia-smi -l 1
```

### If Training Gets Interrupted
```bash
# Training will auto-save checkpoints every 500 steps
# Resume from checkpoint:
python3 mew1a-train-v2.py --resume_from_checkpoint ./mew1a-v2-output/checkpoint-<step>
```

---

## 📊 Expected Results

### **Mew-1A v1 vs v2 Comparison**

| Metric | v1 | v2 (Expected) | Improvement |
|--------|----|--------------|-----------|
| **Training Examples** | 10,000 | 40,328 | **4x** |
| **Data Sources** | 2 | 5 | **2.5x** |
| **Final Loss** | 0.170 | < 0.150 | **12%+ better** |
| **Training Time** | 76 min | 8-12 hours | Longer due to 4x data |
| **Training Cost** | ~$4 | ~$20-30 | More expensive but better |

### **Expected Capabilities (New in v2)**

1. ✅ **Cross-marketplace arbitrage detection** (eBay vs Collector Crypt vs TCGPlayer)
2. ✅ **Better liquidity analysis** (market depth, sales velocity)
3. ✅ **Price trend understanding** (rising/falling/stable patterns)
4. ✅ **Condition/grade premium calculations** (PSA 10 vs PSA 9 vs raw)
5. ✅ **Multi-source consensus pricing** (fair value from 5 sources)

---

## 🚨 Troubleshooting

### Issue: "CUDA out of memory"
**Solution**: Reduce batch size in training script
```python
BATCH_SIZE = 2  # Instead of 4
GRADIENT_ACCUMULATION = 8  # Instead of 4
```

### Issue: "HuggingFace authentication failed"
**Solution**: Set token correctly
```bash
export HUGGINGFACE_TOKEN=hf_your_token_here
huggingface-cli whoami  # Verify it works
```

### Issue: "Dataset not found on HuggingFace"
**Solution**: Upload dataset first (Step 1 above)
```bash
python3 scripts/mew1a-upload-to-huggingface-v2.py
```

---

## 💰 Cost Estimate

- **RunPod RTX 4090**: $0.34/hour
- **Training Time**: 8-12 hours
- **Total Cost**: ~$20-30
- **Storage**: Minimal (~500MB model)
- **Break-even**: < 1 week (from improved arbitrage detection)

---

## 📚 Additional Files Created

- **Optimization Plan**: `/Users/arcadio/dev/pokedao/MEW1A-DATA-OPTIMIZATION-PLAN.md`
- **Training Guide**: `/Users/arcadio/dev/pokedao/MEW1A-V2-TRAINING-GUIDE.md`
- **Training Data**: `/Users/arcadio/dev/pokedao/data/training/mew1a-v2-training-data.jsonl`
- **Extraction Script**: `/Users/arcadio/dev/pokedao/scripts/mew1a-extract-training-data.ts`
- **Upload Script**: `/Users/arcadio/dev/pokedao/scripts/mew1a-upload-to-huggingface-v2.py`
- **Training Script**: `/Users/arcadio/dev/pokedao/scripts/mew1a-train-v2.py`
- **RunPod Setup**: `/Users/arcadio/dev/pokedao/scripts/runpod-setup-mew1a-v2.sh`

---

## ✅ Ready to Proceed?

**IMMEDIATE NEXT ACTION**: Upload dataset to HuggingFace

```bash
cd /Users/arcadio/dev/pokedao
export HUGGINGFACE_TOKEN=your_token_here
python3 scripts/mew1a-upload-to-huggingface-v2.py
```

Once that's done, you can start training on your RunPod instance! 🚀
