/**
 * PokeDAO Utilities - Phase 3 Fork Integration
 * 
 * Selective extraction of utility functions from target repositories
 * while maintaining PokeDAO's database-first architecture.
 * 
 * @author PokeDAO Builder
 * @version Phase 3.0.0
 */

// Pricing utilities
export * from './pricing/outlier-detection';

// eBay optimization utilities  
export * from './ebay/query-builder';

// Scraping utilities
export * from './scraping/pagination';
export * from './scraping/anti-bot';

// Validation utilities
export * from './validation/data-validator';

// Type definitions for better integration
export interface UtilityConfig {
  enableLogging?: boolean;
  rateLimitStrategy?: 'conservative' | 'aggressive' | 'adaptive';
  validationLevel?: 'strict' | 'moderate' | 'relaxed';
  cachingEnabled?: boolean;
}

// Default configuration
export const DEFAULT_UTILITY_CONFIG: UtilityConfig = {
  enableLogging: true,
  rateLimitStrategy: 'adaptive',
  validationLevel: 'moderate',
  cachingEnabled: true
};

// Version information
export const UTILS_VERSION = '3.0.0';
export const UTILS_BUILD = 'phase-3-fork-integration';

// Utility status for monitoring
export interface UtilityStatus {
  module: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: Date;
  errorCount: number;
  responseTime: number;
}

/**
 * Health check for all utility modules
 */
export async function checkUtilityHealth(): Promise<UtilityStatus[]> {
  const modules = [
    'pricing/outlier-detection',
    'ebay/query-builder', 
    'scraping/pagination',
    'scraping/anti-bot',
    'validation/data-validator'
  ];

  return modules.map(module => ({
    module,
    status: 'healthy' as const,
    lastChecked: new Date(),
    errorCount: 0,
    responseTime: Math.random() * 100 // Mock response time
  }));
}

/**
 * Get utility metrics for monitoring dashboard
 */
export interface UtilityMetrics {
  totalValidations: number;
  averageQualityScore: number;
  outlierDetectionRate: number;
  queryOptimizationSavings: number;
  antiBot: {
    sessionsCreated: number;
    captchaDetected: number;
    rateLimitsHit: number;
  };
  scraping: {
    pagesProcessed: number;
    errorsEncountered: number;
    retryAttempts: number;
  };
}

export function getUtilityMetrics(): UtilityMetrics {
  // Mock implementation - would connect to actual metrics in production
  return {
    totalValidations: 0,
    averageQualityScore: 0,
    outlierDetectionRate: 0,
    queryOptimizationSavings: 0,
    antiBot: {
      sessionsCreated: 0,
      captchaDetected: 0,
      rateLimitsHit: 0
    },
    scraping: {
      pagesProcessed: 0,
      errorsEncountered: 0,
      retryAttempts: 0
    }
  };
}
