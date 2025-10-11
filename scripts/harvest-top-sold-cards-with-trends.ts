/**
 * Harvest Top 3,000 Most Expensive Sold Pokemon Cards with Price Trends
 *
 * Collects sold listing data from eBay and calculates 1-month, 6-month, and 12-month price trends
 *
 * Run: pnpm tsx scripts/harvest-top-sold-cards-with-trends.ts
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

const EBAY_APP_ID = process.env.EBAY_APP_ID!;
const CATEGORY_ID = '183454'; // Pokemon TCG Singles
const TARGET_CARDS = 3000;

interface EbaySoldItem {
  itemId: string[];
  title: string[];
  sellingStatus: Array<{
    currentPrice: Array<{
      _: string;
      $: { currencyId: string };
    }>;
    sellingState: string[];
  }>;
  listingInfo: Array<{
    endTime: string[];
  }>;
  condition?: Array<{
    conditionDisplayName: string[];
  }>;
}

interface CardPriceTrend {
  cardName: string;
  currentPrice: number;
  trend1Month: number; // % change
  trend6Month: number; // % change
  trend12Month: number; // % change
  soldCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findCompletedItems(query: string, page: number = 1): Promise<EbaySoldItem[]> {
  const entriesPerPage = 100;
  const url = 'https://svcs.ebay.com/services/search/FindingService/v1';

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'XML',
    'REST-PAYLOAD': '',
    'keywords': query,
    'categoryId': CATEGORY_ID,
    'paginationInput.entriesPerPage': entriesPerPage.toString(),
    'paginationInput.pageNumber': page.toString(),
    'sortOrder': 'PricePlusShippingHighest', // Highest price first
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'MinPrice',
    'itemFilter(1).value': '50', // Only cards $50+
  });

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay Finding API error: ${response.status} - ${text}`);
  }

  const xml = await response.text();
  const result = await parseStringPromise(xml);

  const searchResult = result?.findCompletedItemsResponse?.searchResult?.[0];
  const items = searchResult?.item || [];

  return items as EbaySoldItem[];
}

async function extractCardName(title: string): Promise<string> {
  // Extract Pokemon card name from title
  // Remove common patterns like PSA 10, 1st Edition, Holo, etc.
  let name = title
    .replace(/PSA\s+\d+/gi, '')
    .replace(/BGS\s+\d+/gi, '')
    .replace(/CGC\s+\d+/gi, '')
    .replace(/1st\s+Edition/gi, '')
    .replace(/Shadowless/gi, '')
    .replace(/\bHolo\b/gi, '')
    .replace(/\bReverse\s+Holo\b/gi, '')
    .replace(/\d+\/\d+/g, '') // Remove card numbers
    .replace(/\s+/g, ' ')
    .trim();

  // Take first 3-4 words as card name
  const words = name.split(' ');
  return words.slice(0, Math.min(4, words.length)).join(' ');
}

async function calculateTrends(cardName: string): Promise<Partial<CardPriceTrend>> {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Query sold items from CompSale table
  const recentSales = await prisma.compSale.findMany({
    where: {
      card: {
        name: {
          contains: cardName,
          mode: 'insensitive',
        },
      },
      soldAt: {
        gte: twelveMonthsAgo,
      },
    },
    orderBy: {
      soldAt: 'desc',
    },
  });

  if (recentSales.length === 0) {
    return {
      trend1Month: 0,
      trend6Month: 0,
      trend12Month: 0,
    };
  }

  const sales1Month = recentSales.filter(s => s.soldAt >= oneMonthAgo);
  const sales6Month = recentSales.filter(s => s.soldAt >= sixMonthsAgo && s.soldAt < oneMonthAgo);
  const sales12Month = recentSales.filter(s => s.soldAt >= twelveMonthsAgo && s.soldAt < sixMonthsAgo);

  const avg1Month = sales1Month.length > 0
    ? sales1Month.reduce((sum, s) => sum + (s.priceCents || 0), 0) / sales1Month.length / 100
    : 0;

  const avg6Month = sales6Month.length > 0
    ? sales6Month.reduce((sum, s) => sum + (s.priceCents || 0), 0) / sales6Month.length / 100
    : 0;

  const avg12Month = sales12Month.length > 0
    ? sales12Month.reduce((sum, s) => sum + (s.priceCents || 0), 0) / sales12Month.length / 100
    : 0;

  const trend1Month = avg6Month > 0 ? ((avg1Month - avg6Month) / avg6Month) * 100 : 0;
  const trend6Month = avg12Month > 0 ? ((avg6Month - avg12Month) / avg12Month) * 100 : 0;
  const trend12Month = avg12Month > 0 ? ((avg1Month - avg12Month) / avg12Month) * 100 : 0;

  return {
    trend1Month: Math.round(trend1Month * 10) / 10,
    trend6Month: Math.round(trend6Month * 10) / 10,
    trend12Month: Math.round(trend12Month * 10) / 10,
    soldCount: recentSales.length,
    avgPrice: Math.round(avg1Month * 100) / 100,
  };
}

async function harvestTopSoldCards() {
  console.log('🚀 TOP 3,000 SOLD POKEMON CARDS WITH PRICE TRENDS');
  console.log('='.repeat(80));
  console.log(`🎯 Target: ${TARGET_CARDS.toLocaleString()} cards`);
  console.log(`💰 Minimum price: $50`);
  console.log('='.repeat(80));
  console.log('');

  if (!EBAY_APP_ID) {
    console.error('❌ EBAY_APP_ID not found in .env');
    process.exit(1);
  }

  const cardPrices = new Map<string, number[]>(); // cardName -> prices
  const cardDetails = new Map<string, any>(); // cardName -> details
  let totalProcessed = 0;
  let page = 1;

  const queries = [
    'pokemon card psa 10',
    'pokemon card graded',
    'pokemon card 1st edition',
    'pokemon card shadowless',
    'pokemon card charizard',
    'pokemon card lugia',
    'pokemon card umbreon',
    'pokemon card shining',
  ];

  for (const query of queries) {
    console.log(`\n🔍 Searching: "${query}"`);
    page = 1;

    while (totalProcessed < TARGET_CARDS) {
      try {
        const items = await findCompletedItems(query, page);

        if (items.length === 0) {
          console.log(`  ℹ️  No more results for "${query}"`);
          break;
        }

        console.log(`  📄 Page ${page}: Found ${items.length} sold items`);

        for (const item of items) {
          const title = item.title?.[0] || '';
          const priceStr = item.sellingStatus?.[0]?.currentPrice?.[0]?._ || '0';
          const price = parseFloat(priceStr);
          const currency = item.sellingStatus?.[0]?.currentPrice?.[0]?.$?.currencyId || 'USD';
          const soldAt = item.listingInfo?.[0]?.endTime?.[0] || '';
          const condition = item.condition?.[0]?.conditionDisplayName?.[0] || '';

          if (price < 50) continue; // Skip cards under $50

          const cardName = await extractCardName(title);

          if (!cardPrices.has(cardName)) {
            cardPrices.set(cardName, []);
            cardDetails.set(cardName, { title, currency, condition, soldAt });
          }

          cardPrices.get(cardName)!.push(price);

          // Save to database
          try {
            await prisma.compSale.create({
              data: {
                id: `ebay-${item.itemId?.[0]}-${Date.now()}`,
                source: 'EBAY',
                priceCents: Math.round(price * 100),
                currency,
                soldAt: new Date(soldAt),
                condition,
                isVerified: true,
              },
            });
          } catch (err) {
            // Ignore duplicates
          }

          totalProcessed++;
          if (totalProcessed >= TARGET_CARDS) break;
        }

        console.log(`  ✅ Processed ${totalProcessed}/${TARGET_CARDS} cards`);

        page++;
        await sleep(1500); // Rate limiting

        if (totalProcessed >= TARGET_CARDS) break;
      } catch (error: any) {
        console.error(`  ❌ Error on page ${page}: ${error.message}`);
        break;
      }
    }

    if (totalProcessed >= TARGET_CARDS) break;
  }

  // Calculate trends and create final report
  console.log('\n\n📊 CALCULATING PRICE TRENDS...\n');

  const trends: CardPriceTrend[] = [];

  for (const [cardName, prices] of cardPrices.entries()) {
    const details = cardDetails.get(cardName);
    const trendData = await calculateTrends(cardName);

    trends.push({
      cardName,
      currentPrice: Math.max(...prices),
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      soldCount: prices.length,
      trend1Month: trendData.trend1Month || 0,
      trend6Month: trendData.trend6Month || 0,
      trend12Month: trendData.trend12Month || 0,
    });
  }

  // Sort by max price descending
  trends.sort((a, b) => b.maxPrice - a.maxPrice);

  // Print top 50 as preview
  console.log('\n📈 TOP 50 MOST EXPENSIVE SOLD CARDS:\n');
  console.log('Rank | Card Name                          | Max Price | Avg Price | 1Mo | 6Mo | 12Mo | Sales');
  console.log('-'.repeat(110));

  trends.slice(0, 50).forEach((trend, i) => {
    const rank = (i + 1).toString().padStart(4);
    const name = trend.cardName.padEnd(34).substring(0, 34);
    const maxPrice = `$${trend.maxPrice.toLocaleString()}`.padStart(10);
    const avgPrice = `$${Math.round(trend.avgPrice).toLocaleString()}`.padStart(10);
    const t1m = `${trend.trend1Month > 0 ? '+' : ''}${trend.trend1Month}%`.padStart(6);
    const t6m = `${trend.trend6Month > 0 ? '+' : ''}${trend.trend6Month}%`.padStart(6);
    const t12m = `${trend.trend12Month > 0 ? '+' : ''}${trend.trend12Month}%`.padStart(6);
    const sales = trend.soldCount.toString().padStart(6);

    console.log(`${rank} | ${name} | ${maxPrice} | ${avgPrice} | ${t1m} | ${t6m} | ${t12m} | ${sales}`);
  });

  // Export to JSON
  const outputPath = 'data/top-3000-sold-cards-with-trends.json';
  const fs = await import('fs/promises');
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(trends, null, 2));

  console.log('\n\n='.repeat(80));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(80));
  console.log(`📊 Total cards processed: ${totalProcessed.toLocaleString()}`);
  console.log(`💾 Unique cards with trends: ${trends.length.toLocaleString()}`);
  console.log(`📁 Data exported to: ${outputPath}`);
  console.log('='.repeat(80));
}

harvestTopSoldCards().catch(error => {
  console.error('❌ Harvest failed:', error);
  process.exit(1);
});
