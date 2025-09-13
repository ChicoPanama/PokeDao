import { sharedPrisma as db } from '../../../../packages/shared/db.js';
import type { OpportunityCandidate } from './04_signal.js';

export async function validateAndPersist(cands: OpportunityCandidate[]) {
  const minConf = Number(process.env.OPP_MIN_CONFIDENCE || 0.6);
  const kept: OpportunityCandidate[] = [];

  for (const c of cands) {
    if (c.confidence < minConf) {
      if (process.env.AGENT_DEBUG === 'true') console.log(`[dbg][05_validate] drop low-conf cardId=${c.cardId} conf=${c.confidence} < ${minConf}`);
      continue;
    }

    const listing = await db.marketListing.findUnique({
      where: { id: c.id },
      select: { isActive: true, seenAt: true }
    }).catch(() => null);

    if (listing && listing.isActive === false) continue;

    kept.push(c);
  }

  let created = 0;
  for (const k of kept) {
    try {
      await db.opportunity.create({
        data: {
          cardId: k.cardId,
          listingId: k.id,
          sourceBuy: k.source,
          sourceSell: k.sourceSell,
          buyPriceCents: k.priceCents,
          buyShippingCents: k.shippingCents ?? 0,
          buyFeesCents: k.buyNetCents - k.priceCents - (k.shippingCents ?? 0),
          sellCompCents: k.sellCompCents,
          sellFeesCents: Math.max(0, k.sellCompCents - k.sellNetCents - 0), // rough; already netted
          sellShippingCents: 0,
          expectedProfitCents: k.expectedProfitCents,
          netSpreadBps: k.netSpreadBps,
          confidence: k.confidence,
          rationale: k.rationale,
          status: 'PENDING',
        }
      });
      created++;
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('Unique constraint')) {
        console.warn('[warn][05_validate] create failed:', msg);
      } else if (process.env.AGENT_DEBUG === 'true') {
        console.log('[dbg][05_validate] duplicate opportunity ignored');
      }
    }
  }

  if (process.env.AGENT_DEBUG === 'true') {
    console.log(`[dbg][05_validate] kept=${kept.length} created=${created}`);
  }
  return kept;
}
