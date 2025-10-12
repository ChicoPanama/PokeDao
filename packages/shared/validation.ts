/**
 * Enhanced Data Validation Layer
 *
 * Provides comprehensive runtime validation for all data sources.
 * Designed to be BACKWARDS COMPATIBLE - wraps existing Prisma operations.
 *
 * Usage:
 *   const validator = new DataValidator();
 *   const validated = await validator.validateListing(rawListing);
 */

import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Enhanced listing validation with strict runtime checks
 */
export const EnhancedListingSchema = z.object({
  // Required fields
  title: z.string()
    .min(3, 'Title too short')
    .max(500, 'Title too long')
    .refine(val => !val.toLowerCase().includes('test'), 'Test data detected'),

  priceCents: z.number()
    .int('Price must be integer')
    .min(100, 'Price too low (<$1)')
    .max(100000000, 'Price unrealistic (>$1M)'),

  source: z.enum([
    'EBAY', 'TCGPLAYER', 'FANATICS', 'COLLECTOR_CRYPT', 'PHYGITALS',
    'COURTYARD', 'JUSTTCG', 'OPENSEA', 'MAGICEDEN', 'POKEPRICE_TRACKER',
    'POKEMON_TCG_API', 'MANUAL', 'CSV'
  ]),

  // Optional but validated if present
  cardName: z.string().min(1).max(255).optional(),
  setName: z.string().min(1).max(255).optional(),
  cardNumber: z.string().max(20).optional(),

  variant: z.string().max(100).optional(),

  gradeCompany: z.enum(['PSA', 'BGS', 'CGC', 'SGC', 'ACE', 'RAW', 'OTHER']).optional(),

  grade: z.number()
    .min(1)
    .max(10)
    .optional()
    .refine(val => val === undefined || val >= 1, 'Grade out of range'),

  condition: z.string().max(50).optional(),

  seller: z.string().max(255).optional(),
  sellerRating: z.number().min(0).max(5).optional(),

  quantity: z.number().int().min(1).max(100).optional(),

  currency: z.string()
    .length(3, 'Currency must be 3-letter ISO code')
    .default('USD'),

  listedAt: z.coerce.date().optional(),

  sourceUrl: z.string()
    .url('Invalid source URL')
    .max(500)
    .optional(),
});

/**
 * Enhanced comp sale validation
 */
export const EnhancedCompSaleSchema = z.object({
  soldPriceCents: z.number()
    .int()
    .min(100, 'Sold price too low')
    .max(100000000, 'Sold price unrealistic'),

  source: z.enum([
    'EBAY', 'TCGPLAYER', 'FANATICS', 'COLLECTOR_CRYPT', 'PHYGITALS',
    'COURTYARD', 'JUSTTCG', 'OPENSEA', 'MAGICEDEN', 'POKEPRICE_TRACKER'
  ]),

  soldAt: z.coerce.date()
    .refine(date => date <= new Date(), 'Sale date in future')
    .refine(date => date >= new Date('2020-01-01'), 'Sale date too old (pre-2020)'),

  cardName: z.string().min(1).max(255),
  setName: z.string().max(255).optional(),
  cardNumber: z.string().max(20).optional(),

  gradeCompany: z.enum(['PSA', 'BGS', 'CGC', 'SGC', 'ACE', 'RAW', 'OTHER']).optional(),
  grade: z.number().min(1).max(10).optional(),
  condition: z.string().max(50).optional(),

  currency: z.string().length(3).default('USD'),

  sourceUrl: z.string().url().max(500).optional(),
  sourceId: z.string().max(100),
});

/**
 * Canonical card validation
 */
export const EnhancedCanonicalCardSchema = z.object({
  canonicalName: z.string()
    .min(1)
    .max(255)
    .refine(val => !val.includes('undefined'), 'Invalid card name'),

  canonicalSet: z.string()
    .min(1)
    .max(255),

  cardNumber: z.string().max(20).optional(),
  variant: z.string().max(100).optional(),

  rarity: z.enum([
    'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Ultra',
    'Secret Rare', 'Promo', 'Amazing Rare', 'Rainbow Rare', 'Gold'
  ]).optional(),

  hp: z.number().int().min(10).max(500).optional(),

  types: z.array(z.enum([
    'Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting',
    'Darkness', 'Metal', 'Dragon', 'Fairy', 'Colorless'
  ])).optional(),

  illustrator: z.string().max(255).optional(),

  avgPriceCents: z.number().int().min(0).optional(),
  totalListings: z.number().int().min(0).default(0),

  dataQuality: z.number()
    .min(0, 'Data quality must be 0-1')
    .max(1, 'Data quality must be 0-1')
    .default(0.5),
});

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  dataQualityScore: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  value: any;
  severity: 'warning' | 'info';
}

// ============================================================================
// DATA VALIDATOR CLASS
// ============================================================================

export class DataValidator {
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      strictMode: config.strictMode ?? false,
      allowTestData: config.allowTestData ?? false,
      minDataQuality: config.minDataQuality ?? 0.3,
      warnOnMissingOptional: config.warnOnMissingOptional ?? true,
    };
  }

  /**
   * Validate a market listing
   */
  async validateListing(
    listing: unknown,
    options: { throwOnError?: boolean } = {}
  ): Promise<ValidationResult<z.infer<typeof EnhancedListingSchema>>> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Parse with Zod
      const parsed = EnhancedListingSchema.parse(listing);

      // Additional custom validations
      this.validatePriceReasonability(parsed, warnings);
      this.validateGradeConsistency(parsed, warnings);
      this.validateCardNameFormat(parsed, warnings);

      // Calculate data quality score
      const dataQualityScore = this.calculateListingQuality(parsed);

      // Check minimum quality threshold
      if (dataQualityScore < this.config.minDataQuality) {
        warnings.push({
          field: 'dataQuality',
          message: `Data quality ${dataQualityScore.toFixed(2)} below threshold ${this.config.minDataQuality}`,
          value: dataQualityScore,
          severity: 'warning',
        });
      }

      return {
        isValid: true,
        data: parsed,
        errors,
        warnings,
        dataQualityScore,
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        for (const issue of err.issues) {
          errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            value: (listing as any)?.[issue.path[0]],
            severity: 'error',
          });
        }
      } else {
        errors.push({
          field: 'unknown',
          message: `Validation failed: ${err}`,
          value: listing,
          severity: 'critical',
        });
      }

      if (options.throwOnError || this.config.strictMode) {
        throw new ValidationException('Listing validation failed', errors);
      }

      return {
        isValid: false,
        errors,
        warnings,
        dataQualityScore: 0,
      };
    }
  }

  /**
   * Validate a comp sale
   */
  async validateCompSale(
    comp: unknown,
    options: { throwOnError?: boolean } = {}
  ): Promise<ValidationResult<z.infer<typeof EnhancedCompSaleSchema>>> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const parsed = EnhancedCompSaleSchema.parse(comp);

      // Additional validations
      this.validateSalePriceReasonability(parsed, warnings);
      this.validateSaleDateRecency(parsed, warnings);

      const dataQualityScore = this.calculateCompQuality(parsed);

      return {
        isValid: true,
        data: parsed,
        errors,
        warnings,
        dataQualityScore,
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        for (const issue of err.issues) {
          errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            value: (comp as any)?.[issue.path[0]],
            severity: 'error',
          });
        }
      } else {
        errors.push({
          field: 'unknown',
          message: `Validation failed: ${err}`,
          value: comp,
          severity: 'critical',
        });
      }

      if (options.throwOnError || this.config.strictMode) {
        throw new ValidationException('CompSale validation failed', errors);
      }

      return {
        isValid: false,
        errors,
        warnings,
        dataQualityScore: 0,
      };
    }
  }

  /**
   * Validate a canonical card
   */
  async validateCanonicalCard(
    card: unknown,
    options: { throwOnError?: boolean } = {}
  ): Promise<ValidationResult<z.infer<typeof EnhancedCanonicalCardSchema>>> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const parsed = EnhancedCanonicalCardSchema.parse(card);

      const dataQualityScore = this.calculateCardQuality(parsed);

      return {
        isValid: true,
        data: parsed,
        errors,
        warnings,
        dataQualityScore,
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        for (const issue of err.issues) {
          errors.push({
            field: issue.path.join('.'),
            message: issue.message,
            value: (card as any)?.[issue.path[0]],
            severity: 'error',
          });
        }
      } else {
        errors.push({
          field: 'unknown',
          message: `Validation failed: ${err}`,
          value: card,
          severity: 'critical',
        });
      }

      if (options.throwOnError || this.config.strictMode) {
        throw new ValidationException('CanonicalCard validation failed', errors);
      }

      return {
        isValid: false,
        errors,
        warnings,
        dataQualityScore: 0,
      };
    }
  }

  // ========================================================================
  // CUSTOM VALIDATION RULES
  // ========================================================================

  private validatePriceReasonability(
    listing: z.infer<typeof EnhancedListingSchema>,
    warnings: ValidationWarning[]
  ): void {
    const { priceCents, gradeCompany, grade } = listing;

    // PSA 10 cards should typically be more expensive
    if (gradeCompany === 'PSA' && grade === 10 && priceCents < 10000) {
      warnings.push({
        field: 'priceCents',
        message: 'PSA 10 card priced unusually low (<$100)',
        value: priceCents,
        severity: 'warning',
      });
    }

    // Very expensive cards should have grade info
    if (priceCents > 100000 && !gradeCompany) {
      warnings.push({
        field: 'gradeCompany',
        message: 'High-value card (>$1000) missing grade info',
        value: priceCents,
        severity: 'warning',
      });
    }
  }

  private validateGradeConsistency(
    listing: z.infer<typeof EnhancedListingSchema>,
    warnings: ValidationWarning[]
  ): void {
    const { gradeCompany, grade, condition } = listing;

    // Grade company without grade value
    if (gradeCompany && gradeCompany !== 'RAW' && !grade) {
      warnings.push({
        field: 'grade',
        message: `Grade company ${gradeCompany} specified but no grade value`,
        value: { gradeCompany, grade },
        severity: 'warning',
      });
    }

    // Grade value without company
    if (grade && !gradeCompany) {
      warnings.push({
        field: 'gradeCompany',
        message: 'Grade value specified but no grading company',
        value: { grade, gradeCompany },
        severity: 'warning',
      });
    }

    // Condition + grade (unusual combination)
    if (condition && gradeCompany && gradeCompany !== 'RAW') {
      warnings.push({
        field: 'condition',
        message: 'Both condition and graded - graded cards typically don\'t have condition',
        value: { condition, gradeCompany },
        severity: 'info',
      });
    }
  }

  private validateCardNameFormat(
    listing: z.infer<typeof EnhancedListingSchema>,
    warnings: ValidationWarning[]
  ): void {
    const { cardName, title } = listing;

    if (!cardName && this.config.warnOnMissingOptional) {
      warnings.push({
        field: 'cardName',
        message: 'Card name not parsed from title',
        value: title,
        severity: 'info',
      });
    }

    // Check for common parsing errors
    if (cardName && /\d{4}-\d{2}-\d{2}/.test(cardName)) {
      warnings.push({
        field: 'cardName',
        message: 'Card name appears to contain a date (parsing error?)',
        value: cardName,
        severity: 'warning',
      });
    }
  }

  private validateSalePriceReasonability(
    comp: z.infer<typeof EnhancedCompSaleSchema>,
    warnings: ValidationWarning[]
  ): void {
    const { soldPriceCents, gradeCompany, grade } = comp;

    // Extremely high prices (potential outliers)
    if (soldPriceCents > 50000000) { // >$500k
      warnings.push({
        field: 'soldPriceCents',
        message: 'Extremely high sale price (>$500k) - potential outlier',
        value: soldPriceCents,
        severity: 'warning',
      });
    }

    // PSA 10 very low price
    if (gradeCompany === 'PSA' && grade === 10 && soldPriceCents < 5000) {
      warnings.push({
        field: 'soldPriceCents',
        message: 'PSA 10 sold for less than $50 - verify authenticity',
        value: soldPriceCents,
        severity: 'warning',
      });
    }
  }

  private validateSaleDateRecency(
    comp: z.infer<typeof EnhancedCompSaleSchema>,
    warnings: ValidationWarning[]
  ): void {
    const { soldAt } = comp;
    const daysSinceSale = (Date.now() - soldAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceSale > 180) {
      warnings.push({
        field: 'soldAt',
        message: `Sale is ${Math.round(daysSinceSale)} days old - may not reflect current market`,
        value: soldAt,
        severity: 'info',
      });
    }
  }

  // ========================================================================
  // DATA QUALITY SCORING
  // ========================================================================

  private calculateListingQuality(listing: z.infer<typeof EnhancedListingSchema>): number {
    let score = 0;
    let maxScore = 0;

    // Required fields present (baseline)
    score += 0.3;
    maxScore += 0.3;

    // Card identification quality (30%)
    if (listing.cardName) score += 0.1;
    if (listing.setName) score += 0.1;
    if (listing.cardNumber) score += 0.1;
    maxScore += 0.3;

    // Grade information (20%)
    if (listing.gradeCompany) score += 0.1;
    if (listing.grade) score += 0.1;
    maxScore += 0.2;

    // Seller information (10%)
    if (listing.seller) score += 0.05;
    if (listing.sellerRating) score += 0.05;
    maxScore += 0.1;

    // Source metadata (10%)
    if (listing.sourceUrl) score += 0.05;
    if (listing.listedAt) score += 0.05;
    maxScore += 0.1;

    return score / maxScore;
  }

  private calculateCompQuality(comp: z.infer<typeof EnhancedCompSaleSchema>): number {
    let score = 0;
    let maxScore = 0;

    // Required fields (baseline)
    score += 0.4;
    maxScore += 0.4;

    // Card identification (30%)
    score += 0.15; // cardName is required
    if (comp.setName) score += 0.1;
    if (comp.cardNumber) score += 0.05;
    maxScore += 0.3;

    // Grade information (20%)
    if (comp.gradeCompany) score += 0.1;
    if (comp.grade) score += 0.1;
    maxScore += 0.2;

    // Source metadata (10%)
    if (comp.sourceUrl) score += 0.1;
    maxScore += 0.1;

    return score / maxScore;
  }

  private calculateCardQuality(card: z.infer<typeof EnhancedCanonicalCardSchema>): number {
    let score = 0;
    let maxScore = 0;

    // Required fields (baseline)
    score += 0.4;
    maxScore += 0.4;

    // Card metadata (40%)
    if (card.rarity) score += 0.1;
    if (card.hp) score += 0.05;
    if (card.types && card.types.length > 0) score += 0.1;
    if (card.illustrator) score += 0.05;
    if (card.cardNumber) score += 0.1;
    maxScore += 0.4;

    // Market data (20%)
    if (card.avgPriceCents) score += 0.1;
    if (card.totalListings > 0) score += 0.1;
    maxScore += 0.2;

    return score / maxScore;
  }
}

// ============================================================================
// EXCEPTIONS
// ============================================================================

export class ValidationException extends Error {
  constructor(
    message: string,
    public errors: ValidationError[]
  ) {
    super(message);
    this.name = 'ValidationException';
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ValidationConfig {
  strictMode: boolean; // Throw on any validation error
  allowTestData: boolean; // Allow test/dummy data
  minDataQuality: number; // Minimum data quality score (0-1)
  warnOnMissingOptional: boolean; // Warn when optional fields missing
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

export class BatchValidator {
  private validator: DataValidator;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.validator = new DataValidator(config);
  }

  async validateListings(listings: unknown[]): Promise<BatchValidationResult> {
    const results = await Promise.all(
      listings.map(l => this.validator.validateListing(l, { throwOnError: false }))
    );

    const valid = results.filter(r => r.isValid);
    const invalid = results.filter(r => !r.isValid);

    return {
      total: listings.length,
      valid: valid.length,
      invalid: invalid.length,
      validationRate: valid.length / listings.length,
      avgDataQuality: valid.reduce((sum, r) => sum + r.dataQualityScore, 0) / Math.max(valid.length, 1),
      results,
    };
  }

  async validateCompSales(comps: unknown[]): Promise<BatchValidationResult> {
    const results = await Promise.all(
      comps.map(c => this.validator.validateCompSale(c, { throwOnError: false }))
    );

    const valid = results.filter(r => r.isValid);
    const invalid = results.filter(r => !r.isValid);

    return {
      total: comps.length,
      valid: valid.length,
      invalid: invalid.length,
      validationRate: valid.length / comps.length,
      avgDataQuality: valid.reduce((sum, r) => sum + r.dataQualityScore, 0) / Math.max(valid.length, 1),
      results,
    };
  }
}

export interface BatchValidationResult {
  total: number;
  valid: number;
  invalid: number;
  validationRate: number;
  avgDataQuality: number;
  results: ValidationResult<any>[];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DataValidator;
