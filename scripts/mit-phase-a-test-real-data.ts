#!/usr/bin/env tsx
/**
 * MIT Integration Phase A: Test with Real Data
 *
 * This script tests all new MIT modules against your real database data
 * to ensure they work properly before full integration.
 *
 * Run: tsx scripts/mit-phase-a-test-real-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { DataValidator, BatchValidator } from '../packages/shared/validation';
import FuzzyMatcher from '../packages/shared/fuzzy-matcher';
import { DataQualityEngine, BatchQualityAnalyzer } from '../packages/analysis/src/data-quality';
import { IntelligentDeduplicator } from '../packages/analysis/src/deduplication';
import { OutlierDetector } from '../packages/analysis/src/outlier-detection';
import { FeatureFlags, Feature } from '../packages/shared/feature-flags';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TestResults {
  phase: string;
  timestamp: Date;
  tests: TestResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  recommendations: string[];
}

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  duration: number;
  details: any;
  issues?: string[];
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 MIT INTEGRATION PHASE A: REAL DATA TESTING');
  console.log('='.repeat(70) + '\n');

  const results: TestResults = {
    phase: 'A - Real Data Testing',
    timestamp: new Date(),
    tests: [],
    summary: { totalTests: 0, passed: 0, failed: 0, warnings: 0 },
    recommendations: [],
  };

  try {
    // Test 1: Database Connection
    console.log('📊 Test 1: Database Connection & Data Availability\n');
    const dbTest = await testDatabaseConnection();
    results.tests.push(dbTest);
    printTestResult(dbTest);

    if (dbTest.status === 'FAIL') {
      console.log('\n❌ Cannot proceed without database access.');
      console.log('Please ensure your DATABASE_URL is set correctly in .env\n');
      return;
    }

    // Test 2: Enhanced Validation on Real Listings
    console.log('\n📋 Test 2: Enhanced Validation on Real Listings\n');
    const validationTest = await testValidationOnRealData();
    results.tests.push(validationTest);
    printTestResult(validationTest);

    // Test 3: Fuzzy Matching on Real Set Names
    console.log('\n🔍 Test 3: Fuzzy Matching on Real Set Names\n');
    const fuzzyTest = await testFuzzyMatchingOnRealData();
    results.tests.push(fuzzyTest);
    printTestResult(fuzzyTest);

    // Test 4: Quality Scoring on Real Data
    console.log('\n⭐ Test 4: Data Quality Scoring\n');
    const qualityTest = await testQualityScoringOnRealData();
    results.tests.push(qualityTest);
    printTestResult(qualityTest);

    // Test 5: Deduplication Analysis
    console.log('\n🔄 Test 5: Intelligent Deduplication Analysis\n');
    const dedupTest = await testDeduplicationOnRealData();
    results.tests.push(dedupTest);
    printTestResult(dedupTest);

    // Test 6: Outlier Detection
    console.log('\n🎯 Test 6: Outlier Detection on Real Comps\n');
    const outlierTest = await testOutlierDetectionOnRealData();
    results.tests.push(outlierTest);
    printTestResult(outlierTest);

    // Test 7: Performance Benchmarking
    console.log('\n⚡ Test 7: Performance Benchmarking\n');
    const perfTest = await testPerformance();
    results.tests.push(perfTest);
    printTestResult(perfTest);

    // Calculate summary
    results.summary.totalTests = results.tests.length;
    results.summary.passed = results.tests.filter(t => t.status === 'PASS').length;
    results.summary.failed = results.tests.filter(t => t.status === 'FAIL').length;
    results.summary.warnings = results.tests.filter(t => t.status === 'WARN').length;

    // Generate recommendations
    results.recommendations = generateRecommendations(results.tests);

    // Print summary
    printSummary(results);

    // Save results to file
    const resultsPath = path.join(process.cwd(), 'logs', 'mit-phase-a-results.json');
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Full results saved to: ${resultsPath}\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================================================
// TEST IMPLEMENTATIONS
// =============================================================================

async function testDatabaseConnection(): Promise<TestResult> {
  const start = Date.now();
  const issues: string[] = [];

  try {
    // Check connection
    await prisma.$connect();

    // Count records
    const [listingCount, compCount, cardCount] = await Promise.all([
      prisma.marketListing.count().catch(() => 0),
      prisma.compSale ? prisma.compSale.count().catch(() => 0) : 0,
      prisma.canonicalCard ? prisma.canonicalCard.count().catch(() => 0) : 0,
    ]);

    const details = {
      connected: true,
      marketListings: listingCount,
      compSales: compCount,
      canonicalCards: cardCount,
      totalRecords: listingCount + compCount + cardCount,
    };

    console.log(`   ✓ Connected to database`);
    console.log(`   ✓ Market Listings: ${listingCount.toLocaleString()}`);
    console.log(`   ✓ Comp Sales: ${compCount.toLocaleString()}`);
    console.log(`   ✓ Canonical Cards: ${cardCount.toLocaleString()}`);

    if (listingCount === 0 && compCount === 0) {
      issues.push('No data found in database');
      return {
        name: 'Database Connection',
        status: 'WARN',
        duration: Date.now() - start,
        details,
        issues,
      };
    }

    return {
      name: 'Database Connection',
      status: 'PASS',
      duration: Date.now() - start,
      details,
    };
  } catch (error) {
    return {
      name: 'Database Connection',
      status: 'FAIL',
      duration: Date.now() - start,
      details: { error: String(error) },
      issues: ['Failed to connect to database'],
    };
  }
}

async function testValidationOnRealData(): Promise<TestResult> {
  const start = Date.now();
  const issues: string[] = [];

  try {
    // Get sample of real listings
    const listings = await prisma.marketListing.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    if (listings.length === 0) {
      return {
        name: 'Enhanced Validation',
        status: 'WARN',
        duration: Date.now() - start,
        details: { message: 'No listings to test' },
        issues: ['No listings found'],
      };
    }

    const batchValidator = new BatchValidator({ strictMode: false });
    const result = await batchValidator.validateListings(listings);

    const details = {
      totalTested: result.total,
      valid: result.valid,
      invalid: result.invalid,
      validationRate: result.validationRate,
      avgDataQuality: result.avgDataQuality,
      sampleIssues: result.results
        .filter(r => !r.isValid)
        .slice(0, 5)
        .map(r => ({
          id: (r as any).data?.id,
          errors: r.errors.map(e => `${e.field}: ${e.message}`),
        })),
    };

    console.log(`   ✓ Tested ${result.total} listings`);
    console.log(`   ✓ Valid: ${result.valid} (${(result.validationRate * 100).toFixed(1)}%)`);
    console.log(`   ✓ Invalid: ${result.invalid}`);
    console.log(`   ✓ Avg Quality: ${result.avgDataQuality.toFixed(2)}`);

    if (result.validationRate < 0.8) {
      issues.push(`Low validation rate: ${(result.validationRate * 100).toFixed(1)}%`);
    }

    if (result.avgDataQuality < 0.6) {
      issues.push(`Low average quality: ${result.avgDataQuality.toFixed(2)}`);
    }

    return {
      name: 'Enhanced Validation',
      status: issues.length > 0 ? 'WARN' : 'PASS',
      duration: Date.now() - start,
      details,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    return {
      name: 'Enhanced Validation',
      status: 'FAIL',
      duration: Date.now() - start,
      details: { error: String(error) },
      issues: ['Validation test failed'],
    };
  }
}

async function testFuzzyMatchingOnRealData(): Promise<TestResult> {
  const start = Date.now();
  const issues: string[] = [];

  try {
    // Get unique set names from database
    const listings = await prisma.marketListing.findMany({
      select: { setName: true },
      distinct: ['setName'],
      where: { setName: { not: null } },
      take: 100,
    });

    const setNames = listings.map(l => l.setName).filter(Boolean) as string[];

    if (setNames.length === 0) {
      return {
        name: 'Fuzzy Matching',
        status: 'WARN',
        duration: Date.now() - start,
        details: { message: 'No set names to test' },
        issues: ['No set names found'],
      };
    }

    const matcher = new FuzzyMatcher(0.75);
    const results = matcher.normalizeSetNames(setNames);

    const matched = Array.from(results.values()).filter(v => v !== null).length;
    const matchRate = matched / setNames.length;

    const sampleMatches = Array.from(results.entries())
      .slice(0, 10)
      .map(([original, normalized]) => ({ original, normalized: normalized || 'NO MATCH' }));

    const details = {
      totalSetNames: setNames.length,
      matched,
      unmatched: setNames.length - matched,
      matchRate,
      sampleMatches,
    };

    console.log(`   ✓ Tested ${setNames.length} set names`);
    console.log(`   ✓ Matched: ${matched} (${(matchRate * 100).toFixed(1)}%)`);
    console.log(`   ✓ Unmatched: ${setNames.length - matched}`);

    if (matchRate < 0.7) {
      issues.push(`Low match rate: ${(matchRate * 100).toFixed(1)}%`);
    }

    return {
      name: 'Fuzzy Matching',
      status: issues.length > 0 ? 'WARN' : 'PASS',
      duration: Date.now() - start,
      details,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    return {
      name: 'Fuzzy Matching',
      status: 'FAIL',
      duration: Date.now() - start,
      details: { error: String(error) },
      issues: ['Fuzzy matching test failed'],
    };
  }
}

async function testQualityScoringOnRealData(): Promise<TestResult> {
  const start = Date.now();

  try {
    const listings = await prisma.marketListing.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    if (listings.length === 0) {
      return {
        name: 'Quality Scoring',
        status: 'WARN',
        duration: Date.now() - start,
        details: { message: 'No listings to score' },
        issues: ['No listings found'],
      };
    }

    const analyzer = new BatchQualityAnalyzer();
    const report = await analyzer.analyzeListings(listings);

    const details = {
      totalRecords: report.totalRecords,
      averageScore: report.averageScore,
      gradeDistribution: report.gradeDistribution,
      dimensionAverages: report.dimensionAverages,
      issuesSummary: report.issuesSummary,
    };

    console.log(`   ✓ Scored ${report.totalRecords} listings`);
    console.log(`   ✓ Average Score: ${report.averageScore.toFixed(2)}`);
    console.log(`   ✓ Grade A: ${report.gradeDistribution.A}`);
    console.log(`   ✓ Grade B: ${report.gradeDistribution.B}`);
    console.log(`   ✓ Grade C: ${report.gradeDistribution.C}`);
    console.log(`   ✓ Grade D: ${report.gradeDistribution.D}`);
    console.log(`   ✓ Grade F: ${report.gradeDistribution.F}`);

    return {
      name: 'Quality Scoring',
      status: 'PASS',
      duration: Date.now() - start,
      details,
    };
  } catch (error) {
    return {
      name: 'Quality Scoring',
      status: 'FAIL',
      duration: Date.now() - start,
      details: { error: String(error) },
      issues: ['Quality scoring test failed'],
    };
  }
}

async function testDeduplicationOnRealData(): Promise<TestResult> {
  const start = Date.now();

  try {
    // Get listings for a specific card to test deduplication
    const listings = await prisma.marketListing.findMany({
      take: 100,
      where: {
        cardName: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (listings.length < 5) {
      return {
        name: 'Deduplication',
        status: 'WARN',
        duration: Date.now() - start,
        details: { message: 'Not enough listings to test deduplication' },
        issues: ['Insufficient data'],
      };
    }

    const deduplicator = new IntelligentDeduplicator({
      keepOnePerSource: true,
      keepPriceVariations: true,
      priceVariationThreshold: 0.05,
    });

    const result = deduplicator.deduplicate(listings);

    const details = {
      input: result.stats.totalInput,
      kept: result.stats.totalKept,
      removed: result.stats.totalRemoved,
      removalRate: result.stats.removalRate,
      removalReasons: result.stats.removalReasons,
      sourceDistribution: result.stats.sourceDistribution,
    };

    console.log(`   ✓ Input: ${result.stats.totalInput} listings`);
    console.log(`   ✓ Kept: ${result.stats.totalKept}`);
    console.log(`   ✓ Removed: ${result.stats.totalRemoved} (${(result.stats.removalRate * 100).toFixed(1)}%)`);

    return {
      name: 'Deduplication',
      status: 'PASS',
      duration: Date.now() - start,
      details,
    };
  } catch (error) {
    return {
      name: 'Deduplication',
      status: 'FAIL',
      duration: Date.now() - start,
      details: { error: String(error) },
      issues: ['Deduplication test failed'],
    };
  }
}

async function testOutlierDetectionOnRealData(): Promise<TestResult> {
  const start = Date.now();

  try {
    const comps = await prisma.compSale ? await prisma.compSale.findMany({
      take: 100,
      where: { priceCents: { gt: 0 } },
      orderBy: { soldAt: 'desc' },
    }) : [];

    if (comps.length < 10) {
      return {
        name: 'Outlier Detection',
        status: 'WARN',
        duration: Date.now() - start,
        details: { message: 'Not enough comps for outlier detection' },
        issues: ['Insufficient data'],
      };
    }

    const detector = new OutlierDetector();
    const analysis = detector.detectOutliers(comps);

    const details = {
      totalRecords: analysis.statistics.totalRecords,
      totalOutliers: analysis.statistics.totalOutliers,
      outlierRate: analysis.statistics.outlierRate,
      byType: analysis.statistics.byType,
      bySeverity: analysis.statistics.bySeverity,
      priceStats: analysis.statistics.priceStats,
    };

    console.log(`   ✓ Analyzed ${analysis.statistics.totalRecords} comps`);
    console.log(`   ✓ Outliers: ${analysis.statistics.totalOutliers} (${(analysis.statistics.outlierRate * 100).toFixed(1)}%)`);
    console.log(`   ✓ Critical: ${analysis.statistics.bySeverity.CRITICAL || 0}`);
    console.log(`   ✓ High: ${analysis.statistics.bySeverity.HIGH || 0}`);

    return {
      name: 'Outlier Detection',
      status: 'PASS',
      duration: Date.now() - start,
      details,
    };
  } catch (error) {
    return {
      name: 'Outlier Detection',
      status: 'FAIL',
      duration: Date.now() - start,
      details: { error: String(error) },
      issues: ['Outlier detection test failed'],
    };
  }
}

async function testPerformance(): Promise<TestResult> {
  const start = Date.now();

  try {
    const listings = await prisma.marketListing.findMany({ take: 100 });

    if (listings.length === 0) {
      return {
        name: 'Performance',
        status: 'WARN',
        duration: Date.now() - start,
        details: { message: 'No data to benchmark' },
      };
    }

    // Benchmark validation
    const validationStart = Date.now();
    const validator = new DataValidator();
    for (const listing of listings.slice(0, 10)) {
      await validator.validateListing(listing);
    }
    const validationTime = Date.now() - validationStart;
    const validationPerRecord = validationTime / 10;

    // Benchmark fuzzy matching
    const fuzzyStart = Date.now();
    const matcher = new FuzzyMatcher();
    for (const listing of listings.slice(0, 10)) {
      if (listing.setName) matcher.normalizeSetName(listing.setName);
    }
    const fuzzyTime = Date.now() - fuzzyStart;
    const fuzzyPerRecord = fuzzyTime / 10;

    // Benchmark quality scoring
    const qualityStart = Date.now();
    const engine = new DataQualityEngine();
    for (const listing of listings.slice(0, 10)) {
      engine.scoreListing(listing);
    }
    const qualityTime = Date.now() - qualityStart;
    const qualityPerRecord = qualityTime / 10;

    const details = {
      sampleSize: 10,
      validation: {
        totalMs: validationTime,
        perRecordMs: validationPerRecord,
        acceptable: validationPerRecord < 50,
      },
      fuzzyMatching: {
        totalMs: fuzzyTime,
        perRecordMs: fuzzyPerRecord,
        acceptable: fuzzyPerRecord < 10,
      },
      qualityScoring: {
        totalMs: qualityTime,
        perRecordMs: qualityPerRecord,
        acceptable: qualityPerRecord < 20,
      },
    };

    console.log(`   ✓ Validation: ${validationPerRecord.toFixed(1)}ms/record`);
    console.log(`   ✓ Fuzzy Match: ${fuzzyPerRecord.toFixed(1)}ms/record`);
    console.log(`   ✓ Quality Score: ${qualityPerRecord.toFixed(1)}ms/record`);

    const issues: string[] = [];
    if (validationPerRecord > 50) issues.push('Validation too slow');
    if (fuzzyPerRecord > 10) issues.push('Fuzzy matching too slow');
    if (qualityPerRecord > 20) issues.push('Quality scoring too slow');

    return {
      name: 'Performance',
      status: issues.length > 0 ? 'WARN' : 'PASS',
      duration: Date.now() - start,
      details,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    return {
      name: 'Performance',
      status: 'FAIL',
      duration: Date.now() - start,
      details: { error: String(error) },
      issues: ['Performance test failed'],
    };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function printTestResult(result: TestResult) {
  const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
  console.log(`   ${icon} ${result.name}: ${result.status} (${result.duration}ms)`);
  if (result.issues && result.issues.length > 0) {
    result.issues.forEach(issue => console.log(`      - ${issue}`));
  }
}

function generateRecommendations(tests: TestResult[]): string[] {
  const recommendations: string[] = [];

  const failed = tests.filter(t => t.status === 'FAIL');
  const warnings = tests.filter(t => t.status === 'WARN');

  if (failed.length > 0) {
    recommendations.push(`❌ ${failed.length} tests failed - address these before proceeding`);
  }

  if (warnings.length > 0) {
    recommendations.push(`⚠️ ${warnings.length} tests have warnings - review and address if needed`);
  }

  // Specific recommendations based on test results
  const validationTest = tests.find(t => t.name === 'Enhanced Validation');
  if (validationTest?.details?.validationRate < 0.8) {
    recommendations.push('Consider lowering validation strictness or improving data quality');
  }

  const fuzzyTest = tests.find(t => t.name === 'Fuzzy Matching');
  if (fuzzyTest?.details?.matchRate < 0.7) {
    recommendations.push('Add more set name mappings to fuzzy matcher canonical list');
  }

  const qualityTest = tests.find(t => t.name === 'Quality Scoring');
  if (qualityTest?.details?.averageScore < 0.7) {
    recommendations.push('Focus on improving data completeness and accuracy');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All tests passed! Ready to enable features in production');
    recommendations.push('Start with USE_DATA_QUALITY_SCORING=true (safe, no changes)');
    recommendations.push('Then enable USE_FUZZY_MATCHING=true with ROLLOUT_FUZZY_MATCHING=10');
  }

  return recommendations;
}

function printSummary(results: TestResults) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal Tests: ${results.summary.totalTests}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`⚠️ Warnings: ${results.summary.warnings}`);
  console.log(`❌ Failed: ${results.summary.failed}`);

  console.log('\n📋 RECOMMENDATIONS:\n');
  results.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });
  console.log('');
}

// Run tests
main().catch(console.error);
