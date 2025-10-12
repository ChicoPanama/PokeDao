# Mew-1A v2 Deployment Guide

Complete guide to deploy Mew-1A v2 to Modal Labs and migrate from v1.

## Prerequisites

- ✅ Mew-1A v2 training completed on RunPod
- ✅ Model uploaded to HuggingFace: `ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing`
- ✅ Modal CLI installed: `pip install modal`
- ✅ Modal account set up: `modal setup`

## Step 1: Verify Model is Available

```bash
# Check HuggingFace Hub
huggingface-cli repo-info ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing

# Should show:
# - adapter_config.json
# - adapter_model.safetensors (~48MB)
# - tokenizer files
```

## Step 2: Configure Modal Secrets

1. Go to https://modal.com/secrets
2. Create secret named `huggingface-secret`
3. Add key: `HUGGINGFACE_TOKEN` = `your_token_here`

## Step 3: Deploy to Modal Labs

```bash
cd /Users/arcadio/dev/pokedao

# Deploy Mew-1A v2
modal deploy scripts/mew1a-deploy-v2-modal.py

# Expected output:
# ✓ Created web function analyze_card_endpoint
# ✓ Created web function generate_endpoint
# View at: https://modal.com/apps/...
```

## Step 4: Get Endpoint URLs

```bash
modal app list

# Output:
# mew1a-v2-tcg-pricing    deployed    2 hours ago

modal app show mew1a-v2-tcg-pricing

# Endpoints:
# - analyze_card_endpoint: https://username--mew1a-v2-tcg-pricing-analyze-card-endpoint.modal.run
# - generate_endpoint: https://username--mew1a-v2-tcg-pricing-generate-endpoint.modal.run
```

## Step 5: Test the Deployment

### Test 1: Card Analysis

```bash
curl -X POST https://your-url--mew1a-v2-tcg-pricing-analyze-card-endpoint.modal.run \
  -H "Content-Type: application/json" \
  -d '{
    "card_name": "Charizard ex",
    "set_name": "Obsidian Flames",
    "listed_price": 45.00,
    "listing_count": 15,
    "fair_value": 52.00
  }'
```

Expected response:
```json
{
  "card_name": "Charizard ex",
  "set_name": "Obsidian Flames",
  "listed_price": 45.00,
  "analysis": "ANALYSIS: Strong BUY opportunity\n\nPRICING:\n• Listed: $45.00\n• Fair Value: $52.00 (based on 15 listings)\n• Discount: 13.5% below market\n\nLIQUIDITY:\n• Market Depth: 15 active listings\n• Liquidity Grade: C\n\nRECOMMENDATION: BUY\nReasoning: Significant discount with proven demand. High probability of selling within 2-3 weeks at market value for 15%+ profit.",
  "recommendation": "BUY",
  "model_version": "mew1a-v2"
}
```

### Test 2: Raw Generation

```bash
curl -X POST https://your-url--mew1a-v2-tcg-pricing-generate-endpoint.modal.run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\n### Instruction:\nAnalyze: Pikachu VMAX - Listed $120, Fair Value $95\n\n### Response:\n",
    "max_tokens": 300,
    "temperature": 0.7
  }'
```

## Step 6: Compare v1 vs v2 Performance

Run the A/B test script:

```bash
pnpm tsx scripts/mew1a-ab-test.ts
```

This will compare:
- Response quality
- Accuracy of recommendations
- Consistency across similar cards
- Inference speed

## Step 7: Update Production API

### Current v1 Endpoint:
```
https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run
```

### New v2 Endpoint:
```
https://chicopanama--mew1a-v2-tcg-pricing-analyze-card-endpoint.modal.run
```

### Migration Options:

**Option A: Gradual Rollout (Recommended)**
```typescript
// api/src/lib/ai-ensemble.ts
const MEW1A_V1_ENDPOINT = process.env.MEW1A_V1_ENDPOINT;
const MEW1A_V2_ENDPOINT = process.env.MEW1A_V2_ENDPOINT;
const MEW1A_V2_ROLLOUT_PERCENT = parseFloat(process.env.MEW1A_V2_ROLLOUT_PERCENT || '0');

async function callMew1A(prompt: string) {
  // Random selection based on rollout percentage
  const useV2 = Math.random() < (MEW1A_V2_ROLLOUT_PERCENT / 100);
  const endpoint = useV2 ? MEW1A_V2_ENDPOINT : MEW1A_V1_ENDPOINT;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 300 })
  });

  return response.json();
}
```

Rollout schedule:
- Week 1: 10% v2, 90% v1
- Week 2: 25% v2, 75% v1
- Week 3: 50% v2, 50% v1
- Week 4: 75% v2, 25% v1
- Week 5: 100% v2 (deprecate v1)

**Option B: Immediate Cutover**
```bash
# Update .env
MEW1A_ENDPOINT=https://your-url--mew1a-v2-tcg-pricing-analyze-card-endpoint.modal.run
```

## Step 8: Monitor Performance

### Modal Dashboard
```bash
# View logs
modal app logs mew1a-v2-tcg-pricing --follow

# View metrics
modal app stats mew1a-v2-tcg-pricing
```

### Key Metrics to Track:
- **Latency**: Should be 3-7s warm, ~60s cold
- **Error Rate**: Should be < 1%
- **Cost per Request**: ~$0.00075
- **Request Volume**: Track daily usage
- **Model Accuracy**: Compare v1 vs v2 recommendations

## Step 9: Optimize Costs

### If Usage is High (>10k requests/day):
Consider switching to dedicated GPU instead of serverless:

```python
# In mew1a-deploy-v2-modal.py, change:
@stub.cls(
    gpu="T4",
    container_idle_timeout=0,  # Always on
    keep_warm=1,  # Keep 1 container always warm
)
```

Cost comparison:
- **Serverless**: $0.00075/request × 10,000 = $7.50/day = $225/month
- **Dedicated T4**: $0.34/hour × 24 × 30 = $244/month (always on)

Break-even: ~11,000 requests/day

### If Usage is Low (<1k requests/day):
Keep serverless (pay-per-use), optimize cold starts:

```python
container_idle_timeout=600,  # Keep warm 10 min instead of 5
```

## Step 10: Rollback Plan (If Needed)

If v2 underperforms:

```bash
# 1. Point traffic back to v1
export MEW1A_ENDPOINT=$MEW1A_V1_ENDPOINT

# 2. Stop v2 deployment
modal app stop mew1a-v2-tcg-pricing

# 3. Investigate issues
modal app logs mew1a-v2-tcg-pricing

# 4. Fix and redeploy
modal deploy scripts/mew1a-deploy-v2-modal.py
```

## Cost Summary

### Development/Testing:
- **Training**: $3.50 (RunPod, one-time)
- **Deployment**: $0 (Modal free tier: 30 free GPU hours/month)
- **Testing**: < $0.10

### Production (estimated):
| Requests/Day | Cost/Day | Cost/Month |
|--------------|----------|------------|
| 100 | $0.08 | $2.40 |
| 1,000 | $0.75 | $22.50 |
| 10,000 | $7.50 | $225 |
| 50,000 | $37.50 | $1,125 |

## Troubleshooting

### Cold starts too slow
```python
# Increase keep_warm to pre-load containers
keep_warm=2  # Keep 2 containers ready
```

### Out of memory errors
```python
# Use larger GPU
gpu="A10G"  # 24GB VRAM
```

### Rate limit errors
```python
# Add retry logic
@retry(max_attempts=3, backoff=2.0)
def generate(...):
    ...
```

### Model quality issues
- Check training logs for final loss
- Verify model uploaded correctly to HuggingFace
- Test with known examples
- Compare with v1 outputs

## Success Criteria

Before full rollout, v2 should demonstrate:
- ✅ Final training loss < 0.150 (vs v1's 0.170)
- ✅ Better recommendation accuracy (A/B test)
- ✅ More detailed analysis (qualitative)
- ✅ Consistent pricing guidance (reproducible)
- ✅ Similar or better latency (3-7s warm)
- ✅ Error rate < 1%

---

**Last Updated**: 2025-10-12
