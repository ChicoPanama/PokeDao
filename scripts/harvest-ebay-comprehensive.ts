/**
 * eBay Comprehensive Price Data Harvester
 *
 * This harvester collects BOTH:
 * 1. Historical SOLD listings → CompSale table (actual market prices)
 * 2. Current ACTIVE listings → UnifiedMarketListing table (arbitrage opportunities)
 *
 * Strategy:
 * - Focus on high-value cards ($100+)
 * - Build complete price dataset for AI analysis
 * - Respect 4,500 API calls/day limit (2,250 for sold + 2,250 for active)
 * - Smart checkpoint/resume for fault tolerance
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const prisma = new PrismaClient();

// ============================================================================
// CONFIG
// ============================================================================

const EBAY_APP_ID = process.env.EBAY_APP_ID || '';
const MIN_PRICE_USD = 100; // Only harvest cards worth $100+
const DAILY_API_LIMIT = 4500;
const CALLS_PER_TYPE = Math.floor(DAILY_API_LIMIT / 2); // 2,250 for sold, 2,250 for active
const DELAY_MS = 1000; // 1 second between calls
const CHECKPOINT_FILE = 'data/ebay-comprehensive-checkpoint.json';

// ============================================================================
// TYPES
// ============================================================================

interface Checkpoint {
  processedCards: number;
  soldCallsToday: number;
  activeCallsToday: number;
  lastCardId: string;
  lastResetDate: string;
  totalSoldSales: number;
  totalActiveListings: number;
  startedAt: string;
  updatedAt: string;
}

interface EbayItem {
  itemId: string;
  title: string;
  sellingStatus: {
    convertedCurrentPrice: { value: string };
    sellingState?: string;
  };
  listingInfo?: {
    endTime?: string;
    listingType?: string;
  };
  condition?: {
    conditionDisplayName?: string;
  };
  viewItemURL?: string;
  galleryURL?: string;
  shippingInfo?: {
    shippingServiceCost?: { value: string };
  };
}

// ============================================================================
// EBAY API CLIENT
// ============================================================================

class EbayAPI {
  private appId: string;
  private baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';

  constructor(appId: string) {
    this.appId = appId;

    if (this.appId.includes('SBX')) {
      throw new Error('⚠️  Sandbox credentials detected! Use production credentials.');
    }
  }

  /**
   * Search for SOLD items (completed with sales)
   */
  async findCompletedItems(keywords: string, options: {
    minPrice?: number;
    pageNumber?: number;
  } = {}): Promise<EbayItem[]> {
    const { minPrice = MIN_PRICE_USD, pageNumber = 1 } = options;

    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': this.appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords,
      'paginationInput.pageNumber': pageNumber.toString(),
      'paginationInput.entriesPerPage': '100',
      'sortOrder': 'EndTimeSoonest',
      // Filters
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'itemFilter(1).name': 'MinPrice',
      'itemFilter(1).value': minPrice.toString(),
      'itemFilter(2).name': 'CategoryId',
      'itemFilter(2).value': '183454', // Pokemon TCG
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`eBay API error: ${response.statusText}`);
    }

    const data = await response.json();
    const searchResult = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0];

    if (!searchResult || searchResult['@count'] === '0') {
      return [];
    }

    return searchResult.item || [];
  }

  /**
   * Search for ACTIVE items (current listings)
   */
  async findItemsAdvanced(keywords: string, options: {
    minPrice?: number;
    pageNumber?: number;
  } = {}): Promise<EbayItem[]> {
    const { minPrice = MIN_PRICE_USD, pageNumber = 1 } = options;

    const params = new URLSearchParams({
      'OPERATION-NAME': 'findItemsAdvanced',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': this.appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords,
      'paginationInput.pageNumber': pageNumber.toString(),
      'paginationInput.entriesPerPage': '100',
      'sortOrder': 'PricePlusShippingLowest',
      // Filters
      'itemFilter(0).name': 'MinPrice',
      'itemFilter(0).value': minPrice.toString(),
      'itemFilter(1).name': 'ListingType',
      'itemFilter(1).value(0)': 'FixedPrice',
      'itemFilter(1).value(1)': 'AuctionWithBIN',
      'itemFilter(2).name': 'CategoryId',
      'itemFilter(2).value': '183454', // Pokemon TCG
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`eBay API error: ${response.statusText}`);
    }

    const data = await response.json();
    const searchResult = data?.findItemsAdvancedResponse?.[0]?.searchResult?.[0];

    if (!searchResult || searchResult['@count'] === '0') {
      return [];
    }

    return searchResult.item || [];
  }

  async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CHECKPOINT MANAGEMENT
// ============================================================================

function loadCheckpoint(): Checkpoint {
  if (!existsSync(CHECKPOINT_FILE)) {
    return {
      processedCards: 0,
      soldCallsToday: 0,
      activeCallsToday: 0,
      lastCardId: '',
      lastResetDate: new Date().toISOString().split('T')[0],
      totalSoldSales: 0,
      totalActiveListings: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const data = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));

  // Reset daily counters if it's a new day
  const today = new Date().toISOString().split('T')[0];
  if (data.lastResetDate !== today) {
    data.soldCallsToday = 0;
    data.activeCallsToday = 0;
    data.lastResetDate = today;
  }

  return data;
}

function saveCheckpoint(checkpoint: Checkpoint) {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// ============================================================================
// MAIN HARVESTER
// ============================================================================

async function harvestEbayData() {
  const api = new EbayAPI(EBAY_APP_ID);
  const checkpoint = loadCheckpoint();

  console.log('🔄 EBAY COMPREHENSIVE HARVESTER');
  console.log('============================================================');
  console.log(`💰 Min Price: $${MIN_PRICE_USD}`);
  console.log(`📊 Daily Limit: ${DAILY_API_LIMIT} calls (${CALLS_PER_TYPE} sold + ${CALLS_PER_TYPE} active)`);
  console.log(`⏱️  Delay: ${DELAY_MS}ms between calls`);
  console.log('============================================================\n');

  console.log(`📍 Checkpoint Status:`);
  console.log(`   Processed: ${checkpoint.processedCards} cards`);
  console.log(`   Sold Calls Today: ${checkpoint.soldCallsToday}/${CALLS_PER_TYPE}`);
  console.log(`   Active Calls Today: ${checkpoint.activeCallsToday}/${CALLS_PER_TYPE}`);
  console.log(`   Total Sold Sales: ${checkpoint.totalSoldSales}`);
  console.log(`   Total Active Listings: ${checkpoint.totalActiveListings}\n`);

  // Get high-value cards from database
  const cards = await prisma.unifiedMarketListing.findMany({
    where: {
      priceCents: { gte: MIN_PRICE_USD * 100 },
      cardName: { not: 'Unknown' },
    },
    distinct: ['cardName', 'setName', 'grade', 'gradeCompany'],
    take: 200,
    orderBy: { priceCents: 'desc' },
  });

  console.log(`🎯 Found ${cards.length} high-value cards to harvest\n`);

  for (const card of cards) {
    // Skip if already processed
    if (checkpoint.lastCardId && card.id <= checkpoint.lastCardId) {
      continue;
    }

    // Check daily limits
    if (checkpoint.soldCallsToday >= CALLS_PER_TYPE &&
        checkpoint.activeCallsToday >= CALLS_PER_TYPE) {
      console.log('\n⚠️  Daily API limit reached. Stopping until tomorrow.');
      break;
    }

    const searchQuery = buildSearchQuery(card);
    console.log(`\n🔍 Harvesting: ${card.cardName} ${card.setName || ''}`);
    console.log(`   Grade: ${card.gradeCompany || 'Any'} ${card.grade || ''}`);

    try {
      // 1. HARVEST SOLD LISTINGS (Historical Data)
      if (checkpoint.soldCallsToday < CALLS_PER_TYPE) {
        await api.sleep(DELAY_MS);
        const soldItems = await api.findCompletedItems(searchQuery);
        checkpoint.soldCallsToday++;

        let savedSold = 0;
        for (const item of soldItems) {
          const saved = await saveSoldListing(card, item);
          if (saved) savedSold++;
        }

        checkpoint.totalSoldSales += savedSold;
        console.log(`   ✅ Sold: ${savedSold}/${soldItems.length} saved`);
      }

      // 2. HARVEST ACTIVE LISTINGS (Current Prices)
      if (checkpoint.activeCallsToday < CALLS_PER_TYPE) {
        await api.sleep(DELAY_MS);
        const activeItems = await api.findItemsAdvanced(searchQuery);
        checkpoint.activeCallsToday++;

        let savedActive = 0;
        for (const item of activeItems) {
          const saved = await saveActiveListing(card, item);
          if (saved) savedActive++;
        }

        checkpoint.totalActiveListings += savedActive;
        console.log(`   ✅ Active: ${savedActive}/${activeItems.length} saved`);
      }

      checkpoint.processedCards++;
      checkpoint.lastCardId = card.id;

      // Save checkpoint every 10 cards
      if (checkpoint.processedCards % 10 === 0) {
        saveCheckpoint(checkpoint);
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      continue;
    }
  }

  // Final save
  saveCheckpoint(checkpoint);

  console.log('\n============================================================');
  console.log('✅ HARVEST COMPLETE');
  console.log('============================================================');
  console.log(`📊 Cards Processed: ${checkpoint.processedCards}`);
  console.log(`📞 API Calls: ${checkpoint.soldCallsToday + checkpoint.activeCallsToday}/${DAILY_API_LIMIT}`);
  console.log(`💾 Total Sold Sales: ${checkpoint.totalSoldSales}`);
  console.log(`💾 Total Active Listings: ${checkpoint.totalActiveListings}`);
  console.log('============================================================\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildSearchQuery(card: any): string {
  const parts: string[] = [];

  if (card.cardName && card.cardName !== 'Unknown') {
    parts.push(card.cardName);
  }
  if (card.setName && card.setName !== 'Unknown') {
    parts.push(card.setName);
  }
  if (card.gradeCompany && card.gradeCompany !== 'RAW') {
    parts.push(card.gradeCompany);
    if (card.grade) {
      parts.push(card.grade.toString());
    }
  }

  parts.push('Pokemon');

  return parts.join(' ');
}

async function saveSoldListing(card: any, item: EbayItem): Promise<boolean> {
  try {
    const priceCents = Math.round(parseFloat(item.sellingStatus.convertedCurrentPrice.value) * 100);
    const soldDate = item.listingInfo?.endTime ? new Date(item.listingInfo.endTime) : new Date();

    // Try to find matching card in Card table
    let cardRecord = await prisma.card.findFirst({
      where: {
        name: { contains: card.cardName, mode: 'insensitive' },
      },
    });

    // If no card found, create stub
    if (!cardRecord) {
      cardRecord = await prisma.card.create({
        data: {
          id: `ebay-${item.itemId}`,
          name: card.cardName || 'Unknown',
          number: card.cardNumber || '0',
          normalizedName: (card.cardName || 'Unknown').toLowerCase(),
          setCode: 'UNKNOWN',
          cardKey: `${card.cardName}-${Date.now()}`,
          updatedAt: new Date(),
        },
      });
    }

    await prisma.compSale.upsert({
      where: {
        id: `ebay-sold-${item.itemId}`,
      },
      create: {
        id: `ebay-sold-${item.itemId}`,
        cardId: cardRecord.id,
        source: 'EBAY',
        priceCents,
        soldAt: soldDate,
        condition: item.condition?.conditionDisplayName,
        grade: card.gradeCompany && card.grade ? `${card.gradeCompany} ${card.grade}` : null,
        isVerified: true,
      },
      update: {
        priceCents,
        soldAt: soldDate,
      },
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function saveActiveListing(card: any, item: EbayItem): Promise<boolean> {
  try {
    const priceCents = Math.round(parseFloat(item.sellingStatus.convertedCurrentPrice.value) * 100);
    const shippingCents = item.shippingInfo?.shippingServiceCost?.value
      ? Math.round(parseFloat(item.shippingInfo.shippingServiceCost.value) * 100)
      : 0;

    await prisma.unifiedMarketListing.upsert({
      where: {
        source_sourceId: {
          source: 'EBAY',
          sourceId: item.itemId,
        },
      },
      create: {
        id: `ebay-active-${item.itemId}`,
        source: 'EBAY',
        sourceId: item.itemId,
        title: item.title.substring(0, 500),
        rawTitle: item.title.substring(0, 500),
        cardName: card.cardName?.substring(0, 255),
        setName: card.setName?.substring(0, 255),
        cardNumber: card.cardNumber?.substring(0, 10),
        gradeCompany: card.gradeCompany,
        grade: card.grade,
        priceCents,
        shippingCents,
        url: item.viewItemURL?.substring(0, 500),
        condition: item.condition?.conditionDisplayName?.substring(0, 50),
        dataQuality: 0.85, // eBay has good data quality
        updatedAt: new Date(),
      },
      update: {
        priceCents,
        shippingCents,
        updatedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// RUN
// ============================================================================

harvestEbayData()
  .then(() => {
    console.log('✅ Harvester finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Harvester failed:', error);
    process.exit(1);
  });
