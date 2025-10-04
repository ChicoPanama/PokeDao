/**
 * Validate UnifiedMarketListing schema compliance across all sources
 *
 * This script:
 * 1. Reads all UnifiedMarketListing records from database
 * 2. Validates field constraints (VARCHAR limits, required fields, enum values)
 * 3. Reports schema violations by source
 * 4. Suggests fixes for common issues
 *
 * Run: pnpm tsx scripts/validate-unified-schema.ts
 */

import 'dotenv/config';
import { PrismaClient, MarketSource, GradeCompany } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

interface ValidationIssue {
  id: string;
  source: string;
  field: string;
  issue: string;
  value: any;
}

interface ValidationReport {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  issuesBySeverity: {
    critical: ValidationIssue[];
    warning: ValidationIssue[];
  };
  issuesBySource: Record<string, number>;
  issuesByField: Record<string, number>;
}

// ============================================================================
// VALIDATOR
// ============================================================================

class UnifiedSchemaValidator {
  private issues: ValidationIssue[] = [];

  /**
   * Validate a single listing
   */
  validateListing(listing: any): boolean {
    let isValid = true;

    // Required fields
    if (!listing.id || listing.id.length === 0 || listing.id.length > 191) {
      this.addIssue(listing, 'id', 'critical', `Invalid ID length: ${listing.id?.length || 0}`);
      isValid = false;
    }

    if (!listing.source) {
      this.addIssue(listing, 'source', 'critical', 'Missing required field');
      isValid = false;
    }

    if (!listing.sourceId || listing.sourceId.length > 100) {
      this.addIssue(listing, 'sourceId', 'critical', `Invalid sourceId length: ${listing.sourceId?.length || 0}`);
      isValid = false;
    }

    if (!listing.title || listing.title.length > 500) {
      this.addIssue(listing, 'title', 'critical', `Invalid title length: ${listing.title?.length || 0}`);
      isValid = false;
    }

    if (!listing.rawTitle || listing.rawTitle.length > 500) {
      this.addIssue(listing, 'rawTitle', 'critical', `Invalid rawTitle length: ${listing.rawTitle?.length || 0}`);
      isValid = false;
    }

    // Optional VARCHAR fields
    if (listing.cardName && listing.cardName.length > 255) {
      this.addIssue(listing, 'cardName', 'warning', `Exceeds VARCHAR(255): ${listing.cardName.length}`);
      isValid = false;
    }

    if (listing.setName && listing.setName.length > 255) {
      this.addIssue(listing, 'setName', 'warning', `Exceeds VARCHAR(255): ${listing.setName.length}`);
      isValid = false;
    }

    if (listing.cardNumber && listing.cardNumber.length > 10) {
      this.addIssue(listing, 'cardNumber', 'warning', `Exceeds VARCHAR(10): ${listing.cardNumber.length}`);
      isValid = false;
    }

    if (listing.variant && listing.variant.length > 100) {
      this.addIssue(listing, 'variant', 'warning', `Exceeds VARCHAR(100): ${listing.variant.length}`);
      isValid = false;
    }

    if (listing.condition && listing.condition.length > 50) {
      this.addIssue(listing, 'condition', 'warning', `Exceeds VARCHAR(50): ${listing.condition.length}`);
      isValid = false;
    }

    if (listing.currency && listing.currency.length > 3) {
      this.addIssue(listing, 'currency', 'warning', `Exceeds VARCHAR(3): ${listing.currency.length}`);
      isValid = false;
    }

    if (listing.location && listing.location.length > 255) {
      this.addIssue(listing, 'location', 'warning', `Exceeds VARCHAR(255): ${listing.location.length}`);
      isValid = false;
    }

    if (listing.url && listing.url.length > 500) {
      this.addIssue(listing, 'url', 'warning', `Exceeds VARCHAR(500): ${listing.url.length}`);
      isValid = false;
    }

    // Enum validation
    const validSources = Object.values(MarketSource);
    if (listing.source && !validSources.includes(listing.source)) {
      this.addIssue(listing, 'source', 'critical', `Invalid MarketSource: ${listing.source}`);
      isValid = false;
    }

    const validGradeCompanies = Object.values(GradeCompany);
    if (listing.gradeCompany && !validGradeCompanies.includes(listing.gradeCompany)) {
      this.addIssue(listing, 'gradeCompany', 'warning', `Invalid GradeCompany: ${listing.gradeCompany}`);
      isValid = false;
    }

    // Numeric validations
    if (listing.priceCents === null || listing.priceCents === undefined) {
      this.addIssue(listing, 'priceCents', 'critical', 'Missing required field');
      isValid = false;
    }

    if (listing.priceCents < 0) {
      this.addIssue(listing, 'priceCents', 'warning', `Negative price: ${listing.priceCents}`);
    }

    if (listing.grade !== null && listing.grade !== undefined) {
      if (listing.grade < 0 || listing.grade > 10) {
        this.addIssue(listing, 'grade', 'warning', `Grade out of range: ${listing.grade}`);
      }
    }

    if (listing.dataQuality !== null && listing.dataQuality !== undefined) {
      if (listing.dataQuality < 0 || listing.dataQuality > 1) {
        this.addIssue(listing, 'dataQuality', 'warning', `dataQuality out of range: ${listing.dataQuality}`);
      }
    }

    // Date validations
    if (listing.createdAt && !(listing.createdAt instanceof Date)) {
      this.addIssue(listing, 'createdAt', 'critical', 'Invalid date type');
      isValid = false;
    }

    if (listing.updatedAt && !(listing.updatedAt instanceof Date)) {
      this.addIssue(listing, 'updatedAt', 'critical', 'Invalid date type');
      isValid = false;
    }

    return isValid;
  }

  /**
   * Add a validation issue
   */
  private addIssue(listing: any, field: string, severity: 'critical' | 'warning', issue: string) {
    this.issues.push({
      id: listing.id || 'UNKNOWN',
      source: listing.source || 'UNKNOWN',
      field,
      issue: `[${severity.toUpperCase()}] ${issue}`,
      value: listing[field],
    });
  }

  /**
   * Generate validation report
   */
  generateReport(totalRecords: number): ValidationReport {
    const critical = this.issues.filter(i => i.issue.startsWith('[CRITICAL]'));
    const warnings = this.issues.filter(i => i.issue.startsWith('[WARNING]'));

    const issuesBySource: Record<string, number> = {};
    const issuesByField: Record<string, number> = {};

    for (const issue of this.issues) {
      issuesBySource[issue.source] = (issuesBySource[issue.source] || 0) + 1;
      issuesByField[issue.field] = (issuesByField[issue.field] || 0) + 1;
    }

    const invalidIds = new Set(this.issues.map(i => i.id));
    const invalidRecords = invalidIds.size;

    return {
      totalRecords,
      validRecords: totalRecords - invalidRecords,
      invalidRecords,
      issuesBySeverity: {
        critical,
        warning: warnings,
      },
      issuesBySource,
      issuesByField,
    };
  }

  /**
   * Get all issues
   */
  getIssues(): ValidationIssue[] {
    return this.issues;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔍 UNIFIED SCHEMA VALIDATION');
  console.log('=' .repeat(60));
  console.log('📊 Validating UnifiedMarketListing schema compliance\n');

  const prisma = new PrismaClient();
  const validator = new UnifiedSchemaValidator();

  try {
    // Fetch all listings
    console.log('📥 Fetching listings from database...');
    const listings = await prisma.unifiedMarketListing.findMany({
      orderBy: { source: 'asc' },
    });

    console.log(`✓ Loaded ${listings.length.toLocaleString()} listings\n`);

    // Validate each listing
    console.log('🔍 Validating schema compliance...\n');
    let validCount = 0;
    let invalidCount = 0;

    for (const listing of listings) {
      const isValid = validator.validateListing(listing);
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    // Generate report
    const report = validator.generateReport(listings.length);

    console.log('='.repeat(60));
    console.log('📊 VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total Records: ${report.totalRecords.toLocaleString()}`);
    console.log(`✅ Valid: ${report.validRecords.toLocaleString()} (${((report.validRecords / report.totalRecords) * 100).toFixed(1)}%)`);
    console.log(`❌ Invalid: ${report.invalidRecords.toLocaleString()} (${((report.invalidRecords / report.totalRecords) * 100).toFixed(1)}%)`);
    console.log();

    console.log(`Critical Issues: ${report.issuesBySeverity.critical.length.toLocaleString()}`);
    console.log(`Warnings: ${report.issuesBySeverity.warning.length.toLocaleString()}`);
    console.log();

    // Issues by source
    console.log('📦 Issues by Source:');
    Object.entries(report.issuesBySource)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count.toLocaleString()} issues`);
      });
    console.log();

    // Issues by field
    console.log('📋 Issues by Field:');
    Object.entries(report.issuesByField)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([field, count]) => {
        console.log(`  ${field}: ${count.toLocaleString()} issues`);
      });
    console.log();

    // Show sample critical issues
    if (report.issuesBySeverity.critical.length > 0) {
      console.log('🚨 Sample Critical Issues (first 10):');
      report.issuesBySeverity.critical.slice(0, 10).forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.source}] ${issue.field}: ${issue.issue}`);
        console.log(`     ID: ${issue.id}`);
        if (issue.value !== undefined && issue.value !== null) {
          const valueStr = String(issue.value).substring(0, 100);
          console.log(`     Value: ${valueStr}${String(issue.value).length > 100 ? '...' : ''}`);
        }
        console.log();
      });
    }

    // Show sample warnings
    if (report.issuesBySeverity.warning.length > 0 && report.issuesBySeverity.critical.length === 0) {
      console.log('⚠️  Sample Warnings (first 10):');
      report.issuesBySeverity.warning.slice(0, 10).forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.source}] ${issue.field}: ${issue.issue}`);
        console.log(`     ID: ${issue.id}`);
        console.log();
      });
    }

    console.log('='.repeat(60));

    if (report.invalidRecords === 0) {
      console.log('✅ All records pass schema validation!');
    } else {
      console.log(`❌ ${report.invalidRecords.toLocaleString()} records need attention`);
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
