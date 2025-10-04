/**
 * Phygitals Data Mapper
 *
 * Converts Phygitals API responses to PokeDAO unified schema
 */

import type { ActiveListing, CompSale } from '@pokedao/core';
import type { PhygitalsListing, PhygitalsSale } from './client.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert Solana lamports to USD cents
 * 1 SOL = 1,000,000,000 lamports
 * Assumes current SOL price is already factored into USD price from API
 */
function lamportsToCents(lamports: number, solPriceUsd: number): number {
  const sol = lamports / 1_000_000_000;
  const usd = sol * solPriceUsd;
  return Math.round(usd * 100);
}

/**
 * Normalize grader name
 */
function normalizeGrader(grader: string | undefined): string {
  if (!grader) return 'RAW';

  const normalized = grader.toUpperCase().trim();

  if (normalized.includes('PSA')) return 'PSA';
  if (normalized.includes('BGS') || normalized.includes('BECKETT')) return 'BGS';
  if (normalized.includes('CGC')) return 'CGC';
  if (normalized.includes('ARS')) return 'ARS';
  if (normalized.includes('TAG')) return 'TAG';

  return normalized;
}

/**
 * Normalize grade
 */
function normalizeGrade(grade: string | number | undefined): string {
  if (!grade) return 'UNGRADED';

  const gradeStr = typeof grade === 'number' ? grade.toString() : grade;
  return gradeStr.trim();
}

/**
 * Extract card metadata from Phygitals listing name
 * Example: "2016 Pokemon XY Evolutions Charizard Holo PSA 10"
 */
function parseCardName(name: string): {
  cardName?: string;
  set?: string;
  year?: string;
  variant?: string;
} {
  const parts = name.split(' ');

  // Basic extraction - can be enhanced with more sophisticated parsing
  const hasHolo = name.toLowerCase().includes('holo');
  const hasReverse = name.toLowerCase().includes('reverse');
  const hasFirst = name.toLowerCase().includes('1st edition');

  let variant = 'BASE';
  if (hasHolo && hasReverse) variant = 'REVERSE_HOLO';
  else if (hasHolo) variant = 'HOLO';
  else if (hasReverse) variant = 'REVERSE';
  if (hasFirst) variant += '_1ST';

  return {
    cardName: name,
    variant,
  };
}

// ============================================================================
// MAPPERS
// ============================================================================

/**
 * Map Phygitals listing to ActiveListing
 */
export function mapPhygitalsListingToActiveListing(
  listing: PhygitalsListing
): ActiveListing {
  const { cardName, variant } = parseCardName(listing.name);

  // Price in USD (Phygitals API returns USD price directly)
  const priceCents = listing.price !== null ? Math.round(listing.price * 100) : 0;

  return {
    priceCents,
    currency: 'USD',
    currencyOrig: 'USD',
    fxRate: 1.0,
    timestamp: new Date(listing.updatedAt || listing.createdAt || new Date()),
    source: 'phygitals',
    sourceId: listing.id,
    seenAt: new Date(listing.updatedAt || listing.createdAt || new Date()),
    venue: 'phygitals',
    seller: listing.seller?.username || listing.seller?.wallet,
    condition: undefined, // Phygitals doesn't track condition (all graded)
    grader: normalizeGrader(listing.grader),
    grade: normalizeGrade(listing.grade),
    isActive: listing.listedStatus === 'listed',
  };
}

/**
 * Map Phygitals sale to CompSale
 */
export function mapPhygitalsSaleToCompSale(
  sale: PhygitalsSale
): CompSale {
  const priceCents = Math.round(sale.price * 100);

  return {
    priceCents,
    currency: 'USD',
    currencyOrig: 'USD',
    fxRate: 1.0,
    timestamp: new Date(sale.soldAt),
    source: 'phygitals',
    sourceId: sale.id,
    soldAt: new Date(sale.soldAt),
    venue: 'phygitals',
    condition: undefined,
    grader: undefined, // Sales data may not include grader info
    grade: undefined,
  };
}

/**
 * Map array of Phygitals listings to ActiveListings
 */
export function mapPhygitalsListingsToActiveListings(
  listings: PhygitalsListing[]
): ActiveListing[] {
  return listings.map(mapPhygitalsListingToActiveListing);
}

/**
 * Map array of Phygitals sales to CompSales
 */
export function mapPhygitalsSalesToCompSales(
  sales: PhygitalsSale[]
): CompSale[] {
  return sales.map(mapPhygitalsSaleToCompSale);
}
