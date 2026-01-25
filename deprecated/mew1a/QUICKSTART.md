# 🚀 vLLM Quick Start (3 Commands)

## Deploy vLLM (2 minutes)

```bash
# 1. Install Modal
pip install modal
modal token new

# 2. Deploy
cd /Users/arcadio/dev/pokedao
modal deploy apps/mew1a/vllm_deploy.py

# 3. Test
modal run apps/mew1a/vllm_deploy.py::test
```

**Expected Output**:
```
✅ Test 1: Charizard ex (13% discount)
Analysis: BUY recommendation...
Recommendation: BUY
Inference Time: 1.23s ← 2-3x faster than before!
Tokens/sec: 72.5
```

---

## Update Your App (1 minute)

```bash
# Add to .env
echo "VLLM_ENDPOINT=https://chicopanama--mew1a-vllm-analyze.modal.run" >> .env
echo "USE_VLLM=true" >> .env

# Restart API
pnpm api:dev
```

**Done!** Your AI ensemble now uses vLLM (2-3x faster).

---

## Upgrade to v4 (when ready)

```python
# 1. Edit: apps/mew1a/vllm_deploy.py line 26
MODEL_NAME = "ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive"
```

```bash
# 2. Redeploy
modal deploy apps/mew1a/vllm_deploy.py
```

**That's it!** v4 is now live.

---

## Test with cURL

```bash
curl -X POST https://chicopanama--mew1a-vllm-analyze.modal.run \
  -H "Content-Type: application/json" \
  -d '{
    "card_name": "Charizard ex",
    "listed_price": 45.0,
    "fair_value": 52.0
  }'
```

---

## Full Documentation

See: [VLLM-DEPLOYMENT-GUIDE.md](VLLM-DEPLOYMENT-GUIDE.md)
