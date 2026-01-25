# PokeDAO

**Systematic Pokémon TCG Investment Platform**

*Combining quantitative market analysis with autonomous on-chain execution*

[![CI](https://github.com/ChicoPanama/PokeDao/workflows/CI%20Validate/badge.svg)](https://github.com/ChicoPanama/PokeDao/actions)
[![Smoke Test](https://github.com/ChicoPanama/PokeDao/workflows/Smoke%20Test/badge.svg)](https://github.com/ChicoPanama/PokeDao/actions)

---

## Current Status

✅ **Production Ready** - Mew-1A v4.2 deployed to Modal Labs serverless GPU
✅ **239,785 records** consolidated from 9 marketplaces (90.4% pricing coverage)
✅ **Vector RAG System** - FAISS-based semantic search (7x improvement over pattern matching)
✅ **NanoChat Evaluation** - Production-grade ML testing (9 modules, 2,024 test examples)
✅ **v4.3 Training Ready** - 253,810 examples (quality score: 82.24/100)

**Code Quality:** 7.4/10 (Near Production Ready) | [Full Code Review →](COMPREHENSIVE-CODE-REVIEW-2025-10-23.md)

---

## The Vision

**The Problem:**
The Pokémon TCG market is fragmented across dozens of marketplaces with pricing inefficiencies, information asymmetry, and no systematic tools for serious collectors. Manual price checking is time-consuming, comps are unreliable, and opportunities vanish before humans can act.

**The Solution:**
PokeDAO is a 24/7 quantitative system that consolidates multi-venue data, computes true fair value with liquidity-adjusted pricing, and executes trades through on-chain vaults — bringing institutional-grade infrastructure to the TCG collectibles market.

---

## Three Core Products

### 1. **PokeDex** — The Signal Engine
Systematic research platform that continuously:
- Ingests data from **9 marketplaces** with **TCGdex Layer 0** validation (21,627 official cards)
- Computes **True Fair Value (TFV)** using weighted consensus pricing with time-decay and fee adjustment
- Calculates **Liquidity Metrics** (sales velocity, days-to-clear, probability of selling)
- Generates **Opportunity Scores** combining discount depth, liquidity quality, and risk penalties
- Publishes ranked signals to X/Twitter as actionable investment theses

**Tech:** Bronze/Silver/Gold lakehouse (Parquet + SHA256), Prisma ORM, PostgreSQL, Redis

### 2. **Project Mew-1A** — TCG Pricing AI Model ✅

The world's first AI model specifically trained on Pokemon TCG market data, built with production-grade ML infrastructure following [NanoChat](https://github.com/karpathy/nanochat) patterns.

**v4.2 - Production (Deployed)**
- **509,746 training examples** from PostgreSQL, eBay, Reddit, TCGPlayer
- **Llama-3.2-3B** fine-tuned with **LoRA adapters** (48.7MB)
- **Final loss: 0.145** (3 epochs on RTX 4090)
- **vLLM + Modal Labs** serverless GPU deployment
- **Vector RAG**: FAISS semantic search with all-MiniLM-L6-v2 embeddings (384D)
- **Streaming inference**: 15-25 tok/s with Server-Sent Events (ChatGPT-style UX)

**v4.3 - Ready for Training**
- **253,810 examples** with quality score 82.24/100
- Multi-source consolidation: valid data (103k) + pseudo-labeled (75k) + refusal (24k) + BUY/PASS (15k) + price patterns (21k)
- **Target: <0.140 final loss** (improvement over v4.2)

**Evaluation Framework** (NanoChat-inspired)
- **9 Python modules** (2,332 lines): pricing accuracy, card knowledge, BUY/PASS decisions, market predictions
- **2,024 test examples** with quality gates (pricing ≥75%, knowledge ≥80%, decisions ≥80%)
- **Categorical + Generative evaluators** with BPB (Bits Per Byte) metric

**Tech:** PyTorch, Transformers, FAISS, vLLM, FastAPI, Modal Labs, HuggingFace, Sentence Transformers

[Model on HuggingFace →](https://huggingface.co/ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing) | [Phase 1: Vector RAG →](PHASE1-VECTOR-RAG-COMPLETE.md) | [Phase 2: v4.3 Data →](PHASE2-MEW1A-V4.3-TRAINING-READY.md) | [Phase 3: Evaluation →](PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md)

### 3. **PokeStrategy** — The On-Chain Vault
Autonomous execution layer that:
- Listens to PokeDex signals in real-time
- Executes buys/sells via NFT marketplaces (Phygitals, Collector Crypt, Courtyard)
- Manages tokenized Pokemon card assets on-chain with transparent performance tracking
- Allows LPs to deposit/withdraw based on vault NAV

**Tech:** Solana/Base smart contracts (planned)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POKEDAO SYSTEM OVERVIEW                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  📦 DATA SOURCES (9 Marketplaces)                                        │
│  ─────────────────────────────────────────────────────────────────────   │
│  • eBay (199k listings)          • Courtyard (33k NFTs)                 │
│  • JustTCG (2k listings)         • Phygitals (20k NFTs)                 │
│  • TCGPlayer (15k)               • TCGdex Layer 0 (21,627 official)     │
│  • Collector Crypt (22k)         • Total: 239,785 records               │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🗄️  DATA LAKEHOUSE (Medallion Architecture)                            │
│  Bronze (Raw Parquet + SHA256) → Silver (Normalized) → Gold (TFV/Liq.)  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🧠 AI ENSEMBLE + Vector RAG                                             │
│  • Mew-1A (TCG Specialist) - vLLM + Modal Labs + FAISS RAG              │
│  • Ollama (Fast Local) - Qwen 2.5 3B                                     │
│  • DeepSeek R1 (Deep Reasoning)                                          │
│  • Reddit Sentiment - r/PokeInvesting + r/PokemonTCG                     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │   PokeDex    │ │ PokeStrategy │ │  X/Twitter   │
        │    Signals   │ │  On-Chain    │ │   Public     │
        └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Key Features

### Quantitative Analysis Engine
- **True Fair Value (TFV)**: Time-decay weighted consensus pricing with fee adjustment and venue trust multipliers
- **Liquidity Metrics**: Poisson-based probability models (P(sell in 30/60/90 days), days-to-clear, sales velocity)
- **Opportunity Scoring**: Risk-adjusted composite formula (α·discount + β·liquidity - γ·risk)

### AI & Machine Learning
- **Custom TCG Model**: Llama-3.2-3B fine-tuned on 509k Pokemon TCG examples
- **Vector RAG**: FAISS semantic search (7x improvement over pattern matching, 100% query success)
- **Production Evaluation**: NanoChat-inspired framework with 9 modules and quality gates
- **Streaming Inference**: vLLM + FastAPI + SSE for real-time token generation (15-25 tok/s)

### Data Infrastructure
- **Medallion Architecture**: Bronze/Silver/Gold lakehouse with SHA256 content addressing
- **Zero Data Loss**: Reconstruction proofs, idempotent pipelines, streaming I/O
- **Multi-Source Consolidation**: 239,785 records from 9 marketplaces (90.4% pricing coverage)

### Production Deployment
- **Modal Labs**: Serverless GPU deployment with automatic scaling
- **vLLM**: High-throughput LLM serving with PagedAttention
- **TypeScript + Python**: Monorepo with 7 packages, Prisma ORM, Zod validation

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **ML Training** | PyTorch, Transformers, LoRA, PEFT | Fine-tuning Llama-3.2-3B on TCG data |
| **ML Inference** | vLLM, Modal Labs, FastAPI | Serverless GPU deployment |
| **Vector Search** | Qdrant, Sentence Transformers | Production semantic search (upgraded from FAISS) |
| **Evaluation** | NanoChat patterns, BPB metric | Production ML quality gates |
| **Database** | PostgreSQL + TimescaleDB, Prisma ORM | 239,785 records with time-series optimization |
| **Data Lake** | Apache Parquet, DuckDB | Columnar storage with SHA256 addressing |
| **Backend** | Node.js 20+, TypeScript, Zod | Type-safe monorepo (7 packages) |
| **API Layer** | Fastify + tRPC | End-to-end type-safe API |
| **Queues** | BullMQ, Redis, Redpanda | Job processing + event streaming |
| **AI Orchestration** | LangGraph, CrewAI | Multi-agent state machine workflows |
| **AI Models** | Ollama (Qwen 2.5), DeepSeek R1 | Local + cloud LLM ensemble |
| **Observability** | OpenTelemetry-style tracing | Agent pipeline monitoring |
| **Dev Tools** | Claude Code, MCP servers, Skills.sh | AI-assisted development |
| **CI/CD** | GitHub Actions | Validation, smoke tests |

---

## Quick Start

### Prerequisites
- Node.js 20+ | PostgreSQL 15+ | Redis 7+ | pnpm 8+
- Python 3.10+ (for ML components)

### Installation

```bash
# Clone and install
git clone https://github.com/ChicoPanama/PokeDao.git
cd pokedao
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with DATABASE_URL, REDIS_URL, JUSTTCG_API_KEY, HUGGINGFACE_TOKEN

# Generate Prisma client
pnpm --filter api prisma generate

# Run data pipeline
pnpm collect:justtcg
pnpm data:pipeline

# Start API server
pnpm api:dev
```

### Verify Installation

```bash
pnpm typecheck        # Type-check all packages
pnpm test:smoke       # Quick validation
pnpm green:verify     # Full verification
```

---

## Project Structure

```
pokedao/
├── packages/               # 7 core libraries
│   ├── core/              # Domain types, utilities, time-decay, fees
│   ├── analysis/          # TFV, liquidity, opportunity scoring
│   ├── storage/           # Prisma ORM, repositories
│   ├── adapters/          # JustTCG, Phygitals, CollectorCrypt clients
│   ├── shared/            # Logging, config, validation, tracing
│   ├── reddit-sentiment/  # Sentiment analysis
│   └── streams/           # Data streaming utilities
├── api/                   # Fastify REST API (production-ready)
├── apps/
│   ├── mew1a/             # TCG pricing AI model
│   │   ├── evaluation/    # NanoChat framework (9 modules, 2,332 lines)
│   │   ├── rag_middleware_vector.py  # FAISS Vector RAG
│   │   └── vllm_deploy_vector_rag.py # Modal deployment
│   ├── mew1a-chat/        # Streaming UI (vanilla JS, SSE)
│   └── pokedex/           # Signal generation (in progress)
├── scripts/               # Data pipelines, training, evaluation
│   ├── convert_training_to_test_data.ts     # 2,024 test examples
│   ├── build-vector-rag-faiss-batched.py    # FAISS index builder
│   ├── mew1a-train-v4.3.py                  # Training script
│   └── deploy-v4.3-to-runpod.sh             # RunPod deployment
├── data/
│   ├── training/          # 253,810 examples (v4.3-FINAL.jsonl)
│   └── vector-store/      # FAISS index files
└── data_lake/             # Bronze/Silver/Gold Parquet files
```

---

## Development Highlights

**October 2025 - Major Engineering Effort:**
- ✅ **423 files modified**, ~150,000 lines of code written
- ✅ **Phase 1**: Vector RAG with FAISS (7x improvement over pattern matching)
- ✅ **Phase 2**: v4.3 training dataset (253,810 examples, quality 82.24/100)
- ✅ **Phase 3**: NanoChat evaluation framework (9 modules, production quality gates)
- ✅ **Database consolidation**: 239,785 records from SQLite → PostgreSQL
- ✅ **vLLM deployment**: Streaming inference on Modal Labs serverless GPU

[Complete Timeline & Roadmap →](COMPLETE-TIMELINE-AND-ROADMAP-2025-10-23.md) | [Comprehensive Code Review →](COMPREHENSIVE-CODE-REVIEW-2025-10-23.md)

---

## Roadmap

### ✅ Completed
- **Phase 1**: Data Infrastructure (Bronze/Silver/Gold lakehouse, 9 marketplaces, 239k records)
- **Phase 1**: Vector RAG System (FAISS, 100% query success, semantic understanding)
- **Phase 2**: Mew-1A v4.2 Production (509k examples, vLLM + Modal Labs deployment)
- **Phase 2**: v4.3 Training Data (253k examples, quality 82.24/100)
- **Phase 3**: NanoChat Evaluation Framework (9 modules, 2,024 test examples)

### 🚧 In Progress
- **Phase 4**: Signal Generation & Twitter Launch
  - End-to-end signal pipeline
  - X/Twitter posting integration
  - Image generation (card overlays + price charts)

### 🔜 Next
- **Phase 5**: Mew-1A v4.3 Training (RunPod A100, target <0.140 loss)
- **Phase 6**: On-Chain Vault (Phygitals API, smart contracts)
- **Phase 7**: Institutional Features (portfolio analytics, backtesting, API)

---

## Documentation

### Core Documentation
- **[README.md](README.md)** - This file (project overview)
- **[MORNING-CHECKLIST.md](MORNING-CHECKLIST.md)** - Daily workflow and v4.3 deployment steps
- **[COMPREHENSIVE-CODE-REVIEW-2025-10-23.md](COMPREHENSIVE-CODE-REVIEW-2025-10-23.md)** - Line-by-line code analysis (26KB)
- **[COMPLETE-TIMELINE-AND-ROADMAP-2025-10-23.md](COMPLETE-TIMELINE-AND-ROADMAP-2025-10-23.md)** - Hour-by-hour development history (55KB)

### Phase Documentation
- **[PHASE1-VECTOR-RAG-COMPLETE.md](PHASE1-VECTOR-RAG-COMPLETE.md)** - FAISS Vector RAG (7x improvement)
- **[PHASE2-MEW1A-V4.3-TRAINING-READY.md](PHASE2-MEW1A-V4.3-TRAINING-READY.md)** - v4.3 dataset (253k examples)
- **[PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md](PHASE3-NANOCHAT-EVALUATION-FRAMEWORK.md)** - Production ML evaluation

### Developer Guides
- **[docs/architecture/](docs/architecture/)** - System design, NanoChat upgrade plan
- **[docs/deployment/](docs/deployment/)** - v4.2 deployment runbooks
- **[docs/training/](docs/training/)** - Mew-1A training guides, RunPod instructions
- **[docs/guides/](docs/guides/)** - Setup guides (Ollama, eBay, CardMarket, etc.)
- **[docs/troubleshooting/](docs/troubleshooting/)** - Common issues and solutions

---

## Claude Code Integration

PokeDAO includes first-class support for [Claude Code](https://claude.com/claude-code), providing AI-assisted development with deep project understanding.

### MCP Servers (Model Context Protocol)

Pre-configured MCP servers in `.mcp.json` enable Claude to interact directly with your infrastructure:

| Server | Purpose | Example Usage |
|--------|---------|---------------|
| **PostgreSQL** | Query 239k records directly | "Show signals with >25% edge" |
| **GitHub** | PR/issue management | "Create a PR for this feature" |
| **Redis** | Cache & queue inspection | "What's in the BullMQ agent queue?" |
| **Telegram** | Task notifications | Alert when long jobs complete |

### Project Context

- **[CLAUDE.md](CLAUDE.md)** - Project architecture, commands, and conventions for Claude Code
- Automatically loaded when Claude Code runs in this directory

### Agent Pipeline Tracing

The signal generation pipeline (`apps/agent/src/tick.ts`) includes OpenTelemetry-style tracing:

```
agent:tick (1.2s)
├── agent:fetch (listing_count: 150)
├── agent:normalize (normalized_count: 148)
├── agent:attach_comps (with_comps_count: 142)
├── agent:detect_candidates (candidate_count: 8)
├── agent:validate_persist (kept_count: 5)
└── agent:telegram_alerts
```

### Automation Hooks

Configured in `.claude/settings.local.json`:
- **PostToolUse**: Logs TypeScript file modifications
- **Stop**: Records task completion timestamps to `.claude/activity.log`

### Setup

```bash
# Install Claude Code plugins (requires Claude CLI)
./scripts/setup-claude-tooling.sh

# Or manually:
claude plugin install claude-hud tdd-guard claude-code-safety-net
```

Required environment variables for MCP:
```bash
GITHUB_TOKEN=ghp_...           # For GitHub MCP
TELEGRAM_ADMIN_CHAT_ID=...     # For Telegram MCP notifications
```

---

## Why This Matters

### The Market Opportunity
- **$12B+ annual market** for Pokémon cards (PSA grading volume alone)
- **Fragmented liquidity** across TCGPlayer (shutdown), eBay, regional markets, private Discord servers
- **No institutional tooling** — investors rely on spreadsheets, manual checks, "gut feel"
- **High inefficiency** — same card trades for 30-50% variance across venues

### The Technology Edge
1. **Fee-Adjusted Pricing** — TFV accounts for buyer fees, shipping, grading costs
2. **Time-Decay Weighting** — Recent comps weighted exponentially (30-day half-life)
3. **Liquidity Premium** — Cards that sell quickly valued higher than illiquid comps
4. **Vector RAG** — Semantic understanding (7x better than pattern matching)
5. **Production ML** — NanoChat-inspired evaluation with quality gates
6. **On-Chain Settlement** — Vault performance verifiable, not just claimed

**Result:** A systematic edge over manual traders and simple price aggregators.

---

## Contributing

PokeDAO is in private beta. Interested in contributing? Open an issue or reach out on [GitHub](https://github.com/ChicoPanama/PokeDao).

---

## License

Proprietary. All rights reserved.

---

**Built with ❤️ by collectors, for collectors.**

*Last Updated: 2026-01-24*

---

## 2026 Technology Upgrade (January 2026)

PokeDAO has been upgraded with the latest 2026 technology stack:

| Technology | Status | Notes |
|------------|--------|-------|
| Qdrant Vector DB | **PRODUCTION** | 8.3KB TS + 13KB Python |
| TimescaleDB | **SCAFFOLDING** | Migration exists, needs manual setup |
| tRPC API Layer | **PARTIAL** | Router exists, not fully integrated |
| LangGraph Agents | **PRODUCTION** | 9 files, replaces sequential tick.ts |
| Redpanda/Kafka | **PRODUCTION** | 9.7KB with 5 typed topics |
| CrewAI Multi-Agent | **PRODUCTION** | 4 agents implemented |

### Phase 1: Qdrant Vector Database
- **Replaces**: FAISS in-memory
- **Benefits**: Persistent storage, hybrid search, metadata filtering, production SLAs
- **Files**: `packages/shared/qdrant.ts`, `apps/mew1a/rag_middleware_qdrant.py`

### Phase 2: TimescaleDB Extension (Setup Required)
- **Enhances**: PostgreSQL for time-series price data
- **Status**: Migration file exists but requires manual database setup before Prisma runs
- **Migration**: `api/prisma/migrations/20260123_add_timescaledb/`

### Phase 3: tRPC API Layer (Partial)
- **Adds**: End-to-end type safety
- **Status**: Router structure exists but not fully connected to Fastify server
- **Files**: `api/src/trpc/`

### Phase 4: LangGraph Agent Orchestration
- **Replaces**: Sequential pipeline in tick.ts
- **Benefits**: Visual debugging, retry/checkpoint, parallel execution
- **Files**: `apps/agent/src/graph/`

### Phase 5: Redpanda Event Streaming
- **Adds**: Kafka-compatible event streaming
- **Benefits**: Zero data loss, replay capability, multi-consumer
- **Files**: `packages/shared/kafka.ts`

### Phase 6: CrewAI Multi-Agent System
- **Adds**: Specialized AI agents for analysis
- **Agents**: PriceAnalyst, MarketScanner, RiskAssessor, ContentWriter
- **Files**: `apps/crew/`

---

## Code Audit (January 2026)

Comprehensive audit completed 2026-01-24. See [docs/AUDIT_RECOMMENDATIONS.md](docs/AUDIT_RECOMMENDATIONS.md) for details.

**Critical Fixes Applied:**
- Memory leak in alert system (bounded cache with TTL)
- Division by zero guard in fair value calculation
- Median calculation bug (even-length arrays)
- Cryptographic referral code generation

**Audit Documentation:**
- [docs/AUDIT_DISCREPANCIES.md](docs/AUDIT_DISCREPANCIES.md) - README vs Reality
- [docs/AUDIT_CODE_QUALITY.md](docs/AUDIT_CODE_QUALITY.md) - Bug & Security Issues
- [docs/AUDIT_RECOMMENDATIONS.md](docs/AUDIT_RECOMMENDATIONS.md) - Prioritized Fixes
- [docs/AUDIT_FIXES_APPLIED.md](docs/AUDIT_FIXES_APPLIED.md) - Applied Changes

---

## Bloomberg Terminal for Trading Cards (Phase 1)

PokeDAO now includes a real-time trading terminal with automated social presence:

### Working Components

| Component | Status | Description |
|-----------|--------|-------------|
| **Dashboard** | ✅ READY | Next.js 14 real-time terminal at `apps/dashboard/` |
| **Telegram Bot** | ✅ READY | Grammy-based bot with inline keyboards and alerts |
| **X/Twitter Agent** | ✅ READY | Auto-posting opportunities with dry-run mode |
| **Alert Pipeline** | ✅ READY | Queue-based delivery via Redis/BullMQ |
| **Signal Detection** | ✅ READY | LangGraph 6-step pipeline with arbitrage detection |

### Architecture

```
Signal Pipeline (LangGraph)
    ↓
┌───────────────────────────────────────────┐
│  Alert Bridge (apps/agent/src/workers/)   │
│  Queues opportunities to Redis            │
└───────────────────────────────────────────┘
    ↓                           ↓
┌─────────────────┐   ┌─────────────────────┐
│ Telegram Queue  │   │ X/Twitter Queue     │
│ telegram:alerts │   │ agent:post          │
└─────────────────┘   └─────────────────────┘
    ↓                           ↓
┌─────────────────┐   ┌─────────────────────┐
│ Bot Consumer    │   │ X Poster Worker     │
│ bot/src/workers │   │ apps/agent/workers  │
└─────────────────┘   └─────────────────────┘
    ↓                           ↓
   Users                    Followers
```

### Quick Start

```bash
# Start the dashboard
cd apps/dashboard && pnpm dev  # http://localhost:3001

# Start the Telegram bot (requires TELEGRAM_BOT_TOKEN)
cd bot && pnpm dev

# Start workers (X posting + alert queueing)
cd apps/agent && tsx src/workers/index.ts

# Run a tick to generate signals
pnpm agent:tick
```

### Environment Variables

```bash
# Required for Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALERTS_ENABLED=true

# Required for X/Twitter
X_API_KEY=your_key
X_API_SECRET=your_secret
X_ACCESS_TOKEN=your_token
X_ACCESS_SECRET=your_secret
POSTING_ENABLED=false  # Set to true for live posting

# Redis for queues
REDIS_URL=redis://localhost:6379/0
```

### Dashboard Features

- **Opportunity Table**: Real-time arbitrage opportunities with buy/sell sources
- **Signal Table**: Recent signals with confidence scores
- **Status Bar**: Pipeline health, queue depths, last update time
- Auto-refresh every 30 seconds

### Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome + registration |
| `/alerts` | Configure alert preferences (spread threshold, price range) |
| `/watch <cardId>` | Add card to watchlist |
| `/portfolio` | View tracked positions |
| `/wallet` | Connect wallet for on-chain features |

### Alert Format

```
🔥 **OPPORTUNITY ALERT**

📦 **Charizard ex (151)**
📚 Scarlet & Violet 151
🏪 JustTCG → eBay

💰 **Buy:** $45.99
💵 **Sell (comp):** $62.50
📊 **Spread:** +35.9%
💸 **Est. Profit:** $12.51
⭐ **Confidence:** █████ 95%

Strong buy signal based on recent sales velocity...

[🛒 Open Listing] [👀 Watch] [✅ Bought] [😴 Ignore]
```

### Phase 2: Core Features (2026-01-24)

| Feature | Status | Description |
|---------|--------|-------------|
| **Price Charts** | ✅ | Recharts line/area charts with weekly trends |
| **Portfolio API** | ✅ | Full CRUD with P&L calculation |
| **Portfolio UI** | ✅ | Holdings table, gain/loss, performance |
| **Market Summary** | ✅ | Top movers, sentiment, opportunities |
| **Commentary Worker** | ✅ | Daily AI commentary to X/Twitter |
| **Bot /portfolio** | ✅ | View holdings via Telegram |
| **Bot /settings** | ✅ | Deep preferences (grades, sources, quiet hours) |

**New Dashboard Tabs:** Arbitrage, Signals, Portfolio, Market, Charts

**New Bot Commands:** `/portfolio`, `/add_holding`, `/settings`

See [docs/BLOOMBERG_TERMINAL_ROADMAP.md](docs/BLOOMBERG_TERMINAL_ROADMAP.md) for the full roadmap.
