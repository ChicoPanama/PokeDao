# MEW-1A Test Results

**Generated:** 2026-01-24
**Endpoint:** `https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run`
**Model:** `ChicoPanama/mew1a-v4.3.1` (Llama-3.2-3B + LoRA)

---

## Summary

| Metric | Value |
|--------|-------|
| **Success Rate** | 10/10 (100%) |
| **Avg Inference Time** | 5.95s |
| **Avg Total Time** | 6.40s |
| **Tokens/Second** | 33.6 |
| **RAG Augmentation** | 100% |
| **GPU** | T4 (16GB VRAM) |

---

## Test Results (10 Cards)

| Card | Recommendation | Inference | Total | Discount | RAG |
|------|---------------|-----------|-------|----------|-----|
| Charizard | BUY | 5.96s | 6.49s | +13.8% | Yes |
| Pikachu | BUY | 5.90s | 6.40s | +16.7% | Yes |
| Mewtwo | PASS | 6.05s | 6.45s | -11.1% | Yes |
| Blastoise | BUY | 5.97s | 6.39s | +20.0% | Yes |
| Venusaur | PASS | 5.91s | 6.32s | +16.7% | Yes |
| Umbreon VMAX | PASS | 5.96s | 6.35s | +18.2% | Yes |
| Lugia | PASS | 5.96s | 6.39s | +6.2% | Yes |
| Rayquaza | PASS | 5.99s | 6.40s | -5.3% | Yes |
| Mew | BUY | 5.89s | 6.32s | +25.0% | Yes |
| Gengar | BUY | 5.89s | 6.54s | +20.0% | Yes |

**Recommendation Breakdown:** 5 BUY | 5 PASS | 0 HOLD

---

## MEW-1A vs DeepSeek Comparison

| Metric | MEW-1A | DeepSeek |
|--------|--------|----------|
| **Avg Latency** | 6.40s | 6.07s |
| **Specialization** | TCG-trained (253K examples) | General purpose |
| **RAG Support** | Yes (482K cards indexed) | No |
| **Cost** | ~$0.001/request (Modal) | ~$0.0002/request (API) |
| **Cold Start** | 60-90s | N/A |
| **Warm Response** | 6s | 6s |
| **Output Quality** | TCG-specific reasoning | General investment analysis |

### Same Card Comparison

**Charizard (Base Set, $5000 listed, $5800 FV)**
- **MEW-1A:** BUY - "The listed price ($5000.00) is 13.8% below the fair value of $5800.00. This represents a discount of $800.00, making it an undervalued deal worth purchasing."
- **DeepSeek:** BUY - "This is a high-grade, iconic collectible trading at a meaningful discount to its established fair market value..."

**Mewtwo (Base Set, $500 listed, $450 FV)**
- **MEW-1A:** PASS - Correctly identified as overpriced (premium, not discount)
- **DeepSeek:** PASS - Agreed on the overpricing assessment

---

## Sample MEW-1A Response

```json
{
  "card": "Charizard",
  "set": "Base Set",
  "analysis": "BUY\n\nReasoning: The listed price ($5000.00) is 13.8% below the fair value of $5800.00. This represents a discount of $800.00, making it an undervalued deal worth purchasing.",
  "recommendation": "BUY",
  "tokens": 200,
  "inference_time": 6.114,
  "tokens_per_second": 32.71,
  "rag_augmented": true,
  "rag_cards_count": 5,
  "rag_cards": [
    {
      "pokemon_name": "Charizard",
      "price": 4008.65,
      "date": "2025-08-22",
      "listing_type": "sold",
      "grade": "SGC",
      "similarity_score": 0.55
    }
  ]
}
```

---

## Deployment Configuration

```yaml
# Modal App: mew1a-vllm-v4.3-vector-rag
GPU: T4 (16GB VRAM)
min_containers: 1  # Keep warm
scaledown_window: 600s  # 10 min
timeout: 600s

# vLLM Settings
gpu_memory_utilization: 0.9
max_model_len: 2048
dtype: float16

# Vector RAG
index_size: 482,298 cards
search_method: FAISS semantic
```

---

## Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Modal Deployment | Active | `mew1a-vllm-v4.3-vector-rag` |
| Health Endpoint | /health | Returns model status |
| Analyze Endpoint | /analyze | Card analysis |
| Vector RAG | Enabled | 482K cards indexed |
| TFV Validator | Enabled | Guardrails active |
| Keep-Warm | Configured | `min_containers=1` |

---

## Recommendations

1. **Use MEW-1A as primary** for TCG-specific analysis (better domain knowledge)
2. **DeepSeek as fallback** for deep reasoning and thesis generation
3. **Set SKIP_MEW1A=false** in production to enable MEW-1A
4. **Monitor cold starts** - first request after 10+ min idle takes 60-90s
5. **Consider keep-warm ping** every 5 min to eliminate cold starts

---

## Environment Variables

```bash
# Enable MEW-1A in production
SKIP_MEW1A=false
MEW1A_TIMEOUT_MS=90000  # 90s for cold starts
VLLM_ENDPOINT=https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/analyze

# Ensemble weights
ENSEMBLE_WEIGHT_MEW1A=2  # Double weight for TCG specialist
ENSEMBLE_WEIGHT_DEEPSEEK=1
```
