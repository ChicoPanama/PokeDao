import { getProfile } from '../../../../packages/shared/fees.js';
import type { ListingWithComps } from './03_features.js';
import { generateThesis, isAIThesisEnabled, type AIThesis } from '../lib/ai-thesis.js';

export type OpportunityCandidate = ListingWithComps & {
  sellCompCents: number;
  buyNetCents: number;
  sellNetCents: number;
  netSpreadBps: number;
  expectedProfitCents: number;
  confidence: number;
  rationale: string;
  sourceSell: string; // choose best exit (start with EBAY)
  // AI-enhanced fields
  aiThesis?: AIThesis;
};

/**
 * Detect arbitrage candidates from listings with comparable sales data
 * This is the synchronous version that generates static rationale only
 */
export function detectCandidates(rows: ListingWithComps[]): OpportunityCandidate[] {
  const minSpreadBps = Number(process.env.OPP_MIN_NET_SPREAD_BPS || 1500);
  const minSales = Number(process.env.OPP_MIN_30D_SALES || 3);

  const out: OpportunityCandidate[] = [];
  for (const r of rows) {
    if (!r.compMedianCents30d || r.compCount30d < minSales) continue;

    const buyProfile = getProfile(r.source);
    const sellProfile = getProfile('EBAY'); // simple default; can get smarter later

    const inboundShip = r.shippingCents ?? buyProfile.avgInboundShipCents;
    const buyFees = Math.round(r.priceCents * buyProfile.buyFeeRate);
    const buyNet = r.priceCents + buyFees + (inboundShip ?? 0);

    const sellFees = Math.round(r.compMedianCents30d * sellProfile.sellFeeRate);
    const sellShip = sellProfile.avgOutboundShipCents;
    const sellNet = r.compMedianCents30d - sellFees - sellShip;

    const profit = sellNet - buyNet;
    const spreadBps = Math.round((profit / Math.max(1, buyNet)) * 10_000);

    if (spreadBps >= minSpreadBps) {
      const confidence = Math.min(0.95, 0.5 + 0.1 * Math.log10(Math.max(1, r.compCount30d)));
      const rationale = `Median 30d comps ${(r.compMedianCents30d / 100).toFixed(2)} vs listing ${(r.priceCents / 100).toFixed(2)} + fees/ship; ${r.compCount30d} sales last 30d.`;
      out.push({
        ...r,
        sellCompCents: r.compMedianCents30d,
        buyNetCents: buyNet,
        sellNetCents: sellNet,
        netSpreadBps: spreadBps,
        expectedProfitCents: profit,
        confidence,
        rationale,
        sourceSell: 'EBAY',
      });
    }
  }
  return out;
}

/**
 * Detect candidates with AI-powered thesis generation
 * Enriches candidates with investment thesis, risk factors, and catalysts
 */
export async function detectCandidatesWithAI(rows: ListingWithComps[]): Promise<OpportunityCandidate[]> {
  // First detect candidates with static rationale
  const candidates = detectCandidates(rows);

  // If AI thesis is not enabled, return as-is
  if (!isAIThesisEnabled()) {
    console.log('[SIGNAL] AI thesis disabled, using static rationale');
    return candidates;
  }

  // Enrich top candidates with AI thesis (limit to top 10 to save API costs)
  const topCandidates = candidates
    .sort((a, b) => b.netSpreadBps - a.netSpreadBps)
    .slice(0, 10);

  console.log(`[SIGNAL] Generating AI thesis for ${topCandidates.length} candidates...`);

  // Generate AI thesis for each candidate
  const enrichedCandidates = await Promise.all(
    topCandidates.map(async (candidate) => {
      try {
        const aiThesis = await generateThesis({
          cardName: candidate.cardId, // Use cardId as fallback card identifier
          priceCents: candidate.priceCents,
          fairValueCents: candidate.compMedianCents30d,
          compCount: candidate.compCount30d,
          spreadBps: candidate.netSpreadBps,
        });

        // Update rationale with AI thesis if generated
        const rationale = aiThesis.source === 'ai'
          ? aiThesis.thesis
          : candidate.rationale;

        // Update confidence if AI provides higher conviction
        const confidence = aiThesis.source === 'ai'
          ? Math.max(candidate.confidence, aiThesis.confidence / 100)
          : candidate.confidence;

        return {
          ...candidate,
          rationale,
          confidence,
          aiThesis,
        };
      } catch (error) {
        console.warn(`[SIGNAL] AI thesis failed for ${candidate.cardId}:`, error instanceof Error ? error.message : 'Unknown error');
        return candidate;
      }
    })
  );

  // Combine AI-enriched top candidates with remaining candidates
  const remainingCandidates = candidates.slice(10);
  return [...enrichedCandidates, ...remainingCandidates];
}
