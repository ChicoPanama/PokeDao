import { sharedPrisma as prisma } from '../../../../packages/shared/db';
import type { OpportunityCandidate } from './04_signal';

export async function validateAndPersist(cands: OpportunityCandidate[]) {
  const minConf = Number(process.env.OPP_MIN_CONFIDENCE || 0.6);

  const kept: OpportunityCandidate[] = [];
  for (const c of cands) {
    if (c.confidence < minConf) continue;

    // Freshness re-check
    const listing = await prisma.marketListing.findUnique({ where: { id: c.id }, select: { isActive: true, seenAt: true } });
    if (!listing || listing.isActive === false) continue;

    kept.push(c);
  }

  for (const k of kept) {
    try {
      await prisma.opportunity.create({
        data: {
          cardId: k.cardId,
          listingId: k.id,
          sourceBuy: k.source,
          sourceSell: k.sourceSell,
          buyPriceCents: k.priceCents,
          buyShippingCents: k.shippingCents ?? 0,
          buyFeesCents: Math.max(0, k.buyNetCents - k.priceCents - (k.shippingCents ?? 0)),
          sellCompCents: k.sellCompCents,
          // Approximate breakdown (sellNet = comp - fees - ship)
          sellFeesCents: Math.max(0, k.sellCompCents - k.sellNetCents - 549),
          sellShippingCents: 549,
          expectedProfitCents: k.expectedProfitCents,
          netSpreadBps: k.netSpreadBps,
          confidence: k.confidence,
          rationale: k.rationale,
          status: 'PENDING',
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('Unique constraint')) throw e;
    }
  }

  return kept;
}
