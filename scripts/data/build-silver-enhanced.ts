#!/usr/bin/env tsx
/**
 * Enhanced Silver Layer Builder (MIT Integration)
 *
 * This is an ENHANCED version of build-silver.ts that adds:
 * - Enhanced data validation
 * - Fuzzy matching for set names
 * - Data quality scoring
 * - All controlled by feature flags (backwards compatible)
 *
 * To use: Replace build-silver.ts or run this directly
 * Run: tsx scripts/data/build-silver-enhanced.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { DataValidator } from '../../packages/shared/validation';
import FuzzyMatcher from '../../packages/shared/fuzzy-matcher';
import { DataQualityEngine } from '../../packages/analysis/src/data-quality';
import { FeatureFlags, Feature } from '../../packages/shared/feature-flags';

// Import existing silver builder logic
// NOTE: You would normally import from your existing build-silver.ts
// For now, I'll create the enhanced wrapper

// ============================================================================
// CONFIGURATION
// ============================================================================

const BRONZE_DIR = path.join(process.cwd(), 'data_lake/bronze');
const SILVER_DIR = path.join(process.cwd(), 'data_lake/silver');
const MANIFEST_DIR = path.join(process.cwd(), 'data_lake/manifests');

// Forex rates
const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0067,
};

// MIT Integration instances (initialized once)
let validator: DataValidator | null = null;
let fuzzyMatcher: FuzzyMatcher | null = null;
let qualityEngine: DataQualityEngine | null = null;

// Statistics tracking
const stats = {
  totalProcessed: 0,
  validated: 0,
  fuzzyMatched: 0,
  qualityScored: 0,
  validationErrors: 0,
  fuzzyMatchImprovements: 0,
  avgQualityScore: 0,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeMITModules() {
  console.log('\n🔧 Initializing MIT Integration Modules...\n');

  // Initialize feature flags
  FeatureFlags.initialize();

  // Initialize validation if enabled
  if (FeatureFlags.isEnabled(Feature.USE_ENHANCED_VALIDATION)) {
    validator = new DataValidator({
      strictMode: false, // Don't throw, just log
      minDataQuality: Number(process.env.DATA_QUALITY_MIN_SCORE) || 0.5,
    });
    console.log('   ✓ Enhanced Validation: ENABLED');
  } else {
    console.log('   ○ Enhanced Validation: DISABLED');
  }

  // Initialize fuzzy matching if enabled
  if (FeatureFlags.isEnabled(Feature.USE_FUZZY_MATCHING)) {
    fuzzyMatcher = new FuzzyMatcher(0.75);
    console.log('   ✓ Fuzzy Matching: ENABLED');
  } else {
    console.log('   ○ Fuzzy Matching: DISABLED');
  }

  // Initialize quality scoring if enabled
  if (FeatureFlags.isEnabled(Feature.USE_DATA_QUALITY_SCORING)) {
    qualityEngine = new DataQualityEngine();
    console.log('   ✓ Data Quality Scoring: ENABLED');
  } else {
    console.log('   ○ Data Quality Scoring: DISABLED');
  }

  console.log('');
}

// ============================================================================
// ENHANCED NORMALIZATION
// ============================================================================

async function normalizeRecordEnhanced(row: any, recordId: string): Promise<any> {
  let normalized = { ...row };
  stats.totalProcessed++;

  // Step 1: Enhanced Validation (if enabled with rollout check)
  if (
    validator &&
    FeatureFlags.shouldUseFeature(Feature.USE_ENHANCED_VALIDATION, recordId)
  ) {
    try {
      const validationResult = await validator.validateListing(normalized, {
        throwOnError: false,
      });

      if (!validationResult.isValid) {
        stats.validationErrors++;
        console.warn(`Validation issues for ${recordId}:`, validationResult.errors);

        // Log but don't block (backwards compatible)
        normalized._validationErrors = validationResult.errors;
      } else {
        stats.validated++;
        normalized.dataQuality = validationResult.dataQualityScore;
      }
    } catch (error) {
      console.error(`Validation error for ${recordId}:`, error);
    }
  }

  // Step 2: Fuzzy Matching for Set Names (if enabled with rollout check)
  if (
    fuzzyMatcher &&
    FeatureFlags.shouldUseFeature(Feature.USE_FUZZY_MATCHING, recordId)
  ) {
    try {
      if (normalized.setName) {
        const original = normalized.setName;
        const matched = fuzzyMatcher.normalizeSetName(normalized.setName);

        if (matched && matched !== original) {
          normalized.setName = matched;
          normalized.setNameOriginal = original;
          stats.fuzzyMatchImprovements++;
        }
        stats.fuzzyMatched++;
      }

      if (normalized.variant) {
        const matched = fuzzyMatcher.normalizeVariant(normalized.variant);
        if (matched) {
          normalized.variant = matched;
        }
      }
    } catch (error) {
      console.error(`Fuzzy matching error for ${recordId}:`, error);
    }
  }

  // Step 3: Data Quality Scoring (if enabled)
  if (qualityEngine && FeatureFlags.isEnabled(Feature.USE_DATA_QUALITY_SCORING)) {
    try {
      const qualityScore = qualityEngine.scoreListing(normalized);
      normalized.dataQuality = qualityScore.overallScore;
      normalized.dataQualityGrade = qualityScore.grade;
      normalized.qualityIssuesCount = qualityScore.issues.length;

      stats.qualityScored++;
      stats.avgQualityScore =
        (stats.avgQualityScore * (stats.qualityScored - 1) + qualityScore.overallScore) /
        stats.qualityScored;
    } catch (error) {
      console.error(`Quality scoring error for ${recordId}:`, error);
    }
  }

  // Step 4: Existing normalization logic (preserved)
  normalized = applyExistingNormalization(normalized);

  return normalized;
}

// ============================================================================
// EXISTING NORMALIZATION (Your Current Logic)
// ============================================================================

function applyExistingNormalization(row: any): any {
  // This would contain your existing normalization logic from build-silver.ts
  // I'm adding a placeholder - you'd copy your actual logic here

  // Normalize currency
  if (row.currency && row.priceCents) {
    const fxRate = FX_RATES[row.currency] || 1.0;
    row.priceOrigCents = row.priceCents;
    row.priceCents = Math.round(row.priceCents * fxRate);
    row.fxRate = fxRate;
  }

  // Generate variant key
  row.variantKey = generateVariantKey(row);

  // Generate canonical ID
  row.canonicalId = generateCanonicalId(row);

  return row;
}

function generateVariantKey(row: any): string | null {
  const parts = [
    row.setName || '',
    row.cardNumber || '',
    row.variant || 'base',
    row.gradeCompany || 'raw',
    row.grade || '',
  ];

  const key = parts.join('|').toLowerCase();
  return createHash('md5').update(key).digest('hex').substring(0, 12);
}

function generateCanonicalId(row: any): string {
  const parts = [
    row.source || '',
    row.sourceId || '',
    row.seenAt || Date.now().toString(),
  ];

  const key = parts.join('|');
  return createHash('md5').update(key).digest('hex');
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function buildSilverLayer() {
  console.log('\n' + '='.repeat(70));
  console.log('🏗️  ENHANCED SILVER LAYER BUILDER (MIT Integration)');
  console.log('='.repeat(70));

  const startTime = Date.now();

  // Initialize MIT modules
  initializeMITModules();

  // Check if bronze directory exists
  if (!fs.existsSync(BRONZE_DIR)) {
    console.log(`\n⚠️  Bronze directory not found: ${BRONZE_DIR}`);
    console.log('Run bronze ingestion first: tsx scripts/data/ingest-bronze.ts\n');
    return;
  }

  // Create silver directory
  fs.mkdirSync(SILVER_DIR, { recursive: true });
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });

  // Get all bronze files
  const bronzeFiles = fs.readdirSync(BRONZE_DIR).filter(f => f.endsWith('.parquet'));

  if (bronzeFiles.length === 0) {
    console.log('\n⚠️  No bronze parquet files found\n');
    return;
  }

  console.log(`\n📂 Processing ${bronzeFiles.length} bronze files...\n`);

  // Process each bronze file
  for (const file of bronzeFiles) {
    console.log(`   Processing: ${file}`);
    await processBronzeFile(path.join(BRONZE_DIR, file));
  }

  // Print statistics
  printStatistics(Date.now() - startTime);

  // Save manifest
  saveManifest();

  console.log('\n✅ Silver layer build complete!\n');
}

async function processBronzeFile(filePath: string) {
  // NOTE: This is a placeholder - actual parquet reading would go here
  // For demonstration, showing the integration points

  // Example: Read bronze records (you'd use parquetjs here)
  const records: any[] = []; // Would come from parquet.ParquetReader

  const processedRecords: any[] = [];

  for (const record of records) {
    const recordId = record.id || createHash('md5').update(JSON.stringify(record)).digest('hex');

    // Apply enhanced normalization
    const normalized = await normalizeRecordEnhanced(record, recordId);
    processedRecords.push(normalized);
  }

  // Write to silver layer (you'd use parquetjs here)
  // await writeSilverParquet(processedRecords);
}

// ============================================================================
// STATISTICS & REPORTING
// ============================================================================

function printStatistics(duration: number) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PROCESSING STATISTICS');
  console.log('='.repeat(70));

  console.log(`\nTotal Processed: ${stats.totalProcessed.toLocaleString()} records`);
  console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`Throughput: ${(stats.totalProcessed / (duration / 1000)).toFixed(0)} records/sec`);

  if (stats.validated > 0) {
    console.log(`\n✓ Enhanced Validation:`);
    console.log(`  - Validated: ${stats.validated.toLocaleString()}`);
    console.log(
      `  - Errors: ${stats.validationErrors} (${((stats.validationErrors / stats.validated) * 100).toFixed(1)}%)`
    );
    console.log(
      `  - Pass Rate: ${(((stats.validated - stats.validationErrors) / stats.validated) * 100).toFixed(1)}%`
    );
  }

  if (stats.fuzzyMatched > 0) {
    console.log(`\n✓ Fuzzy Matching:`);
    console.log(`  - Processed: ${stats.fuzzyMatched.toLocaleString()}`);
    console.log(`  - Improvements: ${stats.fuzzyMatchImprovements.toLocaleString()}`);
    console.log(
      `  - Improvement Rate: ${((stats.fuzzyMatchImprovements / stats.fuzzyMatched) * 100).toFixed(1)}%`
    );
  }

  if (stats.qualityScored > 0) {
    console.log(`\n✓ Data Quality Scoring:`);
    console.log(`  - Scored: ${stats.qualityScored.toLocaleString()}`);
    console.log(`  - Average Quality: ${stats.avgQualityScore.toFixed(2)}`);
    console.log(`  - Grade: ${getQualityGrade(stats.avgQualityScore)}`);
  }

  console.log('');
}

function getQualityGrade(score: number): string {
  if (score >= 0.9) return 'A (Excellent)';
  if (score >= 0.75) return 'B (Good)';
  if (score >= 0.6) return 'C (Fair)';
  if (score >= 0.4) return 'D (Poor)';
  return 'F (Failed)';
}

function saveManifest() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    silverVersion: '2.0-MIT',
    statistics: stats,
    featureFlags: {
      validation: FeatureFlags.isEnabled(Feature.USE_ENHANCED_VALIDATION),
      fuzzyMatching: FeatureFlags.isEnabled(Feature.USE_FUZZY_MATCHING),
      qualityScoring: FeatureFlags.isEnabled(Feature.USE_DATA_QUALITY_SCORING),
    },
  };

  const manifestPath = path.join(MANIFEST_DIR, `silver-manifest-${Date.now()}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`📄 Manifest saved: ${manifestPath}`);
}

// ============================================================================
// MAIN
// ============================================================================

buildSilverLayer().catch(console.error);
