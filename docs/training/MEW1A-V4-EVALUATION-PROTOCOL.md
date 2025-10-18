# Mew-1A v4 Evaluation Protocol

**Date**: 2025-10-17
**Model**: ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive
**Purpose**: Standardized testing to validate comprehensive TCG capabilities

---

## 🎯 Evaluation Categories

### 1. Market Analysis (Pricing Core Competency)

**Test 1: Basic Arbitrage Detection**
```
Instruction: Analyze: Charizard ex - Obsidian Flames. Listed at $45.00, 15 active listings, fair value $52.00

Expected Output:
- Should identify BUY opportunity
- Calculate discount percentage (13.5%)
- Mention liquidity (15 listings)
- Provide clear recommendation
```

**Test 2: Grade Premium Calculation**
```
Instruction: Evaluate: Pikachu VMAX - Vivid Voltage. Condition: PSA 10, Price: $280.00

Expected Output:
- Estimate raw card value (~$70-90)
- Calculate grade premium (~200-300%)
- Explain PSA 10 significance
- Assess if premium is justified
```

**Test 3: Cross-Marketplace Comparison**
```
Instruction: Compare: Mew ex - 151 Set. eBay: $95, TCGPlayer: $110, JustTCG: $105

Expected Output:
- Identify eBay as best deal
- Calculate savings percentage
- Note marketplace reliability
- Recommend where to buy
```

---

### 2. Card Knowledge (New v4 Capability)

**Test 4: Card Overview**
```
Instruction: Tell me about Gardevoir ex from Scarlet & Violet

Expected Output:
- Card type (Psychic)
- Key stats or abilities
- Competitive relevance
- Price range or rarity tier
```

**Test 5: Set Information**
```
Instruction: What cards are valuable in the 151 Set?

Expected Output:
- Mention Mew ex, Charizard ex, or other chase cards
- Price ranges for top cards
- Set characteristics (reprint set, nostalgia appeal)
- Collector value
```

**Test 6: Price Range Knowledge**
```
Instruction: How much does Charizard ex from Obsidian Flames typically cost?

Expected Output:
- Price range ($40-60 for raw)
- Factors affecting price (condition, edition)
- Market trends (if known)
- Comparison to similar cards
```

---

### 3. Deck Building & Strategy (New v4 Capability)

**Test 7: Deck Strategy**
```
Instruction: Explain the Charizard ex deck strategy

Expected Output:
- Core combo (Charizard ex + Rare Candy)
- Win condition (high damage output)
- Key support cards (Arven, Professor's Research)
- Playstyle description
```

**Test 8: Matchup Analysis**
```
Instruction: How does Charizard ex perform against Lost Zone Box?

Expected Output:
- Matchup assessment (favorable/unfavorable)
- Key threats or advantages
- Strategic adjustments
- Win rate estimate (if available)
```

**Test 9: Card Recommendation**
```
Instruction: What cards should I add to improve my Gardevoir ex deck?

Expected Output:
- Specific card suggestions (Mist Energy, Drifloon, etc.)
- Reasoning for each card
- Budget alternatives if applicable
- Tech choices for meta
```

**Test 10: Budget Deck Building**
```
Instruction: Build a competitive deck under $100

Expected Output:
- Deck archetype suggestion
- Card list with quantities
- Estimated total cost
- Competitive viability assessment
```

---

### 4. Collection Management (New v4 Capability)

**Test 11: Set Completion**
```
Instruction: I have 45 cards from Scarlet & Violet. What percentage is complete?

Expected Output:
- Set size reference (if known)
- Completion percentage calculation
- Missing cards value estimate
- Collection progress assessment
```

**Test 12: Portfolio Value**
```
Instruction: Estimate value of: Charizard ex ($50), Pikachu VMAX ($85), Mew ex ($95)

Expected Output:
- Total portfolio value ($230)
- Individual card assessments
- Value concentration analysis
- Diversification suggestions
```

---

### 5. Cross-Marketplace (Enhanced v4 Capability)

**Test 13: Multi-Source Consensus**
```
Instruction: What's the fair value for Umbreon VMAX Alt Art?

Expected Output:
- Aggregate multiple sources
- Price range ($200-250 typical)
- Note condition sensitivity
- Recommend trusted marketplaces
```

---

## ✅ Success Criteria

### Critical Requirements (Must Pass All)
- ✅ **Market Analysis**: 100% accuracy on pricing recommendations (Tests 1-3)
- ✅ **No Hallucination**: All facts must be grounded in training data
- ✅ **Response Format**: Clear structure with reasoning
- ✅ **Appropriate Confidence**: Don't claim knowledge of cards not in training data

### Desirable Outcomes (Target 80%+)
- 🎯 **Card Knowledge**: Accurate details on popular cards (Tests 4-6)
- 🎯 **Deck Strategy**: Sound competitive advice (Tests 7-10)
- 🎯 **Collection Help**: Useful portfolio insights (Tests 11-12)
- 🎯 **Multi-Source**: Balanced marketplace recommendations (Test 13)

---

## 🔬 Testing Procedure

### During Training (Every 500 steps)
1. Save checkpoint
2. Run spot-check on Test 1 (basic arbitrage)
3. Verify output quality doesn't degrade

### Post-Training Validation
1. Load final model from `/workspace/mew1a-v4-output`
2. Run all 13 test cases
3. Compare outputs to expected results
4. Document any failures or unexpected behavior

### Production Deployment Check
1. Re-run all 13 tests on Modal Labs deployment
2. Verify latency < 5 seconds per response
3. Check response consistency across multiple runs
4. A/B test vs Mew-1A v1 (pricing-only model)

---

## 📊 Comparison Baseline: Mew-1A v1

**v1 Strengths** (trained on 10k pricing examples):
- Excellent at arbitrage detection (Tests 1, 3)
- Good at price trend analysis
- Reliable BUY/PASS recommendations

**v1 Weaknesses**:
- Cannot answer card knowledge questions (Tests 4-6) ❌
- No deck building capability (Tests 7-10) ❌
- Limited collection insights (Tests 11-12) ❌
- Grade premium understanding was basic

**v4 Expected Improvements**:
- 🆕 **Card Knowledge**: 28,606 examples → Can answer card/set questions
- 🆕 **Deck Building**: 20,000 examples → Can provide strategy advice
- 🆕 **Collection Management**: 400 examples → Can help track collections
- 📈 **Enhanced Grading**: Better PSA/CGC premium calculations
- 📈 **Better Coverage**: 183 sets vs ~50 in v1

---

## 🧪 Test Execution Script

```python
# test_mew1a_v4.py
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

def load_model(checkpoint_path="./mew1a-v4-output"):
    """Load trained Mew-1A v4 model"""
    print(f"Loading model from {checkpoint_path}...")

    base_model = AutoModelForCausalLM.from_pretrained(
        "meta-llama/Llama-3.2-3B-Instruct",
        torch_dtype=torch.bfloat16,
        device_map="auto"
    )

    model = PeftModel.from_pretrained(base_model, checkpoint_path)
    tokenizer = AutoTokenizer.from_pretrained(checkpoint_path)

    print("✅ Model loaded")
    return model, tokenizer

def run_test(model, tokenizer, instruction, input_text=""):
    """Run a single test case"""
    if input_text:
        prompt = f"""Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Input:
{input_text}

### Response:
"""
    else:
        prompt = f"""Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Response:
"""

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=400,
        temperature=0.7,
        top_p=0.9,
        do_sample=True
    )

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Extract just the response part
    response = response.split("### Response:")[-1].strip()

    return response

# Test cases
TEST_CASES = [
    {
        "id": 1,
        "category": "Market Analysis",
        "instruction": "Analyze: Charizard ex - Obsidian Flames. Listed at $45.00, 15 active listings, fair value $52.00",
        "input": "",
    },
    {
        "id": 4,
        "category": "Card Knowledge",
        "instruction": "Tell me about Gardevoir ex from Scarlet & Violet",
        "input": "",
    },
    {
        "id": 7,
        "category": "Deck Building",
        "instruction": "Explain the Charizard ex deck strategy",
        "input": "",
    },
    # Add all 13 tests here
]

def main():
    model, tokenizer = load_model()

    print("\n" + "="*80)
    print("🧪 RUNNING MEW-1A V4 EVALUATION")
    print("="*80)

    results = []
    for test in TEST_CASES:
        print(f"\n📝 Test {test['id']}: {test['category']}")
        print(f"   Instruction: {test['instruction']}")

        response = run_test(model, tokenizer, test['instruction'], test['input'])

        print(f"\n   Response:\n{response}\n")

        results.append({
            "test_id": test['id'],
            "category": test['category'],
            "response": response
        })

    print("\n" + "="*80)
    print("✅ EVALUATION COMPLETE")
    print("="*80)

    return results

if __name__ == "__main__":
    main()
```

---

## 📝 Post-Training Checklist

After training completes on RunPod:

- [ ] Download training.log and review loss curve
- [ ] Verify final loss < 0.140 (target: < 0.130)
- [ ] Run test_mew1a_v4.py script with all 13 test cases
- [ ] Compare outputs to expected results in this document
- [ ] Document any hallucinations or incorrect facts
- [ ] A/B test vs Mew-1A v1 on pricing examples
- [ ] Deploy to Modal Labs if quality is acceptable
- [ ] Create production monitoring dashboard
- [ ] Set up feedback loop for continuous improvement

---

## 🎯 Success Thresholds

**Ready for Production** if:
- ✅ Final training loss < 0.140
- ✅ All market analysis tests (1-3) pass with correct recommendations
- ✅ At least 8/13 tests produce acceptable outputs
- ✅ No major hallucinations or factually incorrect claims
- ✅ Response time < 5 seconds on Modal Labs

**Needs Retraining** if:
- ❌ Final loss > 0.160
- ❌ Market analysis tests fail (pricing quality regression)
- ❌ Less than 5/13 tests produce acceptable outputs
- ❌ Model hallucinates card names, prices, or strategies not in training data

---

## 📊 Expected v4 Performance

Based on 89,256 training examples:

| Capability | v1 | v2 | v3 | v4 (Expected) |
|-----------|----|----|----|--------------|
| **Market Analysis** | 85% | 90% | 92% | **93%** |
| **Grade Premium** | 60% | 75% | 85% | **88%** |
| **Card Knowledge** | 0% | 0% | 0% | **75%** |
| **Deck Building** | 0% | 0% | 0% | **70%** |
| **Collection Mgmt** | 0% | 0% | 0% | **60%** |
| **Overall** | Baseline | 4x better | 6x better | **10x better** |

v4 should be the **first comprehensive Pokemon TCG AI assistant** that can:
- Price cards accurately ✅
- Explain card mechanics ✅
- Build competitive decks ✅
- Help manage collections ✅
- Provide marketplace insights ✅

---

**Ready to train!** 🚀
