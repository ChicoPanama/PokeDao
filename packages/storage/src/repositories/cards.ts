/**
 * Card repository
 */

import { db } from '../client.js';

/**
 * Get card by variant key
 */
export async function getCardByVariantKey(variantKey: string) {
  return db.card.findFirst({
    where: { variantKey },
  });
}

/**
 * Get card by ID
 */
export async function getCardById(id: string) {
  return db.card.findUnique({
    where: { id },
  });
}

/**
 * Get all cards with recent activity
 */
export async function getCardsWithRecentActivity(sinceDays: number = 7) {
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  return db.card.findMany({
    where: {
      OR: [
        {
          MarketListing: {
            some: {
              seenAt: { gte: cutoff },
            },
          },
        },
        {
          compSales: {
            some: {
              soldAt: { gte: cutoff },
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          MarketListing: true,
          compSales: true,
        },
      },
    },
  });
}

/**
 * Get cards with missing features
 */
export async function getCardsNeedingFeatures() {
  return db.card.findMany({
    where: {
      features: {
        none: {},
      },
      OR: [
        {
          MarketListing: {
            some: {},
          },
        },
        {
          compSales: {
            some: {},
          },
        },
      ],
    },
  });
}
