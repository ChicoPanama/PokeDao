import { sharedPrisma as db } from '../../../../packages/shared/db.js';
import type { FreshListing } from './01_fetch.js';

export type ListingWithComps = FreshListing & {
  compMedianCents30d: number | null;
  compCount30d: number;
};

export async function attachComps(listings: FreshListing[]): Promise<ListingWithComps[]> {
  const cardIds = [...new Set(listings.map(l => l.cardId))];
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // Pull comps for all relevant cards
  const comps = await db.compSale.findMany({
    where: { cardId: { in: cardIds }, soldAt: { gte: since } },
    select: { cardId: true, priceCents: true, soldAt: true },
  });

  const grouped = new Map<string, number[]>();
  for (const c of comps) {
    if (!grouped.has(c.cardId)) grouped.set(c.cardId, []);
    grouped.get(c.cardId)!.push(c.priceCents);
  }

  const out: ListingWithComps[] = listings.map(l => {
    const arr = (grouped.get(l.cardId) || []).sort((a, b) => a - b);
    const mid = arr.length ? arr[Math.floor(arr.length / 2)] : null;
    return { ...l, compMedianCents30d: mid, compCount30d: arr.length };
  });

  if (process.env.AGENT_DEBUG === 'true') {
    const withAny = out.filter(o => o.compCount30d > 0).length;
    console.log(`[dbg][03_features] listings=${listings.length} cards=${cardIds.length} compsRows=${comps.length} withComps=${withAny}`);
    const sample = out.slice(0, 3).map(o => ({
      id: o.id, cardId: o.cardId, compCount: o.compCount30d, median: o.compMedianCents30d
    }));
    console.log('[dbg][03_features] sample=', sample);
  }

  return out;
}
