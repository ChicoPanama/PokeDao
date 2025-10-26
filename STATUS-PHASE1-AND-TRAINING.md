# Mew-1A v4.3.1 - Current Status & Remaining Tasks

**Last Updated:** October 24, 2025 - 18:25 PST
**Session:** Parallel Execution (RunPod Training + Phase 1 Improvements)

---

## 🎯 Executive Summary

**Current State:**
- ✅ Training dataset created (200 examples)
- 🔄 LoRA training running on RunPod (~15-20 min remaining)
- ✅ Phase 1 improvements: 2/4 complete
- 📋 Ready to deploy once training completes

**Timeline to Production:**
- Training completion: ~15-20 minutes
- Remaining Phase 1 work: ~1.5 hours
- Deployment + validation: ~1 hour
- **Total: ~2-3 hours to canary launch**

---

## ✅ Completed Tasks

### Workstream A: Training Dataset & Setup
- [x] Generated 200 training examples
  - 150 TFV terminology corrections
  - 50 BUY/PASS regression tests
- [x] Created training automation script
- [x] Uploaded files to RunPod
- [x] Started LoRA training (IN PROGRESS)

### Workstream B: Phase 1 Improvements
- [x] **Phase 1.1:** /analyze endpoint error handling
  - Added try/catch with helpful error messages
  - Documented internal routing through /generate
  - File: `apps/mew1a/vllm_deploy_vector_rag.py:346-389`

- [x] **Phase 1.2:** Session-aware footer (MAJOR UX WIN!)
  - Implemented `SessionTracker` class with 1-hour TTL
  - First occurrence: Full footer (30-40 words)
  - Subsequent: Concise one-liner ("💡 TFV = True Fair Value")
  - File: `apps/mew1a/tfv_validator.py:52-227`
  - **Impact:** Eliminates repetitive footer spam

---

## 🔄 In Progress

### RunPod Training (Workstream A)
**Status:** RUNNING (started ~5 min ago)
**Location:** RunPod pod 194.68.245.86:22025
**Expected completion:** ~15-20 minutes from now
**Log file:** `/workspace/training.log`

**Check progress:**
```bash
ssh root@194.68.245.86 -p 22025 -i ~/.ssh/id_ed25519 "tail -20 /workspace/training.log"
```

**What's running:**
1. Installing dependencies (~2-3 min) - DONE
2. Loading base model ChicoPanama/mew1a-v4.3 (~2-3 min) - DONE
3. Training LoRA adapters (~10-15 min) - **IN PROGRESS**
4. Merging adapters (~2-3 min) - PENDING
5. Uploading to Hugging Face (~1-2 min) - PENDING

---

## 📋 Remaining Tasks

### Phase 1: Production Hardening (Est: 1.5 hours)

#### Phase 1.3: Basic Monitoring Setup (1 hour)
**Priority:** HIGH
**Status:** NOT STARTED

**What needs to be done:**
```python
# Add to apps/mew1a/vllm_deploy_vector_rag.py

from prometheus_client import Counter, Histogram

# Metrics
requests_total = Counter('mew1a_requests_total', 'Total requests')
tfv_repaired_total = Counter('mew1a_tfv_repaired_total', 'TFV repairs')
latency_seconds = Histogram('mew1a_latency_seconds', 'Request latency')

# In each endpoint:
@web_app.post("/generate")
async def generate(data: dict):
    requests_total.inc()
    start = time.time()

    # ... existing code ...

    if result["guardrails"]["tfv_repaired"]:
        tfv_repaired_total.inc()

    latency_seconds.observe(time.time() - start)
    return result
```

**Deliverables:**
- Prometheus metrics endpoint `/metrics`
- Counter: `mew1a_requests_total`
- Counter: `mew1a_tfv_repaired_total`
- Counter: `mew1a_zero_price_sanitized_total`
- Histogram: `mew1a_latency_seconds`

**Alert Thresholds (documented):**
- 🔴 Critical: `error_rate > 10%`, `p95_latency > 15s`
- 🟡 Warning: `error_rate > 5%`, `p95_latency > 10s`
- 🟢 Healthy: `error_rate < 5%`, `p95_latency < 10s`

---

#### Phase 1.4: Canary Deployment Config (30 min)
**Priority:** MEDIUM
**Status:** NOT STARTED

**What needs to be done:**
1. Document Modal canary setup (90/10 split)
2. Create deployment script with traffic routing
3. Define rollback procedures

**Deliverables:**
- `scripts/deploy-canary.sh` - Automated canary deployment
- Documentation in deployment guide
- Rollback commands ready

**Modal Canary Strategy:**
```bash
# Deploy v4.3.1 as new app
modal deploy vllm_deploy_vector_rag.py --name mew1a-v4.3.1

# Route 90% to v4.3.1, 10% to v4.2 (via load balancer or client-side)
# Monitor BUY/PASS alignment ≥95%
# Promote to 100% after 24 hours if green
```

---

### Phase 2: Deployment & Validation (Est: 1 hour)

#### Task 1: Verify Training Completion (5 min)
**When:** After RunPod training finishes
**Actions:**
```bash
# 1. Check Hugging Face
open https://huggingface.co/ChicoPanama/mew1a-v4.3.1

# 2. Verify files exist:
# - config.json
# - model.safetensors (or pytorch_model.bin)
# - tokenizer.json
# - tokenizer_config.json

# 3. TERMINATE RunPod pod (stop billing!)
```

---

#### Task 2: Update Deployment Config (5 min)
**File:** `apps/mew1a/vllm_deploy_vector_rag.py`

**Changes:**
```python
# Line 24: Update model name
MODEL_NAME = "ChicoPanama/mew1a-v4.3.1"  # was v4.3

# Verify all Phase 1 improvements are included:
# ✅ Error handling in /analyze
# ✅ Session-aware footer in tfv_validator.py
# ✅ Monitoring metrics (Phase 1.3)
```

---

#### Task 3: Deploy v4.3.1 to Modal (10 min)
```bash
cd /Users/arcadio/dev/pokedao/apps/mew1a
modal deploy vllm_deploy_vector_rag.py

# Expected output:
# ✓ Created objects.
# ✓ App deployed! 🎉
# View Deployment: https://modal.com/apps/...
```

---

#### Task 4: Run TFV Smoke Tests (10 min)
**Goal:** Validate TFV terminology is fixed (expect 5/5 pass WITHOUT repairs)

```bash
cd /Users/arcadio/dev/pokedao
bash scripts/tfv-smoke-tests.sh

# Expected results:
# Test 1: ✅ PASS (no footer needed - model correct from start)
# Test 2: ✅ PASS (no footer needed)
# Test 3: ✅ PASS (no footer needed)
# Test 4: ✅ PASS (no footer needed)
# Test 5: ✅ PASS (no footer needed)

# Key metric:
# guardrails.tfv_repaired: false (0% repair rate)
```

---

#### Task 5: Run BUY/PASS Regression Tests (10 min)
**Goal:** Ensure LoRA didn't break existing BUY/PASS logic

```bash
# Quick regression test (2 examples)
curl -X POST https://...-fastapi-app.modal.run/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Charizard ex listed $45, TFV $52. Buy or pass?", "max_tokens": 100}'

# Expected: BUY recommendation with discount reasoning

curl -X POST https://...-fastapi-app.modal.run/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Pikachu VMAX listed $120, TFV $95. Buy or pass?", "max_tokens": 100}'

# Expected: PASS recommendation (overpriced)
```

---

#### Task 6: Launch Canary (90/10 split) (15 min setup)
**Goal:** De-risk rollout with gradual traffic shift

**Steps:**
1. Keep v4.2 running (fallback)
2. Route 90% traffic to v4.3.1
3. Monitor for 24 hours:
   - BUY/PASS alignment ≥95% (compare v4.3.1 vs v4.2)
   - `tfv_repaired_rate` ~0% (should be near zero)
   - p95 latency <10s
   - Error rate <5%

**Success Criteria (24h window):**
- ✅ All metrics green
- ✅ No user complaints
- ✅ BUY/PASS agreement ≥95%
- ✅ TFV repair rate <10%

**Promote to 100%:** If all criteria met after 24h

---

### Phase 3: Stages 3-6 Validation (DEFERRED - Run post-launch)

These can run AFTER canary launch (non-blocking):

- **Stage 3:** Quantitative evaluation (2,024 test set) - 4 hours
- **Stage 4:** Economic validation (ROI/Sharpe) - 6 hours
- **Stage 5:** RAG integrity check - 2 hours
- **Stage 6:** Drift baseline capture - 1 hour

**Timeline:** 2-3 days post-launch

---

## 🔍 Quick Status Check Commands

### Check RunPod Training Progress
```bash
ssh root@194.68.245.86 -p 22025 -i ~/.ssh/id_ed25519 "tail -30 /workspace/training.log"
```

### Check If Model Uploaded to HF
```bash
curl -s https://huggingface.co/api/models/ChicoPanama/mew1a-v4.3.1 | jq '.siblings[] | .rfilename'
```

### Test Current v4.3 Deployment
```bash
curl -X POST https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What does TFV mean?", "max_tokens": 50}'
```

---

## 📊 Files Modified/Created This Session

### New Files
- `data/tfv/v4.3.1_training_set.jsonl` - 200 training examples
- `scripts/generate-tfv-training-data.py` - Dataset generator
- `scripts/runpod-train-v4.3.1.sh` - Training automation
- `RUNPOD-V4.3.1-TRAINING.md` - Step-by-step guide
- `RUNPOD-QUICKSTART.sh` - One-command training launcher
- `PARALLEL-EXECUTION-STATUS.md` - Progress tracker
- `STATUS-PHASE1-AND-TRAINING.md` - This document

### Modified Files
- `apps/mew1a/vllm_deploy_vector_rag.py` - Error handling improvements
- `apps/mew1a/tfv_validator.py` - Session-aware footer logic

---

## ⏱️ Estimated Timeline to Canary Launch

| Task | Time | Depends On |
|------|------|------------|
| **RunPod training** | ~15-20 min | Nothing (IN PROGRESS) |
| **Phase 1.3: Monitoring** | ~1 hour | Nothing (can do in parallel) |
| **Phase 1.4: Canary config** | ~30 min | Nothing |
| **Verify HF upload** | ~5 min | Training complete |
| **Update deployment** | ~5 min | Training complete |
| **Deploy v4.3.1** | ~10 min | All Phase 1 complete |
| **Run smoke tests** | ~10 min | Deploy complete |
| **Launch canary** | ~15 min | Tests pass |
| **TOTAL** | **~2-3 hours** | - |

---

## 🚀 Next Immediate Actions

**Right Now (While Training Runs):**
1. ✅ Training is running on RunPod (~15-20 min ETA)
2. 🔄 **YOU:** Decide - should I continue with Phase 1.3 (monitoring) or wait?
3. 📋 Alternative: Create detailed deployment checklist while waiting

**When Training Completes:**
1. Verify model uploaded to Hugging Face
2. TERMINATE RunPod pod (stop billing!)
3. Complete remaining Phase 1 tasks (if not done)
4. Deploy v4.3.1 + validate + launch canary

---

## ❓ Decision Point

**What would you like me to do next?**

**Option A:** Continue Phase 1.3 (Monitoring Setup) while training runs (~1 hour)
**Option B:** Wait for training to complete, then do everything together
**Option C:** Create comprehensive deployment checklist/runbook instead

Let me know your preference!

---

**END OF STATUS DOCUMENT**
