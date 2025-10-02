/**
 * Advanced Risk Scoring & Confidence Assessment
 *
 * Combines statistical analysis with heuristic market knowledge
 * to identify quality issues, outliers, and platform risks.
 *
 * Enhancements over base version:
 * - Multi-factor confidence scoring (data quality + completeness + market fit)
 * - Pokemon-specific liquidity heuristics (Charizard > Pidgey)
 * - Historical volatility calculation from comp variance
 * - Market trend detection (vintage appreciation, new set depreciation)
 * - Risk-adjusted confidence weighting
 */

import type {
  CompSale,
  ActiveListing,
  EnrichedListing,
  RiskScore,
  RiskFlags,
  TFVResult,
} from '../../core/src/types.js';
import { ageDays } from '../../core/src/time-decay.js';

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

// ============================================================================
// ADVANCED CONFIDENCE & LIQUIDITY SCORING
// ============================================================================

/**
 * Popular Pokemon with proven high liquidity
 * Based on historical sales data and collector demand
 */
const HIGH_LIQUIDITY_POKEMON = new Set([
  'charizard',
  'pikachu',
  'mew',
  'mewtwo',
  'lugia',
  'blastoise',
  'venusaur',
  'alakazam',
  'gengar',
  'gyarados',
  'dragonite',
  'machamp',
  'rayquaza',
  'groudon',
  'kyogre',
  'umbreon',
  'espeon',
]);

/**
 * Vintage sets with proven appreciation (WOTC era)
 */
const VINTAGE_SETS = new Set([
  'Base Set',
  'Jungle',
  'Fossil',
  'Base Set 2',
  'Team Rocket',
  'Gym Heroes',
  'Gym Challenge',
  'Neo Genesis',
  'Neo Discovery',
  'Neo Revelation',
  'Neo Destiny',
  'Legendary Collection',
  'Expedition',
  'Aquapolis',
  'Skyridge',
]);

/**
 * Modern sets (post-2020) with higher volatility
 */
const MODERN_SETS = new Set([
  'Scarlet & Violet',
  'Paldea Evolved',
  'Obsidian Flames',
  'Crown Zenith',
  'Silver Tempest',
  'Lost Origin',
  'Astral Radiance',
  'Brilliant Stars',
  'Fusion Strike',
  'Evolving Skies',
]);

/**
 * Calculate multi-factor confidence score (0-1)
 *
 * Combines:
 * - Data completeness (are all fields present?)
 * - Price reasonableness (is price in realistic range?)
 * - Comp support (how many comps back this up?)
 * - Parsing confidence (how well did we extract data?)
 */
export function calculateConfidence(
  listing: EnrichedListing,
  tfv: TFVResult | null,
  options?: {
    parsingConfidence?: number; // 0-1 if you have title parsing confidence
    crossReferenceMatch?: number; // 0-1 if you matched to external API
  }
): number {
  let confidence = 0;

  // Factor 1: Data Completeness (0-0.35)
  const requiredFields = [
    listing.cardName,
    listing.setName,
    listing.number,
    listing.priceCents,
    listing.venue || listing.source,
  ];
  const optionalFields = [
    listing.variant,
    listing.grader,
    listing.grade,
    listing.condition,
  ];

  const requiredComplete = requiredFields.filter(f => f !== null && f !== undefined && f !== '').length;
  const optionalComplete = optionalFields.filter(f => f !== null && f !== undefined && f !== '').length;

  confidence += (requiredComplete / requiredFields.length) * 0.25; // Required fields worth 25%
  confidence += (optionalComplete / optionalFields.length) * 0.10; // Optional fields worth 10%

  // Factor 2: Price Reasonableness (0-0.15)
  if (listing.priceCents > 0 && listing.priceCents < 10_000_000) {
    // Between $0.01 and $100,000
    confidence += 0.15;
  } else if (listing.priceCents >= 10_000_000 && listing.priceCents < 100_000_000) {
    // $100k-$1M (rare but possible)
    confidence += 0.10;
  }

  // Factor 3: TFV Support (0-0.25)
  if (tfv) {
    if (tfv.effectiveComps >= 10) {
      confidence += 0.25; // Strong support
    } else if (tfv.effectiveComps >= 5) {
      confidence += 0.20; // Moderate support
    } else if (tfv.effectiveComps >= 3) {
      confidence += 0.10; // Weak support
    }
  }

  // Factor 4: External Validation (0-0.25)
  if (options?.parsingConfidence) {
    confidence += options.parsingConfidence * 0.15; // Up to 15% from parsing
  }

  if (options?.crossReferenceMatch) {
    confidence += options.crossReferenceMatch * 0.10; // Up to 10% from cross-reference
  }

  // Factor 5: Market Consistency (0-0.10)
  if (tfv && listing.priceCents > 0) {
    // Price within 3x of TFV is consistent
    const priceRatio = listing.priceCents / tfv.tfvCents;
    if (priceRatio >= 0.33 && priceRatio <= 3.0) {
      confidence += 0.10;
    } else if (priceRatio >= 0.25 && priceRatio <= 4.0) {
      confidence += 0.05;
    }
  }

  return Math.min(confidence, 1.0);
}

/**
 * Calculate liquidity heuristic score (0-1)
 *
 * Estimates how easily a card can be sold based on:
 * - Pokemon popularity
 * - Grade/condition
 * - Set vintage
 * - Price point
 */
export function calculateLiquidityHeuristic(listing: EnrichedListing): number {
  let liquidity = 0.3; // Base liquidity

  // Popular Pokemon boost (+0-0.25)
  if (listing.cardName) {
    const pokemon = listing.cardName.toLowerCase();
    if (HIGH_LIQUIDITY_POKEMON.has(pokemon.split(' ')[0])) {
      liquidity += 0.25;
    } else if (pokemon.includes('charizard')) {
      // Charizard gets extra boost even if not exact match
      liquidity += 0.25;
    }
  }

  // Grading boost (+0-0.20)
  if (listing.grader && listing.grade !== null && listing.grade !== undefined) {
    const gradeNum = typeof listing.grade === 'number' ? listing.grade : parseFloat(listing.grade);
    if (!isNaN(gradeNum)) {
      if (listing.grader === 'PSA' && gradeNum >= 10) {
        liquidity += 0.20; // PSA 10 most liquid
      } else if (listing.grader === 'PSA' && gradeNum >= 9) {
        liquidity += 0.15; // PSA 9 very liquid
      } else if (['BGS', 'CGC'].includes(listing.grader) && gradeNum >= 9.5) {
        liquidity += 0.15;
      } else if (gradeNum >= 8) {
        liquidity += 0.10; // Mid-grade decent liquidity
      }
    }
  }

  // Vintage boost (+0-0.15)
  if (listing.setName) {
    for (const vintageSet of VINTAGE_SETS) {
      if (listing.setName.includes(vintageSet)) {
        liquidity += 0.15;
        break;
      }
    }

    // 1st Edition boost
    if (listing.variant?.includes('1ST_EDITION') || listing.variant?.includes('SHADOWLESS')) {
      liquidity += 0.10;
    }
  }

  // Price point (+0-0.10)
  if (listing.priceCents >= 1000 && listing.priceCents <= 100_000) {
    // $10-$1000 sweet spot
    liquidity += 0.10;
  } else if (listing.priceCents >= 100_000 && listing.priceCents <= 500_000) {
    // $1000-$5000 still liquid
    liquidity += 0.05;
  } else if (listing.priceCents > 1_000_000) {
    // >$10k less liquid (fewer buyers)
    liquidity -= 0.10;
  }

  return Math.min(Math.max(liquidity, 0), 1);
}

/**
 * Calculate historical volatility from comps
 *
 * Uses coefficient of variation: stdDev / mean
 */
export function calculateHistoricalVolatility(comps: CompSale[]): number {
  if (comps.length < 2) return 0.5; // Neutral if insufficient data

  const prices = comps.map(c => c.priceCents);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;

  if (mean === 0) return 1.0; // Maximum volatility if mean is zero

  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (normalized volatility)
  const cv = stdDev / mean;

  // Clamp to 0-1 range (CV > 1 is very volatile)
  return Math.min(cv, 1.0);
}

/**
 * Detect market trend from card characteristics
 */
export function detectMarketTrend(listing: EnrichedListing): 'rising' | 'stable' | 'falling' {
  let trendScore = 0;

  // Vintage cards appreciate (+0.3)
  if (listing.setName) {
    for (const vintageSet of VINTAGE_SETS) {
      if (listing.setName.includes(vintageSet)) {
        trendScore += 0.3;
        break;
      }
    }

    // Modern cards depreciate (-0.2)
    for (const modernSet of MODERN_SETS) {
      if (listing.setName.includes(modernSet)) {
        trendScore -= 0.2;
        break;
      }
    }
  }

  // High grades appreciate (+0.2)
  if (listing.grade) {
    const gradeNum = typeof listing.grade === 'number' ? listing.grade : parseFloat(listing.grade);
    if (!isNaN(gradeNum) && gradeNum >= 9) {
      trendScore += 0.2;
    }
  }

  // Popular Pokemon appreciate (+0.2)
  if (listing.cardName) {
    const pokemon = listing.cardName.toLowerCase();
    if (HIGH_LIQUIDITY_POKEMON.has(pokemon.split(' ')[0])) {
      trendScore += 0.2;
    }
  }

  // 1st Edition/Shadowless appreciate (+0.1)
  if (listing.variant?.includes('1ST_EDITION') || listing.variant?.includes('SHADOWLESS')) {
    trendScore += 0.1;
  }

  if (trendScore >= 0.3) return 'rising';
  if (trendScore <= -0.1) return 'falling';
  return 'stable';
}

/**
 * Calculate risk-adjusted confidence
 *
 * Penalizes confidence score based on risk factors
 */
export function calculateRiskAdjustedConfidence(
  confidence: number,
  risk: RiskScore
): number {
  let adjustment = 1.0;

  // Apply penalties for each risk flag
  if (risk.flags.staleComps) adjustment *= 0.8;
  if (risk.flags.lowLiquidity) adjustment *= 0.85;
  if (risk.flags.highVolatility) adjustment *= 0.9;
  if (risk.flags.outlierPrice) adjustment *= 0.7;
  if (risk.flags.missingData) adjustment *= 0.6;
  if (risk.flags.platformRisk) adjustment *= 0.95;

  return confidence * adjustment;
}

/**
 * Enhanced risk assessment with market intelligence
 */
export interface EnhancedRiskAssessment extends RiskScore {
  confidence: number;
  riskAdjustedConfidence: number;
  liquidityHeuristic: number;
  historicalVolatility: number;
  marketTrend: 'rising' | 'stable' | 'falling';
  reasoning: string[];
}

/**
 * Calculate comprehensive risk assessment with all enhancements
 */
export function calculateEnhancedRisk(
  listing: EnrichedListing,
  comps: CompSale[],
  tfv: TFVResult | null,
  options?: RiskOptions & {
    parsingConfidence?: number;
    crossReferenceMatch?: number;
  }
): EnhancedRiskAssessment {
  // Base risk calculation
  const baseRisk = calculateRisk(listing.priceCents, comps, listing, tfv, options);

  // Enhanced metrics
  const confidence = calculateConfidence(listing, tfv, options);
  const liquidityHeuristic = calculateLiquidityHeuristic(listing);
  const historicalVolatility = calculateHistoricalVolatility(comps);
  const marketTrend = detectMarketTrend(listing);
  const riskAdjustedConfidence = calculateRiskAdjustedConfidence(confidence, baseRisk);

  // Additional reasoning
  const enhancedReasons = [...baseRisk.reasons];

  if (confidence < 0.5) {
    enhancedReasons.push(`Low confidence (${(confidence * 100).toFixed(0)}%) - incomplete data`);
  }

  if (liquidityHeuristic < 0.3) {
    enhancedReasons.push('Low liquidity - may be difficult to sell');
  } else if (liquidityHeuristic > 0.7) {
    enhancedReasons.push('High liquidity - strong market demand');
  }

  if (historicalVolatility > 0.6) {
    enhancedReasons.push('High price volatility detected in comps');
  }

  if (marketTrend === 'rising') {
    enhancedReasons.push('Positive market trend - vintage/high-grade appreciation');
  } else if (marketTrend === 'falling') {
    enhancedReasons.push('Negative market trend - modern set depreciation');
  }

  return {
    ...baseRisk,
    confidence,
    riskAdjustedConfidence,
    liquidityHeuristic,
    historicalVolatility,
    marketTrend,
    reasoning: enhancedReasons,
  };
}
