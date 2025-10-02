# Data Pipeline RUNBOOK

## Quick Start

**Run the complete pipeline:**

```bash
pnpm data:pipeline
```

This will sequentially execute:
1. Bronze ingestion
2. Silver normalization
3. Gold feature building
4. Postgres sync

---

## Individual Steps

### 1. Bronze Ingestion

**Command:**
```bash
pnpm data:ingest:bronze
```

**What it does:**
- Scans all configured JSON sources
- Converts to content-addressed Parquet files
- Generates bronze manifest with metadata

**Expected output:**
```
🚀 Starting Bronze Layer Ingestion

📂 Processing source: collectorcrypt
   Found 4 files
📥 Ingesting: worker/unified-collector-crypt-dataset.json
✅ Wrote 24307 rows to 2025-10-02T12-00-00_abc123.parquet
...

================================================================================
✅ Bronze Ingestion Complete
================================================================================
📊 Total files: 150
📊 Total rows: 150,000
📊 Sources: collectorcrypt, ebay, tcgplayer, fanatics, cardmarket, ml_seeds
📄 Manifest: data_lake/manifests/bronze-manifest-2025-10-02.json
================================================================================
```

**Post-run checks:**
```bash
# Check manifest
cat data_lake/manifests/bronze-manifest-*.json | jq '{totalFiles, totalRows, sources}'

# Expected: 150+ files, 100k+ rows

# Check bronze files exist
ls -lh data_lake/bronze/*/

# Should see parquet files in each source directory
```

**Common issues:**

| Issue | Solution |
|-------|----------|
| Out of memory | Increase Node heap: `NODE_OPTIONS=--max-old-space-size=8192 pnpm data:ingest:bronze` |
| Parse errors | Check JSON syntax in source files |
| Missing files | Verify paths in `DATA_SOURCES` config |

---

### 2. Silver Normalization

**Command:**
```bash
pnpm data:build:silver
```

**What it does:**
- Reads all bronze parquet files
- Normalizes schemas and currency
- Deduplicates by (source, sourceId)
- Generates variant keys
- Writes canonical listings and comps tables

**Expected output:**
```
🚀 Starting Silver Layer Build

📖 Reading bronze files...
   Loaded 150,000 total rows from 150 files

🏗️  Building silver/listings...
   Processing 75,000 listing rows...
   Canonical: 72,000
   Duplicates: 3,000

🏗️  Building silver/comps...
   Processing 75,000 comp rows...
   Canonical: 73,500
   Duplicates: 1,500

✅ Wrote 75,000 rows to listings.parquet
✅ Wrote 75,000 rows to comps.parquet

================================================================================
✅ Silver Layer Build Complete
================================================================================
📊 Listings: 72,000 canonical, 3,000 duplicate groups
📊 Comps: 73,500 canonical, 1,500 duplicate groups
📄 Manifest: data_lake/manifests/silver-manifest-2025-10-02.json
================================================================================
```

**Post-run checks:**
```bash
# Check manifest
cat data_lake/manifests/silver-manifest-*.json | jq '{listings, comps, reconstructionProof}'

# Verify reconstruction proof
# Expected: reconstructionProof.listingsCheck = true, compsCheck = true

# Check silver files
ls -lh data_lake/silver/
# Should see listings.parquet and comps.parquet

# Sample data (requires parquet-tools or DuckDB)
duckdb -c "SELECT * FROM 'data_lake/silver/listings.parquet' LIMIT 5"
```

**Common issues:**

| Issue | Solution |
|-------|----------|
| Reconstruction proof fails | Bug in dedup logic - check source code |
| Low variant key coverage | Improve `normalizeVariantKey()` parsing |
| Duplicate warnings | Expected - duplicates are marked, not removed |

---

### 3. Gold Feature Building

**Command:**
```bash
pnpm data:build:gold
```

**What it does:**
- Reads silver parquet files
- Computes rolling window statistics (7, 14, 30, 60, 90 days)
- Calculates liquidity metrics
- Aggregates variant-level summaries

**Expected output:**
```
🚀 Starting Gold Layer Build

📖 Reading silver/comps...
   Loaded 73,500 comps

📖 Reading silver/listings...
   Loaded 72,000 listings

🏗️  Building gold/tfv_inputs...
   Found 2,500 unique variants
✅ Wrote 12,500 rows to tfv_inputs.parquet

🏗️  Building gold/liquidity...
✅ Wrote 3,200 rows to liquidity.parquet

🏗️  Building gold/variant_agg...
✅ Wrote 2,500 rows to variant_agg.parquet

================================================================================
✅ Gold Layer Build Complete
================================================================================
📊 TFV Inputs: 12,500
📊 Liquidity Metrics: 3,200
📊 Variant Aggregations: 2,500
📄 Manifest: data_lake/manifests/gold-manifest-2025-10-02.json
================================================================================
```

**Post-run checks:**
```bash
# Check manifest
cat data_lake/manifests/gold-manifest-*.json | jq '{tfvInputs, liquidityMetrics, variantAggs}'

# Check gold files
ls -lh data_lake/gold/
# Should see tfv_inputs.parquet, liquidity.parquet, variant_agg.parquet

# Sample TFV data
duckdb -c "SELECT variantKey, windowDays, medianCents, volume FROM 'data_lake/gold/tfv_inputs.parquet' WHERE windowDays = 30 LIMIT 10"

# Check liquidity for high-volume cards
duckdb -c "SELECT * FROM 'data_lake/gold/liquidity.parquet' ORDER BY salesPerWeek DESC LIMIT 10"
```

**Common issues:**

| Issue | Solution |
|-------|----------|
| No TFV inputs generated | Check that comps have valid `variantKey` and `soldAt` |
| Low variant count | Improve variant key parsing in silver layer |
| Missing time windows | Check `TIME_WINDOWS` config in build-gold.ts |

---

### 4. Postgres Sync

**Command:**
```bash
pnpm data:sync:db
```

**Prerequisites:**
- Postgres running and accessible
- `DATABASE_URL` set in `.env`
- Prisma migrations applied: `pnpm --filter api prisma migrate deploy`

**What it does:**
- Reads silver parquet files
- Upserts MarketListing and CompSale tables
- Creates/updates Card records
- Creates indexes concurrently

**Expected output:**
```
🚀 Starting Postgres Sync

📖 Reading silver data...
   Listings: 72,000
   Comps: 73,500

🔧 Ensuring database indexes...
   ✅ idx_card_variant_key
   ✅ idx_card_set_number
   ✅ idx_market_listing_card_seen
   ✅ idx_market_listing_seen
   ✅ idx_market_listing_source
   ✅ idx_comp_sale_card_sold
   ✅ idx_comp_sale_sold
   ✅ idx_comp_sale_source

📥 Syncing 72,000 listings...
   72,000 canonical listings
   Progress: 72,000/72,000
✅ Synced 72,000 listings (0 errors)

📥 Syncing 73,500 comps...
   73,500 canonical comps
   Progress: 73,500/73,500
✅ Synced 73,500 comps (0 errors)

================================================================================
✅ Postgres Sync Complete
================================================================================
📊 Total Cards: 2,500
📊 Total Market Listings: 72,000
📊 Total Comp Sales: 73,500
================================================================================
```

**Post-run checks:**

```sql
-- Connect to Postgres
psql $DATABASE_URL

-- Check counts
SELECT
  (SELECT COUNT(*) FROM "Card") AS cards,
  (SELECT COUNT(*) FROM "MarketListing") AS listings,
  (SELECT COUNT(*) FROM "CompSale") AS comps;

-- Check for duplicate keys (should be 0)
SELECT source, "sourceId", COUNT(*)
FROM "MarketListing"
GROUP BY source, "sourceId"
HAVING COUNT(*) > 1;

SELECT source, "externalId", COUNT(*)
FROM "CompSale"
WHERE "externalId" IS NOT NULL
GROUP BY source, "externalId"
HAVING COUNT(*) > 1;

-- Check variant key coverage
SELECT
  COUNT(*) FILTER (WHERE "variantKey" IS NOT NULL) * 100.0 / COUNT(*) AS pct_with_key
FROM "Card";
-- Expected: >50%

-- Check indexes exist
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('Card', 'MarketListing', 'CompSale')
ORDER BY tablename, indexname;

-- Sample recent listings
SELECT c.name, c.set, c.number, ml.source, ml."priceCents", ml."seenAt"
FROM "MarketListing" ml
JOIN "Card" c ON c.id = ml."cardId"
ORDER BY ml."seenAt" DESC
LIMIT 10;

-- Sample recent comps
SELECT c.name, c.set, c.number, cs.source, cs."priceCents", cs."soldAt"
FROM "CompSale" cs
JOIN "Card" c ON c.id = cs."cardId"
ORDER BY cs."soldAt" DESC
LIMIT 10;
```

**Common issues:**

| Issue | Solution |
|-------|----------|
| Duplicate key errors | Check `sourceId` generation is deterministic |
| Connection refused | Verify `DATABASE_URL` and Postgres is running |
| Slow sync (>10 min) | Increase `BATCH_SIZE` in sync-postgres.ts |
| Missing indexes | Run manually: `CREATE INDEX CONCURRENTLY ...` |

---

## Full Pipeline

**Command:**
```bash
pnpm data:pipeline
```

**Duration:** 5-15 minutes (depending on data size)

**Steps:**
1. Bronze ingestion (~2 min)
2. Silver normalization (~3 min)
3. Gold feature building (~2 min)
4. Postgres sync (~5 min)

**Post-run validation:**

```bash
# 1. Check all manifests exist
ls -lh data_lake/manifests/

# 2. Check parquet files
ls -lh data_lake/bronze/*/
ls -lh data_lake/silver/
ls -lh data_lake/gold/

# 3. Validate reconstruction proofs
cat data_lake/manifests/silver-manifest-*.json | jq '.reconstructionProof'
# Expected: { "listingsCheck": true, "compsCheck": true }

# 4. Check Postgres
psql $DATABASE_URL -c "SELECT
  (SELECT COUNT(*) FROM \"Card\") AS cards,
  (SELECT COUNT(*) FROM \"MarketListing\") AS listings,
  (SELECT COUNT(*) FROM \"CompSale\") AS comps;"

# 5. Verify no duplicate keys
psql $DATABASE_URL -c "SELECT COUNT(*) FROM (
  SELECT source, \"sourceId\", COUNT(*)
  FROM \"MarketListing\"
  GROUP BY source, \"sourceId\"
  HAVING COUNT(*) > 1
) dups;"
# Expected: 0
```

---

## Incremental Updates

### Strategy 1: Re-ingest All (Full Refresh)

**Use case:** Major schema changes, adding new sources

```bash
# Archive old data lake
mv data_lake data_lake_backup_$(date +%Y%m%d)

# Run full pipeline
pnpm data:pipeline
```

### Strategy 2: Append New Data

**Use case:** New JSON files added to sources

1. Add new JSON files to appropriate directories
2. Run bronze ingestion only:
   ```bash
   pnpm data:ingest:bronze
   ```
3. Rebuild silver/gold:
   ```bash
   pnpm data:build:silver && pnpm data:build:gold
   ```
4. Sync to Postgres:
   ```bash
   pnpm data:sync:db
   ```

**Note:** Bronze is idempotent (content-addressed), so re-running on same files produces no duplicates.

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Bronze ingestion rate:** Files/min
2. **Silver dedup ratio:** `duplicates / total * 100`
3. **Variant key coverage:** `rows_with_variantKey / total_rows * 100`
4. **Postgres sync errors:** Error count per batch
5. **Data freshness:** `max(seenAt)` in MarketListing

### Health Checks

```bash
# Check latest manifest dates
ls -lt data_lake/manifests/ | head -5

# Check Postgres freshness
psql $DATABASE_URL -c "SELECT MAX(\"seenAt\") AS last_seen FROM \"MarketListing\";"

# Check for stale data (>7 days old)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"MarketListing\" WHERE \"seenAt\" < NOW() - INTERVAL '7 days';"
```

---

## Rollback

### If Pipeline Fails Mid-Run

**Bronze layer:**
- Safe to delete incomplete parquet files and re-run
- Or: keep existing bronze files and run silver/gold only

**Silver layer:**
- Delete `data_lake/silver/*.parquet`
- Re-run: `pnpm data:build:silver`

**Gold layer:**
- Delete `data_lake/gold/*.parquet`
- Re-run: `pnpm data:build:gold`

**Postgres:**
- Truncate tables:
  ```sql
  TRUNCATE "MarketListing" CASCADE;
  TRUNCATE "CompSale" CASCADE;
  -- Keep Card table to avoid FK violations
  ```
- Re-run: `pnpm data:sync:db`

### Restore from Backup

```bash
# Restore data lake
rm -rf data_lake
mv data_lake_backup_YYYYMMDD data_lake

# Restore Postgres (if you have pg_dump backup)
pg_restore -d $DATABASE_URL backup.dump
```

---

## Performance Tuning

### Node.js Heap Size

For large datasets (>200k rows):

```bash
NODE_OPTIONS="--max-old-space-size=8192" pnpm data:ingest:bronze
NODE_OPTIONS="--max-old-space-size=8192" pnpm data:build:silver
```

### Postgres Tuning

For faster sync:

```sql
-- Increase work memory
SET work_mem = '256MB';

-- Disable autovacuum during bulk insert
ALTER TABLE "MarketListing" SET (autovacuum_enabled = false);
ALTER TABLE "CompSale" SET (autovacuum_enabled = false);

-- After sync completes:
VACUUM ANALYZE "MarketListing";
VACUUM ANALYZE "CompSale";

ALTER TABLE "MarketListing" SET (autovacuum_enabled = true);
ALTER TABLE "CompSale" SET (autovacuum_enabled = true);
```

### Batch Size

Edit `scripts/data/sync-postgres.ts`:

```typescript
const BATCH_SIZE = 5000; // Increase from default 1000
```

---

## Debugging

### Enable Verbose Logging

Edit scripts and add:

```typescript
console.log('DEBUG:', JSON.stringify(row, null, 2));
```

### Read Parquet Files Manually

**Using DuckDB:**
```bash
duckdb
```
```sql
SELECT * FROM 'data_lake/bronze/ebay/2025-10-02T12-00-00_abc123.parquet' LIMIT 10;
```

**Using Node.js:**
```typescript
import * as parquet from 'parquetjs';

const reader = await parquet.ParquetReader.openFile('data_lake/silver/listings.parquet');
const cursor = reader.getCursor();

let i = 0;
let row;
while ((row = await cursor.next()) && i++ < 10) {
  console.log(row);
}

await reader.close();
```

### Check Variant Key Parsing

```bash
# Extract sample titles and run through parser
duckdb -c "SELECT DISTINCT title FROM 'data_lake/bronze/ebay/*.parquet' LIMIT 100" > sample_titles.txt

# Add test cases to build-silver.ts and run locally
```

---

## Maintenance

### Weekly Tasks

1. **Run full pipeline** to ingest new data:
   ```bash
   pnpm data:pipeline
   ```

2. **Archive old manifests** (keep last 30 days):
   ```bash
   find data_lake/manifests -name "*.json" -mtime +30 -delete
   ```

3. **Vacuum Postgres:**
   ```sql
   VACUUM ANALYZE "Card";
   VACUUM ANALYZE "MarketListing";
   VACUUM ANALYZE "CompSale";
   ```

### Monthly Tasks

1. **Backup data lake:**
   ```bash
   tar -czf data_lake_backup_$(date +%Y%m%d).tar.gz data_lake/
   ```

2. **Review duplicate ratio** in silver manifests

3. **Audit variant key coverage** and improve parsing rules

---

## Troubleshooting Checklist

- [ ] Node.js version >= 20
- [ ] `pnpm install` completed successfully
- [ ] Postgres running and accessible
- [ ] `DATABASE_URL` set correctly in `.env`
- [ ] Prisma migrations applied: `pnpm --filter api prisma migrate deploy`
- [ ] Source JSON files exist at expected paths
- [ ] Sufficient disk space (10GB+ free)
- [ ] Sufficient RAM (8GB+ recommended)

---

## Support

**Issues:** Report bugs at [GitHub Issues](https://github.com/your-org/pokedao/issues)

**Documentation:** See [data/README_data.md](./README_data.md) for detailed schemas

**Schema reference:** [api/prisma/schema.prisma](../api/prisma/schema.prisma)

---

**Last Updated:** 2025-10-02
