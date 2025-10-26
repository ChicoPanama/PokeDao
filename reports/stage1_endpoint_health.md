# Stage 1: Modal Endpoint Health Test - Mew-1A v4.3

**Date:** October 24, 2025
**Endpoint:** https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run
**Status:** ⚠️ PARTIAL PASS (2/3 tests passed)

---

## Summary

Mew-1A v4.3 has been successfully deployed to Modal Labs with float16 precision (required for T4 GPU compatibility). The `/generate` endpoint is fully functional with excellent performance, but the `/analyze` endpoint experienced a 500 error during testing.

---

## Test Results

### ✅ Test 2: Card Metadata Query (PASS)
- **Endpoint:** `/generate`
- **Latency:** 4.37s
- **Status Code:** 200
- **Query:** "What rarity and HP does Pikachu ex from Scarlet & Violet have?"
- **Response Quality:** Model correctly responded that the specific card wasn't in the database and suggested similar cards
- **RAG:** 5 cards retrieved with similarity scores 0.51-0.51
- **Tokens/Second:** 26.36 tok/s

**Verdict:** ✅ PASS - Model handles metadata queries correctly and gracefully handles missing data

### ✅ Test 3: Unknown Card Fallback (PASS)
- **Endpoint:** `/generate`
- **Latency:** 3.65s
- **Status Code:** 200
- **Query:** "What's the TFV of Ancient Mew Gold edition?"
- **Response Quality:** Model explained that TFV isn't directly available and provided reasoning about similar cards
- **RAG:** 5 Mew cards retrieved with similarity scores 0.46-0.46
- **Tokens/Second:** 30.76 tok/s

**Verdict:** ✅ PASS - Model gracefully handles unknown cards with intelligent fallback

### ❌ Test 1: TFV Estimation (FAIL)
- **Endpoint:** `/analyze`
- **Latency:** 92.91s
- **Status Code:** 500
- **Error:** "Internal Server Error"
- **Query:** Charizard ex (151 set), Listed $45, Fair Value $52

**Verdict:** ❌ FAIL - `/analyze` endpoint timing out or encountering internal error

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| **Tests Passed** | 2 / 3 (66.7%) |
| **Avg Latency (successful)** | 4.01s |
| **Tokens/Second** | 26-31 tok/s |
| **Cold Start** | ~90s (first request) |
| **Warm Inference** | 3-5s |

---

## Technical Issues Resolved

### 1. bfloat16 → float16 Conversion ✅
**Problem:** T4 GPU (compute capability 7.5) doesn't support bfloat16
**Error:**
```
ValueError: Bfloat16 is only supported on GPUs with compute capability
of at least 8.0. Your Tesla T4 GPU has compute capability 7.5.
```

**Solution:** Changed `VLLM_CONFIG["dtype"]` from `"bfloat16"` to `"float16"`
**Result:** Model loads successfully on T4 GPU

### 2. Local File Mount Path Issue ✅
**Problem:** Modal couldn't find `apps/mew1a/rag_middleware_vector.py` when deployed from `apps/mew1a/` directory
**Solution:** Changed `local_path` to `"rag_middleware_vector.py"` (relative to deployment directory)
**Result:** File mounts correctly

### 3. Model Version References ✅
**Problem:** Deployment script still referenced v4.2 in class names and print statements
**Solution:** Updated all references to v4.3 (class names, training stats, descriptions)
**Result:** Consistent v4.3 branding throughout

---

## Outstanding Issues

### ❌ `/analyze` Endpoint Failure
**Status:** UNRESOLVED
**Symptoms:**
- Returns 500 Internal Server Error after 92.9s
- `/generate` endpoint works fine with same model
- No specific error message in response

**Hypotheses:**
1. Timeout issue - `analyze_card()` method may be exceeding Modal's function timeout
2. Vector RAG query failing for specific card/set combination
3. Error in prompt formatting for analyze vs generate

**Next Steps:**
- Check Modal logs for specific error traceback
- Test `/analyze` endpoint with simpler payload
- Add error handling and logging to `analyze_card()` method
- Consider increasing Modal function timeout if needed

---

## Deployment Configuration

```python
# Model
MODEL_NAME = "ChicoPanama/mew1a-v4.3"

# vLLM Config
VLLM_CONFIG = {
    "gpu_memory_utilization": 0.9,
    "max_model_len": 2048,
    "dtype": "float16",  # T4 GPU compatible
    "enable_chunked_prefill": True,
    "max_num_batched_tokens": 4096,
    "tensor_parallel_size": 1,
}

# Modal
- GPU: T4
- Timeout: 600s
- Scaledown Window: 300s
- Vector Store: Modal Volume (482,298 cards)
```

---

## Recommendations

### Immediate Actions
1. **Investigate `/analyze` endpoint** - Check Modal logs for root cause
2. **Add error handling** - Wrap `analyze_card()` in try/catch with detailed logging
3. **Test with simpler payload** - Verify if issue is card-specific or endpoint-wide

### For Next Stage (Stage 2)
- Use `/generate` endpoint for behavioral consistency tests
- Skip `/analyze` endpoint until fixed
- Document `/analyze` as "known issue" in final report

### Production Readiness
- ✅ Model loads successfully on T4 GPU
- ✅ `/generate` endpoint fully functional
- ✅ Vector RAG working correctly
- ⚠️ `/analyze` endpoint needs fix before production use

---

## Conclusion

**Stage 1 Verdict:** ⚠️ **PARTIAL PASS**

Mew-1A v4.3 is deployed and functional for text generation with Vector RAG augmentation. The core model performs well with 3-5s inference latency and intelligent handling of unknown cards. However, the `/analyze` endpoint requires debugging before full production deployment.

**Can we proceed to Stage 2?** YES - Stage 2 (Behavioral Consistency) can use the `/generate` endpoint, which is working correctly. The `/analyze` issue should be resolved in parallel.

---

**Next:** Stage 2 - Model Behavior Consistency Testing
