# Mew-1A v4.3 Training Data Fixes

## Problems Identified in v4.2 Training Data

### Analysis Summary
- **Total Examples**: 373,482
- **With Bid Counts**: 175,159 (46.9%) ❌
- **With BGS Grades**: 17,291 (4.6%) ⚠️
- **With PSA Grades**: 31,755 (8.5%) ⚠️
- **With CGC Grades**: 31,753 (8.5%) ⚠️
- **With Conditions**: 33,018 (8.8%) ⚠️

### Root Cause: Template-Based Hallucinations

**Location**: `scripts/mew1a-extract-v4.2-TEMPORAL-PROPER.ts:98`

```typescript
// PROBLEMATIC CODE:
output: `This ${cardName} sale on ${soldDate} at $${soldPrice.toFixed(2)} represents ${soldPrice > 100 ? 'a premium' : soldPrice > 50 ? 'a moderate' : 'an affordable'} price point${row.grading_company && row.grade_number ? ` for a ${row.grading_company} ${row.grade_number} graded card` : ''}. ${row.bid_count > 5 ? `Strong demand with ${row.bid_count} bids.` : ''}`,
```

**Issue**: This template ALWAYS adds "Strong demand with X bids" when `bid_count > 5` exists in database. Model learned to hallucinate this pattern even when user doesn't provide bid data.

### Specific Hallucination Patterns

1. **Bid Counts** (46.9% of data)
   - Pattern: `${row.bid_count > 5 ? \`Strong demand with ${row.bid_count} bids.\` : ''}`
   - Result: Model adds "7 bids", "10 bids", "14 bids" to responses
   - Fix: Only include if EXPLICITLY in user prompt

2. **Grading Companies** (17.5% of data)
   - Pattern: `${row.grading_company && row.grade_number ? \`...\` : ''}`
   - Result: Model changes PSA 9 → BGS 10, adds grades not mentioned
   - Fix: Only include if user mentions grade

3. **Conditions** (8.8% of data)
   - Pattern: `${row.condition_description ? \`...\` : ''}`
   - Result: Model adds "Heavily Played", "Near Mint" randomly
   - Fix: Only include if user provides condition

4. **Simple If/Else Logic** (77.4% of data)
   - Pattern: `${soldPrice > 100 ? 'premium' : 'moderate'}`
   - Result: Simplistic analysis, not nuanced investment thesis
   - Fix: Add more varied, context-aware responses

## v4.3 Improvements

### 1. Conditional Data Inclusion (CRITICAL)

**Before (v4.2)**:
```typescript
${row.bid_count > 5 ? `Strong demand with ${row.bid_count} bids.` : ''}
```

**After (v4.3)**:
```typescript
// ONLY include bid count if it exists AND is > 0
${row.bid_count && row.bid_count > 0 ? `Strong demand with ${row.bid_count} bids.` : ''}
```

**Better (v4.3 Ultimate)**:
```typescript
// Include bid data sparingly (only 20% of examples with bids)
${row.bid_count && row.bid_count > 0 && Math.random() < 0.2 ? `Strong demand with ${row.bid_count} bids.` : ''}
```

### 2. Add "Unknown Data" Examples (NEW)

Create 10,000+ examples teaching model to say "I don't know":

```json
{
  "instruction": "How many bids did this Charizard get?",
  "input": "Charizard Base Set 1st Edition PSA 10",
  "output": "I don't have bid count information for this specific listing. Bid counts vary by auction and aren't always publicly available after sale completion.",
  "category": "unknown_data"
}
```

```json
{
  "instruction": "What grade is this card?",
  "input": "Pikachu VMAX Vivid Voltage",
  "output": "No grading information was provided. This card could be raw (ungraded) or graded by PSA/BGS/CGC. Graded cards typically command premium prices.",
  "category": "unknown_data"
}
```

### 3. Improve Response Quality

**Before**: Simple if/else
```typescript
${soldPrice > 100 ? 'a premium' : 'an affordable'}
```

**After**: Nuanced analysis
```typescript
${soldPrice > 1000 ? 'a high-value investment opportunity' :
  soldPrice > 500 ? 'a premium price point requiring authentication' :
  soldPrice > 100 ? 'a moderate investment with good liquidity' :
  'an accessible entry point for collectors'}
```

### 4. Reduce Template Reliance

**v4.2 Problem**: All outputs follow identical structure
- "This card sold for $X on DATE..."
- "Strong demand with Y bids..."
- "Monitor recent sales..."

**v4.3 Solution**: Add variety
- 30% of examples: Brief answers ("$X on DATE")
- 40% of examples: Standard analysis (current format)
- 30% of examples: Detailed investment thesis

### 5. Add Context-Aware Examples

**Card Name Only** (Primary Use Case):
```json
{
  "instruction": "Charizard VMAX",
  "input": "",
  "output": "Charizard VMAX is a popular Rainbow Rare from Champion's Path (2020). Market value ranges from $150-$250 for raw copies, with PSA 10 graded cards reaching $400+. Strong collector demand due to Charizard's iconic status and limited Champion's Path print run. Recommendation: Buy PSA 9+ graded copies for long-term investment; raw copies for personal collection.",
  "category": "card_analysis"
}
```

**Investment Decision**:
```json
{
  "instruction": "Should I buy this Umbreon VMAX Alt Art for $300?",
  "input": "Listed at $300, recent sales $250-$350",
  "output": "BUY - $300 is fair market value for Umbreon VMAX Alt Art (Evolving Skies). Recent sales show $250-$350 range, making this a mid-point entry. This card has strong long-term potential as one of the most iconic modern alt arts. Ensure authenticity and check for print defects before purchase.",
  "category": "investment_decision"
}
```

## Implementation Plan

### Step 1: Create v4.3 Extraction Script
- Copy `mew1a-extract-v4.2-TEMPORAL-PROPER.ts` → `mew1a-extract-v4.3-CLEAN.ts`
- Remove hallucination templates
- Add conditional logic (only include data if present)
- Add 20% randomization for optional fields

### Step 2: Generate "Unknown Data" Examples
- Create 10,000 examples for "I don't know" responses
- Categories: unknown_bids, unknown_grade, unknown_condition, unknown_price

### Step 3: Add Primary Use Case Examples
- 5,000 examples: Card name → Investment analysis
- 3,000 examples: BUY/PASS decisions
- 2,000 examples: Market trend queries

### Step 4: Extract v4.3 Dataset
- Run `mew1a-extract-v4.3-CLEAN.ts`
- Target: ~400,000 examples (similar to v4.2)
- Quality over quantity

### Step 5: Validation
- Check bid count distribution (<10% should have bids)
- Verify response variety (no identical templates)
- Test sample outputs for hallucination patterns

### Step 6: Training
- Upload to HuggingFace
- Train on RunPod (3 epochs, RTX 4090, ~90 mins, ~$15)
- Deploy v4.3 to Modal

## Expected Improvements

| Metric | v4.2 | v4.3 Target | Improvement |
|--------|------|-------------|-------------|
| Hallucinated bids | 46.9% | <5% | **90% reduction** |
| Grade preservation | ~40% | >95% | **2.4x better** |
| Response quality | Template-driven | Nuanced | **Qualitative** |
| "I don't know" usage | 0% | 10-15% | **Honesty** |
| Primary use case | Poor | Excellent | **User-focused** |

## Success Criteria

After v4.3 training, model should:
1. ✅ Preserve user-provided grades (PSA 9 stays PSA 9)
2. ✅ Say "I don't know" when lacking data
3. ✅ Provide investment thesis for simple card names
4. ✅ Give clear BUY/PASS recommendations
5. ✅ Not hallucinate bid counts unless user provides them
6. ✅ Show nuanced analysis, not template responses
7. ✅ Pass comprehensive test suite with <10% hallucination rate

## Timeline

- **Day 1**: Create v4.3 extraction script + unknown data examples (4 hours)
- **Day 2**: Generate v4.3 dataset + validation (3 hours)
- **Day 3**: Upload to HuggingFace + RunPod training (2 hours + 90min training)
- **Day 4**: Deploy to Modal + comprehensive testing (2 hours)

**Total**: ~11 hours active work + 90min training = **2-3 days**

## Cost Estimate

- RunPod RTX 4090: $0.44/hr × 1.5 hrs = **$0.66**
- Modal inference: ~$0.10/day = **$3/month**

**Total**: <$1 for training, $3/month for inference
