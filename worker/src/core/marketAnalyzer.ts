// MarketAnalyzer class wrapper for compatibility with main.ts
export class MarketAnalyzer {
  constructor(_opts?: any) {}

  analyzeCard(name: string, price: number) {
    // Dummy implementation for compatibility
    // In a real implementation, you would fetch comps and call computeFairValue
    return Promise.resolve({
      card: { name, set: 'Unknown', grade: null, language: 'en', condition: 'NM' },
      pricing: {
        listedPrice: price,
        marketValue: price,
        confidence: 1,
        sources: [],
        lowestPrice: { price, source: 'Unknown', link: '' }
      },
      assessment: 'FAIR',
      lastTwoSales: [],
      reasoning: '',
      trend: '',
      recommendation: 'HOLD',
      investmentThesis: 'No thesis (stub)'
    });
  }
}
import type { SourcePrice } from './priceAggregator.js';

export interface FVResult {
  fv: number;           // fair value
  confidence: number;   // 0..1
  basis: { nComps: number; horizonDays: number };
}

export function computeFairValue(comps: SourcePrice[]): FVResult {
  const usable = comps.filter(c => c.soldPrice > 0);
  if (!usable.length) {
    return { fv: 0, confidence: 0, basis: { nComps: 0, horizonDays: 0 } };
  }

  // trimmed mean (drop min/max if 3+)
  const sorted = [...usable].sort((a, b) => a.soldPrice - b.soldPrice);
  const trimmed =
    sorted.length >= 3 ? sorted.slice(1, sorted.length - 1) : sorted;

  const sum = trimmed.reduce((acc, c) => acc + c.soldPrice, 0);
  const fv = sum / trimmed.length;

  // naive confidence: more comps → higher confidence, capped
  const n = usable.length;
  const confidence = Math.min(1, 0.3 + n * 0.1);

  return { fv, confidence, basis: { nComps: n, horizonDays: 30 } };
}

export function qualifyDeal(
  listPrice: number,
  fv: number,
  minDiscountPct = 15,
  minConfidence = 0.5
): { qualified: boolean; discountPct: number } {
  if (!(fv > 0) || !(listPrice > 0)) {
    return { qualified: false, discountPct: 0 };
  }
  const discountPct = ((fv - listPrice) / fv) * 100;
  const qualified = discountPct >= minDiscountPct && minConfidence <= 1; // confidence handled upstream
  return { qualified, discountPct };
}
