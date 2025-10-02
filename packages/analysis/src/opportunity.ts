/**
 * Opportunity Scorer
 *
 * Composite model combining TFV, Liquidity, and Risk
 */

import {
  CompSale,
  ActiveListing,
  OpportunityScore,
  BuyFilters,
  DEFAULT_BUY_FILTERS,
} from '@pokedao/core/types';
import { calculateTFV } from './fair-value.js';
import { calculateLiquidity } from './liquidity.js';
import { calculateRisk, hasBlockingRisk } from './risk.js';

export interface OpportunityOptions {
  filters?: Partial<BuyFilters>;
  tfvOptions?: any;
  liquidityOptions?: any;
  riskOptions?: any;
}

/**
 * Calculate opportunity score for a listing
 *
 * Composite score combines:
 * - α * (TFV - Ask) / TFV  (discount)
 * - β * Liquidity           (sales velocity)
 * - -γ * Risk               (quality/flags)
 *
 * Default weights: α=0.5, β=0.3, γ=0.2
 */
export function calculateOpportunity(
  listing: ActiveListing,
  comps: CompSale[],
  listings: ActiveListing[],
  options: OpportunityOptions = {}
): OpportunityScore {
  const filters = { ...DEFAULT_BUY_FILTERS, ...options.filters };

  // Calculate TFV
  const tfv = calculateTFV(comps, options.tfvOptions);

  // Calculate Liquidity
  const liquidity = calculateLiquidity(comps, listings, options.liquidityOptions);

  // Calculate Risk
  const risk = calculateRisk(
    listing.priceCents,
    comps,
    listing,
    tfv,
    options.riskOptions
  );

  // Calculate edge (discount from TFV)
  const edgeBp = tfv.tfvCents > 0
    ? Math.round(((tfv.tfvCents - listing.priceCents) / tfv.tfvCents) * 10000)
    : 0;

  const discountPct = edgeBp / 100;

  // Component scores (0-1)
  const discountScore = Math.max(0, Math.min(1, discountPct / 50)); // 50% discount = max score
  const liquidityScore = Math.min(1, liquidity.salesPerWeek / 10); // 10 sales/week = max score
  const riskPenalty = risk.score; // Already 0-1

  // Composite score with default weights
  const alpha = 0.5;
  const beta = 0.3;
  const gamma = 0.2;

  const rawScore = (
    alpha * discountScore +
    beta * liquidityScore -
    gamma * riskPenalty
  );

  const score = Math.max(0, Math.min(1, rawScore));

  // Apply filters
  const passesFilters = checkFilters(
    {
      edgeBp,
      discountPct,
      tfv,
      liquidity,
      risk,
    },
    filters
  );

  // Confidence combines TFV confidence + liquidity signal + risk
  const confidence = (
    tfv.confidence * 0.5 +
    Math.min(1, liquidity.salesPerWeek / 5) * 0.3 +
    (1 - risk.score) * 0.2
  );

  return {
    score,
    edgeBp,
    confidence: Math.max(0, Math.min(1, confidence)),
    passesFilters,
    tfv,
    liquidity,
    risk,
  };
}

/**
 * Check if opportunity passes buy filters
 */
function checkFilters(
  data: {
    edgeBp: number;
    discountPct: number;
    tfv: any;
    liquidity: any;
    risk: any;
  },
  filters: BuyFilters
): boolean {
  // Discount check
  if (data.discountPct < filters.minDiscountPct) {
    return false;
  }

  // Comp support check
  if (data.tfv.support < filters.minComps) {
    return false;
  }

  // Liquidity check
  if (data.liquidity.salesPerWeek < filters.minSalesPerWeek) {
    return false;
  }

  // Volatility check
  if (data.tfv.volatilityBp > filters.maxVolatilityBp) {
    return false;
  }

  // Days to clear check
  if (data.liquidity.daysToClear > filters.maxDaysToClear) {
    return false;
  }

  // Confidence check
  if (data.tfv.confidence < filters.minConfidence) {
    return false;
  }

  // Risk flags check
  if (filters.blockOnRiskFlags && hasBlockingRisk(data.risk)) {
    return false;
  }

  return true;
}

/**
 * Rank opportunities by composite score
 */
export function rankOpportunities(
  opportunities: OpportunityScore[]
): OpportunityScore[] {
  return opportunities
    .filter(o => o.passesFilters)
    .sort((a, b) => {
      // Sort by score descending, then confidence descending
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.confidence - a.confidence;
    });
}

/**
 * Get top N opportunities
 */
export function getTopOpportunities(
  opportunities: OpportunityScore[],
  n: number = 10
): OpportunityScore[] {
  const ranked = rankOpportunities(opportunities);
  return ranked.slice(0, n);
}
