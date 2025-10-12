/**
 * Feature Flags System
 *
 * Enables safe gradual rollout of new features with A/B testing capabilities.
 * All new MIT integration features should be behind feature flags.
 *
 * Usage:
 *   if (FeatureFlags.isEnabled('USE_ENHANCED_VALIDATION')) {
 *     // New code path
 *   } else {
 *     // Legacy code path
 *   }
 *
 *   // Or with rollout percentage:
 *   if (FeatureFlags.shouldUseFeature('USE_FUZZY_MATCHING', cardId)) {
 *     // Use new fuzzy matching
 *   }
 */

import { createHash } from 'crypto';

// ============================================================================
// FEATURE FLAG DEFINITIONS
// ============================================================================

export enum Feature {
  // Week 1: Validation & Quality
  USE_ENHANCED_VALIDATION = 'USE_ENHANCED_VALIDATION',
  USE_FUZZY_MATCHING = 'USE_FUZZY_MATCHING',
  USE_DATA_QUALITY_SCORING = 'USE_DATA_QUALITY_SCORING',

  // Week 2: Analytics & Storage
  USE_DUCKDB_ANALYTICS = 'USE_DUCKDB_ANALYTICS',
  USE_ENHANCED_DEDUPLICATION = 'USE_ENHANCED_DEDUPLICATION',
  USE_PRICE_VARIATION_TRACKING = 'USE_PRICE_VARIATION_TRACKING',

  // Week 3: Advanced Features
  USE_OUTLIER_DETECTION = 'USE_OUTLIER_DETECTION',
  USE_SHADOW_MODE_TESTING = 'USE_SHADOW_MODE_TESTING',
  USE_DATA_QUALITY_DASHBOARD = 'USE_DATA_QUALITY_DASHBOARD',

  // Performance
  USE_AGGRESSIVE_CACHING = 'USE_AGGRESSIVE_CACHING',
  USE_BATCH_PROCESSING = 'USE_BATCH_PROCESSING',
}

export interface FeatureConfig {
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  requiresAuth: boolean;
  description: string;
  since?: Date; // When was this flag introduced
  deprecatedSince?: Date; // When to remove the flag
}

// ============================================================================
// FEATURE FLAGS REGISTRY
// ============================================================================

export class FeatureFlags {
  private static config: Map<Feature, FeatureConfig> = new Map();
  private static initialized = false;

  /**
   * Initialize feature flags from environment variables
   */
  static initialize(): void {
    if (this.initialized) return;

    // Load from environment variables
    this.config.set(Feature.USE_ENHANCED_VALIDATION, {
      enabled: this.getEnvBool('USE_ENHANCED_VALIDATION', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_ENHANCED_VALIDATION', 0),
      requiresAuth: false,
      description: 'Enhanced runtime data validation with Zod schemas',
      since: new Date('2025-10-12'),
    });

    this.config.set(Feature.USE_FUZZY_MATCHING, {
      enabled: this.getEnvBool('USE_FUZZY_MATCHING', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_FUZZY_MATCHING', 0),
      requiresAuth: false,
      description: 'Fuzzy string matching for set names and card names',
      since: new Date('2025-10-12'),
    });

    this.config.set(Feature.USE_DATA_QUALITY_SCORING, {
      enabled: this.getEnvBool('USE_DATA_QUALITY_SCORING', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_DATA_QUALITY_SCORING', 0),
      requiresAuth: false,
      description: 'Automated data quality scoring for all records',
      since: new Date('2025-10-12'),
    });

    this.config.set(Feature.USE_DUCKDB_ANALYTICS, {
      enabled: this.getEnvBool('USE_DUCKDB_ANALYTICS', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_DUCKDB_ANALYTICS', 0),
      requiresAuth: false,
      description: 'DuckDB for fast analytical queries (parallel to PostgreSQL)',
      since: new Date('2025-10-19'),
    });

    this.config.set(Feature.USE_ENHANCED_DEDUPLICATION, {
      enabled: this.getEnvBool('USE_ENHANCED_DEDUPLICATION', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_ENHANCED_DEDUPLICATION', 0),
      requiresAuth: false,
      description: 'Intelligent deduplication preserving price variations',
      since: new Date('2025-10-19'),
    });

    this.config.set(Feature.USE_PRICE_VARIATION_TRACKING, {
      enabled: this.getEnvBool('USE_PRICE_VARIATION_TRACKING', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_PRICE_VARIATION_TRACKING', 0),
      requiresAuth: false,
      description: 'Track price distributions for better TFV',
      since: new Date('2025-10-19'),
    });

    this.config.set(Feature.USE_OUTLIER_DETECTION, {
      enabled: this.getEnvBool('USE_OUTLIER_DETECTION', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_OUTLIER_DETECTION', 0),
      requiresAuth: false,
      description: 'Automated outlier detection and flagging',
      since: new Date('2025-10-26'),
    });

    this.config.set(Feature.USE_SHADOW_MODE_TESTING, {
      enabled: this.getEnvBool('USE_SHADOW_MODE_TESTING', false),
      rolloutPercentage: 100, // Always 100% when enabled (logging only)
      requiresAuth: false,
      description: 'Run new algorithms in shadow mode (log differences)',
      since: new Date('2025-10-26'),
    });

    this.config.set(Feature.USE_DATA_QUALITY_DASHBOARD, {
      enabled: this.getEnvBool('USE_DATA_QUALITY_DASHBOARD', false),
      rolloutPercentage: 100,
      requiresAuth: true,
      description: 'Data quality metrics dashboard API endpoint',
      since: new Date('2025-10-26'),
    });

    this.config.set(Feature.USE_AGGRESSIVE_CACHING, {
      enabled: this.getEnvBool('USE_AGGRESSIVE_CACHING', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_AGGRESSIVE_CACHING', 0),
      requiresAuth: false,
      description: 'Longer cache TTLs for better performance',
    });

    this.config.set(Feature.USE_BATCH_PROCESSING, {
      enabled: this.getEnvBool('USE_BATCH_PROCESSING', false),
      rolloutPercentage: this.getEnvNumber('ROLLOUT_BATCH_PROCESSING', 0),
      requiresAuth: false,
      description: 'Batch database operations for better throughput',
    });

    this.initialized = true;
  }

  /**
   * Check if a feature is enabled (simple boolean check)
   */
  static isEnabled(feature: Feature): boolean {
    if (!this.initialized) this.initialize();

    const config = this.config.get(feature);
    if (!config) return false;

    return config.enabled;
  }

  /**
   * Check if a specific entity should use a feature (rollout percentage)
   *
   * Uses consistent hashing to ensure the same entity always gets the same result.
   * This is important for A/B testing - we want the same card to always use the
   * same code path for reproducibility.
   *
   * @param feature The feature to check
   * @param entityId Unique identifier (e.g., cardId, userId)
   * @returns true if this entity should use the feature
   */
  static shouldUseFeature(feature: Feature, entityId: string): boolean {
    if (!this.initialized) this.initialize();

    const config = this.config.get(feature);
    if (!config) return false;

    // If not enabled, always return false
    if (!config.enabled) return false;

    // If 100% rollout, always return true
    if (config.rolloutPercentage >= 100) return true;

    // If 0% rollout, always return false
    if (config.rolloutPercentage <= 0) return false;

    // Use consistent hashing to determine if this entity is in the rollout
    const hash = createHash('md5')
      .update(`${feature}:${entityId}`)
      .digest('hex');

    // Convert first 8 hex chars to number (0-4294967295)
    const hashValue = parseInt(hash.substring(0, 8), 16);

    // Map to 0-100 range
    const bucket = (hashValue % 100) + 1;

    return bucket <= config.rolloutPercentage;
  }

  /**
   * Get feature configuration
   */
  static getConfig(feature: Feature): FeatureConfig | undefined {
    if (!this.initialized) this.initialize();
    return this.config.get(feature);
  }

  /**
   * Get all feature flags and their status
   */
  static getAllFlags(): Map<Feature, FeatureConfig> {
    if (!this.initialized) this.initialize();
    return new Map(this.config);
  }

  /**
   * Override a feature flag (for testing)
   */
  static override(feature: Feature, config: Partial<FeatureConfig>): void {
    if (!this.initialized) this.initialize();

    const existing = this.config.get(feature);
    if (existing) {
      this.config.set(feature, { ...existing, ...config });
    }
  }

  /**
   * Reset all overrides (for testing)
   */
  static resetOverrides(): void {
    this.initialized = false;
    this.initialize();
  }

  /**
   * Get rollout statistics for a feature
   */
  static getRolloutStats(feature: Feature, sampleSize: number = 1000): RolloutStats {
    const config = this.config.get(feature);
    if (!config) {
      return {
        expectedPercentage: 0,
        actualCount: 0,
        sampleSize: 0,
        variance: 0,
      };
    }

    // Simulate rollout with sample IDs
    let enabled = 0;
    for (let i = 0; i < sampleSize; i++) {
      if (this.shouldUseFeature(feature, `sample-${i}`)) {
        enabled++;
      }
    }

    const actualPercentage = (enabled / sampleSize) * 100;
    const variance = Math.abs(actualPercentage - config.rolloutPercentage);

    return {
      expectedPercentage: config.rolloutPercentage,
      actualPercentage,
      actualCount: enabled,
      sampleSize,
      variance,
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private static getEnvBool(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  private static getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : Math.max(0, Math.min(100, parsed));
  }
}

export interface RolloutStats {
  expectedPercentage: number;
  actualPercentage?: number;
  actualCount: number;
  sampleSize: number;
  variance: number;
}

// ============================================================================
// SHADOW MODE WRAPPER
// ============================================================================

/**
 * Execute code in shadow mode - run both old and new code paths,
 * log differences, but always return the old result.
 *
 * This is critical for testing new algorithms before production rollout.
 *
 * @param oldPath Function that implements the current (production) logic
 * @param newPath Function that implements the new (experimental) logic
 * @param logger Logging function to track differences
 * @param context Additional context for logging
 */
export async function shadowMode<T>(
  oldPath: () => Promise<T>,
  newPath: () => Promise<T>,
  logger: (diff: ShadowModeDiff<T>) => void,
  context: Record<string, any> = {}
): Promise<T> {
  const startTime = Date.now();

  // Always execute old path first
  const oldResult = await oldPath();
  const oldTime = Date.now() - startTime;

  // Execute new path only if shadow mode is enabled
  if (FeatureFlags.isEnabled(Feature.USE_SHADOW_MODE_TESTING)) {
    try {
      const newStartTime = Date.now();
      const newResult = await newPath();
      const newTime = Date.now() - newStartTime;

      // Log the difference
      logger({
        context,
        oldResult,
        newResult,
        oldTime,
        newTime,
        timeDiff: newTime - oldTime,
        resultsDiffer: JSON.stringify(oldResult) !== JSON.stringify(newResult),
        timestamp: new Date(),
      });
    } catch (error) {
      // Log error but don't fail - new code is experimental
      logger({
        context,
        oldResult,
        newResult: undefined,
        oldTime,
        newTime: -1,
        timeDiff: -1,
        resultsDiffer: true,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
    }
  }

  // Always return old result (safe)
  return oldResult;
}

export interface ShadowModeDiff<T> {
  context: Record<string, any>;
  oldResult: T;
  newResult: T | undefined;
  oldTime: number;
  newTime: number;
  timeDiff: number;
  resultsDiffer: boolean;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// FEATURE FLAG MIDDLEWARE (for Express/Fastify)
// ============================================================================

/**
 * Middleware to check feature flags in API routes
 */
export function requireFeature(feature: Feature) {
  return (req: any, res: any, next: any) => {
    if (!FeatureFlags.isEnabled(feature)) {
      return res.status(503).send({
        ok: false,
        error: 'Feature not available',
        feature: feature,
        message: 'This feature is currently disabled via feature flag',
      });
    }
    next();
  };
}

/**
 * Add feature flag info to response headers (for debugging)
 */
export function addFeatureFlagHeaders(features: Feature[]) {
  return (req: any, res: any, next: any) => {
    const flags: Record<string, string> = {};
    for (const feature of features) {
      flags[feature] = FeatureFlags.isEnabled(feature) ? 'enabled' : 'disabled';
    }
    res.header('X-Feature-Flags', JSON.stringify(flags));
    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FeatureFlags;

// Auto-initialize on import
FeatureFlags.initialize();
