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
  sourceSell: string; // choose best exit (start with EBAY)
};

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
