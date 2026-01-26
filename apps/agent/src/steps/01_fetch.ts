import { sharedPrisma as prisma } from '../../../../packages/shared/db.js';

export type FreshListing = {
  id: string;
  cardId: string;
  source: string;
  priceCents: number;
  shippingCents: number | null;
  url?: string | null;
  seenAt: Date;
};

export async function findFreshListings({
  maxAgeMin = Number(process.env.OPP_MAX_LISTING_AGE_MIN || 60),
} = {}): Promise<FreshListing[]> {
  const since = new Date(Date.now() - maxAgeMin * 60_000);
  const rows = await prisma.listing.findMany({
    where: { scrapedAt: { gte: since }, isActive: true },
    select: {
      id: true,
      cardId: true,
      source: true,
      price: true,
      priceUsd: true,
      url: true,
      scrapedAt: true,
    },
    take: 2000,
    orderBy: { scrapedAt: 'desc' },
  });
  return rows
    .filter((r): r is typeof r & { cardId: string } => !!r.cardId)
    .map((r) => ({
      id: r.id,
      cardId: r.cardId,
      source: r.source,
      priceCents: Math.round((r.priceUsd ?? r.price) * 100),
      shippingCents: null,
      url: r.url,
      seenAt: r.scrapedAt,
    }));
}
