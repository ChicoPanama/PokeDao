/**
 * SIGNAL GENERATOR V2
 *
 * Works with actual database schema:
 * - canonical_cards (card catalog)
 * - sale_records (historical sales/comps)
 * - market_listings (active listings)
 * - official_pokemon_cards (TCGdex data)
 */

import { PrismaClient } from '@prisma/client';
import { MarketSignal } from './ai-ensemble.js';

const prisma = new PrismaClient();

export interface SignalGeneratorConfig {
  minDiscount?: number; // Minimum discount % to qualify (e.g., -10 = 10% below FV)
  minComps?: number; // Minimum number of comps required
  minVolume?: number; // Minimum sales/month
  onlyGraded?: boolean; // Only PSA/BGS/CGC graded cards
}

/**
 * Generate market signals from database
 */
export async function generateSignalsFromDatabase(
  config: SignalGeneratorConfig = {}
): Promise<MarketSignal[]> {
  const {
    minDiscount = -10,
    minComps = 5,
    minVolume = 2,
    onlyGraded = false, // Changed default to false since we don't have many graded
  } = config;

  console.log('🔍 Scanning database for opportunities...');
  console.log(`Filters: ${minDiscount}% discount, ${minComps}+ comps, ${minVolume}+ sales/mo`);

  // Get active listings from UnifiedMarketListing
  const listings: any[] = await prisma.$queryRaw`
    SELECT
      id, source, "cardName", "setName", "cardNumber", variant,
      grade, "gradeCompany", "priceCents", url
    FROM "UnifiedMarketListing"
    WHERE "priceCents" > 1000
      AND "cardName" IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 100
  `;

  console.log(`Found ${listings.length} active listings`);

  const signals: MarketSignal[] = [];

  for (const listing of listings) {
    try {
      // Skip graded filter if needed
      if (onlyGraded && !listing.gradeCompany) continue;

      const signal = await enrichListingWithMarketData(listing);
      if (!signal) continue;

      // Apply filters
      if (signal.marketData.salesCount < minComps) continue;
      if (signal.marketData.avgVolume30d < minVolume) continue;

      const discount =
        ((signal.listedPrice - signal.marketData.fairValue) / signal.marketData.fairValue) * 100;
      if (discount > minDiscount) continue;

      signals.push(signal);
    } catch (error) {
      console.error(`Error processing listing ${listing.id}:`, error);
    }
  }

  console.log(`✅ Generated ${signals.length} qualified signals`);
  return signals;
}

/**
 * Enrich listing with market data
 */
async function enrichListingWithMarketData(listing: any): Promise<MarketSignal | null> {
  if (!listing.cardName) return null;

  // Step 1: Find canonical card
  const canonicalCard: any = await prisma.$queryRaw`
    SELECT *
    FROM canonical_cards
    WHERE LOWER("canonicalName") = LOWER(${listing.cardName})
      ${listing.setName ? prisma.$queryRaw`AND LOWER("canonicalSet") = LOWER(${listing.setName})` : prisma.$queryRaw``}
    LIMIT 1
  `;

  const card = canonicalCard?.[0];

  // Step 2: Get comparable sales (comps) from sale_records
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const comps: any[] = await prisma.$queryRaw`
    SELECT
      "soldPriceCents", "soldAt", source, "gradeCompany", grade
    FROM sale_records
    WHERE LOWER("cardName") = LOWER(${listing.cardName})
      ${listing.setName ? prisma.$queryRaw`AND LOWER("setName") = LOWER(${listing.setName})` : prisma.$queryRaw``}
      AND "soldAt" >= ${thirtyDaysAgo}
      AND "soldPriceCents" > 0
    ORDER BY "soldAt" DESC
    LIMIT 50
  `;

  if (comps.length === 0) return null;

  // Step 3: Calculate metrics
  const prices = comps.map((c) => c.soldPriceCents / 100);
  const fairValue = calculateMedian(prices);
  const salesCount = comps.length;
  const avgVolume30d = comps.length; // All comps are from last 30 days
  const { priceChange7d, priceChange30d } = calculatePriceChange(comps);
  const lowestAvailable = Math.min(...prices);

  // Step 4: Venue breakdown
  const venueBreakdown = calculateVenueBreakdown(comps);

  // Step 5: Get official card metadata
  let officialCard: any = null;
  let releaseYear: number | undefined = undefined;

  if (card?.officialCardId) {
    const result: any[] = await prisma.$queryRaw`
      SELECT *
      FROM official_pokemon_cards
      WHERE id = ${card.officialCardId}
      LIMIT 1
    `;
    officialCard = result[0];

    // Extract year from setId (format: swsh1, xy1, base1, etc.)
    if (officialCard?.setId) {
      const yearMatch = officialCard.setId.match(/\d{4}/);
      if (yearMatch) {
        releaseYear = parseInt(yearMatch[0]);
      }
    }
  }

  // Step 6: Build MarketSignal
  const signal: MarketSignal = {
    // Card Identity
    cardName: listing.cardName,
    setName: listing.setName || card?.canonicalSet,

    // TCG Metadata
    rarity: card?.rarity || officialCard?.rarity,
    cardType: inferCardType(listing.variant),
    setNumber: listing.cardNumber || card?.cardNumber,
    releaseYear,

    // Grading
    grade: listing.grade?.toString(),
    gradeCompany: listing.gradeCompany || undefined,

    // Special Attributes
    isFirstEdition: officialCard?.variantFirstEdition || false,
    isShadowless: officialCard?.variantShadowless || false,
    isReverseHolo: officialCard?.variantReverse || false,

    // Pricing
    listedPrice: listing.priceCents / 100,
    listingUrl: listing.url || undefined,
    venue: marketSourceToVenue(listing.source),

    // Market Data
    marketData: {
      fairValue,
      salesCount,
      avgVolume30d,
      priceChange7d,
      priceChange30d,
      lowestAvailable,
      venueBreakdown,
    },
  };

  return signal;
}

/**
 * Calculate median price
 */
function calculateMedian(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Calculate price change over 7d and 30d
 */
function calculatePriceChange(comps: any[]): { priceChange7d: number; priceChange30d: number } {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recent7d = comps.filter((c) => new Date(c.soldAt) >= sevenDaysAgo);
  const older7d = comps.filter((c) => new Date(c.soldAt) < sevenDaysAgo);

  const avg7d = recent7d.length > 0
    ? recent7d.reduce((sum, c) => sum + c.soldPriceCents, 0) / recent7d.length / 100
    : 0;
  const avgOlder = older7d.length > 0
    ? older7d.reduce((sum, c) => sum + c.soldPriceCents, 0) / older7d.length / 100
    : 0;

  const priceChange7d = avgOlder > 0 ? ((avg7d - avgOlder) / avgOlder) * 100 : 0;

  // 30d change: compare first half vs second half of comps
  const halfPoint = Math.floor(comps.length / 2);
  const recentHalf = comps.slice(0, halfPoint);
  const olderHalf = comps.slice(halfPoint);

  const avgRecent = recentHalf.length > 0
    ? recentHalf.reduce((sum, c) => sum + c.soldPriceCents, 0) / recentHalf.length / 100
    : 0;
  const avgOld = olderHalf.length > 0
    ? olderHalf.reduce((sum, c) => sum + c.soldPriceCents, 0) / olderHalf.length / 100
    : 0;

  const priceChange30d = avgOld > 0 ? ((avgRecent - avgOld) / avgOld) * 100 : 0;

  return { priceChange7d, priceChange30d };
}

/**
 * Calculate venue breakdown
 */
function calculateVenueBreakdown(comps: any[]) {
  const venueMap = new Map<string, { count: number; totalPrice: number }>();

  comps.forEach((comp) => {
    const venue = comp.source || 'Unknown';
    const existing = venueMap.get(venue) || { count: 0, totalPrice: 0 };
    venueMap.set(venue, {
      count: existing.count + 1,
      totalPrice: existing.totalPrice + comp.soldPriceCents / 100,
    });
  });

  const totalComps = comps.length;
  const breakdown = Array.from(venueMap.entries()).map(([venue, data]) => ({
    venue: marketSourceToVenue(venue),
    count: data.count,
    avgPrice: data.totalPrice / data.count,
    weight: data.count / totalComps,
  }));

  return breakdown.sort((a, b) => b.weight - a.weight);
}

/**
 * Infer card type from variant string
 */
function inferCardType(variant: string | null | undefined): string | undefined {
  if (!variant) return undefined;

  const lower = variant.toLowerCase();
  if (lower.includes('full art')) return 'Full Art';
  if (lower.includes('alt art') || lower.includes('alternate art')) return 'Alt Art';
  if (lower.includes('rainbow')) return 'Rainbow Rare';
  if (lower.includes('gold')) return 'Gold Rare';
  if (lower.includes('illustration rare')) return 'Illustration Rare';
  if (lower.includes('hyper rare')) return 'Hyper Rare';
  if (lower.includes('special art')) return 'Special Art';

  return undefined;
}

/**
 * Convert MarketSource to friendly venue name
 */
function marketSourceToVenue(source: string): string {
  switch (source) {
    case 'EBAY':
      return 'eBay';
    case 'TCGPLAYER':
      return 'TCGPlayer';
    case 'COLLECTORCRYPT':
      return 'Collector Crypt';
    case 'COURTYARD':
      return 'Courtyard';
    case 'PHYGITALS':
      return 'Phygitals';
    case 'JUSTTCG':
      return 'JustTCG';
    default:
      return source;
  }
}

/**
 * Get top N signals by discount
 */
export async function getTopSignals(count: number = 10): Promise<MarketSignal[]> {
  const signals = await generateSignalsFromDatabase();

  return signals
    .sort((a, b) => {
      const discountA = ((a.listedPrice - a.marketData.fairValue) / a.marketData.fairValue) * 100;
      const discountB = ((b.listedPrice - b.marketData.fairValue) / b.marketData.fairValue) * 100;
      return discountA - discountB;
    })
    .slice(0, count);
}
