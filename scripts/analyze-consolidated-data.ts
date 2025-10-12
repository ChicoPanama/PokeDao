#!/usr/bin/env tsx

/**
 * Consolidated Data Analysis Script
 *
 * Analyzes 239,785 consolidated records to extract insights:
 * 1. Top 100 most expensive cards
 * 2. Biggest arbitrage opportunities (right now!)
 * 3. Price volatility by set and card
 * 4. Liquidity analysis
 * 5. Market trends
 *
 * Usage: pnpm tsx scripts/analyze-consolidated-data.ts
 */

import prisma from '../api/src/lib/prisma.js';
import fs from 'fs';
import path from 'path';

interface ExpensiveCard {
  cardName: string;
  setName: string;
  maxPrice: number;
  avgPrice: number;
  minPrice: number;
  listingCount: number;
  sources: string[];
}

interface ArbitrageOpportunity {
  cardName: string;
  setName: string;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  profitPotential: number;
  profitPercentage: number;
  listingCount: number;
  sources: string[];
  liquidityGrade: string;
}

interface VolatilityData {
  cardName: string;
  setName: string;
  avgPrice: number;
  stdDev: number;
  coefficient: number;
  priceRange: number;
  listingCount: number;
}

function getLiquidityGrade(listingCount: number): string {
  if (listingCount >= 100) return 'A';
  if (listingCount >= 50) return 'B';
  if (listingCount >= 20) return 'C';
  if (listingCount >= 10) return 'D';
  return 'F';
}

async function getTop100MostExpensive(): Promise<ExpensiveCard[]> {
  console.log('\n💎 Analyzing Top 100 Most Expensive Cards...');
  console.log('─'.repeat(80));

  const results = await prisma.$queryRaw<any[]>`
    SELECT
      "cardName",
      "setName",
      MAX("priceCents") as max_price,
      AVG("priceCents")::INTEGER as avg_price,
      MIN("priceCents") as min_price,
      COUNT(*)::INTEGER as listing_count,
      array_agg(DISTINCT source) as sources
    FROM "UnifiedMarketListing"
    WHERE
      "cardName" IS NOT NULL
      AND "setName" IS NOT NULL
      AND "priceCents" IS NOT NULL
      AND "priceCents" > 0
    GROUP BY "cardName", "setName"
    ORDER BY max_price DESC
    LIMIT 100
  `;

  return results.map((r) => ({
    cardName: r.cardName,
    setName: r.setName,
    maxPrice: Number(r.max_price) / 100,
    avgPrice: Number(r.avg_price) / 100,
    minPrice: Number(r.min_price) / 100,
    listingCount: Number(r.listing_count),
    sources: r.sources,
  }));
}

async function findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
  console.log('\n💰 Finding Arbitrage Opportunities...');
  console.log('─'.repeat(80));

  // Find cards with significant price spread across listings
  const results = await prisma.$queryRaw<any[]>`
    SELECT
      "cardName",
      "setName",
      MIN("priceCents") as lowest_price,
      MAX("priceCents") as highest_price,
      AVG("priceCents")::INTEGER as average_price,
      COUNT(*)::INTEGER as listing_count,
      array_agg(DISTINCT source) as sources
    FROM "UnifiedMarketListing"
    WHERE
      "cardName" IS NOT NULL
      AND "setName" IS NOT NULL
      AND "priceCents" IS NOT NULL
      AND "priceCents" > 100
      AND "priceCents" < 10000000
    GROUP BY "cardName", "setName"
    HAVING
      COUNT(*) >= 3
      AND MAX("priceCents") > MIN("priceCents") * 1.15
    ORDER BY (MAX("priceCents") - MIN("priceCents")) DESC
    LIMIT 100
  `;

  return results.map((r) => {
    const lowest = Number(r.lowest_price) / 100;
    const highest = Number(r.highest_price) / 100;
    const average = Number(r.average_price) / 100;
    const profit = highest - lowest;
    const profitPct = ((highest - lowest) / lowest) * 100;
    const listingCount = Number(r.listing_count);

    return {
      cardName: r.cardName,
      setName: r.setName,
      lowestPrice: lowest,
      highestPrice: highest,
      averagePrice: average,
      profitPotential: profit,
      profitPercentage: profitPct,
      listingCount,
      sources: r.sources,
      liquidityGrade: getLiquidityGrade(listingCount),
    };
  });
}

async function analyzeVolatility(): Promise<VolatilityData[]> {
  console.log('\n📊 Analyzing Price Volatility...');
  console.log('─'.repeat(80));

  const results = await prisma.$queryRaw<any[]>`
    SELECT
      "cardName",
      "setName",
      AVG("priceCents")::INTEGER as avg_price,
      STDDEV("priceCents")::INTEGER as std_dev,
      (MAX("priceCents") - MIN("priceCents")) as price_range,
      COUNT(*)::INTEGER as listing_count
    FROM "UnifiedMarketListing"
    WHERE
      "cardName" IS NOT NULL
      AND "setName" IS NOT NULL
      AND "priceCents" IS NOT NULL
      AND "priceCents" > 0
    GROUP BY "cardName", "setName"
    HAVING COUNT(*) >= 5
    ORDER BY STDDEV("priceCents") DESC
    LIMIT 100
  `;

  return results.map((r) => {
    const avgPrice = Number(r.avg_price) / 100;
    const stdDev = Number(r.std_dev) / 100;
    const coefficient = avgPrice > 0 ? (stdDev / avgPrice) * 100 : 0;

    return {
      cardName: r.cardName,
      setName: r.setName,
      avgPrice,
      stdDev,
      coefficient,
      priceRange: Number(r.price_range) / 100,
      listingCount: Number(r.listing_count),
    };
  });
}

async function getMarketOverview() {
  console.log('\n📈 Market Overview...');
  console.log('─'.repeat(80));

  const overview = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*)::INTEGER as total_listings,
      COUNT(DISTINCT "cardName")::INTEGER as unique_cards,
      COUNT(DISTINCT "setName")::INTEGER as unique_sets,
      AVG("priceCents")::INTEGER as avg_price,
      MIN("priceCents") as min_price,
      MAX("priceCents") as max_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "priceCents")::INTEGER as median_price
    FROM "UnifiedMarketListing"
    WHERE "priceCents" IS NOT NULL AND "priceCents" > 0
  `;

  const bySource = await prisma.$queryRaw<any[]>`
    SELECT
      source,
      COUNT(*)::INTEGER as count,
      COUNT(DISTINCT "cardName")::INTEGER as unique_cards,
      AVG("priceCents")::INTEGER as avg_price
    FROM "UnifiedMarketListing"
    WHERE "priceCents" IS NOT NULL AND "priceCents" > 0
    GROUP BY source
    ORDER BY count DESC
  `;

  const priceRanges = await prisma.$queryRaw<any[]>`
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
      COUNT(*)::INTEGER as count
    FROM "UnifiedMarketListing"
    WHERE "priceCents" IS NOT NULL
    GROUP BY price_range
    ORDER BY MIN("priceCents")
  `;

  return { overview: overview[0], bySource, priceRanges };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('CONSOLIDATED DATA ANALYSIS');
  console.log('═'.repeat(80));
  console.log('\n📦 Database: 239,785 consolidated records');
  console.log('📊 Analysis: Top 100 Expensive, Arbitrage, Volatility');
  console.log('═'.repeat(80));

  // Market Overview
  const { overview, bySource, priceRanges } = await getMarketOverview();

  console.log(`\nTotal Listings: ${Number(overview.total_listings).toLocaleString()}`);
  console.log(`Unique Cards: ${Number(overview.unique_cards).toLocaleString()}`);
  console.log(`Unique Sets: ${Number(overview.unique_sets).toLocaleString()}`);
  console.log(`Average Price: $${(Number(overview.avg_price) / 100).toFixed(2)}`);
  console.log(`Median Price: $${(Number(overview.median_price) / 100).toFixed(2)}`);
  console.log(`Price Range: $${(Number(overview.min_price) / 100).toFixed(2)} - $${(Number(overview.max_price) / 100).toFixed(2)}`);

  console.log('\n📊 By Source:');
  console.table(
    bySource.map((s) => ({
      Source: s.source,
      Listings: Number(s.count).toLocaleString(),
      'Unique Cards': Number(s.unique_cards).toLocaleString(),
      'Avg Price': `$${(Number(s.avg_price) / 100).toFixed(2)}`,
    }))
  );

  console.log('\n💵 Price Distribution:');
  console.table(
    priceRanges.map((p) => ({
      Range: p.price_range,
      Count: Number(p.count).toLocaleString(),
    }))
  );

  // Top 100 Most Expensive
  const expensiveCards = await getTop100MostExpensive();

  console.log('\n✅ Top 20 Most Expensive Cards:');
  console.table(
    expensiveCards.slice(0, 20).map((c, i) => ({
      Rank: i + 1,
      Card: `${c.cardName} - ${c.setName}`.substring(0, 50),
      'Max Price': `$${c.maxPrice.toFixed(2)}`,
      'Avg Price': `$${c.avgPrice.toFixed(2)}`,
      'Min Price': `$${c.minPrice.toFixed(2)}`,
      Listings: c.listingCount,
      Sources: c.sources.length,
    }))
  );

  // Arbitrage Opportunities
  const arbitrage = await findArbitrageOpportunities();

  console.log('\n✅ Top 20 Arbitrage Opportunities (Buy Low, Sell High):');
  console.table(
    arbitrage.slice(0, 20).map((a, i) => ({
      Rank: i + 1,
      Card: `${a.cardName} - ${a.setName}`.substring(0, 40),
      'Buy At': `$${a.lowestPrice.toFixed(2)}`,
      'Sell At': `$${a.highestPrice.toFixed(2)}`,
      Profit: `$${a.profitPotential.toFixed(2)}`,
      'Profit %': `${a.profitPercentage.toFixed(1)}%`,
      Liquidity: a.liquidityGrade,
      Listings: a.listingCount,
    }))
  );

  // Volatility Analysis
  const volatility = await analyzeVolatility();

  console.log('\n✅ Top 20 Most Volatile Cards (High Price Variance):');
  console.table(
    volatility.slice(0, 20).map((v, i) => ({
      Rank: i + 1,
      Card: `${v.cardName} - ${v.setName}`.substring(0, 40),
      'Avg Price': `$${v.avgPrice.toFixed(2)}`,
      'Std Dev': `$${v.stdDev.toFixed(2)}`,
      'CV %': `${v.coefficient.toFixed(1)}%`,
      Range: `$${v.priceRange.toFixed(2)}`,
      Listings: v.listingCount,
    }))
  );

  // Save detailed results
  const outputDir = path.join(process.cwd(), 'data', 'analysis');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];

  fs.writeFileSync(
    path.join(outputDir, `top-100-expensive-${timestamp}.json`),
    JSON.stringify(expensiveCards, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, `arbitrage-opportunities-${timestamp}.json`),
    JSON.stringify(arbitrage, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, `volatility-analysis-${timestamp}.json`),
    JSON.stringify(volatility, null, 2)
  );

  console.log('\n═'.repeat(80));
  console.log('💾 RESULTS SAVED');
  console.log('═'.repeat(80));
  console.log(`\n📁 Output directory: ${outputDir}`);
  console.log(`   • top-100-expensive-${timestamp}.json`);
  console.log(`   • arbitrage-opportunities-${timestamp}.json`);
  console.log(`   • volatility-analysis-${timestamp}.json`);

  console.log('\n🎯 KEY INSIGHTS:');
  console.log(`\n1. MOST EXPENSIVE CARD:`);
  console.log(`   ${expensiveCards[0].cardName} - ${expensiveCards[0].setName}`);
  console.log(`   Max: $${expensiveCards[0].maxPrice.toFixed(2)}, Avg: $${expensiveCards[0].avgPrice.toFixed(2)}`);

  console.log(`\n2. BEST ARBITRAGE OPPORTUNITY:`);
  console.log(`   ${arbitrage[0].cardName} - ${arbitrage[0].setName}`);
  console.log(`   Buy at $${arbitrage[0].lowestPrice.toFixed(2)}, Sell at $${arbitrage[0].highestPrice.toFixed(2)}`);
  console.log(`   Profit: $${arbitrage[0].profitPotential.toFixed(2)} (${arbitrage[0].profitPercentage.toFixed(1)}%)`);
  console.log(`   Liquidity: ${arbitrage[0].liquidityGrade} (${arbitrage[0].listingCount} listings)`);

  console.log(`\n3. MOST VOLATILE CARD:`);
  console.log(`   ${volatility[0].cardName} - ${volatility[0].setName}`);
  console.log(`   Avg: $${volatility[0].avgPrice.toFixed(2)}, Std Dev: $${volatility[0].stdDev.toFixed(2)}`);
  console.log(`   Coefficient of Variation: ${volatility[0].coefficient.toFixed(1)}%`);

  console.log('\n═'.repeat(80));
  console.log('✅ Analysis complete!');
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
