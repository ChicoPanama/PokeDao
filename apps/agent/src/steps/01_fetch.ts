import { sharedPrisma as prisma } from '../../../../packages/shared/db';

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
  const since = new Date(Date.now() - maxAgeMin * 60_000);
  // Use MarketListing.seenAt as freshness indicator
  const rows = await prisma.marketListing.findMany({
    where: { seenAt: { gte: since }, isActive: true },
    select: {
      id: true,
      cardId: true,
      source: true,
      priceCents: true,
      url: true,
      seenAt: true,
    },
    take: 2000,
    orderBy: { seenAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    cardId: r.cardId,
    source: r.source,
    priceCents: r.priceCents,
    shippingCents: null, // unknown at this layer; fee profile provides default
    url: r.url,
    seenAt: r.seenAt,
  }));
}
