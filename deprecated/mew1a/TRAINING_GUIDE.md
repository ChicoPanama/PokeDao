# Project Mew-1A: Training Guide

Complete guide to fine-tuning Llama-3.2-3B for Pokemon TCG pricing analysis.

## ✅ What We Have

- ✅ **Training Dataset**: 10,000 examples uploaded to HuggingFace
- ✅ **Dataset URL**: https://huggingface.co/datasets/ChicoPanama/pokedao-mew1a-training-data-layered
- ✅ **TCG Tier System**: 6-tier classification (SECRET RARE → COMMON)
- ✅ **Data Quality**: Extracted from 116,744 market listings
- ✅ **Training Script**: `apps/mew1a/train-mew1a.py` (ready to run)

## 🎯 Training Options

You have **3 options** for fine-tuning:

### Option 1: HuggingFace AutoTrain (Easiest, Paid)

**Best for**: Quick deployment, no GPU needed

**Steps**:
1. Go to https://huggingface.co/autotrain
2. Click "Create New Project" → "LLM Fine-tuning"
3. Select dataset: `ChicoPanama/pokedao-mew1a-training-data-layered`
4. Choose base model: `meta-llama/Llama-3.2-3B-Instruct`
5. Configure parameters:
   ```yaml
   Learning Rate: 2e-4
   Epochs: 3
   Batch Size: 4
   LoRA Rank: 8
   LoRA Alpha: 16
   ```
6. Click "Train" (~$20-30, 2-4 hours)
7. Model auto-deploys to HuggingFace

**Pros**:
- ✅ Zero setup required
- ✅ Automatic deployment
- ✅ Built-in monitoring
- ✅ No GPU needed locally

**Cons**:
- ❌ Costs ~$20-30
- ❌ Less control over training
- ❌ Proprietary platform

---

### Option 2: Local Training (Free, Requires GPU)

**Best for**: Full control, free training

**Requirements**:
- GPU with 16GB+ VRAM (RTX 4090, A100, etc.)
- OR use Google Colab Pro (~$10/month)
- OR rent GPU (RunPod, Lambda Labs ~$0.50/hr)

**Steps**:

1. **Install dependencies**:
   ```bash
   pip3 install torch transformers datasets peft accelerate bitsandbytes trl
   ```

2. **Request Llama access**:
   - Go to https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
   - Click "Request Access" (approval takes 1-2 hours)

3. **Set HuggingFace token**:
   ```bash
   export HUGGINGFACE_TOKEN=your_huggingface_token_here
   ```

4. **Run training**:
   ```bash
   python3 apps/mew1a/train-mew1a.py
   ```

5. **Monitor progress**:
   - Training takes ~2-4 hours on RTX 4090
   - Model saves to `./mew1a-model`
   - Auto-uploads to HuggingFace

**Pros**:
- ✅ Free (if you have GPU)
- ✅ Full control
- ✅ Can customize everything
- ✅ Learn how it works

**Cons**:
- ❌ Requires GPU
- ❌ More complex setup
- ❌ Manual deployment

---

### Option 3: Cloud GPU Training (Recommended)

**Best for**: Balance of cost & control

**Platforms**:
1. **RunPod** (cheapest): ~$0.34/hr for RTX 4090
2. **Google Colab Pro**: $10/month for unlimited GPU
3. **Lambda Labs**: ~$1.10/hr for A100

**Steps** (using RunPod):

1. **Create RunPod account**: https://runpod.io
2. **Launch GPU pod**:
   - Template: "PyTorch 2.0"
   - GPU: RTX 4090 (40GB VRAM)
   - Storage: 50GB

3. **Clone repo in pod**:
   ```bash
   git clone https://github.com/ChicoPanama/PokeDao
   cd PokeDao
   ```

4. **Install dependencies**:
   ```bash
   pip install torch transformers datasets peft accelerate bitsandbytes trl
   ```

5. **Run training**:
   ```bash
   export HUGGINGFACE_TOKEN=your_huggingface_token_here
   python3 apps/mew1a/train-mew1a.py
   ```

6. **Stop pod** when done to save money

**Pros**:
- ✅ Pay-per-use (~$1-2 total cost)
- ✅ Full control
- ✅ High-end GPUs
- ✅ Easy to scale

**Cons**:
- ❌ Need to manage cloud instance
- ❌ Manual deployment

---

## 📊 Training Parameters Explained

```python
LORA_RANK = 8              # Higher = more parameters (8-16 is good)
LORA_ALPHA = 16            # Learning rate multiplier (2x rank)
LORA_DROPOUT = 0.05        # Regularization (5% dropout)
LEARNING_RATE = 2e-4       # How fast to learn
NUM_EPOCHS = 3             # How many passes through data
BATCH_SIZE = 4             # Examples per GPU step
GRADIENT_ACCUMULATION = 4  # Effective batch size = 16
MAX_SEQ_LENGTH = 512       # Max tokens per example
```

**Why LoRA?**
- ✅ Only trains 0.1% of model parameters
- ✅ 10x faster than full fine-tuning
- ✅ Uses 50% less VRAM
- ✅ Preserves base model knowledge

---

## 🚀 After Training

Once training completes, you'll have:

1. **Fine-tuned model**: `./mew1a-model/` (local)
2. **HuggingFace model**: `ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing`
3. **Ready for inference**: Can deploy to API

### Deployment Options

**Option A: HuggingFace Inference API** (Recommended)
```python
from huggingface_hub import InferenceClient

client = InferenceClient(
    model="ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
    token=HUGGINGFACE_TOKEN
)

result = client.text_generation(
    "Analyze this card: Charizard Base Set...",
    max_new_tokens=500
)
```

**Cost**: ~$0.001 per request (very cheap)

**Option B: Self-hosted API**
- Use `vLLM` or `text-generation-inference`
- Deploy to your own server
- Free (but need to manage infrastructure)

**Option C: Replicate.com**
- Upload model to Replicate
- Auto-scaling inference API
- Pay per use (~$0.0023/sec)

---

## 🎓 Expected Results

Based on similar fine-tuning projects:

- **Accuracy**: 85-90% on TCG price tier classification
- **Inference Speed**: <500ms per analysis
- **Model Size**: ~1.5GB (LoRA adapters only)
- **Cost per API call**: $0.001 (HuggingFace) or free (self-hosted)

---

## 🔧 Integration with PokeDAO

After deployment, integrate with AI Ensemble:

```typescript
// api/src/lib/ai-ensemble.ts

async function analyzeListing(listing: MarketListing) {
  // Layer 1: Mew-1A (fast TCG-specialized)
  const mew1a = await callMew1A(listing);

  // Layer 2: DeepSeek R1 (deep reasoning)
  const deepseek = await callDeepSeek(listing);

  // Layer 3: Ensemble vote
  return ensembleDecision([mew1a, deepseek]);
}
```

---

## 📋 Recommended Approach

For PokeDAO, I recommend:

**🥇 Best Choice: Option 3 (RunPod)**
- ✅ Total cost: ~$1-2 for training
- ✅ Full control & customization
- ✅ Learn the process
- ✅ Easy to iterate & improve

**Steps**:
1. Sign up for RunPod (~5 minutes)
2. Launch RTX 4090 pod (~2 minutes)
3. Run training script (~2-4 hours)
4. Deploy to HuggingFace Inference API
5. Integrate with PokeDAO ensemble

**Total time**: ~4 hours
**Total cost**: ~$2

---

## 🆘 Troubleshooting

**"CUDA out of memory"**
- Reduce `BATCH_SIZE` to 2
- Reduce `MAX_SEQ_LENGTH` to 256
- Enable `load_in_8bit` instead of 4bit

**"Cannot access Llama model"**
- Request access: https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
- Wait 1-2 hours for approval
- Check token has "read" access

**"Training is too slow"**
- Use better GPU (RTX 4090 > RTX 3090 > T4)
- Reduce dataset size for testing
- Enable mixed precision (fp16=True)

---

## 📚 Next Steps

1. **Choose training option** (I recommend Option 3: RunPod)
2. **Run training script**: `python3 apps/mew1a/train-mew1a.py`
3. **Test inference**: `python3 apps/mew1a/test-mew1a.py`
4. **Deploy to HuggingFace Inference API**
5. **Integrate with PokeDAO AI Ensemble**

Questions? Check the docs or ask in Discord!

---

**Built with ❤️ for the TCG community**
