#!/usr/bin/env tsx
/**
 * MIT Integration Phase B: Comprehensive Data Quality Report
 *
 * Generates a detailed quality assessment of your entire database
 * to establish a baseline before MIT integration.
 *
 * Run: tsx scripts/mit-phase-b-quality-report.ts
 */

import { PrismaClient } from '@prisma/client';
import { BatchQualityAnalyzer, DataQualityEngine } from '../packages/analysis/src/data-quality';
import FuzzyMatcher from '../packages/shared/fuzzy-matcher';
import { OutlierDetector } from '../packages/analysis/src/outlier-detection';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface QualityReport {
  generatedAt: Date;
  database: DatabaseStats;
  listings: ListingQualityReport;
  compSales: CompSalesQualityReport;
  canonicalCards: CanonicalCardsQualityReport;
  dataIssues: DataIssue[];
  recommendations: Recommendation[];
  baseline: QualityBaseline;
}

interface DatabaseStats {
  totalListings: number;
  totalCompSales: number;
  totalCanonicalCards: number;
  activeListings: number;
  sources: Record<string, number>;
  dateRange: { earliest: Date | null; latest: Date | null };
}

interface ListingQualityReport {
  totalAnalyzed: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
  };
  commonIssues: Array<{ issue: string; count: number }>;
  sourceQuality: Record<string, number>;
}

interface CompSalesQualityReport {
  totalAnalyzed: number;
  averageScore: number;
  outlierRate: number;
  priceRange: { min: number; max: number; median: number };
  ageDistribution: { avg: number; oldest: number; newest: number };
}

interface CanonicalCardsQualityReport {
  totalAnalyzed: number;
  averageScore: number;
  withPricing: number;
  withMetadata: number;
  coverage: number;
}

interface DataIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
  affected: number;
  examples?: any[];
}

interface Recommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  expectedImpact: string;
  effort: string;
}

interface QualityBaseline {
  overallScore: number;
  dataCompleteness: number;
  dataAccuracy: number;
  marketCoverage: number;
  pricingReliability: number;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 MIT INTEGRATION PHASE B: DATA QUALITY REPORT');
  console.log('='.repeat(70) + '\n');

  const report: QualityReport = {
    generatedAt: new Date(),
    database: await analyzeDatabaseStats(),
    listings: await analyzeListingQuality(),
    compSales: await analyzeCompSalesQuality(),
    canonicalCards: await analyzeCanonicalCardsQuality(),
    dataIssues: [],
    recommendations: [],
    baseline: {
      overallScore: 0,
      dataCompleteness: 0,
      dataAccuracy: 0,
      marketCoverage: 0,
      pricingReliability: 0,
    },
  };

  // Identify data issues
  report.dataIssues = await identifyDataIssues(report);

  // Generate recommendations
  report.recommendations = generateRecommendations(report);

  // Calculate baseline scores
  report.baseline = calculateBaseline(report);

  // Print report
  printReport(report);

  // Save to file
  const reportsDir = path.join(process.cwd(), 'logs', 'quality-reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(reportsDir, `quality-report-${timestamp}.json`);
  const mdPath = path.join(reportsDir, `quality-report-${timestamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, generateMarkdownReport(report));

  console.log(`\n📄 Reports saved:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Markdown: ${mdPath}\n`);

  await prisma.$disconnect();
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

async function analyzeDatabaseStats(): Promise<DatabaseStats> {
  console.log('🔍 Analyzing database statistics...\n');

  const [totalListings, totalCompSales, totalCanonicalCards, activeListings] = await Promise.all([
    prisma.marketListing.count().catch(() => 0),
    prisma.compSale ? prisma.compSale.count().catch(() => 0) : 0,
    prisma.canonicalCard ? prisma.canonicalCard.count().catch(() => 0) : 0,
    prisma.marketListing.count({ where: { isActive: true } }).catch(() => 0),
  ]);

  // Get source distribution
  const sourceGroups = await prisma.marketListing
    .groupBy({
      by: ['source'],
      _count: true,
    })
    .catch(() => []);

  const sources: Record<string, number> = {};
  sourceGroups.forEach(g => {
    sources[g.source] = g._count;
  });

  // Get date range
  const [earliest, latest] = await Promise.all([
    prisma.marketListing
      .findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
      .catch(() => null),
    prisma.marketListing
      .findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      .catch(() => null),
  ]);

  const stats = {
    totalListings,
    totalCompSales,
    totalCanonicalCards,
    activeListings,
    sources,
    dateRange: {
      earliest: earliest?.createdAt || null,
      latest: latest?.createdAt || null,
    },
  };

  console.log(`   ✓ Total Listings: ${totalListings.toLocaleString()}`);
  console.log(`   ✓ Active Listings: ${activeListings.toLocaleString()}`);
  console.log(`   ✓ Comp Sales: ${totalCompSales.toLocaleString()}`);
  console.log(`   ✓ Canonical Cards: ${totalCanonicalCards.toLocaleString()}`);
  console.log(`   ✓ Sources: ${Object.keys(sources).length}`);

  return stats;
}

async function analyzeListingQuality(): Promise<ListingQualityReport> {
  console.log('\n📋 Analyzing listing quality...\n');

  const sampleSize = 500;
  const listings = await prisma.marketListing.findMany({
    take: sampleSize,
    orderBy: { createdAt: 'desc' },
  });

  if (listings.length === 0) {
    console.log('   ⚠️ No listings found\n');
    return {
      totalAnalyzed: 0,
      averageScore: 0,
      gradeDistribution: {},
      dimensionScores: { completeness: 0, accuracy: 0, consistency: 0, timeliness: 0 },
      commonIssues: [],
      sourceQuality: {},
    };
  }

  const analyzer = new BatchQualityAnalyzer();
  const batchReport = await analyzer.analyzeListings(listings);

  // Calculate source quality
  const sourceQuality: Record<string, number> = {};
  const sourceGroups = new Map<string, any[]>();

  listings.forEach(listing => {
    const source = listing.source;
    if (!sourceGroups.has(source)) {
      sourceGroups.set(source, []);
    }
    sourceGroups.get(source)!.push(listing);
  });

  for (const [source, items] of sourceGroups.entries()) {
    const sourceReport = await analyzer.analyzeListings(items);
    sourceQuality[source] = sourceReport.averageScore;
  }

  // Extract common issues
  const issueMap = new Map<string, number>();
  batchReport.scores.forEach(score => {
    score.issues.forEach(issue => {
      const key = `${issue.dimension}: ${issue.message}`;
      issueMap.set(key, (issueMap.get(key) || 0) + 1);
    });
  });

  const commonIssues = Array.from(issueMap.entries())
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const report: ListingQualityReport = {
    totalAnalyzed: batchReport.totalRecords,
    averageScore: batchReport.averageScore,
    gradeDistribution: batchReport.gradeDistribution,
    dimensionScores: batchReport.dimensionAverages,
    commonIssues,
    sourceQuality,
  };

  console.log(`   ✓ Analyzed: ${report.totalAnalyzed} listings`);
  console.log(`   ✓ Average Quality: ${report.averageScore.toFixed(2)}`);
  console.log(`   ✓ Completeness: ${report.dimensionScores.completeness.toFixed(2)}`);
  console.log(`   ✓ Accuracy: ${report.dimensionScores.accuracy.toFixed(2)}`);
  console.log(`   ✓ Consistency: ${report.dimensionScores.consistency.toFixed(2)}`);

  return report;
}

async function analyzeCompSalesQuality(): Promise<CompSalesQualityReport> {
  console.log('\n💰 Analyzing comp sales quality...\n');

  const comps = await prisma.compSale
    ? await prisma.compSale.findMany({
        take: 500,
        where: { priceCents: { gt: 0 } },
        orderBy: { soldAt: 'desc' },
      })
    : [];

  if (comps.length === 0) {
    console.log('   ⚠️ No comp sales found\n');
    return {
      totalAnalyzed: 0,
      averageScore: 0,
      outlierRate: 0,
      priceRange: { min: 0, max: 0, median: 0 },
      ageDistribution: { avg: 0, oldest: 0, newest: 0 },
    };
  }

  // Quality scoring
  const analyzer = new BatchQualityAnalyzer();
  const batchReport = await analyzer.analyzeCompSales(comps);

  // Outlier detection
  const detector = new OutlierDetector();
  const outlierAnalysis = detector.detectOutliers(comps);

  // Price analysis
  const prices = comps.map(c => c.priceCents).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];

  // Age analysis
  const now = Date.now();
  const ages = comps.map(c => (now - new Date(c.soldAt).getTime()) / (1000 * 60 * 60 * 24));
  const avgAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;

  const report: CompSalesQualityReport = {
    totalAnalyzed: comps.length,
    averageScore: batchReport.averageScore,
    outlierRate: outlierAnalysis.statistics.outlierRate,
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices),
      median,
    },
    ageDistribution: {
      avg: avgAge,
      oldest: Math.max(...ages),
      newest: Math.min(...ages),
    },
  };

  console.log(`   ✓ Analyzed: ${report.totalAnalyzed} comp sales`);
  console.log(`   ✓ Average Quality: ${report.averageScore.toFixed(2)}`);
  console.log(`   ✓ Outlier Rate: ${(report.outlierRate * 100).toFixed(1)}%`);
  console.log(`   ✓ Median Price: $${(report.priceRange.median / 100).toFixed(2)}`);
  console.log(`   ✓ Average Age: ${report.ageDistribution.avg.toFixed(0)} days`);

  return report;
}

async function analyzeCanonicalCardsQuality(): Promise<CanonicalCardsQualityReport> {
  console.log('\n🃏 Analyzing canonical cards quality...\n');

  const cards = await prisma.canonicalCard
    ? await prisma.canonicalCard.findMany({ take: 500 })
    : [];

  if (cards.length === 0) {
    console.log('   ⚠️ No canonical cards found\n');
    return {
      totalAnalyzed: 0,
      averageScore: 0,
      withPricing: 0,
      withMetadata: 0,
      coverage: 0,
    };
  }

  const analyzer = new BatchQualityAnalyzer();
  const batchReport = await analyzer.analyzeCanonicalCards(cards);

  const withPricing = cards.filter(c => c.avgPriceCents && c.avgPriceCents > 0).length;
  const withMetadata = cards.filter(
    c => c.rarity && c.types && c.types.length > 0
  ).length;
  const coverage = withPricing / cards.length;

  const report: CanonicalCardsQualityReport = {
    totalAnalyzed: cards.length,
    averageScore: batchReport.averageScore,
    withPricing,
    withMetadata,
    coverage,
  };

  console.log(`   ✓ Analyzed: ${report.totalAnalyzed} cards`);
  console.log(`   ✓ Average Quality: ${report.averageScore.toFixed(2)}`);
  console.log(`   ✓ With Pricing: ${withPricing} (${(coverage * 100).toFixed(1)}%)`);
  console.log(`   ✓ With Metadata: ${withMetadata} (${((withMetadata / cards.length) * 100).toFixed(1)}%)`);

  return report;
}

async function identifyDataIssues(report: QualityReport): Promise<DataIssue[]> {
  console.log('\n🔍 Identifying data issues...\n');

  const issues: DataIssue[] = [];

  // Check for low listing quality
  if (report.listings.averageScore < 0.7) {
    issues.push({
      severity: 'HIGH',
      category: 'Data Quality',
      description: `Low average listing quality: ${report.listings.averageScore.toFixed(2)}`,
      affected: report.listings.totalAnalyzed,
    });
  }

  // Check for high outlier rate in comps
  if (report.compSales.outlierRate > 0.15) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Price Data',
      description: `High outlier rate in comp sales: ${(report.compSales.outlierRate * 100).toFixed(1)}%`,
      affected: Math.round(report.compSales.totalAnalyzed * report.compSales.outlierRate),
    });
  }

  // Check for low canonical card coverage
  if (report.canonicalCards.coverage < 0.5) {
    issues.push({
      severity: 'HIGH',
      category: 'Coverage',
      description: `Low pricing coverage in canonical cards: ${(report.canonicalCards.coverage * 100).toFixed(1)}%`,
      affected: report.canonicalCards.totalAnalyzed - report.canonicalCards.withPricing,
    });
  }

  // Check completeness
  if (report.listings.dimensionScores.completeness < 0.7) {
    issues.push({
      severity: 'HIGH',
      category: 'Completeness',
      description: `Low data completeness: ${report.listings.dimensionScores.completeness.toFixed(2)}`,
      affected: report.listings.totalAnalyzed,
    });
  }

  // Check for old comp sales
  if (report.compSales.ageDistribution.avg > 90) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Timeliness',
      description: `Comp sales are old (avg ${report.compSales.ageDistribution.avg.toFixed(0)} days)`,
      affected: report.compSales.totalAnalyzed,
    });
  }

  console.log(`   ✓ Found ${issues.length} data issues\n`);
  issues.forEach(issue => {
    const icon = issue.severity === 'CRITICAL' ? '🔴' : issue.severity === 'HIGH' ? '🟠' : '🟡';
    console.log(`   ${icon} [${issue.severity}] ${issue.description}`);
  });

  return issues;
}

function generateRecommendations(report: QualityReport): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Based on listing quality
  if (report.listings.averageScore < 0.7) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Enable enhanced validation with USE_ENHANCED_VALIDATION=true',
      expectedImpact: 'Improve data quality by catching issues at ingestion',
      effort: 'LOW - just enable feature flag',
    });
  }

  if (report.listings.dimensionScores.completeness < 0.7) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Use fuzzy matching to improve set name normalization',
      expectedImpact: `Improve completeness from ${report.listings.dimensionScores.completeness.toFixed(2)} to 0.80+`,
      effort: 'LOW - enable USE_FUZZY_MATCHING=true',
    });
  }

  if (report.compSales.outlierRate > 0.15) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Enable outlier detection to filter suspicious prices',
      expectedImpact: 'Improve TFV accuracy by removing outliers',
      effort: 'LOW - enable USE_OUTLIER_DETECTION=true',
    });
  }

  if (report.canonicalCards.coverage < 0.7) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Increase data collection frequency to improve coverage',
      expectedImpact: `Increase coverage from ${(report.canonicalCards.coverage * 100).toFixed(1)}% to 80%+`,
      effort: 'MEDIUM - operational change',
    });
  }

  // Always recommend starting with quality scoring
  recommendations.push({
    priority: 'HIGH',
    action: 'Enable data quality scoring immediately: USE_DATA_QUALITY_SCORING=true',
    expectedImpact: 'Get visibility into data quality metrics',
    effort: 'NONE - no changes to data, just scoring',
  });

  return recommendations;
}

function calculateBaseline(report: QualityReport): QualityBaseline {
  return {
    overallScore: report.listings.averageScore,
    dataCompleteness: report.listings.dimensionScores.completeness,
    dataAccuracy: report.listings.dimensionScores.accuracy,
    marketCoverage: report.canonicalCards.coverage,
    pricingReliability: 1 - report.compSales.outlierRate,
  };
}

// =============================================================================
// REPORTING
// =============================================================================

function printReport(report: QualityReport) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 DATA QUALITY REPORT');
  console.log('='.repeat(70));

  console.log(`\nGenerated: ${report.generatedAt.toISOString()}`);

  console.log('\n📈 QUALITY BASELINE:\n');
  console.log(`   Overall Score:       ${report.baseline.overallScore.toFixed(2)} / 1.00`);
  console.log(`   Data Completeness:   ${report.baseline.dataCompleteness.toFixed(2)} / 1.00`);
  console.log(`   Data Accuracy:       ${report.baseline.dataAccuracy.toFixed(2)} / 1.00`);
  console.log(`   Market Coverage:     ${(report.baseline.marketCoverage * 100).toFixed(1)}%`);
  console.log(`   Pricing Reliability: ${(report.baseline.pricingReliability * 100).toFixed(1)}%`);

  console.log('\n📋 TOP DATA ISSUES:\n');
  report.dataIssues.slice(0, 5).forEach((issue, i) => {
    console.log(`   ${i + 1}. [${issue.severity}] ${issue.description}`);
    console.log(`      Affected: ${issue.affected.toLocaleString()} records`);
  });

  console.log('\n💡 TOP RECOMMENDATIONS:\n');
  report.recommendations.slice(0, 5).forEach((rec, i) => {
    console.log(`   ${i + 1}. [${rec.priority}] ${rec.action}`);
    console.log(`      Impact: ${rec.expectedImpact}`);
    console.log(`      Effort: ${rec.effort}`);
  });

  console.log('');
}

function generateMarkdownReport(report: QualityReport): string {
  return `# Data Quality Report

**Generated:** ${report.generatedAt.toISOString()}

## Quality Baseline

| Metric | Score |
|--------|-------|
| Overall Quality | ${report.baseline.overallScore.toFixed(2)} / 1.00 |
| Data Completeness | ${report.baseline.dataCompleteness.toFixed(2)} / 1.00 |
| Data Accuracy | ${report.baseline.dataAccuracy.toFixed(2)} / 1.00 |
| Market Coverage | ${(report.baseline.marketCoverage * 100).toFixed(1)}% |
| Pricing Reliability | ${(report.baseline.pricingReliability * 100).toFixed(1)}% |

## Database Statistics

- **Total Listings:** ${report.database.totalListings.toLocaleString()}
- **Active Listings:** ${report.database.activeListings.toLocaleString()}
- **Comp Sales:** ${report.database.totalCompSales.toLocaleString()}
- **Canonical Cards:** ${report.database.totalCanonicalCards.toLocaleString()}

## Data Issues

${report.dataIssues
  .map(
    (issue, i) =>
      `${i + 1}. **[${issue.severity}]** ${issue.description}\n   - Affected: ${issue.affected.toLocaleString()} records`
  )
  .join('\n\n')}

## Recommendations

${report.recommendations
  .map(
    (rec, i) =>
      `${i + 1}. **[${rec.priority}]** ${rec.action}\n   - Expected Impact: ${rec.expectedImpact}\n   - Effort: ${rec.effort}`
  )
  .join('\n\n')}

## Next Steps

1. Review this report with your team
2. Enable recommended features in .env file
3. Monitor quality improvements
4. Re-run this report after changes to measure impact
`;
}

// Run report generation
main().catch(console.error);
