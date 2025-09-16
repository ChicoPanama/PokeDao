/**
 * DATA INTEGRITY VALIDATION ENGINE
 * ================================
 * Ensures 10/10 data integrity with comprehensive validation
 */

import { PrismaClient } from '@prisma/client';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0.0 to 1.0
  issues: string[];
  recommendations: string[];
}

export interface CardValidationData {
  name: string;
  setCode: string;
  number: string;
  variant?: string;
  grade?: string;
  condition?: string;
  language?: string;
}

export interface ListingValidationData {
  source: string;
  externalId: string;
  price: number;
  currency: string;
  url: string;
  cardId: string;
}

export class DataValidator {
  private prisma: PrismaClient;
  private validSetCodes: Set<string>;
  private validSources: Set<string>;
  private validCurrencies: Set<string>;
  private validLanguages: Set<string>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.validSetCodes = new Set([
      'base1', 'jungle', 'fossil', 'teamrocket', 'gymheroes', 'gymchallenge',
      'neogenesis', 'neodiscovery', 'neorevelation', 'neodestiny',
      'exruby', 'exsapphire', 'exsandstorm', 'exdragon', 'exmagma', 'exhidden',
      'exfirered', 'exleafgreen', 'exteamrocket', 'exdeoxys', 'exemerald',
      'exunseen', 'exdelta', 'exlegend', 'exholon', 'excrystal', 'exdragon',
      'dpplatinum', 'dpplatinum2', 'dpplatinum3', 'dpplatinum4', 'dpplatinum5',
      'bw1', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6', 'bw7', 'bw8', 'bw9', 'bw10',
      'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'xy6', 'xy7', 'xy8', 'xy9', 'xy10',
      'sm1', 'sm2', 'sm3', 'sm4', 'sm5', 'sm6', 'sm7', 'sm8', 'sm9', 'sm10',
      'swsh1', 'swsh2', 'swsh3', 'swsh4', 'swsh5', 'swsh6', 'swsh7', 'swsh8', 'swsh9', 'swsh10',
      'sv1', 'sv2', 'sv3', 'sv4', 'sv5', 'sv6', 'sv7', 'sv8', 'sv9', 'sv10'
    ]);
    
    this.validSources = new Set([
      'ebay', 'tcgplayer', 'collectorcrypt', 'phygitals', 'cardmarket', 'trollandtoad'
    ]);
    
    this.validCurrencies = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);
    this.validLanguages = new Set(['EN', 'JP', 'FR', 'DE', 'ES', 'IT']);
  }

  /**
   * Validate card data with comprehensive checks
   */
  async validateCard(data: CardValidationData): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 1.0;

    // Required field validation
    if (!data.name || data.name.trim().length < 2) {
      issues.push('Card name is required and must be at least 2 characters');
      score -= 0.3;
    }

    if (!data.setCode || !this.validSetCodes.has(data.setCode)) {
      issues.push(`Invalid set code: ${data.setCode}. Must be a valid Pokemon set code.`);
      score -= 0.3;
    }

    if (!data.number || !/^[0-9]+[a-z]?$/i.test(data.number)) {
      issues.push('Card number must be numeric with optional letter suffix (e.g., "4", "15a")');
      score -= 0.2;
    }

    // Optional field validation
    if (data.language && !this.validLanguages.has(data.language)) {
      issues.push(`Invalid language code: ${data.language}`);
      score -= 0.1;
    }

    if (data.grade && !this.isValidGrade(data.grade)) {
      issues.push(`Invalid grade format: ${data.grade}`);
      score -= 0.1;
    }

    if (data.condition && !this.isValidCondition(data.condition)) {
      issues.push(`Invalid condition: ${data.condition}`);
      score -= 0.1;
    }

    // Business logic validation
    if (data.name && data.name.length > 100) {
      issues.push('Card name is too long (max 100 characters)');
      score -= 0.1;
    }

    // Check for duplicates
    const existingCard = await this.prisma.card.findFirst({
      where: {
        setCode: data.setCode,
        number: data.number,
        variant: data.variant || null,
        grade: data.grade || null,
        language: data.language || 'EN'
      }
    });

    if (existingCard) {
      issues.push('Duplicate card found with same set, number, variant, grade, and language');
      score -= 0.2;
    }

    // Generate recommendations
    if (score < 0.8) {
      recommendations.push('Review and correct validation issues before proceeding');
    }

    if (!data.variant && this.shouldHaveVariant(data.name)) {
      recommendations.push('Consider adding variant information (holo, reverse, etc.)');
    }

    return {
      isValid: score >= 0.8,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  /**
   * Validate listing data
   */
  async validateListing(data: ListingValidationData): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 1.0;

    // Required field validation
    if (!data.source || !this.validSources.has(data.source)) {
      issues.push(`Invalid source: ${data.source}. Must be one of: ${Array.from(this.validSources).join(', ')}`);
      score -= 0.3;
    }

    if (!data.externalId || data.externalId.trim().length < 1) {
      issues.push('External ID is required');
      score -= 0.3;
    }

    if (!data.price || data.price <= 0) {
      issues.push('Price must be greater than 0');
      score -= 0.2;
    }

    if (!data.currency || !this.validCurrencies.has(data.currency)) {
      issues.push(`Invalid currency: ${data.currency}`);
      score -= 0.1;
    }

    if (!data.url || !this.isValidUrl(data.url)) {
      issues.push('Invalid URL format');
      score -= 0.1;
    }

    // Check if card exists
    const card = await this.prisma.card.findUnique({
      where: { id: data.cardId }
    });

    if (!card) {
      issues.push('Referenced card does not exist');
      score -= 0.3;
    }

    // Check for duplicate listings
    const existingListing = await this.prisma.listing.findFirst({
      where: {
        source: data.source,
        externalId: data.externalId
      }
    });

    if (existingListing) {
      issues.push('Duplicate listing found with same source and external ID');
      score -= 0.2;
    }

    // Price reasonableness check
    if (data.price > 100000) {
      issues.push('Price seems unreasonably high (>$100,000)');
      score -= 0.1;
    }

    return {
      isValid: score >= 0.8,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  /**
   * Validate opportunity data
   */
  async validateOpportunity(data: any): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 1.0;

    // Required field validation
    if (!data.cardId) {
      issues.push('Card ID is required');
      score -= 0.2;
    }

    if (!data.listingId) {
      issues.push('Listing ID is required');
      score -= 0.2;
    }

    if (data.netSpreadBps < 0) {
      issues.push('Net spread cannot be negative');
      score -= 0.2;
    }

    if (data.confidence < 0 || data.confidence > 1) {
      issues.push('Confidence must be between 0 and 1');
      score -= 0.2;
    }

    if (data.expectedProfitCents < 0) {
      issues.push('Expected profit cannot be negative');
      score -= 0.2;
    }

    // Business logic validation
    if (data.netSpreadBps > 5000) { // 50% spread
      issues.push('Spread seems unreasonably high (>50%)');
      score -= 0.1;
    }

    if (data.confidence < 0.5) {
      recommendations.push('Consider increasing confidence threshold for better opportunities');
    }

    return {
      isValid: score >= 0.8,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  /**
   * Generate canonical card key
   */
  generateCardKey(data: CardValidationData): string {
    const setPart = data.setCode.toLowerCase();
    const numberPart = data.number.padStart(3, '0');
    const variantPart = (data.variant || 'base').toLowerCase().replace(/[^a-z0-9]/g, '');
    const gradePart = (data.grade || 'raw').toLowerCase().replace(/[^a-z0-9]/g, '');
    const langPart = (data.language || 'en').toLowerCase();
    
    return `${setPart}-${numberPart}-${variantPart}-${gradePart}-${langPart}`;
  }

  /**
   * Normalize card name
   */
  normalizeCardName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-'é.δ]/g, '')
      .substring(0, 100);
  }

  /**
   * Check if grade format is valid
   */
  private isValidGrade(grade: string): boolean {
    const gradePatterns = [
      /^raw$/i,
      /^psa\s*\d+(?:\.5)?$/i,
      /^bgs\s*\d+(?:\.5)?$/i,
      /^cgc\s*\d+(?:\.5)?$/i,
      /^sgc\s*\d+(?:\.5)?$/i
    ];
    
    return gradePatterns.some(pattern => pattern.test(grade));
  }

  /**
   * Check if condition is valid
   */
  private isValidCondition(condition: string): boolean {
    const validConditions = [
      'Gem Mint', 'Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor'
    ];
    
    return validConditions.some(valid => 
      condition.toLowerCase().includes(valid.toLowerCase())
    );
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if card should have variant information
   */
  private shouldHaveVariant(name: string): boolean {
    const variantIndicators = ['holo', 'reverse', 'alt', 'secret', 'rainbow', 'gold'];
    return variantIndicators.some(indicator => 
      name.toLowerCase().includes(indicator)
    );
  }

  /**
   * Run comprehensive data quality check
   */
  async runDataQualityCheck(): Promise<{
    totalCards: number;
    validCards: number;
    invalidCards: number;
    averageScore: number;
    issues: string[];
  }> {
    const cards = await this.prisma.card.findMany();
    let validCards = 0;
    let invalidCards = 0;
    let totalScore = 0;
    const allIssues: string[] = [];

    for (const card of cards) {
      const validation = await this.validateCard({
        name: card.name,
        setCode: card.setCode,
        number: card.number,
        variant: card.variant || undefined,
        grade: card.grade || undefined,
        condition: card.condition || undefined,
        language: card.language
      });

      totalScore += validation.score;
      allIssues.push(...validation.issues);

      if (validation.isValid) {
        validCards++;
      } else {
        invalidCards++;
      }

      // Update card validation status
      await this.prisma.card.update({
        where: { id: card.id },
        data: {
          isValidated: true,
          validationScore: validation.score,
          lastValidated: new Date()
        }
      });
    }

    return {
      totalCards: cards.length,
      validCards,
      invalidCards,
      averageScore: cards.length > 0 ? totalScore / cards.length : 0,
      issues: [...new Set(allIssues)] // Remove duplicates
    };
  }
}
