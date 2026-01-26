import { sharedPrisma as prisma } from '../../../../packages/shared/db.js';
import type { OpportunityCandidate } from './04_signal.js';

export async function validateAndPersist(cands: OpportunityCandidate[]) {
  const minConf = Number(process.env.OPP_MIN_CONFIDENCE || 0.6);

  const kept: OpportunityCandidate[] = [];
  for (const c of cands) {
    if (c.confidence < minConf) continue;

    // Freshness re-check
    const listing = await prisma.listing.findUnique({ where: { id: c.id }, select: { isActive: true, scrapedAt: true } });
    if (!listing || listing.isActive === false) continue;

    kept.push(c);
  }

  for (const k of kept) {
    try {
      const discount = k.sellCompCents > 0
        ? ((k.sellCompCents - k.priceCents) / k.sellCompCents) * 100
        : 0;

      await prisma.opportunity.create({
        data: {
          cardId: k.cardId,
          cardName: k.cardId, // Will be enriched by processor
          listingId: k.id,
          listingPrice: k.priceCents / 100,
          fairValue: k.sellCompCents / 100,
          discount,
          thesis: k.rationale,
          thesisType: 'TEMPLATE',
          recommendation: k.confidence >= 0.7 ? 'BUY' : 'WATCH',
          source: k.source,
          url: k.url || '',
          status: 'PENDING',
          signals: {
            netSpreadBps: k.netSpreadBps,
            expectedProfitCents: k.expectedProfitCents,
            confidence: k.confidence,
            sourceSell: k.sourceSell,
          },
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('Unique constraint')) throw e;
    }
  }

  return kept;
}
