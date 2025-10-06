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

  // Clean card name - extract just the Pokemon name
  if (card.cardName && card.cardName !== 'Unknown') {
    let cleanName = card.cardName;

    // Remove leading/trailing quotes
    cleanName = cleanName.replace(/^["']+|["']+$/g, '');

    // Remove lot numbers like "lot: 6689f22016" or "Lot #123456"
    cleanName = cleanName.replace(/\blot[:\s#]*[a-z0-9]+/gi, '');

    // Remove SKUs/IDs like "18wa191" or "30wa191" at start
    cleanName = cleanName.replace(/^\d+[a-z]+\d+\s*/i, '');

    // Remove "pokemon" prefix/infix
    cleanName = cleanName.replace(/\bpokemon\b/gi, '');

    // Remove set/region qualifiers (japanese, xy promo, swsh, etc)
    cleanName = cleanName.replace(/\b(japanese|english|swsh|xy|sm|bw|dp|ex|promo|special box|holo|reverse holo|non-holo|shiny|full art|alt art|sir|sar|chr|rainbow rare)\b/gi, '');

    // Remove parentheticals like "(Holo)"
    cleanName = cleanName.replace(/\([^)]*\)/g, '');

    // Remove card numbers like "#295" or "#sv107"
    cleanName = cleanName.replace(/#[a-z0-9]+/gi, '');

    // Clean up whitespace
    cleanName = cleanName.replace(/\s+/g, ' ').trim();

    // Extract just the Pokemon name (usually 1-3 capitalized words)
    // Match patterns like "Pikachu", "Mega Gengar", "Charizard VMAX", "Blaine's Charizard"
    const nameMatch = cleanName.match(/\b([A-Z][a-z']+(?:'s)?(?:\s+[A-Z][a-z]+){0,3}(?:\s+(?:EX|GX|V|VMAX|VSTAR|ex|gx|v))?)\b/i);
    if (nameMatch) {
      cleanName = nameMatch[1];
    }

    if (cleanName && cleanName.length > 2) parts.push(cleanName);
  }

  // Clean set name (remove "Pokemon" duplication, years)
  if (card.setName && card.setName !== 'Unknown') {
    let cleanSet = card.setName;

    // Remove "Pokemon" from set name (we add it at end)
    cleanSet = cleanSet.replace(/\bpokemon\b/gi, '');

    // Remove years like "2023" or "(2023)"
    cleanSet = cleanSet.replace(/\(?\b(19|20)\d{2}\)?/g, '');

    // Clean up
    cleanSet = cleanSet.replace(/\s+/g, ' ').trim();

    if (cleanSet) parts.push(cleanSet);
  }

  // Add grading info
  if (card.gradeCompany && card.gradeCompany !== 'RAW') {
    parts.push(card.gradeCompany);
    if (card.grade) {
      parts.push(card.grade.toString());
    }
  }

  parts.push('Pokemon');

  return parts.join(' ');
}

/**
 * Parse eBay listing title to extract Pokemon card details
 */
function parseEbayTitle(title: string): {
  cardName: string;
  setName: string;
  cardNumber: string | null;
  gradeCompany: 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'ACE' | 'RAW' | null;
  grade: number | null;
  variant: string | null;
  language: string | null;
  edition: string | null;
} {
  // Grade parsing (PSA 10, BGS 9.5, CGC 9, etc)
  const gradeMatch = title.match(/\b(PSA|BGS|CGC|SGC|ACE)\s+(\d+(?:\.\d+)?)\b/i);
  const gradeCompany = gradeMatch ? (gradeMatch[1].toUpperCase() as 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'ACE') : null;
  const grade = gradeMatch ? parseFloat(gradeMatch[2]) : null;

  // Card number (#123/456 or #123)
  const cardNumMatch = title.match(/#(\d+)(?:\/\d+)?/);
  const cardNumber = cardNumMatch ? cardNumMatch[1] : null;

  // Set name (common Pokemon sets)
  const setPatterns = [
    /Base Set/i,
    /Jungle/i,
    /Fossil/i,
    /Team Rocket/i,
    /Gym Heroes/i,
    /Gym Challenge/i,
    /Neo Genesis/i,
    /Neo Discovery/i,
    /Neo Revelation/i,
    /Neo Destiny/i,
    /Legendary Collection/i,
    /Expedition/i,
    /Aquapolis/i,
    /Skyridge/i,
    /EX Ruby & Sapphire/i,
    /FireRed & LeafGreen/i,
    /Evolutions/i,
    /Shining Fates/i,
    /Crown Zenith/i,
    /Lost Origin/i,
    /Brilliant Stars/i,
    /Fusion Strike/i,
    /Evolving Skies/i,
    /Chilling Reign/i,
    /Battle Styles/i,
    /Vivid Voltage/i,
    /Champions Path/i,
    /Darkness Ablaze/i,
    /Rebel Clash/i,
    /Sword & Shield/i,
    /Cosmic Eclipse/i,
    /Hidden Fates/i,
    /Unified Minds/i,
    /Unbroken Bonds/i,
    /Team Up/i,
    /Lost Thunder/i,
    /Celestial Storm/i,
    /Forbidden Light/i,
    /Ultra Prism/i,
    /Crimson Invasion/i,
    /Shining Legends/i,
    /Burning Shadows/i,
    /Guardians Rising/i,
    /Sun & Moon/i,
    /Scarlet & Violet/i,
    /Obsidian Flames/i,
    /Paldean Fates/i,
    /Paradox Rift/i,
    /151/i,
    /Prismatic Evolutions/i,
  ];

  let setName = 'Unknown';
  for (const pattern of setPatterns) {
    const match = title.match(pattern);
    if (match) {
      setName = match[0];
      break;
    }
  }

  // Language
  const language = /\b(japanese|korean|chinese|german|french|italian|spanish)\b/i.test(title)
    ? title.match(/\b(japanese|korean|chinese|german|french|italian|spanish)\b/i)![0]
    : null;

  // Edition (1st Edition, Unlimited, Shadowless)
  const edition = /\b(1st edition|shadowless|unlimited)\b/i.test(title)
    ? title.match(/\b(1st edition|shadowless|unlimited)\b/i)![0]
    : null;

  // Variant (Holo, Reverse Holo, etc)
  const variantMatch = title.match(/\b(holo|reverse holo|non-holo|holographic|holofoil)\b/i);
  const variant = variantMatch ? variantMatch[0] : null;

  // Card name - try to extract Pokemon name
  // Remove grade, set, numbers, and common keywords
  let cleanTitle = title;
  if (gradeMatch) cleanTitle = cleanTitle.replace(gradeMatch[0], '');
  if (cardNumMatch) cleanTitle = cleanTitle.replace(cardNumMatch[0], '');
  cleanTitle = cleanTitle.replace(new RegExp(setName, 'i'), '');
  cleanTitle = cleanTitle.replace(/\b(pokemon|tcg|card|rare|ultra rare|secret rare|full art|alt art|rainbow|gold|promo)\b/gi, '');
  if (variant) cleanTitle = cleanTitle.replace(new RegExp(variant, 'i'), '');
  if (language) cleanTitle = cleanTitle.replace(new RegExp(language, 'i'), '');
  if (edition) cleanTitle = cleanTitle.replace(new RegExp(edition, 'i'), '');

  // Extract Pokemon name (capitalized words, possibly with EX/GX/V/VMAX suffixes)
  const nameMatch = cleanTitle.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}(?:\s+(?:EX|GX|V|VMAX|VSTAR|ex|gx))?)\b/);
  const cardName = nameMatch ? nameMatch[1].trim() : 'Unknown';

  return {
    cardName,
    setName,
    cardNumber,
    gradeCompany,
    grade,
    variant,
    language,
    edition,
  };
}

async function saveActiveListing(card: any, item: BrowseAPIItem): Promise<boolean> {
  try {
    // Skip if no price
    if (!item.price || !item.price.value) {
      return false;
    }

    // Parse eBay listing title to extract card details
    const parsed = parseEbayTitle(item.title);

    const priceCents = Math.round(parseFloat(item.price.value) * 100);
    const shippingCents = item.shippingOptions?.[0]?.shippingCost?.value
      ? Math.round(parseFloat(item.shippingOptions[0].shippingCost.value) * 100)
      : 0;

    // Calculate data quality based on how much info we extracted
    let dataQuality = 0.5; // Base quality
    if (parsed.cardName !== 'Unknown') dataQuality += 0.15;
    if (parsed.setName !== 'Unknown') dataQuality += 0.15;
    if (parsed.gradeCompany) dataQuality += 0.1;
    if (parsed.cardNumber) dataQuality += 0.1;

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
        cardName: parsed.cardName.substring(0, 255),
        setName: parsed.setName.substring(0, 255),
        cardNumber: parsed.cardNumber?.substring(0, 10),
        gradeCompany: parsed.gradeCompany,
        grade: parsed.grade,
        priceCents,
        shippingCents,
        url: item.itemWebUrl?.substring(0, 500),
        condition: item.condition?.substring(0, 50),
        dataQuality,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        priceCents,
        shippingCents,
        cardName: parsed.cardName.substring(0, 255),
        setName: parsed.setName.substring(0, 255),
        cardNumber: parsed.cardNumber?.substring(0, 10),
        gradeCompany: parsed.gradeCompany,
        grade: parsed.grade,
        dataQuality,
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
