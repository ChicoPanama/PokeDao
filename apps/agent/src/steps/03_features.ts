import { sharedPrisma as prisma } from '../../../../packages/shared/db.js';
import type { FreshListing } from './01_fetch.js';

export type ListingWithComps = FreshListing & {
  compMedianCents30d: number | null;
  compCount30d: number;
};

export async function attachComps(listings: FreshListing[]): Promise<ListingWithComps[]> {
  const results: ListingWithComps[] = [];
  if (!listings.length) return results;

  const cardIds = Array.from(new Set(listings.map((l) => l.cardId)));
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const comps = await prisma.compSale.findMany({
    where: { cardId: { in: cardIds }, soldAt: { gte: since } },
    select: { cardId: true, priceCents: true },
  });

  const grouped = new Map<string, number[]>();
  for (const c of comps) {
    const arr = grouped.get(c.cardId) ?? [];
    arr.push(c.priceCents);
    grouped.set(c.cardId, arr);
  }

  for (const l of listings) {
    const arr = (grouped.get(l.cardId) ?? []).sort((a, b) => a - b);
    const mid = arr.length ? arr[Math.floor(arr.length / 2)] : null;
    results.push({ ...l, compMedianCents30d: mid, compCount30d: arr.length });
  }

  return results;
}
