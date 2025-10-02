# Data Lakehouse Documentation

## Overview

This repository uses a **medallion architecture** (Bronze → Silver → Gold) to consolidate all Pokemon card market data with full provenance and zero data loss.

```
data_lake/
├── bronze/          # Raw, content-addressed ingestion (Parquet)
├── silver/          # Normalized, deduplicated canonical tables (Parquet)
├── gold/            # Feature-ready analytics tables (Parquet)
└── manifests/       # Lineage tracking and reconstruction proofs
```

## Architecture

### Bronze Layer (Raw Ingestion)

**Purpose:** Ingest all raw JSON data into content-addressed Parquet files with full lineage.

**Guarantees:**
- **No data loss** - All raw data preserved in Parquet format
- **Content addressable** - Files named by SHA256 hash for idempotency
- **Full metadata** - Every file gets a manifest with schema, row counts, time ranges

**Schema:**
- Dynamic schema inferred from JSON structure
- All fields preserved (unknown fields → JSON strings)
- Metadata: `_bronzeFile` (source reference)

**Sources Ingested:**
1. **CollectorCrypt** (`worker/`)
   - `unified-collector-crypt-dataset.json` (57MB, 24k+ rows)
   - `complete-dataset.json` (40MB, 17k+ rows)
   - `harvest-7187-cards.json` (17MB)
   - `harvest-cache/*.json` (345 files, ~7k rows)

2. **Research Data** (`data/research/`)
   - `comps_ebay_db.json` (9,823 sold comps)
   - `ebay_current_extended.json` (20,164 active listings)
   - `listings_ebay_db.json` (20,164 normalized)
   - `comps_collectorcrypt.json` (2,530 comps)
   - `tcgplayer_anchors.json` (4,950 anchors)
   - `comps_fanatics_sold.json`, `listings_fanatics_from_sold.json`

3. **TCGPlayer Discovery** (`research/tcgplayer-discovery/`)
   - 34 JSON files including complete harvests, API samples, progress snapshots

4. **Fanatics Discovery** (`research/fanatics-collect-discovery/`)
   - 108 JSON files including mega-harvests, sold data, API discoveries

5. **CardMarket** (root `*.json`)
   - 8 security/SDK discovery files

6. **ML Seeds** (`ml/data/`)
   - `patterns.json`, `sets.json` (reference data)

**Output:**
- `data_lake/bronze/{source}/{timestamp}_{hash}.parquet`
- `data_lake/manifests/bronze-manifest-YYYY-MM-DD.json`

---

### Silver Layer (Normalized & Deduplicated)

**Purpose:** Create canonical, normalized tables with deduplication and provenance.

**Guarantees:**
- **No data loss** - Duplicates marked but preserved
- **Normalized schema** - Consistent fields across all sources
- **Currency normalization** - All prices in USD cents + original currency preserved
- **Variant keys** - Standardized card identifiers (`SET|NUMBER|VARIANT|LANG|GRADER|GRADE`)

**Tables:**

#### 1. `silver/listings.parquet` (Active Market Listings)

| Field | Type | Description |
|-------|------|-------------|
| `canonicalId` | string | SHA1 of source::sourceId |
| `source` | string | ebay, tcgplayer, collectorcrypt, fanatics, etc. |
| `sourceId` | string | External ID or content fingerprint |
| `variantKey` | string? | Normalized card identifier |
| `title` | string | Original listing title |
| `priceCents` | int64 | Normalized price in USD cents |
| `priceOrigCents` | int64 | Original price in original currency cents |
| `currency` | string | Always "USD" |
| `currencyOrig` | string | Original currency code |
| `fxRate` | double | Exchange rate used |
| `seller` | string? | Seller name |
| `venue` | string? | Marketplace venue |
| `condition` | string? | Card condition |
| `grader` | string? | Grading company (PSA, BGS, CGC, etc.) |
| `grade` | string? | Grade value |
| `seenAt` | timestamp | When listing was observed |
| `updatedAt` | timestamp? | Last update time |
| `isActive` | boolean | Is listing still active |
| `isDuplicate` | boolean | Duplicate flag (canonical = false) |
| `bronzeRef` | string | Reference to bronze parquet file |
| `rawPayload` | string | JSON of original row |

#### 2. `silver/comps.parquet` (Comparable Sales)

| Field | Type | Description |
|-------|------|-------------|
| `canonicalId` | string | SHA1 of source::sourceId |
| `source` | string | Source marketplace |
| `sourceId` | string | External ID or fingerprint |
| `variantKey` | string? | Normalized card identifier |
| `title` | string | Sale title |
| `soldPriceCents` | int64 | Sold price in USD cents |
| `soldPriceOrigCents` | int64 | Original sold price |
| `currency` | string | Always "USD" |
| `currencyOrig` | string | Original currency |
| `fxRate` | double | Exchange rate |
| `soldAt` | timestamp | Sale date |
| `venue` | string? | Venue |
| `condition` | string? | Condition |
| `grader` | string? | Grader |
| `grade` | string? | Grade |
| `isDuplicate` | boolean | Duplicate flag |
| `bronzeRef` | string | Bronze reference |
| `rawPayload` | string | Original JSON |

**Deduplication Logic:**
- **Primary key:** `(source, sourceId)`
- **Fingerprint (when sourceId missing):** `SHA1(lower(title) | price | grader | grade | variantKey | dateBucket(seenAt, 1d))`
- **Duplicate handling:** First occurrence = canonical, rest marked `isDuplicate=true`

**Normalization:**
- **Currency:** FX rates applied (EUR=1.08, GBP=1.27, CAD=0.73, etc.) → USD cents
- **Grader/Grade:** Extracted from structured fields OR parsed from title (e.g., "PSA 10")
- **Variant Key:** Parsed from `{set, number, variant}` or title patterns

**Output:**
- `data_lake/silver/listings.parquet`
- `data_lake/silver/comps.parquet`
- `data_lake/manifests/silver-manifest-YYYY-MM-DD.json`

**Reconstruction Proof:**
```
manifest.listings.total == manifest.listings.canonical + sum(duplicateGroups)
manifest.comps.total == manifest.comps.canonical + sum(duplicateGroups)
```

---

### Gold Layer (Feature-Ready Analytics)

**Purpose:** Produce aggregated, feature-engineered tables for ML and dashboards.

**Tables:**

#### 1. `gold/tfv_inputs.parquet` (True Fair Value Inputs)

Rolling window statistics for TFV calculation.

| Field | Type | Description |
|-------|------|-------------|
| `variantKey` | string | Card variant identifier |
| `windowDays` | int32 | Rolling window (7, 14, 30, 60, 90 days) |
| `medianCents` | int64 | Median sold price in window |
| `p05Cents` | int64 | 5th percentile |
| `p25Cents` | int64 | 25th percentile |
| `p75Cents` | int64 | 75th percentile |
| `p95Cents` | int64 | 95th percentile |
| `volume` | int32 | Number of sales in window |
| `volatilityBp` | int32 | Price volatility (basis points) |
| `venueTrust` | double | Weighted venue trust score (0-1) |
| `timeDecayWeight` | double | Recency weight (exp decay, 30d half-life) |
| `lastSoldAt` | timestamp | Most recent sale in window |

**Venue Trust Scores:**
- TCGPlayer: 0.95
- eBay: 0.85
- CollectorCrypt: 0.80
- CardMarket: 0.80
- Fanatics: 0.75
- Unknown: 0.50

#### 2. `gold/liquidity.parquet` (Liquidity Metrics)

Per-variant, per-venue liquidity indicators.

| Field | Type | Description |
|-------|------|-------------|
| `variantKey` | string | Card variant |
| `venue` | string | Marketplace |
| `salesPerWeek` | double | Avg weekly sales (last 90 days) |
| `avgDaysToClear` | double | Avg time between sales |
| `activeListings` | int32 | Current active listings |
| `lastSeenAt` | timestamp | Most recent listing observation |

#### 3. `gold/variant_agg.parquet` (Variant Summaries)

Card-level aggregations across all sources.

| Field | Type | Description |
|-------|------|-------------|
| `variantKey` | string | Card variant |
| `totalComps` | int32 | Total comp sales |
| `totalListings` | int32 | Total listings |
| `minPriceCents` | int64 | Min price observed |
| `maxPriceCents` | int64 | Max price observed |
| `avgPriceCents` | int64 | Average price |
| `medianPriceCents` | int64 | Median price |
| `lastSoldAt` | timestamp? | Most recent sale |
| `lastSeenAt` | timestamp? | Most recent listing |
| `sources` | string | Comma-separated source list |

**Output:**
- `data_lake/gold/tfv_inputs.parquet`
- `data_lake/gold/liquidity.parquet`
- `data_lake/gold/variant_agg.parquet`
- `data_lake/manifests/gold-manifest-YYYY-MM-DD.json`

---

## Database Sync (Postgres)

The Silver layer is synced to Postgres for operational queries.

**Tables:**
- `Card` - Card catalog (variantKey index)
- `MarketListing` - Active listings (unique on `[source, sourceId]`)
- `CompSale` - Comparable sales (unique on `[source, externalId]`)

**Indexes Created:**
```sql
-- Card indexes
CREATE INDEX idx_card_variant_key ON "Card"("variantKey");
CREATE INDEX idx_card_set_number ON "Card"("set", "number");

-- MarketListing indexes
CREATE INDEX idx_market_listing_card_seen ON "MarketListing"("cardId", "seenAt");
CREATE INDEX idx_market_listing_seen ON "MarketListing"("seenAt");
CREATE INDEX idx_market_listing_source ON "MarketListing"("source");

-- CompSale indexes
CREATE INDEX idx_comp_sale_card_sold ON "CompSale"("cardId", "soldAt");
CREATE INDEX idx_comp_sale_sold ON "CompSale"("soldAt");
CREATE INDEX idx_comp_sale_source ON "CompSale"("source");
```

**Card Resolution:**
- Cards are created/matched by `(set, number, variant, grade)`
- `variantKey` is stored for fast lookups

---

## Usage

### 1. Ingest Bronze Data

```bash
pnpm data:ingest:bronze
```

Scans all configured JSON sources and writes Parquet files to `data_lake/bronze/`.

**Output:**
- Bronze parquet files (content-addressed)
- `data_lake/manifests/bronze-manifest-YYYY-MM-DD.json`

### 2. Build Silver Layer

```bash
pnpm data:build:silver
```

Reads all bronze files, normalizes, deduplicates, and writes canonical tables.

**Output:**
- `data_lake/silver/listings.parquet`
- `data_lake/silver/comps.parquet`
- `data_lake/manifests/silver-manifest-YYYY-MM-DD.json`

### 3. Build Gold Layer

```bash
pnpm data:build:gold
```

Computes feature tables from silver data.

**Output:**
- `data_lake/gold/tfv_inputs.parquet`
- `data_lake/gold/liquidity.parquet`
- `data_lake/gold/variant_agg.parquet`
- `data_lake/manifests/gold-manifest-YYYY-MM-DD.json`

### 4. Sync to Postgres

```bash
pnpm data:sync:db
```

Upserts silver data into Postgres with indexes.

**Safety:**
- Uses `upsert` (no duplicate key errors)
- Creates indexes concurrently (non-blocking)
- Batch processing (1000 rows/batch)

### 5. Full Pipeline

```bash
pnpm data:ingest:bronze && \
pnpm data:build:silver && \
pnpm data:build:gold && \
pnpm data:sync:db
```

---

## Variant Key Format

**Standard Format:**
```
{SET}|{NUMBER}|{VARIANT}|{LANG}|{GRADER}|{GRADE}
```

**Examples:**
```
BASE|4|HOLO|EN|PSA|10
VIVID_VOLTAGE|143|RAINBOW|EN|BGS|9.5
EVOLVING_SKIES|74|BASE|EN|RAW|UNGRADED
```

**Parsing Rules:**
1. Try direct `row.variantKey` or `row.cardKey`
2. Build from `{set, number, variant, language, grader, grade}`
3. Parse from title patterns (e.g., "Base Set #4 Holo PSA 10")
4. Default: `UNKNOWN|0|BASE|EN|RAW|UNGRADED`

---

## Validation & Checks

### Post-Run Checks

After each layer build, check the manifest:

#### Bronze
```bash
cat data_lake/manifests/bronze-manifest-*.json | jq '{totalFiles, totalRows, sources}'
```

Expected: 150+ files, 100k+ total rows

#### Silver
```bash
cat data_lake/manifests/silver-manifest-*.json | jq '{listings, comps, reconstructionProof}'
```

Expected:
- `reconstructionProof.listingsCheck: true`
- `reconstructionProof.compsCheck: true`

#### Gold
```bash
cat data_lake/manifests/gold-manifest-*.json | jq '{tfvInputs, liquidityMetrics, variantAggs}'
```

### SQL Validation

```sql
-- Check uniqueness in Postgres
SELECT source, "sourceId", COUNT(*)
FROM "MarketListing"
GROUP BY source, "sourceId"
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check comp uniqueness
SELECT source, "externalId", COUNT(*)
FROM "CompSale"
WHERE "externalId" IS NOT NULL
GROUP BY source, "externalId"
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check variant key coverage
SELECT
  COUNT(*) FILTER (WHERE "variantKey" IS NOT NULL) * 100.0 / COUNT(*) AS pct_with_key
FROM "Card";
-- Should be >50%
```

---

## Reconstruction

To reconstruct the original raw data from any silver row:

1. Find `bronzeRef` in the silver row
2. Read the bronze parquet file at that path
3. Parse `rawPayload` from silver row
4. Match against bronze rows by content hash

**Example:**
```typescript
const listing = silverListings.find(l => l.sourceId === 'abc123');
const bronzeFile = listing.bronzeRef; // "data_lake/bronze/ebay/2025-10-02T12-00-00_a1b2c3d4.parquet"
const rawPayload = JSON.parse(listing.rawPayload);
// rawPayload contains the original JSON object
```

---

## File Formats

### Why Parquet?

- **Columnar storage** - 10x smaller than JSON for analytics
- **Schema enforcement** - Type safety
- **Fast queries** - Skip non-relevant columns
- **Industry standard** - Works with DuckDB, Spark, Arrow, Pandas

### Reading Parquet

**Node.js:**
```typescript
import * as parquet from 'parquetjs';

const reader = await parquet.ParquetReader.openFile('data_lake/silver/listings.parquet');
const cursor = reader.getCursor();

let row;
while ((row = await cursor.next())) {
  console.log(row);
}
await reader.close();
```

**DuckDB (SQL):**
```sql
SELECT * FROM 'data_lake/silver/listings.parquet'
WHERE variantKey = 'BASE|4|HOLO|EN|PSA|10'
LIMIT 10;
```

**Python (Pandas):**
```python
import pandas as pd
df = pd.read_parquet('data_lake/silver/listings.parquet')
print(df.head())
```

---

## Safety & Idempotency

### Content Addressing
- Bronze files are named by SHA256 hash of source file
- Re-running ingestion on same data produces identical filenames (no duplicates)

### Deduplication
- Silver layer marks duplicates (`isDuplicate=true`) but **never deletes**
- Reconstruction proof in manifest ensures `rows_in == rows_out`

### Append-Only
- Bronze layer is **append-only** (never overwrites)
- Silver/Gold can be **regenerated** from bronze without loss

### No Raw File Deletion
- Original JSON files are **never deleted** by the pipeline
- Recommend moving to `/archive/` manually after successful bronze ingestion

---

## Extending the Pipeline

### Adding a New Source

1. Edit `scripts/data/ingest-bronze.ts`:
```typescript
const DATA_SOURCES = [
  // ... existing sources
  {
    glob: 'new-source/**/*.json',
    source: 'newsource',
    exclude: ['package.json']
  },
];
```

2. Run bronze ingestion:
```bash
pnpm data:ingest:bronze
```

3. Rebuild silver/gold:
```bash
pnpm data:build:silver && pnpm data:build:gold
```

### Adding a Gold Feature Table

1. Edit `scripts/data/build-gold.ts`
2. Add a new builder function:
```typescript
function buildMyFeature(comps, listings) {
  // compute features
  return features;
}
```
3. Write parquet in `main()`:
```typescript
await writeParquet(features, path.join(GOLD_DIR, 'my_feature.parquet'), schema);
```

---

## Troubleshooting

### Out of Memory (OOM)

**Symptom:** Node process crashes during silver/gold build

**Solution:**
- Increase Node heap: `NODE_OPTIONS=--max-old-space-size=8192 pnpm data:build:silver`
- Process in chunks (modify scripts to batch bronze files)

### Duplicate Key Errors in Postgres

**Symptom:** `ERROR: duplicate key value violates unique constraint`

**Solution:**
- Check if `sourceId` generation is deterministic
- Verify `source` field is correct
- Check for actual duplicates in silver data (should be marked `isDuplicate=true`)

### Missing Variant Keys

**Symptom:** Many rows with `variantKey = null`

**Solution:**
- Improve title parsing in `parseVariantKeyFromTitle()`
- Add more patterns to `normalizeVariantKey()`
- Check ML normalization models (`ml/normalize.py`)

### Slow Postgres Sync

**Symptom:** Sync takes hours

**Solution:**
- Increase `BATCH_SIZE` in `sync-postgres.ts`
- Ensure indexes exist (`pnpm data:sync:db` creates them)
- Run `VACUUM ANALYZE` on Postgres tables

---

## Manifest Schema

### Bronze Manifest
```json
{
  "version": "1.0",
  "generatedAt": "ISO timestamp",
  "totalFiles": 150,
  "totalRows": 100000,
  "sources": ["collectorcrypt", "ebay", "tcgplayer", ...],
  "manifests": [
    {
      "source": "ebay",
      "pathRaw": "data/research/comps_ebay_db.json",
      "rows": 9823,
      "schemaKeys": ["title", "price", "soldAt", ...],
      "timeField": "soldAt",
      "timeRange": ["2023-01-01T00:00:00Z", "2025-10-02T00:00:00Z"],
      "contentSha256": "abc123...",
      "ingestedAt": "2025-10-02T12:00:00Z",
      "variantKeyCoverage": 0.85,
      "fileSize": 2048576,
      "bronzePath": "data_lake/bronze/ebay/2025-10-02T12-00-00_abc123.parquet"
    }
  ]
}
```

### Silver Manifest
```json
{
  "version": "1.0",
  "generatedAt": "ISO timestamp",
  "inputFiles": ["data_lake/bronze/ebay/...parquet", ...],
  "inputRows": 100000,
  "listings": {
    "total": 50000,
    "canonical": 48000,
    "duplicates": 2000
  },
  "comps": {
    "total": 50000,
    "canonical": 49000,
    "duplicates": 1000
  },
  "reconstructionProof": {
    "listingsCheck": true,
    "compsCheck": true
  }
}
```

### Gold Manifest
```json
{
  "version": "1.0",
  "generatedAt": "ISO timestamp",
  "inputComps": 49000,
  "inputListings": 48000,
  "tfvInputs": 12500,
  "liquidityMetrics": 3200,
  "variantAggs": 2500,
  "timeWindows": [7, 14, 30, 60, 90]
}
```

---

## License & Credits

**Architecture:** Medallion (Bronze-Silver-Gold) lakehouse pattern

**Tools:**
- **Parquet:** Apache Parquet format via `parquetjs`
- **Database:** PostgreSQL via Prisma ORM
- **Validation:** Zod schemas

**Contributors:** PokeDAO Team

---

**Last Updated:** 2025-10-02
