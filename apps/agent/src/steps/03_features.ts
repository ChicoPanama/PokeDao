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
    // Calculate median correctly for both odd and even-length arrays
    let mid: number | null = null;
    if (arr.length > 0) {
      const midIndex = Math.floor(arr.length / 2);
      if (arr.length % 2 === 0) {
        // Even length: average the two middle values
        mid = Math.round((arr[midIndex - 1] + arr[midIndex]) / 2);
      } else {
        // Odd length: take the middle value
        mid = arr[midIndex];
      }
    }
    results.push({ ...l, compMedianCents30d: mid, compCount30d: arr.length });
  }

  return results;
}
