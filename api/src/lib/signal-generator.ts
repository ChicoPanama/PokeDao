/**
 * SIGNAL GENERATOR
 *
 * Pulls real data from database and generates enriched MarketSignals
 * for AI ensemble analysis
 */

import { PrismaClient, MarketSource } from '@prisma/client';
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
 * Finds underpriced listings and enriches with TCG metadata
 */
export async function generateSignalsFromDatabase(
  config: SignalGeneratorConfig = {}
): Promise<MarketSignal[]> {
  const {
    minDiscount = -10, // At least 10% discount
    minComps = 5,
    minVolume = 2,
    onlyGraded = true,
  } = config;

  console.log('🔍 Scanning database for opportunities...');
  console.log(`Filters: ${minDiscount}% discount, ${minComps}+ comps, ${minVolume}+ sales/mo`);

  // Step 1: Get active listings
  const where: any = {
    priceCents: { gt: 1000 }, // At least $10
    cardName: { not: null },
  };

  if (onlyGraded) {
    where.gradeCompany = { not: null };
    where.grade = { gte: 8 };
  }

  const listings = await prisma.unifiedMarketListing.findMany({
    where,
    take: 100,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      source: true,
      cardName: true,
      setName: true,
      cardNumber: true,
      variant: true,
      grade: true,
      gradeCompany: true,
      priceCents: true,
      url: true,
    },
  });

  console.log(`Found ${listings.length} active listings`);

  const signals: MarketSignal[] = [];

  for (const listing of listings) {
    try {
      const signal = await enrichListingWithMarketData(listing);

      // Filter by criteria
      if (!signal) continue;
      if (signal.marketData.salesCount < minComps) continue;
      if (signal.marketData.avgVolume30d < minVolume) continue;

      const discount =
        ((signal.listedPrice - signal.marketData.fairValue) / signal.marketData.fairValue) * 100;
      if (discount > minDiscount) continue; // Not enough discount

      signals.push(signal);
    } catch (error) {
      console.error(`Error processing listing ${listing.id}:`, error);
    }
  }

  console.log(`✅ Generated ${signals.length} qualified signals`);
  return signals;
}

/**
 * Enrich a single listing with complete market data and TCG metadata
 */
async function enrichListingWithMarketData(
  listing: any
): Promise<MarketSignal | null> {
  if (!listing.cardName) return null;

  // Step 1: Find matching card in database
  const card = await findCardByListing(listing);

  // Step 2: Get comparable sales (comps)
  const comps = await getComparableSales(listing, card);
  if (comps.length === 0) return null;

  // Step 3: Calculate market metrics
  const fairValue = calculateWeightedMedian(comps.map((c) => c.soldPriceCents / 100));
  const salesCount = comps.length;
  const avgVolume30d = calculateMonthlyVolume(comps);
  const { priceChange7d, priceChange30d } = calculatePriceChange(comps);
  const lowestAvailable = Math.min(...comps.map((c) => c.soldPriceCents / 100));

  // Step 4: Calculate venue breakdown
  const venueBreakdown = calculateVenueBreakdown(comps);

  // Step 5: Get TCG metadata from canonical card
  const rarity: string | undefined = card?.rarity || card?.officialCard?.rarity || undefined;
  const releaseYear: number | undefined = extractReleaseYear(card?.canonicalSet);

  // Step 6: Build enriched MarketSignal
  const signal: MarketSignal = {
    // Card Identity
    cardName: listing.cardName,
    setName: listing.setName || card?.canonicalSet,

    // TCG Metadata
    rarity,
    cardType: inferCardType(listing.variant),
    setNumber: card?.cardNumber || listing.cardNumber || undefined,
    releaseYear,

    // Grading
    grade: listing.grade?.toString(),
    gradeCompany: listing.gradeCompany || undefined,

    // Special Attributes
    isFirstEdition: card?.officialCard?.variantFirstEdition || listing.variant?.toLowerCase().includes('1st edition') || false,
    isShadowless: card?.officialCard?.variantShadowless || listing.variant?.toLowerCase().includes('shadowless') || false,
    isReverseHolo: card?.officialCard?.variantReverse || listing.variant?.toLowerCase().includes('reverse') || false,

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
 * Find card in database matching the listing
 */
async function findCardByListing(listing: any) {
  if (!listing.cardName) return null;

  // Use canonical_cards instead of Card
  let card = await prisma.canonicalCard.findFirst({
    where: {
      canonicalName: {
        equals: listing.cardName,
        mode: 'insensitive',
      },
      ...(listing.setName && {
        canonicalSet: {
          equals: listing.setName,
          mode: 'insensitive',
        },
      }),
    },
    include: { officialCard: true },
  });

  // Fallback: fuzzy match on first word
  if (!card) {
    const firstWord = listing.cardName.toLowerCase().split(' ')[0];
    card = await prisma.canonicalCard.findFirst({
      where: {
        canonicalName: {
          contains: firstWord,
          mode: 'insensitive',
        },
      },
      include: { officialCard: true },
    });
  }

  return card;
}

/**
 * Get comparable sales for a listing
 */
async function getComparableSales(listing: any, card: any | null) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Use sale_records instead of CompSale
  const comps = await prisma.saleRecord.findMany({
    where: {
      ...(card && { canonicalCardId: card.id }),
      soldAt: { gte: thirtyDaysAgo },
      soldPriceCents: { gt: 0 },
      // Match grade if listing is graded
      ...(listing.gradeCompany &&
        listing.grade && {
          gradeCompany: listing.gradeCompany,
          grade: listing.grade,
        }),
    },
    orderBy: { soldAt: 'desc' },
    take: 50,
  });

  return comps;
}

/**
 * Calculate weighted median price
 */
function calculateWeightedMedian(prices: number[]): number {
  if (prices.length === 0) return 0;

  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate monthly volume from comps
 */
function calculateMonthlyVolume(comps: any[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentComps = comps.filter((c) => c.soldAt >= thirtyDaysAgo);
  return recentComps.length;
}

/**
 * Calculate price change % over 7d and 30d
 */
function calculatePriceChange(comps: any[]): { priceChange7d: number; priceChange30d: number } {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recent7d = comps.filter((c) => c.soldAt >= sevenDaysAgo);
  const recent30d = comps.filter((c) => c.soldAt >= thirtyDaysAgo);
  const older30d = comps.filter((c) => c.soldAt < thirtyDaysAgo);

  const avg7d = recent7d.length > 0 ? recent7d.reduce((sum, c) => sum + c.soldPriceCents, 0) / recent7d.length / 100 : 0;
  const avgRecent30d = recent30d.length > 0 ? recent30d.reduce((sum, c) => sum + c.soldPriceCents, 0) / recent30d.length / 100 : 0;
  const avgOlder30d = older30d.length > 0 ? older30d.reduce((sum, c) => sum + c.soldPriceCents, 0) / older30d.length / 100 : 0;

  const priceChange7d = avgOlder30d > 0 ? ((avg7d - avgOlder30d) / avgOlder30d) * 100 : 0;
  const priceChange30d = avgOlder30d > 0 ? ((avgRecent30d - avgOlder30d) / avgOlder30d) * 100 : 0;

  return { priceChange7d, priceChange30d };
}

/**
 * Calculate venue breakdown with weights
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
    venue,
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

  return undefined;
}

/**
 * Convert MarketSource enum to friendly venue name
 */
function marketSourceToVenue(source: MarketSource): string {
  switch (source) {
    case 'EBAY':
      return 'eBay';
    case 'TCGPLAYER':
      return 'TCGPlayer';
    case 'COLLECTOR_CRYPT':
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
 * Extract release year from set name
 */
function extractReleaseYear(setName?: string | null): number | undefined {
  if (!setName) return undefined;

  // Common set year patterns
  const setYears: Record<string, number> = {
    'Base Set': 1999,
    'Jungle': 1999,
    'Fossil': 1999,
    'Team Rocket': 2000,
    'Obsidian Flames': 2023,
    'Paldean Fates': 2024,
    'Stellar Crown': 2024,
    'Surging Sparks': 2024,
    'Prismatic Evolutions': 2025,
  };

  return setYears[setName];
}

/**
 * Get top N signals by conviction score (requires AI analysis)
 */
export async function getTopSignals(count: number = 10): Promise<MarketSignal[]> {
  const signals = await generateSignalsFromDatabase();

  // Sort by discount (most undervalued first)
  return signals
    .sort((a, b) => {
      const discountA = ((a.listedPrice - a.marketData.fairValue) / a.marketData.fairValue) * 100;
      const discountB = ((b.listedPrice - b.marketData.fairValue) / b.marketData.fairValue) * 100;
      return discountA - discountB; // Lower discount = better deal
    })
    .slice(0, count);
}
