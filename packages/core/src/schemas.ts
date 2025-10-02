/**
 * Zod schemas for validation
 */

import { z } from 'zod';

// ============================================================================
// VARIANT KEY
// ============================================================================

export const VariantKeySchema = z.string().regex(
  /^[A-Z0-9_]+\|[A-Z0-9]+\|[A-Z_]+\|[A-Z]{2}\|[A-Z]+\|[A-Z0-9.]+$/,
  'Invalid variant key format'
);

export const VariantComponentsSchema = z.object({
  set: z.string(),
  number: z.string(),
  variant: z.string(),
  language: z.string(),
  grader: z.string(),
  grade: z.string(),
});

// ============================================================================
// TFV
// ============================================================================

export const TFVResultSchema = z.object({
  tfvUsd: z.number(),
  tfvCents: z.number(),
  support: z.number().int().nonnegative(),
  median30d: z.number(),
  iqr: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  minPriceCents: z.number(),
  maxPriceCents: z.number(),
  volatilityBp: z.number().int().nonnegative(),
  lastSoldAt: z.date().nullable(),
});

// ============================================================================
// LIQUIDITY
// ============================================================================

export const LiquidityMetricsSchema = z.object({
  salesPerWeek: z.number().nonnegative(),
  daysToClear: z.number().nonnegative(),
  pSell30d: z.number().min(0).max(1),
  pSell60d: z.number().min(0).max(1),
  pSell90d: z.number().min(0).max(1),
  activeListings: z.number().int().nonnegative(),
  lastSeenAt: z.date().nullable(),
});

// ============================================================================
// RISK
// ============================================================================

export const RiskFlagsSchema = z.object({
  staleComps: z.boolean(),
  lowLiquidity: z.boolean(),
  highVolatility: z.boolean(),
  outlierPrice: z.boolean(),
  missingData: z.boolean(),
  platformRisk: z.boolean(),
});

export const RiskScoreSchema = z.object({
  score: z.number().min(0).max(1),
  flags: RiskFlagsSchema,
  reasons: z.array(z.string()),
});

// ============================================================================
// OPPORTUNITY
// ============================================================================

export const OpportunityScoreSchema = z.object({
  score: z.number().min(0).max(1),
  edgeBp: z.number(),
  confidence: z.number().min(0).max(1),
  passesFilters: z.boolean(),
  tfv: TFVResultSchema,
  liquidity: LiquidityMetricsSchema,
  risk: RiskScoreSchema,
});

// ============================================================================
// BUY FILTERS
// ============================================================================

export const BuyFiltersSchema = z.object({
  minDiscountPct: z.number().nonnegative(),
  minComps: z.number().int().nonnegative(),
  minSalesPerWeek: z.number().nonnegative(),
  maxVolatilityBp: z.number().int().nonnegative(),
  maxDaysToClear: z.number().nonnegative(),
  minConfidence: z.number().min(0).max(1),
  blockOnRiskFlags: z.boolean(),
});
