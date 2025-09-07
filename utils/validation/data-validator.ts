/**
 * Data Validation and Quality Utilities
 * 
 * Comprehensive validation patterns for card data, price analysis,
 * and marketplace information. Integrates with PokeDAO's data quality
 * standards and normalization engine from Phase 2.
 * 
 * @author PokeDAO Builder - Phase 3 Fork Integration
 * @inspired_by Data quality patterns from marketplace analysis systems
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1, confidence in data quality
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  impact: 'data_quality' | 'performance' | 'completeness';
  suggestion?: string;
}

export interface CardDataInput {
  name?: string;
  set?: string;
  number?: string;
  variant?: string;
  condition?: string;
  grade?: string | number;
  price?: string | number | Decimal;
  currency?: string;
  marketplace?: string;
  url?: string;
  imageUrl?: string;
  lastUpdated?: Date | string;
}

export interface PriceDataInput {
  price: string | number | Decimal;
  currency?: string;
  condition?: string;
  grade?: string | number;
  marketplace: string;
  listingType?: 'auction' | 'buy_it_now' | 'best_offer';
  soldAt?: Date | string;
  listedAt?: Date | string;
  shippingCost?: string | number | Decimal;
  totalCost?: string | number | Decimal;
}

/**
 * Core validation engine with marketplace-specific rules
 */
export class DataValidator {
  private static readonly VALID_CONDITIONS = [
    'mint', 'near mint', 'excellent', 'very good', 'good', 'fair', 'poor',
    'nm', 'ex', 'vg', 'gd', 'fr', 'pr', // Abbreviations
    'damaged', 'heavily played', 'moderately played', 'lightly played'
  ];

  private static readonly VALID_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'
  ];

  private static readonly MARKETPLACE_CONFIGS = {
    ebay: {
      maxPriceUSD: 100000,
      minPriceUSD: 0.01,
      maxTitleLength: 80,
      requiresCondition: true,
      requiresShipping: false
    },
    goldin: {
      maxPriceUSD: 1000000,
      minPriceUSD: 1,
      maxTitleLength: 200,
      requiresCondition: true,
      requiresShipping: true
    },
    heritage: {
      maxPriceUSD: 500000,
      minPriceUSD: 5,
      maxTitleLength: 150,
      requiresCondition: true,
      requiresShipping: true
    },
    tcgplayer: {
      maxPriceUSD: 50000,
      minPriceUSD: 0.01,
      maxTitleLength: 100,
      requiresCondition: true,
      requiresShipping: false
    }
  };

  /**
   * Validate complete card data structure
   */
  static validateCardData(data: CardDataInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!data.name?.trim()) {
      errors.push({
        field: 'name',
        message: 'Card name is required',
        severity: 'critical',
        code: 'MISSING_NAME'
      });
    }

    if (!data.set?.trim()) {
      errors.push({
        field: 'set',
        message: 'Set information is required',
        severity: 'critical',
        code: 'MISSING_SET'
      });
    }

    // Card name validation
    if (data.name) {
      const nameValidation = this.validateCardName(data.name);
      if (!nameValidation.isValid) {
        errors.push(...nameValidation.errors);
        warnings.push(...nameValidation.warnings);
      }
    }

    // Set validation
    if (data.set) {
      const setValidation = this.validateSetName(data.set);
      if (!setValidation.isValid) {
        warnings.push(...setValidation.warnings);
      }
    }

    // Number validation
    if (data.number) {
      const numberValidation = this.validateCardNumber(data.number);
      if (!numberValidation.isValid) {
        warnings.push(...numberValidation.warnings);
      }
    }

    // Condition validation
    if (data.condition) {
      const conditionValidation = this.validateCondition(data.condition);
      if (!conditionValidation.isValid) {
        errors.push(...conditionValidation.errors);
      }
    }

    // Grade validation
    if (data.grade) {
      const gradeValidation = this.validateGrade(data.grade);
      if (!gradeValidation.isValid) {
        warnings.push(...gradeValidation.warnings);
      }
    }

    // Price validation
    if (data.price) {
      const priceValidation = this.validatePrice({
        price: data.price,
        currency: data.currency,
        marketplace: data.marketplace || 'unknown'
      } as PriceDataInput);
      
      if (!priceValidation.isValid) {
        errors.push(...priceValidation.errors);
        warnings.push(...priceValidation.warnings);
      }
    }

    // URL validation
    if (data.url) {
      const urlValidation = this.validateUrl(data.url);
      if (!urlValidation.isValid) {
        warnings.push(...urlValidation.warnings);
      }
    }

    // Cross-field validation
    if (data.condition && data.grade) {
      const consistency = this.validateConditionGradeConsistency(data.condition, data.grade);
      if (!consistency.isValid) {
        warnings.push(...consistency.warnings);
        suggestions.push(...(consistency.suggestions || []));
      }
    }

    // Calculate quality score
    const qualityScore = this.calculateDataQualityScore(data, errors, warnings);

    return {
      isValid: errors.length === 0,
      score: qualityScore,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate price data with marketplace-specific rules
   */
  static validatePrice(data: PriceDataInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Convert price to number for validation
    let priceValue: number;
    try {
      if (typeof data.price === 'string') {
        // Remove common currency symbols and formatting
        const cleanPrice = data.price.replace(/[$,£€¥\s]/g, '');
        priceValue = parseFloat(cleanPrice);
      } else if (data.price instanceof Decimal) {
        priceValue = data.price.toNumber();
      } else {
        priceValue = Number(data.price);
      }

      if (isNaN(priceValue)) {
        errors.push({
          field: 'price',
          message: 'Price must be a valid number',
          severity: 'critical',
          code: 'INVALID_PRICE_FORMAT'
        });
        return { isValid: false, score: 0, errors, warnings, suggestions };
      }
    } catch (error) {
      errors.push({
        field: 'price',
        message: 'Unable to parse price value',
        severity: 'critical',
        code: 'PRICE_PARSE_ERROR'
      });
      return { isValid: false, score: 0, errors, warnings, suggestions };
    }

    // Price range validation
    if (priceValue <= 0) {
      errors.push({
        field: 'price',
        message: 'Price must be greater than zero',
        severity: 'critical',
        code: 'NEGATIVE_PRICE'
      });
    }

    // Marketplace-specific validation
    const marketplace = data.marketplace.toLowerCase();
    const config = this.MARKETPLACE_CONFIGS[marketplace as keyof typeof this.MARKETPLACE_CONFIGS];
    
    if (config) {
      if (priceValue > config.maxPriceUSD) {
        warnings.push({
          field: 'price',
          message: `Price unusually high for ${marketplace} (max typical: $${config.maxPriceUSD.toLocaleString()})`,
          impact: 'data_quality',
          suggestion: 'Verify price accuracy or check for decimal placement errors'
        });
      }

      if (priceValue < config.minPriceUSD) {
        warnings.push({
          field: 'price',
          message: `Price unusually low for ${marketplace} (min typical: $${config.minPriceUSD})`,
          impact: 'data_quality',
          suggestion: 'Verify price accuracy or check for missing decimal places'
        });
      }
    }

    // Currency validation
    if (data.currency && !this.VALID_CURRENCIES.includes(data.currency.toUpperCase())) {
      warnings.push({
        field: 'currency',
        message: `Unsupported currency: ${data.currency}`,
        impact: 'completeness',
        suggestion: 'Use standard currency codes (USD, EUR, GBP, etc.)'
      });
    }

    // Condition requirement for certain marketplaces
    if (config?.requiresCondition && !data.condition) {
      warnings.push({
        field: 'condition',
        message: `${marketplace} typically requires condition information`,
        impact: 'completeness',
        suggestion: 'Add condition data for better price analysis'
      });
    }

    // Date validation
    if (data.soldAt) {
      const dateValidation = this.validateDate(data.soldAt, 'soldAt');
      if (!dateValidation.isValid) {
        warnings.push(...dateValidation.warnings);
      }
    }

    if (data.listedAt) {
      const dateValidation = this.validateDate(data.listedAt, 'listedAt');
      if (!dateValidation.isValid) {
        warnings.push(...dateValidation.warnings);
      }
    }

    // Cross-validation: soldAt should be after listedAt
    if (data.soldAt && data.listedAt) {
      const soldDate = new Date(data.soldAt);
      const listedDate = new Date(data.listedAt);
      
      if (soldDate < listedDate) {
        errors.push({
          field: 'soldAt',
          message: 'Sale date cannot be before listing date',
          severity: 'major',
          code: 'INVALID_DATE_ORDER'
        });
      }
    }

    const qualityScore = this.calculatePriceQualityScore(data, errors, warnings);

    return {
      isValid: errors.length === 0,
      score: qualityScore,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate card name for common issues
   */
  private static validateCardName(name: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Length check
    if (name.length < 2) {
      errors.push({
        field: 'name',
        message: 'Card name too short',
        severity: 'major',
        code: 'NAME_TOO_SHORT'
      });
    }

    if (name.length > 100) {
      warnings.push({
        field: 'name',
        message: 'Card name unusually long',
        impact: 'data_quality',
        suggestion: 'Verify name accuracy and remove unnecessary details'
      });
    }

    // Character validation
    const invalidChars = /[<>{}[\]\\|`~]/;
    if (invalidChars.test(name)) {
      warnings.push({
        field: 'name',
        message: 'Name contains potentially problematic characters',
        impact: 'data_quality',
        suggestion: 'Remove special characters that may cause parsing issues'
      });
    }

    // Pokemon-specific patterns
    const pokemonPatterns = {
      hasNumber: /\b\d+\b/.test(name), // Contains numbers (card numbers)
      hasSpecialChars: /[★♦♠♥]/.test(name), // Special symbols
      hasJapanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name), // Japanese characters
      isAllCaps: name === name.toUpperCase() && name.length > 3
    };

    if (pokemonPatterns.isAllCaps) {
      warnings.push({
        field: 'name',
        message: 'Name is all uppercase',
        impact: 'data_quality',
        suggestion: 'Consider proper case formatting for better readability'
      });
    }

    return {
      isValid: errors.length === 0,
      score: errors.length === 0 && warnings.length === 0 ? 1.0 : 0.8,
      errors,
      warnings
    };
  }

  /**
   * Validate set name patterns
   */
  private static validateSetName(set: string): ValidationResult {
    const warnings: ValidationWarning[] = [];

    // Common set name patterns for Pokemon
    const commonSets = [
      'base set', 'jungle', 'fossil', 'team rocket', 'gym heroes', 'gym challenge',
      'neo genesis', 'neo discovery', 'neo destiny', 'neo revelation',
      'expedition', 'aquapolis', 'skyridge', 'ruby sapphire', 'sandstorm',
      'dragon', 'team magma vs team aqua', 'hidden legends', 'firered leafgreen',
      'team rocket returns', 'deoxys', 'emerald', 'unseen forces', 'delta species',
      'legend maker', 'holon phantoms', 'crystal guardians', 'dragon frontiers',
      'power keepers', 'diamond pearl', 'mysterious treasures', 'secret wonders',
      'great encounters', 'majestic dawn', 'legends awakened', 'stormfront',
      'platinum', 'rising rivals', 'supreme victors', 'arceus', 'heartgold soulsilver',
      'unleashed', 'undaunted', 'triumphant', 'call of legends', 'black white',
      'emerging powers', 'noble victories', 'next destinies', 'dark explorers',
      'dragons exalted', 'boundaries crossed', 'plasma storm', 'plasma freeze',
      'plasma blast', 'legendary treasures', 'xy', 'flashfire', 'furious fists',
      'phantom forces', 'primal clash', 'roaring skies', 'ancient origins',
      'breakthrough', 'breakpoint', 'fates collide', 'steam siege', 'evolutions',
      'sun moon', 'guardians rising', 'burning shadows', 'crimson invasion',
      'ultra prism', 'forbidden light', 'celestial storm', 'dragon majesty',
      'lost thunder', 'team up', 'detective pikachu', 'unbroken bonds',
      'unified minds', 'hidden fates', 'cosmic eclipse', 'sword shield',
      'rebel clash', 'darkness ablaze', 'champions path', 'vivid voltage',
      'shining fates', 'battle styles', 'chilling reign', 'evolving skies',
      'celebrations', 'fusion strike', 'brilliant stars', 'astral radiance',
      'pokemon go', 'lost origin', 'silver tempest', 'crown zenith',
      'paldea evolved', 'obsidian flames', 'paldean fates', 'temporal forces'
    ];

    const setLower = set.toLowerCase();
    const isRecognizedSet = commonSets.some(knownSet => 
      setLower.includes(knownSet) || knownSet.includes(setLower)
    );

    if (!isRecognizedSet && set.length > 5) {
      warnings.push({
        field: 'set',
        message: 'Set name not recognized in common Pokemon sets',
        impact: 'data_quality',
        suggestion: 'Verify set name spelling and check against official set lists'
      });
    }

    return {
      isValid: true,
      score: isRecognizedSet ? 1.0 : 0.7,
      errors: [],
      warnings
    };
  }

  /**
   * Validate card number patterns
   */
  private static validateCardNumber(number: string): ValidationResult {
    const warnings: ValidationWarning[] = [];

    // Pokemon card number patterns
    const patterns = {
      numeric: /^\d+$/, // Just numbers: "25"
      withSlash: /^\d+\/\d+$/, // With total: "25/102"
      promo: /^(promo|p|promotional)/i, // Promo cards
      secret: /^\d+\/\d+.*secret/i, // Secret rare notation
      variant: /^\d+[a-z]$/ // Variant: "25a"
    };

    const matchesPattern = Object.values(patterns).some(pattern => pattern.test(number));

    if (!matchesPattern) {
      warnings.push({
        field: 'number',
        message: 'Card number format not recognized',
        impact: 'data_quality',
        suggestion: 'Use standard formats like "25/102" or verify number accuracy'
      });
    }

    // Length validation
    if (number.length > 20) {
      warnings.push({
        field: 'number',
        message: 'Card number unusually long',
        impact: 'data_quality',
        suggestion: 'Verify number accuracy'
      });
    }

    return {
      isValid: true,
      score: matchesPattern ? 1.0 : 0.6,
      errors: [],
      warnings
    };
  }

  /**
   * Validate condition values
   */
  private static validateCondition(condition: string): ValidationResult {
    const errors: ValidationError[] = [];
    const conditionLower = condition.toLowerCase().trim();

    const isValid = this.VALID_CONDITIONS.some(validCondition => 
      conditionLower === validCondition ||
      conditionLower.includes(validCondition) ||
      validCondition.includes(conditionLower)
    );

    if (!isValid) {
      errors.push({
        field: 'condition',
        message: `Invalid condition: ${condition}`,
        severity: 'major',
        code: 'INVALID_CONDITION'
      });
    }

    return {
      isValid,
      score: isValid ? 1.0 : 0.0,
      errors,
      warnings: []
    };
  }

  /**
   * Validate grade values
   */
  private static validateGrade(grade: string | number): ValidationResult {
    const warnings: ValidationWarning[] = [];
    
    let gradeValue: number;
    if (typeof grade === 'string') {
      // Handle PSA/BGS style grades
      const gradeMatch = grade.match(/(\d+(?:\.\d+)?)/);
      if (!gradeMatch) {
        warnings.push({
          field: 'grade',
          message: 'Unable to parse grade value',
          impact: 'data_quality',
          suggestion: 'Use numeric grades (1-10) or standard grading formats'
        });
        return { isValid: true, score: 0.5, errors: [], warnings };
      }
      gradeValue = parseFloat(gradeMatch[1]);
    } else {
      gradeValue = grade;
    }

    // Standard grading scale validation (1-10)
    if (gradeValue < 1 || gradeValue > 10) {
      warnings.push({
        field: 'grade',
        message: 'Grade outside typical range (1-10)',
        impact: 'data_quality',
        suggestion: 'Verify grade accuracy'
      });
    }

    return {
      isValid: true,
      score: gradeValue >= 1 && gradeValue <= 10 ? 1.0 : 0.6,
      errors: [],
      warnings
    };
  }

  /**
   * Validate URL format and accessibility
   */
  private static validateUrl(url: string): ValidationResult {
    const warnings: ValidationWarning[] = [];

    try {
      const urlObj = new URL(url);
      
      // Protocol validation
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        warnings.push({
          field: 'url',
          message: 'URL should use HTTP or HTTPS protocol',
          impact: 'data_quality',
          suggestion: 'Use secure HTTPS URLs when possible'
        });
      }

      // Domain validation for known marketplaces
      const knownDomains = ['ebay.com', 'goldinauctions.com', 'ha.com', 'tcgplayer.com'];
      const isKnownDomain = knownDomains.some(domain => urlObj.hostname.includes(domain));

      if (!isKnownDomain) {
        warnings.push({
          field: 'url',
          message: 'URL from unrecognized marketplace',
          impact: 'completeness',
          suggestion: 'Verify marketplace source for data quality'
        });
      }

    } catch (error) {
      warnings.push({
        field: 'url',
        message: 'Invalid URL format',
        impact: 'data_quality',
        suggestion: 'Provide valid URL starting with http:// or https://'
      });
    }

    return {
      isValid: true,
      score: warnings.length === 0 ? 1.0 : 0.7,
      errors: [],
      warnings
    };
  }

  /**
   * Validate date fields
   */
  private static validateDate(date: Date | string, fieldName: string): ValidationResult {
    const warnings: ValidationWarning[] = [];

    try {
      const dateObj = new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        warnings.push({
          field: fieldName,
          message: 'Invalid date format',
          impact: 'data_quality',
          suggestion: 'Use valid date format (ISO 8601 recommended)'
        });
        return { isValid: false, score: 0, errors: [], warnings };
      }

      // Future date validation
      if (dateObj > new Date()) {
        warnings.push({
          field: fieldName,
          message: 'Date is in the future',
          impact: 'data_quality',
          suggestion: 'Verify date accuracy'
        });
      }

      // Too old validation (Pokemon cards started in 1996)
      const pokemonStart = new Date('1996-01-01');
      if (dateObj < pokemonStart) {
        warnings.push({
          field: fieldName,
          message: 'Date predates Pokemon TCG',
          impact: 'data_quality',
          suggestion: 'Verify date accuracy'
        });
      }

    } catch (error) {
      warnings.push({
        field: fieldName,
        message: 'Unable to parse date',
        impact: 'data_quality',
        suggestion: 'Use standard date format'
      });
      return { isValid: false, score: 0, errors: [], warnings };
    }

    return {
      isValid: true,
      score: warnings.length === 0 ? 1.0 : 0.8,
      errors: [],
      warnings
    };
  }

  /**
   * Validate consistency between condition and grade
   */
  private static validateConditionGradeConsistency(
    condition: string,
    grade: string | number
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    const conditionLower = condition.toLowerCase();
    let gradeValue: number;

    // Parse grade
    if (typeof grade === 'string') {
      const gradeMatch = grade.match(/(\d+(?:\.\d+)?)/);
      gradeValue = gradeMatch ? parseFloat(gradeMatch[1]) : 0;
    } else {
      gradeValue = grade;
    }

    // Condition-grade mapping expectations
    const conditionRanges = {
      'mint': [9, 10],
      'near mint': [8, 9.5],
      'nm': [8, 9.5],
      'excellent': [7, 8.5],
      'ex': [7, 8.5],
      'very good': [5, 7.5],
      'vg': [5, 7.5],
      'good': [3, 6],
      'gd': [3, 6],
      'fair': [1, 4],
      'fr': [1, 4],
      'poor': [1, 3],
      'pr': [1, 3]
    };

    const expectedRange = Object.entries(conditionRanges).find(([cond]) => 
      conditionLower.includes(cond) || cond.includes(conditionLower)
    );

    if (expectedRange && gradeValue > 0) {
      const [, [minGrade, maxGrade]] = expectedRange;
      
      if (gradeValue < minGrade || gradeValue > maxGrade) {
        warnings.push({
          field: 'grade',
          message: `Grade ${gradeValue} inconsistent with condition "${condition}"`,
          impact: 'data_quality',
          suggestion: `Expected grade range for ${condition}: ${minGrade}-${maxGrade}`
        });

        suggestions.push(`Consider reviewing condition or grade - ${condition} typically grades ${minGrade}-${maxGrade}`);
      }
    }

    return {
      isValid: warnings.length === 0,
      score: warnings.length === 0 ? 1.0 : 0.6,
      errors: [],
      warnings,
      suggestions
    };
  }

  /**
   * Calculate overall data quality score
   */
  private static calculateDataQualityScore(
    data: CardDataInput,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    let score = 1.0;

    // Penalize errors more heavily
    const errorPenalty = errors.reduce((penalty, error) => {
      switch (error.severity) {
        case 'critical': return penalty - 0.3;
        case 'major': return penalty - 0.2;
        case 'minor': return penalty - 0.1;
        default: return penalty;
      }
    }, 0);

    // Penalize warnings less
    const warningPenalty = warnings.length * 0.05;

    // Bonus for completeness
    const completenessFields = ['name', 'set', 'number', 'condition', 'grade', 'price'];
    const providedFields = completenessFields.filter(field => 
      data[field as keyof CardDataInput] !== undefined && 
      data[field as keyof CardDataInput] !== null &&
      data[field as keyof CardDataInput] !== ''
    );
    const completenessBonus = (providedFields.length / completenessFields.length) * 0.1;

    score = Math.max(0, Math.min(1, score + errorPenalty - warningPenalty + completenessBonus));
    
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate price data quality score
   */
  private static calculatePriceQualityScore(
    data: PriceDataInput,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    let score = 1.0;

    // Error penalties
    score -= errors.length * 0.2;

    // Warning penalties
    score -= warnings.length * 0.1;

    // Completeness bonus
    const optionalFields = ['condition', 'grade', 'currency', 'soldAt', 'listedAt'];
    const providedOptional = optionalFields.filter(field => 
      data[field as keyof PriceDataInput] !== undefined
    );
    score += (providedOptional.length / optionalFields.length) * 0.1;

    return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  }
}

/**
 * Batch validation utilities for processing large datasets
 */
export class BatchValidator {
  /**
   * Validate multiple card records efficiently
   */
  static validateCardBatch(
    cards: CardDataInput[],
    options: {
      maxErrors?: number;
      stopOnCritical?: boolean;
      includeStats?: boolean;
    } = {}
  ): {
    results: ValidationResult[];
    summary: {
      totalRecords: number;
      validRecords: number;
      errorRecords: number;
      avgQualityScore: number;
      commonIssues: Array<{ issue: string; count: number }>;
    };
  } {
    const results: ValidationResult[] = [];
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];
    let totalScore = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const result = DataValidator.validateCardData(card);
      results.push(result);

      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      totalScore += result.score;

      // Stop on critical errors if requested
      if (options.stopOnCritical && result.errors.some(e => e.severity === 'critical')) {
        break;
      }

      // Limit total errors if requested
      if (options.maxErrors && allErrors.length >= options.maxErrors) {
        break;
      }
    }

    // Calculate summary statistics
    const validRecords = results.filter(r => r.isValid).length;
    const avgQualityScore = results.length > 0 ? totalScore / results.length : 0;

    // Find common issues
    const issueCount = new Map<string, number>();
    [...allErrors, ...allWarnings].forEach(issue => {
      const key = `${issue.field}: ${issue.message}`;
      issueCount.set(key, (issueCount.get(key) || 0) + 1);
    });

    const commonIssues = Array.from(issueCount.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 issues

    return {
      results,
      summary: {
        totalRecords: results.length,
        validRecords,
        errorRecords: results.length - validRecords,
        avgQualityScore: Math.round(avgQualityScore * 100) / 100,
        commonIssues
      }
    };
  }

  /**
   * Generate validation report for analysis
   */
  static generateValidationReport(
    results: ValidationResult[],
    options: { includeDetails?: boolean } = {}
  ): string {
    const totalRecords = results.length;
    const validRecords = results.filter(r => r.isValid).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalRecords;

    let report = `Data Validation Report\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `Total Records: ${totalRecords}\n`;
    report += `Valid Records: ${validRecords} (${((validRecords/totalRecords)*100).toFixed(1)}%)\n`;
    report += `Average Quality Score: ${(avgScore * 100).toFixed(1)}%\n\n`;

    // Error summary
    const allErrors = results.flatMap(r => r.errors);
    const errorsByType = new Map<string, number>();
    allErrors.forEach(error => {
      errorsByType.set(error.code, (errorsByType.get(error.code) || 0) + 1);
    });

    if (errorsByType.size > 0) {
      report += `Most Common Errors:\n`;
      Array.from(errorsByType.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([code, count]) => {
          report += `  ${code}: ${count} occurrences\n`;
        });
      report += '\n';
    }

    // Quality distribution
    const scoreRanges = {
      'Excellent (90-100%)': results.filter(r => r.score >= 0.9).length,
      'Good (70-89%)': results.filter(r => r.score >= 0.7 && r.score < 0.9).length,
      'Fair (50-69%)': results.filter(r => r.score >= 0.5 && r.score < 0.7).length,
      'Poor (0-49%)': results.filter(r => r.score < 0.5).length
    };

    report += `Quality Distribution:\n`;
    Object.entries(scoreRanges).forEach(([range, count]) => {
      const percentage = ((count / totalRecords) * 100).toFixed(1);
      report += `  ${range}: ${count} (${percentage}%)\n`;
    });

    return report;
  }
}
