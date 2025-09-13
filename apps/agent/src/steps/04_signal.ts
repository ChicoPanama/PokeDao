import { getProfile } from '../../../../packages/shared/fees.js';
import type { ListingWithComps } from './03_features.js';

export type OpportunityCandidate = ListingWithComps & {
  sellCompCents: number;
  buyNetCents: number;
  sellNetCents: number;
  netSpreadBps: number;
  expectedProfitCents: number;
  confidence: number;
  rationale: string;
  sourceSell: string;
};

export function detectCandidates(rows: ListingWithComps[]): OpportunityCandidate[] {
  const minSpreadBps = Number(process.env.OPP_MIN_NET_SPREAD_BPS || 1500);
  const minSales = Number(process.env.OPP_MIN_30D_SALES || 3);
  const out: OpportunityCandidate[] = [];

  for (const r of rows) {
  if (!r.compMedianCents30d) continue;
  if (r.compCount30d < minSales) continue;

    const buyP = getProfile(r.source);
    const sellP = getProfile('EBAY');

    const buyFees = Math.round(r.priceCents * buyP.buyFeeRate);
    const buyShip = r.shippingCents ?? buyP.avgInboundShipCents;
    const buyNet  = r.priceCents + buyFees + (buyShip ?? 0);

    const sellFees = Math.round(r.compMedianCents30d * sellP.sellFeeRate);
    const sellShip = sellP.avgOutboundShipCents;
    const sellNet  = r.compMedianCents30d - sellFees - sellShip;

    const profit   = sellNet - buyNet;
    const spreadBp = Math.round((profit / buyNet) * 10_000);

  if (!Number.isFinite(buyNet) || buyNet <= 0) continue;
  if (spreadBp >= minSpreadBps) {
      const confidence = Math.min(0.95, 0.5 + 0.1 * Math.log10(Math.max(1, r.compCount30d)));
      const rationale  = `Median 30d comps $${(r.compMedianCents30d/100).toFixed(2)} vs listing $${(r.priceCents/100).toFixed(2)} + fees/ship; ${r.compCount30d} sales.`;
      out.push({
        ...r,
        sellCompCents: r.compMedianCents30d,
        buyNetCents: buyNet,
        sellNetCents: sellNet,
        netSpreadBps: spreadBp,
        expectedProfitCents: profit,
        confidence,
        rationale,
        sourceSell: 'EBAY',
      });
  }
  }

  // minimal logging kept for operators
  console.log(`[info][04_signal] candidates=${out.length}`);
  return out;
}
