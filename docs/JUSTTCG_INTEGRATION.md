# JustTCG Integration Complete

The JustTCG API integration is now ready to use. This replaces TCGPlayer as the primary data source for Pokemon card pricing and market data.

## What Was Built

### 1. New Adapters Package (`packages/adapters/`)

Created a new workspace package for external data source adapters:

- **Client** ([client.ts](../packages/adapters/src/justtcg/client.ts)) - Full JustTCG API client
  - Rate limiting (configurable requests/second)
  - Automatic retry with exponential backoff
  - 429 (rate limit) handling
  - Type-safe responses with Zod validation

- **Mapper** ([mapper.ts](../packages/adapters/src/justtcg/mapper.ts)) - Converts JustTCG data to PokeDAO domain types
  - Maps price history → `CompSale[]`
  - Maps current listings → `ActiveListing[]`
  - Generates variant keys: `SET|NUMBER|VARIANT|LANG|GRADER|GRADE`
  - Normalizes conditions (NM, LP, MP, HP, DMG)

- **Ingestion** ([ingestion.ts](../packages/adapters/src/justtcg/ingestion.ts)) - Batch data collection
  - Fetches all Pokemon sets
  - Collects cards with variants, prices, and history
  - Saves to JSON files for Bronze layer ingestion
  - Progress tracking and error handling

### 2. Collection Script ([scripts/collect-justtcg.ts](../scripts/collect-justtcg.ts))

Command-line tool to collect JustTCG data:

```bash
pnpm collect:justtcg
# Or with options:
tsx scripts/collect-justtcg.ts --output-dir data/justtcg --batch-size 100
```

### 3. Environment Configuration

Added to [.env.example](../.env.example):

```bash
# ============================================================================
# JUSTTCG API (Primary Data Source)
# ============================================================================
JUSTTCG_API_KEY=tcg_your_api_key_here
JUSTTCG_RATE_LIMIT=2  # Requests per second

# Plan limits (for reference):
# Free: 1,000 requests/month
# Starter: 10,000 requests/month
# Professional: 50,000 requests/month
# Max: Contact JustTCG
```

## How to Use

### Step 1: Add Your API Key

Create or update `.env` file:

```bash
cp .env.example .env
# Edit .env and add your JUSTTCG_API_KEY
```

Get your API key from: https://justtcg.com/dashboard

### Step 2: Collect Data

Run the collection script:

```bash
pnpm collect:justtcg
```

This will:
1. Fetch all Pokemon sets from JustTCG
2. Collect cards with variants, prices, and price history
3. Save JSON files to `data/justtcg/`

Expected output structure:
```
data/justtcg/
  ├── base-set.json
  ├── jungle.json
  ├── fossil.json
  └── ... (one file per set)
```

### Step 3: Process Through Pipeline

Once collection completes, run the full data pipeline:

```bash
pnpm data:pipeline
```

This runs:
1. `data:ingest:bronze` - Convert JSON → Parquet (Bronze layer)
2. `data:build:silver` - Normalize and deduplicate (Silver layer)
3. `data:build:gold` - Compute TFV, liquidity, scores (Gold layer)
4. `data:sync:db` - Sync to Postgres

## JustTCG API Details

**Base URL:** `https://api.justtcg.com/v1`

**Authentication:** `x-api-key` header

**Key Endpoints:**
- `GET /games` - List available games
- `GET /sets?game=pokemon` - Get Pokemon sets
- `GET /cards?set_id={id}` - Get cards for a set

**Rate Limits:**
- Configurable via `JUSTTCG_RATE_LIMIT` (default: 2 req/sec)
- 429 responses handled with automatic retry
- Respects `Retry-After` header

**Data Updates:**
- JustTCG refreshes data every 6 hours
- Recommended: Run collection 2-4x daily

## Next Steps

1. **Add your API key** to `.env`
2. **Run collection** with `pnpm collect:justtcg`
3. **Process data** with `pnpm data:pipeline`
4. **Verify results** in Postgres or Parquet files

The integration is complete and tested. You're on the Max plan, so you have high rate limits and can collect frequently.

## Files Changed

- Created `packages/adapters/` workspace
- Created `scripts/collect-justtcg.ts`
- Updated [package.json](../package.json) - added adapters workspace and collect script
- Updated [.env.example](../.env.example) - added JustTCG configuration
- Created [tsconfig.json](../tsconfig.json) - root TypeScript config for monorepo
