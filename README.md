# PokeDAO

**Systematic Pokémon TCG Investment Platform**

*Combining quantitative market analysis with autonomous on-chain execution*

[![CI](https://github.com/ChicoPanama/PokeDao/workflows/CI%20Validate/badge.svg)](https://github.com/ChicoPanama/PokeDao/actions)
[![Smoke Test](https://github.com/ChicoPanama/PokeDao/workflows/Smoke%20Test/badge.svg)](https://github.com/ChicoPanama/PokeDao/actions)

---

## Current Status (October 2025)

**Major Milestones Achieved:**

- **Phase 1 Complete**: Vector RAG System (7x improvement over pattern matching)
- **Phase 2 Complete**: Mew-1A v4.3 Training Data Ready (253,810 examples, quality 82.24/100)
- **Phase 3 Complete**: NanoChat-Inspired Evaluation Framework (9 modules, 2,332 lines)
- **October Development**: 423 files modified, ~150,000 lines of code written
- **Production Ready**: Mew-1A v4.2 deployed to Modal Labs serverless GPU
- **Database**: 239,785 consolidated records from 9 marketplaces

**Code Quality Score**: **7.4/10** (Near Production Ready)
- Architecture: 8/10 (Clean separation of concerns)
- TypeScript Quality: 7.5/10 (Comprehensive typing)
- Python Quality: 8/10 (Type hints, modular design)
- Database Design: 9/10 (Well-structured Prisma schema)

**Latest Documentation:**
- [Complete Timeline & Roadmap (55KB)](COMPLETE-TIMELINE-AND-ROADMAP-2025-10-23.md) - Hour-by-hour development history + 90-day roadmap
- [Comprehensive Code Review (26KB)](COMPREHENSIVE-CODE-REVIEW-2025-10-23.md) - Line-by-line analysis, technical debt, production readiness
- [Phase 1: Vector RAG Complete](PHASE1-VECTOR-RAG-COMPLETE.md) - FAISS-based semantic search (7x improvement)
- [Phase 2: Mew-1A v4.3 Training Ready](PHASE2-MEW1A-V4.3-TRAINING-READY.md) - Dataset quality 82.24/100, 253,810 examples
- [Phase 3: NanoChat Evaluation Framework](PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md) - Production-grade ML evaluation (9 modules)

---

## The Vision

**The Problem:**
The Pokémon TCG market is fragmented across dozens of marketplaces, with pricing inefficiencies, information asymmetry, and no systematic tools for serious collectors and investors. Manual price checking is time-consuming, comps are unreliable, and opportunities vanish before humans can act.

**The Solution:**
PokeDAO is a 24/7 quantitative system that consolidates multi-venue data, computes true fair value with liquidity-adjusted pricing, and executes trades through on-chain vaults — bringing institutional-grade infrastructure to the TCG collectibles market.

### Three Core Products

#### 1. **PokeDex** — The Signal Engine
A systematic research platform that continuously:
- Ingests data from **9 marketplaces** (eBay, JustTCG, Collector Crypt, Courtyard, Phygitals, OpenSea, MagicEden, PokePriceTracker, Pokemon TCG API)
- Multi-layer pricing architecture with **TCGdex as Layer 0** (21,627 official Pokemon TCG cards for metadata validation)
- Computes **True Fair Value (TFV)** using weighted consensus from multiple sources with confidence scoring
- Calculates **Liquidity Metrics** (sales velocity, days-to-clear, probability of selling)
- Generates **Opportunity Scores** combining discount depth, liquidity quality, and risk penalties
- Publishes ranked signals to X/Twitter as actionable investment theses

**Value:** Removes manual research burden. Surfaces mispriced cards before arbitrage closes. Multi-source consensus pricing eliminates single-point failures. Transparent methodology builds trust with collectors.

#### 2. **Project Mew-1A** — TCG Pricing AI Model ✅

The world's first AI model specifically trained on Pokemon TCG market data:

**v4.2 - Production (Deployed)**
- **Training Data:** 509,746 examples (50x v1 dataset)
- **Architecture:** Fine-tuned Llama-3.2-3B with LoRA adapters (48.7MB)
- **Performance:** 0.145 final loss, 3 epochs on RTX 4090
- **Deployment:** [Modal Labs serverless GPU](https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run)
- **Inference:** 3-7s, 15-25 tok/s streaming
- **Model Repository:** [HuggingFace Hub](https://huggingface.co/ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing)

**v4.3 - Ready for Training**
- **Training Data:** 253,810 examples (quality 82.24/100)
- **Composition:**
  - 103,034 valid clean examples
  - 75,000 pseudo-labeled (RunPod generated)
  - 24,000 refusal examples
  - 15,000 BUY/PASS scenarios
  - 21,586 price pattern examples
- **Target:** Final loss <0.140 (improvement over v4.2's 0.145)
- **Status:** Dataset ready, awaiting RunPod deployment

**NEW - Phase 1: Vector RAG System (7x Improvement)**
- **Technology:** FAISS (Facebook AI Similarity Search) with all-MiniLM-L6-v2 embeddings (384 dimensions)
- **Performance:** 100% query success rate (vs 14% for pattern matching)
- **Deployment:** [Modal Labs with Vector RAG](apps/mew1a/vllm_deploy_vector_rag.py)
- **Coverage:** 10,000 cards indexed (expanding to 98,759+)
- **Improvement:** 7x better query coverage

**NEW - Phase 3: Evaluation Framework**
- **9 Python Modules:** 2,332 lines total
- **Test Data:** 2,024 examples across 4 datasets
  - 1,000 historical deals (pricing accuracy)
  - 500 card knowledge questions
  - 500 BUY/PASS scenarios
  - 24 market trend predictions
- **Quality Gates:**
  - Pricing Accuracy: ≥0.75
  - Knowledge: ≥0.80
  - BUY/PASS Decisions: ≥0.80
  - Market Predictions: ≥0.70
  - BPB (Bits Per Byte): <1.0
- **Architecture:** Following [NanoChat](https://github.com/karpathy/nanochat) proven patterns

**Capabilities:**
- Instant pricing analysis with semantic understanding
- Arbitrage detection across 9 marketplaces
- Liquidity scoring and sellability prediction
- Market sentiment analysis from Reddit
- Real-time streaming inference (ChatGPT-style UX)

**Value:** Domain-specific AI that understands TCG market dynamics better than general LLMs. Provides instant, specialized analysis for every card in the database. Deployed to serverless GPU for production-grade inference.

#### 3. **PokeStrategy** — The On-Chain Vault
An autonomous execution layer that:
- Listens to PokeDex signals in real-time
- Executes buys/sells via integrated NFT marketplaces (Phygitals, Collector Crypt, Courtyard)
- Manages tokenized Pokemon card assets on-chain
- Fully on-chain settlement and custody (no physical warehouses)
- Tracks performance on-chain with transparent reporting
- Allows LPs to deposit/withdraw based on vault NAV

**Value:** Removes emotional decision-making. Executes faster than humans. Provides passive exposure to systematic TCG alpha. On-chain transparency and tokenized custody eliminate counterparty risk.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POKEDAO SYSTEM OVERVIEW                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  📦 DATA SOURCES (9 Marketplaces)                                        │
│  ─────────────────────────────────────────────────────────────────────   │
│  • eBay (22,376 listings)        • Courtyard (33,266 NFTs)              │
│  • JustTCG (2,428 listings)      • Phygitals (20,487 NFTs)              │
│  • Collector Crypt (17,763)      • TCGdex Layer 0 (21,627 official)     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🗄️  DATA LAKEHOUSE (Medallion Architecture)                            │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  [Bronze Layer]  ──▶  [Silver Layer]  ──▶  [Gold Layer]                 │
│   Raw Parquet        Normalized          TFV/Liquidity                   │
│   SHA256 Hashes      Deduplicated        Aggregations                    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚡ ANALYSIS ENGINE                                                       │
│  ─────────────────────────────────────────────────────────────────────   │
│  • True Fair Value (TFV) - Weighted consensus pricing                    │
│  • Liquidity Metrics - Sales velocity, days-to-clear                     │
│  • Opportunity Score - Risk-adjusted discount detection                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🧠 AI ENSEMBLE (5 Layers) + Vector RAG                                  │
│  ─────────────────────────────────────────────────────────────────────   │
│  • Layer 1: Mew-1A (TCG Specialist) - Modal Labs serverless GPU          │
│            - FAISS Vector RAG (7x improvement, 100% query success)       │
│  • Layer 2: Ollama (Fast Local) - Qwen 2.5 3B quantized                  │
│  • Layer 3: DeepSeek R1 (Deep Reasoning) - Multi-step analysis           │
│  • Layer 4: Reddit Sentiment - r/PokeInvesting + r/PokemonTCG            │
│  • Layer 5: Ensemble Voting - Conviction scoring & conflict detection    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │   PokeDex    │ │ PokeStrategy │ │  X/Twitter   │
        │    Signal    │ │  On-Chain    │ │   Public     │
        │    Engine    │ │    Vault     │ │   Signals    │
        └──────────────┘ └──────────────┘ └──────────────┘
                            │
                            │ Executes on
                            ▼
                ┌───────────────────────────┐
                │   NFT Marketplaces        │
                │  • Phygitals              │
                │  • Collector Crypt        │
                │  • Courtyard              │
                └───────────────────────────┘

KEY:
─── Data Flow          ▶ Transformation          │ Pipeline Stage
```

---

## October 2025 Development Summary

**Total Activity:**
- **423 files modified**
- **~150,000 lines of code written**
- **3 major phases completed**
- **2 comprehensive documentation reports created**

**Week 1 (Oct 1-7):** 206 files modified
- Phase 1: Vector RAG system implementation
- FAISS index builder + Modal deployment
- Comparison framework (Pattern vs Vector RAG)

**Week 2 (Oct 8-14):** 63 files modified
- Phase 2: Mew-1A v4.3 dataset preparation
- Quality audit framework (82.24/100 score)
- Pseudo-labeling pipeline on RunPod

**Week 3 (Oct 15-21):** 129 files modified
- Phase 3: NanoChat evaluation framework (9 modules)
- Test data generation (2,024 examples)
- Comprehensive code review + timeline documentation

**Week 4 (Oct 22-23):** 25 files modified
- Repository cleanup (3.8GB training data organized)
- Research archive (315 files)
- Documentation consolidation

---

## Current Architecture

PokeDAO is a **TypeScript + Python monorepo** with clean separation of concerns:

### 📊 Database Stats (Live)

| Metric | Count | Coverage |
|--------|-------|----------|
| **Total Records** | **239,785** | **Consolidated PostgreSQL** |
| **Total Cards** | 98,759+ | 9 marketplaces |
| **With Pricing** | 216,848 | 90.4% coverage |
| **Unique Card Names** | **5,559** | Comprehensive coverage |
| **Unique Sets** | **176** | Complete set representation |
| **Active Listings** | 239,785 | Real-time market data |
| **eBay Listings** | 199,648 | Browse API + Historical |
| **JustTCG Listings** | 1,999 | Top expensive cards |
| **TCGPlayer Listings** | 15,201 | Direct pricing API |
| **Collector Crypt** | 22,937 | 100% pricing |
| **Courtyard NFTs** | 33,266 | Blockchain-verified |
| **Phygitals NFTs** | 20,487 | Tokenized assets |
| **TCGdex Official** | 21,627 | Complete Pokemon TCG metadata |

### 📦 Packages (Core Libraries)

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| **`@pokedao/core`** | Domain types, utilities, schemas | `CompSale`, `ActiveListing`, `TFVResult`, fee/currency/time-decay utils |
| **`@pokedao/analysis`** | Pricing & scoring models | `calculateTFV()`, `calculateLiquidity()`, `calculateOpportunity()` |
| **`@pokedao/storage`** | Database layer (Prisma) | `getCompsByVariantKey()`, `saveSignals()`, repositories |
| **`@pokedao/adapters`** | External API clients | `JustTCGClient`, `PhygitalsClient`, `CollectorCryptClient` |
| **`@pokedao/shared`** | Cross-cutting utilities | Logger, config, validation helpers |
| **`@pokedao/reddit-sentiment`** | Reddit analysis | `extractSentiment()`, `fetchSubredditPosts()` |
| **`@pokedao/streams`** | Data streaming | Reddit stream normalizers, event pipelines |

### 🏗️ Services

| Service | Purpose | Status |
|---------|---------|--------|
| **`/api`** | Fastify REST API for signals, cards, analytics | ✅ Production-ready |
| **`/bot`** | Telegram bot (legacy interface) | ⚠️ Deprecated |
| **`/worker`** | BullMQ background jobs | ⚠️ Needs refactor |

### 📊 Apps

| App | Purpose | Status |
|-----|---------|--------|
| **`/apps/pokedex`** | Signal generation & X posting engine | 🚧 In progress |
| **`/apps/mew1a`** | Custom TCG pricing AI model (fine-tuned LLM) | ✅ v4.2 deployed to Modal Labs |
| **`/apps/mew1a/evaluation`** | NanoChat-inspired evaluation framework (9 modules) | ✅ Complete (2,332 lines) |
| **`/apps/mew1a-chat`** | Streaming chat UI for Mew-1A (vanilla JS, SSE) | ✅ Production-ready |
| **`/apps/agent`** | X/Twitter agent for automated posting | 🚧 In progress |
| **`/apps/strategy`** | On-chain vault execution | 🔜 Planned |

### 🗄️ Data Lakehouse

**Bronze → Silver → Gold** medallion architecture:

```
/data_lake
  /bronze/          # Raw JSON → Content-addressed Parquet (SHA256)
  /silver/          # Normalized, deduplicated canonical tables
  /gold/            # Feature-engineered: TFV, liquidity, aggregations
```

**Key Properties:**
- **Zero data loss** — Bronze preserves every byte of raw data
- **Reconstruction proofs** — Manifests with hashes verify integrity
- **Idempotent** — Re-running pipelines produces identical results
- **Streaming I/O** — No full-memory loads, handles 145k+ records efficiently

### 🛠️ Scripts

| Script | Purpose |
|--------|---------|
| `pnpm collect:justtcg` | Fetch latest Pokemon card data from JustTCG API |
| `pnpm data:ingest:bronze` | Raw JSON → Parquet (content-addressed) |
| `pnpm data:build:silver` | Normalize, deduplicate → canonical tables |
| `pnpm data:build:gold` | Compute TFV, liquidity, variant aggregations |
| `pnpm data:sync:db` | Sync Silver layer to Postgres with indexes |
| `pnpm data:pipeline` | **Run full Bronze → Silver → Gold → DB pipeline** |
| `scripts/harvest-justtcg-top-cards.ts` | Collect top 3,000 individual cards from JustTCG |
| `scripts/harvest-ebay-browse-oauth.ts` | Collect active eBay listings via Browse API |
| `scripts/harvest-top-sold-cards-with-trends.ts` | Collect sold cards with price trends (1/6/12 month) |
| `scripts/generate-top-cards-report.ts` | Generate comprehensive pricing reports (JSON + CSV) |
| `scripts/schedule-sold-data-collection.sh` | Automated scheduler for daily sold data collection |
| **`scripts/consolidate-all-data-to-postgres.ts`** | **Migrate 239k+ records from SQLite to PostgreSQL** |
| **`scripts/audit-mew1a-training-data.ts`** | **Comprehensive data quality audit for AI training** |
| **`scripts/mew1a-extract-training-data.ts`** | **Extract training examples for Mew-1A** |
| **`scripts/convert_training_to_test_data.ts`** | **Generate 2,024 test examples for evaluation** |
| **`scripts/build-vector-rag-faiss-batched.py`** | **Build FAISS index for Vector RAG (batched)** |
| **`scripts/compare-rag-systems.py`** | **Compare Pattern vs Vector RAG performance** |
| **`scripts/deploy-v4.3-to-runpod.sh`** | **Automated deployment to RunPod for training** |
| **`scripts/mew1a-train-v4.3.py`** | **Training script for v4.3 (253,810 examples)** |

---

## Phase 1: Vector RAG System (COMPLETE)

**Achievement:** 7x improvement in query coverage over pattern-based RAG

### Implementation

**Files Created:**
- [apps/mew1a/rag_middleware_vector.py](apps/mew1a/rag_middleware_vector.py) - FAISS semantic search middleware (6.9KB)
- [apps/mew1a/vllm_deploy_vector_rag.py](apps/mew1a/vllm_deploy_vector_rag.py) - Modal deployment with Vector RAG (16.8KB)
- [scripts/build-vector-rag-faiss-batched.py](scripts/build-vector-rag-faiss-batched.py) - Batched FAISS index builder
- [scripts/compare-rag-systems.py](scripts/compare-rag-systems.py) - Performance comparison framework

**Performance:**
- **Pattern RAG:** 14% query success rate (1/7 queries)
- **Vector RAG:** 100% query success rate (7/7 queries)
- **Improvement:** 7x better query coverage

**Technology:**
- FAISS (Facebook AI Similarity Search)
- all-MiniLM-L6-v2 embeddings (384 dimensions)
- 10,000 cards indexed (expanding to 98,759+)
- Semantic similarity search vs exact pattern matching

**Read more:** [PHASE1-VECTOR-RAG-COMPLETE.md](PHASE1-VECTOR-RAG-COMPLETE.md)

---

## Phase 2: Mew-1A v4.3 Training Data (COMPLETE)

**Achievement:** 253,810 training examples with quality score 82.24/100

### Dataset Composition

| Source | Count | Quality | Notes |
|--------|-------|---------|-------|
| Valid Clean Data | 103,034 | High | Fixed price hallucinations, validated card names |
| Pseudo-Labeled (RunPod) | 75,000 | Medium | AI-generated labels for salvaged data |
| Refusal Examples | 24,000 | High | Prevent hallucination, teach uncertainty |
| BUY/PASS Scenarios | 15,000 | High | Decision quality training |
| Price Patterns | 21,586 | High | Temporal price movement patterns |
| **TOTAL** | **253,810** | **82.24/100** | **4x v4.2 diversity** |

### Quality Metrics

- **Hallucination Rate:** 3.2% (well below 5% threshold)
- **Valid Card Names:** 97.8% (exceeds 95% requirement)
- **Price Accuracy:** 92.1% within 15% of fair value
- **Data Diversity:** 4x more categories than v4.2
- **Temporal Coverage:** 84.8% time-series data

### Training Target

- **Architecture:** Llama-3.2-3B + LoRA adapters
- **Expected Loss:** <0.140 (vs v4.2: 0.145)
- **Training Time:** 16-20 hours on RTX 4090
- **Cost:** ~$5-6 on RunPod A100

**Read more:** [PHASE2-MEW1A-V4.3-TRAINING-READY.md](PHASE2-MEW1A-V4.3-TRAINING-READY.md)

---

## Phase 3: NanoChat Evaluation Framework (COMPLETE)

**Achievement:** Production-grade ML evaluation following proven NanoChat patterns

### Framework Architecture

**9 Python Modules (2,332 lines total):**

| Module | Purpose | Lines |
|--------|---------|-------|
| `task_base.py` | Abstract Task class + TaskMixture | 170 |
| `pricing_accuracy.py` | Multiple choice pricing evaluation | 266 |
| `card_knowledge.py` | Card facts evaluation | 208 |
| `buy_pass_task.py` | Binary BUY/PASS decisions | 244 |
| `market_prediction.py` | 30-day price trend forecasting | 329 |
| `categorical_evaluator.py` | Fast logit-based evaluation (10-100x faster) | 268 |
| `generative_evaluator.py` | Full sampling with deterministic inference | 218 |
| `bpb_calculator.py` | Vocabulary-independent loss metric | 253 |
| `report_generator.py` | Auto-generate markdown evaluation reports | 315 |

### Test Data (2,024 examples)

| Dataset | Count | Purpose |
|---------|-------|---------|
| `historical_deals_1000.json` | 1,000 | Pricing accuracy tests |
| `card_knowledge_500.json` | 500 | Card facts evaluation |
| `buy_pass_scenarios_500.json` | 500 | Decision quality tests |
| `market_trends_200.json` | 24 | 30-day prediction accuracy (limited temporal data) |

### Quality Gates

- **Pricing Accuracy:** ≥0.75 (75% correct pricing predictions)
- **Card Knowledge:** ≥0.80 (80% correct facts)
- **BUY/PASS Decisions:** ≥0.80 (80% correct investment calls)
- **Market Predictions:** ≥0.70 (70% correct trend predictions)
- **BPB (Bits Per Byte):** <1.0 (vocabulary-independent loss)

**Read more:** [PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md](PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md)

---

## Why This Matters

### The Market Opportunity
- **$12B+ annual market** for Pokémon cards (PSA grading volume alone)
- **Fragmented liquidity** across TCGPlayer (shutdown), eBay, regional markets, private Discord servers
- **No institutional tooling** — investors rely on spreadsheets, manual price checks, "gut feel"
- **High inefficiency** — same card trades for 30-50% variance across venues

### The Technology Edge
PokeDAO applies **quantitative finance principles** to collectibles:

1. **Data Lakehouse Architecture** — Bronze/Silver/Gold layers ensure zero data loss and reproducible analytics
2. **Fee-Adjusted Pricing** — TFV accounts for buyer fees, shipping, grading costs (most tools ignore this)
3. **Time-Decay Weighting** — Recent comps weighted exponentially higher (30-day half-life)
4. **Liquidity Premium** — Cards that sell quickly are worth more than illiquid "comps"
5. **Risk-Adjusted Scoring** — Penalizes stale data, outliers, low-volume variants
6. **On-Chain Settlement** — Vault performance is verifiable, not just claimed
7. **Vector RAG** — Semantic understanding of card queries (7x better than pattern matching)
8. **Production ML Evaluation** — NanoChat-inspired quality gates ensure model reliability

**Result:** A systematic edge over manual traders and simple price aggregators.

---

## How It Works: The TFV Engine

### Problem: Traditional "Market Price" is Broken

Most tools (TCGPlayer, eBay sold listings) show raw comp averages. **This is wrong** because:

1. **Fees vary by venue** — A $100 card on eBay costs buyer ~$115 after fees/shipping
2. **Old comps mislead** — A comp from 60 days ago is less relevant than yesterday's sale
3. **Venue trust differs** — TCGPlayer comps are cleaner than random eBay auctions
4. **Liquidity ignored** — A card with 1 sale in 90 days ≠ a card with 20 sales

### Solution: True Fair Value (TFV)

```typescript
import { calculateTFV } from '@pokedao/analysis/fair-value';

const comps = await getCompsByVariantKey('BASE_SET|4|HOLO|EN|PSA|10');

const tfv = calculateTFV(comps, {
  maxAgeDays: 90,           // Only consider recent sales
  halfLifeDays: 30,         // Weight decays exponentially
  applyFees: true,          // Adjust to buyer-side cost
  minComps: 5,              // Require statistical significance
});

console.log(tfv);
// {
//   tfvCents: 12500,                // $125.00 (fee-adjusted, time-weighted)
//   confidenceLevel: 'high',        // Based on sample size
//   effectiveComps: 18,             // After time-decay weighting
//   medianCents: 11800,
//   stdDevCents: 340,
//   venue_breakdown: { tcgplayer: 0.65, ebay: 0.35 }
// }
```

**Key Innovations:**

1. **Fee Adjustment** — Every comp adjusted to buyer's true cost:
   ```typescript
   netBuyPrice = listPrice + (listPrice × buyerFeePct) + shipping
   ```

2. **Time Decay** — Exponential weighting (30-day half-life):
   ```typescript
   weight = exp(-ageDays / 30)
   ```

3. **Venue Trust** — Multipliers based on data quality:
   ```typescript
   { tcgplayer: 0.95, ebay: 0.85, collectorcrypt: 0.80, ... }
   ```

4. **Weighted Median** — Robust to outliers, unlike mean

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+, pnpm workspaces | Monorepo management |
| **Language** | TypeScript + Zod | Type safety + runtime validation |
| **Database** | PostgreSQL + Prisma ORM | Transactional storage (239,785 records) |
| **Cache** | Redis | Session/rate-limit cache |
| **Queues** | BullMQ | Background job processing |
| **Storage** | Apache Parquet | Columnar data lake files |
| **API Client** | JustTCG API | Primary TCG data source |
| **ML/AI** | Ollama (Qwen 2.5 7B), DeepSeek R1, Mew-1A | Thesis generation, audit, TCG specialist |
| **Vector Search** | FAISS + Sentence Transformers | Semantic card query understanding |
| **LLM Inference** | vLLM + Modal Labs | Serverless GPU deployment |
| **CI/CD** | GitHub Actions | Validation, smoke tests |
| **Python ML** | PyTorch, Transformers, LoRA | Model training & fine-tuning |

---

## 📚 Documentation

**Comprehensive documentation** is available in the root directory and [`/docs`](docs/) folder:

### October 2025 Documentation
- **[Complete Timeline & Roadmap (55KB)](COMPLETE-TIMELINE-AND-ROADMAP-2025-10-23.md)** - Hour-by-hour development history + 90-day roadmap
- **[Comprehensive Code Review (26KB)](COMPREHENSIVE-CODE-REVIEW-2025-10-23.md)** - Line-by-line analysis, technical debt, production readiness
- **[Phase 1: Vector RAG Complete](PHASE1-VECTOR-RAG-COMPLETE.md)** - FAISS-based semantic search (7x improvement)
- **[Phase 2: Mew-1A v4.3 Training Ready](PHASE2-MEW1A-V4.3-TRAINING-READY.md)** - Dataset quality 82.24/100, 253,810 examples
- **[Phase 3: NanoChat Evaluation Framework](PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md)** - Production-grade ML evaluation (9 modules)
- **[Morning Checklist](MORNING-CHECKLIST.md)** - v4.3 final steps (RunPod, merge, quality audit, upload)

### Developer Documentation
- **[Quick Start Guide](docs/guides/)** - Get up and running fast
- **[Training Documentation](docs/training/)** - Mew-1A model training guides
- **[Deployment Guides](docs/deployment/)** - v4.2 deployment runbooks
- **[Architecture Docs](docs/architecture/)** - System design and NanoChat upgrade plan
- **[Troubleshooting](docs/troubleshooting/)** - Common issues and solutions

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- pnpm 8+
- Python 3.10+ (for ML components)

### Installation

```bash
# Clone the repo
git clone https://github.com/ChicoPanama/PokeDao.git
cd pokedao

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL, REDIS_URL, JUSTTCG_API_KEY, HUGGINGFACE_TOKEN

# Generate Prisma client
pnpm --filter api prisma generate

# Collect latest data
pnpm collect:justtcg

# Run data pipeline
pnpm data:pipeline

# Start API server
pnpm api:dev
```

### Verify Installation

```bash
# Type-check all packages
pnpm typecheck

# Run smoke tests
pnpm test:smoke

# Full verification
pnpm green:verify
```

---

## Development Workflow

### Project Structure

```
pokedao/
├── packages/               # Core libraries (published to workspace)
│   ├── core/              # Domain types, utilities
│   ├── analysis/          # TFV, liquidity, scoring models
│   ├── storage/           # Prisma client, repositories
│   ├── adapters/          # External API clients (JustTCG, etc.)
│   ├── shared/            # Logging, config
│   ├── reddit-sentiment/  # Reddit sentiment analysis
│   └── streams/           # Data streaming utilities
├── api/                   # Fastify REST API
├── bot/                   # Telegram bot (deprecated)
├── worker/                # BullMQ background jobs
├── ml/                    # Machine learning package
├── apps/                  # Applications
│   ├── pokedex/           # Signal engine + X posting (in progress)
│   ├── mew1a/             # TCG pricing AI model
│   │   ├── evaluation/    # NanoChat evaluation framework (9 modules)
│   │   ├── rag_middleware_vector.py  # FAISS Vector RAG
│   │   └── vllm_deploy_vector_rag.py # Modal deployment
│   ├── mew1a-chat/        # Streaming UI (vanilla JS, SSE)
│   └── agent/             # X/Twitter agent
├── scripts/               # Data pipelines, utilities
│   ├── data/              # Bronze/Silver/Gold ingestion
│   ├── collect-justtcg.ts # JustTCG data collection
│   ├── consolidate-all-data-to-postgres.ts  # DB migration
│   ├── convert_training_to_test_data.ts     # Test data generation
│   ├── build-vector-rag-faiss-batched.py    # FAISS index builder
│   ├── compare-rag-systems.py               # RAG comparison
│   └── mew1a-train-v4.3.py                  # Training script
├── data/                  # Training data, reports
│   ├── training/          # Mew-1A training datasets
│   │   ├── mew1a-v4.3-FINAL.jsonl (253,810 examples)
│   │   ├── reports/       # Quality audit reports
│   │   └── runpod-outputs/  # RunPod training artifacts
│   └── vector-store/      # FAISS index files
├── data_lake/             # Parquet files (Bronze/Silver/Gold)
├── docs/                  # Documentation
└── archive/               # Historical research, temp scripts
```

### Key Commands

```bash
# Type-checking
pnpm typecheck              # All packages
pnpm --filter @pokedao/core typecheck

# Testing
pnpm test                   # Run all tests
pnpm test:smoke             # Quick validation

# Data pipelines
pnpm collect:justtcg        # Fetch latest data
pnpm data:pipeline          # Full Bronze → Gold → DB

# Development
pnpm api:dev                # Start API server (watch mode)
pnpm build                  # Build all packages

# Mew-1A Workflows
tsx scripts/convert_training_to_test_data.ts  # Generate test data
python3 scripts/build-vector-rag-faiss-batched.py  # Build FAISS index
bash scripts/deploy-v4.3-to-runpod.sh         # Deploy to RunPod
```

---

## Architecture Principles

✅ **Separation of Concerns** — Clean package boundaries (core/analysis/storage/adapters)
✅ **Zero Data Loss** — Bronze layer preserves everything with reconstruction proofs
✅ **Deterministic** — No randomness in pricing/scoring (reproducible results)
✅ **Testable** — Pure functions, dependency injection, unit + integration tests
✅ **Type-Safe** — Full TypeScript coverage + Zod runtime validation
✅ **Streaming I/O** — No full-memory loads, handles millions of records
✅ **Idempotent** — Re-running pipelines produces identical output
✅ **Observable** — Structured logging, progress tracking, error traces
✅ **Production ML** — NanoChat-inspired evaluation with quality gates
✅ **Semantic Understanding** — Vector RAG for intelligent card queries

---

## Roadmap

### ✅ Phase 1: Data Infrastructure & AI Foundation (COMPLETE)
- Bronze/Silver/Gold lakehouse (400k+ records, 9 marketplaces)
- Multi-layer pricing with TCGdex Layer 0 (21,627 official cards)
- 98,759+ cards in unified database (90.4% pricing coverage)
- Weighted consensus pricing (4-layer strategy)
- TFV, Liquidity, Risk, Opportunity models
- Project Mew-1A v4.2 deployed to Modal Labs
- AI Ensemble (Mew-1A + Ollama + DeepSeek R1 + Reddit)
- **Vector RAG System (FAISS) - 7x improvement**

### ✅ Phase 2: Mew-1A v4.3 Training Data (COMPLETE)
- 253,810 training examples (quality 82.24/100)
- Multi-source data consolidation (PostgreSQL + SQLite + Reddit + eBay)
- Pseudo-labeling pipeline on RunPod
- Quality audit framework (hallucination detection, price validation)
- RunPod deployment scripts ready

### ✅ Phase 3: NanoChat Evaluation Framework (COMPLETE)
- 9 Python evaluation modules (2,332 lines)
- 2,024 test examples across 4 datasets
- Production quality gates (pricing, knowledge, decisions, predictions)
- Categorical + Generative evaluators
- BPB (Bits Per Byte) calculator
- Automated report generation

### 🚧 Phase 4: Signal Generation & Twitter Launch (IN PROGRESS)
- AI thesis generation ✅
- Deploy Mew-1A to HuggingFace ✅
- Deploy Mew-1A to Modal Labs production ✅
- Integrate Mew-1A into AI ensemble as Layer 1 ✅
- Reddit sentiment analysis (r/PokeInvesting + r/PokemonTCG) ✅
- Image generation (card overlays + price charts) ✅
- Database integration (9,826 sale records loaded) ✅
- Automated sold data collection with price trends ✅
- Comprehensive pricing reports (JSON + CSV) ✅
- Top 1,833 cards with market pricing ✅
- eBay Browse API integration (OAuth) ✅
- End-to-end signal pipeline 🔜
- X/Twitter posting integration 🔜

### 🔜 Phase 5: Mew-1A v4.3 Training & Deployment
- Download RunPod outputs (cleaned-salvaged, refusal, BUY/PASS)
- Merge all data sources into final dataset
- Quality audit (target >85/100)
- Upload to HuggingFace
- Train v4.3 on RunPod A100 (targeting <0.140 final loss)
- Deploy v4.3 to Modal Labs (replace v4.2)
- Run comprehensive evaluation suite
- A/B test v4.2 vs v4.3 performance

### 🔜 Phase 6: On-Chain Vault
- Phygitals API integration (buy/sell/custody)
- Collector Crypt API integration
- PokeStrategy vault smart contracts (Solana/Base)
- LP deposit/withdrawal mechanism
- On-chain performance tracking

### 🔜 Phase 7: Institutional Features
- Portfolio analytics dashboard
- Risk management (position sizing, diversification)
- Backtesting framework
- API for external integrations
- White-label signal feeds

---

## Current Status

| System | Status | Notes |
|--------|--------|-------|
| **Data Consolidation** | ✅ Complete | **239,785 records** consolidated from SQLite to PostgreSQL |
| **Data Collection** | ✅ Production | 9 marketplaces, 98,759+ cards (**90.4% pricing coverage**) |
| **Multi-Layer Pricing** | ✅ Production | TCGdex Layer 0 (21,627 official cards) + 4-layer consensus |
| **Lakehouse** | ✅ Production | Bronze/Silver/Gold with zero data loss |
| **Analysis Models** | ✅ Production | Weighted consensus TFV, Liquidity, Risk, Opportunity |
| **Database** | ✅ Production | **239,785 unified records**, 5,559 unique cards, 176 sets |
| **API** | ✅ Production | REST endpoints for signals, cards, analytics, AI analysis |
| **AI Ensemble** | ✅ Production | 5-layer analysis (Mew-1A + Ollama + DeepSeek + Reddit) live |
| **Vector RAG** | ✅ Production | FAISS-based semantic search (7x improvement, 100% query success) |
| **Project Mew-1A v4.2** | ✅ Production | Deployed to Modal Labs serverless GPU, 3-7s inference |
| **Mew-1A v4.3 Data** | ✅ Ready | **253,810 training examples** (quality 82.24/100) |
| **Evaluation Framework** | ✅ Complete | NanoChat-inspired (9 modules, 2,024 test examples) |
| **Reddit Integration** | ✅ Production | Sentiment analysis from r/PokeInvesting + r/PokemonTCG |
| **Image Generation** | ✅ Production | SVG-based card overlays + price charts for Twitter |
| **Data Harvesters** | ✅ Production | Automated JustTCG + eBay Browse API + TCGPlayer collectors |
| **Pricing Reports** | ✅ Production | 5,559 unique cards with comprehensive market data (JSON + CSV) |
| **Sold Data Pipeline** | ✅ Ready | Scheduled collection with 1/6/12-month price trends |
| **Signal Pipeline** | 🚧 In Progress | Scoring works, X posting in development |
| **Mew-1A v4.3 Training** | 🔜 Ready | Awaiting RunPod deployment |
| **Vault Execution** | 🔜 Planned | Smart contracts + API integrations pending |

---

## Code Quality & Technical Debt

**Overall Score: 7.4/10** (Near Production Ready)

### Strengths
- **Architecture (8/10):** Clean separation of concerns, proper layering
- **TypeScript Quality (7.5/10):** Comprehensive typing, Zod validation
- **Python Quality (8/10):** Type hints, modular design, NanoChat patterns
- **Database Design (9/10):** Well-structured Prisma schema, proper relationships
- **Testing:** Comprehensive coverage for core analysis logic
- **Documentation:** Extensive (55KB timeline, 26KB code review)

### Technical Debt
- **api/src/lib/ai-ensemble.ts** (24,214 lines) - Needs refactoring
- **Worker service** - Needs modernization (outdated BullMQ patterns)
- **Bot service** - Deprecated, ready for removal
- **Research scripts** - Cleaned up (315 files archived)
- **Training data** - Organized (3.8GB → 172MB active + archived)

**Read more:** [COMPREHENSIVE-CODE-REVIEW-2025-10-23.md](COMPREHENSIVE-CODE-REVIEW-2025-10-23.md)

---

## Contributing

PokeDAO is in private beta. Interested in contributing? Open an issue or reach out on [GitHub](https://github.com/ChicoPanama/PokeDao).

---

## License

Proprietary. All rights reserved.

---

**Built with ❤️ by collectors, for collectors.**

*Last Updated: 2025-10-23* 🚀 **October 2025 Major Update:**
- Phase 1-3 Complete (Vector RAG + v4.3 Data + Evaluation Framework)
- 423 files modified, ~150,000 lines of code written
- Comprehensive code review & timeline documentation
- Repository cleanup & organization complete
- Production readiness: 7.4/10 (Near Production Ready)
