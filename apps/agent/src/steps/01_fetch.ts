import { getSharedPrisma } from '../../../../packages/shared/db.js';

export type FreshListing = {
  id: string; // MarketListing.id
  cardId: string; // normalized card id
  source: string; // 'EBAY' | 'TCGPLAYER' | ...
  priceCents: number;
  shippingCents: number | null;
  url?: string | null;
  seenAt: Date;
};

export async function findFreshListings({
  maxAgeMin = Number(process.env.OPP_MAX_LISTING_AGE_MIN || 60),
} = {}): Promise<FreshListing[]> {
  const prisma = await getSharedPrisma();
  const since = new Date(Date.now() - maxAgeMin * 60_000);
  // Use MarketListing.seenAt or lastSeenAt as freshness indicator
  const rows = await prisma.marketListing.findMany({
    where: {
      OR: [
        { seenAt: { gte: since } },
        { lastSeenAt: { gte: since } },
      ],
      isActive: true,
      canonicalCardId: { not: null },
      priceCents: { not: null },
    },
    select: {
      id: true,
      canonicalCardId: true,
      source: true,
      priceCents: true,
      url: true,
      seenAt: true,
      lastSeenAt: true,
    },
    take: 2000,
    orderBy: { lastSeenAt: 'desc' },
  });
  return rows
    .filter((r) => r.canonicalCardId && r.priceCents)
    .map((r) => ({
      id: r.id,
      cardId: r.canonicalCardId!,
      source: r.source,
      priceCents: r.priceCents!,
      shippingCents: null, // unknown at this layer; fee profile provides default
      url: r.url,
      seenAt: r.seenAt ?? r.lastSeenAt,
    }));
}
