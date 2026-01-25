# Mew-1A Development Phases

**Last Updated:** 2025-10-23
**Status:** All phases complete

---

## Overview

This document chronicles the three major development phases for Mew-1A, from Vector RAG implementation through production-ready evaluation framework.

---

## Phase 1: Vector RAG Implementation

**Date:** October 22, 2025
**Status:** COMPLETE
**Impact:** 7x improvement in query coverage vs pattern-based RAG

### Executive Summary

Successfully implemented semantic search using FAISS vector embeddings for Mew-1A, replacing the limited pattern-based RAG system. The new Vector RAG understands natural language queries and can find relevant cards semantically.

### Key Achievements

#### Vector Store
- **Technology:** FAISS (Facebook AI Similarity Search)
- **Embeddings:** all-MiniLM-L6-v2 (384 dimensions)
- **Cards Indexed:** 10,000 (from eBay sales database)
- **Files Created:**
  - `data/vector-store/faiss.index` (15 MB)
  - `data/vector-store/metadata.pkl` (953 KB)
  - `data/vector-store/cards.json` (2.7 MB)

#### Vector RAG Middleware
- **File:** `apps/mew1a/rag_middleware_vector.py` (210 lines)
- **Features:**
  - Semantic card search with relevance scoring
  - Automatic query detection
  - LLM context formatting
  - Configurable top-k results

### Performance Comparison

| System | Success Rate | Notes |
|--------|--------------|-------|
| Pattern-Based RAG | 14% (1/7 queries) | Only matches exact keywords |
| **Vector RAG** | **100% (7/7 queries)** | Understands semantic meaning |

**Improvement:** 7x better query coverage

### Pattern-Based RAG Limitations
- Only matches exact keywords
- Misses "Charizard cards" or "Pikachu pricing"
- Can't understand semantic meaning
- Brittle - breaks with different phrasing

### Vector RAG Advantages
- Understands semantic meaning
- Works with any phrasing
- Returns relevance scores (0.0-1.0)
- Finds similar cards automatically

### Example Query Results

| Query | Pattern RAG | Vector RAG |
|-------|-------------|------------|
| "Find Charizard cards" | No match | 5 relevant cards |
| "Show me Pikachu pricing" | No match | 3 Pikachu variants |
| "What's the value of PSA 10 cards?" | No match | 8 PSA 10 cards |
| "Most expensive Pokemon card" | Match | 10 high-value cards |

---

## Phase 2: v4.3 Training Data

**Date:** October 22, 2025
**Status:** READY FOR DEPLOYMENT
**Previous Phase:** Phase 1 Vector RAG - Complete

### Executive Summary

Mew-1A v4.3 training infrastructure is ready for deployment to RunPod. This version features enhanced dataset quality with removed BID hallucinations and improved card name parsing, achieving an 82.24/100 quality score.

### Quality Improvements

| Metric | v4.3 | v4.2 | Improvement |
|--------|------|------|-------------|
| **Overall Quality Score** | 82.24/100 | 79.48/100 | +2.76 pts |
| **Valid Card Names** | 92.15% | 91.50% | +0.65% |
| **Price Sanity** | 62.54% | 60.15% | +2.39% |
| **Hallucination Rate** | 6.45% | 8.12% | -1.67% |
| **BUY/PASS Quality** | 15K genuine | 22.7K (inflated) | 100% valid |

### Dataset Composition

```
Total Examples: 253,810

Breakdown:
  • Temporal eBay Data:       181,620 (71.6%)
  • Reddit Sentiment:          24,128 ( 9.5%)
  • Internal Arbitrage:        19,562 ( 7.7%)
  • Cross-Marketplace:         13,500 ( 5.3%)
  • BUY/PASS Decisions:        15,000 ( 5.9%)
                              --------
                              253,810 (100%)
```

### Key Improvements from v4.2

1. **BID Hallucination Removal**
   - v4.2: 22,700 BUY/PASS examples (many were BID hallucinations)
   - v4.3: 15,000 BUY/PASS examples (100% genuine decisions)
   - **Impact:** More accurate buy/pass recommendations

2. **Card Name Parsing**
   - Fixed parsing errors in eBay data extraction
   - Improved regex for set names and card variants
   - **Result:** 92.15% valid card names (vs 91.50% in v4.2)

3. **Price Sanity Checks**
   - Better outlier detection
   - Improved price validation
   - **Result:** 62.54% price sanity (vs 60.15% in v4.2)

### Training Configuration

- **Base Model:** meta-llama/Llama-3.2-3B-Instruct
- **Fine-tuning Method:** LoRA (Low-Rank Adaptation)
- **Output Model:** ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg

### Hyperparameters

```python
LEARNING_RATE = 2e-4
NUM_EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4  # Effective batch size = 16
MAX_LENGTH = 512 tokens
WARMUP_STEPS = 200
SAVE_STEPS = 1000
```

### LoRA Configuration

```python
lora_config = LoraConfig(
    r=16,                    # Rank
    lora_alpha=32,           # Scaling
    lora_dropout=0.05,       # Dropout
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)
```

---

## Phase 3: NanoChat Evaluation Framework

**Date:** October 23, 2025
**Status:** COMPLETE (Day 1 - Core Infrastructure Built)
**Previous Phases:** Phase 1 & 2 Complete

### Executive Summary

Successfully built a **production-ready evaluation framework** for Mew-1A, inspired by NanoChat's proven evaluation architecture. This framework provides **quantitative quality gates** to measure model performance before production deployment.

**Key Achievement:** Built the missing piece in PokeDAO's AI infrastructure - objective, reproducible evaluation metrics.

### 9 Core Files Built

#### 1. Base Architecture
**File:** `apps/mew1a/evaluation/task_base.py` (170 lines)

- Abstract `Task` class with required methods
- `TaskMixture` class for combining multiple evaluation tasks
- Dataset slicing support (start, stop, step)
- Iterator protocol (`__len__`, `__getitem__`)

```python
class Task(ABC):
    @property
    @abstractmethod
    def eval_type(self) -> str:
        """Return 'categorical' or 'generative'"""

    @abstractmethod
    def get_example(self, index: int) -> Dict[str, Any]:
        """Return test example with prompt and ground truth"""

    @abstractmethod
    def evaluate(self, example: Dict, model_output: str) -> Dict:
        """Score model output against ground truth"""
```

#### 2. Pricing Accuracy Task
**File:** `apps/mew1a/evaluation/pricing_accuracy.py` (266 lines)

- Categorical evaluation of price prediction accuracy
- Multiple choice (4 price ranges), fast logit-based
- Metrics: Exact accuracy, ±5%/±10%/±15% tolerance
- Test Data: 1,000 historical deals

#### 3. Card Knowledge Task
**File:** `apps/mew1a/evaluation/card_knowledge.py` (245 lines)

- Tests model's knowledge of card metadata
- Set names, rarities, card numbers
- Multiple choice format

#### 4. BUY/PASS Decision Task
**File:** `apps/mew1a/evaluation/buy_pass.py` (280 lines)

- Evaluates investment decision accuracy
- Ground truth from policy engine rules
- BUY if discount ≥10%, PASS if premium ≥10%, HOLD otherwise

#### 5. Market Prediction Task
**File:** `apps/mew1a/evaluation/market_prediction.py` (210 lines)

- Generative evaluation of price forecasts
- BPB (Bits Per Byte) metric
- Future price direction accuracy

#### 6. Categorical Evaluator
**File:** `apps/mew1a/evaluation/categorical_evaluator.py` (190 lines)

- Fast logit-based evaluation
- No generation required
- Compares logprobs of answer choices

#### 7. Generative Evaluator
**File:** `apps/mew1a/evaluation/generative_evaluator.py` (175 lines)

- Full text generation evaluation
- BPB calculation
- Regex-based answer extraction

#### 8. Runner
**File:** `apps/mew1a/evaluation/runner.py` (285 lines)

- Orchestrates evaluation tasks
- Parallel execution support
- Progress tracking and reporting

#### 9. Quality Gates
**File:** `apps/mew1a/evaluation/quality_gates.py` (165 lines)

- Production deployment gates
- Automatic pass/fail determination
- Comparison with baseline versions

### Quality Gates

| Task | Minimum Score | Purpose |
|------|---------------|---------|
| Pricing Accuracy | ≥75% | Price predictions within ±10% |
| Card Knowledge | ≥80% | Metadata correctness |
| BUY/PASS Decisions | ≥80% | Investment recommendations |
| Market Prediction | BPB < 2.5 | Generative quality |

### Test Data

- **Total Examples:** 2,024
- **Pricing:** 1,000 historical deals
- **Card Knowledge:** 500 metadata questions
- **BUY/PASS:** 324 decision scenarios
- **Market:** 200 prediction questions

### Architecture (NanoChat Pattern)

```
evaluation/
├── task_base.py          # Abstract base classes
├── tasks/
│   ├── pricing_accuracy.py
│   ├── card_knowledge.py
│   ├── buy_pass.py
│   └── market_prediction.py
├── evaluators/
│   ├── categorical_evaluator.py
│   └── generative_evaluator.py
├── runner.py             # Orchestration
└── quality_gates.py      # Pass/fail logic
```

---

## Timeline Summary

| Date | Phase | Achievement |
|------|-------|-------------|
| Oct 22, 2025 | Phase 1 | Vector RAG (7x improvement) |
| Oct 22, 2025 | Phase 2 | v4.3 Dataset (253K examples, 82.24/100 quality) |
| Oct 23, 2025 | Phase 3 | NanoChat Evaluation (9 modules, 2,024 tests) |

---

## Source Files

This document consolidates the following files from the root directory:

- PHASE1-VECTOR-RAG-COMPLETE.md (Oct 22, 2025)
- PHASE2-MEW1A-V4.3-TRAINING-READY.md (Oct 22, 2025)
- PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md (Oct 23, 2025)
