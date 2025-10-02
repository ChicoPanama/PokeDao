/**
 * Liquidity Metrics Calculator
 *
 * Estimates sales velocity, days-to-clear, and probability of selling
 */

import {
  CompSale,
  ActiveListing,
  LiquidityMetrics,
} from '@pokedao/core/types';
import { ageDays } from '@pokedao/core/time-decay';

export interface LiquidityOptions {
  lookbackDays?: number; // Days to look back for sales (default 90)
  pSellHorizon?: number; // Horizon for pSell calculation (default 30)
}

const DEFAULT_LIQUIDITY_OPTIONS: Required<LiquidityOptions> = {
  lookbackDays: 90,
  pSellHorizon: 30,
};

/**
 * Calculate liquidity metrics from comp sales and active listings
 *
 * Metrics:
 * - salesPerWeek: Average weekly sales over lookback period
 * - daysToClear: Estimated time to sell (based on sales velocity and active depth)
 * - pSell{N}d: Probability of selling within N days
 * - activeListings: Current active listing count
 */
export function calculateLiquidity(
  comps: CompSale[],
  listings: ActiveListing[],
  options: LiquidityOptions = {}
): LiquidityMetrics {
  const opts = { ...DEFAULT_LIQUIDITY_OPTIONS, ...options };
  const now = Date.now();

  // Filter comps to lookback window
  const recentComps = comps.filter(c => ageDays(c.soldAt, now) <= opts.lookbackDays);

  // Count active listings
  const activeListings = listings.filter(l => l.isActive).length;

  // Calculate sales velocity
  const salesPerWeek = recentComps.length > 0
    ? (recentComps.length / opts.lookbackDays) * 7
    : 0;

  // Estimate days to clear
  // daysToClear = activeListings / salesPerDay
  // Add a baseline of 7 days even if velocity is high
  const salesPerDay = salesPerWeek / 7;
  let daysToClear = 0;

  if (salesPerDay > 0) {
    const rawDaysToClear = activeListings / salesPerDay;
    daysToClear = Math.max(7, rawDaysToClear); // Min 7 days
  } else {
    daysToClear = activeListings > 0 ? 999 : 0; // No sales = can't estimate
  }

  // Calculate probability of selling within N days
  // Use exponential decay model: P(sell within t) = 1 - exp(-λt)
  // where λ = salesPerDay / activeListings (if activeListings > 0)
  const lambda = activeListings > 0 ? salesPerDay / activeListings : 0;

  const pSell30d = lambda > 0 ? 1 - Math.exp(-lambda * 30) : 0;
  const pSell60d = lambda > 0 ? 1 - Math.exp(-lambda * 60) : 0;
  const pSell90d = lambda > 0 ? 1 - Math.exp(-lambda * 90) : 0;

  // Last seen date
  const lastSeenAt = listings.reduce((latest, l) => {
    const seenDate = new Date(l.seenAt);
    return !latest || seenDate > latest ? seenDate : latest;
  }, null as Date | null);

  return {
    salesPerWeek: Math.round(salesPerWeek * 100) / 100,
    daysToClear: Math.round(daysToClear * 10) / 10,
    pSell30d: Math.max(0, Math.min(1, pSell30d)),
    pSell60d: Math.max(0, Math.min(1, pSell60d)),
    pSell90d: Math.max(0, Math.min(1, pSell90d)),
    activeListings,
    lastSeenAt,
  };
}

/**
 * Calculate liquidity for a specific venue
 */
export function calculateVenueLiquidity(
  comps: CompSale[],
  listings: ActiveListing[],
  venue: string,
  options: LiquidityOptions = {}
): LiquidityMetrics {
  const venueComps = comps.filter(c =>
    (c.venue?.toLowerCase() || c.source.toLowerCase()) === venue.toLowerCase()
  );

  const venueListings = listings.filter(l =>
    (l.venue?.toLowerCase() || l.source.toLowerCase()) === venue.toLowerCase()
  );

  return calculateLiquidity(venueComps, venueListings, options);
}

/**
 * Estimate median time between sales (alternative days-to-clear metric)
 */
export function medianTimeBetweenSales(comps: CompSale[]): number {
  if (comps.length < 2) return 0;

  // Sort by sold date
  const sorted = comps
    .map(c => new Date(c.soldAt).getTime())
    .sort((a, b) => a - b);

  // Calculate intervals
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24)); // days
  }

  // Return median interval
  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);

  return intervals[mid];
}
