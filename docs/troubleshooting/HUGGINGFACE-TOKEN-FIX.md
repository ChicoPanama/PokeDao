# 🔑 HuggingFace Token Fix

## Issue
Your HuggingFace token is invalid:
```
{"error":"Invalid credentials in Authorization header"}
```

This is why vLLM deployment is failing.

---

## Solution: Get a New Token (2 minutes)

### Step 1: Create New Token

1. Go to: https://huggingface.co/settings/tokens
2. Click "Create new token"
3. Name: `pokedao-model-access`
4. Type: **Read** (not write)
5. Click "Generate token"
6. **Copy the token** (starts with `hf_...`)

### Step 2: Update Local .env

```bash
# Edit .env and replace HUGGINGFACE_TOKEN line:
nano .env

# Or use sed:
# sed -i '' 's/HUGGINGFACE_TOKEN=.*/HUGGINGFACE_TOKEN=hf_YOUR_NEW_TOKEN/' .env
```

### Step 3: Update Modal Secret

```bash
# Delete old secret
modal secret delete huggingface-secret

# Create new one (replace hf_YOUR_TOKEN with your actual token)
modal secret create huggingface-secret \\
  HUGGINGFACE_TOKEN=hf_YOUR_NEW_TOKEN_HERE
```

### Step 4: Request Llama 3.2 Access

1. Visit: https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
2. Click "Request Access"
3. Accept Meta's license
4. Wait ~2 minutes (usually instant)

### Step 5: Redeploy vLLM

```bash
modal deploy apps/mew1a/vllm_deploy.py
```

### Step 6: Test

```bash
modal run apps/mew1a/vllm_deploy.py::test
```

---

## Quick Commands (After Getting Token)

```bash
# 1. Update .env (edit manually with your new token)
nano .env

# 2. Delete old Modal secret
modal secret delete huggingface-secret

# 3. Create new Modal secret (replace with YOUR token)
modal secret create huggingface-secret HUGGINGFACE_TOKEN=hf_YOUR_NEW_TOKEN

# 4. Redeploy
modal deploy apps/mew1a/vllm_deploy.py

# 5. Test
modal run apps/mew1a/vllm_deploy.py::test
```

---

## Expected Output After Fix

```
================================================================================
MEW-1A vLLM INFERENCE TEST
================================================================================

📊 Test 1: Charizard ex (13% discount)
--------------------------------------------------------------------------------
✅ vLLM engine ready!
Analysis: BUY recommendation - 13% discount...
Recommendation: BUY
Inference Time: 1.23s
Tokens/sec: 72.5
```

---

## Verification

Test your new token works:

```bash
# Export token
export HUGGINGFACE_TOKEN=hf_YOUR_NEW_TOKEN

# Test it
curl -s https://huggingface.co/api/whoami \\
  -H "Authorization: Bearer $HUGGINGFACE_TOKEN"

# Should see:
# {"name":"chicopanama","fullname":"..."}
```

---

## Why This Happened

HuggingFace tokens can expire or be revoked. Common reasons:
- Token was temporary
- Account security change
- Token accidentally regenerated

The fix is simple: just create a new token and update Modal.
