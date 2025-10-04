/**
 * eBay Browse API Harvester (OAuth-based)
 *
 * Updated to use Browse API (current standard) instead of deprecated Finding API
 *
 * Collects:
 * 1. Historical SOLD listings for TFV calculations
 * 2. Current ACTIVE listings for arbitrage detection
 *
 * Strategy:
 * - Uses OAuth application token (auto-refresh every 2 hours)
 * - Focus on high-value cards ($100+)
 * - Smart checkpoint/resume
 * - Rate limiting: 5,000 calls/day
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

// ============================================================================
// CONFIG
// ============================================================================

const EBAY_APP_ID = process.env.EBAY_APP_ID || '';
const EBAY_CERT_ID = process.env.EBAY_CERT_ID || '';
const MIN_PRICE_USD = 100;
const DAILY_API_LIMIT = 4500; // Conservative limit
const DELAY_MS = 1000;
const CHECKPOINT_FILE = 'data/ebay-browse-checkpoint.json';

// ============================================================================
// TYPES
// ============================================================================

interface Checkpoint {
  processedCards: number;
  apiCallsToday: number;
  processedCardIds: string[]; // Track which cards we've already checked
  lastResetDate: string;
  totalListings: number;
  startedAt: string;
  updatedAt: string;
  accessToken?: string;
  tokenExpiry?: string;
}

interface BrowseAPIItem {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  condition?: string;
  conditionId?: string;
  itemWebUrl: string;
  image?: {
    imageUrl: string;
  };
  seller?: {
    username: string;
    feedbackScore?: number;
  };
  shippingOptions?: Array<{
    shippingCost?: {
      value: string;
      currency: string;
    };
  }>;
}

interface BrowseAPIResponse {
  total: number;
  limit: number;
  offset: number;
  itemSummaries?: BrowseAPIItem[];
  warnings?: any[];
}

// ============================================================================
// EBAY BROWSE API CLIENT
// ============================================================================

class EbayBrowseAPI {
  private appId: string;
  private certId: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl = 'https://api.ebay.com/buy/browse/v1';

  constructor(appId: string, certId: string) {
    this.appId = appId;
    this.certId = certId;
  }

  /**
   * Get OAuth application token (valid for 2 hours)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('🔑 Refreshing eBay OAuth token...');

    const credentials = Buffer.from(`${this.appId}:${this.certId}`).toString('base64');

    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth token error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();

    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));

    console.log(`✅ Token refreshed (expires in ${Math.floor(data.expires_in / 3600)}h)`);

    return this.accessToken;
  }

  /**
   * Search for items (active listings)
   */
  async search(keywords: string, options: {
    minPrice?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<BrowseAPIResponse> {
    const { minPrice = MIN_PRICE_USD, limit = 50, offset = 0 } = options;

    const token = await this.getAccessToken();

    // Build filter
    const filters: string[] = [];
    filters.push(`price:[${minPrice}..],priceCurrency:USD`);
    filters.push('buyingOptions:{FIXED_PRICE|AUCTION}');
    filters.push('itemLocationCountry:US');
    filters.push('categoryIds:183454'); // Pokemon TCG

    const params = new URLSearchParams({
      q: keywords,
      limit: limit.toString(),
      offset: offset.toString(),
      filter: filters.join(','),
      sort: 'price',
    });

    const url = `${this.baseUrl}/item_summary/search?${params}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Browse API error: ${response.status} - ${errorText}`);
    }

    const data: BrowseAPIResponse = await response.json();
    return data;
  }

  /**
   * Get item details (for sold items, we need to use search with sold filter)
   * Note: Browse API doesn't directly support "sold items only" filter
   * We'll focus on active listings for now
   */
  async getItem(itemId: string): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/item/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Get item error: ${response.status} - ${errorText}`);
    }

    return await response.json();
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
      apiCallsToday: 0,
      processedCardIds: [],
      lastResetDate: new Date().toISOString().split('T')[0],
      totalListings: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const data = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));

  // Reset daily counters if it's a new day
  const today = new Date().toISOString().split('T')[0];
  if (data.lastResetDate !== today) {
    data.apiCallsToday = 0;
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
  const api = new EbayBrowseAPI(EBAY_APP_ID, EBAY_CERT_ID);
  const checkpoint = loadCheckpoint();

  console.log('🔄 EBAY BROWSE API HARVESTER');
  console.log('============================================================');
  console.log(`💰 Min Price: $${MIN_PRICE_USD}`);
  console.log(`📊 Daily Limit: ${DAILY_API_LIMIT} calls`);
  console.log(`⏱️  Delay: ${DELAY_MS}ms between calls`);
  console.log('============================================================\n');

  console.log(`📍 Checkpoint Status:`);
  console.log(`   Processed: ${checkpoint.processedCards} cards`);
  console.log(`   API Calls Today: ${checkpoint.apiCallsToday}/${DAILY_API_LIMIT}`);
  console.log(`   Total Listings: ${checkpoint.totalListings}\n`);

  // Strategy: Keep fetching cards in batches until we hit API limit
  // This ensures we use all 4,500 calls even if many cards have no eBay listings

  let processedInSession = 0;
  let batchOffset = 0;
  const BATCH_SIZE = 500;

  console.log(`🎯 Harvesting cards until API limit (${DAILY_API_LIMIT} calls)\n`);

  while (checkpoint.apiCallsToday < DAILY_API_LIMIT) {
    // Fetch next batch of high-value cards
    const cardBatch = await prisma.unifiedMarketListing.findMany({
      where: {
        priceCents: { gte: MIN_PRICE_USD * 100 },
        cardName: { not: null },
        cardName: { not: 'Unknown' },
      },
      orderBy: { priceCents: 'desc' },
      skip: batchOffset,
      take: BATCH_SIZE,
    });

    if (cardBatch.length === 0) {
      console.log('\n✅ All high-value cards processed.');
      break;
    }

    console.log(`📦 Processing batch: ${batchOffset}-${batchOffset + cardBatch.length} cards\n`);

    let batchHadNewCards = false;
    const processedSet = new Set(checkpoint.processedCardIds);

    for (const card of cardBatch) {
      // Skip if already processed (checkpoint resume)
      if (processedSet.has(card.id)) {
        continue;
      }

      batchHadNewCards = true;
      processedSet.add(card.id);

      // Check daily limit
      if (checkpoint.apiCallsToday >= DAILY_API_LIMIT) {
        console.log('\n⚠️  Daily API limit reached. Stopping until tomorrow.');
        break;
      }

      processedInSession++;

    const searchQuery = buildSearchQuery(card);
    console.log(`\n🔍 Harvesting: ${card.cardName} ${card.setName || ''}`);
    console.log(`   Grade: ${card.gradeCompany || 'Any'} ${card.grade || ''}`);
    console.log(`   Query: "${searchQuery}"`);

    try {
      await api.sleep(DELAY_MS);

      const results = await api.search(searchQuery, {
        minPrice: MIN_PRICE_USD,
        limit: 50,
      });

      checkpoint.apiCallsToday++;

      if (!results.itemSummaries || results.itemSummaries.length === 0) {
        console.log(`   ℹ️  No listings found`);
        continue;
      }

      console.log(`   📦 Found ${results.itemSummaries.length} listings (total: ${results.total})`);

      let saved = 0;
      for (const item of results.itemSummaries) {
        const success = await saveActiveListing(card, item);
        if (success) saved++;
      }

      checkpoint.totalListings += saved;
      console.log(`   ✅ Saved ${saved}/${results.itemSummaries.length} listings`);

      checkpoint.processedCards++;
      checkpoint.processedCardIds.push(card.id);

      // Save checkpoint every 5 cards
      if (checkpoint.processedCards % 10 === 0) {
        saveCheckpoint(checkpoint);
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      continue;
    }
    }

    // Move to next batch
    batchOffset += BATCH_SIZE;

    // If no new cards were processed in this batch, we're done
    if (!batchHadNewCards) {
      console.log('\n✅ No more new cards to process.');
      break;
    }

    // Check if we should stop
    if (checkpoint.apiCallsToday >= DAILY_API_LIMIT) {
      break;
    }
  }

  // Final save
  saveCheckpoint(checkpoint);

  console.log('\n============================================================');
  console.log('✅ HARVEST COMPLETE');
  console.log('============================================================');
  console.log(`📊 Cards Processed: ${checkpoint.processedCards}`);
  console.log(`📞 API Calls: ${checkpoint.apiCallsToday}/${DAILY_API_LIMIT}`);
  console.log(`💾 Total Listings: ${checkpoint.totalListings}`);
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

async function saveActiveListing(card: any, item: BrowseAPIItem): Promise<boolean> {
  try {
    // Skip if no price
    if (!item.price || !item.price.value) {
      return false;
    }

    const priceCents = Math.round(parseFloat(item.price.value) * 100);
    const shippingCents = item.shippingOptions?.[0]?.shippingCost?.value
      ? Math.round(parseFloat(item.shippingOptions[0].shippingCost.value) * 100)
      : 0;

    await prisma.unifiedMarketListing.upsert({
      where: {
        source_sourceId: {
          source: 'EBAY',
          sourceId: item.itemId,
        },
      },
      create: {
        id: `ebay-${item.itemId}`,
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
        url: item.itemWebUrl?.substring(0, 500),
        condition: item.condition?.substring(0, 50),
        dataQuality: 0.85,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        priceCents,
        shippingCents,
        updatedAt: new Date(),
      },
    });

    return true;
  } catch (error: any) {
    // Silently skip duplicates
    if (error.code === 'P2002') {
      return false;
    }
    console.error(`     ⚠️  Save error: ${error.message}`);
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
  })
  .finally(() => {
    prisma.$disconnect();
  });
