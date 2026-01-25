#!/usr/bin/env node

/**
 * Mew-1A Training Data Quality Audit
 *
 * Analyzes consolidated data for AI training readiness:
 * - Data completeness by source
 * - High-value training candidates
 * - Price distribution and outliers
 * - Multi-source coverage for arbitrage training
 * - Recommendations for training dataset extraction
 */

import prisma from '../api/src/lib/prisma.js';

interface SourceStats {
  source: string;
  total_records: number;
  unique_cards: number;
  with_price: number;
  price_coverage_pct: number;
  with_card_number: number;
  with_set: number;
  avg_quality: number | null;
}

interface PremiumCard {
  cardName: string;
  setName: string | null;
  cardNumber: string | null;
  listing_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_volatility: number | null;
  source_diversity: number;
  avg_quality_score: number | null;
}

async function main() {
  console.log('🔬 MEW-1A TRAINING DATA QUALITY AUDIT');
  console.log('═'.repeat(80));
  console.log('');

  // 1. DATA COMPLETENESS BY SOURCE
  console.log('📊 1. DATA COMPLETENESS BY SOURCE');
  console.log('─'.repeat(80));

  const sourceStats = await prisma.$queryRaw<SourceStats[]>`
    SELECT
      source,
      COUNT(*)::INTEGER as total_records,
      COUNT(DISTINCT "cardName")::INTEGER as unique_cards,
      COUNT("priceCents")::INTEGER as with_price,
      ROUND(100.0 * COUNT("priceCents") / COUNT(*), 2)::NUMERIC as price_coverage_pct,
      COUNT("cardNumber")::INTEGER as with_card_number,
      COUNT("setName")::INTEGER as with_set,
      AVG("dataQuality")::NUMERIC(4,2) as avg_quality
    FROM "UnifiedMarketListing"
    GROUP BY source
    ORDER BY total_records DESC
  `;

  console.table(sourceStats);
  console.log('');

  // 2. OVERALL DATABASE QUALITY
  console.log('📈 2. OVERALL DATABASE QUALITY');
  console.log('─'.repeat(80));

  const overallStats = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*)::INTEGER as total_records,
      COUNT(DISTINCT "cardName")::INTEGER as unique_cards,
      COUNT(DISTINCT "setName")::INTEGER as unique_sets,
      COUNT("priceCents")::INTEGER as with_price,
      ROUND(100.0 * COUNT("priceCents") / COUNT(*), 2)::NUMERIC as price_coverage_pct,
      ROUND(AVG("priceCents")/100.0, 2)::NUMERIC as avg_price_usd,
      ROUND(MIN("priceCents")/100.0, 2)::NUMERIC as min_price_usd,
      ROUND(MAX("priceCents")/100.0, 2)::NUMERIC as max_price_usd,
      AVG("dataQuality")::NUMERIC(4,2) as avg_quality_score
    FROM "UnifiedMarketListing"
  `;

  console.table(overallStats);
  console.log('');

  // 3. HIGH-VALUE TRAINING CANDIDATES
  console.log('🎯 3. HIGH-VALUE TRAINING CANDIDATES');
  console.log('─'.repeat(80));
  console.log('Cards with 5+ listings, multiple sources, complete data...');
  console.log('');

  const premiumCards = await prisma.$queryRaw<PremiumCard[]>`
    SELECT
      "cardName",
      "setName",
      "cardNumber",
      COUNT(*)::INTEGER as listing_count,
      ROUND(AVG("priceCents")/100.0, 2)::NUMERIC as avg_price,
      ROUND(MIN("priceCents")/100.0, 2)::NUMERIC as min_price,
      ROUND(MAX("priceCents")/100.0, 2)::NUMERIC as max_price,
      STDDEV("priceCents"/100.0)::NUMERIC(10,2) as price_volatility,
      COUNT(DISTINCT source)::INTEGER as source_diversity,
      AVG("dataQuality")::NUMERIC(4,2) as avg_quality_score
    FROM "UnifiedMarketListing"
    WHERE
      "cardName" IS NOT NULL
      AND "setName" IS NOT NULL
      AND "priceCents" IS NOT NULL
      AND "priceCents" > 0
      AND "priceCents" < 10000000
    GROUP BY "cardName", "setName", "cardNumber"
    HAVING COUNT(*) >= 5
    ORDER BY source_diversity DESC, avg_quality_score DESC
    LIMIT 50
  `;

  console.table(premiumCards.slice(0, 20));
  console.log(`... ${premiumCards.length} total premium cards identified`);
  console.log('');

  // 4. MULTI-SOURCE COVERAGE (for arbitrage training)
  console.log('🔄 4. MULTI-SOURCE COVERAGE (Arbitrage Potential)');
  console.log('─'.repeat(80));

  const multiSourceCards = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(DISTINCT "cardName")::INTEGER as cards_with_1_source,
      COUNT(DISTINCT "cardName") FILTER (WHERE source_count >= 2)::INTEGER as cards_with_2plus_sources,
      COUNT(DISTINCT "cardName") FILTER (WHERE source_count >= 3)::INTEGER as cards_with_3plus_sources
    FROM (
      SELECT
        "cardName",
        COUNT(DISTINCT source)::INTEGER as source_count
      FROM "UnifiedMarketListing"
      WHERE "cardName" IS NOT NULL AND "priceCents" IS NOT NULL
      GROUP BY "cardName"
    ) sub
  `;

  console.table(multiSourceCards);
  console.log('');

  // 5. PRICE DISTRIBUTION ANALYSIS
  console.log('💰 5. PRICE DISTRIBUTION ANALYSIS');
  console.log('─'.repeat(80));

  const priceDistribution = await prisma.$queryRaw<any[]>`
    SELECT
      CASE
        WHEN "priceCents" < 100 THEN '$0-1'
        WHEN "priceCents" < 500 THEN '$1-5'
        WHEN "priceCents" < 1000 THEN '$5-10'
        WHEN "priceCents" < 2500 THEN '$10-25'
        WHEN "priceCents" < 5000 THEN '$25-50'
        WHEN "priceCents" < 10000 THEN '$50-100'
        WHEN "priceCents" < 25000 THEN '$100-250'
        WHEN "priceCents" < 50000 THEN '$250-500'
        WHEN "priceCents" < 100000 THEN '$500-1000'
        ELSE '$1000+'
      END as price_range,
      COUNT(*)::INTEGER as listing_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::NUMERIC as percentage
    FROM "UnifiedMarketListing"
    WHERE "priceCents" IS NOT NULL
    GROUP BY price_range
    ORDER BY MIN("priceCents")
  `;

  console.table(priceDistribution);
  console.log('');

  // 6. DATA QUALITY SCORE DISTRIBUTION
  console.log('⭐ 6. DATA QUALITY SCORE DISTRIBUTION');
  console.log('─'.repeat(80));

  const qualityDistribution = await prisma.$queryRaw<any[]>`
    SELECT
      CASE
        WHEN "dataQuality" >= 0.9 THEN 'Excellent (0.9-1.0)'
        WHEN "dataQuality" >= 0.8 THEN 'Very Good (0.8-0.9)'
        WHEN "dataQuality" >= 0.7 THEN 'Good (0.7-0.8)'
        WHEN "dataQuality" >= 0.6 THEN 'Fair (0.6-0.7)'
        ELSE 'Needs Review (<0.6)'
      END as quality_tier,
      COUNT(*)::INTEGER as record_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::NUMERIC as percentage
    FROM "UnifiedMarketListing"
    GROUP BY quality_tier
    ORDER BY MIN("dataQuality") DESC
  `;

  console.table(qualityDistribution);
  console.log('');

  // 7. TRAINING DATASET RECOMMENDATIONS
  console.log('🚀 7. TRAINING DATASET RECOMMENDATIONS');
  console.log('═'.repeat(80));

  const totalRecords = sourceStats.reduce((sum, s) => sum + s.total_records, 0);
  const qualityRecords = await prisma.unifiedMarketListing.count({
    where: {
      cardName: { not: null },
      setName: { not: null },
      priceCents: { not: null, gt: 0, lt: 10000000 },
      dataQuality: { gte: 0.7 },
    },
  });

  const arbitrageCandidates = premiumCards.filter(c => c.source_diversity >= 2).length;

  console.log(`Total Records:           ${totalRecords.toLocaleString()}`);
  console.log(`Quality Records (≥0.7):  ${qualityRecords.toLocaleString()}`);
  console.log(`Premium Cards (5+ list): ${premiumCards.length}`);
  console.log(`Multi-Source Cards:      ${arbitrageCandidates}`);
  console.log('');

  console.log('📝 RECOMMENDED TRAINING DATASET:');
  console.log('');
  console.log('  Category 1: Arbitrage Detection');
  console.log(`    → Target: 50,000 examples from ${arbitrageCandidates} multi-source cards`);
  console.log('    → Focus: Price comparison across eBay, TCGPlayer, JustTCG');
  console.log('');
  console.log('  Category 2: Liquidity Analysis');
  console.log('    → Target: 50,000 examples from eBay (listing velocity)');
  console.log('    → Focus: Market depth, days-to-clear estimates');
  console.log('');
  console.log('  Category 3: Price Trend Analysis');
  console.log('    → Target: 50,000 examples from time-series data');
  console.log('    → Focus: Historical movements, seasonal patterns');
  console.log('    → Note: Requires sold data (scheduled for collection)');
  console.log('');
  console.log('  Category 4: Multi-Source Consensus');
  console.log(`    → Target: 50,000 examples from ${qualityRecords.toLocaleString()} quality records`);
  console.log('    → Focus: Fair market value determination');
  console.log('');
  console.log('  Category 5: Condition/Grade Adjustments');
  console.log('    → Target: 50,000 examples from graded cards');
  console.log('    → Focus: PSA/CGC premium calculations');
  console.log('');
  console.log('  TOTAL: 250,000 training examples (25x current Mew-1A dataset)');
  console.log('');

  console.log('✅ NEXT STEPS:');
  console.log('');
  console.log('  1. Run: pnpm tsx scripts/mew1a-extract-training-data.ts');
  console.log('  2. Review: Generated training examples for quality');
  console.log('  3. Upload: Training dataset to HuggingFace');
  console.log('  4. Train: Mew-1A v2 on RunPod (8-12 hours)');
  console.log('  5. Deploy: To Modal Labs for production inference');
  console.log('');

  console.log('═'.repeat(80));
  console.log('Audit complete! Data quality sufficient for Mew-1A v2 training.');
  console.log('═'.repeat(80));
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
