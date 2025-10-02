/**
 * Map JustTCG data to PokeDAO domain types
 */

import type { CompSale, ActiveListing } from '../../../core/src/types.js';
import { toUsdCents } from '../../../core/src/currency.js';
import type { JustTCGCard, JustTCGVariant } from './client.js';

/**
 * Map JustTCG variant to CompSale
 * Use price history as sold comps
 */
export function mapToCompSales(
  card: JustTCGCard,
  variant: JustTCGVariant
): CompSale[] {
  if (!variant.priceHistory || variant.priceHistory.length === 0) {
    return [];
  }

  return variant.priceHistory.map(history => ({
    priceCents: toUsdCents(history.price, 'USD'),
    currency: 'USD',
    currencyOrig: 'USD',
    fxRate: 1.0,
    timestamp: new Date(history.date),
    soldAt: new Date(history.date),
    source: 'justtcg',
    sourceId: `${card.id}-${variant.id}-${history.date}`,
    venue: 'tcgplayer', // JustTCG aggregates TCGPlayer data
    condition: normalizeCondition(variant.condition),
    grader: undefined, // JustTCG doesn't track grading
    grade: undefined,
  }));
}

/**
 * Map JustTCG variant to ActiveListing
 * Use current price as active listing
 */
export function mapToActiveListing(
  card: JustTCGCard,
  variant: JustTCGVariant
): ActiveListing | null {
  if (!variant.price) {
    return null;
  }

  return {
    priceCents: toUsdCents(variant.price, 'USD'),
    currency: 'USD',
    currencyOrig: 'USD',
    fxRate: 1.0,
    timestamp: new Date(),
    seenAt: new Date(),
    source: 'justtcg',
    sourceId: `${card.id}-${variant.id}`,
    venue: 'tcgplayer',
    seller: undefined,
    condition: normalizeCondition(variant.condition),
    grader: undefined,
    grade: undefined,
    isActive: true,
  };
}

/**
 * Generate variant key from JustTCG card
 */
export function generateVariantKey(card: JustTCGCard, variant: JustTCGVariant): string | null {
  // JustTCG format: set name, card number, variant details
  const set = card.set?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN';
  const number = card.number || '0';
  const variantType = detectVariant(card, variant);
  const language = variant.language?.toUpperCase() || 'EN';

  return `${set}|${number}|${variantType}|${language}|RAW|UNGRADED`;
}

/**
 * Detect variant type from card and variant data
 */
function detectVariant(card: JustTCGCard, variant: JustTCGVariant): string {
  const name = card.name?.toLowerCase() || '';
  const printing = variant.printing?.toLowerCase() || '';

  // Check for special variants
  if (name.includes('rainbow') || printing.includes('rainbow')) return 'RAINBOW';
  if (name.includes('gold') || printing.includes('gold')) return 'GOLD';
  if (name.includes('full art') || printing.includes('full')) return 'FULL_ART';
  if (name.includes('alternate art') || printing.includes('alt')) return 'ALT_ART';
  if (name.includes('holo') || printing.includes('holo')) return 'HOLO';
  if (name.includes('reverse') || printing.includes('reverse')) return 'REVERSE';

  return 'BASE';
}

/**
 * Normalize JustTCG condition to standard format
 */
function normalizeCondition(condition: string): string {
  const c = condition.toLowerCase();

  if (c.includes('near mint') || c.includes('nm')) return 'NM';
  if (c.includes('lightly played') || c.includes('lp')) return 'LP';
  if (c.includes('moderately played') || c.includes('mp')) return 'MP';
  if (c.includes('heavily played') || c.includes('hp')) return 'HP';
  if (c.includes('damaged')) return 'DMG';

  return condition.toUpperCase();
}

/**
 * Extract all comps and listings from a JustTCG card
 */
export function extractCardData(card: JustTCGCard): {
  comps: CompSale[];
  listings: ActiveListing[];
  variantKeys: Map<string, { comp: CompSale | null; listing: ActiveListing | null }>;
} {
  const comps: CompSale[] = [];
  const listings: ActiveListing[] = [];
  const variantKeys = new Map<string, { comp: CompSale | null; listing: ActiveListing | null }>();

  for (const variant of card.variants) {
    const variantKey = generateVariantKey(card, variant);

    // Extract comps from price history
    const variantComps = mapToCompSales(card, variant);
    comps.push(...variantComps);

    // Extract current listing
    const listing = mapToActiveListing(card, variant);
    if (listing) {
      listings.push(listing);
    }

    // Store variant key mapping
    if (variantKey) {
      variantKeys.set(variantKey, {
        comp: variantComps.length > 0 ? variantComps[variantComps.length - 1] : null,
        listing,
      });
    }
  }

  return { comps, listings, variantKeys };
}
