# 🔧 vLLM HuggingFace Token Fix

## Issue
vLLM deployment is failing with:
```
GatedRepoError: Cannot access gated repo for url https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
Access to model meta-llama/Llama-3.2-3B-Instruct is restricted.
```

## Root Cause
1. Modal doesn't have your HuggingFace token, OR
2. Your HuggingFace account doesn't have access to Llama 3.2-3B-Instruct

---

## Fix Option 1: Update Modal Secret (Recommended)

```bash
# Create or update the huggingface-secret in Modal
modal secret create huggingface-secret HUGGINGFACE_TOKEN=$(grep HUGGINGFACE_TOKEN .env | cut -d'=' -f2)
```

Then redeploy:
```bash
modal deploy apps/mew1a/vllm_deploy.py
```

---

## Fix Option 2: Request Llama 3.2 Access

If you haven't accepted Meta's license:

1. Go to: https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
2. Click "Request Access"
3. Accept Meta's license agreement
4. Wait ~2 minutes for approval (usually instant)
5. Redeploy: `modal deploy apps/mew1a/vllm_deploy.py`

---

## Fix Option 3: Use Your v1 Model Directly (Workaround)

Since your old Modal deployment works, we can temporarily use a public base model:

### Edit vllm_deploy.py

Change line 24 from:
```python
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"
```

To use your already-trained Mew-1A v1 directly:
```python
BASE_MODEL = "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"  # Use merged model
```

Then change line 26:
```python
MODEL_NAME = "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"  # v1 (current)
```

**Note**: This loads the full merged model (not LoRA adapters), so it will be slower to load but will work without Llama 3.2 access.

---

## Verification

After applying any fix, test with:
```bash
modal run apps/mew1a/vllm_deploy.py::test
```

Should see:
```
✅ Test 1: Charizard ex (13% discount)
Analysis: BUY recommendation...
Inference Time: 1.23s
```

---

## Quick Commands

```bash
# 1. Update Modal secret
modal secret create huggingface-secret HUGGINGFACE_TOKEN=$(grep HUGGINGFACE_TOKEN .env | cut -d'=' -f2)

# 2. Redeploy
modal deploy apps/mew1a/vllm_deploy.py

# 3. Test
modal run apps/mew1a/vllm_deploy.py::test
```
