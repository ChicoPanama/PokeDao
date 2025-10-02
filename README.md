# PokeDAO

**Systematic Pokémon TCG Investment Platform**

*Combining quantitative market analysis with autonomous on-chain execution*

[![CI](https://github.com/ChicoPanama/PokeDao/workflows/CI%20Validate/badge.svg)](https://github.com/ChicoPanama/PokeDao/actions)
[![Smoke Test](https://github.com/ChicoPanama/PokeDao/workflows/Smoke%20Test/badge.svg)](https://github.com/ChicoPanama/PokeDao/actions)

---

## The Vision

**The Problem:**
The Pokémon TCG market is fragmented across dozens of marketplaces, with pricing inefficiencies, information asymmetry, and no systematic tools for serious collectors and investors. Manual price checking is time-consuming, comps are unreliable, and opportunities vanish before humans can act.

**The Solution:**
PokeDAO is a 24/7 quantitative system that consolidates multi-venue data, computes true fair value with liquidity-adjusted pricing, and executes trades through on-chain vaults — bringing institutional-grade infrastructure to the TCG collectibles market.

### Two Core Products

#### 1. **PokeDex** — The Signal Engine
A systematic research platform that continuously:
- Ingests data from 5+ marketplaces (JustTCG, eBay, Collector Crypt, Fanatics, Phygitals)
- Computes **True Fair Value (TFV)** using fee-adjusted, time-decayed, venue-weighted comps
- Calculates **Liquidity Metrics** (sales velocity, days-to-clear, probability of selling)
- Generates **Opportunity Scores** combining discount depth, liquidity quality, and risk penalties
- Publishes ranked signals to X/Twitter as actionable investment theses

**Value:** Removes manual research burden. Surfaces mispriced cards before arbitrage closes. Transparent methodology builds trust with collectors.

#### 2. **PokeStrategy** — The On-Chain Vault
An autonomous execution layer that:
- Listens to PokeDex signals in real-time
- Executes buys/sells via integrated APIs (Phygitals, Collector Crypt)
- Manages physical custody through verified warehouses
- Tracks performance on-chain with transparent reporting
- Allows LPs to deposit/withdraw based on vault NAV

**Value:** Removes emotional decision-making. Executes faster than humans. Provides passive exposure to systematic TCG alpha. On-chain transparency builds institutional credibility.

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

**Result:** A systematic edge over manual traders and simple price aggregators.

---

## Current Architecture

PokeDAO is a **TypeScript monorepo** with clean separation of concerns:

### 📦 Packages (Core Libraries)

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| **`@pokedao/core`** | Domain types, utilities, schemas | `CompSale`, `ActiveListing`, `TFVResult`, fee/currency/time-decay utils |
| **`@pokedao/analysis`** | Pricing & scoring models | `calculateTFV()`, `calculateLiquidity()`, `calculateOpportunity()` |
| **`@pokedao/storage`** | Database layer (Prisma) | `getCompsByVariantKey()`, `saveSignals()`, repositories |
| **`@pokedao/adapters`** | External API clients | `JustTCGClient`, `PhygitalsClient` (planned), `CollectorCryptClient` (planned) |
| **`@pokedao/shared`** | Cross-cutting utilities | Logger, config, validation helpers |

### 🏗️ Services

| Service | Purpose | Status |
|---------|---------|--------|
| **`/api`** | Fastify REST API for signals, cards, analytics | ✅ Production-ready |
| **`/bot`** | Telegram bot (legacy interface) | ⚠️ Deprecated |
| **`/worker`** | BullMQ background jobs | ⚠️ Needs refactor |

### 📊 Apps

| App | Purpose | Status |
|-----|---------|--------|
| **`/pokedex`** | Signal generation & X posting engine | 🚧 In progress |
| **`/strategy`** | On-chain vault execution | 🔜 Planned |

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

## Liquidity Premium Model

### Problem: "Floor Price" Doesn't Account for Sellability

A $100 card with zero sales in 60 days is **not equivalent** to a $100 card that sells 3x/week.

### Solution: Probability-Based Liquidity Metrics

```typescript
import { calculateLiquidity } from '@pokedao/analysis/liquidity';

const liquidity = calculateLiquidity(comps, activeListings, {
  lookbackDays: 30,
});

console.log(liquidity);
// {
//   salesPerWeek: 2.4,
//   daysToClear: 8.2,           // Expected time to sell
//   pSell30d: 0.89,             // 89% probability of sale in 30 days
//   pSell60d: 0.97,
//   pSell90d: 0.99,
//   activeListings: 12,         // Current market depth
//   marketVelocity: 'medium'
// }
```

**Methodology:**
- Sales velocity: `salesPerWeek = (recentComps.length / lookbackDays) × 7`
- Poisson arrival rate: `λ = salesPerDay / activeListings`
- Probability to sell: `P(sell in t days) = 1 - e^(-λt)`

---

## Opportunity Scoring: Putting It All Together

```typescript
import { calculateOpportunity } from '@pokedao/analysis/opportunity';

const score = calculateOpportunity(listing, comps, allListings, {
  alpha: 0.50,    // Discount weight
  beta: 0.35,     // Liquidity weight
  gamma: 0.15,    // Risk penalty weight
  minDiscountPct: 12,
  minComps: 5,
  minLiquiditySalesPerWeek: 2,
});

console.log(score);
// {
//   rawScore: 87.3,
//   normalizedScore: 0.873,      // 0-1 scale
//   rank: 'A',                   // A/B/C/D/F
//   recommendation: 'STRONG_BUY',
//   discountPct: 23.4,           // 23.4% below TFV
//   liquidityScore: 0.82,        // Good sellability
//   riskScore: 0.12,             // Low risk
//   reasoning: [
//     'Deep discount (23.4%) vs TFV',
//     'Strong liquidity (2.4 sales/week)',
//     'High confidence (18 comps, <30d)',
//   ],
//   filters: {
//     passedMinDiscount: true,
//     passedMinComps: true,
//     passedMinLiquidity: true,
//   }
// }
```

**Composite Formula:**
```
rawScore = (α × discountScore) + (β × liquidityScore) - (γ × riskPenalty)
```

Where:
- **Discount Score**: `(tfv - listingPrice) / tfv × 100` (capped at 50%)
- **Liquidity Score**: Blend of `pSell30d`, `salesPerWeek`, `daysToClear`
- **Risk Penalty**: Stale comps, low volume, outlier flags

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+, pnpm workspaces | Monorepo management |
| **Language** | TypeScript + Zod | Type safety + runtime validation |
| **Database** | PostgreSQL + Prisma ORM | Transactional storage |
| **Cache** | Redis | Session/rate-limit cache |
| **Queues** | BullMQ | Background job processing |
| **Storage** | Apache Parquet | Columnar data lake files |
| **API Client** | JustTCG API | Primary TCG data source |
| **ML/AI** | Ollama (Qwen 2.5 7B), DeepSeek API | Thesis generation, audit |
| **CI/CD** | GitHub Actions | Validation, smoke tests |

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- pnpm 8+

### Installation

```bash
# Clone the repo
git clone https://github.com/ChicoPanama/PokeDao.git
cd pokedao

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL, REDIS_URL, JUSTTCG_API_KEY

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

## Data Collection Workflow

### Step 1: Collect Raw Data from JustTCG

```bash
pnpm collect:justtcg
# Fetches all Pokemon sets, cards, prices, and history
# Saves to: data/justtcg/*.json
```

**What it does:**
- Queries JustTCG API for all Pokemon sets
- Fetches cards with variants (holo, reverse, 1st edition, etc.)
- Collects current listings + price history (comps)
- Rate-limited to respect API quotas

### Step 2: Ingest to Bronze Layer

```bash
pnpm data:ingest:bronze
# Converts JSON → Parquet with SHA256 content addressing
# Output: data_lake/bronze/*.parquet
```

**Guarantees:**
- Zero data loss (raw bytes preserved)
- Content-addressed files (reproducible hashes)
- Manifest with reconstruction proofs

### Step 3: Build Silver Layer

```bash
pnpm data:build:silver
# Normalizes, deduplicates, generates variant keys
# Output: data_lake/silver/{cards,listings,comps}.parquet
```

**Transformations:**
- Variant key generation: `SET|NUMBER|VARIANT|LANG|GRADER|GRADE`
- Deduplication by variant key + timestamp
- Fee adjustment per venue
- Currency normalization to USD cents

### Step 4: Build Gold Layer

```bash
pnpm data:build:gold
# Computes TFV, liquidity, aggregations
# Output: data_lake/gold/{tfv,liquidity,variant_aggregates}.parquet
```

**Features:**
- TFV calculation with time-decay
- Liquidity metrics (sales velocity, pSell)
- Rolling windows (7/14/30/60/90 days)
- Variant-level aggregations

### Step 5: Sync to Postgres

```bash
pnpm data:sync:db
# Batch upserts Silver layer to PostgreSQL
# Creates indexes on variant_key, venue, timestamp
```

**Or Run Full Pipeline:**

```bash
pnpm data:pipeline
# Runs: bronze → silver → gold → db (sequential)
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
│   └── shared/            # Logging, config
├── services/              # Deployable services
│   ├── api/               # REST API (Fastify)
│   ├── bot/               # Telegram bot (deprecated)
│   └── worker/            # Background jobs (BullMQ)
├── apps/                  # Applications
│   └── pokedex/           # Signal engine + X posting (in progress)
├── scripts/               # Data pipelines, utilities
│   ├── data/              # Bronze/Silver/Gold ingestion
│   ├── collect-justtcg.ts # JustTCG data collection
│   └── verify-opportunity.ts # Opportunity scorer test
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
```

### Adding a New Package

```bash
mkdir packages/my-package
cd packages/my-package

# Create package.json
cat > package.json <<EOF
{
  "name": "@pokedao/my-package",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@pokedao/core": "workspace:*"
  }
}
EOF

# Create tsconfig.json
cat > tsconfig.json <<EOF
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true
  },
  "include": ["src/**/*"]
}
EOF

# Create source
mkdir src
echo "export const hello = 'world';" > src/index.ts

# Install dependencies
cd ../.. && pnpm install
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | **This file** — Vision, architecture, quick start |
| [REFACTOR_COMPLETE.md](REFACTOR_COMPLETE.md) | Package architecture & analysis models deep dive |
| [DATA_CONSOLIDATION_COMPLETE.md](DATA_CONSOLIDATION_COMPLETE.md) | Lakehouse implementation details |
| [docs/JUSTTCG_INTEGRATION.md](docs/JUSTTCG_INTEGRATION.md) | JustTCG API setup & usage |
| [RUNBOOK.md](RUNBOOK.md) | Operational procedures (signals, posting, audits) |
| [data/README_data.md](data/README_data.md) | Data schemas & validation rules |
| [docs/NEXT-PHASE-ROADMAP.md](docs/NEXT-PHASE-ROADMAP.md) | Upcoming features & priorities |

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

---

## Roadmap

### ✅ Phase 1: Data Infrastructure (Complete)
- [x] Bronze/Silver/Gold lakehouse (145k+ records)
- [x] JustTCG API integration
- [x] TFV, Liquidity, Risk, Opportunity models
- [x] Prisma schema for Cards/Listings/Comps/Signals
- [x] Monorepo refactor with clean package boundaries

### 🚧 Phase 2: Signal Generation (In Progress)
- [ ] Automated daily data collection (cron job)
- [ ] End-to-end signal pipeline (features → scoring → ranking)
- [ ] AI thesis generation (Qwen 2.5 7B via Ollama)
- [ ] X/Twitter posting integration (Top 3-5 daily signals)

### 🔜 Phase 3: On-Chain Vault (Planned Q1 2026)
- [ ] Phygitals API integration (buy/sell/custody)
- [ ] Collector Crypt API integration
- [ ] PokeStrategy vault smart contracts (Solana/Base)
- [ ] LP deposit/withdrawal mechanism
- [ ] On-chain performance tracking

### 🔜 Phase 4: Institutional Features (Planned Q2 2026)
- [ ] Portfolio analytics dashboard
- [ ] Risk management (position sizing, diversification)
- [ ] Backtesting framework
- [ ] API for external integrations
- [ ] White-label signal feeds

---

## Current Status

| System | Status | Notes |
|--------|--------|-------|
| **Data Collection** | ✅ Production | JustTCG integration complete, 145k+ records |
| **Lakehouse** | ✅ Production | Bronze/Silver/Gold with zero data loss |
| **Analysis Models** | ✅ Production | TFV, Liquidity, Risk, Opportunity tested |
| **Database** | ✅ Production | Prisma schema with indexes |
| **API** | ✅ Production | REST endpoints for signals, cards, analytics |
| **Signal Pipeline** | 🚧 In Progress | Scoring works, X posting in development |
| **Vault Execution** | 🔜 Planned | Smart contracts + API integrations pending |

---

## Contributing

PokeDAO is currently in private beta. If you're interested in contributing:

1. **Data Sources** — Help integrate new marketplaces (Whatnot, StockX, etc.)
2. **Modeling** — Improve TFV/liquidity algorithms with academic rigor
3. **Smart Contracts** — Audit/review vault execution logic
4. **Testing** — Add unit/integration tests for uncovered paths

Open an issue or reach out to the core team.

---

## License

Proprietary. All rights reserved.

---

## Contact

- **X/Twitter:** [@PokeDAO](https://twitter.com/PokeDAO) *(Coming soon)*
- **Email:** team@pokedao.xyz *(Coming soon)*
- **GitHub:** [ChicoPanama/PokeDao](https://github.com/ChicoPanama/PokeDao)

---

**Built with ❤️ by collectors, for collectors.**

*Last Updated: 2025-10-02*
