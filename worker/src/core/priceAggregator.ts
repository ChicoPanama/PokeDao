import { NormalizedCardQuery } from './cardSearchEngine.js';

export interface SourcePrice {
  source: 'ebay' | 'pricecharting' | 'other';
  soldPrice: number;
  currency: string; // "USD"
  soldAt: string;   // ISO date
  meta?: Record<string, unknown>;
}

export type PriceAggregatorResult = {
  comps: SourcePrice[];
};

function todayIso(): string {
  return new Date().toISOString();
}

// TEMP: returns mock comps so the worker builds & tests can run.
// Replace with real eBay/PriceCharting clients later.
export async function getComparableSales(
  _q: NormalizedCardQuery
): Promise<PriceAggregatorResult> {
  return {
    comps: [
      { source: 'ebay', soldPrice: 120.0, currency: 'USD', soldAt: todayIso() },
      { source: 'ebay', soldPrice: 135.0, currency: 'USD', soldAt: todayIso() },
      { source: 'pricecharting', soldPrice: 128.5, currency: 'USD', soldAt: todayIso() },
    ],
  };
}

// Small helper for future steps (filtering, currency, outliers)
export function sanitizeComps(comps: SourcePrice[]): SourcePrice[] {
  return comps
    .filter(c => Number.isFinite(c.soldPrice) && c.soldPrice > 0)
    .map(c => ({ ...c, currency: c.currency || 'USD' }));
}
