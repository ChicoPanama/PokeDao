# Canary Routing Audit - Call Site Analysis

**Date:** 2025-10-29
**Audit Scope:** All code paths that invoke Mew-1A endpoints

---

## Summary

✅ **Primary vLLM Client:** All routing through `ml/src/clients/vllm.ts` will participate in canary split
⚠️ **AIEnsemble Bypass:** `api/src/lib/ai-ensemble.ts` makes direct fetch calls and does NOT participate in canary split

---

## Primary vLLM Client (✅ Canary-Aware)

**File:** `ml/src/clients/vllm.ts`

**Functions:**
- `vllmAnalyzeCard()` - Line 137
- `vllmGenerate()` - Line 205

**Routing Logic:**
- Both functions call `getMew1aEndpoint(userId)` (line 96)
- Returns endpoint based on `MEW1A_CANARY_WEIGHT`
- Emits `X-Mew1A-Variant: stable|canary` header
- ✅ **PARTICIPATES IN CANARY**

**Call Sites:**
- `scripts/test-vllm-deployment.ts` (testing only)
- Internal usage within `vllm.ts` itself (helper functions)

---

## AIEnsemble Direct Calls (⚠️ Canary Bypass)

**File:** `api/src/lib/ai-ensemble.ts`

**Direct Fetch Calls:**
- Line 151: `fetch(this.vllmEndpoint, ...)` for generation
- Line 207: `fetch(this.vllmEndpoint, ...)` for card analysis

**Configuration:**
```typescript
vllmEndpoint = process.env.VLLM_ENDPOINT || 'https://chicopanama--mew1a-vllm-analyze.modal.run'
```

**⚠️ BYPASS DETECTED:**
- Does NOT use `ml/src/clients/vllm.ts`
- Does NOT emit `X-Mew1A-Variant` header
- Does NOT participate in weighted routing
- Will always hit the endpoint specified by `VLLM_ENDPOINT` env var

**Call Sites:**
- `scripts/test-complete-workflow.ts` (testing)
- `scripts/test-end-to-end-pipeline.ts` (testing)
- `scripts/test-image-generation.ts` (testing)
- `api/src/lib/__tests__/ai-ensemble.test.ts` (testing)

**Production Impact:**
- If production code uses `AIEnsembleEngine` class, it will bypass canary routing
- If production uses `ml/src/clients/vllm.ts` directly, it will participate in canary

---

## Other Direct Modal Calls (Not Production-Critical)

### 1. Streaming Client (Different Endpoint)
**File:** `ml/src/clients/mew1a-streaming.ts`
- Targets: `mew1a-vllm-v4-2-streaming` (separate service)
- Not affected by analyze endpoint canary

### 2. Test/Evaluation Scripts (Testing Only)
- `scripts/test-complete-workflow.ts` - Direct Modal calls for testing
- `scripts/evaluate-mew1a.ts` - Comparison testing (v1, v4.2 endpoints)
- `scripts/mew1a-ab-test.ts` - A/B testing script (not production)

---

## Recommendations

### Option 1: If AIEnsemble is NOT used in production
✅ **No action needed**
- The bypass only affects test scripts
- Production traffic uses `ml/src/clients/vllm.ts`
- Canary split will work as expected

### Option 2: If AIEnsemble IS used in production
🔧 **Two approaches:**

**A. Configure AIEnsemble to use canary endpoint directly**
```bash
# Point AIEnsemble to canary for testing
export VLLM_ENDPOINT="https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/analyze"
```
- Pro: Simple, no code changes
- Con: All AIEnsemble traffic goes to canary (100%, not 10%)

**B. Refactor AIEnsemble to use vllm client**
```typescript
// In ai-ensemble.ts
import { vllmAnalyzeCard } from '../../ml/src/clients/vllm';

// Replace direct fetch with:
const result = await vllmAnalyzeCard({
  cardName,
  setName,
  listedPrice,
  fairValue,
  userId, // For sticky routing
});
```
- Pro: Participates in weighted canary (10% → 50% → 100%)
- Con: Requires code changes and testing

---

## Decision

**Recommended:** Verify if `AIEnsembleEngine` is used in production.

### If YES (used in production):
- **Immediate:** Use Option 2A (point VLLM_ENDPOINT to canary manually)
- **Future:** Refactor to use vllm client for consistency

### If NO (only in tests):
- **No action needed** - canary routing is correct for production paths

---

## Verification Query

Check production logs for AIEnsemble usage:
```bash
# Search for AIEnsemble class instantiation or method calls
grep -r "AIEnsembleEngine\|analyzeCardWithVLLM" /path/to/production/logs
```

If no matches → AIEnsemble not in production → No bypass risk

---

## Monitoring During Canary

### Expected Traffic Split:
- **If AIEnsemble NOT in production:** 90% stable, 10% canary ✅
- **If AIEnsemble IS in production:** Traffic split will be skewed

### Verification:
```bash
# Count variant headers (should be 90/10)
grep "X-Mew1A-Variant" /path/to/app.log | tail -1000 | \
  grep -oE "(stable|canary)" | sort | uniq -c
```

If ratio is NOT 90/10 → AIEnsemble may be bypassing routing

---

**Audit Completed:** 2025-10-29
**Next Action:** Verify AIEnsemble production usage before activating canary
