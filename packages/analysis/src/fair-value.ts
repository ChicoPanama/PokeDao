/**
 * True Fair Value (TFV) Calculator
 *
 * Computes fee-adjusted, time-decayed, venue-weighted fair value from comps
 */

import {
  CompSale,
  TFVResult,
  VENUE_TRUST_SCORES,
} from '@pokedao/core/types';
import {
  timeDecayWeight,
  weightedMedian,
  ageDays,
} from '@pokedao/core/time-decay';
import { adjustCompForFees } from '@pokedao/core/fees';
import { centsToUsd } from '@pokedao/core/currency';

export interface TFVOptions {
  halfLifeDays?: number; // Time decay half-life (default 30)
  minComps?: number; // Minimum comps required (default 3)
  maxAgeDays?: number; // Max age of comps to consider (default 180)
  applyFees?: boolean; // Apply fee adjustments (default true)
  applyVenueTrust?: boolean; // Apply venue trust weights (default true)
}

const DEFAULT_TFV_OPTIONS: Required<TFVOptions> = {
  halfLifeDays: 30,
  minComps: 3,
  maxAgeDays: 180,
  applyFees: true,
  applyVenueTrust: true,
};

/**
 * Calculate True Fair Value from comparable sales
 *
 * Steps:
 * 1. Filter comps by age
 * 2. Adjust for fees (buyer-side cost)
 * 3. Apply time decay weights
 * 4. Apply venue trust multipliers
 * 5. Compute weighted median
 * 6. Calculate confidence based on support and variance
 */
export function calculateTFV(
  comps: CompSale[],
  options: TFVOptions = {}
): TFVResult {
  const opts = { ...DEFAULT_TFV_OPTIONS, ...options };

  // Filter by age
  const now = Date.now();
  const recentComps = comps.filter(c => ageDays(c.soldAt, now) <= opts.maxAgeDays);

  if (recentComps.length < opts.minComps) {
    // Insufficient data
    return {
      tfvUsd: 0,
      tfvCents: 0,
      support: recentComps.length,
      median30d: 0,
      iqr: 0,
      confidence: 0,
      minPriceCents: 0,
      maxPriceCents: 0,
      volatilityBp: 0,
      lastSoldAt: null,
    };
  }

  // Adjust for fees
  const adjustedComps = recentComps.map(c => ({
    ...c,
    adjustedPriceCents: opts.applyFees
      ? adjustCompForFees(c.priceCents, c.venue || c.source)
      : c.priceCents,
  }));

  // Apply time decay + venue trust
  const weightedComps = adjustedComps.map(c => {
    const timeWeight = timeDecayWeight(c.soldAt, opts.halfLifeDays, now);
    const venueTrust = opts.applyVenueTrust
      ? VENUE_TRUST_SCORES[c.venue?.toLowerCase() || c.source.toLowerCase()] || 0.5
      : 1.0;

    return {
      ...c,
      weight: timeWeight * venueTrust,
    };
  });

  // Sort by adjusted price for percentile calculations
  const sortedPrices = weightedComps
    .map(c => c.adjustedPriceCents)
    .sort((a, b) => a - b);

  // Weighted median (TFV)
  const tfvCents = weightedMedian(
    weightedComps.map(c => c.adjustedPriceCents),
    weightedComps.map(c => c.soldAt),
    opts.halfLifeDays
  );

  // Calculate percentiles for IQR
  const p25Index = Math.floor(sortedPrices.length * 0.25);
  const p75Index = Math.floor(sortedPrices.length * 0.75);
  const p25 = sortedPrices[p25Index];
  const p75 = sortedPrices[p75Index];
  const iqr = p75 - p25;

  // Min/Max
  const minPriceCents = sortedPrices[0];
  const maxPriceCents = sortedPrices[sortedPrices.length - 1];

  // Volatility (coefficient of variation in basis points)
  const mean = sortedPrices.reduce((sum, p) => sum + p, 0) / sortedPrices.length;
  const variance = sortedPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / sortedPrices.length;
  const stdDev = Math.sqrt(variance);
  const volatilityBp = mean > 0 ? Math.round((stdDev / mean) * 10000) : 0;

  // Last sold date
  const lastSoldAt = weightedComps.reduce((latest, c) => {
    const soldDate = new Date(c.soldAt);
    return !latest || soldDate > latest ? soldDate : latest;
  }, null as Date | null);

  // Median30d (simple median of last 30 days for comparison)
  const comps30d = weightedComps.filter(c => ageDays(c.soldAt, now) <= 30);
  const median30d = comps30d.length > 0
    ? comps30d.map(c => c.adjustedPriceCents).sort((a, b) => a - b)[Math.floor(comps30d.length / 2)]
    : tfvCents;

  // Confidence score
  // Factors:
  // - Support: more comps = higher confidence
  // - Recency: recent comps = higher confidence
  // - Variance: low IQR relative to median = higher confidence
  const supportScore = Math.min(1, recentComps.length / 20); // 20 comps = full support
  const recencyScore = lastSoldAt
    ? Math.min(1, Math.max(0, 1 - ageDays(lastSoldAt, now) / 90))
    : 0;
  const varianceScore = tfvCents > 0
    ? Math.max(0, 1 - (iqr / tfvCents))
    : 0;

  const confidence = (supportScore * 0.4 + recencyScore * 0.3 + varianceScore * 0.3);

  return {
    tfvUsd: centsToUsd(tfvCents),
    tfvCents,
    support: recentComps.length,
    median30d: centsToUsd(median30d),
    iqr: centsToUsd(iqr),
    confidence: Math.max(0, Math.min(1, confidence)),
    minPriceCents,
    maxPriceCents,
    volatilityBp,
    lastSoldAt,
  };
}

/**
 * Get TFV for a specific time window
 */
export function calculateTFVWindow(
  comps: CompSale[],
  windowDays: number,
  options: TFVOptions = {}
): TFVResult {
  const now = Date.now();
  const windowComps = comps.filter(c => ageDays(c.soldAt, now) <= windowDays);

  return calculateTFV(windowComps, {
    ...options,
    maxAgeDays: windowDays,
  });
}
