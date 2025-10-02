/**
 * CompSale repository
 */

import { db } from '../client.js';
import { CompSale as CompSaleType } from '@pokedao/core/types';

/**
 * Get all comps for a variant key
 */
export async function getCompsByVariantKey(
  variantKey: string
): Promise<CompSaleType[]> {
  const card = await db.card.findFirst({
    where: { variantKey },
  });

  if (!card) return [];

  const comps = await db.compSale.findMany({
    where: { cardId: card.id },
    orderBy: { soldAt: 'desc' },
  });

  return comps.map(mapComp);
}

/**
 * Get comps for a card ID
 */
export async function getCompsByCardId(
  cardId: string
): Promise<CompSaleType[]> {
  const comps = await db.compSale.findMany({
    where: { cardId },
    orderBy: { soldAt: 'desc' },
  });

  return comps.map(mapComp);
}

/**
 * Get recent comps (last N days)
 */
export async function getRecentComps(
  variantKey: string,
  days: number = 90
): Promise<CompSaleType[]> {
  const card = await db.card.findFirst({
    where: { variantKey },
  });

  if (!card) return [];

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const comps = await db.compSale.findMany({
    where: {
      cardId: card.id,
      soldAt: { gte: cutoff },
    },
    orderBy: { soldAt: 'desc' },
  });

  return comps.map(mapComp);
}

/**
 * Map Prisma CompSale to domain type
 */
function mapComp(comp: any): CompSaleType {
  return {
    priceCents: comp.priceCents || comp.priceCentsUsd || 0,
    currency: comp.currency || 'USD',
    currencyOrig: comp.currency || 'USD',
    fxRate: 1.0, // TODO: Extract if stored
    timestamp: comp.soldAt,
    soldAt: comp.soldAt,
    source: comp.source,
    sourceId: comp.externalId || comp.id,
    venue: comp.source, // Use source as venue if not stored separately
    condition: undefined,
    grader: undefined,
    grade: undefined,
  };
}
