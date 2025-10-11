/**
 * Generate Top Pokemon Cards Report from Current Data
 *
 * Creates a comprehensive report of the most expensive cards with available market data
 *
 * Run: pnpm tsx scripts/generate-top-cards-report.ts
 */

import prisma from '../api/src/lib/prisma.js';
import { writeFile, mkdir } from 'fs/promises';

interface CardReport {
  rank: number;
  cardName: string;
  setName: string;
  maxPriceCents: number;
  avgPriceCents: number;
  minPriceCents: number;
  listingCount: number;
  maxPriceUSD: string;
  avgPriceUSD: string;
  minPriceUSD: string;
  priceRange: string;
  // Placeholder for trend data (to be filled when sold data available)
  trend1Month?: number;
  trend6Month?: number;
  trend12Month?: number;
  soldCount?: number;
}

async function generateReport() {
  console.log('📊 GENERATING TOP POKEMON CARDS REPORT');
  console.log('='.repeat(80));
  console.log('');

  // Query top 3000 cards by price
  const topCards = await prisma.$queryRaw<any[]>`
    SELECT
      "cardName",
      "setName",
      MAX("priceCents") as max_price_cents,
      AVG("priceCents")::INTEGER as avg_price_cents,
      MIN("priceCents") as min_price_cents,
      COUNT(*) as listing_count
    FROM "UnifiedMarketListing"
    WHERE "priceCents" IS NOT NULL
    GROUP BY "cardName", "setName"
    ORDER BY max_price_cents DESC
    LIMIT 3000
  `;

  console.log(`✅ Loaded ${topCards.length.toLocaleString()} unique cards from database\n`);

  // Transform to report format
  const report: CardReport[] = topCards.map((card, index) => {
    const maxPrice = Number(card.max_price_cents);
    const avgPrice = Number(card.avg_price_cents);
    const minPrice = Number(card.min_price_cents);

    return {
      rank: index + 1,
      cardName: card.cardName || 'Unknown',
      setName: card.setName || 'Unknown Set',
      maxPriceCents: maxPrice,
      avgPriceCents: avgPrice,
      minPriceCents: minPrice,
      listingCount: Number(card.listing_count),
      maxPriceUSD: `$${(maxPrice / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      avgPriceUSD: `$${(avgPrice / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      minPriceUSD: `$${(minPrice / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      priceRange: `$${(minPrice / 100).toFixed(2)} - $${(maxPrice / 100).toFixed(2)}`,
      // Trend placeholders - will be calculated once sold data is available
      trend1Month: 0,
      trend6Month: 0,
      trend12Month: 0,
      soldCount: 0,
    };
  });

  // Print top 100 to console
  console.log('📈 TOP 100 MOST EXPENSIVE POKEMON CARDS:\n');
  console.log('Rank | Card Name                              | Set                     | Max Price  | Avg Price  | Listings');
  console.log('-'.repeat(130));

  report.slice(0, 100).forEach(card => {
    const rank = card.rank.toString().padStart(4);
    const name = card.cardName.padEnd(38).substring(0, 38);
    const set = card.setName.padEnd(23).substring(0, 23);
    const maxPrice = card.maxPriceUSD.padStart(11);
    const avgPrice = card.avgPriceUSD.padStart(11);
    const listings = card.listingCount.toString().padStart(8);

    console.log(`${rank} | ${name} | ${set} | ${maxPrice} | ${avgPrice} | ${listings}`);
  });

  console.log('');
  console.log('='.repeat(80));

  // Statistics
  const totalCards = report.length;
  const totalListings = report.reduce((sum, card) => sum + card.listingCount, 0);
  const highestPrice = report[0];
  const avgOfAllCards = report.reduce((sum, card) => sum + card.avgPriceCents, 0) / totalCards / 100;

  console.log('\n📊 STATISTICS:\n');
  console.log(`Total Unique Cards: ${totalCards.toLocaleString()}`);
  console.log(`Total Market Listings: ${totalListings.toLocaleString()}`);
  console.log(`Highest Priced Card: ${highestPrice.cardName} - ${highestPrice.maxPriceUSD}`);
  console.log(`Average Price (All Cards): $${avgOfAllCards.toFixed(2)}`);
  console.log('');

  // Price tier breakdown
  const tiers = {
    'Under $1': report.filter(c => c.maxPriceCents < 100).length,
    '$1 - $10': report.filter(c => c.maxPriceCents >= 100 && c.maxPriceCents < 1000).length,
    '$10 - $50': report.filter(c => c.maxPriceCents >= 1000 && c.maxPriceCents < 5000).length,
    '$50 - $100': report.filter(c => c.maxPriceCents >= 5000 && c.maxPriceCents < 10000).length,
    '$100 - $500': report.filter(c => c.maxPriceCents >= 10000 && c.maxPriceCents < 50000).length,
    '$500 - $1,000': report.filter(c => c.maxPriceCents >= 50000 && c.maxPriceCents < 100000).length,
    '$1,000 - $5,000': report.filter(c => c.maxPriceCents >= 100000 && c.maxPriceCents < 500000).length,
    '$5,000+': report.filter(c => c.maxPriceCents >= 500000).length,
  };

  console.log('💰 PRICE TIER BREAKDOWN:\n');
  Object.entries(tiers).forEach(([tier, count]) => {
    const bar = '█'.repeat(Math.ceil(count / 10));
    console.log(`${tier.padEnd(15)} | ${count.toString().padStart(5)} cards | ${bar}`);
  });

  console.log('\n\n📝 NOTE ON PRICE TRENDS:\n');
  console.log('Price trend data (1-month, 6-month, 12-month) requires historical sold transaction data.');
  console.log('Currently showing active market listings only. To add trends:');
  console.log('1. Collect sold listing data from eBay Finding API (currently rate limited)');
  console.log('2. Or integrate TCGPlayer/PriceCharting historical data');
  console.log('3. Run trend calculation script once sold data is available');

  // Export to JSON
  await mkdir('data', { recursive: true });
  const jsonPath = 'data/top-3000-cards-market-report.json';
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  // Export to CSV
  const csvPath = 'data/top-3000-cards-market-report.csv';
  const csvHeader = 'Rank,Card Name,Set,Max Price (USD),Avg Price (USD),Min Price (USD),Listings,1Mo Trend %,6Mo Trend %,12Mo Trend %,Sold Count\n';
  const csvRows = report.map(card =>
    `${card.rank},"${card.cardName}","${card.setName}",${card.maxPriceCents / 100},${card.avgPriceCents / 100},${card.minPriceCents / 100},${card.listingCount},${card.trend1Month},${card.trend6Month},${card.trend12Month},${card.soldCount}`
  ).join('\n');
  await writeFile(csvPath, csvHeader + csvRows);

  console.log('\n\n='.repeat(80));
  console.log('✅ REPORT GENERATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`📁 JSON Report: ${jsonPath}`);
  console.log(`📁 CSV Report: ${csvPath}`);
  console.log('='.repeat(80));
}

generateReport().catch(error => {
  console.error('❌ Report generation failed:', error);
  process.exit(1);
});
