#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { Database } from 'better-sqlite3';

interface DataQualityMetrics {
  totalRecords: number;
  completeness: {
    set_name: number;
    card_number: number;
    pokemon_name: number;
    ebay_url: number;
    grading_company: number;
    grade_number: number;
  };
  priceQuality: {
    validPrices: number;
    outliers: number;
    precisionIssues: number;
  };
  dataConsistency: {
    duplicateTitles: number;
    inconsistentGrades: number;
    missingUrls: number;
  };
  sampleIssues: any[];
}

class EBayDataQualityAssessment {
  private db: Database;
  private metrics: DataQualityMetrics;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.metrics = {
      totalRecords: 0,
      completeness: {
        set_name: 0,
        card_number: 0,
        pokemon_name: 0,
        ebay_url: 0,
        grading_company: 0,
        grade_number: 0,
      },
      priceQuality: {
        validPrices: 0,
        outliers: 0,
        precisionIssues: 0,
      },
      dataConsistency: {
        duplicateTitles: 0,
        inconsistentGrades: 0,
        missingUrls: 0,
      },
      sampleIssues: []
    };
  }

  async assessDataQuality(): Promise<DataQualityMetrics> {
    console.log('🔍 Starting comprehensive eBay data quality assessment...\n');

    // Get total record count
    this.assessTotalRecords();
    
    // Assess data completeness
    this.assessCompleteness();
    
    // Assess price quality
    this.assessPriceQuality();
    
    // Assess data consistency
    this.assessDataConsistency();
    
    // Find sample issues for analysis
    this.findSampleIssues();

    return this.metrics;
  }

  private assessTotalRecords() {
    const currentCount = this.db.prepare('SELECT COUNT(*) as count FROM ebay_current_listings').get().count;
    const soldCount = this.db.prepare('SELECT COUNT(*) as count FROM ebay_sold_listings').get().count;
    const analyticsCount = this.db.prepare('SELECT COUNT(*) as count FROM ebay_price_analytics').get().count;
    
    this.metrics.totalRecords = currentCount + soldCount + analyticsCount;
    
    console.log('📊 TOTAL RECORDS:');
    console.log(`   Current Listings: ${currentCount.toLocaleString()}`);
    console.log(`   Sold Listings: ${soldCount.toLocaleString()}`);
    console.log(`   Price Analytics: ${analyticsCount.toLocaleString()}`);
    console.log(`   Total: ${this.metrics.totalRecords.toLocaleString()}\n`);
  }

  private assessCompleteness() {
    console.log('📋 DATA COMPLETENESS ANALYSIS:');
    
    // Check current listings completeness
    const currentCompleteness = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(set_name) as set_name_count,
        COUNT(card_number) as card_number_count,
        COUNT(pokemon_name) as pokemon_name_count,
        COUNT(ebay_url) as ebay_url_count,
        COUNT(grading_company) as grading_company_count,
        COUNT(grade_number) as grade_number_count
      FROM ebay_current_listings
    `).get();

    const currentTotal = currentCompleteness.total;
    
    this.metrics.completeness.set_name = (currentCompleteness.set_name_count / currentTotal) * 100;
    this.metrics.completeness.card_number = (currentCompleteness.card_number_count / currentTotal) * 100;
    this.metrics.completeness.pokemon_name = (currentCompleteness.pokemon_name_count / currentTotal) * 100;
    this.metrics.completeness.ebay_url = (currentCompleteness.ebay_url_count / currentTotal) * 100;
    this.metrics.completeness.grading_company = (currentCompleteness.grading_company_count / currentTotal) * 100;
    this.metrics.completeness.grade_number = (currentCompleteness.grade_number_count / currentTotal) * 100;

    console.log('   Current Listings:');
    console.log(`     Set Name: ${this.metrics.completeness.set_name.toFixed(1)}%`);
    console.log(`     Card Number: ${this.metrics.completeness.card_number.toFixed(1)}%`);
    console.log(`     Pokemon Name: ${this.metrics.completeness.pokemon_name.toFixed(1)}%`);
    console.log(`     eBay URL: ${this.metrics.completeness.ebay_url.toFixed(1)}%`);
    console.log(`     Grading Company: ${this.metrics.completeness.grading_company.toFixed(1)}%`);
    console.log(`     Grade Number: ${this.metrics.completeness.grade_number.toFixed(1)}%\n`);
  }

  private assessPriceQuality() {
    console.log('💰 PRICE QUALITY ANALYSIS:');
    
    // Check price precision issues (excessive decimal places)
    const precisionIssues = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM ebay_current_listings 
      WHERE current_price IS NOT NULL 
        AND CAST(current_price AS TEXT) LIKE '%.________%'
    `).get().count;

    // Check for price outliers (unrealistic prices)
    const outliers = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM ebay_current_listings 
      WHERE current_price > 100000 OR current_price < 0.01
    `).get().count;

    // Check valid prices
    const validPrices = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM ebay_current_listings 
      WHERE current_price IS NOT NULL 
        AND current_price > 0 
        AND current_price <= 100000
    `).get().count;

    this.metrics.priceQuality.validPrices = validPrices;
    this.metrics.priceQuality.outliers = outliers;
    this.metrics.priceQuality.precisionIssues = precisionIssues;

    console.log(`   Valid Prices: ${validPrices.toLocaleString()}`);
    console.log(`   Precision Issues: ${precisionIssues.toLocaleString()}`);
    console.log(`   Price Outliers: ${outliers.toLocaleString()}\n`);
  }

  private assessDataConsistency() {
    console.log('🔧 DATA CONSISTENCY ANALYSIS:');
    
    // Check for duplicate titles
    const duplicateTitles = this.db.prepare(`
      SELECT title, COUNT(*) as count 
      FROM ebay_current_listings 
      GROUP BY title 
      HAVING COUNT(*) > 1
      ORDER BY count DESC 
      LIMIT 10
    `).all();

    this.metrics.dataConsistency.duplicateTitles = duplicateTitles.length;

    // Check for inconsistent grading
    const inconsistentGrades = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM ebay_current_listings 
      WHERE grading_company IS NOT NULL 
        AND grade_number IS NULL
    `).get().count;

    // Check missing URLs
    const missingUrls = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM ebay_current_listings 
      WHERE ebay_url IS NULL
    `).get().count;

    this.metrics.dataConsistency.inconsistentGrades = inconsistentGrades;
    this.metrics.dataConsistency.missingUrls = missingUrls;

    console.log(`   Duplicate Titles: ${duplicateTitles.length} groups`);
    console.log(`   Inconsistent Grades: ${inconsistentGrades.toLocaleString()}`);
    console.log(`   Missing URLs: ${missingUrls.toLocaleString()}\n`);

    if (duplicateTitles.length > 0) {
      console.log('   Top Duplicate Titles:');
      duplicateTitles.slice(0, 5).forEach((dup, i) => {
        console.log(`     ${i + 1}. "${dup.title}" (${dup.count} occurrences)`);
      });
      console.log('');
    }
  }

  private findSampleIssues() {
    console.log('🔍 SAMPLE DATA ISSUES:');
    
    // Find sample records with missing set information
    const missingSetSamples = this.db.prepare(`
      SELECT title, current_price, grading_company, grade_number 
      FROM ebay_current_listings 
      WHERE set_name IS NULL 
      LIMIT 5
    `).all();

    // Find sample records with precision issues
    const precisionSamples = this.db.prepare(`
      SELECT title, current_price 
      FROM ebay_current_listings 
      WHERE CAST(current_price AS TEXT) LIKE '%.________%'
      LIMIT 3
    `).all();

    // Find sample records with inconsistent grading
    const gradingSamples = this.db.prepare(`
      SELECT title, grading_company, grade_number 
      FROM ebay_current_listings 
      WHERE grading_company IS NOT NULL 
        AND grade_number IS NULL
      LIMIT 3
    `).all();

    this.metrics.sampleIssues = [
      { type: 'missing_set', samples: missingSetSamples },
      { type: 'precision_issues', samples: precisionSamples },
      { type: 'grading_inconsistency', samples: gradingSamples }
    ];

    console.log('   Missing Set Information:');
    missingSetSamples.forEach((sample, i) => {
      console.log(`     ${i + 1}. "${sample.title}" - $${sample.current_price?.toFixed(2)}`);
    });

    console.log('\n   Price Precision Issues:');
    precisionSamples.forEach((sample, i) => {
      console.log(`     ${i + 1}. "${sample.title}" - $${sample.current_price}`);
    });

    console.log('\n   Grading Inconsistencies:');
    gradingSamples.forEach((sample, i) => {
      console.log(`     ${i + 1}. "${sample.title}" - ${sample.grading_company} (no grade)`);
    });
    console.log('');
  }

  generateReport(): string {
    const report = `
# eBay Data Quality Assessment Report

## Executive Summary
- **Total Records**: ${this.metrics.totalRecords.toLocaleString()}
- **Data Completeness**: ${Object.values(this.metrics.completeness).reduce((a, b) => a + b, 0) / 6}%
- **Price Quality**: ${((this.metrics.priceQuality.validPrices / (this.metrics.priceQuality.validPrices + this.metrics.priceQuality.outliers)) * 100).toFixed(1)}%

## Critical Issues Identified
1. **Missing Set Information**: ${(100 - this.metrics.completeness.set_name).toFixed(1)}% of records missing set_name
2. **Missing Card Numbers**: ${(100 - this.metrics.completeness.card_number).toFixed(1)}% of records missing card_number
3. **Price Precision Issues**: ${this.metrics.priceQuality.precisionIssues.toLocaleString()} records with excessive decimal precision
4. **Missing URLs**: ${this.metrics.dataConsistency.missingUrls.toLocaleString()} records missing eBay URLs

## Recommended Actions
1. Implement title parsing to extract set and card information
2. Normalize price precision to 2 decimal places
3. Standardize grading company and grade formats
4. Cross-reference with Pokemon TCG API for missing data
5. Implement data validation pipeline

## Sample Issues
${this.metrics.sampleIssues.map(issue => `
### ${issue.type.replace('_', ' ').toUpperCase()}
${issue.samples.map((sample: any, i: number) => 
  `${i + 1}. ${JSON.stringify(sample, null, 2)}`
).join('\n')}
`).join('\n')}
`;

    return report;
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const dbPath = process.argv[2] || 'research/tcgplayer-discovery/collector_crypt_ebay_complete.db';
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  const assessment = new EBayDataQualityAssessment(dbPath);
  
  try {
    const metrics = await assessment.assessDataQuality();
    
    // Generate and save report
    const report = assessment.generateReport();
    const reportPath = 'reports/ebay-data-quality-assessment.md';
    
    // Ensure reports directory exists
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(reportPath, report);
    
    console.log(`\n✅ Assessment complete! Report saved to: ${reportPath}`);
    
    // Save metrics as JSON for programmatic use
    fs.writeFileSync('reports/ebay-quality-metrics.json', JSON.stringify(metrics, null, 2));
    
  } catch (error) {
    console.error('❌ Assessment failed:', error);
    process.exit(1);
  } finally {
    assessment.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { EBayDataQualityAssessment };
