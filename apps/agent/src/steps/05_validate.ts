import { getSharedPrisma } from '../../../../packages/shared/db.js';
import type { OpportunityCandidate } from './04_signal.js';

export async function validateAndPersist(cands: OpportunityCandidate[]) {
  const prisma = await getSharedPrisma();
  const minConf = Number(process.env.OPP_MIN_CONFIDENCE || 0.6);

  const kept: OpportunityCandidate[] = [];
  for (const c of cands) {
    if (c.confidence < minConf) continue;

    // Freshness re-check
    const listing = await prisma.marketListing.findUnique({
      where: { id: c.id },
      select: { isActive: true, lastSeenAt: true }
    });
    if (!listing || listing.isActive === false) continue;

    kept.push(c);
  }

  // P1-5 Fix: Wrap all opportunity creates in a transaction for atomicity
  // Note: Opportunity.cardId references Card, but listings use CanonicalCard.
  // Skip persistence if schema doesn't support this mapping.
  let persistedCount = 0;
  const skipPersist = process.env.SKIP_OPPORTUNITY_PERSIST === 'true';

  if (!skipPersist && kept.length > 0) {
    try {
      await prisma.$transaction(async (tx: any) => {
        for (const k of kept) {
          try {
            // Generate a unique ID for the opportunity
            const oppId = `opp_${k.id}_${Date.now()}`;
            await tx.opportunity.create({
              data: {
                id: oppId,
                cardId: k.cardId,
                listingId: k.id,
                sourceBuy: k.source,
                sourceSell: k.sourceSell,
                buyPriceCents: k.priceCents,
                buyShippingCents: k.shippingCents ?? 0,
                buyFeesCents: Math.max(0, k.buyNetCents - k.priceCents - (k.shippingCents ?? 0)),
                sellCompCents: k.sellCompCents,
                sellFeesCents: Math.max(0, k.sellCompCents - k.sellNetCents - 549),
                sellShippingCents: 549,
                expectedProfitCents: k.expectedProfitCents,
                netSpreadBps: k.netSpreadBps,
                confidence: k.confidence,
                rationale: k.rationale,
                status: 'PENDING',
              },
            });
            persistedCount++;
          } catch (e: any) {
            const msg = String(e?.message || '');
            if (msg.includes('Unique constraint') || msg.includes('Foreign key constraint')) {
              console.log(`[validate] Skipping opportunity for listing ${k.id}: ${msg.slice(0, 100)}`);
            } else {
              throw e;
            }
          }
        }
      });
    } catch (e: any) {
      console.log(`[validate] Transaction failed, opportunities not persisted: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`[validate] Validated ${kept.length} candidates, persisted ${persistedCount}`);
  return kept;
}
