/**
 * Outlier Detection Module
 *
 * Detects price outliers and suspicious listings using multiple methods:
 * - Statistical (IQR, Z-score, Modified Z-score)
 * - Domain-specific (grade premiums, condition mismatches)
 * - Behavioral (suspicious seller patterns, fraud indicators)
 *
 * MIT Recommendation: Robust outlier detection improves TFV accuracy
 *
 * Usage:
 *   const detector = new OutlierDetector();
 *   const analysis = detector.detectOutliers(listings);
 *   const flagged = analysis.outliers.filter(o => o.confidence > 0.8);
 */

// ============================================================================
// TYPES
// ============================================================================

export interface OutlierAnalysis {
  outliers: OutlierRecord[];
  statistics: OutlierStatistics;
  recommendations: string[];
}

export interface OutlierRecord {
  record: any;
  outlierType: OutlierType;
  confidence: number; // 0-1
  severity: OutlierSeverity;
  reasons: string[];
  statisticalMetrics: {
    zScore?: number;
    modifiedZScore?: number;
    iqrDistance?: number;
    percentileRank?: number;
  };
  suggestedAction: string;
}

export enum OutlierType {
  PRICE_TOO_HIGH = 'PRICE_TOO_HIGH',
  PRICE_TOO_LOW = 'PRICE_TOO_LOW',
  GRADE_MISMATCH = 'GRADE_MISMATCH',
  CONDITION_FRAUD = 'CONDITION_FRAUD',
  SELLER_SUSPICIOUS = 'SELLER_SUSPICIOUS',
  DATA_ERROR = 'DATA_ERROR',
  TEMPORAL_ANOMALY = 'TEMPORAL_ANOMALY',
}

export enum OutlierSeverity {
  CRITICAL = 'CRITICAL', // Likely fraud or error
  HIGH = 'HIGH', // Should investigate
  MEDIUM = 'MEDIUM', // May be legitimate outlier
  LOW = 'LOW', // Minor anomaly
}

export interface OutlierStatistics {
  totalRecords: number;
  totalOutliers: number;
  outlierRate: number;
  byType: Record<OutlierType, number>;
  bySeverity: Record<OutlierSeverity, number>;
  priceStats: {
    mean: number;
    median: number;
    stdDev: number;
    q1: number;
    q3: number;
    iqr: number;
    min: number;
    max: number;
  };
}

// ============================================================================
// OUTLIER DETECTOR
// ============================================================================

export class OutlierDetector {
  private config: OutlierDetectionConfig;

  constructor(config: Partial<OutlierDetectionConfig> = {}) {
    this.config = {
      methods: {
        useIQR: config.methods?.useIQR ?? true,
        useZScore: config.methods?.useZScore ?? true,
        useModifiedZScore: config.methods?.useModifiedZScore ?? true,
        useDomainRules: config.methods?.useDomainRules ?? true,
      },
      thresholds: {
        iqrMultiplier: config.thresholds?.iqrMultiplier ?? 1.5, // Standard IQR method
        zScoreThreshold: config.thresholds?.zScoreThreshold ?? 3.0, // 3 sigma
        modifiedZScoreThreshold: config.thresholds?.modifiedZScoreThreshold ?? 3.5,
        minSampleSize: config.thresholds?.minSampleSize ?? 10,
      },
      gradePremiums: config.gradePremiums ?? {
        PSA: { 10: 3.0, 9: 1.8, 8: 1.2, 7: 1.0 },
        BGS: { 10: 2.5, 9.5: 2.0, 9: 1.6, 8.5: 1.3, 8: 1.1 },
        CGC: { 10: 2.3, 9.5: 1.7, 9: 1.4, 8.5: 1.2, 8: 1.0 },
      },
    };
  }

  /**
   * Detect outliers in a dataset
   */
  detectOutliers(records: any[]): OutlierAnalysis {
    if (records.length < this.config.thresholds.minSampleSize) {
      return {
        outliers: [],
        statistics: this.emptyStatistics(),
        recommendations: ['Insufficient data for outlier detection (need at least 10 records)'],
      };
    }

    // Calculate price statistics
    const prices = records
      .map((r) => r.priceCents || r.soldPriceCents || 0)
      .filter((p) => p > 0);

    const priceStats = this.calculatePriceStatistics(prices);

    // Detect outliers using multiple methods
    const outliers: OutlierRecord[] = [];

    for (const record of records) {
      const price = record.priceCents || record.soldPriceCents || 0;
      if (price === 0) continue;

      const analysis = this.analyzeRecord(record, price, priceStats);
      if (analysis) {
        outliers.push(analysis);
      }
    }

    // Generate statistics
    const statistics: OutlierStatistics = {
      totalRecords: records.length,
      totalOutliers: outliers.length,
      outlierRate: outliers.length / records.length,
      byType: this.countByType(outliers),
      bySeverity: this.countBySeverity(outliers),
      priceStats,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(outliers, statistics);

    return { outliers, statistics, recommendations };
  }

  /**
   * Analyze a single record for outliers
   */
  private analyzeRecord(
    record: any,
    price: number,
    priceStats: OutlierStatistics['priceStats']
  ): OutlierRecord | null {
    const reasons: string[] = [];
    const metrics: OutlierRecord['statisticalMetrics'] = {};
    let isOutlier = false;
    let outlierType: OutlierType | null = null;
    let confidence = 0;
    let severity: OutlierSeverity = OutlierSeverity.LOW;

    // Statistical methods
    if (this.config.methods.useIQR) {
      const iqrResult = this.checkIQROutlier(price, priceStats);
      if (iqrResult.isOutlier) {
        isOutlier = true;
        reasons.push(iqrResult.reason);
        metrics.iqrDistance = iqrResult.distance;
        outlierType = price > priceStats.q3 ? OutlierType.PRICE_TOO_HIGH : OutlierType.PRICE_TOO_LOW;
        confidence = Math.max(confidence, iqrResult.confidence);
      }
    }

    if (this.config.methods.useZScore) {
      const zResult = this.checkZScoreOutlier(price, priceStats);
      if (zResult.isOutlier) {
        isOutlier = true;
        reasons.push(zResult.reason);
        metrics.zScore = zResult.zScore;
        confidence = Math.max(confidence, zResult.confidence);
      }
    }

    if (this.config.methods.useModifiedZScore) {
      const modZResult = this.checkModifiedZScoreOutlier(price, priceStats);
      if (modZResult.isOutlier) {
        isOutlier = true;
        reasons.push(modZResult.reason);
        metrics.modifiedZScore = modZResult.modifiedZScore;
        confidence = Math.max(confidence, modZResult.confidence);
      }
    }

    // Domain-specific rules
    if (this.config.methods.useDomainRules) {
      const domainResult = this.checkDomainRules(record, price, priceStats);
      if (domainResult.isOutlier) {
        isOutlier = true;
        reasons.push(...domainResult.reasons);
        outlierType = domainResult.type;
        confidence = Math.max(confidence, domainResult.confidence);
        severity = domainResult.severity;
      }
    }

    if (!isOutlier) return null;

    // Calculate percentile rank
    metrics.percentileRank = this.calculatePercentileRank(price, priceStats);

    // Determine severity if not set by domain rules
    if (severity === OutlierSeverity.LOW) {
      severity = this.determineSeverity(confidence, metrics);
    }

    // Suggested action
    const suggestedAction = this.suggestAction(outlierType!, severity);

    return {
      record,
      outlierType: outlierType!,
      confidence,
      severity,
      reasons,
      statisticalMetrics: metrics,
      suggestedAction,
    };
  }

  // ==========================================================================
  // STATISTICAL METHODS
  // ==========================================================================

  private checkIQROutlier(
    price: number,
    stats: OutlierStatistics['priceStats']
  ): { isOutlier: boolean; reason: string; distance: number; confidence: number } {
    const { q1, q3, iqr } = stats;
    const lowerBound = q1 - this.config.thresholds.iqrMultiplier * iqr;
    const upperBound = q3 + this.config.thresholds.iqrMultiplier * iqr;

    if (price < lowerBound) {
      const distance = (lowerBound - price) / iqr;
      return {
        isOutlier: true,
        reason: `Price $${(price / 100).toFixed(2)} is ${distance.toFixed(1)}x IQR below lower bound`,
        distance,
        confidence: Math.min(0.95, distance / 3), // More extreme = higher confidence
      };
    }

    if (price > upperBound) {
      const distance = (price - upperBound) / iqr;
      return {
        isOutlier: true,
        reason: `Price $${(price / 100).toFixed(2)} is ${distance.toFixed(1)}x IQR above upper bound`,
        distance,
        confidence: Math.min(0.95, distance / 3),
      };
    }

    return { isOutlier: false, reason: '', distance: 0, confidence: 0 };
  }

  private checkZScoreOutlier(
    price: number,
    stats: OutlierStatistics['priceStats']
  ): { isOutlier: boolean; reason: string; zScore: number; confidence: number } {
    const zScore = (price - stats.mean) / stats.stdDev;
    const absZ = Math.abs(zScore);

    if (absZ > this.config.thresholds.zScoreThreshold) {
      const direction = zScore > 0 ? 'above' : 'below';
      return {
        isOutlier: true,
        reason: `Z-score ${absZ.toFixed(2)} (${direction} mean by ${absZ.toFixed(1)} std devs)`,
        zScore: absZ,
        confidence: Math.min(0.95, absZ / 5),
      };
    }

    return { isOutlier: false, reason: '', zScore: absZ, confidence: 0 };
  }

  private checkModifiedZScoreOutlier(
    price: number,
    stats: OutlierStatistics['priceStats']
  ): { isOutlier: boolean; reason: string; modifiedZScore: number; confidence: number } {
    // Modified Z-score using median and MAD (more robust to outliers)
    const deviation = Math.abs(price - stats.median);
    const mad = this.calculateMAD(stats);
    const modifiedZScore = 0.6745 * (deviation / mad);

    if (modifiedZScore > this.config.thresholds.modifiedZScoreThreshold) {
      return {
        isOutlier: true,
        reason: `Modified Z-score ${modifiedZScore.toFixed(2)} (robust outlier detection)`,
        modifiedZScore,
        confidence: Math.min(0.95, modifiedZScore / 6),
      };
    }

    return { isOutlier: false, reason: '', modifiedZScore, confidence: 0 };
  }

  // ==========================================================================
  // DOMAIN-SPECIFIC RULES
  // ==========================================================================

  private checkDomainRules(
    record: any,
    price: number,
    stats: OutlierStatistics['priceStats']
  ): {
    isOutlier: boolean;
    reasons: string[];
    type: OutlierType;
    confidence: number;
    severity: OutlierSeverity;
  } {
    const reasons: string[] = [];
    let isOutlier = false;
    let confidence = 0;
    let severity = OutlierSeverity.LOW;
    let type = OutlierType.DATA_ERROR;

    // Rule 1: Grade premium mismatch
    const gradePremium = this.checkGradePremium(record, price, stats);
    if (gradePremium.isAnomaly) {
      isOutlier = true;
      reasons.push(gradePremium.reason);
      type = OutlierType.GRADE_MISMATCH;
      confidence = Math.max(confidence, gradePremium.confidence);
      severity = OutlierSeverity.HIGH;
    }

    // Rule 2: PSA 10 at raw card prices
    if (
      record.gradeCompany === 'PSA' &&
      record.grade === 10 &&
      price < 5000 // < $50
    ) {
      isOutlier = true;
      reasons.push(`PSA 10 priced at $${(price / 100).toFixed(2)} - likely data error or fraud`);
      type = OutlierType.CONDITION_FRAUD;
      confidence = Math.max(confidence, 0.9);
      severity = OutlierSeverity.CRITICAL;
    }

    // Rule 3: Extremely high prices (>$500k)
    if (price > 50000000) {
      isOutlier = true;
      reasons.push(`Extremely high price $${(price / 100).toFixed(0)} - verify authenticity`);
      type = OutlierType.PRICE_TOO_HIGH;
      confidence = Math.max(confidence, 0.7);
      severity = OutlierSeverity.HIGH;
    }

    // Rule 4: Extremely low prices (<$1)
    if (price < 100) {
      isOutlier = true;
      reasons.push(`Extremely low price $${(price / 100).toFixed(2)} - likely error or bulk lot`);
      type = OutlierType.PRICE_TOO_LOW;
      confidence = Math.max(confidence, 0.6);
      severity = OutlierSeverity.MEDIUM;
    }

    // Rule 5: Seller rating anomaly
    if (record.sellerRating !== undefined && record.sellerRating < 2.0 && price > 50000) {
      isOutlier = true;
      reasons.push(`High-value card ($${(price / 100).toFixed(0)}) from low-rated seller (${record.sellerRating.toFixed(1)})`);
      type = OutlierType.SELLER_SUSPICIOUS;
      confidence = Math.max(confidence, 0.7);
      severity = OutlierSeverity.HIGH;
    }

    // Rule 6: Graded card without grade value
    if (record.gradeCompany && record.gradeCompany !== 'RAW' && !record.grade) {
      isOutlier = true;
      reasons.push(`Grade company ${record.gradeCompany} specified but no grade value - data error`);
      type = OutlierType.DATA_ERROR;
      confidence = Math.max(confidence, 0.8);
      severity = OutlierSeverity.MEDIUM;
    }

    return { isOutlier, reasons, type, confidence, severity };
  }

  private checkGradePremium(
    record: any,
    price: number,
    stats: OutlierStatistics['priceStats']
  ): { isAnomaly: boolean; reason: string; confidence: number } {
    if (!record.gradeCompany || !record.grade) {
      return { isAnomaly: false, reason: '', confidence: 0 };
    }

    const premiums = this.config.gradePremiums[record.gradeCompany];
    if (!premiums) {
      return { isAnomaly: false, reason: '', confidence: 0 };
    }

    const expectedPremium = premiums[record.grade] || 1.0;
    const expectedPrice = stats.median * expectedPremium;

    // Check if price is significantly different from expected
    const deviation = Math.abs(price - expectedPrice) / expectedPrice;

    if (deviation > 0.5) {
      // >50% deviation from expected
      return {
        isAnomaly: true,
        reason: `${record.gradeCompany} ${record.grade} priced at $${(price / 100).toFixed(2)} but expected ~$${(expectedPrice / 100).toFixed(2)} (${(deviation * 100).toFixed(0)}% deviation)`,
        confidence: Math.min(0.9, deviation),
      };
    }

    return { isAnomaly: false, reason: '', confidence: 0 };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private calculatePriceStatistics(prices: number[]): OutlierStatistics['priceStats'] {
    const sorted = [...prices].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = sorted.reduce((sum, p) => sum + p, 0) / n;
    const median = sorted[Math.floor(n / 2)];

    const variance = sorted.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    return {
      mean,
      median,
      stdDev,
      q1,
      q3,
      iqr,
      min: sorted[0],
      max: sorted[n - 1],
    };
  }

  private calculateMAD(stats: OutlierStatistics['priceStats']): number {
    // Median Absolute Deviation (more robust than std dev)
    // Approximation: MAD ≈ 0.67 * stdDev for normal distribution
    return stats.stdDev * 0.67;
  }

  private calculatePercentileRank(
    price: number,
    stats: OutlierStatistics['priceStats']
  ): number {
    // Rough approximation
    if (price <= stats.q1) return 0.25;
    if (price <= stats.median) return 0.5;
    if (price <= stats.q3) return 0.75;
    return 0.95;
  }

  private determineSeverity(
    confidence: number,
    metrics: OutlierRecord['statisticalMetrics']
  ): OutlierSeverity {
    if (confidence >= 0.9) return OutlierSeverity.CRITICAL;
    if (confidence >= 0.75) return OutlierSeverity.HIGH;
    if (confidence >= 0.5) return OutlierSeverity.MEDIUM;
    return OutlierSeverity.LOW;
  }

  private suggestAction(type: OutlierType, severity: OutlierSeverity): string {
    if (severity === OutlierSeverity.CRITICAL) {
      return 'EXCLUDE from analysis - likely fraud or data error';
    }
    if (severity === OutlierSeverity.HIGH) {
      return 'FLAG for manual review before using in calculations';
    }
    if (severity === OutlierSeverity.MEDIUM) {
      return 'DOWNWEIGHT in TFV calculation (apply 0.5x weight)';
    }
    return 'MONITOR - may be legitimate outlier';
  }

  private countByType(outliers: OutlierRecord[]): Record<OutlierType, number> {
    const counts: any = {};
    for (const type of Object.values(OutlierType)) {
      counts[type] = outliers.filter((o) => o.outlierType === type).length;
    }
    return counts;
  }

  private countBySeverity(outliers: OutlierRecord[]): Record<OutlierSeverity, number> {
    const counts: any = {};
    for (const severity of Object.values(OutlierSeverity)) {
      counts[severity] = outliers.filter((o) => o.severity === severity).length;
    }
    return counts;
  }

  private generateRecommendations(
    outliers: OutlierRecord[],
    stats: OutlierStatistics
  ): string[] {
    const recommendations: string[] = [];

    const critical = outliers.filter((o) => o.severity === OutlierSeverity.CRITICAL);
    if (critical.length > 0) {
      recommendations.push(`CRITICAL: ${critical.length} records should be excluded from analysis`);
    }

    const high = outliers.filter((o) => o.severity === OutlierSeverity.HIGH);
    if (high.length > 0) {
      recommendations.push(`${high.length} records need manual review before inclusion`);
    }

    if (stats.outlierRate > 0.1) {
      recommendations.push(
        `High outlier rate (${(stats.outlierRate * 100).toFixed(1)}%) - consider data quality improvements`
      );
    }

    const priceTooLow = outliers.filter((o) => o.outlierType === OutlierType.PRICE_TOO_LOW);
    if (priceTooLow.length > 5) {
      recommendations.push(`${priceTooLow.length} suspiciously low prices detected - check for bulk lots or errors`);
    }

    return recommendations;
  }

  private emptyStatistics(): OutlierStatistics {
    return {
      totalRecords: 0,
      totalOutliers: 0,
      outlierRate: 0,
      byType: {} as any,
      bySeverity: {} as any,
      priceStats: {
        mean: 0,
        median: 0,
        stdDev: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        min: 0,
        max: 0,
      },
    };
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface OutlierDetectionConfig {
  methods: {
    useIQR: boolean;
    useZScore: boolean;
    useModifiedZScore: boolean;
    useDomainRules: boolean;
  };
  thresholds: {
    iqrMultiplier: number;
    zScoreThreshold: number;
    modifiedZScoreThreshold: number;
    minSampleSize: number;
  };
  gradePremiums: Record<string, Record<number, number>>;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default OutlierDetector;
