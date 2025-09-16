// Main export file for market-core package
// Provides unified access to all core utilities and types

// Types and schemas
export type * from './types';
export { MarketSource, GradeCompany, RiskLevel, LiquidityLevel, DemandTrend, PipelineMode } from './types';
export { 
  CanonicalListingSchema,
  ArbitrageOpportunitySchema,
  PortfolioCollectionSchema,
  PortfolioItemSchema,
  CrossReferenceDataSchema,
  PipelineOptionsSchema,
  MarketSourceSchema,
  GradeCompanySchema,
  RiskLevelSchema,
  LiquidityLevelSchema,
  DemandTrendSchema,
  CurrencyCodeSchema,
  isValidMarketSource,
  isValidGradeCompany,
  isValidRiskLevel,
  isValidCurrencyCode,
  validateCanonicalListing,
  validateArbitrageOpportunity
} from './schemas';

// Core utilities
export * from './currency';
export * from './fees';
export * from './parsing';
export { 
  normalizePrice,
  detectOutliers,
  calculatePriceStatistics
} from './price';
export * from './risk';
export * from './collections';

// Additional utilities
export * from './batching';
export * from './logger';
export { 
  AdapterError,
  CrossReferenceError,
  MarketPipelineError,
  ValidationError,
  isAdapterError,
  isCrossReferenceError,
  isMarketPipelineError,
  isValidationError
} from './errors';
export * from './reports';
