import { sharedPrisma as db } from '../../../../packages/shared/db.js';

export type FreshListing = {
  id: string;
  cardId: string;
  source: string;
  priceCents: number;
  shippingCents?: number | null;
  url?: string | null;
  effectiveAt: Date;
  isActive?: boolean | null;
};

export async function findFreshListings(
  { maxAgeMin = Number(process.env.OPP_MAX_LISTING_AGE_MIN || 60) } = {}
): Promise<FreshListing[]> {
  const since = new Date(Date.now() - maxAgeMin * 60_000);

  // Use seenAt (schema has seenAt) as the freshness indicator
  const rows = await db.marketListing.findMany({
    where: { seenAt: { gte: since }, isActive: true },
    select: { id: true, cardId: true, source: true, priceCents: true, url: true, seenAt: true, isActive: true },
    orderBy: [{ seenAt: 'desc' }],
    take: 2000,
  });

  const mapped: FreshListing[] = rows.map((r: any) => ({
    id: r.id,
    cardId: r.cardId,
    source: r.source,
    priceCents: r.priceCents,
  shippingCents: null,
    url: r.url,
    effectiveAt: r.seenAt,
    isActive: r.isActive ?? true,
  })).filter(l => l.cardId);

  // Debugging removed in cleanup; keep function behavior identical.

  return mapped.filter(m => m.isActive !== false);
}
