# Mew-1A Evaluation Framework

Enterprise-quality evaluation system for Pokemon TCG language models, inspired by NanoChat's proven architecture.

## Quick Start

```python
from apps.mew1a.evaluation import (
    PricingAccuracyTask,
    CardKnowledgeTask,
    BuyPassTask,
    MarketPredictionTask,
    CategoricalEvaluator,
    GenerativeEvaluator,
    BPBCalculator,
    ReportGenerator
)

# 1. Evaluate categorical tasks (fast - ~30 seconds)
pricing_task = PricingAccuracyTask()
knowledge_task = CardKnowledgeTask()
buypass_task = BuyPassTask()

evaluator = CategoricalEvaluator(model_name="ChicoPanama/mew1a-v4.3")

pricing_results = evaluator.evaluate_task(pricing_task, batch_size=8)
knowledge_results = evaluator.evaluate_task(knowledge_task, batch_size=8)
buypass_results = evaluator.evaluate_task(buypass_task, batch_size=8)

# 2. Evaluate generative tasks (slower - ~10 minutes)
prediction_task = MarketPredictionTask()

gen_evaluator = GenerativeEvaluator(
    model_name="ChicoPanama/mew1a-v4.3",
    temperature=0.7,
    seed=42  # Deterministic
)

prediction_results = gen_evaluator.evaluate_task(
    prediction_task,
    max_new_tokens=150
)

# 3. Calculate BPB (vocabulary-independent loss)
bpb_calculator = BPBCalculator(model_name="ChicoPanama/mew1a-v4.3")

test_texts = [
    "Charizard ex - Obsidian Flames. Listed $45, fair value $52, discount 13%. BUY.",
    "Pikachu VMAX - Listed $120, fair value $95, trending down 12%. PASS.",
]

bpb_results = bpb_calculator.calculate_bpb(test_texts)

# 4. Generate comprehensive report
report_gen = ReportGenerator()

model_results = [{
    'model_version': 'v4.3',
    'model_name': 'ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg',
    'pricing_accuracy': pricing_results,
    'card_knowledge': knowledge_results,
    'buy_pass': buypass_results,
    'market_prediction': prediction_results,
    'bpb': bpb_results,
    'timestamp': '2025-10-23 10:15:00'
}]

report_path = report_gen.generate_report(model_results)
print(f"Report generated: {report_path}")
```

## Architecture

### Task Types

**Categorical** (Fast - Logit-based):
- `PricingAccuracyTask` - Price prediction with tolerance bands
- `CardKnowledgeTask` - Multiple choice card facts
- `BuyPassTask` - Binary BUY/PASS decisions

**Generative** (Slow - Full Sampling):
- `MarketPredictionTask` - 30-day trend forecasting

### Evaluator Types

**CategoricalEvaluator**:
- Uses logits only (no sampling required)
- 10-100x faster than generative
- Supports batch processing
- Returns confidence scores

**GenerativeEvaluator**:
- Full text generation
- Deterministic inference with seed
- Temperature and top-k controls
- Task-specific output parsing

### Metrics

**BPBCalculator**:
- Vocabulary-independent loss metric
- Measures compression efficiency
- Fair comparison across models
- Lower is better

## Test Data Format

### historical_deals_1000.json
```json
[
  {
    "card_name": "Charizard ex - Obsidian Flames",
    "sold_price": 52.00,
    "sold_date": "2024-09-15"
  }
]
```

### card_knowledge_500.json
```json
[
  {
    "card_name": "Charizard - Base Set #4/102",
    "question_type": "rarity",
    "correct_answer": "Rare Holo",
    "distractors": ["Common", "Uncommon", "Ultra Rare"]
  }
]
```

### buy_pass_scenarios_500.json
```json
[
  {
    "card_name": "Charizard ex - Obsidian Flames",
    "listed_price": 45.00,
    "fair_value": 52.00,
    "discount_pct": 13.5,
    "trend": "stable",
    "correct_decision": "BUY",
    "reasoning": "13.5% discount with stable trend"
  }
]
```

### market_trends_200.json
```json
[
  {
    "card_name": "Charizard ex - Obsidian Flames",
    "current_price": 52.00,
    "price_30d_ago": 45.00,
    "actual_price_30d_later": 58.50,
    "prediction_date": "2024-09-15",
    "outcome_date": "2024-10-15"
  }
]
```

## Quality Gates

### Deployment Criteria

**Must Pass**:
- Pricing Accuracy >= 0.75
- Card Knowledge >= 0.80
- BUY/PASS Quality >= 0.80
- Market Predictions >= 0.70
- BPB < 1.0

**Overall Score** (weighted):
```
overall_score = (
    pricing_acc * 0.30 +
    knowledge_acc * 0.25 +
    buypass_acc * 0.30 +
    prediction_score * 0.15
)
```

**Deployment Decision**:
- `>= 0.85`: ✅ Ready for Production
- `>= 0.75`: ⚠️ Ready with Monitoring
- `< 0.75`: ❌ Not Ready

## Report Output

Generated report (`EVALUATION_REPORT.md`) includes:

1. **Executive Summary** - Overall scores per model
2. **Model Comparison Table** - Side-by-side metrics
3. **Task-by-Task Breakdown** - Detailed results
4. **BPB Analysis** - Vocabulary-independent loss
5. **Recommendations** - Deploy vs hold decision
6. **Metadata** - Timestamps, git hash, config

Example:
```markdown
## Model Comparison

| Metric              | v4.2  | v4.3  |
|---------------------|-------|-------|
| Pricing Accuracy    | 0.780 | 0.820 |
| Card Knowledge      | 0.820 | 0.850 |
| BUY/PASS Quality    | 0.850 | 0.880 |
| Market Predictions  | 0.710 | 0.750 |
| BPB (Loss)          | 0.9500| 0.9200|

**Recommendation**: ✅ Ready for Production
```

## Performance

### Categorical Evaluation
- **Speed**: ~30 seconds for 1,500 examples (GPU)
- **Method**: Logit-based (no sampling)
- **Batch Size**: 8 examples per batch
- **GPU Memory**: ~2 GB

### Generative Evaluation
- **Speed**: ~10 minutes for 200 examples (GPU)
- **Method**: Full sampling
- **Max Tokens**: 150 per response
- **GPU Memory**: ~4 GB

### Total Evaluation Time
- **Per Model**: ~15 minutes
- **Cost**: ~$0.05 per run (Modal T4 GPU)

## Advanced Usage

### Task Mixtures

Combine multiple tasks:
```python
from apps.mew1a.evaluation import TaskMixture

mixture = TaskMixture([
    PricingAccuracyTask(),
    CardKnowledgeTask(),
    BuyPassTask()
])

results = evaluator.evaluate_task(mixture)
```

### Custom Temperature

Adjust sampling randomness:
```python
# Greedy (deterministic)
evaluator = GenerativeEvaluator(temperature=0.0)

# Creative (more random)
evaluator = GenerativeEvaluator(temperature=1.0)

# Balanced (recommended)
evaluator = GenerativeEvaluator(temperature=0.7)
```

### Partial Datasets

Use dataset slicing:
```python
# First 100 examples only
task = PricingAccuracyTask(start=0, stop=100)

# Every 10th example
task = PricingAccuracyTask(step=10)

# Middle 500 examples
task = PricingAccuracyTask(start=250, stop=750)
```

## Troubleshooting

### FileNotFoundError: test_data not found

Generate test datasets first:
```bash
pnpm tsx scripts/extract_test_data.ts
```

### CUDA out of memory

Reduce batch size:
```python
evaluator.evaluate_task(task, batch_size=4)  # Default is 8
```

Or use CPU:
```python
evaluator = CategoricalEvaluator(device="cpu")
```

### Model not found on HuggingFace

Check model name:
```python
# Correct
model_name = "ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg"

# Wrong
model_name = "ChicoPanama/mew1a-v4.3"  # Missing full name
```

## Next Steps

1. **Extract Test Data**: Run `scripts/extract_test_data.ts`
2. **Run Evaluation**: Evaluate v4.2 and v4.3
3. **Generate Report**: Compare results
4. **Deploy Decision**: Use quality gates to decide

## References

- NanoChat: https://github.com/karpathy/nanochat
- Evaluation Guide: [PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md](../../PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md)
- Vector RAG: [PHASE1-VECTOR-RAG-COMPLETE.md](../../PHASE1-VECTOR-RAG-COMPLETE.md)
- v4.3 Training: [PHASE2-MEW1A-V4.3-TRAINING-READY.md](../../PHASE2-MEW1A-V4.3-TRAINING-READY.md)

---

**Built with inspiration from [NanoChat](https://github.com/karpathy/nanochat)'s proven evaluation architecture.**
