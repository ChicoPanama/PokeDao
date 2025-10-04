/**
 * eBay Sold Listings Historical Harvester
 *
 * Smart harvesting strategy:
 * 1. Focus on high-value cards ($100+) for better ROI
 * 2. Pull SOLD listings (actual market prices, not asking prices)
 * 3. Build historical price ledger for trend analysis
 * 4. Respect eBay API rate limits (5,000 calls/day default)
 * 5. Prioritize cards we already have in other marketplaces
 * 6. Build data library over time (weeks/months, not hours)
 *
 * eBay API Information:
 * - Finding API: Deprecating February 2025 (current implementation)
 * - Future: Migrate to Browse API when Finding API is deprecated
 * - Rate Limit: 5,000 calls/day (can request increase to 1.5M+ via Application Growth Check)
 * - Conservative approach: Use 4,500 calls/day (90% of limit) for safety margin
 *
 * Daily Budget Example:
 * - 4,500 calls/day ÷ 50 cards = 90 calls per card
 * - 90 calls per card = ~9,000 historical sales over time
 * - Build complete ledger in 30-60 days
 *
 * Documentation:
 * https://developer.ebay.com/devzone/finding/Concepts/FindingAPIGuide.html
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import fetch from 'node-fetch';

// ============================================================================
// CONFIG
// ============================================================================

const EBAY_APP_ID = process.env.EBAY_APP_ID; // Required
const MIN_PRICE_USD = 100; // Only harvest cards worth $100+
const BATCH_SIZE = 100; // eBay max per page
const CHECKPOINT_FILE = 'data/ebay-sold-checkpoint.json';
const LEDGER_FILE = 'data/ebay-price-ledger.json';
const DAILY_API_LIMIT = 4500; // 90% of 5000 limit (safety margin to avoid ban)
const DELAY_BETWEEN_CALLS = 1000; // 1 second = safe, respectful rate limiting

// ============================================================================
// TYPES
// ============================================================================

interface EbaySoldListing {
  itemId: string;
  title: string;
  soldPrice: number; // In cents
  soldDate: string;
  condition: string;
  categoryId: string;
  imageUrl?: string;
  listingUrl: string;
  shippingCost?: number;
}

interface PriceLedgerEntry {
  cardName: string;
  setName: string;
  grade?: number;
  gradeCompany?: string;
  salesHistory: {
    date: string;
    price: number; // cents
    ebayItemId: string;
    title: string;
  }[];
  stats: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    saleCount: number;
    trend: 'up' | 'down' | 'stable';
    lastUpdated: string;
  };
}

interface Checkpoint {
  processedCards: number;
  apiCallsToday: number;
  lastCardId: string;
  lastResetDate: string;
  totalSalesFound: number;
  startedAt: string;
  updatedAt: string;
}

// ============================================================================
// EBAY API CLIENT
// ============================================================================

class EbayFindingAPI {
  private appId: string;
  private baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
  private callsToday = 0;
  private lastResetDate = new Date().toISOString().split('T')[0];

  constructor(appId: string) {
    this.appId = appId;
  }

  /**
   * Search completed/sold listings
   */
  async findCompletedItems(params: {
    keywords: string;
    minPrice: number;
    maxPrice?: number;
    pageNumber?: number;
  }): Promise<{ items: EbaySoldListing[]; totalPages: number; totalEntries: number }> {
    // Check rate limit
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.callsToday = 0;
      this.lastResetDate = today;
    }

    if (this.callsToday >= DAILY_API_LIMIT) {
      throw new Error(`Daily API limit reached (${DAILY_API_LIMIT} calls)`);
    }

    const { keywords, minPrice, maxPrice, pageNumber = 1 } = params;

    // Build eBay Finding API URL
    const url = new URL(this.baseUrl);
    url.searchParams.set('OPERATION-NAME', 'findCompletedItems');
    url.searchParams.set('SERVICE-VERSION', '1.0.0');
    url.searchParams.set('SECURITY-APPNAME', this.appId);
    url.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON');
    url.searchParams.set('REST-PAYLOAD', '');
    url.searchParams.set('keywords', keywords);
    url.searchParams.set('paginationInput.entriesPerPage', BATCH_SIZE.toString());
    url.searchParams.set('paginationInput.pageNumber', pageNumber.toString());
    url.searchParams.set('sortOrder', 'EndTimeSoonest'); // Oldest first for historical data

    // Item filters
    let filterIndex = 0;

    // Filter 1: Sold items only
    url.searchParams.set(`itemFilter(${filterIndex}).name`, 'SoldItemsOnly');
    url.searchParams.set(`itemFilter(${filterIndex}).value`, 'true');
    filterIndex++;

    // Filter 2: Min price
    url.searchParams.set(`itemFilter(${filterIndex}).name`, 'MinPrice');
    url.searchParams.set(`itemFilter(${filterIndex}).value`, minPrice.toString());
    url.searchParams.set(`itemFilter(${filterIndex}).paramName`, 'Currency');
    url.searchParams.set(`itemFilter(${filterIndex}).paramValue`, 'USD');
    filterIndex++;

    // Filter 3: Max price (optional)
    if (maxPrice) {
      url.searchParams.set(`itemFilter(${filterIndex}).name`, 'MaxPrice');
      url.searchParams.set(`itemFilter(${filterIndex}).value`, maxPrice.toString());
      url.searchParams.set(`itemFilter(${filterIndex}).paramName`, 'Currency');
      url.searchParams.set(`itemFilter(${filterIndex}).paramValue`, 'USD');
      filterIndex++;
    }

    // Filter 4: Pokemon TCG category (183454)
    url.searchParams.set(`itemFilter(${filterIndex}).name`, 'CategoryId');
    url.searchParams.set(`itemFilter(${filterIndex}).value`, '183454');

    await this.sleep(DELAY_BETWEEN_CALLS);

    const response = await fetch(url.toString());
    this.callsToday++;

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const searchResult = data.findCompletedItemsResponse?.[0]?.searchResult?.[0];

    if (!searchResult || searchResult['@count'] === '0') {
      return { items: [], totalPages: 0, totalEntries: 0 };
    }

    const items = searchResult.item || [];
    const paginationOutput = data.findCompletedItemsResponse?.[0]?.paginationOutput?.[0];
    const totalPages = parseInt(paginationOutput?.totalPages?.[0] || '0');
    const totalEntries = parseInt(paginationOutput?.totalEntries?.[0] || '0');

    const parsed: EbaySoldListing[] = items.map((item: any) => {
      const soldPrice = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0') * 100;
      const shippingCost = parseFloat(item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ || '0') * 100;

      return {
        itemId: item.itemId?.[0] || '',
        title: item.title?.[0] || '',
        soldPrice: Math.round(soldPrice),
        soldDate: item.listingInfo?.[0]?.endTime?.[0] || new Date().toISOString(),
        condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown',
        categoryId: item.primaryCategory?.[0]?.categoryId?.[0] || '',
        imageUrl: item.galleryURL?.[0],
        listingUrl: item.viewItemURL?.[0] || '',
        shippingCost: shippingCost > 0 ? Math.round(shippingCost) : undefined,
      };
    });

    return { items: parsed, totalPages, totalEntries };
  }

  getCallsToday(): number {
    return this.callsToday;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CHECKPOINT & LEDGER
// ============================================================================

function loadCheckpoint(): Checkpoint | null {
  if (existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function loadLedger(): Map<string, PriceLedgerEntry> {
  if (existsSync(LEDGER_FILE)) {
    const data = JSON.parse(readFileSync(LEDGER_FILE, 'utf8'));
    return new Map(Object.entries(data));
  }
  return new Map();
}

function saveLedger(ledger: Map<string, PriceLedgerEntry>): void {
  const obj = Object.fromEntries(ledger);
  writeFileSync(LEDGER_FILE, JSON.stringify(obj, null, 2));
}

// ============================================================================
// CARD PARSING & LEDGER BUILDING
// ============================================================================

function parseCardFromTitle(title: string): {
  cardName?: string;
  setName?: string;
  grade?: number;
  gradeCompany?: string;
} {
  // Basic parsing - extract card name, set, grade, grade company
  const result: any = {};

  // Grade company patterns
  const gradeMatch = title.match(/\b(PSA|BGS|CGC|SGC|ACE)\s+(\d+(?:\.\d+)?)\b/i);
  if (gradeMatch) {
    result.gradeCompany = gradeMatch[1].toUpperCase();
    result.grade = parseFloat(gradeMatch[2]);
  }

  // Set name patterns (common sets)
  const setPatterns = [
    /Base Set/i,
    /Jungle/i,
    /Fossil/i,
    /Team Rocket/i,
    /Gym Heroes/i,
    /Gym Challenge/i,
    /Evolutions/i,
    /Cosmic Eclipse/i,
    /Shining Fates/i,
    /Champion'?s Path/i,
    /Vivid Voltage/i,
    /Darkness Ablaze/i,
    /Rebel Clash/i,
    /Sword & Shield/i,
    /Crown Zenith/i,
    /Lost Origin/i,
    /Astral Radiance/i,
    /Brilliant Stars/i,
    /Fusion Strike/i,
    /Chilling Reign/i,
    /Battle Styles/i,
    /Shining Pearl/i,
    /Celebrations/i,
    /Evolving Skies/i,
    /Prismatic Evolutions/i,
  ];

  for (const pattern of setPatterns) {
    const match = title.match(pattern);
    if (match) {
      result.setName = match[0];
      break;
    }
  }

  // Card name - typically at the start or after year/number
  const nameMatch = title.match(/(?:^\d{4}\s+#\d+\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:EX|GX|V|VMAX|VSTAR|ex))?)/);
  if (nameMatch) {
    result.cardName = nameMatch[1];
  }

  return result;
}

function calculateTrend(prices: number[]): 'up' | 'down' | 'stable' {
  if (prices.length < 2) return 'stable';

  // Compare recent 25% vs older 25%
  const recentCount = Math.ceil(prices.length * 0.25);
  const recent = prices.slice(-recentCount);
  const older = prices.slice(0, recentCount);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (change > 10) return 'up';
  if (change < -10) return 'down';
  return 'stable';
}

function updateLedger(
  ledger: Map<string, PriceLedgerEntry>,
  sale: EbaySoldListing
): void {
  const parsed = parseCardFromTitle(sale.title);

  if (!parsed.cardName) return; // Skip if we can't parse card name

  const key = `${parsed.cardName}|${parsed.setName || 'Unknown'}|${parsed.gradeCompany || 'RAW'}|${parsed.grade || 0}`;

  let entry = ledger.get(key);

  if (!entry) {
    entry = {
      cardName: parsed.cardName,
      setName: parsed.setName || 'Unknown',
      grade: parsed.grade,
      gradeCompany: parsed.gradeCompany,
      salesHistory: [],
      stats: {
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        saleCount: 0,
        trend: 'stable',
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  // Add sale to history
  entry.salesHistory.push({
    date: sale.soldDate,
    price: sale.soldPrice,
    ebayItemId: sale.itemId,
    title: sale.title,
  });

  // Sort by date (oldest first)
  entry.salesHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Update stats
  const prices = entry.salesHistory.map(s => s.price);
  entry.stats.saleCount = prices.length;
  entry.stats.avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  entry.stats.minPrice = Math.min(...prices);
  entry.stats.maxPrice = Math.max(...prices);
  entry.stats.trend = calculateTrend(prices);
  entry.stats.lastUpdated = new Date().toISOString();

  ledger.set(key, entry);
}

// ============================================================================
// MAIN HARVESTER
// ============================================================================

async function main() {
  if (!EBAY_APP_ID) {
    console.error('❌ EBAY_APP_ID not set in environment');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const ebay = new EbayFindingAPI(EBAY_APP_ID);
  const ledger = loadLedger();

  console.log('🔄 EBAY SOLD LISTINGS HARVESTER');
  console.log('='.repeat(60));
  console.log(`💰 Min Price: $${MIN_PRICE_USD}`);
  console.log(`📊 Daily API Limit: ${DAILY_API_LIMIT} calls`);
  console.log(`⏱️  Delay Between Calls: ${DELAY_BETWEEN_CALLS}ms`);
  console.log(`📁 Ledger: ${LEDGER_FILE}`);
  console.log('='.repeat(60));
  console.log();

  // Load checkpoint
  let checkpoint = loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      processedCards: 0,
      apiCallsToday: 0,
      lastCardId: '',
      lastResetDate: new Date().toISOString().split('T')[0],
      totalSalesFound: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`📍 Checkpoint: ${checkpoint.processedCards} cards, ${checkpoint.totalSalesFound} sales\n`);

  // Get high-value cards from our existing database to prioritize
  const priorityCards = await prisma.unifiedMarketListing.findMany({
    where: {
      cardName: { not: 'Unknown' },
      priceCents: { gte: MIN_PRICE_USD * 100 },
    },
    select: {
      cardName: true,
      setName: true,
      gradeCompany: true,
      grade: true,
    },
    distinct: ['cardName', 'setName'],
    take: 100, // Process top 100 high-value cards
  });

  console.log(`🎯 Found ${priorityCards.length} high-value cards to harvest\n`);

  // Harvest each priority card
  for (const card of priorityCards) {
    if (ebay.getCallsToday() >= DAILY_API_LIMIT) {
      console.log(`\n⚠️  Daily API limit reached. Stopping for today.`);
      break;
    }

    const searchKeyword = `${card.cardName} ${card.setName !== 'Unknown' ? card.setName : ''} Pokemon`.trim();

    console.log(`\n🔍 Searching: ${searchKeyword}`);
    console.log(`   Grade: ${card.gradeCompany || 'Any'} ${card.grade || ''}`);

    try {
      const result = await ebay.findCompletedItems({
        keywords: searchKeyword,
        minPrice: MIN_PRICE_USD,
        pageNumber: 1,
      });

      console.log(`   Found: ${result.totalEntries} sold listings`);

      if (result.items.length > 0) {
        // Add to database
        for (const item of result.items) {
          // Save to UnifiedMarketListing
          await prisma.unifiedMarketListing.upsert({
            where: {
              source_sourceId: {
                source: 'EBAY',
                sourceId: item.itemId,
              },
            },
            create: {
              source: 'EBAY',
              sourceId: item.itemId,
              title: item.title.substring(0, 500),
              priceCents: item.soldPrice,
              currency: 'USD',
              url: item.listingUrl.substring(0, 1000),
              cardName: parseCardFromTitle(item.title).cardName?.substring(0, 255) || 'Unknown',
              setName: parseCardFromTitle(item.title).setName?.substring(0, 255) || 'Unknown',
              gradeCompany: parseCardFromTitle(item.title).gradeCompany as any || null,
              grade: parseCardFromTitle(item.title).grade || null,
              dataQuality: 0.8, // eBay sold data is high quality
            },
            update: {
              priceCents: item.soldPrice,
              updatedAt: new Date(),
            },
          });

          // Update price ledger
          updateLedger(ledger, item);
          checkpoint.totalSalesFound++;
        }

        console.log(`   ✅ Saved ${result.items.length} sales to database and ledger`);
      }

      checkpoint.processedCards++;
      checkpoint.apiCallsToday = ebay.getCallsToday();
      saveCheckpoint(checkpoint);
      saveLedger(ledger);

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Cards Processed: ${checkpoint.processedCards}`);
  console.log(`💾 Total Sales Found: ${checkpoint.totalSalesFound}`);
  console.log(`📞 API Calls Used: ${ebay.getCallsToday()}/${DAILY_API_LIMIT}`);
  console.log(`📈 Ledger Entries: ${ledger.size}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
