# Mew-1A v4.3-shaped API Documentation

**Version:** v4.3-shaped (Phase 1: Contradiction Elimination)
**Endpoint:** https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run
**Status:** Canary Rollout (10% → 50% → 100%)

---

## 🎯 What Changed in v4.3-shaped

### New Response Schema

v4.3-shaped introduces **Phase 1 response shaping** to eliminate visible contradictions between model text and Policy Engine recommendations.

**Key Changes:**
- ✅ Added `headline` field (always present)
- ✅ Added `explanation` field (policy-aligned text)
- ✅ Added `shaped` flag (indicates shaping applied)
- ⚠️ `response` and `analysis` fields are now **DEPRECATED**

---

## 📊 Response Schema (v4.3-shaped)

### POST `/analyze`

**Request:**
```json
{
  "card_name": "Charizard ex",
  "set_name": "Obsidian Flames",
  "listed_price": 45.0,
  "fair_value": 52.0,
  "reddit_sentiment": "",  // optional
  "max_tokens": 200,
  "use_rag": true
}
```

**Response (NEW):**
```json
{
  // ✅ AUTHORITATIVE FIELDS (always use these)
  "recommendation": "BUY",                    // Policy Engine decision
  "headline": "**RECOMMENDATION: BUY**",      // User-visible summary
  "explanation": "The listed price ($45.00) is 13.5% below the Fair Value of $52.00. This represents a discount of $7.00, making it an undervalued opportunity worth purchasing.",

  // ✅ METADATA
  "shaped": true,                             // Response shaping applied
  "policy_engine": true,                      // Policy Engine active
  "tfv": 52.0,                               // Fair value (TCGPlayer)
  "listed": 45.0,                            // Listed price
  "discount_pct": 13.5,                      // Discount percentage

  // ✅ PERFORMANCE
  "tokens": 45,
  "inference_time": 0.82,
  "tokens_per_second": 54.8,

  // ✅ RAG
  "rag_augmented": true,
  "rag_cards_count": 5,

  // ⚠️ DEPRECATED (do not use)
  "response": "...",                          // DEPRECATED - may contradict
  "analysis": "..."                           // DEPRECATED - use explanation
}
```

### POST `/generate`

**Request:**
```json
{
  "prompt": "Analyze: Pikachu VMAX - Vivid Voltage. Listed $120, fair value $95",
  "max_tokens": 200,
  "temperature": 0.3,
  "top_p": 0.9,
  "use_rag": true,
  "listed_price": 120.0,  // For Policy Engine
  "fair_value": 95.0      // For Policy Engine
}
```

**Response (NEW):**
```json
{
  // ✅ AUTHORITATIVE FIELDS
  "recommendation": "PASS",
  "headline": "**RECOMMENDATION: PASS**",
  "explanation": "The listed price ($120.00) is 26.3% above the Fair Value of $95.00. This represents a premium of $25.00, making it overpriced. I recommend passing on this deal.",

  // ✅ METADATA
  "shaped": true,
  "policy_engine": true,
  "tfv": 95.0,
  "listed": 120.0,
  "discount_pct": -26.3,

  // ✅ PERFORMANCE
  "tokens": 42,
  "inference_time": 0.75,
  "tokens_per_second": 56.0,

  // ⚠️ DEPRECATED
  "response": "..."  // DEPRECATED
}
```

---

## 🔄 Client Migration Guide

### ✅ CORRECT Usage (v4.3-shaped)

**JavaScript/TypeScript:**
```javascript
// Fetch recommendation
const response = await fetch('https://.../analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    card_name: "Charizard ex",
    set_name: "Obsidian Flames",
    listed_price: 45.0,
    fair_value: 52.0
  })
});

const data = await response.json();

// ✅ Read authoritative fields
const decision = data.recommendation;      // "BUY", "PASS", "HOLD", "NEUTRAL"
const headline = data.headline;            // "**RECOMMENDATION: BUY**"
const explanation = data.explanation;      // Policy-aligned text

// ✅ Display to user
const userDisplay = `${headline}\n\n${explanation}`;
console.log(userDisplay);

// ✅ Use in logic
if (decision === "BUY") {
  // Add to buy list
} else if (decision === "PASS") {
  // Skip this card
}
```

**Python:**
```python
import requests

response = requests.post(
    'https://.../analyze',
    json={
        'card_name': 'Charizard ex',
        'set_name': 'Obsidian Flames',
        'listed_price': 45.0,
        'fair_value': 52.0
    }
)

data = response.json()

# ✅ Read authoritative fields
decision = data['recommendation']      # "BUY", "PASS", "HOLD", "NEUTRAL"
headline = data['headline']            # "**RECOMMENDATION: BUY**"
explanation = data['explanation']      # Policy-aligned text

# ✅ Display to user
user_display = f"{headline}\n\n{explanation}"
print(user_display)
```

### ❌ DEPRECATED Usage (DON'T DO THIS)

```javascript
// ❌ DON'T use deprecated fields
const oldText = data.response;    // DEPRECATED - may contradict recommendation
const oldAnalysis = data.analysis; // DEPRECATED - may contradict recommendation

// ❌ DON'T parse recommendation from text
if (oldText.includes("BUY")) {  // UNRELIABLE - use data.recommendation instead
  // ...
}
```

---

## 📋 Field Definitions

### Core Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `recommendation` | `string` | **Authoritative decision** from Policy Engine | `"BUY"`, `"PASS"`, `"HOLD"`, `"NEUTRAL"` |
| `headline` | `string` | User-visible summary (always includes decision) | `"**RECOMMENDATION: BUY**"` |
| `explanation` | `string` | Policy-aligned reasoning (guaranteed no contradictions) | `"The listed price ($45.00) is..."` |
| `shaped` | `boolean` | Whether response shaping was applied | `true` |
| `policy_engine` | `boolean` | Whether Policy Engine was active | `true` |

### Pricing Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `tfv` | `number` | Fair value (TCGPlayer estimate) | `52.0` |
| `listed` | `number` | Listed price | `45.0` |
| `discount_pct` | `number` | Discount % (negative = premium) | `13.5` |

### Performance Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `tokens` | `number` | Tokens generated | `45` |
| `inference_time` | `number` | Model inference time (seconds) | `0.82` |
| `tokens_per_second` | `number` | Generation throughput | `54.8` |

### Deprecated Fields (⚠️ DO NOT USE)

| Field | Status | Replacement |
|-------|--------|-------------|
| `response` | **DEPRECATED** | Use `explanation` |
| `analysis` | **DEPRECATED** | Use `explanation` |

---

## 🎯 Decision Logic (Policy Engine)

The **Policy Engine** provides deterministic BUY/PASS/HOLD/NEUTRAL recommendations:

### BUY
- **Condition:** Listed price ≤ Fair Value × 0.90 (10%+ discount)
- **Example:** Listed $45, TFV $52 → 13.5% discount → **BUY**

### PASS
- **Condition:** Listed price ≥ Fair Value × 1.10 (10%+ premium)
- **Example:** Listed $120, TFV $95 → 26.3% premium → **PASS**

### HOLD
- **Condition:** Listed price within ±10% of Fair Value
- **Example:** Listed $48, TFV $50 → 4% discount → **HOLD**

### NEUTRAL
- **Condition:** Missing or invalid pricing data (TFV = $0 or listed = $0)
- **Example:** Listed $0, TFV $0 → **NEUTRAL**

---

## ✅ Response Shaping Guarantees

v4.3-shaped provides the following guarantees:

1. **Zero Visible Contradictions**
   - `explanation` text will NEVER contradict `recommendation`
   - If contradiction detected, explanation is rebuilt from policy template

2. **Authoritative Recommendation**
   - `recommendation` field is always correct (Policy Engine enforced)
   - Take precedence over any text-based parsing

3. **Consistent Headlines**
   - All responses include `headline` field
   - Format: `"**RECOMMENDATION: {decision}**"`

4. **Policy-Aligned Text**
   - `explanation` uses policy templates for PASS/HOLD cases
   - Guaranteed alignment with `recommendation`

---

## 🚨 Breaking Changes

### What's Changing

**Deprecated Fields:**
- `response` (raw model text - may contradict)
- `analysis` (alias for response - may contradict)

**Required Changes:**
- Update clients to read `recommendation` (authoritative)
- Display `headline` + `explanation` instead of `response`
- Remove dependencies on deprecated fields

### Migration Timeline

| Date | Traffic % | Action Required |
|------|-----------|-----------------|
| 2025-10-25 | 10% canary | Test with new fields |
| 2025-10-26 | 50% canary | Update clients to use new schema |
| 2025-10-27 | 100% production | Complete migration |
| 2025-11-01 | 100% | Deprecated fields removed (hard cutoff) |

---

## 📊 Example Responses

### Example 1: BUY Recommendation

```json
{
  "recommendation": "BUY",
  "headline": "**RECOMMENDATION: BUY**",
  "explanation": "The listed price ($35.00) is 16.7% below the Fair Value of $42.00. This represents a discount of $7.00, making it an undervalued opportunity worth purchasing.",
  "shaped": true,
  "policy_engine": true,
  "tfv": 42.0,
  "listed": 35.0,
  "discount_pct": 16.7
}
```

### Example 2: PASS Recommendation

```json
{
  "recommendation": "PASS",
  "headline": "**RECOMMENDATION: PASS**",
  "explanation": "The listed price ($50.00) is 19.1% above the Fair Value of $42.00. This represents a premium of $8.00, making it overpriced. I recommend passing on this deal.",
  "shaped": true,
  "policy_engine": true,
  "tfv": 42.0,
  "listed": 50.0,
  "discount_pct": -19.1
}
```

### Example 3: HOLD Recommendation

```json
{
  "recommendation": "HOLD",
  "headline": "**RECOMMENDATION: HOLD**",
  "explanation": "The listed price ($48.00) is within 4.0% of the Fair Value ($50.00). This is priced fairly and within the expected market range.",
  "shaped": true,
  "policy_engine": true,
  "tfv": 50.0,
  "listed": 48.0,
  "discount_pct": 4.0
}
```

---

## 🔗 Additional Resources

- **Endpoint:** https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run
- **Health Check:** `/health`
- **Metrics:** `/metrics` (Prometheus format)
- **Rollout Status:** See internal wiki or #mew1a-deploys Slack

---

**Document Version:** 1.0
**Last Updated:** 2025-10-25
**Status:** Canary Rollout Active
