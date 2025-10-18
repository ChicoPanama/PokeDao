# MIT Integration Guide

**Integration Status**: ✅ Core modules implemented and ready for gradual rollout

This guide explains how to use the new MIT-recommended data quality enhancements in your PokeDAO system. All features are **backwards compatible** and controlled via feature flags.

---

## 📦 New Modules

### 1. Enhanced Data Validation (`packages/shared/validation.ts`)
Runtime validation with comprehensive quality scoring.

### 2. Feature Flags (`packages/shared/feature-flags.ts`)
Safe gradual rollout system with A/B testing capabilities.

### 3. Fuzzy Matching (`packages/shared/fuzzy-matcher.ts`)
String similarity matching for set names and variants.

### 4. Data Quality Scoring (`packages/analysis/src/data-quality.ts`)
Multi-dimensional quality assessment for all records.

### 5. Intelligent Deduplication (`packages/analysis/src/deduplication.ts`)
Strategic deduplication preserving valuable price variations.

### 6. Outlier Detection (`packages/analysis/src/outlier-detection.ts`)
Statistical and domain-specific outlier flagging.

---

## 🚀 Quick Start

### Step 1: Enable Features

Edit your `.env` file:

```bash
# Start with validation only (safest)
USE_ENHANCED_VALIDATION=true
ROLLOUT_ENHANCED_VALIDATION=10  # Start with 10% traffic

# Add other features gradually
USE_FUZZY_MATCHING=true
ROLLOUT_FUZZY_MATCHING=10

USE_DATA_QUALITY_SCORING=true
ROLLOUT_DATA_QUALITY_SCORING=10
```

### Step 2: Use in Your Code

#### Example: Validate a Listing

```typescript
import { DataValidator } from '@pokedao/shared/validation';
import { FeatureFlags, Feature } from '@pokedao/shared/feature-flags';

async function processListing(rawListing: any) {
  // Check if enhanced validation is enabled
  if (FeatureFlags.isEnabled(Feature.USE_ENHANCED_VALIDATION)) {
    const validator = new DataValidator();
    const result = await validator.validateListing(rawListing);

    if (!result.isValid) {
      console.log('Validation failed:', result.errors);
      // Handle errors...
    }

    console.log(`Data quality: ${result.dataQualityScore.toFixed(2)}`);

    // Use validated data
    return result.data;
  } else {
    // Legacy path (existing code)
    return rawListing;
  }
}
```

#### Example: Fuzzy Match Set Names

```typescript
import FuzzyMatcher from '@pokedao/shared/fuzzy-matcher';
import { FeatureFlags, Feature } from '@pokedao/shared/feature-flags';

function normalizeSetName(rawSetName: string): string {
  if (FeatureFlags.isEnabled(Feature.USE_FUZZY_MATCHING)) {
    const matcher = new FuzzyMatcher();
    const normalized = matcher.normalizeSetName(rawSetName);

    if (normalized) {
      console.log(`Fuzzy matched "${rawSetName}" → "${normalized}"`);
      return normalized;
    }
  }

  // Fallback to existing logic
  return rawSetName.trim();
}
```

#### Example: Data Quality Scoring

```typescript
import { DataQualityEngine } from '@pokedao/analysis/data-quality';

function enrichWithQuality(listings: any[]) {
  const engine = new DataQualityEngine();

  return listings.map(listing => {
    const score = engine.scoreListing(listing);

    return {
      ...listing,
      dataQuality: score.overallScore,
      dataQualityGrade: score.grade,
      qualityIssues: score.issues.length,
    };
  });
}
```

#### Example: Intelligent Deduplication

```typescript
import { IntelligentDeduplicator } from '@pokedao/analysis/deduplication';

function deduplicateStrategically(listings: any[]) {
  const deduplicator = new IntelligentDeduplicator({
    keepOnePerSource: true,
    keepPriceVariations: true,
    priceVariationThreshold: 0.05, // 5% price difference
  });

  const result = deduplicator.deduplicate(listings);

  console.log(`Deduplicated: ${result.stats.totalInput} → ${result.stats.totalKept}`);
  console.log(`Removal rate: ${(result.stats.removalRate * 100).toFixed(1)}%`);

  return result.kept;
}
```

#### Example: Outlier Detection

```typescript
import { OutlierDetector } from '@pokedao/analysis/outlier-detection';

function flagOutliers(comps: any[]) {
  const detector = new OutlierDetector();
  const analysis = detector.detectOutliers(comps);

  console.log(`Found ${analysis.statistics.totalOutliers} outliers`);
  console.log(`Outlier rate: ${(analysis.statistics.outlierRate * 100).toFixed(1)}%`);

  // Filter out critical outliers
  const clean = comps.filter(comp => {
    const outlier = analysis.outliers.find(o => o.record.id === comp.id);
    return !outlier || outlier.severity !== 'CRITICAL';
  });

  return clean;
}
```

---

## 🧪 Shadow Mode Testing

Test new algorithms without affecting production:

```typescript
import { shadowMode } from '@pokedao/shared/feature-flags';

async function calculateTFVSafely(comps: any[]) {
  return shadowMode(
    // Old (production) logic
    () => oldCalculateTFV(comps),

    // New (experimental) logic
    () => newCalculateTFV(comps),

    // Logger
    (diff) => {
      console.log('TFV Comparison:', {
        old: diff.oldResult,
        new: diff.newResult,
        differ: diff.resultsDiffer,
        timeDiff: diff.timeDiff,
      });
    },

    // Context
    { cardId: comps[0]?.cardId }
  );
}
```

---

## 📊 Integration into Existing Pipeline

### Option A: Gradual Integration into Silver Layer

Edit `scripts/data/build-silver.ts`:

```typescript
import FuzzyMatcher from '@pokedao/shared/fuzzy-matcher';
import { DataValidator } from '@pokedao/shared/validation';
import { FeatureFlags, Feature } from '@pokedao/shared/feature-flags';

// In your existing normalization code:
function normalizeRecord(raw: any): any {
  let normalized = raw;

  // Apply fuzzy matching if enabled
  if (FeatureFlags.isEnabled(Feature.USE_FUZZY_MATCHING)) {
    const matcher = new FuzzyMatcher();
    normalized.setName = matcher.normalizeSetName(raw.setName) || raw.setName;
    normalized.variant = matcher.normalizeVariant(raw.variant) || raw.variant;
  }

  // Validate if enabled
  if (FeatureFlags.shouldUseFeature(Feature.USE_ENHANCED_VALIDATION, raw.id)) {
    const validator = new DataValidator({ strictMode: false });
    const result = validator.validateListing(normalized, { throwOnError: false });

    if (result.isValid) {
      normalized.dataQuality = result.dataQualityScore;
    } else {
      console.warn(`Validation issues for ${raw.id}:`, result.errors);
    }
  }

  return normalized;
}
```

### Option B: Standalone Quality Report Script

Create `scripts/data-quality-report.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { BatchQualityAnalyzer } from '@pokedao/analysis/data-quality';

const prisma = new PrismaClient();

async function generateQualityReport() {
  // Get all listings
  const listings = await prisma.marketListing.findMany({ take: 1000 });

  // Analyze quality
  const analyzer = new BatchQualityAnalyzer();
  const report = await analyzer.analyzeListings(listings);

  console.log('\n=== DATA QUALITY REPORT ===\n');
  console.log(`Total Records: ${report.totalRecords}`);
  console.log(`Average Score: ${report.averageScore.toFixed(2)}`);
  console.log(`\nGrade Distribution:`);
  console.log(`  A (Excellent): ${report.gradeDistribution.A}`);
  console.log(`  B (Good): ${report.gradeDistribution.B}`);
  console.log(`  C (Fair): ${report.gradeDistribution.C}`);
  console.log(`  D (Poor): ${report.gradeDistribution.D}`);
  console.log(`  F (Failed): ${report.gradeDistribution.F}`);

  console.log(`\nDimension Averages:`);
  console.log(`  Completeness: ${report.dimensionAverages.completeness.toFixed(2)}`);
  console.log(`  Accuracy: ${report.dimensionAverages.accuracy.toFixed(2)}`);
  console.log(`  Consistency: ${report.dimensionAverages.consistency.toFixed(2)}`);
  console.log(`  Timeliness: ${report.dimensionAverages.timeliness.toFixed(2)}`);

  console.log(`\nIssues Summary:`);
  console.log(`  Critical: ${report.issuesSummary.critical}`);
  console.log(`  Major: ${report.issuesSummary.major}`);
  console.log(`  Minor: ${report.issuesSummary.minor}`);

  await prisma.$disconnect();
}

generateQualityReport().catch(console.error);
```

Run it:
```bash
tsx scripts/data-quality-report.ts
```

---

## 🎯 Rollout Strategy

### Week 1: Validation & Fuzzy Matching (Oct 12-18)

**Goal**: Establish data quality baseline

```bash
# .env changes
USE_ENHANCED_VALIDATION=true
ROLLOUT_ENHANCED_VALIDATION=10  # 10% traffic

USE_FUZZY_MATCHING=true
ROLLOUT_FUZZY_MATCHING=10

USE_DATA_QUALITY_SCORING=true
ROLLOUT_DATA_QUALITY_SCORING=100  # Can be 100% - just scoring, not blocking
```

**Monitor**:
- Validation error rates
- Fuzzy match success rates
- Average data quality scores

**Acceptance Criteria**:
- Validation error rate < 5%
- Fuzzy matching improves set name coverage by 10%+
- No performance regression

### Week 2: Deduplication & Outlier Detection (Oct 19-25)

**Goal**: Improve TFV accuracy

```bash
USE_ENHANCED_DEDUPLICATION=true
ROLLOUT_ENHANCED_DEDUPLICATION=25  # 25% traffic

USE_OUTLIER_DETECTION=true
ROLLOUT_OUTLIER_DETECTION=50  # 50% - outlier detection is low-risk
```

**Monitor**:
- Deduplication impact on comp counts
- Outlier detection rates
- TFV calculation changes

**Acceptance Criteria**:
- Deduplication removes <20% of records
- Outlier rate 5-15% (expected range)
- TFV changes are reasonable (<10% avg shift)

### Week 3: Shadow Mode Testing (Oct 26-Nov 1)

**Goal**: Validate new algorithms before full rollout

```bash
USE_SHADOW_MODE_TESTING=true  # Log differences, don't change output
```

**Monitor**:
- Differences between old/new TFV calculations
- Performance comparisons
- Edge cases where new logic differs

**Acceptance Criteria**:
- New logic produces similar results (correlation >0.95)
- No critical bugs discovered
- Performance acceptable

### Week 4: Full Rollout (Nov 2-8)

**Goal**: 100% traffic on validated features

```bash
# Increase rollout percentages
ROLLOUT_ENHANCED_VALIDATION=100
ROLLOUT_FUZZY_MATCHING=100
ROLLOUT_ENHANCED_DEDUPLICATION=100
ROLLOUT_OUTLIER_DETECTION=100
```

---

## 🐛 Troubleshooting

### Issue: Validation rejecting too many records

**Solution**: Lower the minimum quality threshold

```bash
DATA_QUALITY_MIN_SCORE=0.3  # More lenient (default 0.5)
DATA_QUALITY_STRICT_MODE=false  # Warn instead of throw
```

### Issue: Fuzzy matching changing too many set names

**Solution**: Increase similarity threshold

```typescript
const matcher = new FuzzyMatcher(0.85); // Default 0.75
```

### Issue: Deduplication removing too many records

**Solution**: Adjust configuration

```typescript
const deduplicator = new IntelligentDeduplicator({
  keepOnePerSource: true,
  keepPriceVariations: true,
  priceVariationThreshold: 0.03, // Lower = keep more variations
  maxObservationsPerCard: 100, // Higher = keep more
});
```

### Issue: Feature flag not working

**Check**:
1. Environment variable is set: `echo $USE_ENHANCED_VALIDATION`
2. Feature flags initialized: `FeatureFlags.initialize()`
3. Rollout percentage: Check `ROLLOUT_*` variables

---

## 📈 Success Metrics

Track these metrics to measure impact:

### Data Quality Metrics
- Average data quality score: **Target >0.85**
- Validation pass rate: **Target >95%**
- Completeness score: **Target >0.90**
- Consistency score: **Target >0.85**

### Operational Metrics
- Fair value coverage: **Target >80%** (was ~68%)
- TFV calculation confidence: **Target >0.80**
- Outlier detection rate: **Target 5-15%**
- Deduplication removal rate: **Target <20%**

### Performance Metrics
- Validation overhead: **Target <50ms per record**
- Fuzzy matching speed: **Target <10ms per string**
- Quality scoring: **Target <20ms per record**
- Overall pipeline time: **No regression**

---

## 🔐 Safety Features

### 1. Feature Flags
Every new feature can be disabled instantly:

```bash
# Emergency disable
USE_ENHANCED_VALIDATION=false
```

### 2. Gradual Rollout
Start small, scale up:

```bash
ROLLOUT_ENHANCED_VALIDATION=10  # Start at 10%
# Monitor for issues...
ROLLOUT_ENHANCED_VALIDATION=50  # Increase to 50%
# Monitor for issues...
ROLLOUT_ENHANCED_VALIDATION=100  # Full rollout
```

### 3. Shadow Mode
Test without risk:

```typescript
// New code runs but doesn't affect output
// Differences logged for analysis
```

### 4. Backwards Compatibility
Old code paths preserved:

```typescript
if (FeatureFlags.isEnabled(feature)) {
  // New code
} else {
  // Existing code (unchanged)
}
```

---

## 📚 API Reference

### DataValidator

```typescript
const validator = new DataValidator({
  strictMode: false,
  allowTestData: false,
  minDataQuality: 0.5,
  warnOnMissingOptional: true,
});

const result = await validator.validateListing(listing, {
  throwOnError: false,
});

// result.isValid: boolean
// result.data: validated object
// result.errors: ValidationError[]
// result.warnings: ValidationWarning[]
// result.dataQualityScore: number (0-1)
```

### FuzzyMatcher

```typescript
const matcher = new FuzzyMatcher(0.75); // similarity threshold

const normalized = matcher.normalizeSetName('Base Set 1st Ed');
// => "Base Set"

const variant = matcher.normalizeVariant('reverse holo');
// => "Reverse Holo"

const metrics = matcher.getMatchMetrics('base', 'Base Set');
// => { similarityScore, jaroWinkler, overallScore, isMatch }
```

### DataQualityEngine

```typescript
const engine = new DataQualityEngine({
  weights: {
    completeness: 0.3,
    accuracy: 0.25,
    consistency: 0.2,
    timeliness: 0.15,
    uniqueness: 0.1,
  },
});

const score = engine.scoreListing(listing);
// => { overallScore, grade, dimensions, issues, recommendations }
```

### IntelligentDeduplicator

```typescript
const deduplicator = new IntelligentDeduplicator({
  keepOnePerSource: true,
  keepPriceVariations: true,
  keepTemporalDiversity: true,
  priceVariationThreshold: 0.05,
  minDaysBetweenObservations: 7,
  maxObservationsPerCard: 50,
});

const result = deduplicator.deduplicate(listings);
// => { kept, removed, stats }
```

### OutlierDetector

```typescript
const detector = new OutlierDetector({
  methods: {
    useIQR: true,
    useZScore: true,
    useModifiedZScore: true,
    useDomainRules: true,
  },
  thresholds: {
    iqrMultiplier: 1.5,
    zScoreThreshold: 3.0,
    modifiedZScoreThreshold: 3.5,
  },
});

const analysis = detector.detectOutliers(comps);
// => { outliers, statistics, recommendations }
```

---

## 🤝 Support

### Questions?
- Check logs: `tail -f logs/data_pipeline.log`
- Review feature flag status: `FeatureFlags.getAllFlags()`
- Test in isolation: Use the provided test scripts

### Issues?
- Disable problematic feature: Set `USE_*=false`
- Report in project issues
- Rollback: Previous code paths still work

### Performance Issues?
- Lower rollout percentage temporarily
- Check metrics: validation/scoring overhead should be <50ms
- Consider batching: Use `BatchValidator` and `BatchQualityAnalyzer`

---

## ✅ Next Steps

1. **Enable shadow mode first**: Test without risk
2. **Start with 10% rollout**: Validate in production
3. **Monitor metrics**: Track quality scores and performance
4. **Scale gradually**: 10% → 25% → 50% → 100%
5. **Iterate**: Adjust thresholds based on real data

**Remember**: All features are optional and backwards compatible. Your existing system continues to work without any changes.
