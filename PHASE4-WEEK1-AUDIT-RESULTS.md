# Phase 4 Week 1: Training Data Audit Results

**Date**: 2025-10-19
**Audit Script**: [scripts/audit-training-data-v4.2.py](scripts/audit-training-data-v4.2.py)
**Full Report**: [reports/data-quality-audit-v4.2.json](reports/data-quality-audit-v4.2.json)

---

## Executive Summary

Comprehensive audit of **484,258 training examples** reveals **CATASTROPHIC** data quality issues that are **THE ROOT CAUSE** of hallucinations in production.

**Key Finding**: 34% of training data teaches the model to fabricate bid counts.

---

## Critical Issues Found

### 🔴 Issue 1: Bid Count Hallucinations (ROOT CAUSE!)

**Count**: 166,571 examples (34.4%)
**Severity**: CRITICAL

**Problem**: Training outputs mention bid counts when inputs don't provide them.

**Example**:
```json
{
  "instruction": "Analyze this Charizard sale from 2025-06-18.",
  "input": "Charizard sold for $140.23 on 2025-06-18 in Moderately Played condition",
  "output": "This Charizard sale on 2025-06-18 at $140.23 represents a premium price point. Strong demand with 16 bids.",
  //          ^^^^^^^^^^^^^^^^^^^^^^^^ BID COUNT NOT IN INPUT!
  "metadata": {"bid_count": 16}  // Metadata has it, but model should only use instruction/input
}
```

**Impact**:
- Model learned: "high price → add 'Strong demand with X bids'"
- In production: User asks "Analyze Pikachu $50" → Model fabricates "15 bids"
- Phase 3.5 validation removes these, but ROOT CAUSE is training data

**Fix Priority**: 🔴 IMMEDIATE (this is why Phase 3.5 only got to 50-60%)

---

### 🔴 Issue 2: Invalid Card Names

**Count**: 162,696 examples (33.6%)
**Severity**: CRITICAL

**Problem**: Card names are years ("1999"), generic terms ("Pokemon"), or garbage.

**Examples**:
- "1999" (162,000+ examples) - This is a YEAR, not a card!
- "Pokemon", "Card", "Holo", "Rare", "Set"
- Empty strings, "Unknown", "N/A"

**Impact**:
- Model learns "1999" is a valid card name
- Extraction pipeline failed to parse eBay titles correctly
- Garbage-in-garbage-out training

**Fix Priority**: 🔴 IMMEDIATE (remove or re-extract)

---

### 🔴 Issue 3: Zero Refusal Examples

**Count**: 0 examples (0.0%)
**Severity**: CRITICAL
**Target**: 5-10% (24,000-48,000 examples)

**Problem**: ALL training examples have confident outputs. Model NEVER learned to say "I don't know."

**Impact**:
- Model defaults to fabricating plausible answers
- Research (OpenAI Sept 2025): Next-token training "teaches models to bluff"
- Enterprise requirement: Must refuse when lacking data

**Fix Priority**: 🔴 IMMEDIATE (generate 24,000 synthetic examples)

---

### 🟡 Issue 4: Excessive Price Precision

**Count**: 248,082 examples (51.2%)
**Severity**: MEDIUM

**Problem**: Prices stored as floats with absurd precision.

**Example**:
```json
{"sold_price": 107.27754851779001}  // Should be $107.28
```

**Impact**:
- Model memorizes meaningless decimal places
- Wastes token budget (18 chars vs 7 chars)
- Teaches wrong pattern

**Fix Priority**: 🟡 MEDIUM (simple fix: round to 2 decimals)

---

### 🟡 Issue 5: Category Imbalance

**Severity**: MEDIUM

**Distribution**:
- market_analysis: **414,271 (85.5%)** ⚠️ WAY TOO HIGH!
- card_knowledge: 36,184 (7.5%)
- reddit_sentiment: 22,798 (4.7%)
- price_trends: 6,892 (1.4%)
- comparable_sales: 3,490 (0.7%)
- collection_management: 379 (0.1%)
- cross_marketplace: 219 (0.0%)
- deck_building: 25 (0.0%)

**Problem**: Market analysis dominates 85.5% (target: <40%)

**Impact**:
- Model biased toward market analysis
- Weak on card knowledge, deck building
- User asks "What set is Charizard from?" → Model gives price analysis

**Fix Priority**: 🟡 MEDIUM (undersample market_analysis, generate synthetic for minorities)

---

### 🟢 Issue 6: Low BUY/PASS Examples

**Count**: 9,667 examples (2.0%)
**Severity**: LOW (but important for primary use case)
**Target**: 5-10% (24,000-48,000 examples)

**Problem**: Only 2% have explicit BUY/PASS/HOLD recommendations.

**Impact**:
- Model struggles with investment decisions
- No training on financial reasoning

**Fix Priority**: 🟢 LOW (generate 10,000 synthetic examples with reasoning chains)

---

## Deduplication Opportunities

### Exact Duplicates
- **1,987 duplicate groups**
- **2,075 wasted examples** (0.4% of dataset)
- Impact: Minimal, but easy fix

### Temporal Duplicates
- **1,120 cards** with >5 sales each
- Impact: Noise in training data, could reduce by 20-30%

---

## Phase 4 Week 1 Execution Plan

### Priority 1: Remove Bid Hallucinations (TODAY)

**Script**: `scripts/remove-bid-hallucinations.py`

**Logic**:
```python
# If output mentions bids but instruction/input doesn't, remove bid mention
if "bid" in output.lower() and "bid" not in (instruction + input).lower():
    # Remove sentences with bid counts
    output = re.sub(r'[^.]*\d+\s+bids?[^.]*\.', '', output)
    output = re.sub(r'[^.]*Strong demand with[^.]*\.', '', output)
```

**Expected Outcome**: Fix 166,571 examples

---

### Priority 2: Fix Invalid Card Names (TODAY)

**Script**: `scripts/fix-invalid-card-names.py`

**Options**:
1. **Remove entirely**: Delete 162,696 examples (leaves 321,562)
2. **Re-extract**: Parse eBay titles again with better logic
3. **Flag for review**: Mark as low-quality, downsample

**Recommendation**: Remove entirely (Option 1)
- These are mostly "1999" - parsing failed, data is unreliable
- Better to have 321k clean examples than 484k dirty ones

---

### Priority 3: Generate Refusal Examples (THIS WEEK)

**Script**: `scripts/generate-honest-refusal-examples.py`

**Use**: Claude 3.7 Sonnet or GPT-4 to generate 24,000 examples

**Categories**:
1. Obscure cards not in training data (5,000)
2. Questions requiring real-time data (5,000)
3. Ambiguous queries needing clarification (5,000)
4. Out-of-domain questions (5,000)
5. Unanswerable hypotheticals (4,000)

**Example**:
```json
{
  "instruction": "What is the current market price for Shiny Mew GX?",
  "input": "",
  "output": "I don't have current pricing data for Shiny Mew GX in my training set. I recommend checking TCGPlayer or eBay sold listings for the most recent sales. Prices can vary significantly based on condition and grading.",
  "category": "honest_refusal"
}
```

---

### Priority 4: Fix Price Precision (THIS WEEK)

**Script**: `scripts/fix-price-precision.py`

**Logic**:
```python
if 'sold_price' in metadata and isinstance(metadata['sold_price'], float):
    metadata['sold_price'] = round(metadata['sold_price'], 2)
```

**Expected Outcome**: Fix 248,082 examples

---

### Priority 5: Balance Categories (NEXT WEEK)

**Script**: `scripts/balance-category-distribution.py`

**Strategy**:
1. **Undersample market_analysis**: Keep 40% instead of 85.5%
   - Randomly sample ~200k from 414k examples
2. **Oversample minorities**: Duplicate or generate synthetic
   - card_knowledge: 7.5% → 25% (generate 60k)
   - deck_building: 0.0% → 10% (generate 40k)

---

## Expected v4.3 Dataset Stats (After Fixes)

| Metric | v4.2 (Before) | v4.3 (After) | Change |
|--------|---------------|--------------|--------|
| **Total Examples** | 484,258 | ~400,000 | -17% |
| **Bid Hallucinations** | 166,571 (34%) | 0 (0%) | -100% ✅ |
| **Invalid Card Names** | 162,696 (34%) | 0 (0%) | -100% ✅ |
| **Refusal Examples** | 0 (0%) | 24,000 (6%) | +∞ ✅ |
| **BUY/PASS Examples** | 9,667 (2%) | 20,000 (5%) | +107% ✅ |
| **Price Precision** | 248,082 (51%) | 0 (0%) | -100% ✅ |
| **Market Analysis %** | 85.5% | 40% | -53% ✅ |
| **Category Balance** | 1 >40% | 0 >40% | ✅ |

---

## Impact on Model Quality (Predicted)

Based on 2025 research (SoftDedup, Lightning AI, Anthropic case studies):

| Metric | v4.2 | v4.3 (Predicted) | Improvement |
|--------|------|------------------|-------------|
| **Hallucination Rate** | ~10% | <5% | 50% reduction ✅ |
| **Bid Hallucinations** | ~34% → 10% (w/ Phase 3.5) | <2% | 80% reduction ✅ |
| **BUY/PASS Accuracy** | ~40% | >85% | 112% improvement ✅ |
| **Refusal Rate** | 0% | 5-10% | ∞ improvement ✅ |
| **Training Time** | 100% | ~80% | 20% faster ✅ |
| **Final Loss** | ~0.130 | <0.110 | 15% better ✅ |

---

## Today's Action Items

1. ✅ **DONE**: Run comprehensive data audit
2. 🔄 **IN PROGRESS**: Create bid hallucination removal script
3. ⏳ **NEXT**: Run removal script on training data
4. ⏳ **NEXT**: Create invalid card name removal script
5. ⏳ **NEXT**: Generate first batch of refusal examples (5,000)

---

## Timeline

- **Week 1** (This Week):
  - ✅ Day 1: Audit complete
  - 🔄 Day 2-3: Fix bid hallucinations + invalid card names
  - ⏳ Day 4-5: Generate refusal examples + fix price precision

- **Week 2** (Next Week):
  - Balance categories
  - Deduplicate exact + temporal
  - Generate BUY/PASS examples

- **Week 3-4**:
  - Final validation
  - Upload to HuggingFace
  - Document changes

---

## Key Insights

1. **Bid Hallucinations Are Trained, Not Invented**: 34% of training data teaches this pattern
2. **Card Name Extraction Failed**: 33% have invalid names (mostly "1999")
3. **No Refusal Training**: 0% "I don't know" examples → model always fabricates
4. **Category Imbalance**: 85.5% market analysis → model biased
5. **Phase 3.5 Hit Its Ceiling**: Inference fixes can't overcome training data issues

**Conclusion**: Phase 4 (data quality) is THE critical path to enterprise quality. Phase 3.5 got us to 50-60%, but clean training data will get us to 95%+.

---

**Next Step**: Execute Priority 1 (remove bid hallucinations) TODAY.
