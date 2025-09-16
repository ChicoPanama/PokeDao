/**
 * DATA QUALITY MONITORING SYSTEM
 * ==============================
 * Real-time monitoring and alerting for data integrity
 */

import { PrismaClient } from '@prisma/client';

export interface QualityMetrics {
  overallScore: number;
  cardQuality: number;
  listingQuality: number;
  opportunityQuality: number;
  dataFreshness: number;
  completeness: number;
  consistency: number;
  issues: QualityIssue[];
  recommendations: string[];
  lastChecked: Date;
}

export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  count: number;
  affectedRecords: string[];
}

export class DataQualityMonitor {
  private prisma: PrismaClient;
  private qualityThresholds = {
    minCardQuality: 0.8,
    minListingQuality: 0.8,
    minOpportunityQuality: 0.8,
    maxDataAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    minCompleteness: 0.9
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Run comprehensive quality assessment
   */
  async assessDataQuality(): Promise<QualityMetrics> {
    console.log('🔍 Running comprehensive data quality assessment...');

    const [
      cardQuality,
      listingQuality,
      opportunityQuality,
      dataFreshness,
      completeness,
      consistency
    ] = await Promise.all([
      this.assessCardQuality(),
      this.assessListingQuality(),
      this.assessOpportunityQuality(),
      this.assessDataFreshness(),
      this.assessCompleteness(),
      this.assessConsistency()
    ]);

    const issues = await this.identifyQualityIssues();
    const recommendations = this.generateRecommendations(issues);

    const overallScore = (
      cardQuality +
      listingQuality +
      opportunityQuality +
      dataFreshness +
      completeness +
      consistency
    ) / 6;

    return {
      overallScore,
      cardQuality,
      listingQuality,
      opportunityQuality,
      dataFreshness,
      completeness,
      consistency,
      issues,
      recommendations,
      lastChecked: new Date()
    };
  }

  /**
   * Assess card data quality
   */
  private async assessCardQuality(): Promise<number> {
    const totalCards = await this.prisma.card.count();
    if (totalCards === 0) return 0;

    const validCards = await this.prisma.card.count({
      where: {
        isValidated: true,
        validationScore: { gte: 0.8 }
      }
    });

    const cardsWithRequiredFields = await this.prisma.card.count({
      where: {
        name: { not: '' },
        setCode: { not: '' },
        number: { not: '' },
        cardKey: { not: null }
      }
    });

    const qualityScore = (validCards + cardsWithRequiredFields) / (totalCards * 2);
    return Math.min(qualityScore, 1.0);
  }

  /**
   * Assess listing data quality
   */
  private async assessListingQuality(): Promise<number> {
    const totalListings = await this.prisma.listing.count();
    if (totalListings === 0) return 0;

    const validListings = await this.prisma.listing.count({
      where: {
        price: { gt: 0 },
        source: { not: '' },
        externalId: { not: '' },
        url: { not: '' }
      }
    });

    const activeListings = await this.prisma.listing.count({
      where: { isActive: true }
    });

    const qualityScore = (validListings + activeListings) / (totalListings * 2);
    return Math.min(qualityScore, 1.0);
  }

  /**
   * Assess opportunity data quality
   */
  private async assessOpportunityQuality(): Promise<number> {
    const totalOpportunities = await this.prisma.opportunity.count();
    if (totalOpportunities === 0) return 0;

    const validOpportunities = await this.prisma.opportunity.count({
      where: {
        netSpreadBps: { gte: 0 },
        confidence: { gte: 0, lte: 1 },
        expectedProfitCents: { gte: 0 },
        isValidated: true
      }
    });

    const qualityScore = validOpportunities / totalOpportunities;
    return Math.min(qualityScore, 1.0);
  }

  /**
   * Assess data freshness
   */
  private async assessDataFreshness(): Promise<number> {
    const now = new Date();
    const maxAge = this.qualityThresholds.maxDataAge;

    const recentListings = await this.prisma.listing.count({
      where: {
        scrapedAt: { gte: new Date(now.getTime() - maxAge) }
      }
    });

    const totalListings = await this.prisma.listing.count();
    if (totalListings === 0) return 0;

    const freshnessScore = recentListings / totalListings;
    return Math.min(freshnessScore, 1.0);
  }

  /**
   * Assess data completeness
   */
  private async assessCompleteness(): Promise<number> {
    const totalCards = await this.prisma.card.count();
    if (totalCards === 0) return 0;

    const cardsWithListings = await this.prisma.card.count({
      where: {
        listings: { some: {} }
      }
    });

    const cardsWithComps = await this.prisma.card.count({
      where: {
        compSales: { some: {} }
      }
    });

    const completenessScore = (cardsWithListings + cardsWithComps) / (totalCards * 2);
    return Math.min(completenessScore, 1.0);
  }

  /**
   * Assess data consistency
   */
  private async assessConsistency(): Promise<number> {
    // Check for naming consistency
    const inconsistentNames = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Card"
      WHERE "normalizedName" IS NULL OR "normalizedName" = ''
    ` as Array<{ count: number }>;

    const totalCards = await this.prisma.card.count();
    if (totalCards === 0) return 0;

    const consistencyScore = 1 - (inconsistentNames[0]?.count || 0) / totalCards;
    return Math.max(consistencyScore, 0);
  }

  /**
   * Identify specific quality issues
   */
  private async identifyQualityIssues(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Check for invalid cards
    const invalidCards = await this.prisma.card.findMany({
      where: {
        OR: [
          { name: { equals: '' } },
          { setCode: { equals: '' } },
          { number: { equals: '' } },
          { cardKey: null }
        ]
      },
      select: { id: true }
    });

    if (invalidCards.length > 0) {
      issues.push({
        type: 'error',
        severity: 'high',
        category: 'Card Validation',
        message: 'Cards with missing required fields',
        count: invalidCards.length,
        affectedRecords: invalidCards.map(c => c.id)
      });
    }

    // Check for duplicate cards
    const duplicateCards = await this.prisma.$queryRaw`
      SELECT "cardKey", COUNT(*) as count
      FROM "Card"
      WHERE "cardKey" IS NOT NULL
      GROUP BY "cardKey"
      HAVING COUNT(*) > 1
    ` as Array<{ cardKey: string; count: number }>;

    if (duplicateCards.length > 0) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        category: 'Duplicates',
        message: 'Duplicate cards found',
        count: duplicateCards.length,
        affectedRecords: duplicateCards.map(d => d.cardKey)
      });
    }

    // Check for stale data
    const staleListings = await this.prisma.listing.count({
      where: {
        scrapedAt: { lt: new Date(Date.now() - this.qualityThresholds.maxDataAge) }
      }
    });

    if (staleListings > 0) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        category: 'Data Freshness',
        message: 'Stale listing data detected',
        count: staleListings,
        affectedRecords: []
      });
    }

    // Check for orphaned records
    const orphanedListings = await this.prisma.listing.count({
      where: { card: null }
    });

    if (orphanedListings > 0) {
      issues.push({
        type: 'error',
        severity: 'high',
        category: 'Referential Integrity',
        message: 'Orphaned listings found',
        count: orphanedListings,
        affectedRecords: []
      });
    }

    // Check for invalid opportunities
    const invalidOpportunities = await this.prisma.opportunity.count({
      where: {
        OR: [
          { netSpreadBps: { lt: 0 } },
          { confidence: { lt: 0 } },
          { confidence: { gt: 1 } },
          { expectedProfitCents: { lt: 0 } }
        ]
      }
    });

    if (invalidOpportunities > 0) {
      issues.push({
        type: 'error',
        severity: 'high',
        category: 'Opportunity Validation',
        message: 'Invalid opportunity data found',
        count: invalidOpportunities,
        affectedRecords: []
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: QualityIssue[]): string[] {
    const recommendations: string[] = [];

    const highSeverityIssues = issues.filter(i => i.severity === 'high');
    const mediumSeverityIssues = issues.filter(i => i.severity === 'medium');

    if (highSeverityIssues.length > 0) {
      recommendations.push('🚨 CRITICAL: Address high-severity data quality issues immediately');
    }

    if (mediumSeverityIssues.length > 0) {
      recommendations.push('⚠️ WARNING: Review medium-severity data quality issues');
    }

    if (issues.some(i => i.category === 'Duplicates')) {
      recommendations.push('🔄 Run deduplication process to remove duplicate records');
    }

    if (issues.some(i => i.category === 'Data Freshness')) {
      recommendations.push('🔄 Update stale data by running data collection processes');
    }

    if (issues.some(i => i.category === 'Referential Integrity')) {
      recommendations.push('🔗 Fix referential integrity issues by cleaning orphaned records');
    }

    if (issues.some(i => i.category === 'Card Validation')) {
      recommendations.push('✅ Run card validation process to fix invalid card data');
    }

    if (issues.some(i => i.category === 'Opportunity Validation')) {
      recommendations.push('📊 Review and fix invalid opportunity calculations');
    }

    return recommendations;
  }

  /**
   * Store quality metrics in database
   */
  async storeQualityMetrics(metrics: QualityMetrics): Promise<void> {
    // Store overall metrics
    await this.prisma.dataQuality.create({
      data: {
        entityType: 'System',
        entityId: 'overall',
        qualityScore: metrics.overallScore,
        issues: metrics.issues.map(i => `${i.severity}: ${i.message}`),
        recommendations: metrics.recommendations,
        isValid: metrics.overallScore >= 0.8
      }
    });

    // Store individual component metrics
    const components = [
      { type: 'Card', score: metrics.cardQuality },
      { type: 'Listing', score: metrics.listingQuality },
      { type: 'Opportunity', score: metrics.opportunityQuality },
      { type: 'Freshness', score: metrics.dataFreshness },
      { type: 'Completeness', score: metrics.completeness },
      { type: 'Consistency', score: metrics.consistency }
    ];

    for (const component of components) {
      await this.prisma.dataQuality.create({
        data: {
          entityType: 'Component',
          entityId: component.type,
          qualityScore: component.score,
          issues: [],
          recommendations: [],
          isValid: component.score >= 0.8
        }
      });
    }
  }

  /**
   * Get quality trend over time
   */
  async getQualityTrend(days: number = 7): Promise<Array<{ date: Date; score: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.prisma.dataQuality.findMany({
      where: {
        entityType: 'System',
        entityId: 'overall',
        checkedAt: { gte: startDate }
      },
      orderBy: { checkedAt: 'asc' },
      select: { qualityScore: true, checkedAt: true }
    });

    return metrics.map(m => ({
      date: m.checkedAt,
      score: m.qualityScore
    }));
  }

  /**
   * Check if data quality meets minimum thresholds
   */
  isDataQualityAcceptable(metrics: QualityMetrics): boolean {
    return (
      metrics.overallScore >= 0.8 &&
      metrics.cardQuality >= this.qualityThresholds.minCardQuality &&
      metrics.listingQuality >= this.qualityThresholds.minListingQuality &&
      metrics.opportunityQuality >= this.qualityThresholds.minOpportunityQuality &&
      metrics.completeness >= this.qualityThresholds.minCompleteness
    );
  }
}
