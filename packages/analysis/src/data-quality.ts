/**
 * Data Quality Scoring Engine
 *
 * Computes comprehensive data quality scores for listings, comps, and canonical cards.
 * Based on MIT recommendations for production data pipeline validation.
 *
 * Quality Dimensions:
 * - Completeness: Are required and important fields present?
 * - Accuracy: Are values within expected ranges?
 * - Consistency: Do related fields agree with each other?
 * - Timeliness: Is the data recent and fresh?
 * - Uniqueness: Is this a duplicate or unique record?
 *
 * Usage:
 *   const engine = new DataQualityEngine();
 *   const score = engine.scoreListing(listing);
 *   console.log(`Quality: ${score.overallScore.toFixed(2)} (${score.grade})`);
 */

// ============================================================================
// TYPES
// ============================================================================

export interface QualityScore {
  overallScore: number; // 0-1
  grade: QualityGrade; // A, B, C, D, F
  dimensions: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
  };
  issues: QualityIssue[];
  recommendations: string[];
  metadata: {
    evaluatedAt: Date;
    recordType: 'listing' | 'comp' | 'card';
    recordId?: string;
  };
}

export enum QualityGrade {
  A = 'A', // 0.9-1.0 - Excellent quality
  B = 'B', // 0.75-0.89 - Good quality
  C = 'C', // 0.6-0.74 - Fair quality
  D = 'D', // 0.4-0.59 - Poor quality
  F = 'F', // 0-0.39 - Failed quality
}

export interface QualityIssue {
  dimension: keyof QualityScore['dimensions'];
  severity: 'critical' | 'major' | 'minor' | 'info';
  field: string;
  message: string;
  impact: number; // -0.1 to -1.0
}

// ============================================================================
// DATA QUALITY ENGINE
// ============================================================================

export class DataQualityEngine {
  private config: QualityConfig;

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = {
      weights: {
        completeness: config.weights?.completeness ?? 0.3,
        accuracy: config.weights?.accuracy ?? 0.25,
        consistency: config.weights?.consistency ?? 0.2,
        timeliness: config.weights?.timeliness ?? 0.15,
        uniqueness: config.weights?.uniqueness ?? 0.1,
      },
      thresholds: {
        excellent: config.thresholds?.excellent ?? 0.9,
        good: config.thresholds?.good ?? 0.75,
        fair: config.thresholds?.fair ?? 0.6,
        poor: config.thresholds?.poor ?? 0.4,
      },
      staleDays: config.staleDays ?? 30,
    };
  }

  // ==========================================================================
  // LISTING QUALITY SCORING
  // ==========================================================================

  scoreListing(listing: any): QualityScore {
    const issues: QualityIssue[] = [];

    // Evaluate each dimension
    const completeness = this.evaluateListingCompleteness(listing, issues);
    const accuracy = this.evaluateListingAccuracy(listing, issues);
    const consistency = this.evaluateListingConsistency(listing, issues);
    const timeliness = this.evaluateListingTimeliness(listing, issues);
    const uniqueness = 1.0; // Computed externally (deduplication)

    // Calculate weighted overall score
    const overallScore =
      completeness * this.config.weights.completeness +
      accuracy * this.config.weights.accuracy +
      consistency * this.config.weights.consistency +
      timeliness * this.config.weights.timeliness +
      uniqueness * this.config.weights.uniqueness;

    const grade = this.calculateGrade(overallScore);
    const recommendations = this.generateRecommendations(issues);

    return {
      overallScore,
      grade,
      dimensions: { completeness, accuracy, consistency, timeliness, uniqueness },
      issues,
      recommendations,
      metadata: {
        evaluatedAt: new Date(),
        recordType: 'listing',
        recordId: listing.id,
      },
    };
  }

  private evaluateListingCompleteness(listing: any, issues: QualityIssue[]): number {
    let score = 1.0;

    // Required fields (critical)
    const requiredFields = ['title', 'priceCents', 'source'];
    for (const field of requiredFields) {
      if (!listing[field]) {
        issues.push({
          dimension: 'completeness',
          severity: 'critical',
          field,
          message: `Required field '${field}' is missing`,
          impact: -0.3,
        });
        score -= 0.3;
      }
    }

    // Important fields (major)
    const importantFields = ['cardName', 'setName', 'cardNumber'];
    let missingImportant = 0;
    for (const field of importantFields) {
      if (!listing[field]) {
        missingImportant++;
      }
    }
    if (missingImportant > 0) {
      const impact = -0.1 * missingImportant;
      issues.push({
        dimension: 'completeness',
        severity: 'major',
        field: 'card identification',
        message: `Missing ${missingImportant} important identification fields`,
        impact,
      });
      score += impact;
    }

    // Optional but valuable fields (minor)
    const optionalFields = ['gradeCompany', 'grade', 'condition', 'seller', 'sourceUrl'];
    let missingOptional = 0;
    for (const field of optionalFields) {
      if (!listing[field]) {
        missingOptional++;
      }
    }
    if (missingOptional > 3) {
      issues.push({
        dimension: 'completeness',
        severity: 'minor',
        field: 'metadata',
        message: `Missing ${missingOptional} optional metadata fields`,
        impact: -0.05,
      });
      score -= 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  private evaluateListingAccuracy(listing: any, issues: QualityIssue[]): number {
    let score = 1.0;

    // Price reasonability
    if (listing.priceCents !== undefined) {
      if (listing.priceCents < 100) {
        issues.push({
          dimension: 'accuracy',
          severity: 'major',
          field: 'priceCents',
          message: `Price ${listing.priceCents} cents is unrealistically low (<$1)`,
          impact: -0.2,
        });
        score -= 0.2;
      } else if (listing.priceCents > 100000000) {
        issues.push({
          dimension: 'accuracy',
          severity: 'major',
          field: 'priceCents',
          message: `Price ${listing.priceCents} cents is unrealistically high (>$1M)`,
          impact: -0.2,
        });
        score -= 0.2;
      }
    }

    // Grade range validation
    if (listing.grade !== undefined) {
      if (listing.grade < 1 || listing.grade > 10) {
        issues.push({
          dimension: 'accuracy',
          severity: 'major',
          field: 'grade',
          message: `Grade ${listing.grade} is out of valid range (1-10)`,
          impact: -0.15,
        });
        score -= 0.15;
      }
    }

    // Card number format
    if (listing.cardNumber) {
      // Check for invalid patterns
      if (/^\d{10,}$/.test(listing.cardNumber)) {
        issues.push({
          dimension: 'accuracy',
          severity: 'minor',
          field: 'cardNumber',
          message: `Card number ${listing.cardNumber} appears to be malformed`,
          impact: -0.05,
        });
        score -= 0.05;
      }
    }

    // Title quality
    if (listing.title) {
      if (listing.title.length < 10) {
        issues.push({
          dimension: 'accuracy',
          severity: 'minor',
          field: 'title',
          message: 'Title is very short (<10 chars)',
          impact: -0.05,
        });
        score -= 0.05;
      }
      if (/test|dummy|placeholder/i.test(listing.title)) {
        issues.push({
          dimension: 'accuracy',
          severity: 'critical',
          field: 'title',
          message: 'Title contains test/dummy data',
          impact: -0.5,
        });
        score -= 0.5;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private evaluateListingConsistency(listing: any, issues: QualityIssue[]): number {
    let score = 1.0;

    // Grade consistency
    if (listing.gradeCompany && listing.gradeCompany !== 'RAW' && !listing.grade) {
      issues.push({
        dimension: 'consistency',
        severity: 'major',
        field: 'grade',
        message: `Grade company ${listing.gradeCompany} specified but no grade value`,
        impact: -0.15,
      });
      score -= 0.15;
    }

    if (listing.grade && !listing.gradeCompany) {
      issues.push({
        dimension: 'consistency',
        severity: 'major',
        field: 'gradeCompany',
        message: 'Grade value specified but no grading company',
        impact: -0.15,
      });
      score -= 0.15;
    }

    // Price vs grade consistency
    if (
      listing.priceCents &&
      listing.gradeCompany === 'PSA' &&
      listing.grade === 10 &&
      listing.priceCents < 10000
    ) {
      issues.push({
        dimension: 'consistency',
        severity: 'minor',
        field: 'priceCents',
        message: 'PSA 10 card priced unusually low (<$100)',
        impact: -0.1,
      });
      score -= 0.1;
    }

    // High-value cards should have grade
    if (listing.priceCents > 100000 && !listing.gradeCompany) {
      issues.push({
        dimension: 'consistency',
        severity: 'minor',
        field: 'gradeCompany',
        message: 'High-value card (>$1000) missing grade info',
        impact: -0.1,
      });
      score -= 0.1;
    }

    // Source consistency
    if (listing.source && listing.sourceUrl) {
      const urlLower = listing.sourceUrl.toLowerCase();
      const sourceLower = listing.source.toLowerCase();

      // Check if URL matches source
      if (sourceLower === 'ebay' && !urlLower.includes('ebay')) {
        issues.push({
          dimension: 'consistency',
          severity: 'major',
          field: 'sourceUrl',
          message: 'Source is EBAY but URL does not contain "ebay"',
          impact: -0.2,
        });
        score -= 0.2;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private evaluateListingTimeliness(listing: any, issues: QualityIssue[]): number {
    let score = 1.0;

    const now = Date.now();

    // Check listing date
    if (listing.listedAt) {
      const listedDate = new Date(listing.listedAt);
      const daysSinceListed = (now - listedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceListed > this.config.staleDays) {
        const impact = Math.min(-0.3, -0.01 * (daysSinceListed - this.config.staleDays));
        issues.push({
          dimension: 'timeliness',
          severity: 'minor',
          field: 'listedAt',
          message: `Listing is ${Math.round(daysSinceListed)} days old (stale)`,
          impact,
        });
        score += impact;
      }

      // Future date (data error)
      if (listedDate.getTime() > now) {
        issues.push({
          dimension: 'timeliness',
          severity: 'major',
          field: 'listedAt',
          message: 'Listing date is in the future',
          impact: -0.2,
        });
        score -= 0.2;
      }
    }

    // Check last seen
    if (listing.lastSeenAt) {
      const lastSeenDate = new Date(listing.lastSeenAt);
      const daysSinceLastSeen = (now - lastSeenDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastSeen > 7 && listing.isActive) {
        issues.push({
          dimension: 'timeliness',
          severity: 'minor',
          field: 'lastSeenAt',
          message: `Active listing not seen in ${Math.round(daysSinceLastSeen)} days`,
          impact: -0.1,
        });
        score -= 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  // ==========================================================================
  // COMP SALE QUALITY SCORING
  // ==========================================================================

  scoreCompSale(comp: any): QualityScore {
    const issues: QualityIssue[] = [];

    const completeness = this.evaluateCompCompleteness(comp, issues);
    const accuracy = this.evaluateCompAccuracy(comp, issues);
    const consistency = this.evaluateCompConsistency(comp, issues);
    const timeliness = this.evaluateCompTimeliness(comp, issues);
    const uniqueness = 1.0;

    const overallScore =
      completeness * this.config.weights.completeness +
      accuracy * this.config.weights.accuracy +
      consistency * this.config.weights.consistency +
      timeliness * this.config.weights.timeliness +
      uniqueness * this.config.weights.uniqueness;

    const grade = this.calculateGrade(overallScore);
    const recommendations = this.generateRecommendations(issues);

    return {
      overallScore,
      grade,
      dimensions: { completeness, accuracy, consistency, timeliness, uniqueness },
      issues,
      recommendations,
      metadata: {
        evaluatedAt: new Date(),
        recordType: 'comp',
        recordId: comp.id,
      },
    };
  }

  private evaluateCompCompleteness(comp: any, issues: QualityIssue[]): number {
    let score = 1.0;

    const requiredFields = ['soldPriceCents', 'soldAt', 'cardName', 'source'];
    for (const field of requiredFields) {
      if (!comp[field]) {
        issues.push({
          dimension: 'completeness',
          severity: 'critical',
          field,
          message: `Required field '${field}' is missing`,
          impact: -0.25,
        });
        score -= 0.25;
      }
    }

    const importantFields = ['setName', 'cardNumber'];
    let missingImportant = 0;
    for (const field of importantFields) {
      if (!comp[field]) missingImportant++;
    }
    if (missingImportant > 0) {
      issues.push({
        dimension: 'completeness',
        severity: 'major',
        field: 'identification',
        message: `Missing ${missingImportant} important identification fields`,
        impact: -0.1 * missingImportant,
      });
      score -= 0.1 * missingImportant;
    }

    return Math.max(0, Math.min(1, score));
  }

  private evaluateCompAccuracy(comp: any, issues: QualityIssue[]): number {
    let score = 1.0;

    // Price validation
    if (comp.soldPriceCents !== undefined) {
      if (comp.soldPriceCents < 100) {
        issues.push({
          dimension: 'accuracy',
          severity: 'major',
          field: 'soldPriceCents',
          message: `Sold price ${comp.soldPriceCents} cents is unrealistically low`,
          impact: -0.2,
        });
        score -= 0.2;
      } else if (comp.soldPriceCents > 50000000) {
        // >$500k is extreme outlier
        issues.push({
          dimension: 'accuracy',
          severity: 'minor',
          field: 'soldPriceCents',
          message: `Sold price ${comp.soldPriceCents} cents is extremely high (>$500k)`,
          impact: -0.1,
        });
        score -= 0.1;
      }
    }

    // Grade validation
    if (comp.grade !== undefined && (comp.grade < 1 || comp.grade > 10)) {
      issues.push({
        dimension: 'accuracy',
        severity: 'major',
        field: 'grade',
        message: `Grade ${comp.grade} is out of valid range`,
        impact: -0.15,
      });
      score -= 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  private evaluateCompConsistency(comp: any, issues: QualityIssue[]): number {
    let score = 1.0;

    // Grade consistency
    if (comp.gradeCompany && comp.gradeCompany !== 'RAW' && !comp.grade) {
      issues.push({
        dimension: 'consistency',
        severity: 'major',
        field: 'grade',
        message: 'Grade company specified but no grade value',
        impact: -0.15,
      });
      score -= 0.15;
    }

    // PSA 10 low price
    if (
      comp.soldPriceCents &&
      comp.gradeCompany === 'PSA' &&
      comp.grade === 10 &&
      comp.soldPriceCents < 5000
    ) {
      issues.push({
        dimension: 'consistency',
        severity: 'minor',
        field: 'soldPriceCents',
        message: 'PSA 10 sold for less than $50 - verify authenticity',
        impact: -0.1,
      });
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private evaluateCompTimeliness(comp: any, issues: QualityIssue[]): number {
    let score = 1.0;

    if (comp.soldAt) {
      const soldDate = new Date(comp.soldAt);
      const now = Date.now();
      const daysSinceSale = (now - soldDate.getTime()) / (1000 * 60 * 60 * 24);

      // Future sale date
      if (soldDate.getTime() > now) {
        issues.push({
          dimension: 'timeliness',
          severity: 'critical',
          field: 'soldAt',
          message: 'Sale date is in the future',
          impact: -0.3,
        });
        score -= 0.3;
      }

      // Old sale (>180 days)
      if (daysSinceSale > 180) {
        issues.push({
          dimension: 'timeliness',
          severity: 'info',
          field: 'soldAt',
          message: `Sale is ${Math.round(daysSinceSale)} days old - may not reflect current market`,
          impact: -0.05,
        });
        score -= 0.05;
      }

      // Very old sale (>365 days)
      if (daysSinceSale > 365) {
        issues.push({
          dimension: 'timeliness',
          severity: 'minor',
          field: 'soldAt',
          message: `Sale is over 1 year old (${Math.round(daysSinceSale)} days)`,
          impact: -0.15,
        });
        score -= 0.15;
      }

      // Pre-2020 (too old for pricing)
      if (soldDate.getFullYear() < 2020) {
        issues.push({
          dimension: 'timeliness',
          severity: 'major',
          field: 'soldAt',
          message: 'Sale is from before 2020 - not reliable for current pricing',
          impact: -0.3,
        });
        score -= 0.3;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  // ==========================================================================
  // CANONICAL CARD QUALITY SCORING
  // ==========================================================================

  scoreCanonicalCard(card: any): QualityScore {
    const issues: QualityIssue[] = [];

    const completeness = this.evaluateCardCompleteness(card, issues);
    const accuracy = this.evaluateCardAccuracy(card, issues);
    const consistency = 1.0; // N/A for canonical cards
    const timeliness = 1.0; // N/A for canonical cards
    const uniqueness = 1.0; // Should be unique by definition

    const overallScore =
      completeness * 0.5 + // Higher weight for completeness
      accuracy * 0.5;

    const grade = this.calculateGrade(overallScore);
    const recommendations = this.generateRecommendations(issues);

    return {
      overallScore,
      grade,
      dimensions: { completeness, accuracy, consistency, timeliness, uniqueness },
      issues,
      recommendations,
      metadata: {
        evaluatedAt: new Date(),
        recordType: 'card',
        recordId: card.id,
      },
    };
  }

  private evaluateCardCompleteness(card: any, issues: QualityIssue[]): number {
    let score = 1.0;

    if (!card.canonicalName) {
      issues.push({
        dimension: 'completeness',
        severity: 'critical',
        field: 'canonicalName',
        message: 'Canonical name is missing',
        impact: -0.4,
      });
      score -= 0.4;
    }

    if (!card.canonicalSet) {
      issues.push({
        dimension: 'completeness',
        severity: 'critical',
        field: 'canonicalSet',
        message: 'Canonical set is missing',
        impact: -0.4,
      });
      score -= 0.4;
    }

    const importantFields = ['rarity', 'cardNumber', 'types'];
    let missing = 0;
    for (const field of importantFields) {
      if (!card[field] || (Array.isArray(card[field]) && card[field].length === 0)) {
        missing++;
      }
    }
    if (missing > 0) {
      issues.push({
        dimension: 'completeness',
        severity: 'minor',
        field: 'metadata',
        message: `Missing ${missing} important metadata fields`,
        impact: -0.05 * missing,
      });
      score -= 0.05 * missing;
    }

    return Math.max(0, Math.min(1, score));
  }

  private evaluateCardAccuracy(card: any, issues: QualityIssue[]): number {
    let score = 1.0;

    if (card.hp !== undefined && (card.hp < 10 || card.hp > 500)) {
      issues.push({
        dimension: 'accuracy',
        severity: 'minor',
        field: 'hp',
        message: `HP ${card.hp} is outside typical range (10-500)`,
        impact: -0.1,
      });
      score -= 0.1;
    }

    if (card.canonicalName && /undefined|null|test/i.test(card.canonicalName)) {
      issues.push({
        dimension: 'accuracy',
        severity: 'critical',
        field: 'canonicalName',
        message: 'Canonical name contains invalid data',
        impact: -0.5,
      });
      score -= 0.5;
    }

    return Math.max(0, Math.min(1, score));
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private calculateGrade(score: number): QualityGrade {
    if (score >= this.config.thresholds.excellent) return QualityGrade.A;
    if (score >= this.config.thresholds.good) return QualityGrade.B;
    if (score >= this.config.thresholds.fair) return QualityGrade.C;
    if (score >= this.config.thresholds.poor) return QualityGrade.D;
    return QualityGrade.F;
  }

  private generateRecommendations(issues: QualityIssue[]): string[] {
    const recommendations: string[] = [];
    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    const majorIssues = issues.filter((i) => i.severity === 'major');

    if (criticalIssues.length > 0) {
      recommendations.push(
        `Fix ${criticalIssues.length} critical issues immediately to improve quality`
      );
    }

    if (majorIssues.length > 0) {
      recommendations.push(`Address ${majorIssues.length} major issues to reach higher quality`);
    }

    // Field-specific recommendations
    const missingFields = issues
      .filter((i) => i.dimension === 'completeness')
      .map((i) => i.field);
    if (missingFields.length > 0) {
      recommendations.push(`Enrich data with missing fields: ${missingFields.join(', ')}`);
    }

    const consistencyIssues = issues.filter((i) => i.dimension === 'consistency');
    if (consistencyIssues.length > 0) {
      recommendations.push('Review data for logical consistency errors');
    }

    return recommendations;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface QualityConfig {
  weights: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
  };
  thresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  staleDays: number;
}

// ============================================================================
// BATCH QUALITY ANALYSIS
// ============================================================================

export class BatchQualityAnalyzer {
  private engine: DataQualityEngine;

  constructor(config: Partial<QualityConfig> = {}) {
    this.engine = new DataQualityEngine(config);
  }

  async analyzeListings(listings: any[]): Promise<BatchQualityReport> {
    const scores = listings.map((l) => this.engine.scoreListing(l));

    return this.generateReport(scores, 'listings');
  }

  async analyzeCompSales(comps: any[]): Promise<BatchQualityReport> {
    const scores = comps.map((c) => this.engine.scoreCompSale(c));

    return this.generateReport(scores, 'comps');
  }

  async analyzeCanonicalCards(cards: any[]): Promise<BatchQualityReport> {
    const scores = cards.map((c) => this.engine.scoreCanonicalCard(c));

    return this.generateReport(scores, 'cards');
  }

  private generateReport(scores: QualityScore[], type: string): BatchQualityReport {
    const total = scores.length;
    const avgScore = scores.reduce((sum, s) => sum + s.overallScore, 0) / total;

    const gradeDistribution = {
      A: scores.filter((s) => s.grade === QualityGrade.A).length,
      B: scores.filter((s) => s.grade === QualityGrade.B).length,
      C: scores.filter((s) => s.grade === QualityGrade.C).length,
      D: scores.filter((s) => s.grade === QualityGrade.D).length,
      F: scores.filter((s) => s.grade === QualityGrade.F).length,
    };

    const allIssues = scores.flatMap((s) => s.issues);
    const criticalIssues = allIssues.filter((i) => i.severity === 'critical').length;
    const majorIssues = allIssues.filter((i) => i.severity === 'major').length;
    const minorIssues = allIssues.filter((i) => i.severity === 'minor').length;

    const dimensionAverages = {
      completeness: scores.reduce((sum, s) => sum + s.dimensions.completeness, 0) / total,
      accuracy: scores.reduce((sum, s) => sum + s.dimensions.accuracy, 0) / total,
      consistency: scores.reduce((sum, s) => sum + s.dimensions.consistency, 0) / total,
      timeliness: scores.reduce((sum, s) => sum + s.dimensions.timeliness, 0) / total,
      uniqueness: scores.reduce((sum, s) => sum + s.dimensions.uniqueness, 0) / total,
    };

    return {
      recordType: type,
      totalRecords: total,
      averageScore: avgScore,
      gradeDistribution,
      dimensionAverages,
      issuesSummary: {
        critical: criticalIssues,
        major: majorIssues,
        minor: minorIssues,
        total: allIssues.length,
      },
      scores,
    };
  }
}

export interface BatchQualityReport {
  recordType: string;
  totalRecords: number;
  averageScore: number;
  gradeDistribution: Record<QualityGrade, number>;
  dimensionAverages: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
  };
  issuesSummary: {
    critical: number;
    major: number;
    minor: number;
    total: number;
  };
  scores: QualityScore[];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DataQualityEngine;
