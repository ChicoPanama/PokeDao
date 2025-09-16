#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface PipelineConfig {
  dbPath: string;
  batchSize: number;
  startId: number;
  minProfitPercentage: number;
  maxRiskLevel: string;
  minConfidence: number;
  skipQualityAssessment: boolean;
  skipCleaning: boolean;
  skipCrossReference: boolean;
  skipArbitrageDetection: boolean;
}

interface PipelineStats {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  stages: {
    qualityAssessment: { completed: boolean; duration?: number; stats?: any };
    cleaning: { completed: boolean; duration?: number; stats?: any };
    crossReference: { completed: boolean; duration?: number; stats?: any };
    arbitrageDetection: { completed: boolean; duration?: number; stats?: any };
  };
  totalRecords: number;
  finalOpportunities: number;
  totalProfitPotential: number;
}

class EBayMasterPipeline {
  private config: PipelineConfig;
  private stats: PipelineStats;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      dbPath: config.dbPath || 'research/tcgplayer-discovery/collector_crypt_ebay_complete.db',
      batchSize: config.batchSize || 1000,
      startId: config.startId || 0,
      minProfitPercentage: config.minProfitPercentage || 15,
      maxRiskLevel: config.maxRiskLevel || 'MEDIUM',
      minConfidence: config.minConfidence || 0.7,
      skipQualityAssessment: config.skipQualityAssessment || false,
      skipCleaning: config.skipCleaning || false,
      skipCrossReference: config.skipCrossReference || false,
      skipArbitrageDetection: config.skipArbitrageDetection || false
    };

    this.stats = {
      startTime: new Date(),
      stages: {
        qualityAssessment: { completed: false },
        cleaning: { completed: false },
        crossReference: { completed: false },
        arbitrageDetection: { completed: false }
      },
      totalRecords: 0,
      finalOpportunities: 0,
      totalProfitPotential: 0
    };
  }

  async run(): Promise<PipelineStats> {
    console.log('🚀 Starting eBay Master Data Pipeline\n');
    console.log('📋 CONFIGURATION:');
    console.log(`   Database: ${this.config.dbPath}`);
    console.log(`   Batch Size: ${this.config.batchSize}`);
    console.log(`   Start ID: ${this.config.startId}`);
    console.log(`   Min Profit %: ${this.config.minProfitPercentage}%`);
    console.log(`   Max Risk Level: ${this.config.maxRiskLevel}`);
    console.log(`   Min Confidence: ${this.config.minConfidence}\n`);

    try {
      // Stage 1: Quality Assessment
      if (!this.config.skipQualityAssessment) {
        await this.runQualityAssessment();
      }

      // Stage 2: Data Cleaning
      if (!this.config.skipCleaning) {
        await this.runDataCleaning();
      }

      // Stage 3: Cross-Reference Matching
      if (!this.config.skipCrossReference) {
        await this.runCrossReference();
      }

      // Stage 4: Arbitrage Detection
      if (!this.config.skipArbitrageDetection) {
        await this.runArbitrageDetection();
      }

      this.finalizePipeline();
      this.generateFinalReport();

      return this.stats;

    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
      throw error;
    }
  }

  private async runQualityAssessment(): Promise<void> {
    console.log('🔍 STAGE 1: Data Quality Assessment\n');
    const startTime = Date.now();

    try {
      await this.runScript('ebay-data-quality-assessment.ts', [
        this.config.dbPath
      ]);

      this.stats.stages.qualityAssessment.completed = true;
      this.stats.stages.qualityAssessment.duration = Date.now() - startTime;

      // Load assessment stats
      if (fs.existsSync('reports/ebay-quality-metrics.json')) {
        this.stats.stages.qualityAssessment.stats = JSON.parse(
          fs.readFileSync('reports/ebay-quality-metrics.json', 'utf8')
        );
        this.stats.totalRecords = this.stats.stages.qualityAssessment.stats.totalRecords;
      }

      console.log(`✅ Quality assessment completed in ${this.stats.stages.qualityAssessment.duration}ms\n`);

    } catch (error) {
      console.error('❌ Quality assessment failed:', error);
      throw error;
    }
  }

  private async runDataCleaning(): Promise<void> {
    console.log('🧹 STAGE 2: Data Cleaning & Standardization\n');
    const startTime = Date.now();

    try {
      await this.runScript('ebay-data-cleaner.ts', [
        this.config.dbPath,
        this.config.batchSize.toString(),
        this.config.startId.toString()
      ]);

      this.stats.stages.cleaning.completed = true;
      this.stats.stages.cleaning.duration = Date.now() - startTime;

      // Load cleaning stats
      if (fs.existsSync('reports/ebay-cleaning-stats.json')) {
        this.stats.stages.cleaning.stats = JSON.parse(
          fs.readFileSync('reports/ebay-cleaning-stats.json', 'utf8')
        );
      }

      console.log(`✅ Data cleaning completed in ${this.stats.stages.cleaning.duration}ms\n`);

    } catch (error) {
      console.error('❌ Data cleaning failed:', error);
      throw error;
    }
  }

  private async runCrossReference(): Promise<void> {
    console.log('🔗 STAGE 3: Cross-Reference Matching\n');
    const startTime = Date.now();

    try {
      await this.runScript('ebay-cross-reference-matcher.ts', [
        this.config.dbPath,
        '100', // Smaller batch size for API calls
        this.config.startId.toString()
      ]);

      this.stats.stages.crossReference.completed = true;
      this.stats.stages.crossReference.duration = Date.now() - startTime;

      // Load cross-reference stats
      if (fs.existsSync('reports/ebay-cross-reference-stats.json')) {
        this.stats.stages.crossReference.stats = JSON.parse(
          fs.readFileSync('reports/ebay-cross-reference-stats.json', 'utf8')
        );
      }

      console.log(`✅ Cross-reference matching completed in ${this.stats.stages.crossReference.duration}ms\n`);

    } catch (error) {
      console.error('❌ Cross-reference matching failed:', error);
      throw error;
    }
  }

  private async runArbitrageDetection(): Promise<void> {
    console.log('💰 STAGE 4: Arbitrage Opportunity Detection\n');
    const startTime = Date.now();

    try {
      await this.runScript('ebay-arbitrage-detector.ts', [
        this.config.dbPath,
        this.config.minProfitPercentage.toString(),
        this.config.maxRiskLevel,
        this.config.minConfidence.toString()
      ]);

      this.stats.stages.arbitrageDetection.completed = true;
      this.stats.stages.arbitrageDetection.duration = Date.now() - startTime;

      // Load arbitrage stats
      if (fs.existsSync('reports/ebay-arbitrage-opportunities.json')) {
        const arbitrageData = JSON.parse(
          fs.readFileSync('reports/ebay-arbitrage-opportunities.json', 'utf8')
        );
        this.stats.stages.arbitrageDetection.stats = arbitrageData.stats;
        this.stats.finalOpportunities = arbitrageData.stats.totalOpportunities;
        this.stats.totalProfitPotential = arbitrageData.stats.totalProfitPotential;
      }

      console.log(`✅ Arbitrage detection completed in ${this.stats.stages.arbitrageDetection.duration}ms\n`);

    } catch (error) {
      console.error('❌ Arbitrage detection failed:', error);
      throw error;
    }
  }

  private runScript(scriptName: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, scriptName);
      
      console.log(`🔄 Running: tsx ${scriptPath} ${args.join(' ')}`);
      
      const child = spawn('tsx', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script ${scriptName} exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private finalizePipeline(): void {
    this.stats.endTime = new Date();
    this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
  }

  private generateFinalReport(): void {
    const report = `
# eBay Master Pipeline Execution Report

## Pipeline Summary
- **Start Time**: ${this.stats.startTime.toISOString()}
- **End Time**: ${this.stats.endTime?.toISOString()}
- **Total Duration**: ${this.formatDuration(this.stats.duration || 0)}
- **Database**: ${this.config.dbPath}

## Stage Results

### 1. Data Quality Assessment
- **Status**: ${this.stats.stages.qualityAssessment.completed ? '✅ Completed' : '⏭️ Skipped'}
- **Duration**: ${this.formatDuration(this.stats.stages.qualityAssessment.duration || 0)}
- **Total Records**: ${this.stats.totalRecords.toLocaleString()}

### 2. Data Cleaning & Standardization
- **Status**: ${this.stats.stages.cleaning.completed ? '✅ Completed' : '⏭️ Skipped'}
- **Duration**: ${this.formatDuration(this.stats.stages.cleaning.duration || 0)}
- **Improvements**: ${this.stats.stages.cleaning.stats ? `
  - Set Names Added: ${this.stats.stages.cleaning.stats.improvements.setNamesAdded.toLocaleString()}
  - Card Numbers Added: ${this.stats.stages.cleaning.stats.improvements.cardNumbersAdded.toLocaleString()}
  - Pokemon Names Added: ${this.stats.stages.cleaning.stats.improvements.pokemonNamesAdded.toLocaleString()}
  - Prices Normalized: ${this.stats.stages.cleaning.stats.improvements.pricesNormalized.toLocaleString()}
  - URLs Generated: ${this.stats.stages.cleaning.stats.improvements.urlsGenerated.toLocaleString()}
` : 'N/A'}

### 3. Cross-Reference Matching
- **Status**: ${this.stats.stages.crossReference.completed ? '✅ Completed' : '⏭️ Skipped'}
- **Duration**: ${this.formatDuration(this.stats.stages.crossReference.duration || 0)}
- **Match Results**: ${this.stats.stages.crossReference.stats ? `
  - Exact Matches: ${this.stats.stages.crossReference.stats.exactMatches.toLocaleString()}
  - Fuzzy Matches: ${this.stats.stages.crossReference.stats.fuzzyMatches.toLocaleString()}
  - Partial Matches: ${this.stats.stages.crossReference.stats.partialMatches.toLocaleString()}
  - Match Rate: ${(((this.stats.stages.crossReference.stats.exactMatches + this.stats.stages.crossReference.stats.fuzzyMatches + this.stats.stages.crossReference.stats.partialMatches) / this.stats.stages.crossReference.stats.totalProcessed) * 100).toFixed(1)}%
` : 'N/A'}

### 4. Arbitrage Opportunity Detection
- **Status**: ${this.stats.stages.arbitrageDetection.completed ? '✅ Completed' : '⏭️ Skipped'}
- **Duration**: ${this.formatDuration(this.stats.stages.arbitrageDetection.duration || 0)}
- **Opportunities Found**: ${this.stats.finalOpportunities.toLocaleString()}
- **Total Profit Potential**: $${this.stats.totalProfitPotential.toLocaleString()}

## Final Results
- **Total Opportunities**: ${this.stats.finalOpportunities.toLocaleString()}
- **Total Profit Potential**: $${this.stats.totalProfitPotential.toLocaleString()}
- **Average Profit per Opportunity**: $${this.stats.finalOpportunities > 0 ? (this.stats.totalProfitPotential / this.stats.finalOpportunities).toFixed(2) : '0'}

## Files Generated
- \`reports/ebay-data-quality-assessment.md\` - Quality assessment report
- \`reports/ebay-cleaning-quality-report.md\` - Data cleaning report
- \`reports/ebay-arbitrage-opportunities.json\` - Full arbitrage opportunities data
- \`reports/ebay-arbitrage-opportunities.csv\` - CSV export for spreadsheet analysis
- \`reports/ebay-master-pipeline-report.md\` - This report

## Recommendations
1. **High-Confidence Opportunities**: Focus on opportunities with confidence > 80%
2. **Risk Management**: Prioritize LOW and MEDIUM risk opportunities
3. **Liquidity**: Consider HIGH liquidity cards for faster turnover
4. **Market Timing**: Monitor demand trends for optimal entry points
5. **Data Updates**: Re-run pipeline weekly for fresh opportunities

## Next Steps
1. Review top opportunities in the CSV file
2. Validate high-value opportunities manually
3. Set up monitoring for new opportunities
4. Implement automated alerts for exceptional opportunities
5. Track performance of identified opportunities

---
*Report generated on ${new Date().toISOString()}*
`;

    // Save the report
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/ebay-master-pipeline-report.md', report);

    // Save pipeline stats as JSON
    fs.writeFileSync('reports/ebay-master-pipeline-stats.json', JSON.stringify(this.stats, null, 2));

    console.log('📊 PIPELINE EXECUTION COMPLETE!\n');
    console.log('📋 FINAL SUMMARY:');
    console.log(`   Total Duration: ${this.formatDuration(this.stats.duration || 0)}`);
    console.log(`   Records Processed: ${this.stats.totalRecords.toLocaleString()}`);
    console.log(`   Opportunities Found: ${this.stats.finalOpportunities.toLocaleString()}`);
    console.log(`   Total Profit Potential: $${this.stats.totalProfitPotential.toLocaleString()}`);
    console.log(`   Average Profit per Opportunity: $${this.stats.finalOpportunities > 0 ? (this.stats.totalProfitPotential / this.stats.finalOpportunities).toFixed(2) : '0'}\n`);
    
    console.log('📁 Reports saved to reports/ directory:');
    console.log('   - ebay-master-pipeline-report.md (comprehensive report)');
    console.log('   - ebay-arbitrage-opportunities.json (full data)');
    console.log('   - ebay-arbitrage-opportunities.csv (spreadsheet analysis)');
    console.log('   - ebay-master-pipeline-stats.json (pipeline statistics)\n');
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const config: Partial<PipelineConfig> = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    switch (key) {
      case 'db':
        config.dbPath = value;
        break;
      case 'batch-size':
        config.batchSize = parseInt(value);
        break;
      case 'start-id':
        config.startId = parseInt(value);
        break;
      case 'min-profit':
        config.minProfitPercentage = parseFloat(value);
        break;
      case 'max-risk':
        config.maxRiskLevel = value;
        break;
      case 'min-confidence':
        config.minConfidence = parseFloat(value);
        break;
      case 'skip-quality':
        config.skipQualityAssessment = value === 'true';
        break;
      case 'skip-cleaning':
        config.skipCleaning = value === 'true';
        break;
      case 'skip-cross-reference':
        config.skipCrossReference = value === 'true';
        break;
      case 'skip-arbitrage':
        config.skipArbitrageDetection = value === 'true';
        break;
    }
  }

  const pipeline = new EBayMasterPipeline(config);
  
  try {
    const stats = await pipeline.run();
    console.log('🎉 Pipeline execution successful!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Pipeline execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { EBayMasterPipeline, PipelineConfig, PipelineStats };
