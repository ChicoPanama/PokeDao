# 🚀 Mew-1A v4.2 Deployment Runbook

**Last Updated**: 2025-10-18
**Status**: Ready to deploy when training completes
**Estimated Deployment Time**: 22 minutes

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (One Command)](#quick-start)
3. [Manual Deployment Steps](#manual-deployment-steps)
4. [Testing & Validation](#testing--validation)
5. [Monitoring & Operations](#monitoring--operations)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### ✅ Training Completion

Ensure training on RunPod has completed:

- [ ] Training script finished (check RunPod logs)
- [ ] Model uploaded to HuggingFace as `ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate`
- [ ] Final loss ~0.17 or better
- [ ] LoRA adapters verified on HuggingFace repo

### ✅ Environment Setup

```bash
# Check environment variables
echo $HUGGINGFACE_TOKEN  # Should show your token

# If not set:
export HUGGINGFACE_TOKEN=YOUR_HUGGINGFACE_TOKEN
```

### ✅ Tools Installed

```bash
# Modal CLI
modal --version  # Should be v0.60+
# If not installed: pip install modal

# Python dependencies for merge script
pip install transformers peft torch huggingface-hub
```

### ✅ Authentication

```bash
# Modal authentication
modal profile list  # Should show your profile
# If not authenticated: modal setup

# HuggingFace authentication
huggingface-cli whoami  # Should show ChicoPanama
# If not authenticated: huggingface-cli login
```

---

## Quick Start

### 🎯 One-Command Deployment

When training is complete, run:

```bash
./scripts/deploy-v4.2.sh
```

This automated script will:
1. ✅ Check all prerequisites
2. 🔗 Merge LoRA adapters into base model (~15 min)
3. ☁️ Upload merged model to HuggingFace (~5 min)
4. 🚀 Deploy vLLM to Modal Labs (~5 min)
5. 🧪 Run automated tests (~2 min)
6. 📊 Display deployment summary

**Total time: ~22 minutes**

---

## Manual Deployment Steps

If you prefer manual control or the automated script fails, follow these steps:

### Step 1: Merge LoRA Adapters (15 min)

```bash
# Run merge script
python3 scripts/merge-lora-v4.2.py
```

**What this does:**
- Loads base Llama 3.2-3B-Instruct
- Loads your v4.2 LoRA adapters from HuggingFace
- Merges LoRA weights into base model
- Saves merged model locally to `./mew1a-v4.2-merged`
- Uploads to HuggingFace as `ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg`

**Expected output:**
```
✅ MERGE COMPLETE!
📁 Local files: ./mew1a-v4.2-merged
☁️  HuggingFace: https://huggingface.co/ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg
📊 Model size: ~6.5 GB (full merged weights)
```

**Verification:**
```bash
# Check HuggingFace repo
ls ./mew1a-v4.2-merged/
# Should contain: config.json, model*.safetensors, tokenizer files
```

---

### Step 2: Deploy vLLM to Modal (5 min)

```bash
# Deploy to Modal
modal deploy apps/mew1a/vllm_deploy_v4.2.py
```

**What this does:**
- Creates Modal app `mew1a-vllm-v4.2`
- Builds Docker image with vLLM 0.6.6
- Downloads merged model to Modal container
- Creates serverless GPU endpoint (T4)

**Expected output:**
```
✓ Created app mew1a-vllm-v4.2
✓ Deployed web function fastapi_app
  https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run
```

**Verification:**
```bash
# Check deployment
modal app list | grep mew1a-vllm-v4.2
# Should show: mew1a-vllm-v4.2 | deployed
```

---

### Step 3: Test Deployment (2 min)

```bash
# Run automated tests
modal run apps/mew1a/vllm_deploy_v4.2.py::test
```

**What this tests:**
- ✅ Health check endpoint
- ✅ Card analysis with discount (Charizard ex)
- ✅ Card analysis with Reddit sentiment (Pikachu VMAX)
- ✅ Inference speed (should be 1-2s)

**Expected output:**
```
✅ MEW-1A v4.2 vLLM TEST COMPLETE
Average inference time: 1.5s
Expected speedup vs v1 transformers: 2-3x faster
```

---

## Testing & Validation

### Health Check

```bash
# Test health endpoint
curl https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "model": "ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg",
  "version": "v4.2",
  "training_examples": 509746,
  "temporal_data_pct": 84.8,
  "features": [
    "market_forecasting",
    "reddit_sentiment",
    "price_trends",
    "arbitrage_detection"
  ]
}
```

---

### Card Analysis Test

```bash
# Test card analysis
curl -X POST https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "card_name": "Charizard ex",
    "set_name": "Obsidian Flames",
    "listed_price": 45.0,
    "fair_value": 52.0,
    "max_tokens": 150
  }'
```

**Expected response:**
```json
{
  "card": "Charizard ex",
  "set": "Obsidian Flames",
  "analysis": "BUY recommendation. Listed at $45 vs fair value $52 = 13% discount...",
  "recommendation": "BUY",
  "tokens": 85,
  "inference_time": 1.5,
  "tokens_per_second": 56.7,
  "total_time": 1.52,
  "model_version": "v4.2",
  "training_examples": 509746
}
```

---

### Performance Benchmark

Run comprehensive performance tests:

```bash
# Create benchmark script
cat > /tmp/benchmark_v4.2.sh << 'EOF'
#!/bin/bash
echo "Running 10 inference requests..."
for i in {1..10}; do
  curl -s -w "\nTime: %{time_total}s\n" \
    -X POST https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/analyze \
    -H "Content-Type: application/json" \
    -d '{"card_name": "Charizard ex", "set_name": "Obsidian Flames", "listed_price": 45.0, "fair_value": 52.0}' \
    | grep "Time:"
done
EOF

chmod +x /tmp/benchmark_v4.2.sh
/tmp/benchmark_v4.2.sh
```

**Expected results:**
- First request (cold start): ~60s (model download + load)
- Subsequent requests: 1-2s average
- Throughput: 0.5-1 requests/second/container

---

## Monitoring & Operations

### View Logs

```bash
# Live tail logs
modal app logs mew1a-vllm-v4.2 --follow

# View recent logs
modal app logs mew1a-vllm-v4.2 --lines 100
```

### Monitor Usage

```bash
# View app details
modal app show mew1a-vllm-v4.2

# Check running containers
modal container list --app mew1a-vllm-v4.2
```

### Cost Monitoring

- **Cold start**: ~60s @ $0.00015/sec = $0.009
- **Warm inference**: 1-2s @ $0.00015/sec = $0.0002-0.0003
- **Idle scaledown**: After 300s (5 min) of inactivity

**Estimated monthly cost:**
- 100 requests/day @ 2s avg = 200s/day = 6000s/month
- 6000s × $0.00015 = $0.90/month + cold starts
- **Total: ~$5-10/month** for moderate usage

---

## Rollback Procedures

### Rollback to v1 (Immediate)

If v4.2 has issues, revert to v1:

```bash
# Stop v4.2
modal app stop mew1a-vllm-v4.2

# Your v1 deployment is still running at:
# https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run
```

**Update frontend:**
```typescript
// In api/src/lib/ai-ensemble.ts
const MEW1A_ENDPOINT =
  // "https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/analyze"  // v4.2
  "https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run"  // v1 (fallback)
```

---

### Gradual Rollout (A/B Testing)

Deploy v4.2 alongside v1 and split traffic:

```typescript
// In api/src/lib/ai-ensemble.ts
class Mew1AClient {
  async analyze(prompt: string) {
    // 50% traffic to v4.2, 50% to v1
    const useV4_2 = Math.random() > 0.5;

    const endpoint = useV4_2
      ? "https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/analyze"
      : "https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run";

    // Make request + log version for analysis
    console.log(`Using Mew-1A ${useV4_2 ? 'v4.2' : 'v1'}`);
    // ...
  }
}
```

---

## Troubleshooting

### Issue: Merge Script Fails with "GatedRepoError"

**Problem:** Can't access Llama 3.2 base model

**Solution:**
```bash
# Verify HuggingFace access
huggingface-cli whoami

# Verify Llama 3.2 access on website:
# https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct

# If you don't have access, request it on HuggingFace
# Then wait 5-10 minutes for approval
```

---

### Issue: Modal Deployment Fails with "No such secret"

**Problem:** HuggingFace secret not configured in Modal

**Solution:**
```bash
# Create Modal secret
modal secret create huggingface-secret \
  HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN

# Verify
modal secret list | grep huggingface
```

---

### Issue: vLLM Container OOM (Out of Memory)

**Problem:** Model too large for T4 GPU (16GB VRAM)

**Solution:**
```python
# In apps/mew1a/vllm_deploy_v4.2.py, reduce memory usage:
VLLM_CONFIG = {
    "gpu_memory_utilization": 0.85,  # Was 0.9
    "max_model_len": 1024,           # Was 2048
    # ...
}
```

---

### Issue: Slow Inference (>5s)

**Problem:** vLLM not optimized or model quantization needed

**Solutions:**

1. **Check GPU type:**
   ```bash
   modal app show mew1a-vllm-v4.2
   # Should show: gpu=T4
   ```

2. **Enable quantization (if needed):**
   ```python
   # In vllm_deploy_v4.2.py
   VLLM_CONFIG = {
       "quantization": "awq",  # Add this
       # ...
   }
   ```

3. **Monitor container:**
   ```bash
   modal container logs --follow
   # Look for: "Inference time: X.XXs"
   ```

---

### Issue: 401 Unauthorized on HuggingFace

**Problem:** Token expired or lacks permissions

**Solution:**
```bash
# Generate new fine-grained token:
# https://huggingface.co/settings/tokens

# Permissions needed:
# - Read access to repos
# - Read access to meta-llama/Llama-3.2-3B-Instruct
# - Write access to ChicoPanama/*

# Update token everywhere:
export HUGGINGFACE_TOKEN=hf_NEW_TOKEN_HERE
modal secret create huggingface-secret HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN
```

---

## Post-Deployment Checklist

After successful deployment:

- [ ] Health check returns 200 OK
- [ ] Test inference returns BUY/PASS recommendation
- [ ] Average inference time < 2s (warm)
- [ ] Update frontend to use v4.2 endpoint
- [ ] Document endpoint URLs in README
- [ ] Set up monitoring alerts (optional)
- [ ] Test Reddit sentiment feature
- [ ] Compare v4.2 vs v1 recommendations on 10 cards
- [ ] Update API documentation

---

## Next Steps After Deployment

1. **Frontend Integration**
   - Update `api/src/lib/ai-ensemble.ts` to use v4.2 endpoint
   - Add Reddit sentiment field to UI forms
   - Display model version in analysis results

2. **Evaluation Pipeline**
   - Create automated evaluation script
   - Compare v4.2 vs v1 on historical arbitrage opportunities
   - Measure recommendation accuracy

3. **Monitoring Dashboard**
   - Set up Modal metrics dashboard
   - Track inference times, costs, error rates
   - Alert on high latency or failures

4. **Data Collection**
   - Continue collecting eBay/TCGPlayer data
   - Expand Reddit sentiment monitoring
   - Prepare for v5 training (6-12 months)

---

## Quick Reference

### Endpoints

| Purpose | URL |
|---------|-----|
| Health Check | `GET https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/health` |
| Card Analysis | `POST https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/analyze` |
| Raw Generation | `POST https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/generate` |

### Commands

| Task | Command |
|------|---------|
| Deploy | `./scripts/deploy-v4.2.sh` |
| Test | `modal run apps/mew1a/vllm_deploy_v4.2.py::test` |
| Logs | `modal app logs mew1a-vllm-v4.2 --follow` |
| Stop | `modal app stop mew1a-vllm-v4.2` |
| Restart | `modal deploy apps/mew1a/vllm_deploy_v4.2.py` |

### Files

| File | Purpose |
|------|---------|
| `scripts/merge-lora-v4.2.py` | Merge LoRA into base model |
| `apps/mew1a/vllm_deploy_v4.2.py` | vLLM deployment script |
| `scripts/deploy-v4.2.sh` | One-command deployment |
| `MEW1A-V4.2-DEPLOYMENT-RUNBOOK.md` | This document |

---

**Questions or issues?** Check troubleshooting section or open an issue in the repo.

**Ready to deploy?** Run: `./scripts/deploy-v4.2.sh` 🚀
