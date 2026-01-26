# PokeDAO

**Systematic Pokemon TCG Investment Platform**

*Quantitative market analysis with AI-powered signals, delivered via Telegram and X/Twitter*

---

## Current Status

**Production-grade 3-layer architecture** collecting data from multiple marketplaces, generating AI-powered investment signals, and delivering alerts in real-time.

| Layer | Status | Description |
|-------|--------|-------------|
| **Card Metadata** (L0) | Running | TCGdex sync (21k+ cards), CardMatcher with cascading lookup, Redis cache |
| **Data Collection** (L1) | Running | 8 market workers on cron (eBay, crypto, Reddit, PSA, PPT, web2) |
| **Signal Processing** (L2) | Running | Fair value, trend, liquidity, arbitrage + Groq LLM thesis with rarity/illustrator |
| **User Interface** (L3) | Running | Telegram bot, X/Twitter poster, Next.js dashboard |

---

## Architecture

### 4-Layer System

```
LAYER 0: CARD METADATA (TCGdex — Canonical Identity)
+--------------------------------------------------------------+
|  tcgdex-sync       (0 2 * * *)   - 21k+ cards from TCGdex   |
|  CardMatcher        (shared)     - Cascading card lookup     |
|                                                              |
|  Local JSON → PostgreSQL → Redis cache → Prisma relations    |
|  rarity | illustrator | types | stage | imageUrl | tcgdexId  |
+--------------------------------------------------------------+
            |  Card.tcgdexId + enrichment fields
            v
LAYER 1: DATA COLLECTION (Pure TypeScript, No LLM)
+--------------------------------------------------------------+
|  ebay-worker       (*/15 * * * *)  - eBay sold listings      |
|  crypto-worker     (*/5 * * * *)   - Magic Eden, Courtyard   |
|  reddit-worker     (0 * * * *)     - Reddit sentiment        |
|  psa-worker        (0 6 * * *)     - PSA population data     |
|  ppt-worker        (0 */2 * * *)   - PokemonPriceTracker     |
|  web2-worker       (configurable)  - Web2 marketplace data   |
|                                                              |
|  Workers use CardMatcher for listing-to-card matching        |
+--------------------------------------------------------------+
                            |
                            v
LAYER 2: SIGNAL PROCESSING (TypeScript + Groq LLM)
+--------------------------------------------------------------+
|  processor/index.ts           - Runs every minute            |
|  signal-calculator.ts         - Fair value, trend, liquidity |
|  thesis-generator.ts          - Template (70%) + Groq (30%) |
|                                                              |
|  Reads card.rarity, card.illustrator from Layer 0            |
+--------------------------------------------------------------+
                            |
              +-------------+-------------+
              v             v             v
LAYER 3: USER INTERFACE
+---------------+ +----------------+ +-----------------+
| Telegram Bot  | | X/Twitter      | | Next.js         |
| (Grammy)      | | Poster         | | Dashboard       |
| bot/          | | x-poster.ts    | | apps/dashboard/ |
+---------------+ +----------------+ +-----------------+
```

### Signal Pipeline (Agent Tick)

```
agent:tick
  |-- 01_fetch        Fetch fresh listings from DB
  |-- 02_normalize    Normalize data
  |-- 03_features     Attach 30-day comp medians
  |-- 04_signal       Detect arbitrage candidates
  |-- 05_validate     Validate and persist opportunities
  +-- 06_output       Queue alerts (Telegram + X/Twitter)
```

### Alert Flow

```
Signal Pipeline
    |
    v
Alert Bridge --> Redis Queues
    |                  |
    v                  v
telegram:alerts    agent:post
    |                  |
    v                  v
Bot Consumer       X Poster Worker
    |                  |
    v                  v
Telegram Users     X/Twitter Followers
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+, TypeScript (ESM) | Type-safe monorepo |
| **Package Manager** | pnpm workspaces | 11 workspace packages |
| **Database** | PostgreSQL + Prisma ORM | 43 models, full schema |
| **Cache/Queue** | Redis + BullMQ | Job queues, rate limiting, dedup |
| **Web Framework** | Fastify v4 | REST API |
| **Bot Framework** | Grammy | Telegram bot |
| **Dashboard** | Next.js 14, Recharts | Bloomberg-style terminal |
| **AI/LLM** | Groq (llama-3.1-8b-instant) | Thesis generation |
| **Logging** | Pino (structured JSON) | Production observability |
| **Testing** | Vitest | Unit and integration tests |
| **CI/CD** | GitHub Actions | Validation, smoke tests |
| **Deployment** | Render.com | API + workers |

---

## Quick Start

### Prerequisites

- Node.js 20+ | PostgreSQL 15+ | Redis 7+ | pnpm 8+

### Installation

```bash
git clone https://github.com/ChicoPanama/PokeDao.git
cd pokedao
pnpm install

cp .env.example .env
# Edit .env with DATABASE_URL, REDIS_URL, TELEGRAM_BOT_TOKEN

pnpm prisma generate
pnpm prisma migrate dev
```

### Running the Full Stack

```bash
# Terminal 1: Data Workers
cd apps/agent && pnpm run workers

# Terminal 2: Signal Processor
cd apps/agent && pnpm run processor

# Terminal 3: API
pnpm api:dev

# Terminal 4: Telegram Bot
cd bot && pnpm dev

# Terminal 5: Dashboard
cd apps/dashboard && pnpm dev  # http://localhost:3001
```

### Single-Command Development

```bash
pnpm dev          # Start all services in parallel
pnpm agent:tick   # Run one signal pipeline cycle
pnpm typecheck    # TypeScript type checking
pnpm test         # Run all tests
```

---

## Project Structure

```
pokedao/
├── api/                        # REST API (Fastify) - port 3000
│   └── src/routes/             # search, collect, analytics, portfolio, market
├── bot/                        # Telegram bot (Grammy)
│   └── src/
│       ├── commands/           # /start, /watch, /alerts, /portfolio, /settings
│       ├── callbacks/          # Inline button handlers
│       ├── alerts/             # Alert formatting & delivery
│       └── workers/            # Alert consumer (BullMQ)
├── apps/
│   ├── agent/                  # Signal Agent
│   │   └── src/
│   │       ├── steps/          # 6-step pipeline (fetch → output)
│   │       ├── pipelines/      # Daily posting pipeline
│   │       ├── processor/      # Signal calculator + thesis generator
│   │       ├── workers/        # 9 data workers + health server
│   │       ├── collectors/     # Data warehouse aggregation
│   │       └── services/       # External API clients
│   ├── dashboard/              # Next.js Bloomberg-style terminal
│   └── clawdbot-skills/        # Clawdbot user interface skills
├── packages/
│   ├── core/                   # Domain types, utilities
│   ├── shared/                 # Logging, config, validation, DB, CardMatcher, FuzzyMatcher
│   ├── storage/                # Database adapters
│   ├── analysis/               # TFV, liquidity scoring
│   ├── adapters/               # TCGPlayer, eBay, Courtyard, Magic Eden, PSA, JustTCG, TCGdex
│   ├── social/                 # X/Twitter posting
│   ├── reddit-sentiment/       # Reddit analysis
│   └── streams/                # Data stream processing
├── prisma/                     # Database schema (43 models)
├── scripts/                    # Utilities and data pipelines
├── deprecated/                 # Legacy code (Mew-1A, old workers)
└── docs/                       # Architecture, deployment, guides
```

---

## Data Workers

Production-grade worker infrastructure with distributed locking, retry logic, rate limiting, deduplication, and health monitoring.

| Worker | Schedule | Source | Data |
|--------|----------|--------|------|
| `ebay-worker` | `*/15 * * * *` | eBay | Sold listings for price history |
| `crypto-worker` | `*/5 * * * *` | Magic Eden, Courtyard | Tokenized card listings |
| `reddit-worker` | `0 * * * *` | Reddit | Sentiment from Pokemon subreddits |
| `psa-worker` | `0 6 * * *` | PSA | Population data for scarcity |
| `pokemon-price-tracker` | `0 */2 * * *` | PPT API | Multi-source pricing (TCGPlayer, eBay, CardMarket) |
| `web2-worker` | Configurable | Web2 marketplaces | Traditional marketplace data |
| `tcgdex-sync` | `0 2 * * *` | TCGdex (local JSON + API) | Card metadata: rarity, illustrator, types, images |
| `x-poster` | BullMQ | - | Posts opportunities to X/Twitter |
| `commentary-poster` | BullMQ | - | Daily AI market commentary |

### Worker Health Endpoints

```bash
curl http://localhost:3001/health     # Full status
curl http://localhost:3001/ready      # Kubernetes readiness
curl http://localhost:3001/live       # Kubernetes liveness
curl http://localhost:3001/metrics    # Prometheus metrics
```

---

## Signal Processing

The processor runs every minute, analyzing listings to find investment opportunities:

1. **Fair Value Calculation** - Weighted median of recent comparable sales
2. **Trend Detection** - Price direction and velocity over configurable periods
3. **Liquidity Scoring** - Sales velocity, active listings, days on market
4. **Sentiment Analysis** - Reddit mention frequency and sentiment scores
5. **Scarcity Assessment** - PSA population data and rarity metrics
6. **Arbitrage Detection** - Cross-venue price differentials after fees
7. **TCGdex Enrichment** - Rarity, illustrator, types, images from local card catalog
8. **Thesis Generation** - Template-based (70%) + Groq LLM (30%) investment thesis with rarity/illustrator context

Cost: Templates are free, Groq calls ~$0.00014 each (llama-3.1-8b-instant).

---

## TCGdex Card Metadata

TCGdex provides canonical card metadata (rarity, illustrator, types, images) for 21,000+ Pokemon TCG cards. The integration follows a **Nightly Sync → PostgreSQL → Redis Cache → Lookup** pattern with zero external API calls during runtime.

```
NIGHTLY SYNC (2 AM)                     RUNTIME (agent:tick)
┌───────────────────────┐               ┌──────────────────────┐
│ tcgdex-sync-worker    │               │ processor/index.ts   │
│                       │               │                      │
│ 1. Seed from local    │──────────┐    │ listing.card.rarity  │
│    JSON (21k cards)   │          │    │ listing.card.illust… │
│                       │          │    │ listing.card.types   │
│ 2. Incremental API    │          │    │ listing.card.imageUrl│
│    sync (new sets)    │          │    └──────────┬───────────┘
│                       │          │               │
│ 3. Match Cards with   │──┐       │               v
│    tcgdexId enrichment│  │       │    ┌──────────────────────┐
└───────────────────────┘  │       │    │ thesis-generator.ts  │
                           v       v    │ rarity + illustrator │
                    ┌────────────────┐  │ context in thesis    │
                    │  PostgreSQL    │  └──────────────────────┘
                    │  Card model    │
                    │  + tcgdexId    │
                    │  + rarity      │
                    │  + illustrator │
                    │  + pokemonTypes│
                    │  + imageUrl    │
                    └────────────────┘
```

**Key components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| **TCGdex Adapter** | `packages/adapters/src/tcgdex/` | SDK wrapper with rate limiting, retry, Zod validation |
| **Sync Worker** | `apps/agent/src/workers/tcgdex-sync-worker.ts` | Nightly seed + incremental API sync + card matching |
| **Card Matcher** | `packages/shared/card-matcher.ts` | Cascading lookup: tcgdexId → exact → normalized → fuzzy (Jaro-Winkler) |
| **API Service** | `api/src/lib/tcgdex.ts` | DB-backed search with 5min Redis cache |

**Card Matcher strategy chain** (used by crypto + eBay workers):

1. Direct `tcgdexId` lookup (confidence: 1.0)
2. Exact `searchName` + `searchSet` + `number` (confidence: 1.0)
3. Normalized name + set via `FuzzyMatcher` (confidence: 0.9)
4. Fuzzy match via Jaro-Winkler against SourceCatalogItem (confidence: 0.8+)
5. Redis cache: 1h TTL for hits, 5min TTL for misses

---

## Dashboard (Bloomberg Terminal)

Next.js 14 terminal at `apps/dashboard/` with:

| Tab | Component | Description |
|-----|-----------|-------------|
| **Opportunities** | `OpportunityTable` | Real-time arbitrage with buy/sell sources |
| **Signals** | `SignalTable` | Confidence scores, trends, fair values |
| **Portfolio** | `PortfolioPanel` | Holdings, cost basis, P&L tracking |
| **Market** | `MarketPanel` | Sentiment, source breakdown, top movers |
| **Charts** | `PriceChart` | Recharts line/area charts with trends |

Status bar shows pipeline health, queue depths, and last update time.

---

## Telegram Bot

Grammy-based bot with inline keyboards and real-time alerts.

| Command | Description |
|---------|-------------|
| `/start` | Welcome + registration |
| `/alerts` | Configure alert preferences |
| `/watch <cardId>` | Add card to watchlist |
| `/portfolio` | View holdings with P&L |
| `/settings` | Preferences (grades, sources, quiet hours) |
| `/wallet` | Connect wallet for on-chain features |
| `/arbitrage` | View current arbitrage opportunities |
| `/referral` | Referral code system |

---

## API Endpoints

### Core
- `GET /health` - Basic check (Redis + Postgres)
- `GET /ready` - Kubernetes readiness probe
- `GET /health/comprehensive` - Full check including LLM providers

### Data Collection
- `POST /api/collect/query` - Record user queries
- `POST /api/collect/action` - Record user actions
- `POST /api/collect/outcome` - Record purchase outcomes

### Analytics
- `GET /api/analytics/card/:id/history` - Price history with daily aggregations
- `GET /api/analytics/card/:id/signals` - Signal snapshot history
- `GET /api/analytics/market/overview` - Market summary with source breakdown
- `GET /api/analytics/market/movers` - Top gainers and losers
- `GET /api/analytics/thesis/performance` - Thesis accuracy metrics

### Portfolio
- `GET/POST /api/portfolio` - Portfolio CRUD
- `GET /api/portfolio/performance` - P&L calculation

---

## Database Schema

43 Prisma models organized into domains:

| Domain | Key Models |
|--------|-----------|
| **Cards** | `Card` (with tcgdexId, rarity, illustrator, pokemonTypes), `SourceCatalogItem`, `PriceCache` |
| **Listings** | `Listing`, `PriceSnapshot`, `PriceHistory` |
| **Signals** | `SignalSnapshot`, `Opportunity`, `ThesisRecord` |
| **Users** | `User`, `UserPreferences`, `Portfolio`, `PortfolioHolding` |
| **Social** | `SocialPost`, `RedditPost`, `MarketCommentary` |
| **Analytics** | `DailyCardStats`, `DailyMarketStats`, `DailySourceStats` |
| **Data Warehouse** | `UserQuery`, `UserAction`, `UserOutcome`, `AlertDelivery` |

---

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
TELEGRAM_BOT_TOKEN=...

# AI/LLM
GROQ_API_KEY=...                          # Thesis generation
GROQ_MODEL=llama-3.1-8b-instant          # Default model

# Data Sources
EBAY_APP_ID=...
EBAY_CERT_ID=...
JUSTTCG_API_KEY=...
POKEMON_PRICE_TRACKER_API_KEY=...

# Workers
DATA_WORKERS_ENABLED=true
WORKER_HEALTH_PORT=3001
TCGDEX_SYNC_ENABLED=true                  # TCGdex metadata sync (free, no key needed)

# Output
POSTING_ENABLED=false                     # Set true for live X posting
TELEGRAM_ALERTS_ENABLED=false
POST_TO_X=false

# X/Twitter
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
```

---

## Adapters

Pre-built marketplace integrations in `packages/adapters/`:

| Adapter | Status | Source |
|---------|--------|--------|
| **TCGPlayer** | Implemented | Full OAuth, rate limiting, pricing APIs |
| **Courtyard** | Implemented | Tokenized card marketplace |
| **Magic Eden** | Implemented | Solana NFT marketplace |
| **PSA** | Implemented | Population reports for rarity |
| **JustTCG** | Implemented | Card marketplace |
| **Phygitals** | Implemented | Physical-digital card platform |
| **TCGdex** | Implemented | Card metadata (rarity, illustrator, types, images) — free, keyless |

---

## Claude Code Integration

PokeDAO includes first-class support for [Claude Code](https://claude.com/claude-code).

### MCP Servers

Pre-configured in `.mcp.json`:

| Server | Purpose |
|--------|---------|
| **PostgreSQL** | Query database directly |
| **GitHub** | PR/issue management |
| **Redis** | Cache & queue inspection |
| **Telegram** | Task notifications |

### Agent Pipeline Tracing

```
agent:tick (1.2s)
|-- agent:fetch (listing_count: 150)
|-- agent:normalize (normalized_count: 148)
|-- agent:attach_comps (with_comps_count: 142)
|-- agent:detect_candidates (candidate_count: 8)
|-- agent:validate_persist (kept_count: 5)
+-- agent:telegram_alerts
```

---

## Roadmap

### Completed

- Data collection infrastructure (8 workers, cron-based, production-grade)
- Signal processing pipeline (6-step tick, fair value, trend, liquidity, arbitrage)
- Groq LLM thesis generation with template fallback
- Telegram bot with alerts, portfolio, settings, referrals
- X/Twitter auto-posting with dry-run mode
- Next.js Bloomberg-style dashboard (5 tabs)
- REST API with analytics, portfolio, market summary
- Data warehouse with ML-ready collection endpoints
- Production worker infrastructure (distributed locks, retry, rate limiting, health monitoring)
- PokemonPriceTracker multi-source pricing integration
- TCGdex card metadata integration (21k+ cards synced nightly, CardMatcher with cascading lookup, rarity/illustrator enrichment in thesis generation)

### In Progress

- ML model training pipeline (`ml/` directory)
- Clawdbot NLU skills (`apps/clawdbot-skills/`)
- On-chain vault (Solana smart contracts)

### Next

- Backtesting framework for signal validation
- Image generation for X/Twitter posts (card overlays + price charts)
- Advanced portfolio analytics (Sharpe ratio, drawdown)
- Token gating for premium features

---

## Legacy Components

The `deprecated/` directory contains earlier iterations:
- **Mew-1A** - Custom Llama-3.2-3B fine-tuned on TCG data (replaced by Groq API)
- **FAISS Vector RAG** - Semantic search (replaced by direct DB queries)
- **vLLM + Modal Labs** - Serverless GPU deployment (replaced by Groq cloud API)
- **Data Lakehouse** - Bronze/Silver/Gold Parquet pipeline (replaced by PostgreSQL + Prisma)

---

## Contributing

PokeDAO is in private beta. Open an issue or reach out on [GitHub](https://github.com/ChicoPanama/PokeDao).

---

## License

Proprietary. All rights reserved.

---

*Last Updated: 2026-01-25*
