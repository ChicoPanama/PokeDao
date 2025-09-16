// Zod schemas for canonical models and validation
// This ensures type safety and runtime validation across all adapters

import { z } from 'zod';
import type { MarketSource, GradeCompany, RiskLevel } from './types';

// Enum schemas
export const MarketSourceSchema = z.enum(['ebay', 'tcgplayer', 'fanatics', 'collectorcrypt', 'manual', 'csv']);
export const GradeCompanySchema = z.enum(['RAW', 'PSA', 'BGS', 'CGC', 'SGC', 'OTHER']);
export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const PipelineModeSchema = z.enum(['conservative', 'default', 'aggressive']);
export const LiquidityLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const DemandTrendSchema = z.enum(['RISING', 'STABLE', 'FALLING']);

// Basic type schemas
export const CurrencyCodeSchema = z.string().length(3).regex(/^[A-Z]{3}$/);
export const CollectionSlugSchema = z.string().min(1).max(50).regex(/^[a-z0-9-]+$/);

// Canonical listing schema
export const CanonicalListingSchema = z.object({
  id: z.string().min(1),
  source: MarketSourceSchema,
  sourceId: z.string().min(1),
  title: z.string().min(1).max(500),
  rawTitle: z.string().min(1).max(500),
  cardName: z.string().optional(),
  setName: z.string().optional(),
  cardNumber: z.string().optional(),
  variant: z.string().optional(),
  gradeCompany: GradeCompanySchema.optional(),
  grade: z.number().min(0).max(10).nullable().optional(),
  condition: z.string().optional(),
  price: z.number().min(0), // in USD cents
  currency: CurrencyCodeSchema,
  shipping: z.number().min(0).optional(), // in USD cents
  location: z.string().optional(),
  listedAt: z.date().optional(),
  url: z.string().url().optional(),
  dataQualityScore: z.number().min(0).max(1).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Arbitrage opportunity schema
export const ArbitrageOpportunitySchema = z.object({
  id: z.string().min(1),
  canonicalId: z.string().min(1),
  source: MarketSourceSchema,
  expectedResale: z.number().min(0), // in USD cents
  expectedFees: z.number().min(0), // in USD cents
  expectedShipping: z.number().min(0), // in USD cents
  netProfit: z.number(), // can be negative
  marginPct: z.number(), // can be negative
  liquidity: LiquidityLevelSchema,
  velocity: z.number().min(0).max(1),
  demand: DemandTrendSchema,
  volatility: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  risk: RiskLevelSchema,
  collectionTags: z.array(CollectionSlugSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Portfolio collection schema
export const PortfolioCollectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  slug: CollectionSlugSchema,
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Portfolio item schema
export const PortfolioItemSchema = z.object({
  id: z.string().min(1),
  collectionId: z.string().min(1),
  listingId: z.string().min(1),
  addedAt: z.date(),
  tags: z.array(z.string()),
});

// Cross-reference data schema
export const CrossReferenceDataSchema = z.object({
  pokemonTcgId: z.string().optional(),
  tcgPlayerData: z.object({
    marketPrice: z.number().optional(),
    lowPrice: z.number().optional(),
    highPrice: z.number().optional(),
    midPrice: z.number().optional(),
  }).optional(),
  matchConfidence: z.number().min(0).max(1),
  matchType: z.enum(['exact', 'fuzzy', 'partial', 'none']),
  discrepancies: z.array(z.string()),
});

// Pipeline options schema
export const PipelineOptionsSchema = z.object({
  sources: z.array(MarketSourceSchema).min(1),
  collectionSlugs: z.array(CollectionSlugSchema).optional(),
  mode: PipelineModeSchema.default('default'),
  since: z.date().optional(),
  limit: z.number().positive().optional(),
  dryRun: z.boolean().default(false),
});

// Fee calculation schema
export const FeeCalculationSchema = z.object({
  platformFee: z.number().min(0),
  paymentFee: z.number().min(0),
  shippingFee: z.number().min(0),
  totalFees: z.number().min(0),
  feePercentage: z.number().min(0).max(100),
});

// Price normalization schema
export const PriceNormalizationSchema = z.object({
  originalPrice: z.number(),
  normalizedPrice: z.number(),
  currency: CurrencyCodeSchema,
  exchangeRate: z.number().positive().optional(),
  isValid: z.boolean(),
  issues: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// Risk assessment schema
export const RiskAssessmentSchema = z.object({
  riskLevel: RiskLevelSchema,
  confidence: z.number().min(0).max(1),
  factors: z.object({
    dataQuality: z.number().min(0).max(1),
    priceOutlier: z.number().min(0).max(1),
    liquidity: z.number().min(0).max(1),
    volatility: z.number().min(0).max(1),
    marketTrend: z.number().min(0).max(1),
  }),
  reasoning: z.array(z.string()),
});

// Quality assessment schema
export const QualityAssessmentSchema = z.object({
  overallScore: z.number().min(0).max(1),
  completeness: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  consistency: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

// Report options schema
export const ReportOptionsSchema = z.object({
  format: z.enum(['json', 'csv', 'md', 'html']),
  includeCollections: z.boolean().default(true),
  includeSources: z.boolean().default(true),
  topN: z.number().positive().optional(),
  filters: z.object({
    minProfitMargin: z.number().optional(),
    maxRisk: RiskLevelSchema.optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    collections: z.array(CollectionSlugSchema).optional(),
    sources: z.array(MarketSourceSchema).optional(),
  }).optional(),
});

// Type exports for TypeScript inference
export type CanonicalListing = z.infer<typeof CanonicalListingSchema>;
export type ArbitrageOpportunity = z.infer<typeof ArbitrageOpportunitySchema>;
export type PortfolioCollection = z.infer<typeof PortfolioCollectionSchema>;
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
export type CrossReferenceData = z.infer<typeof CrossReferenceDataSchema>;
export type PipelineOptions = z.infer<typeof PipelineOptionsSchema>;
export type FeeCalculation = z.infer<typeof FeeCalculationSchema>;
export type PriceNormalization = z.infer<typeof PriceNormalizationSchema>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export type QualityAssessment = z.infer<typeof QualityAssessmentSchema>;
export type ReportOptions = z.infer<typeof ReportOptionsSchema>;

// Validation helpers
export function validateCanonicalListing(data: unknown): CanonicalListing {
  return CanonicalListingSchema.parse(data);
}

export function validateArbitrageOpportunity(data: unknown): ArbitrageOpportunity {
  return ArbitrageOpportunitySchema.parse(data);
}

export function validatePipelineOptions(data: unknown): PipelineOptions {
  return PipelineOptionsSchema.parse(data);
}

// Safe parsing with error handling
export function safeParseCanonicalListing(data: unknown): { success: true; data: CanonicalListing } | { success: false; errors: string[] } {
  const result = CanonicalListingSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { 
      success: false, 
      errors: result.error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`)
    };
  }
}

export function safeParseArbitrageOpportunity(data: unknown): { success: true; data: ArbitrageOpportunity } | { success: false; errors: string[] } {
  const result = ArbitrageOpportunitySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { 
      success: false, 
      errors: result.error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`)
    };
  }
}

// Schema registry for dynamic validation
export const SchemaRegistry = {
  CanonicalListing: CanonicalListingSchema,
  ArbitrageOpportunity: ArbitrageOpportunitySchema,
  PortfolioCollection: PortfolioCollectionSchema,
  PortfolioItem: PortfolioItemSchema,
  CrossReferenceData: CrossReferenceDataSchema,
  PipelineOptions: PipelineOptionsSchema,
  FeeCalculation: FeeCalculationSchema,
  PriceNormalization: PriceNormalizationSchema,
  RiskAssessment: RiskAssessmentSchema,
  QualityAssessment: QualityAssessmentSchema,
  ReportOptions: ReportOptionsSchema,
} as const;

// Utility functions for common validations
export function isValidMarketSource(source: string): source is MarketSource {
  return MarketSourceSchema.safeParse(source).success;
}

export function isValidGradeCompany(company: string): company is GradeCompany {
  return GradeCompanySchema.safeParse(company).success;
}

export function isValidRiskLevel(risk: string): risk is RiskLevel {
  return RiskLevelSchema.safeParse(risk).success;
}

export function isValidCurrencyCode(currency: string): boolean {
  return CurrencyCodeSchema.safeParse(currency).success;
}

export function isValidCollectionSlug(slug: string): boolean {
  return CollectionSlugSchema.safeParse(slug).success;
}
