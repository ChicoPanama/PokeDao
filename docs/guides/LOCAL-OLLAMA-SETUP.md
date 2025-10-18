# 🏠 Local Ollama Setup for Mew-1A

Run Mew-1A locally on your Mac with **zero cloud costs**! Perfect for development, testing, and experimentation.

---

## 🎯 Why Local Ollama?

**Benefits:**
- ✅ **Zero cost** - No Modal/cloud fees during development
- ✅ **Faster iteration** - Instant model updates, no deployment needed
- ✅ **Privacy** - All data stays on your Mac
- ✅ **Offline** - Works without internet after setup
- ✅ **Testing** - Perfect for evaluation framework

**Trade-offs:**
- ❌ Slower inference than GPU (3-5s vs 1-2s on Modal T4)
- ❌ Requires model download (~2.5 GB)
- ❌ Mac only supports CPU inference (no GPU acceleration)

---

## 📋 Prerequisites

### 1. Install Ollama

```bash
# Download from website
open https://ollama.ai

# Or use Homebrew
brew install ollama
```

**Verify installation:**
```bash
ollama --version
# Should show: ollama version is 0.1.x or higher
```

### 2. Start Ollama Server

```bash
# Start Ollama server (runs in background)
ollama serve

# Or if using app:
# Open Ollama.app from Applications
```

**Verify server:**
```bash
curl http://localhost:11434/api/version
# Should return: {"version":"0.1.x"}
```

---

## 🚀 Setup Mew-1A v4.2 on Ollama

### Option 1: After v4.2 Training (Recommended)

When v4.2 training completes, convert and install:

```bash
# Step 1: Convert to GGUF format
python3 scripts/convert-to-gguf.py --model v4.2 --quant Q4_K_M

# This will:
# - Download merged v4.2 model from HuggingFace
# - Convert to GGUF format
# - Quantize to Q4_K_M (2.5 GB, recommended)
# - Create Ollama model "mew1a:v42-q4_k_m"

# Step 2: Test it
ollama run mew1a:v42-q4_k_m "Analyze: Charizard ex from Obsidian Flames listed at $45, fair value $52"
```

**Quantization options:**
- `Q2_K` - 1.5 GB (smallest, lowest quality)
- `Q3_K_M` - 2.0 GB (small, good quality)
- **`Q4_K_M`** - 2.5 GB (recommended - best balance)
- `Q5_K_M` - 3.0 GB (large, excellent quality)
- `Q6_K` - 3.5 GB (very large, near-original)
- `Q8_0` - 4.0 GB (largest, highest quality)

---

### Option 2: Use Existing v1 (Limited)

Note: v1 is LoRA-only and needs merging first. Wait for v4.2 or manually merge v1.

---

## 🧪 Testing Your Local Model

### Quick Test

```bash
ollama run mew1a:v42-q4_k_m
# Interactive chat mode
# Type your questions, press Ctrl+D to exit
```

### Test with Examples

```bash
# BUY recommendation (good discount)
ollama run mew1a:v42-q4_k_m "Analyze: Charizard ex - Listed $45, fair value $52"

# PASS recommendation (overpriced)
ollama run mew1a:v42-q4_k_m "Should I buy Pikachu VMAX at $120 when fair value is $95?"

# Market analysis
ollama run mew1a:v42-q4_k_m "What cards from Paldea Evolved are good investments?"
```

### Test with Web UI

```bash
# Start local web server
cd apps/mew1a-chat
python3 -m http.server 8000

# Open in browser
open http://localhost:8000

# Select "Local (Ollama)" in the UI
# Start chatting with Mew-1A!
```

---

## 📊 Run Evaluation Framework

### Evaluate Local Model

```bash
pnpm tsx scripts/evaluate-mew1a.ts --model local-ollama
```

**Expected output:**
```
===============================================================================
EVALUATING LOCAL-OLLAMA
===============================================================================

Test: Strong BUY - Charizard ex (13% discount)
✓ Recommendation: BUY (3.2s)

Test: Clear PASS - Pikachu VMAX (overpriced 26%)
✓ Recommendation: PASS (2.8s)

...

===============================================================================
EVALUATION SUMMARY
===============================================================================

LOCAL-OLLAMA
  Accuracy: 5/5 (100.0%)
  Avg Inference Time: 3.1s
```

### Compare Local vs Cloud

```bash
# Compare local Ollama vs v4.2 vLLM
pnpm tsx scripts/evaluate-mew1a.ts --compare local-ollama v4.2-vllm
```

**Expected comparison:**
```
| Metric | local-ollama | v4.2-vllm |
|--------|--------------|-----------|
| Accuracy | 100.0% | 100.0% |
| Avg Time | 3.1s | 1.5s |
| Tokens/sec | 25.0 | 60.0 |
```

### Benchmark Performance

```bash
# Run 10 iterations to measure performance
pnpm tsx scripts/evaluate-mew1a.ts --benchmark --model local-ollama
```

---

## 💻 Using in Code

### TypeScript/JavaScript

```typescript
// Using fetch
async function analyzeCard(cardName: string, price: number, fairValue: number) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mew1a:v42-q4_k_m',
      prompt: `Analyze: ${cardName} - Listed $${price}, fair value $${fairValue}`,
      stream: false
    })
  });

  const data = await response.json();
  return data.response;
}

// Example usage
const analysis = await analyzeCard('Charizard ex', 45, 52);
console.log(analysis);
```

### Python

```python
import requests

def analyze_card(card_name, price, fair_value):
    response = requests.post('http://localhost:11434/api/generate', json={
        'model': 'mew1a:v42-q4_k_m',
        'prompt': f'Analyze: {card_name} - Listed ${price}, fair value ${fair_value}',
        'stream': False
    })
    return response.json()['response']

# Example usage
analysis = analyze_card('Charizard ex', 45, 52)
print(analysis)
```

### cURL

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "mew1a:v42-q4_k_m",
  "prompt": "Analyze: Charizard ex - Listed $45, fair value $52",
  "stream": false
}'
```

---

## 🔧 Management Commands

### List Models

```bash
ollama list
# Shows all installed models
```

### Delete Model

```bash
ollama rm mew1a:v42-q4_k_m
```

### Update Model

```bash
# Re-run conversion script with new model
python3 scripts/convert-to-gguf.py --model v4.2 --quant Q4_K_M
```

### Check Model Info

```bash
ollama show mew1a:v42-q4_k_m
# Shows model details, parameters, template
```

---

## 🎨 NanoChat Web UI

### Start Chat Interface

1. **Start Ollama server:**
   ```bash
   ollama serve
   ```

2. **Start web server:**
   ```bash
   cd apps/mew1a-chat
   python3 -m http.server 8000
   ```

3. **Open browser:**
   ```bash
   open http://localhost:8000
   ```

4. **Select "Local (Ollama)"** in the model selector

5. **Start chatting!**

**Features:**
- 💬 Chat interface with conversation history
- 🔄 Switch between Local (Ollama), v1 Cloud, and v4.2 Cloud
- 📊 See inference times and recommendations
- 🎯 Example prompts to get started
- 🎨 Beautiful gradient UI

---

## 📈 Performance Tips

### Optimize Quantization

**Trade-off**: Size vs Quality vs Speed

```bash
# Fastest (lowest quality) - 1.5 GB
python3 scripts/convert-to-gguf.py --model v4.2 --quant Q2_K

# Balanced (recommended) - 2.5 GB
python3 scripts/convert-to-gguf.py --model v4.2 --quant Q4_K_M

# Best quality (slowest) - 4.0 GB
python3 scripts/convert-to-gguf.py --model v4.2 --quant Q8_0
```

### Mac Performance

**M1/M2/M3 Macs:**
- Inference: ~3-5s per request
- Uses CPU + Neural Engine
- 8GB RAM minimum, 16GB recommended

**Intel Macs:**
- Inference: ~5-10s per request
- CPU only
- 16GB RAM recommended

---

## 🔄 Workflow: Local Dev → Cloud Deploy

Perfect development workflow:

1. **Local Testing** (Ollama)
   - Test model responses
   - Run evaluation framework
   - Iterate on prompts
   - Zero cloud costs

2. **Deploy to Cloud** (Modal)
   - Run `./scripts/deploy-v4.2.sh`
   - Get 2-3x faster GPU inference
   - Production-ready endpoint
   - Pay-per-use pricing

3. **Compare Results**
   ```bash
   pnpm tsx scripts/evaluate-mew1a.ts --compare local-ollama v4.2-vllm
   ```

---

## 🐛 Troubleshooting

### "Cannot connect to Ollama server"

**Solution:**
```bash
# Check if server is running
ps aux | grep ollama

# If not running, start it
ollama serve

# Or restart Ollama app
killall Ollama && open -a Ollama
```

### "Model not found"

**Solution:**
```bash
# List installed models
ollama list

# If mew1a not listed, run conversion
python3 scripts/convert-to-gguf.py --model v4.2 --quant Q4_K_M
```

### "Slow inference (>10s)"

**Solutions:**
1. Use smaller quantization: Q2_K or Q3_K_M
2. Close memory-intensive apps
3. Restart Ollama server
4. Use cloud deployment for production

### "GGUF conversion fails"

**Solution:**
```bash
# Install llama.cpp
git clone https://github.com/ggerganov/llama.cpp ~/llama.cpp
cd ~/llama.cpp
make

# Install Python deps
pip install transformers huggingface-hub sentencepiece

# Try conversion again
python3 scripts/convert-to-gguf.py --model v4.2 --quant Q4_K_M
```

---

## 📊 Cost Comparison

| Deployment | Inference Time | Cost per Request | Use Case |
|------------|----------------|------------------|----------|
| **Local Ollama** | 3-5s | $0 | Development, testing, experimentation |
| **v1 Modal** | 3-7s | $0.0005 | Production (current) |
| **v4.2 vLLM** | 1-2s | $0.0003 | Production (future, 2-3x faster) |

**When to use Local:**
- ✅ Development and testing
- ✅ Evaluation framework
- ✅ Learning card knowledge
- ✅ Iterating on prompts

**When to use Cloud:**
- ✅ Production API
- ✅ High throughput
- ✅ Need fast inference (<2s)
- ✅ Multiple concurrent users

---

## 🎯 Quick Start Checklist

- [ ] Install Ollama (`brew install ollama`)
- [ ] Start Ollama server (`ollama serve`)
- [ ] Wait for v4.2 training to complete
- [ ] Convert model (`python3 scripts/convert-to-gguf.py --model v4.2`)
- [ ] Test model (`ollama run mew1a:v42-q4_k_m`)
- [ ] Open web UI (`cd apps/mew1a-chat && python3 -m http.server 8000`)
- [ ] Run evaluation (`pnpm tsx scripts/evaluate-mew1a.ts --model local-ollama`)
- [ ] Compare with cloud (`pnpm tsx scripts/evaluate-mew1a.ts --compare local-ollama v4.2-vllm`)

---

**Status**: ✅ Ready to use once v4.2 training completes
**Next**: Convert v4.2 model to GGUF and start testing locally!
