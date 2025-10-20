# Mew-1A v4.2 Deployment Guide

**Status**: Training complete ✅ | Uploaded to HuggingFace ✅ | Ready to merge and deploy 🚀

---

## Current Status

✅ **Training Complete**
- Model: Llama-3.2-3B with LoRA adapters
- Training data: 509,746 examples (84.8% temporal data)
- Training time: 3 epochs on RTX 4090
- LoRA adapters uploaded to: `ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate`

⏳ **Next Steps**
1. Merge LoRA adapters with base model
2. Upload merged model to HuggingFace
3. Deploy to Modal with streaming UI
4. Test and benchmark

---

## Step 1: Merge LoRA Adapters on RunPod

**Why**: vLLM works best with merged models (not LoRA adapters). We need to merge the adapters into the base Llama 3.2-3B model.

### On RunPod:

```bash
# 1. Set your HuggingFace token
export HUGGINGFACE_TOKEN=hf_YOUR_TOKEN_HERE

# 2. Copy merge script to RunPod
cat > /workspace/merge-and-upload-v4.2.py << 'ENDPYTHON'
# (paste the contents of scripts/merge-and-upload-v4.2.py)
ENDPYTHON

# 3. Run merge script (takes ~10-15 minutes)
python3 /workspace/merge-and-upload-v4.2.py
```

**What this does**:
1. Loads base model: `meta-llama/Llama-3.2-3B-Instruct`
2. Loads LoRA adapters from `/workspace/mew1a-v4.2/final`
3. Merges adapters into base model
4. Saves merged model to `/workspace/mew1a-v4.2-merged`
5. Uploads to HuggingFace: `ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate-merged`

**Expected output**:
```
================================================================================
MEW-1A V4.2 MODEL MERGER
================================================================================

📦 Loading base model: meta-llama/Llama-3.2-3B-Instruct
✅ Base model loaded
   Parameters: 3,213,364,224

🔧 Loading LoRA adapters from: /workspace/mew1a-v4.2/final
✅ LoRA adapters loaded

🔀 Merging LoRA adapters into base model...
   This may take a few minutes...
✅ Merge complete!

💾 Saving merged model to: /workspace/mew1a-v4.2-merged
✅ Model saved
   Merged model size: 6.3G

📤 Uploading to HuggingFace: ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate-merged
✅ Repository created/verified

📤 Uploading files (this may take 10-15 minutes)...

================================================================================
✅ UPLOAD COMPLETE!
================================================================================

🔗 Model URL: https://huggingface.co/ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate-merged
```

---

## Step 2: Deploy to Modal Labs

**Once merge is complete**, deploy the streaming server:

```bash
# On your local machine

# 1. Ensure Modal is configured
modal profile current

# 2. Deploy streaming server
modal deploy apps/mew1a/vllm_deploy_v4.2_streaming.py
```

**Expected output**:
```
✓ Initialized. View run at https://modal.com/...
✓ Created objects.
├── 🔨 Created mount /Users/arcadio/dev/pokedao/apps/mew1a
├── 🔨 Created Mew1AV42StreamingModel => https://chicopanama--mew1a-vllm-v42-streaming-mew1av42streamingmodel-...
└── 🔨 Created web function health => https://chicopanama--mew1a-vllm-v42-streaming-health.modal.run
    🔨 Created web function stream => https://chicopanama--mew1a-vllm-v42-streaming-stream.modal.run
    🔨 Created web function generate => https://chicopanama--mew1a-vllm-v42-streaming-generate.modal.run

✓ App deployed! 🎉

View Deployment: https://modal.com/apps/ChicoPanama/mew1a-vllm-v4.2-streaming
```

---

## Step 3: Update Streaming UI Endpoints

Update the endpoints in [apps/mew1a-chat/chat.html](apps/mew1a-chat/chat.html):

```javascript
const CONFIG = {
  API_URL: 'https://chicopanama--mew1a-vllm-v42-streaming-stream.modal.run',
  HEALTH_URL: 'https://chicopanama--mew1a-vllm-v42-streaming-health.modal.run',
  HEALTH_CHECK_INTERVAL: 30000,
};
```

And in [ml/src/clients/mew1a-streaming.ts](ml/src/clients/mew1a-streaming.ts):

```typescript
export function createMew1AClient(customConfig?: Partial<StreamingConfig>): Mew1AStreamingClient {
  const defaultConfig: StreamingConfig = {
    streamUrl: 'https://chicopanama--mew1a-vllm-v42-streaming-stream.modal.run',
    healthUrl: 'https://chicopanama--mew1a-vllm-v42-streaming-health.modal.run',
    maxTokens: 200,
    temperature: 0.3,
    topP: 0.9,
    timeout: 60000,
  };
  // ...
}
```

---

## Step 4: Test the Deployment

### 4.1 Test Health Endpoint

```bash
curl https://chicopanama--mew1a-vllm-v42-streaming-health.modal.run
```

**Expected response**:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate-merged",
  "uptime": 45.2,
  "startup_time": 58.3
}
```

### 4.2 Test Streaming Endpoint

```bash
curl "https://chicopanama--mew1a-vllm-v42-streaming-stream.modal.run?prompt=Analyze:%20Charizard%20ex%20-%20Listed%20\$45&max_tokens=100"
```

**Expected output** (streaming):
```
data: {"token": "Based", "done": false, "time": 0.12}

data: {"token": " on", "done": false, "time": 0.15}

data: {"token": " the", "done": false, "time": 0.18}

...

data: {"token": "", "done": true, "time": 3.45, "total_tokens": 95}
```

### 4.3 Test Web UI

```bash
# Start local server
cd apps/mew1a-chat
python3 -m http.server 8001

# Open in browser
open http://localhost:8001/chat.html
```

**Expected behavior**:
- ✅ Status dot shows "Connected" (green)
- ✅ Model name displays in status bar
- ✅ Can send prompts and see token-by-token streaming
- ✅ Performance metrics show tokens/sec

### 4.4 Test TypeScript Client

```bash
pnpm tsx scripts/test-streaming-client.ts
```

**Expected output**:
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                   Mew-1A v4.2 Streaming Client Test Suite                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

================================================================================
TEST 1: Health Check
================================================================================

ℹ Checking server health...
✓ Server is healthy!
  Status: healthy
  Model: mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate-merged
  Model Loaded: true
  Uptime: 123s
  Startup Time: 58.34s

...
```

---

## Step 5: Performance Benchmarking

Run comprehensive benchmarks to measure performance:

```bash
# Create benchmark script
cat > scripts/benchmark-v4.2.ts << 'ENDTS'
import { createMew1AClient } from '../ml/src/clients/mew1a-streaming';

const TEST_PROMPTS = [
  'Analyze: Charizard ex - Obsidian Flames. Listed $45, fair value $52, discount 13%',
  'BUY or PASS? Pikachu VMAX - Listed $120, Fair Value $95, trending down 12%',
  'What is the market trend for Umbreon VMAX cards?',
];

async function benchmark() {
  const client = createMew1AClient();

  console.log('Starting benchmark...\n');

  for (const prompt of TEST_PROMPTS) {
    const start = Date.now();
    let tokenCount = 0;

    await client.stream(
      prompt,
      (token, done, metrics) => {
        if (!done) tokenCount++;
        if (done) {
          const elapsed = (Date.now() - start) / 1000;
          const tokensPerSec = metrics!.tokensPerSecond;

          console.log(`Prompt: "${prompt.slice(0, 50)}..."`);
          console.log(`  Tokens: ${metrics!.totalTokens}`);
          console.log(`  Time: ${elapsed.toFixed(2)}s`);
          console.log(`  Speed: ${tokensPerSec.toFixed(1)} tok/s\n`);
        }
      }
    );
  }
}

benchmark();
ENDTS

# Run benchmark
pnpm tsx scripts/benchmark-v4.2.ts
```

**Target metrics**:
- **Tokens/second**: 15-25 tok/s (T4 GPU)
- **Latency**: 3-7s for 150-200 token responses
- **Cold start**: ~60s (first request)
- **Warm inference**: < 1s TTFT (time to first token)

---

## Troubleshooting

### Issue: "Model not found" error

**Cause**: Merged model not yet uploaded to HuggingFace

**Solution**: Complete Step 1 (merge and upload)

### Issue: "401 Unauthorized" when loading model

**Cause**: HuggingFace token not set in Modal

**Solution**:
```bash
modal secret create huggingface-secret HUGGINGFACE_TOKEN=hf_YOUR_TOKEN_HERE
```

### Issue: "CUDA out of memory"

**Cause**: Model too large for T4 GPU (16GB VRAM)

**Solution**: Reduce `gpu_memory_utilization` in config:
```python
VLLM_CONFIG = {
    "gpu_memory_utilization": 0.85,  # Reduce from 0.9
    "max_model_len": 1024,           # Reduce from 2048
    # ...
}
```

### Issue: Slow streaming (< 10 tok/s)

**Possible causes**:
1. Using CPU instead of GPU
2. Model not properly loaded into VRAM
3. Network latency

**Solution**: Check Modal logs for GPU usage

---

## Cost Estimation

**Modal T4 GPU Pricing**: $0.00015/second

**Estimated costs**:
- Cold start (60s): $0.009
- Typical inference (5s): $0.00075
- 1000 requests/day: ~$0.75/day = ~$23/month (assuming mostly warm)
- With cold starts: ~$50-75/month

**Cost optimization**:
- Use `scaledown_window=300` to keep container warm
- Batch similar requests when possible
- Consider A10G GPU for higher throughput (2x cost, 3x speed)

---

## Monitoring

### Check Modal Logs

```bash
modal app logs mew1a-vllm-v4.2-streaming
```

### Check Model Status

Visit: https://modal.com/apps/ChicoPanama/mew1a-vllm-v4.2-streaming

### Set Up Alerts

Create [scripts/monitor-v4.2.ts](scripts/monitor-v4.2.ts) to periodically check health:

```typescript
import { createMew1AClient } from '../ml/src/clients/mew1a-streaming';

async function monitor() {
  const client = createMew1AClient();

  try {
    const health = await client.checkHealth();

    if (health.status !== 'healthy' || !health.modelLoaded) {
      console.error('❌ Model unhealthy:', health);
      // Send alert (Slack, email, etc.)
    } else {
      console.log('✅ Model healthy');
    }
  } catch (error) {
    console.error('❌ Health check failed:', error);
    // Send alert
  }
}

// Run every 5 minutes
setInterval(monitor, 5 * 60 * 1000);
monitor();
```

---

## Next Steps After Deployment

### Phase 2: Evaluation Framework (Weeks 3-4)

1. **Build Pokemon TCG Evaluation Suite**
   - Pricing accuracy test (1000 examples)
   - Card knowledge test (500 examples)
   - Market prediction test (temporal data)
   - BUY/PASS recommendation quality

2. **Generate Quality Reports**
   - Compare v1 vs v4.2 performance
   - Track metrics over time
   - Regression detection

3. **Continuous Evaluation**
   - Pre-deployment validation
   - Quality gates in CI/CD
   - GitHub Actions integration

### Phase 3: Monitoring & Observability (Weeks 5-6)

1. **Enhanced Monitoring**
   - Real-time inference metrics
   - Cost tracking
   - Usage analytics

2. **Performance Dashboard**
   - Grafana/Prometheus integration
   - Alerting system (Slack/Discord)

---

## Quick Reference

### Deployment Commands

```bash
# Merge and upload (RunPod)
python3 /workspace/merge-and-upload-v4.2.py

# Deploy to Modal (local)
modal deploy apps/mew1a/vllm_deploy_v4.2_streaming.py

# Test streaming
curl "https://chicopanama--mew1a-vllm-v42-streaming-stream.modal.run?prompt=Test&max_tokens=50"

# Test UI
cd apps/mew1a-chat && python3 -m http.server 8001
```

### Important URLs

- **Model (LoRA)**: https://huggingface.co/ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate
- **Model (Merged)**: https://huggingface.co/ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate-merged
- **Modal Dashboard**: https://modal.com/apps/ChicoPanama
- **Streaming UI**: http://localhost:8001/chat.html

---

**Ready to deploy!** 🚀

Follow Step 1 on RunPod to merge the model, then proceed with Modal deployment.
