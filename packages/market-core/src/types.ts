// Shared types and enums for the unified market pipeline
// This file defines the canonical data models that all sources must conform to

export enum MarketSource {
  EBAY = 'ebay',
  TCGPLAYER = 'tcgplayer',
  FANATICS = 'fanatics',
  COLLECTOR_CRYPT = 'collectorcrypt',
  MANUAL = 'manual',
  CSV = 'csv'
}

export enum GradeCompany {
  RAW = 'RAW',
  PSA = 'PSA',
  BGS = 'BGS',
  CGC = 'CGC',
  SGC = 'SGC',
  OTHER = 'OTHER'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum PipelineMode {
  CONSERVATIVE = 'conservative',
  DEFAULT = 'default',
  AGGRESSIVE = 'aggressive'
}

export enum LiquidityLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum DemandTrend {
  RISING = 'RISING',
  STABLE = 'STABLE',
  FALLING = 'FALLING'
}

// ISO 4217 currency codes
export type CurrencyCode = string;

// Collection identifiers for user portfolio groupings
export type CollectionSlug = string;

// Core canonical listing model that all sources must map to
export interface CanonicalListing {
  id: string;                    // deterministic natural key: `${source}:${sourceId}`
  source: MarketSource;
  sourceId: string;              // original marketplace ID (e.g., eBay itemId)
  title: string;                 // cleaned/processed title
  rawTitle: string;              // original title from source
  cardName?: string;             // extracted Pokemon name
  setName?: string;              // extracted set name
  cardNumber?: string;           // extracted card number
  variant?: string;              // holo/rev/alt art/1st ed/shadowless
  gradeCompany?: GradeCompany;
  grade?: number | null;         // numeric grade (10, 9.5, 9, etc.)
  condition?: string;            // Near Mint, Lightly Played, etc.
  price: number;                 // price in USD cents
  currency: CurrencyCode;
  shipping?: number;             // shipping cost in USD cents
  location?: string;             // seller location
  listedAt?: Date;               // when item was listed
  url?: string;                  // original listing URL
  dataQualityScore?: number;     // 0-1 confidence in data accuracy
  createdAt: Date;
  updatedAt: Date;
}

// Arbitrage opportunity model with calculated metrics
export interface ArbitrageOpportunity {
  id: string;                    // deterministic ID
  canonicalId: string;           // reference to CanonicalListing
  source: MarketSource;
  
  // Market analysis
  expectedResale: number;        // expected resale price in USD cents
  expectedFees: number;          // platform fees in USD cents
  expectedShipping: number;      // shipping costs in USD cents
  netProfit: number;             // net profit in USD cents
  marginPct: number;             // profit margin percentage
  
  // Market indicators
  liquidity: LiquidityLevel;
  velocity: number;              // normalized sales velocity (0-1)
  demand: DemandTrend;
  volatility: number;            // price volatility (0-1)
  
  // Confidence and risk
  confidence: number;            // 0-1 confidence score
  risk: RiskLevel;
  
  // Collection awareness
  collectionTags: CollectionSlug[];  // which user collections this belongs to
  
  createdAt: Date;
  updatedAt: Date;
}

// Portfolio collection model for user groupings
export interface PortfolioCollection {
  id: string;
  name: string;
  slug: CollectionSlug;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Portfolio item linking collections to listings
export interface PortfolioItem {
  id: string;
  collectionId: string;
  listingId: string;
  addedAt: Date;
  tags: string[];                // additional tags
}

// Cross-reference data from external APIs
export interface CrossReferenceData {
  pokemonTcgId?: string;
  tcgPlayerData?: {
    marketPrice?: number;
    lowPrice?: number;
    highPrice?: number;
    midPrice?: number;
  };
  matchConfidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'none';
  discrepancies: string[];
}

// Pipeline execution options
export interface PipelineOptions {
  sources: MarketSource[];
  collectionSlugs?: CollectionSlug[];
  mode?: PipelineMode;
  since?: Date;
  limit?: number;
  dryRun?: boolean;
}

// Pipeline execution results
export interface PipelineResults {
  startTime: Date;
  endTime: Date;
  duration: number;
  sources: {
    [source in MarketSource]?: {
      recordsProcessed: number;
      recordsCleaned: number;
      recordsMatched: number;
      opportunitiesFound: number;
      errors: number;
    };
  };
  collections: {
    [slug in CollectionSlug]?: {
      totalListings: number;
      opportunitiesFound: number;
      avgProfitMargin: number;
      topOpportunities: ArbitrageOpportunity[];
    };
  };
  global: {
    totalListings: number;
    totalOpportunities: number;
    avgProfitMargin: number;
    totalProfitPotential: number;
  };
}

// Adapter interface that all source adapters must implement
export interface MarketAdapter {
  readonly SOURCE: MarketSource;
  
  // Ingest raw data from source
  ingest(options: { since?: Date; limit?: number }): Promise<unknown[]>;
  
  // Map raw data to canonical format
  map(raw: unknown): CanonicalListing;
  
  // Calculate platform-specific fees
  fees(listing: CanonicalListing): number;
  
  // Parse title to extract structured data (optional)
  parseTitle?(title: string): Partial<CanonicalListing>;
  
  // Validate data quality (optional)
  validate?(listing: CanonicalListing): { isValid: boolean; issues: string[] };
}

// Fee calculation result
export interface FeeCalculation {
  platformFee: number;          // percentage or fixed amount
  paymentFee: number;           // payment processing fee
  shippingFee: number;          // estimated shipping cost
  totalFees: number;            // total fees in USD cents
  feePercentage: number;        // total fees as percentage of price
}

// Price normalization result
export interface PriceNormalization {
  originalPrice: number;
  normalizedPrice: number;      // in USD cents
  currency: CurrencyCode;
  exchangeRate?: number;
  isValid: boolean;
  issues: string[];
  confidence: number;           // 0-1
}

// Risk assessment result
export interface RiskAssessment {
  riskLevel: RiskLevel;
  confidence: number;           // 0-1
  factors: {
    dataQuality: number;        // 0-1
    priceOutlier: number;       // 0-1 (higher = more outlier)
    liquidity: number;          // 0-1
    volatility: number;         // 0-1
    marketTrend: number;        // 0-1
  };
  reasoning: string[];
}

// Quality assessment result
export interface QualityAssessment {
  overallScore: number;         // 0-1
  completeness: number;         // 0-1
  accuracy: number;            // 0-1
  consistency: number;         // 0-1
  freshness: number;           // 0-1
  issues: string[];
  recommendations: string[];
}

// Report generation options
export interface ReportOptions {
  format: 'json' | 'csv' | 'md' | 'html';
  includeCollections?: boolean;
  includeSources?: boolean;
  topN?: number;
  filters?: {
    minProfitMargin?: number;
    maxRisk?: RiskLevel;
    minConfidence?: number;
    collections?: CollectionSlug[];
    sources?: MarketSource[];
  };
}

// Error types for better error handling
export class MarketPipelineError extends Error {
  constructor(
    message: string,
    public readonly source?: MarketSource,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'MarketPipelineError';
  }
}

export class AdapterError extends MarketPipelineError {
  constructor(message: string, source: MarketSource, details?: unknown) {
    super(message, source, 'ADAPTER_ERROR', details);
    this.name = 'AdapterError';
  }
}

export class ValidationError extends MarketPipelineError {
  constructor(message: string, details?: unknown) {
    super(message, undefined, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class CrossReferenceError extends MarketPipelineError {
  constructor(message: string, source?: MarketSource, details?: unknown) {
    super(message, source, 'CROSS_REFERENCE_ERROR', details);
    this.name = 'CrossReferenceError';
  }
}
