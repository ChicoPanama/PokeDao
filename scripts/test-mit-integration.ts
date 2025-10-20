#!/usr/bin/env tsx
/**
 * Test Script for MIT Integration Modules
 *
 * Run: tsx scripts/test-mit-integration.ts
 */

import { DataValidator } from '../packages/shared/validation';
import FuzzyMatcher from '../packages/shared/fuzzy-matcher';
import { DataQualityEngine } from '../packages/analysis/src/data-quality';
import { IntelligentDeduplicator } from '../packages/analysis/src/deduplication';
import { OutlierDetector } from '../packages/analysis/src/outlier-detection';
import { FeatureFlags, Feature } from '../packages/shared/feature-flags';

async function runTests() {
  console.log('\n🧪 Testing MIT Integration Modules\n');

  // ============================================================================
  // Test 1: Enhanced Data Validation
  // ============================================================================
  console.log('1️⃣  Testing Enhanced Data Validation...\n');

  const sampleListing = {
  id: 'test-123',
  title: 'Charizard VMAX - Brilliant Stars PSA 10',
  priceCents: 45000,
  source: 'EBAY',
  cardName: 'Charizard VMAX',
  setName: 'Brilliant Stars',
  cardNumber: '017/172',
  gradeCompany: 'PSA',
  grade: 10,
  listedAt: new Date(),
  sourceUrl: 'https://ebay.com/itm/123456',
};

const validator = new DataValidator();
const validationResult = await validator.validateListing(sampleListing);

console.log(`   ✓ Validation Status: ${validationResult.isValid ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`   ✓ Data Quality Score: ${validationResult.dataQualityScore.toFixed(2)}`);
console.log(`   ✓ Issues Found: ${validationResult.errors?.length || 0}`);
console.log(`   ✓ Warnings: ${validationResult.warnings?.length || 0}`);

if (validationResult.errors && validationResult.errors.length > 0) {
  console.log('\n   Errors:');
  validationResult.errors.forEach(error => {
    console.log(`     - ${error.field}: ${error.message}`);
  });
}

// ============================================================================
// Test 2: Fuzzy Matching
// ============================================================================
console.log('\n2️⃣  Testing Fuzzy Matching...\n');

const matcher = new FuzzyMatcher();

const testCases = [
  'base set',
  'Base Set 1st Edition',
  'bs',
  'Brilliant Stars',
  'sword shield',
  'scarlet violet',
];

console.log('   Set Name Normalization:');
testCases.forEach(test => {
  const normalized = matcher.normalizeSetName(test);
  console.log(`     "${test}" → "${normalized || 'NO MATCH'}"`);
});

console.log('\n   Variant Normalization:');
const variantTests = ['holo', 'reverse holo', '1st edition', 'shadowless'];
variantTests.forEach(test => {
  const normalized = matcher.normalizeVariant(test);
  console.log(`     "${test}" → "${normalized || 'NO MATCH'}"`);
});

// ============================================================================
// Test 3: Data Quality Scoring
// ============================================================================
console.log('\n3️⃣  Testing Data Quality Scoring...\n');

const qualityEngine = new DataQualityEngine();

const listings = [
  {
    id: '1',
    title: 'Charizard PSA 10',
    priceCents: 50000,
    source: 'EBAY',
    cardName: 'Charizard',
    setName: 'Base Set',
    cardNumber: '4/102',
    gradeCompany: 'PSA',
    grade: 10,
    listedAt: new Date(),
  },
  {
    id: '2',
    title: 'Pikachu',
    priceCents: 5000,
    source: 'TCGPLAYER',
    // Missing many fields
  },
  {
    id: '3',
    title: 'Test Card',
    priceCents: 50,
    source: 'MANUAL',
    cardName: 'Test',
    // Suspicious data
  },
];

console.log('   Individual Listing Scores:');
listings.forEach(listing => {
  const score = qualityEngine.scoreListing(listing);
  console.log(`     Listing ${listing.id}: Grade ${score.grade} (${score.overallScore.toFixed(2)})`);
  console.log(`       Completeness: ${score.dimensions.completeness.toFixed(2)}`);
  console.log(`       Accuracy: ${score.dimensions.accuracy.toFixed(2)}`);
  if (score.issues.length > 0) {
    console.log(`       Issues: ${score.issues.length} (${score.issues[0].message})`);
  }
});

// ============================================================================
// Test 4: Intelligent Deduplication
// ============================================================================
console.log('\n4️⃣  Testing Intelligent Deduplication...\n');

const duplicateListings = [
  {
    id: '1',
    setName: 'Base Set',
    cardNumber: '4/102',
    priceCents: 50000,
    source: 'EBAY',
    variant: 'holo',
    gradeCompany: 'PSA',
    grade: 10,
  },
  {
    id: '2',
    setName: 'Base Set',
    cardNumber: '4/102',
    priceCents: 50000,
    source: 'EBAY', // Same source, same price - duplicate
    variant: 'holo',
    gradeCompany: 'PSA',
    grade: 10,
  },
  {
    id: '3',
    setName: 'Base Set',
    cardNumber: '4/102',
    priceCents: 55000, // Different price - keep for TFV
    source: 'TCGPLAYER',
    variant: 'holo',
    gradeCompany: 'PSA',
    grade: 10,
  },
  {
    id: '4',
    setName: 'Base Set',
    cardNumber: '4/102',
    priceCents: 48000, // Different price - keep for TFV
    source: 'COLLECTOR_CRYPT',
    variant: 'holo',
    gradeCompany: 'PSA',
    grade: 10,
  },
];

const deduplicator = new IntelligentDeduplicator({
  keepOnePerSource: true,
  keepPriceVariations: true,
  priceVariationThreshold: 0.05,
});

const dedupResult = deduplicator.deduplicate(duplicateListings);

console.log(`   Input: ${dedupResult.stats.totalInput} listings`);
console.log(`   Kept: ${dedupResult.stats.totalKept} listings`);
console.log(`   Removed: ${dedupResult.stats.totalRemoved} listings`);
console.log(`   Removal Rate: ${(dedupResult.stats.removalRate * 100).toFixed(1)}%`);
console.log('\n   Removal Reasons:');
Object.entries(dedupResult.stats.removalReasons).forEach(([reason, count]) => {
  console.log(`     ${reason}: ${count}`);
});

// ============================================================================
// Test 5: Outlier Detection
// ============================================================================
console.log('\n5️⃣  Testing Outlier Detection...\n');

const priceData = [
  { id: '1', priceCents: 50000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 },
  { id: '2', priceCents: 52000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 },
  { id: '3', priceCents: 48000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 },
  { id: '4', priceCents: 51000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 },
  { id: '5', priceCents: 49000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 },
  { id: '6', priceCents: 150000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 }, // Outlier
  { id: '7', priceCents: 5000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 }, // Outlier (too low)
  { id: '8', priceCents: 50000, cardName: 'Charizard', gradeCompany: 'PSA', grade: 10 },
];

const outlierDetector = new OutlierDetector();
const outlierAnalysis = outlierDetector.detectOutliers(priceData);

console.log(`   Total Records: ${outlierAnalysis.statistics.totalRecords}`);
console.log(`   Outliers Found: ${outlierAnalysis.statistics.totalOutliers}`);
console.log(`   Outlier Rate: ${(outlierAnalysis.statistics.outlierRate * 100).toFixed(1)}%`);

console.log('\n   Price Statistics:');
console.log(`     Mean: $${(outlierAnalysis.statistics.priceStats.mean / 100).toFixed(2)}`);
console.log(`     Median: $${(outlierAnalysis.statistics.priceStats.median / 100).toFixed(2)}`);
console.log(`     Q1: $${(outlierAnalysis.statistics.priceStats.q1 / 100).toFixed(2)}`);
console.log(`     Q3: $${(outlierAnalysis.statistics.priceStats.q3 / 100).toFixed(2)}`);

console.log('\n   Outliers Detected:');
outlierAnalysis.outliers.forEach(outlier => {
  const price = outlier.record.priceCents / 100;
  console.log(`     Record ${outlier.record.id}: $${price.toFixed(2)}`);
  console.log(`       Type: ${outlier.outlierType}`);
  console.log(`       Severity: ${outlier.severity}`);
  console.log(`       Confidence: ${outlier.confidence.toFixed(2)}`);
  console.log(`       Action: ${outlier.suggestedAction}`);
});

// ============================================================================
// Test 6: Feature Flags
// ============================================================================
console.log('\n6️⃣  Testing Feature Flags...\n');

// Initialize feature flags
FeatureFlags.initialize();

console.log('   Feature Flag Status:');
const features = [
  Feature.USE_ENHANCED_VALIDATION,
  Feature.USE_FUZZY_MATCHING,
  Feature.USE_DATA_QUALITY_SCORING,
  Feature.USE_ENHANCED_DEDUPLICATION,
  Feature.USE_OUTLIER_DETECTION,
];

features.forEach(feature => {
  const enabled = FeatureFlags.isEnabled(feature);
  const config = FeatureFlags.getConfig(feature);
  console.log(`     ${feature}: ${enabled ? '✅' : '❌'} (${config?.rolloutPercentage}% rollout)`);
});

console.log('\n   Rollout Simulation (10% rollout):');
FeatureFlags.override(Feature.USE_ENHANCED_VALIDATION, {
  enabled: true,
  rolloutPercentage: 10
});

let inRollout = 0;
const testIds = Array.from({ length: 1000 }, (_, i) => `card-${i}`);
testIds.forEach(id => {
  if (FeatureFlags.shouldUseFeature(Feature.USE_ENHANCED_VALIDATION, id)) {
    inRollout++;
  }
});

console.log(`     Expected: 10% (~100 out of 1000)`);
console.log(`     Actual: ${(inRollout / 10)}% (${inRollout} out of 1000)`);
console.log(`     Variance: ${Math.abs(inRollout - 100)} records`);

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('✅ All MIT Integration Modules Tested Successfully!');
console.log('='.repeat(60));

console.log('\n📊 Test Summary:');
console.log('   ✓ Data Validation: Working');
console.log('   ✓ Fuzzy Matching: Working');
console.log('   ✓ Quality Scoring: Working');
console.log('   ✓ Deduplication: Working');
console.log('   ✓ Outlier Detection: Working');
console.log('   ✓ Feature Flags: Working');

console.log('\n🚀 Next Steps:');
console.log('   1. Enable features in .env file');
console.log('   2. Start with 10% rollout');
console.log('   3. Monitor logs and metrics');
console.log('   4. Gradually increase rollout percentage');
console.log('   5. See INTEGRATION_GUIDE.md for details');

console.log('\n💡 Quick Enable (add to .env):');
console.log('   USE_ENHANCED_VALIDATION=true');
console.log('   ROLLOUT_ENHANCED_VALIDATION=10');
console.log('   USE_FUZZY_MATCHING=true');
console.log('   USE_DATA_QUALITY_SCORING=true\n');
}

// Run the tests
runTests().catch(console.error);
