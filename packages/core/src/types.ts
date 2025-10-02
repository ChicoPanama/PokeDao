/**
 * Core types used across PokeDAO
 */

// ============================================================================
// VARIANT IDENTITY
// ============================================================================

/**
 * Canonical card identifier
 * Format: SET|NUMBER|VARIANT|LANG|GRADER|GRADE
 * Example: BASE_SET|4|HOLO|EN|PSA|10
 */
export type VariantKey = string;

export interface VariantComponents {
  set: string;
  number: string;
  variant: string; // "BASE" | "HOLO" | "REVERSE" | etc.
  language: string; // "EN" | "JP" | etc.
  grader: string; // "RAW" | "PSA" | "BGS" | "CGC"
  grade: string; // "UNGRADED" | "10" | "9.5" | etc.
}

// ============================================================================
// PRICE DATA
// ============================================================================

export interface PricePoint {
  priceCents: number; // USD cents
  currency: string; // Original currency
  currencyOrig: string;
  fxRate: number;
  timestamp: Date;
  source: string; // "ebay" | "tcgplayer" | "collectorcrypt" | etc.
  sourceId: string;
}

export interface CompSale extends PricePoint {
  soldAt: Date;
  venue: string;
  condition?: string;
  grader?: string;
  grade?: string;
}

export interface ActiveListing extends PricePoint {
  seenAt: Date;
  venue: string;
  seller?: string;
  condition?: string;
  grader?: string;
  grade?: string | number; // Can be string ("10") or number (10)
  isActive: boolean;
}

/**
 * Enriched listing with card metadata
 * Used for collection tagging and advanced analysis
 */
export interface EnrichedListing extends ActiveListing {
  variantKey?: VariantKey;
  cardName?: string;
  setName?: string;
  number?: string;
  variant?: string;
  language?: string;
}

// ============================================================================
// FEATURES
// ============================================================================

export interface TFVResult {
  tfvUsd: number; // True Fair Value in USD
  tfvCents: number; // TFV in cents
  support: number; // Number of comps used
  effectiveComps: number; // Time-weighted comp count
  median30d: number; // 30-day median
  iqr: number; // Interquartile range
  confidence: number; // 0-1 score
  minPriceCents: number;
  maxPriceCents: number;
  volatilityBp: number; // Basis points
  lastSoldAt: Date | null;
}

export interface LiquidityMetrics {
  salesPerWeek: number; // Average sales per week
  daysToClear: number; // Estimated days to sell
  pSell30d: number; // Probability of selling within 30 days (0-1)
  pSell60d: number;
  pSell90d: number;
  activeListings: number; // Current active listings
  lastSeenAt: Date | null;
}

export interface RiskFlags {
  staleComps: boolean; // Comps too old
  lowLiquidity: boolean; // Too few sales
  highVolatility: boolean; // Price variance too high
  outlierPrice: boolean; // Price >3 sigma from mean
  missingData: boolean; // Key fields missing
  platformRisk: boolean; // Venue-specific issues
}

export interface RiskScore {
  score: number; // 0-1 (0 = lowest risk, 1 = highest)
  flags: RiskFlags;
  reasons: string[];
}

// ============================================================================
// OPPORTUNITY
// ============================================================================

export interface OpportunityScore {
  score: number; // Composite 0-1 score
  edgeBp: number; // (TFV - Ask) / Ask * 10000
  confidence: number; // 0-1
  passesFilters: boolean;
  tfv: TFVResult;
  liquidity: LiquidityMetrics;
  risk: RiskScore;

  // Additional fields for convenience
  listingPriceCents: number;
  tfvCents: number;
  discountPct: number;
  riskScore: number;
  cardName?: string;
}

// ============================================================================
// FILTERS & THRESHOLDS
// ============================================================================

export interface BuyFilters {
  minDiscountPct: number; // e.g., 12
  minComps: number; // e.g., 5
  minSalesPerWeek: number; // e.g., 2
  maxVolatilityBp: number; // e.g., 1200
  maxDaysToClear: number; // e.g., 45
  minConfidence: number; // e.g., 0.65
  blockOnRiskFlags: boolean; // Reject if any risk flags
}

export const DEFAULT_BUY_FILTERS: BuyFilters = {
  minDiscountPct: 12,
  minComps: 5,
  minSalesPerWeek: 2,
  maxVolatilityBp: 1200,
  maxDaysToClear: 45,
  minConfidence: 0.65,
  blockOnRiskFlags: true,
};

// ============================================================================
// VENUE & FEES
// ============================================================================

export interface VenueFees {
  buyerFeePct: number; // e.g., 3.5
  sellerFeePct: number; // e.g., 10.0
  shippingUsd: number; // Fixed shipping
  vaultFeePct?: number; // For Phygitals/CC
  withdrawalUsd?: number;
}

export const DEFAULT_VENUE_FEES: Record<string, VenueFees> = {
  ebay: {
    buyerFeePct: 0,
    sellerFeePct: 13.25,
    shippingUsd: 6,
  },
  tcgplayer: {
    buyerFeePct: 0,
    sellerFeePct: 10.25,
    shippingUsd: 0.78,
  },
  collectorcrypt: {
    buyerFeePct: 3.5,
    sellerFeePct: 10,
    shippingUsd: 0,
    vaultFeePct: 2,
  },
  phygitals: {
    buyerFeePct: 5,
    sellerFeePct: 7.5,
    shippingUsd: 0,
    vaultFeePct: 2,
    withdrawalUsd: 25,
  },
  unknown: {
    buyerFeePct: 3.5,
    sellerFeePct: 10,
    shippingUsd: 6,
  },
};

export const VENUE_TRUST_SCORES: Record<string, number> = {
  tcgplayer: 0.95,
  ebay: 0.85,
  collectorcrypt: 0.80,
  cardmarket: 0.80,
  phygitals: 0.75,
  fanatics: 0.75,
  unknown: 0.50,
};

// ============================================================================
// TIME WINDOWS
// ============================================================================

export const TIME_WINDOWS = [7, 14, 30, 60, 90] as const;
export type TimeWindow = typeof TIME_WINDOWS[number];
