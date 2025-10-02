/**
 * Risk Scoring
 *
 * Identifies quality issues, outliers, and platform risks
 */

import {
  CompSale,
  ActiveListing,
  RiskScore,
  RiskFlags,
  TFVResult,
} from '@pokedao/core/types';
import { ageDays } from '@pokedao/core/time-decay';

export interface RiskOptions {
  maxCompAgeDays?: number; // Max age before comps are stale (default 60)
  minComps?: number; // Min comps required (default 5)
  maxVolatilityBp?: number; // Max acceptable volatility (default 1200)
  outlierSigma?: number; // Z-score threshold for outliers (default 3)
  maxListingAgeDays?: number; // Max age before listing is stale (default 30)
}

const DEFAULT_RISK_OPTIONS: Required<RiskOptions> = {
  maxCompAgeDays: 60,
  minComps: 5,
  maxVolatilityBp: 1200,
  outlierSigma: 3,
  maxListingAgeDays: 30,
};

/**
 * Calculate risk score and flags
 *
 * Flags:
 * - staleComps: Last comp too old
 * - lowLiquidity: Too few comps
 * - highVolatility: Price variance too high
 * - outlierPrice: Listing price is statistical outlier
 * - missingData: Key fields missing
 * - platformRisk: Venue-specific issues
 */
export function calculateRisk(
  listingPriceCents: number | null,
  comps: CompSale[],
  listing: ActiveListing | null,
  tfv: TFVResult | null,
  options: RiskOptions = {}
): RiskScore {
  const opts = { ...DEFAULT_RISK_OPTIONS, ...options };
  const now = Date.now();

  const flags: RiskFlags = {
    staleComps: false,
    lowLiquidity: false,
    highVolatility: false,
    outlierPrice: false,
    missingData: false,
    platformRisk: false,
  };

  const reasons: string[] = [];

  // Check comp staleness
  if (tfv && tfv.lastSoldAt) {
    const compAge = ageDays(tfv.lastSoldAt, now);
    if (compAge > opts.maxCompAgeDays) {
      flags.staleComps = true;
      reasons.push(`Last comp ${Math.round(compAge)} days old (max ${opts.maxCompAgeDays})`);
    }
  } else if (comps.length === 0) {
    flags.staleComps = true;
    reasons.push('No comps available');
  }

  // Check comp count (liquidity proxy)
  if (comps.length < opts.minComps) {
    flags.lowLiquidity = true;
    reasons.push(`Only ${comps.length} comps (min ${opts.minComps})`);
  }

  // Check volatility
  if (tfv && tfv.volatilityBp > opts.maxVolatilityBp) {
    flags.highVolatility = true;
    reasons.push(`Volatility ${tfv.volatilityBp}bp (max ${opts.maxVolatilityBp}bp)`);
  }

  // Check outlier price
  if (listingPriceCents && tfv && tfv.tfvCents > 0 && tfv.iqr > 0) {
    const zScore = Math.abs(listingPriceCents - tfv.tfvCents) / (tfv.iqr / 1.35); // IQR to std dev
    if (zScore > opts.outlierSigma) {
      flags.outlierPrice = true;
      reasons.push(`Price is ${zScore.toFixed(1)}σ from median`);
    }
  }

  // Check missing data
  if (!tfv || tfv.support === 0) {
    flags.missingData = true;
    reasons.push('No TFV available');
  }

  if (listing) {
    if (!listing.venue && !listing.source) {
      flags.missingData = true;
      reasons.push('Missing venue/source');
    }

    // Check listing staleness
    const listingAge = ageDays(listing.seenAt, now);
    if (listingAge > opts.maxListingAgeDays) {
      flags.platformRisk = true;
      reasons.push(`Listing ${Math.round(listingAge)} days old`);
    }
  }

  // Calculate composite risk score (0-1)
  // More flags = higher risk
  const flagCount = Object.values(flags).filter(Boolean).length;
  const score = Math.min(1, flagCount / 6); // 6 possible flags

  return {
    score,
    flags,
    reasons,
  };
}

/**
 * Check if any blocking risk flags are present
 */
export function hasBlockingRisk(risk: RiskScore): boolean {
  return (
    risk.flags.staleComps ||
    risk.flags.lowLiquidity ||
    risk.flags.highVolatility ||
    risk.flags.missingData
  );
}

/**
 * Check if listing passes basic quality gates
 */
export function passesQualityGate(
  risk: RiskScore,
  options: {
    allowStaleComps?: boolean;
    allowLowLiquidity?: boolean;
    allowHighVolatility?: boolean;
  } = {}
): boolean {
  if (risk.flags.missingData) return false;

  if (!options.allowStaleComps && risk.flags.staleComps) return false;
  if (!options.allowLowLiquidity && risk.flags.lowLiquidity) return false;
  if (!options.allowHighVolatility && risk.flags.highVolatility) return false;

  return true;
}
