# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PokeDAO is a Pokemon TCG investment platform combining quantitative market analysis with AI-powered signals. The system ingests data from 9 marketplaces (239k+ records), calculates True Fair Value with time-decay weighting, and delivers alerts via Telegram and X/Twitter.

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Package Manager**: pnpm workspaces
- **Web Framework**: Fastify v4 (API) + Grammy (Telegram bot)
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **AI Models**: Mew-1A (custom Llama 3.2 3B), DeepSeek, Ollama
- **Vector Search**: Qdrant (production), FAISS (development)
- **Testing**: Vitest
- **Logging**: Pino (structured JSON)

## Key Commands

```bash
# Development
pnpm dev                              # Start all services in parallel
pnpm api:dev                          # Start API server only
pnpm agent:dev                        # Start signal agent only
pnpm typecheck                        # TypeScript type checking
pnpm build                            # Build all packages

# Database
pnpm prisma generate                  # Generate Prisma client (run from root)
pnpm prisma migrate dev               # Run migrations in development
pnpm prisma studio                    # Open Prisma Studio GUI

# Testing
pnpm test                             # Run all tests
pnpm --filter @pokedao/api test       # Run tests for specific package
pnpm test -- --watch                  # Watch mode

# Agent & Pipeline
pnpm agent:tick                       # Run agent tick manually
pnpm smoke:tick                       # Smoke test the agent tick
pnpm data:pipeline                    # Run full data pipeline (bronze→silver→gold→postgres)

# Bot
cd bot && pnpm dev                    # Start Telegram bot locally
```

## Directory Structure

```
pokedao/
├── api/                    # REST API (Fastify) - port 3000
│   └── src/routes/         # API endpoints
├── bot/                    # Telegram bot (Grammy)
│   └── src/
│       ├── commands/       # /start, /watch, /alerts, /wallet
│       ├── callbacks/      # Inline button handlers
│       └── alerts/         # Alert formatting & delivery
├── apps/
│   ├── agent/              # Signal generation (BullMQ worker)
│   │   └── src/steps/      # 6-step pipeline (fetch→normalize→features→signal→validate→output)
│   └── mew1a/              # Custom LLM (vLLM + Modal Labs)
├── ml/                     # ML analysis system
│   └── src/alertSystem.ts  # Signal-to-alert pipeline
├── packages/
│   ├── core/               # Domain types, utilities
│   ├── shared/             # Logging, config, validation
│   ├── storage/            # Database adapters
│   ├── analysis/           # TFV, liquidity scoring
│   ├── adapters/           # JustTCG, Phygitals, eBay clients
│   └── social/             # X/Twitter integration
├── prisma/                 # Database schema (schema.prisma)
├── data_lake/              # Bronze/Silver/Gold Parquet files
└── scripts/                # Data pipelines, training, utilities
```

## Architecture

### Signal Pipeline

```
Market Sources (eBay, TCGPlayer, JustTCG, CollectorCrypt, Phygitals, Courtyard)
    ↓
Agent Pipeline (apps/agent/src/tick.ts)
    ├── 01_fetch.ts      → Fetch fresh listings
    ├── 02_normalize.ts  → Normalize data format
    ├── 03_features.ts   → Attach historical comps (time-decay weighted)
    ├── 04_signal.ts     → Detect arbitrage candidates
    ├── 05_validate.ts   → Validate & persist to DB
    └── 06_output.ts     → Stage outputs
    ↓
AI Ensemble (api/src/lib/ai-ensemble.ts)
    ├── Mew-1A (TCG-specialized) + Vector RAG
    ├── DeepSeek R1 (deep reasoning)
    └── Ollama (fast local inference)
    ↓
Telegram Alerts + X/Twitter Posts
```

### Database Models (prisma/schema.prisma)

- `Card` - Canonical card with normalized cardKey for price aggregation
- `Listing` - Active marketplace listings with source tracking
- `User` - Telegram users with referral system
- `Evaluation` - AI evaluations with fairValue, discount, investmentThesis
- `SourceCatalogItem` - Multi-source catalog with normalized cardKey
- `PriceCache` - Aggregated pricing by window (7/30/90 days)
- `ModelInsight` - AI verdicts (BUY/WATCH/AVOID) with TTL caching

## Conventions

### Code Style

- ESM imports (`import x from 'y'`)
- Async/await over raw promises
- Zod for runtime validation
- Pino for structured logging

### Adding Bot Commands

1. Create `bot/src/commands/[name].ts`
2. Export handler function
3. Register in `bot/src/index.ts` with `bot.command('[name]', handler)`

### Adding API Routes

1. Create `api/src/routes/[name].ts`
2. Export Fastify plugin
3. Register in `api/src/index.ts`

### Database Changes

1. Edit `prisma/schema.prisma`
2. Run `pnpm prisma migrate dev --name [description]`
3. Commit migration file

## Environment Variables

Key variables (see `.env.example` for full list):

```bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
TELEGRAM_BOT_TOKEN=...

# AI Models (at least one required)
DEEPSEEK_API_KEY=...
USE_OLLAMA=1
OLLAMA_BASE_URL=http://localhost:11434

# Data Sources
JUSTTCG_API_KEY=...
EBAY_APP_ID=...

# Features (toggles)
TELEGRAM_ALERTS_ENABLED=false
POST_TO_X=false
```

## Deployment

- **Platform**: Render.com (see `render.yaml`)
- **Health check**: `/health` endpoint
- **Start command**: `cd api && pnpm start`
- **ML Model**: Modal Labs serverless GPU (vLLM)

## MCP Servers

Pre-configured in `.mcp.json`:
- **PostgreSQL**: Query database directly
- **GitHub**: PR/issue management
- **Redis**: Cache inspection
- **Telegram**: Task notifications

## Bloomberg Terminal - Phase 1 Complete (2026-01-24)

### What's Working

| Component | Location | Description |
|-----------|----------|-------------|
| **Dashboard** | `apps/dashboard/` | Next.js 14 terminal with opportunities table |
| **Alert Bridge** | `apps/agent/src/workers/alert-bridge.ts` | Queues signals to Redis |
| **X Poster Worker** | `apps/agent/src/workers/x-poster.ts` | Auto-posts to X/Twitter |
| **Bot Alert Consumer** | `bot/src/workers/alert-consumer.ts` | Sends Telegram alerts |
| **Worker Runner** | `apps/agent/src/workers/index.ts` | Manages all workers |

### Architecture

```
Signal Pipeline (LangGraph)
    ↓
06_output.ts
    ↓
┌─────────────────────────────────────┐
│  Alert Bridge                       │
│  telegram:alerts → Bot Consumer     │
│  agent:post → X Poster Worker       │
└─────────────────────────────────────┘
    ↓                    ↓
Telegram Users      X/Twitter
```

### Quick Start (Full Stack)

```bash
# Terminal 1: API
pnpm api:dev

# Terminal 2: Bot with alert consumer
cd bot && pnpm dev

# Terminal 3: Workers (X poster)
cd apps/agent && tsx src/workers/index.ts

# Terminal 4: Dashboard
cd apps/dashboard && pnpm dev  # http://localhost:3001

# Terminal 5: Generate signals
pnpm agent:tick
```

### Phase 2 Complete (2026-01-24)

| Component | Location | Description |
|-----------|----------|-------------|
| **Price Charts** | `apps/dashboard/src/components/PriceChart.tsx` | Recharts line/area charts with trends |
| **Portfolio API** | `api/src/routes/portfolio.ts` | CRUD, P&L calculation, performance |
| **Portfolio UI** | `apps/dashboard/src/components/PortfolioPanel.tsx` | Holdings table with gain/loss |
| **Market Summary** | `api/src/routes/market-commentary.ts` | Summary, top movers, commentary |
| **Market Panel** | `apps/dashboard/src/components/MarketPanel.tsx` | Sentiment, sources, opportunities |
| **Commentary Worker** | `apps/agent/src/workers/commentary-poster.ts` | Daily market commentary to X |
| **Bot /portfolio** | `bot/src/commands/portfolio.ts` | View portfolio in Telegram |
| **Bot /settings** | `bot/src/commands/settings.ts` | Deep user preferences |

### New Dashboard Tabs

- **Arbitrage** - Cross-venue arbitrage opportunities
- **Signals** - AI-generated trading signals
- **Portfolio** - Holdings, cost basis, P&L tracking
- **Market** - Market summary and commentary
- **Charts** - Historical price charts with Recharts

### New Bot Commands

| Command | Description |
|---------|-------------|
| `/portfolio` | View portfolio with P&L |
| `/add_holding` | Add card to portfolio |
| `/settings` | Deep preferences (grades, sources, quiet hours) |

### Schema Updates (Pending Migration)

New models added to `prisma/schema.prisma`:
- `PriceHistory` - Historical sold prices
- `Portfolio` - User portfolios
- `PortfolioHolding` - Individual holdings with P&L
- `UserPreferences` - Extended alert settings
- `MarketCommentary` - AI-generated commentaries

**Note:** Run `prisma generate` after fixing local tooling issue to enable type-safe queries.

See `docs/BLOOMBERG_TERMINAL_ROADMAP.md` for full roadmap.
