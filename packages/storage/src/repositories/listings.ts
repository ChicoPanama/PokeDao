/**
 * MarketListing repository
 */

import { db } from '../client.js';
import { ActiveListing } from '@pokedao/core/types';

/**
 * Get all active listings for a variant key
 */
export async function getListingsByVariantKey(
  variantKey: string
): Promise<ActiveListing[]> {
  const card = await db.card.findFirst({
    where: { variantKey },
  });

  if (!card) return [];

  const listings = await db.marketListing.findMany({
    where: {
      cardId: card.id,
      isActive: true,
    },
    orderBy: { seenAt: 'desc' },
  });

  return listings.map(mapListing);
}

/**
 * Get listings by card ID
 */
export async function getListingsByCardId(
  cardId: string
): Promise<ActiveListing[]> {
  const listings = await db.marketListing.findMany({
    where: {
      cardId,
      isActive: true,
    },
    orderBy: { seenAt: 'desc' },
  });

  return listings.map(mapListing);
}

/**
 * Get a specific listing
 */
export async function getListingById(
  id: string
): Promise<ActiveListing | null> {
  const listing = await db.marketListing.findUnique({
    where: { id },
  });

  return listing ? mapListing(listing) : null;
}

/**
 * Map Prisma MarketListing to domain type
 */
function mapListing(listing: any): ActiveListing {
  return {
    priceCents: listing.priceCents || listing.priceCentsUsd || 0,
    currency: listing.currency || 'USD',
    currencyOrig: listing.currency || 'USD',
    fxRate: 1.0,
    timestamp: listing.seenAt,
    seenAt: listing.seenAt,
    source: listing.source,
    sourceId: listing.sourceId,
    venue: listing.source, // Use source as venue
    seller: undefined,
    condition: listing.condition,
    grader: listing.grade ? 'PSA' : undefined, // TODO: Extract grader if stored
    grade: listing.grade,
    isActive: listing.isActive,
  };
}
