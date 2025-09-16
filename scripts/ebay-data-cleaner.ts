#!/usr/bin/env tsx

import { Database } from 'better-sqlite3';
import fs from 'fs';
import { EBayTitleParser, ParsedCardInfo } from './ebay-title-parser.js';
import { EBayPriceNormalizer, PriceNormalizationResult } from './ebay-price-normalizer.js';

interface CleaningStats {
  totalProcessed: number;
  successfullyCleaned: number;
  failedCleaning: number;
  improvements: {
    setNamesAdded: number;
    cardNumbersAdded: number;
    pokemonNamesAdded: number;
    gradesStandardized: number;
    pricesNormalized: number;
    urlsGenerated: number;
  };
  qualityMetrics: {
    averageConfidence: number;
    completenessBefore: number;
    completenessAfter: number;
  };
}

interface CleanedCardData {
  id: number;
  ebay_item_id: string;
  title: string;
  
  // Original data
  original_set_name?: string;
  original_card_number?: string;
  original_pokemon_name?: string;
  original_grading_company?: string;
  original_grade_number?: string;
  original_price?: number;
  
  // Cleaned data
  cleaned_set_name?: string;
  cleaned_set_code?: string;
  cleaned_card_number?: string;
  cleaned_pokemon_name?: string;
  cleaned_grading_company?: string;
  cleaned_grade_number?: string;
  cleaned_price?: number;
  cleaned_currency?: string;
  cleaned_condition?: string;
  cleaned_variant?: string;
  
  // Generated data
  generated_ebay_url?: string;
  confidence_score?: number;
  data_quality_score?: number;
  
  // Metadata
  cleaning_timestamp: string;
  parser_confidence: number;
}

class EBayDataCleaner {
  private db: Database;
  private titleParser: EBayTitleParser;
  private priceNormalizer: EBayPriceNormalizer;
  private stats: CleaningStats;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.titleParser = new EBayTitleParser();
    this.priceNormalizer = new EBayPriceNormalizer();
    this.stats = {
      totalProcessed: 0,
      successfullyCleaned: 0,
      failedCleaning: 0,
      improvements: {
        setNamesAdded: 0,
        cardNumbersAdded: 0,
        pokemonNamesAdded: 0,
        gradesStandardized: 0,
        pricesNormalized: 0,
        urlsGenerated: 0,
      },
      qualityMetrics: {
        averageConfidence: 0,
        completenessBefore: 0,
        completenessAfter: 0,
      }
    };
  }

  async cleanCurrentListings(batchSize: number = 1000, startId: number = 0): Promise<CleaningStats> {
    console.log('🧹 Starting eBay current listings cleaning process...\n');

    // Create cleaned table if it doesn't exist
    this.createCleanedTable();

    // Get total count for progress tracking
    const totalCount = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM ebay_current_listings 
      WHERE id >= ?
    `).get(startId).count;

    console.log(`📊 Processing ${totalCount.toLocaleString()} records starting from ID ${startId}\n`);

    let processed = 0;
    let offset = startId;

    while (processed < totalCount) {
      const batch = this.db.prepare(`
        SELECT * FROM ebay_current_listings 
        WHERE id >= ? 
        ORDER BY id 
        LIMIT ?
      `).all(offset, batchSize);

      if (batch.length === 0) break;

      console.log(`🔄 Processing batch: ${processed + 1}-${processed + batch.length} of ${totalCount}`);

      for (const record of batch) {
        try {
          const cleanedData = await this.cleanRecord(record);
          this.insertCleanedRecord(cleanedData);
          this.stats.successfullyCleaned++;
        } catch (error) {
          console.error(`❌ Failed to clean record ${record.id}:`, error);
          this.stats.failedCleaning++;
        }
        
        this.stats.totalProcessed++;
      }

      processed += batch.length;
      offset = batch[batch.length - 1].id + 1;

      // Log progress every 10 batches
      if (Math.floor(processed / batchSize) % 10 === 0) {
        this.logProgress();
      }
    }

    this.calculateFinalStats();
    this.logFinalReport();

    return this.stats;
  }

  private createCleanedTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ebay_current_listings_cleaned (
        id INTEGER PRIMARY KEY,
        ebay_item_id TEXT UNIQUE,
        title TEXT NOT NULL,
        
        -- Original data
        original_set_name TEXT,
        original_card_number TEXT,
        original_pokemon_name TEXT,
        original_grading_company TEXT,
        original_grade_number TEXT,
        original_price REAL,
        
        -- Cleaned data
        cleaned_set_name TEXT,
        cleaned_set_code TEXT,
        cleaned_card_number TEXT,
        cleaned_pokemon_name TEXT,
        cleaned_grading_company TEXT,
        cleaned_grade_number TEXT,
        cleaned_price REAL,
        cleaned_currency TEXT DEFAULT 'USD',
        cleaned_condition TEXT,
        cleaned_variant TEXT,
        
        -- Generated data
        generated_ebay_url TEXT,
        confidence_score REAL,
        data_quality_score REAL,
        
        -- Metadata
        cleaning_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        parser_confidence REAL,
        
        -- Indexes for performance
        INDEX idx_cleaned_pokemon (cleaned_pokemon_name),
        INDEX idx_cleaned_set (cleaned_set_code),
        INDEX idx_cleaned_grade (cleaned_grading_company, cleaned_grade_number),
        INDEX idx_cleaned_price (cleaned_price),
        INDEX idx_cleaned_confidence (confidence_score)
      )
    `);
  }

  private async cleanRecord(record: any): Promise<CleanedCardData> {
    const cleaned: CleanedCardData = {
      id: record.id,
      ebay_item_id: record.ebay_item_id,
      title: record.title,
      cleaning_timestamp: new Date().toISOString(),
      
      // Store original data
      original_set_name: record.set_name,
      original_card_number: record.card_number,
      original_pokemon_name: record.pokemon_name,
      original_grading_company: record.grading_company,
      original_grade_number: record.grade_number,
      original_price: record.current_price || record.buy_it_now_price,
    };

    // Parse title to extract information
    const parsedInfo = this.titleParser.parseTitle(record.title);
    cleaned.parser_confidence = parsedInfo.confidence;

    // Apply parsed information
    if (parsedInfo.pokemonName && !record.pokemon_name) {
      cleaned.cleaned_pokemon_name = parsedInfo.pokemonName;
      this.stats.improvements.pokemonNamesAdded++;
    } else {
      cleaned.cleaned_pokemon_name = record.pokemon_name;
    }

    if (parsedInfo.setName && !record.set_name) {
      cleaned.cleaned_set_name = parsedInfo.setName;
      cleaned.cleaned_set_code = parsedInfo.setCode;
      this.stats.improvements.setNamesAdded++;
    } else {
      cleaned.cleaned_set_name = record.set_name;
      cleaned.cleaned_set_code = this.titleParser.getSetMappings()[record.set_name?.toLowerCase()]?.code;
    }

    if (parsedInfo.cardNumber && !record.card_number) {
      cleaned.cleaned_card_number = parsedInfo.cardNumber;
      this.stats.improvements.cardNumbersAdded++;
    } else {
      cleaned.cleaned_card_number = record.card_number;
    }

    // Standardize grading information
    if (parsedInfo.gradingCompany || record.grading_company) {
      cleaned.cleaned_grading_company = this.standardizeGradingCompany(
        parsedInfo.gradingCompany || record.grading_company
      );
    }

    if (parsedInfo.grade || record.grade_number) {
      cleaned.cleaned_grade_number = this.standardizeGrade(
        parsedInfo.grade || record.grade_number
      );
    }

    // Normalize price
    const price = record.current_price || record.buy_it_now_price;
    if (price) {
      const normalizedPrice = this.priceNormalizer.normalizePrice(price);
      cleaned.cleaned_price = normalizedPrice.normalizedPrice;
      cleaned.cleaned_currency = normalizedPrice.currency;
      
      if (normalizedPrice.issues.length === 0) {
        this.stats.improvements.pricesNormalized++;
      }
    }

    // Set condition and variant
    cleaned.cleaned_condition = parsedInfo.condition || record.condition_description;
    cleaned.cleaned_variant = parsedInfo.variant;

    // Generate eBay URL if missing
    if (!record.ebay_url && record.ebay_item_id) {
      cleaned.generated_ebay_url = `https://www.ebay.com/itm/${record.ebay_item_id}`;
      this.stats.improvements.urlsGenerated++;
    } else {
      cleaned.generated_ebay_url = record.ebay_url;
    }

    // Calculate confidence and quality scores
    cleaned.confidence_score = this.calculateConfidenceScore(cleaned, parsedInfo);
    cleaned.data_quality_score = this.calculateDataQualityScore(cleaned);

    return cleaned;
  }

  private standardizeGradingCompany(company: string): string {
    if (!company) return '';
    
    const companyMap: { [key: string]: string } = {
      'psa': 'PSA',
      'professional sports authenticator': 'PSA',
      'bgs': 'BGS',
      'beckett': 'BGS',
      'cgc': 'CGC',
      'sgc': 'SGC',
      'black label': 'BGS',
      'gold label': 'BGS',
      'silver label': 'BGS'
    };

    return companyMap[company.toLowerCase()] || company.toUpperCase();
  }

  private standardizeGrade(grade: string): string {
    if (!grade) return '';
    
    // Extract numeric grade
    const match = grade.toString().match(/(\d+(?:\.\d+)?)/);
    return match ? match[1] : grade;
  }

  private calculateConfidenceScore(cleaned: CleanedCardData, parsedInfo: ParsedCardInfo): number {
    let score = 0;
    
    // Base score from parser confidence
    score += parsedInfo.confidence * 0.4;
    
    // Completeness score
    const fields = [
      cleaned.cleaned_pokemon_name,
      cleaned.cleaned_set_name,
      cleaned.cleaned_card_number,
      cleaned.cleaned_grading_company,
      cleaned.cleaned_grade_number,
      cleaned.cleaned_price
    ];
    
    const completedFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
    score += (completedFields / fields.length) * 0.4;
    
    // Price validity score
    if (cleaned.cleaned_price) {
      const priceResult = this.priceNormalizer.normalizePrice(cleaned.cleaned_price);
      score += priceResult.confidence * 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  private calculateDataQualityScore(cleaned: CleanedCardData): number {
    let score = 0;
    
    // Pokemon name quality
    if (cleaned.cleaned_pokemon_name) score += 0.2;
    
    // Set information quality
    if (cleaned.cleaned_set_name && cleaned.cleaned_set_code) score += 0.2;
    
    // Card number quality
    if (cleaned.cleaned_card_number) score += 0.15;
    
    // Grading information quality
    if (cleaned.cleaned_grading_company && cleaned.cleaned_grade_number) score += 0.15;
    
    // Price quality
    if (cleaned.cleaned_price && cleaned.cleaned_price > 0) score += 0.15;
    
    // URL availability
    if (cleaned.generated_ebay_url) score += 0.1;
    
    // Condition information
    if (cleaned.cleaned_condition) score += 0.05;
    
    return Math.min(score, 1.0);
  }

  private insertCleanedRecord(cleaned: CleanedCardData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ebay_current_listings_cleaned (
        id, ebay_item_id, title,
        original_set_name, original_card_number, original_pokemon_name,
        original_grading_company, original_grade_number, original_price,
        cleaned_set_name, cleaned_set_code, cleaned_card_number,
        cleaned_pokemon_name, cleaned_grading_company, cleaned_grade_number,
        cleaned_price, cleaned_currency, cleaned_condition, cleaned_variant,
        generated_ebay_url, confidence_score, data_quality_score,
        cleaning_timestamp, parser_confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      cleaned.id, cleaned.ebay_item_id, cleaned.title,
      cleaned.original_set_name, cleaned.original_card_number, cleaned.original_pokemon_name,
      cleaned.original_grading_company, cleaned.original_grade_number, cleaned.original_price,
      cleaned.cleaned_set_name, cleaned.cleaned_set_code, cleaned.cleaned_card_number,
      cleaned.cleaned_pokemon_name, cleaned.cleaned_grading_company, cleaned.cleaned_grade_number,
      cleaned.cleaned_price, cleaned.cleaned_currency, cleaned.cleaned_condition, cleaned.cleaned_variant,
      cleaned.generated_ebay_url, cleaned.confidence_score, cleaned.data_quality_score,
      cleaned.cleaning_timestamp, cleaned.parser_confidence
    );
  }

  private logProgress() {
    const progress = (this.stats.totalProcessed / (this.stats.totalProcessed + this.stats.failedCleaning)) * 100;
    console.log(`📈 Progress: ${progress.toFixed(1)}% - Processed: ${this.stats.totalProcessed.toLocaleString()}, Failed: ${this.stats.failedCleaning.toLocaleString()}`);
  }

  private calculateFinalStats() {
    // Calculate average confidence
    const avgConfidence = this.db.prepare(`
      SELECT AVG(confidence_score) as avg_confidence 
      FROM ebay_current_listings_cleaned
    `).get().avg_confidence || 0;
    
    this.stats.qualityMetrics.averageConfidence = avgConfidence;

    // Calculate completeness before and after
    const originalCompleteness = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(set_name) as set_name_count,
        COUNT(card_number) as card_number_count,
        COUNT(pokemon_name) as pokemon_name_count
      FROM ebay_current_listings
    `).get();

    const cleanedCompleteness = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(cleaned_set_name) as set_name_count,
        COUNT(cleaned_card_number) as card_number_count,
        COUNT(cleaned_pokemon_name) as pokemon_name_count
      FROM ebay_current_listings_cleaned
    `).get();

    const originalAvg = (
      (originalCompleteness.set_name_count / originalCompleteness.total) +
      (originalCompleteness.card_number_count / originalCompleteness.total) +
      (originalCompleteness.pokemon_name_count / originalCompleteness.total)
    ) / 3 * 100;

    const cleanedAvg = (
      (cleanedCompleteness.set_name_count / cleanedCompleteness.total) +
      (cleanedCompleteness.card_number_count / cleanedCompleteness.total) +
      (cleanedCompleteness.pokemon_name_count / cleanedCompleteness.total)
    ) / 3 * 100;

    this.stats.qualityMetrics.completenessBefore = originalAvg;
    this.stats.qualityMetrics.completenessAfter = cleanedAvg;
  }

  private logFinalReport() {
    console.log('\n🎉 CLEANING PROCESS COMPLETE!\n');
    console.log('📊 FINAL STATISTICS:');
    console.log(`   Total Processed: ${this.stats.totalProcessed.toLocaleString()}`);
    console.log(`   Successfully Cleaned: ${this.stats.successfullyCleaned.toLocaleString()}`);
    console.log(`   Failed: ${this.stats.failedCleaning.toLocaleString()}`);
    console.log(`   Success Rate: ${((this.stats.successfullyCleaned / this.stats.totalProcessed) * 100).toFixed(1)}%\n`);

    console.log('🔧 IMPROVEMENTS MADE:');
    console.log(`   Set Names Added: ${this.stats.improvements.setNamesAdded.toLocaleString()}`);
    console.log(`   Card Numbers Added: ${this.stats.improvements.cardNumbersAdded.toLocaleString()}`);
    console.log(`   Pokemon Names Added: ${this.stats.improvements.pokemonNamesAdded.toLocaleString()}`);
    console.log(`   Grades Standardized: ${this.stats.improvements.gradesStandardized.toLocaleString()}`);
    console.log(`   Prices Normalized: ${this.stats.improvements.pricesNormalized.toLocaleString()}`);
    console.log(`   URLs Generated: ${this.stats.improvements.urlsGenerated.toLocaleString()}\n`);

    console.log('📈 QUALITY METRICS:');
    console.log(`   Average Confidence: ${(this.stats.qualityMetrics.averageConfidence * 100).toFixed(1)}%`);
    console.log(`   Completeness Before: ${this.stats.qualityMetrics.completenessBefore.toFixed(1)}%`);
    console.log(`   Completeness After: ${this.stats.qualityMetrics.completenessAfter.toFixed(1)}%`);
    console.log(`   Improvement: +${(this.stats.qualityMetrics.completenessAfter - this.stats.qualityMetrics.completenessBefore).toFixed(1)}%\n`);
  }

  // Export cleaned data to JSON for analysis
  exportCleanedData(limit?: number): CleanedCardData[] {
    const query = limit 
      ? `SELECT * FROM ebay_current_listings_cleaned ORDER BY confidence_score DESC LIMIT ?`
      : `SELECT * FROM ebay_current_listings_cleaned ORDER BY confidence_score DESC`;
    
    const params = limit ? [limit] : [];
    return this.db.prepare(query).all(...params);
  }

  // Generate quality report
  generateQualityReport(): string {
    const report = `
# eBay Data Cleaning Quality Report

## Summary
- **Total Records Processed**: ${this.stats.totalProcessed.toLocaleString()}
- **Success Rate**: ${((this.stats.successfullyCleaned / this.stats.totalProcessed) * 100).toFixed(1)}%
- **Average Confidence Score**: ${(this.stats.qualityMetrics.averageConfidence * 100).toFixed(1)}%

## Data Improvements
- **Set Names Added**: ${this.stats.improvements.setNamesAdded.toLocaleString()}
- **Card Numbers Added**: ${this.stats.improvements.cardNumbersAdded.toLocaleString()}
- **Pokemon Names Added**: ${this.stats.improvements.pokemonNamesAdded.toLocaleString()}
- **Grades Standardized**: ${this.stats.improvements.gradesStandardized.toLocaleString()}
- **Prices Normalized**: ${this.stats.improvements.pricesNormalized.toLocaleString()}
- **URLs Generated**: ${this.stats.improvements.urlsGenerated.toLocaleString()}

## Quality Metrics
- **Completeness Before**: ${this.stats.qualityMetrics.completenessBefore.toFixed(1)}%
- **Completeness After**: ${this.stats.qualityMetrics.completenessAfter.toFixed(1)}%
- **Overall Improvement**: +${(this.stats.qualityMetrics.completenessAfter - this.stats.qualityMetrics.completenessBefore).toFixed(1)}%

## Recommendations
1. **High-Confidence Records**: Focus on records with confidence > 0.8 for arbitrage analysis
2. **Low-Confidence Records**: Review and potentially re-process records with confidence < 0.5
3. **Missing Data**: Consider additional data sources for records still missing critical information
4. **Price Validation**: Implement additional price validation rules for edge cases
`;

    return report;
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const dbPath = process.argv[2] || 'research/tcgplayer-discovery/collector_crypt_ebay_complete.db';
  const batchSize = parseInt(process.argv[3]) || 1000;
  const startId = parseInt(process.argv[4]) || 0;
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  const cleaner = new EBayDataCleaner(dbPath);
  
  try {
    const stats = await cleaner.cleanCurrentListings(batchSize, startId);
    
    // Save statistics
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/ebay-cleaning-stats.json', JSON.stringify(stats, null, 2));
    
    // Generate and save quality report
    const report = cleaner.generateQualityReport();
    fs.writeFileSync('reports/ebay-cleaning-quality-report.md', report);
    
    // Export sample of cleaned data
    const sampleData = cleaner.exportCleanedData(1000);
    fs.writeFileSync('reports/ebay-cleaned-sample.json', JSON.stringify(sampleData, null, 2));
    
    console.log('\n✅ Cleaning complete! Reports saved to reports/ directory');
    
  } catch (error) {
    console.error('❌ Cleaning failed:', error);
    process.exit(1);
  } finally {
    cleaner.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { EBayDataCleaner, CleaningStats, CleanedCardData };
