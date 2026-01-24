-- Migration: Add TimescaleDB for time-series price data
-- This migration adds TimescaleDB extension and converts sale_records to a hypertable
-- for efficient time-series queries and 95% compression on historical data.

-- ============================================================================
-- Step 1: Enable TimescaleDB Extension
-- ============================================================================
-- Note: TimescaleDB must be installed on your PostgreSQL server.
-- For Render/Supabase, enable via dashboard. For local, install extension.

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- Step 2: Convert sale_records to Hypertable
-- ============================================================================
-- Hypertables automatically partition data by time for efficient queries.
-- Using 1-month chunks balances query performance and maintenance overhead.

-- First, ensure soldAt column has no NULL values (required for hypertable)
UPDATE sale_records SET "soldAt" = "createdAt" WHERE "soldAt" IS NULL;

-- Convert to hypertable (partitioned by soldAt)
-- migrate_data => true copies existing data into chunks
SELECT create_hypertable(
  'sale_records',
  'soldAt',
  chunk_time_interval => INTERVAL '1 month',
  migrate_data => true,
  if_not_exists => true
);

-- ============================================================================
-- Step 3: Enable Compression
-- ============================================================================
-- Compression reduces storage by ~95% for older data.
-- Segment by canonicalCardId for efficient filtered queries.

ALTER TABLE sale_records SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"canonicalCardId"',
  timescaledb.compress_orderby = '"soldAt" DESC'
);

-- Automatically compress chunks older than 30 days
SELECT add_compression_policy(
  'sale_records',
  INTERVAL '30 days',
  if_not_exists => true
);

-- ============================================================================
-- Step 4: Create Continuous Aggregates (Optional but Recommended)
-- ============================================================================
-- Pre-computed daily price rollups for fast analytics queries.

CREATE MATERIALIZED VIEW IF NOT EXISTS sale_records_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', "soldAt") AS bucket,
  "canonicalCardId",
  source,
  COUNT(*) AS sale_count,
  AVG("soldPriceCents") AS avg_price_cents,
  MIN("soldPriceCents") AS min_price_cents,
  MAX("soldPriceCents") AS max_price_cents,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "soldPriceCents") AS median_price_cents
FROM sale_records
GROUP BY bucket, "canonicalCardId", source
WITH NO DATA;

-- Refresh policy: Update daily aggregates every hour
SELECT add_continuous_aggregate_policy(
  'sale_records_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => true
);

-- ============================================================================
-- Step 5: Retention Policy (Optional)
-- ============================================================================
-- Uncomment to automatically drop data older than 2 years
-- SELECT add_retention_policy('sale_records', INTERVAL '2 years');

-- ============================================================================
-- Verification Queries (run manually to verify)
-- ============================================================================
-- Check hypertable exists:
--   SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'sale_records';
--
-- Check chunks:
--   SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'sale_records';
--
-- Check compression:
--   SELECT * FROM timescaledb_information.compression_settings WHERE hypertable_name = 'sale_records';
--
-- Check continuous aggregate:
--   SELECT * FROM timescaledb_information.continuous_aggregates WHERE view_name = 'sale_records_daily';
