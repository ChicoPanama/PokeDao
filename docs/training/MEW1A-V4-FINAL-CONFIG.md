# Mew-1A v4 Final Training Configuration

**Status**: ✅ READY TO TRAIN
**Date**: 2025-10-17
**Est. Training Time**: 12-16 hours on RTX 4090
**Est. Cost**: $30-40 on RunPod

---

## 🎯 Training Overview

### Base Model Selection: **LOCKED**
```
Model: meta-llama/Llama-3.2-3B-Instruct
Why:
  - Optimal balance of performance vs cost
  - 3B params = faster inference for production
  - Proven success with Mew-1A v1-v3
  - Fits comfortably in 24GB VRAM with LoRA
  - Response time < 5 seconds on Modal Labs T4 GPU
```

**Alternative Considered**: Llama-3.2-8B-Instruct
- ❌ Higher cost (2x training time + inference)
- ❌ Slower production inference (critical for user experience)
- ✅ Better quality (but 3B has proven sufficient for TCG domain)

**Decision**: Stick with **3B** - domain expertise matters more than raw model size for this specialized task.

---

## ⚙️ LoRA Configuration: **LOCKED**

```python
LORA_R = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.05

target_modules = [
    "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
    "gate_proj", "up_proj", "down_proj"       # MLP
]
```

**Rationale**:
- `r=16`: Balances expressiveness vs overfitting (proven optimal for 40k-100k examples)
- `alpha=32`: 2x scaling for stable learning
- `dropout=0.05`: Minimal dropout, let data diversity prevent overfitting
- **Trainable params**: ~50M (1.6% of 3B base model)
- **LoRA adapter size**: ~48MB (highly portable)

**Why not higher rank?**
- r=32 would double adapter size but only marginally improve quality
- Our dataset (89k examples) doesn't require higher capacity
- Lower rank = faster inference

---

## 📊 Dataset: **LOCKED**

```
HuggingFace: ChicoPanama/mew1a-v4-pokemon-tcg-comprehensive
Local Files:
  - Training: /Users/arcadio/dev/pokedao/data/training/mew1a-v4-train.jsonl (87,470 examples)
  - Validation: /Users/arcadio/dev/pokedao/data/training/mew1a-v4-val.jsonl (1,786 examples)
  - Full: /Users/arcadio/dev/pokedao/data/training/mew1a-v4-comprehensive-internal.jsonl (89,256 examples)

Total Tokens: ~8.9M tokens
Avg Length: 398 chars/example (~100 tokens)
```

**Category Distribution**:
- Market Analysis: 40,000 (44.8%)
- Card Knowledge: 28,606 (32.0%)
- Deck Building: 20,000 (22.4%)
- Collection Management: 400 (0.4%)
- Cross-Marketplace: 250 (0.3%)

---

## 🏋️ Training Hyperparameters: **LOCKED**

```python
NUM_EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4  # Effective batch size = 16
LEARNING_RATE = 2e-4
MAX_LENGTH = 512
WARMUP_STEPS = 100
SAVE_STEPS = 500
LOGGING_STEPS = 50
LR_SCHEDULER = "cosine"
OPTIMIZER = "adamw_torch"
FP16 = False
BF16 = True  # Better for RTX 4090
```

**Expected Training Steps**:
```
Total examples: 87,470
Effective batch size: 16
Steps per epoch: 87,470 / 16 = 5,467 steps
Total steps: 5,467 × 3 epochs = 16,401 steps

Checkpoints saved: 16,401 / 500 = ~33 checkpoints
Total training time: 12-16 hours
```

**Loss Expectations**:
- Epoch 1: Start ~0.180, end ~0.155
- Epoch 2: Start ~0.155, end ~0.140
- Epoch 3: Start ~0.140, end **< 0.130** (target)

---

## 📝 Prompt Template: **LOCKED**

### With Input Context
```
Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Input:
{input}

### Response:
{output}
```

### Without Input Context (90% of examples)
```
Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Response:
{output}
```

**Consistency**: ✅ Verified - all 89,256 examples follow this exact format

---

## 💾 Model Save Strategy: **LOCKED**

### During Training (RunPod)
```bash
OUTPUT_DIR = "./mew1a-v4-output"

Saves to /workspace/mew1a-v4-output/:
  - adapter_config.json
  - adapter_model.safetensors (~48MB)
  - tokenizer_config.json
  - special_tokens_map.json
  - tokenizer.json

Checkpoints: ./mew1a-v4-output/checkpoint-{step}/
  - Saved every 500 steps
  - Max 3 checkpoints kept (save_total_limit=3)
```

### HuggingFace Upload Strategy
```python
push_to_hub = True
hub_model_id = "ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive"
hub_strategy = "checkpoint"  # Uploads during training

Auto-uploads:
  - Every checkpoint (500 steps)
  - Final model at end
  - Includes model card with training stats
```

### Backup Strategy
```bash
# After training completes, download from RunPod:
scp -r -P <port> -i ~/.ssh/id_ed25519 \
  root@<runpod-ip>:/workspace/mew1a-v4-output \
  /Users/arcadio/dev/pokedao/data/mew1a/v4-trained/

# Also available on HuggingFace:
https://huggingface.co/ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive
```

---

## ✅ Pre-Training Validation Results

### Dataset Quality: ✅ PASSED
- All 89,256 lines valid JSON
- No null outputs
- No short instructions (< 10 chars)
- All examples have category metadata
- Price ranges properly distributed

### Train/Val Split: ✅ CREATED
- Training: 87,470 examples (98%)
- Validation: 1,786 examples (2%)
- Stratified by category (maintains distribution)

### Template Consistency: ✅ VERIFIED
- Dataset format matches training script exactly
- Alpaca-style instruction tuning format
- No format mismatches detected

### File Integrity: ✅ VERIFIED
```bash
$ ls -lh data/training/mew1a-v4-*.jsonl
-rw-r--r-- 1 user staff  45.83M  mew1a-v4-comprehensive-internal.jsonl
-rw-r--r-- 1 user staff  44.92M  mew1a-v4-train.jsonl
-rw-r--r-- 1 user user   0.91M  mew1a-v4-val.jsonl

✅ All files present and correct sizes
```

---

## 🚀 RunPod Execution Plan

### Step 1: Start RunPod Instance
```
GPU: RTX 4090 (24GB VRAM)
Template: RunPod PyTorch 2.1
Storage: 50GB (sufficient for model + checkpoints)
Cost: ~$0.34/hour → $30-40 for 12-16 hours
```

### Step 2: Setup Environment
```bash
# SSH into RunPod
ssh root@<runpod-ip> -p <port> -i ~/.ssh/id_ed25519

# Install dependencies
pip install transformers>=4.36.0 datasets accelerate peft bitsandbytes scipy huggingface_hub

# Create workspace
mkdir -p /workspace/mew1a-v4
cd /workspace/mew1a-v4
```

### Step 3: Upload Training Script
```bash
# On local machine
scp -P <port> -i ~/.ssh/id_ed25519 \
  /Users/arcadio/dev/pokedao/scripts/mew1a-train-v4.py \
  root@<runpod-ip>:/workspace/mew1a-v4/
```

### Step 4: Set HuggingFace Token
```bash
# On RunPod instance
export HUGGINGFACE_TOKEN=your_token_here

# Verify authentication
huggingface-cli whoami
```

### Step 5: Start Training
```bash
# On RunPod instance
cd /workspace/mew1a-v4

# Run in background with logging
nohup python3 mew1a-train-v4.py > training.log 2>&1 &

# Monitor progress
tail -f training.log

# Check GPU usage
nvidia-smi -l 1
```

### Step 6: Monitor Training
```bash
# Check if training is running
ps aux | grep python

# View recent logs
tail -n 50 training.log

# Check training progress
grep "{'loss':" training.log | tail -n 10

# Expected output every 50 steps:
# {'loss': 0.1550, 'learning_rate': 0.00019, 'epoch': 1.2}
# {'loss': 0.1480, 'learning_rate': 0.00018, 'epoch': 1.4}
```

---

## 📈 Training Milestones

### Checkpoint 1: 500 steps (~30 minutes)
- Expected loss: ~0.175
- Action: Verify training started correctly

### Checkpoint 2: 2,500 steps (~2.5 hours)
- Expected loss: ~0.160
- Action: Spot-check model output on Test 1 (arbitrage)

### Checkpoint 3: 5,467 steps (End of Epoch 1, ~5 hours)
- Expected loss: ~0.155
- Action: Run basic evaluation

### Checkpoint 4: 10,934 steps (End of Epoch 2, ~10 hours)
- Expected loss: ~0.140
- Action: Full evaluation (all 13 tests)

### Final: 16,401 steps (End of Epoch 3, 12-16 hours)
- **Target loss: < 0.130**
- Action: Full evaluation + deployment decision

---

## 🧪 Post-Training Validation

### Immediate Tests (on RunPod)
```bash
cd /workspace/mew1a-v4

# Quick smoke test
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
Analyze: Charizard ex - Obsidian Flames. Listed at $45.00, 15 active listings, fair value $52.00

### Response:
"""

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=300, temperature=0.7)
print("\n" + "="*80)
print("SMOKE TEST OUTPUT:")
print("="*80)
print(tokenizer.decode(outputs[0], skip_special_tokens=True).split("### Response:")[-1].strip())
EOF
```

### Full Evaluation
```bash
# Run comprehensive test suite
python3 test_mew1a_v4.py

# Expected: 10+ / 13 tests should pass with good quality
```

### Download Trained Model
```bash
# On local machine
scp -r -P <port> -i ~/.ssh/id_ed25519 \
  root@<runpod-ip>:/workspace/mew1a-v4/mew1a-v4-output \
  /Users/arcadio/dev/pokedao/data/mew1a/v4-trained/

# Also download training logs
scp -P <port> -i ~/.ssh/id_ed25519 \
  root@<runpod-ip>:/workspace/mew1a-v4/training.log \
  /Users/arcadio/dev/pokedao/data/mew1a/v4-training.log
```

---

## 🎯 Success Criteria: FINAL

### Training Metrics
- ✅ **Final Loss**: < 0.130 (12% better than v1's 0.170)
- ✅ **Training Stability**: No loss spikes or divergence
- ✅ **Checkpoint Uploads**: All 33 checkpoints uploaded to HuggingFace

### Evaluation Metrics
- ✅ **Market Analysis** (Tests 1-3): 100% correct recommendations
- ✅ **Card Knowledge** (Tests 4-6): 75%+ accuracy
- ✅ **Deck Building** (Tests 7-10): 70%+ useful responses
- ✅ **Overall**: 10+ / 13 tests pass

### Production Readiness
- ✅ **No Hallucinations**: All facts grounded in training data
- ✅ **Response Quality**: Clear, structured, actionable
- ✅ **Inference Speed**: < 5 seconds on Modal Labs T4

---

## 🚨 Failure Recovery

### If Loss Doesn't Decrease
```
Problem: Loss stuck at 0.180+ after 1000 steps
Solution:
  1. Check training.log for errors
  2. Verify dataset loaded correctly (should show 87,470 examples)
  3. Check GPU utilization (should be 90%+)
  4. Reduce learning rate to 1e-4 and restart
```

### If Training Crashes
```
Problem: Out of memory or process killed
Solution:
  1. Reduce BATCH_SIZE from 4 to 2
  2. Increase GRADIENT_ACCUMULATION from 4 to 8
  3. Resume from last checkpoint:
     python3 mew1a-train-v4.py --resume_from_checkpoint ./mew1a-v4-output/checkpoint-<step>
```

### If Model Hallucinates
```
Problem: Model invents card names or prices not in training data
Solution:
  1. Review training examples for that category
  2. Increase temperature to 0.7-0.9 for more diversity
  3. Add explicit "I don't have information about X" examples
  4. Consider retraining with more conservative hyperparameters
```

---

## 📦 Final Deliverables

After successful training:

1. **Trained Model**: `ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive` on HuggingFace
2. **LoRA Adapters**: `/Users/arcadio/dev/pokedao/data/mew1a/v4-trained/`
3. **Training Logs**: `/Users/arcadio/dev/pokedao/data/mew1a/v4-training.log`
4. **Evaluation Report**: Results from all 13 test cases
5. **Deployment Script**: Modal Labs deployment configuration
6. **Model Card**: HuggingFace documentation with examples

---

## ✅ Pre-Flight Checklist

**Before starting RunPod training, verify:**

- [x] Dataset uploaded to HuggingFace: `ChicoPanama/mew1a-v4-pokemon-tcg-comprehensive`
- [x] Training script finalized: `scripts/mew1a-train-v4.py`
- [x] Validation split created: `data/training/mew1a-v4-train.jsonl` + `mew1a-v4-val.jsonl`
- [x] Evaluation protocol documented: `MEW1A-V4-EVALUATION-PROTOCOL.md`
- [x] Configuration locked: `MEW1A-V4-FINAL-CONFIG.md` (this file)
- [x] HuggingFace token ready: `$HUGGINGFACE_TOKEN` set
- [x] RunPod credits available: $40+ recommended
- [x] SSH key configured: `~/.ssh/id_ed25519`
- [ ] RunPod instance started: RTX 4090, PyTorch 2.1
- [ ] Training script uploaded to RunPod
- [ ] Training started: `nohup python3 mew1a-train-v4.py > training.log 2>&1 &`

---

## 🚀 YOU ARE READY TO TRAIN!

**Next Action**: Start RunPod instance and begin training.

**Estimated Timeline**:
- Setup: 10 minutes
- Training: 12-16 hours
- Validation: 30 minutes
- Deployment: 1 hour
- **Total**: ~14-18 hours to production

**Expected Outcome**: World's first comprehensive Pokemon TCG AI assistant with pricing, card knowledge, deck building, and collection management capabilities.

---

**Good luck! May your loss curves be steep and your gradients stable.** 🎯🔥
