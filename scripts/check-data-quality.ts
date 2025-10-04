/**
 * Data Quality Checks for UnifiedMarketListing
 *
 * This script:
 * 1. Checks for missing critical fields (images, prices, card info)
 * 2. Identifies invalid/suspicious data (negative prices, extreme grades)
 * 3. Detects duplicates and data inconsistencies
 * 4. Reports quality metrics by source
 * 5. Suggests data cleanup actions
 *
 * Run: pnpm tsx scripts/check-data-quality.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

interface QualityIssue {
  id: string;
  source: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  suggestion?: string;
}

interface QualityMetrics {
  totalRecords: number;
  bySource: Record<string, SourceMetrics>;
  overallQuality: number;
  issues: QualityIssue[];
}

interface SourceMetrics {
  total: number;
  missingCardName: number;
  missingSetName: number;
  missingCardNumber: number;
  missingGrade: number;
  invalidPrice: number;
  extremeGrade: number;
  lowDataQuality: number;
  qualityScore: number;
}

// ============================================================================
// QUALITY CHECKER
// ============================================================================

class DataQualityChecker {
  private issues: QualityIssue[] = [];
  private metrics: Record<string, SourceMetrics> = {};

  /**
   * Check a single listing for quality issues
   */
  checkListing(listing: any): void {
    const source = listing.source;

    // Initialize metrics for source
    if (!this.metrics[source]) {
      this.metrics[source] = {
        total: 0,
        missingCardName: 0,
        missingSetName: 0,
        missingCardNumber: 0,
        missingGrade: 0,
        invalidPrice: 0,
        extremeGrade: 0,
        lowDataQuality: 0,
        qualityScore: 0,
      };
    }

    this.metrics[source].total++;

    // Missing critical card identification fields
    if (!listing.cardName || listing.cardName.trim() === '' || listing.cardName === 'Unknown') {
      this.metrics[source].missingCardName++;
      this.addIssue(listing, 'missing_data', 'warning',
        'Missing or unknown card name',
        'Review raw title parsing logic');
    }

    if (!listing.setName || listing.setName.trim() === '' || listing.setName === 'Unknown') {
      this.metrics[source].missingSetName++;
      this.addIssue(listing, 'missing_data', 'warning',
        'Missing or unknown set name',
        'Review raw title parsing logic');
    }

    if (!listing.cardNumber || listing.cardNumber.trim() === '') {
      this.metrics[source].missingCardNumber++;
      this.addIssue(listing, 'missing_data', 'info',
        'Missing card number',
        'May be normal for some card types');
    }

    // Missing grading info
    if (!listing.gradeCompany || !listing.grade) {
      this.metrics[source].missingGrade++;
      this.addIssue(listing, 'missing_data', 'info',
        'Missing grading information',
        'Card may be raw/ungraded');
    }

    // Invalid pricing
    if (listing.priceCents < 0) {
      this.metrics[source].invalidPrice++;
      this.addIssue(listing, 'invalid_data', 'critical',
        `Negative price: ${listing.priceCents} cents`,
        'Fix pricing data in source');
    }

    if (listing.priceCents === 0 && listing.source !== 'PHYGITALS' && listing.source !== 'COURTYARD') {
      this.metrics[source].invalidPrice++;
      this.addIssue(listing, 'suspicious_data', 'warning',
        'Zero price',
        'Verify if listing is actually free or missing price');
    }

    if (listing.priceCents > 100000000) { // > $1M
      this.metrics[source].invalidPrice++;
      this.addIssue(listing, 'suspicious_data', 'warning',
        `Extremely high price: $${(listing.priceCents / 100).toFixed(2)}`,
        'Verify price is correct');
    }

    // Extreme/invalid grades
    if (listing.grade !== null && listing.grade !== undefined) {
      if (listing.grade < 0) {
        this.metrics[source].extremeGrade++;
        this.addIssue(listing, 'invalid_data', 'warning',
          `Negative grade: ${listing.grade}`,
          'Fix grade parsing logic');
      }

      if (listing.grade > 10) {
        this.metrics[source].extremeGrade++;
        this.addIssue(listing, 'invalid_data', 'warning',
          `Grade exceeds 10: ${listing.grade}`,
          'Verify grade format (e.g., BGS 10.5 subgrades)');
      }
    }

    // Low data quality score
    if (listing.dataQuality !== null && listing.dataQuality !== undefined) {
      if (listing.dataQuality < 0.5) {
        this.metrics[source].lowDataQuality++;
        this.addIssue(listing, 'quality_score', 'info',
          `Low data quality score: ${listing.dataQuality}`,
          'Review and improve data parsing');
      }
    }
  }

  /**
   * Add a quality issue
   */
  private addIssue(
    listing: any,
    category: string,
    severity: 'critical' | 'warning' | 'info',
    description: string,
    suggestion?: string
  ) {
    this.issues.push({
      id: listing.id,
      source: listing.source,
      category,
      severity,
      description,
      suggestion,
    });
  }

  /**
   * Generate quality metrics report
   */
  generateReport(totalRecords: number): QualityMetrics {
    // Calculate quality scores for each source
    for (const [source, metrics] of Object.entries(this.metrics)) {
      const issueCount =
        metrics.missingCardName +
        metrics.missingSetName +
        metrics.invalidPrice +
        metrics.extremeGrade +
        metrics.lowDataQuality;

      // Quality score: 1.0 - (issues / total)
      metrics.qualityScore = metrics.total > 0
        ? 1.0 - (issueCount / metrics.total)
        : 0;
    }

    // Calculate overall quality
    const totalIssues = this.issues.filter(i => i.severity !== 'info').length;
    const overallQuality = 1.0 - (totalIssues / totalRecords);

    return {
      totalRecords,
      bySource: this.metrics,
      overallQuality,
      issues: this.issues,
    };
  }

  /**
   * Get all issues
   */
  getIssues(): QualityIssue[] {
    return this.issues;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔍 DATA QUALITY CHECK');
  console.log('=' .repeat(60));
  console.log('📊 Analyzing UnifiedMarketListing data quality\n');

  const prisma = new PrismaClient();
  const checker = new DataQualityChecker();

  try {
    // Fetch all listings
    console.log('📥 Fetching listings from database...');
    const listings = await prisma.unifiedMarketListing.findMany({
      orderBy: { source: 'asc' },
    });

    console.log(`✓ Loaded ${listings.length.toLocaleString()} listings\n`);

    // Check each listing
    console.log('🔍 Running quality checks...\n');

    for (const listing of listings) {
      checker.checkListing(listing);
    }

    // Generate report
    const report = checker.generateReport(listings.length);

    console.log('='.repeat(60));
    console.log('📊 DATA QUALITY REPORT');
    console.log('='.repeat(60));
    console.log(`Total Records: ${report.totalRecords.toLocaleString()}`);
    console.log(`Overall Quality Score: ${(report.overallQuality * 100).toFixed(1)}%\n`);

    // Quality by source
    console.log('📦 Quality Metrics by Source:\n');

    for (const [source, metrics] of Object.entries(report.bySource)) {
      console.log(`${source}:`);
      console.log(`  Total: ${metrics.total.toLocaleString()}`);
      console.log(`  Quality Score: ${(metrics.qualityScore * 100).toFixed(1)}%`);

      if (metrics.missingCardName > 0) {
        console.log(`  ⚠️  Missing card name: ${metrics.missingCardName.toLocaleString()} (${((metrics.missingCardName / metrics.total) * 100).toFixed(1)}%)`);
      }

      if (metrics.missingSetName > 0) {
        console.log(`  ⚠️  Missing set name: ${metrics.missingSetName.toLocaleString()} (${((metrics.missingSetName / metrics.total) * 100).toFixed(1)}%)`);
      }

      if (metrics.missingCardNumber > 0) {
        console.log(`  ℹ️  Missing card number: ${metrics.missingCardNumber.toLocaleString()} (${((metrics.missingCardNumber / metrics.total) * 100).toFixed(1)}%)`);
      }

      if (metrics.missingGrade > 0) {
        console.log(`  ℹ️  Missing grade: ${metrics.missingGrade.toLocaleString()} (${((metrics.missingGrade / metrics.total) * 100).toFixed(1)}%)`);
      }

      if (metrics.invalidPrice > 0) {
        console.log(`  🚨 Invalid/suspicious price: ${metrics.invalidPrice.toLocaleString()}`);
      }

      if (metrics.extremeGrade > 0) {
        console.log(`  ⚠️  Extreme grade values: ${metrics.extremeGrade.toLocaleString()}`);
      }

      if (metrics.lowDataQuality > 0) {
        console.log(`  ⚠️  Low quality score: ${metrics.lowDataQuality.toLocaleString()}`);
      }

      console.log();
    }

    // Issue summary
    const criticalIssues = report.issues.filter(i => i.severity === 'critical');
    const warnings = report.issues.filter(i => i.severity === 'warning');
    const infos = report.issues.filter(i => i.severity === 'info');

    console.log('📋 Issue Summary:');
    console.log(`  🚨 Critical: ${criticalIssues.length.toLocaleString()}`);
    console.log(`  ⚠️  Warnings: ${warnings.length.toLocaleString()}`);
    console.log(`  ℹ️  Info: ${infos.length.toLocaleString()}`);
    console.log();

    // Sample critical issues
    if (criticalIssues.length > 0) {
      console.log('🚨 Sample Critical Issues (first 5):');
      criticalIssues.slice(0, 5).forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.source}] ${issue.description}`);
        console.log(`     ID: ${issue.id}`);
        if (issue.suggestion) {
          console.log(`     💡 ${issue.suggestion}`);
        }
        console.log();
      });
    }

    // Recommendations
    console.log('='.repeat(60));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(60));

    const recommendations: string[] = [];

    for (const [source, metrics] of Object.entries(report.bySource)) {
      if (metrics.missingCardName > metrics.total * 0.1) {
        recommendations.push(`${source}: Improve card name parsing (${((metrics.missingCardName / metrics.total) * 100).toFixed(1)}% missing)`);
      }

      if (metrics.missingSetName > metrics.total * 0.1) {
        recommendations.push(`${source}: Improve set name parsing (${((metrics.missingSetName / metrics.total) * 100).toFixed(1)}% missing)`);
      }

      if (metrics.invalidPrice > 0) {
        recommendations.push(`${source}: Fix pricing data issues (${metrics.invalidPrice} records)`);
      }

      if (metrics.extremeGrade > 0) {
        recommendations.push(`${source}: Review grade parsing logic (${metrics.extremeGrade} extreme values)`);
      }
    }

    if (recommendations.length > 0) {
      recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    } else {
      console.log('✅ No major issues found!');
    }

    console.log('='.repeat(60));

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
