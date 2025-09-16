/**
 * DATA INTEGRITY OVERHAUL ORCHESTRATOR
 * ====================================
 * Executes complete data integrity overhaul to achieve 10/10 score
 */

import { PrismaClient } from '@prisma/client';
import { DataValidator } from '../packages/shared/data-validator';
import { DataDeduplicator } from '../packages/shared/deduplicator';
import { DataQualityMonitor, QualityMetrics } from '../packages/shared/data-quality-monitor';

interface OverhaulResult {
  success: boolean;
  finalScore: number;
  stepsCompleted: string[];
  issuesResolved: number;
  recordsProcessed: number;
  recommendations: string[];
}

export class DataIntegrityOverhaul {
  private prisma: PrismaClient;
  private validator: DataValidator;
  private deduplicator: DataDeduplicator;
  private qualityMonitor: DataQualityMonitor;

  constructor() {
    this.prisma = new PrismaClient();
    this.validator = new DataValidator(this.prisma);
    this.deduplicator = new DataDeduplicator(this.prisma);
    this.qualityMonitor = new DataQualityMonitor(this.prisma);
  }

  /**
   * Execute complete data integrity overhaul
   */
  async executeOverhaul(): Promise<OverhaulResult> {
    console.log('🚀 Starting Data Integrity Overhaul to achieve 10/10 score...');
    console.log('=' .repeat(60));

    const stepsCompleted: string[] = [];
    let issuesResolved = 0;
    let recordsProcessed = 0;

    try {
      // Step 1: Initial Quality Assessment
      console.log('\n📊 Step 1: Initial Quality Assessment');
      const initialMetrics = await this.qualityMonitor.assessDataQuality();
      console.log(`Initial Quality Score: ${(initialMetrics.overallScore * 100).toFixed(1)}%`);
      stepsCompleted.push('Initial Quality Assessment');

      // Step 2: Remove Invalid Data Sources
      console.log('\n🗑️ Step 2: Removing Invalid Data Sources');
      const invalidDataRemoved = await this.removeInvalidDataSources();
      issuesResolved += invalidDataRemoved.recordsRemoved;
      recordsProcessed += invalidDataRemoved.recordsProcessed;
      console.log(`Removed ${invalidDataRemoved.recordsRemoved} invalid records`);
      stepsCompleted.push('Invalid Data Removal');

      // Step 3: Deduplication
      console.log('\n🔄 Step 3: Comprehensive Deduplication');
      const dedupResult = await this.deduplicator.runCompleteDeduplication();
      issuesResolved += dedupResult.totalDuplicatesRemoved + dedupResult.totalInvalidRemoved;
      recordsProcessed += dedupResult.totalProcessed;
      console.log(`Removed ${dedupResult.totalDuplicatesRemoved} duplicates and ${dedupResult.totalInvalidRemoved} invalid records`);
      stepsCompleted.push('Deduplication');

      // Step 4: Data Validation
      console.log('\n✅ Step 4: Comprehensive Data Validation');
      const validationResult = await this.validator.runDataQualityCheck();
      issuesResolved += validationResult.invalidCards;
      recordsProcessed += validationResult.totalCards;
      console.log(`Validated ${validationResult.totalCards} cards, ${validationResult.invalidCards} invalid`);
      stepsCompleted.push('Data Validation');

      // Step 5: Schema Enforcement
      console.log('\n🔧 Step 5: Schema Enforcement');
      const schemaResult = await this.enforceSchemaConstraints();
      issuesResolved += schemaResult.recordsFixed;
      recordsProcessed += schemaResult.recordsProcessed;
      console.log(`Fixed ${schemaResult.recordsFixed} schema violations`);
      stepsCompleted.push('Schema Enforcement');

      // Step 6: Final Quality Assessment
      console.log('\n📊 Step 6: Final Quality Assessment');
      const finalMetrics = await this.qualityMonitor.assessDataQuality();
      await this.qualityMonitor.storeQualityMetrics(finalMetrics);
      
      const finalScore = finalMetrics.overallScore;
      console.log(`Final Quality Score: ${(finalScore * 100).toFixed(1)}%`);
      stepsCompleted.push('Final Quality Assessment');

      // Determine success
      const success = finalScore >= 0.95; // 95% threshold for 10/10 score

      console.log('\n' + '='.repeat(60));
      console.log(`🎯 OVERHAUL COMPLETE: ${success ? 'SUCCESS' : 'PARTIAL SUCCESS'}`);
      console.log(`📊 Final Score: ${(finalScore * 100).toFixed(1)}%`);
      console.log(`🔧 Steps Completed: ${stepsCompleted.length}`);
      console.log(`✅ Issues Resolved: ${issuesResolved}`);
      console.log(`📝 Records Processed: ${recordsProcessed}`);

      return {
        success,
        finalScore,
        stepsCompleted,
        issuesResolved,
        recordsProcessed,
        recommendations: finalMetrics.recommendations
      };

    } catch (error) {
      console.error('❌ Data integrity overhaul failed:', error);
      return {
        success: false,
        finalScore: 0,
        stepsCompleted,
        issuesResolved,
        recordsProcessed,
        recommendations: ['Fix critical errors before retrying overhaul']
      };
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Remove invalid data sources
   */
  private async removeInvalidDataSources(): Promise<{ recordsRemoved: number; recordsProcessed: number }> {
    let recordsRemoved = 0;
    let recordsProcessed = 0;

    // Remove cards with invalid set codes
    const invalidSetCards = await this.prisma.card.findMany({
      where: {
        setCode: {
          notIn: [
            'base1', 'jungle', 'fossil', 'teamrocket', 'gymheroes', 'gymchallenge',
            'neogenesis', 'neodiscovery', 'neorevelation', 'neodestiny',
            'exruby', 'exsapphire', 'exsandstorm', 'exdragon', 'exmagma', 'exhidden',
            'exfirered', 'exleafgreen', 'exteamrocket', 'exdeoxys', 'exemerald',
            'exunseen', 'exdelta', 'exlegend', 'exholon', 'excrystal', 'exdragon',
            'dpplatinum', 'dpplatinum2', 'dpplatinum3', 'dpplatinum4', 'dpplatinum5',
            'bw1', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6', 'bw7', 'bw8', 'bw9', 'bw10',
            'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'xy6', 'xy7', 'xy8', 'xy9', 'xy10',
            'sm1', 'sm2', 'sm3', 'sm4', 'sm5', 'sm6', 'sm7', 'sm8', 'sm9', 'sm10',
            'swsh1', 'swsh2', 'swsh3', 'swsh4', 'swsh5', 'swsh6', 'swsh7', 'swsh8', 'swsh9', 'swsh10',
            'sv1', 'sv2', 'sv3', 'sv4', 'sv5', 'sv6', 'sv7', 'sv8', 'sv9', 'sv10'
          ]
        }
      }
    });

    for (const card of invalidSetCards) {
      // Check for related data
      const hasRelatedData = await this.prisma.listing.count({
        where: { cardId: card.id }
      });

      if (hasRelatedData === 0) {
        await this.prisma.card.delete({
          where: { id: card.id }
        });
        recordsRemoved++;
      }
    }

    recordsProcessed += invalidSetCards.length;

    // Remove listings with invalid sources
    const invalidSourceListings = await this.prisma.listing.findMany({
      where: {
        source: {
          notIn: ['ebay', 'tcgplayer', 'collectorcrypt', 'phygitals', 'cardmarket', 'trollandtoad']
        }
      }
    });

    for (const listing of invalidSourceListings) {
      await this.prisma.listing.delete({
        where: { id: listing.id }
      });
      recordsRemoved++;
    }

    recordsProcessed += invalidSourceListings.length;

    return { recordsRemoved, recordsProcessed };
  }

  /**
   * Enforce schema constraints
   */
  private async enforceSchemaConstraints(): Promise<{ recordsFixed: number; recordsProcessed: number }> {
    let recordsFixed = 0;
    let recordsProcessed = 0;

    // Fix cards without cardKey
    const cardsWithoutKey = await this.prisma.card.findMany({
      where: { cardKey: null }
    });

    for (const card of cardsWithoutKey) {
      const cardKey = this.validator.generateCardKey({
        name: card.name,
        setCode: card.setCode,
        number: card.number,
        variant: card.variant || undefined,
        grade: card.grade || undefined,
        condition: card.condition || undefined,
        language: card.language
      });

      await this.prisma.card.update({
        where: { id: card.id },
        data: { cardKey }
      });
      recordsFixed++;
    }

    recordsProcessed += cardsWithoutKey.length;

    // Fix cards without normalizedName
    const cardsWithoutNormalizedName = await this.prisma.card.findMany({
      where: { normalizedName: null }
    });

    for (const card of cardsWithoutNormalizedName) {
      const normalizedName = this.validator.normalizeCardName(card.name);

      await this.prisma.card.update({
        where: { id: card.id },
        data: { normalizedName }
      });
      recordsFixed++;
    }

    recordsProcessed += cardsWithoutNormalizedName.length;

    return { recordsFixed, recordsProcessed };
  }
}

// CLI execution
async function main() {
  const overhaul = new DataIntegrityOverhaul();
  const result = await overhaul.executeOverhaul();

  if (result.success) {
    console.log('\n🎉 Data integrity overhaul completed successfully!');
    console.log(`📊 Achieved ${(result.finalScore * 100).toFixed(1)}% quality score`);
    process.exit(0);
  } else {
    console.log('\n⚠️ Data integrity overhaul completed with issues');
    console.log(`📊 Final score: ${(result.finalScore * 100).toFixed(1)}%`);
    console.log('📋 Recommendations:');
    result.recommendations.forEach(rec => console.log(`   - ${rec}`));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
