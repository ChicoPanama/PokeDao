-- Performance Optimization Indexes for Search & Arbitrage
-- Run: psql $DATABASE_URL -f api/prisma/migrations/add_search_arbitrage_indexes.sql

-- ============================================================================
-- UNIFIEDMARKETLISTING OPTIMIZATIONS (Critical for Search & Arbitrage)
-- ============================================================================

-- Composite index for search queries (cardName + setName + gradeCompany + grade + price)
CREATE INDEX IF NOT EXISTS idx_unified_search_composite
ON "UnifiedMarketListing" (
  "cardName" text_pattern_ops,
  "setName" text_pattern_ops,
  "gradeCompany",
  "grade",
  "priceCents"
) WHERE "cardName" != 'Unknown' AND "setName" != 'Unknown';

-- Composite index for arbitrage detection (cardName + setName + grade + source)
CREATE INDEX IF NOT EXISTS idx_unified_arbitrage_composite
ON "UnifiedMarketListing" (
  "cardName",
  "setName",
  "gradeCompany",
  "grade",
  "source",
  "priceCents"
) WHERE "cardName" != 'Unknown' AND "setName" != 'Unknown' AND "priceCents" > 0;

-- Price range queries
CREATE INDEX IF NOT EXISTS idx_unified_price_range
ON "UnifiedMarketListing" ("priceCents")
WHERE "priceCents" > 0 AND "cardName" != 'Unknown';

-- Recent listings (for trending/volatility analysis)
CREATE INDEX IF NOT EXISTS idx_unified_recent
ON "UnifiedMarketListing" ("updatedAt" DESC, "priceCents")
WHERE "priceCents" > 0;

-- Data quality filtering
CREATE INDEX IF NOT EXISTS idx_unified_quality_filter
ON "UnifiedMarketListing" ("dataQuality", "cardName", "setName")
WHERE "dataQuality" >= 0.5;

-- Full-text search on title (for autocomplete)
CREATE INDEX IF NOT EXISTS idx_unified_title_search
ON "UnifiedMarketListing" USING gin(to_tsvector('english', "title"));

-- Partial index for high-value cards ($100+)
CREATE INDEX IF NOT EXISTS idx_unified_high_value
ON "UnifiedMarketListing" ("cardName", "setName", "priceCents")
WHERE "priceCents" >= 10000 AND "cardName" != 'Unknown';

-- ============================================================================
-- CROSSREFERENCEDATA OPTIMIZATIONS
-- ============================================================================

-- Listing lookup optimization
CREATE INDEX IF NOT EXISTS idx_crossref_listing_lookup
ON "CrossReferenceData" ("listingId", "matchConfidence")
WHERE "matchConfidence" > 0.7;

-- Pokemon TCG API ID lookup
CREATE INDEX IF NOT EXISTS idx_crossref_tcg_id
ON "CrossReferenceData" ("pokemonTcgId")
WHERE "pokemonTcgId" IS NOT NULL;

-- ============================================================================
-- UNIFIEDARBITRAGEOPPORTUNITY OPTIMIZATIONS
-- ============================================================================

-- Active opportunities sorted by profit
CREATE INDEX IF NOT EXISTS idx_arbitrage_active_profit
ON "UnifiedArbitrageOpportunity" ("netProfitCents" DESC, "confidence")
WHERE "netProfitCents" > 0 AND "confidence" > 0.5;

-- Filter by risk level
CREATE INDEX IF NOT EXISTS idx_arbitrage_risk_profit
ON "UnifiedArbitrageOpportunity" ("risk", "marginPct" DESC, "netProfitCents" DESC);

-- Recent opportunities
CREATE INDEX IF NOT EXISTS idx_arbitrage_recent
ON "UnifiedArbitrageOpportunity" ("createdAt" DESC, "netProfitCents")
WHERE "netProfitCents" > 0;

-- ============================================================================
-- LISTING & MARKETLISTING OPTIMIZATIONS (Legacy tables)
-- ============================================================================

-- Active listings by price
CREATE INDEX IF NOT EXISTS idx_listing_active_price
ON "Listing" ("isActive", "price", "scrapedAt" DESC)
WHERE "isActive" = true;

-- Market listings by card and price
CREATE INDEX IF NOT EXISTS idx_market_listing_card_price
ON "MarketListing" ("cardId", "priceCents", "isActive")
WHERE "isActive" = true;

-- ============================================================================
-- COMPSALE OPTIMIZATIONS
-- ============================================================================

-- Recent comps by card
CREATE INDEX IF NOT EXISTS idx_compsale_recent_card
ON "CompSale" ("cardId", "soldAt" DESC, "priceCents");

-- Price range comps
CREATE INDEX IF NOT EXISTS idx_compsale_price_range
ON "CompSale" ("priceCents", "soldAt" DESC)
WHERE "isVerified" = true;

-- ============================================================================
-- WATCHLISTITEM OPTIMIZATIONS
-- ============================================================================

-- User watchlist lookup
CREATE INDEX IF NOT EXISTS idx_watchlist_user_recent
ON "WatchlistItem" ("userId", "createdAt" DESC);

-- ============================================================================
-- SIGNAL OPTIMIZATIONS
-- ============================================================================

-- Active signals by confidence
CREATE INDEX IF NOT EXISTS idx_signal_active_confidence
ON "Signal" ("status", "confidence" DESC, "edgeBp" DESC)
WHERE "status" = 'ACTIVE';

-- ============================================================================
-- ANALYTICS QUERIES
-- ============================================================================

-- Daily volume by source
CREATE INDEX IF NOT EXISTS idx_unified_daily_volume
ON "UnifiedMarketListing" ("source", date_trunc('day', "createdAt"), "priceCents");

-- VACUUM ANALYZE to update statistics
VACUUM ANALYZE "UnifiedMarketListing";
VACUUM ANALYZE "UnifiedArbitrageOpportunity";
VACUUM ANALYZE "CrossReferenceData";
VACUUM ANALYZE "CompSale";
VACUUM ANALYZE "Listing";
VACUUM ANALYZE "MarketListing";

-- ============================================================================
-- PERFORMANCE VERIFICATION
-- ============================================================================

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;

-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
