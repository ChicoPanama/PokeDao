/**
 * Complete Phygitals Integration Orchestrator
 * Runs all integration processes to achieve 80%+ integration rate
 */

const AdvancedPhygitalsMatcher = require('./advanced-phygitals-matcher');
const ManualHighValueReviewer = require('./manual-high-value-reviewer');
const Database = require('better-sqlite3');
const fs = require('fs');

class CompletePhygitalsIntegration {
  constructor() {
    const path = require('path');
    const workingDir = process.cwd();
    
    this.phygitalsDb = new Database(path.join(workingDir, 'phygitals_pokemon_complete.db'));
    this.ultimateDb = new Database(path.join(workingDir, 'collector_crypt_ultimate_pricing.db'));
    
    // Solana conversion rate
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
  }

  // Get current integration statistics
  getCurrentStats() {
    const totalPhygitals = this.phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_cards WHERE price > 0').get().count;
    const integratedCards = this.ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_ultimate_pricing WHERE phygitals_price IS NOT NULL').get().count;
    const integrationRate = ((integratedCards / totalPhygitals) * 100).toFixed(1);
    
    return {
      totalPhygitals,
      integratedCards,
      integrationRate: parseFloat(integrationRate),
      unmatchedCards: totalPhygitals - integratedCards
    };
  }

  // Run the complete integration process
  async runCompleteIntegration() {
    console.log('🚀 STARTING COMPLETE PHYGITALS INTEGRATION');
    console.log('==========================================');
    console.log('Goal: Achieve 80%+ integration rate');
    console.log('');

    const startTime = new Date();
    const results = {
      phase1: null,
      phase2: null,
      final: null
    };

    try {
      // Phase 1: Initial Statistics
      console.log('📊 PHASE 1: INITIAL ASSESSMENT');
      console.log('==============================');
      const initialStats = this.getCurrentStats();
      console.log(`Current integration rate: ${initialStats.integrationRate}%`);
      console.log(`Total Phygitals cards: ${initialStats.totalPhygitals}`);
      console.log(`Currently integrated: ${initialStats.integratedCards}`);
      console.log(`Unmatched cards: ${initialStats.unmatchedCards}`);
      console.log('');

      results.phase1 = initialStats;

      // Phase 2: Advanced Fuzzy Matching
      console.log('🤖 PHASE 2: ADVANCED FUZZY MATCHING');
      console.log('===================================');
      const advancedMatcher = new AdvancedPhygitalsMatcher();
      const matchingResults = await advancedMatcher.runAdvancedMatching();
      
      if (matchingResults.success) {
        console.log(`✅ Advanced matching completed: ${matchingResults.newMatches} new matches`);
        console.log(`💎 High-value matches: ${matchingResults.highValueMatches}`);
      } else {
        console.log(`❌ Advanced matching failed: ${matchingResults.error}`);
      }
      console.log('');

      results.phase2 = matchingResults;

      // Phase 3: Check if we've reached 80% target
      const postMatchingStats = this.getCurrentStats();
      console.log('📈 PHASE 3: POST-MATCHING ASSESSMENT');
      console.log('====================================');
      console.log(`Updated integration rate: ${postMatchingStats.integrationRate}%`);
      console.log(`Target: 80%`);
      
      if (postMatchingStats.integrationRate >= 80) {
        console.log('🎉 TARGET ACHIEVED! Integration rate is 80% or higher.');
      } else {
        console.log(`⚠️  Target not yet reached. Need ${(80 - postMatchingStats.integrationRate).toFixed(1)}% more.`);
        console.log('Proceeding to manual review for high-value cards...');
        console.log('');

        // Phase 4: Manual Review for High-Value Cards
        console.log('👨‍💼 PHASE 4: MANUAL HIGH-VALUE CARD REVIEW');
        console.log('==========================================');
        console.log('This phase requires user interaction to review and match high-value cards.');
        console.log('You can run this separately with: node manual-high-value-reviewer.js');
        console.log('');
      }

      // Phase 5: Final Statistics and Report
      console.log('📊 PHASE 5: FINAL ASSESSMENT');
      console.log('============================');
      const finalStats = this.getCurrentStats();
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);

      console.log(`Final integration rate: ${finalStats.integrationRate}%`);
      console.log(`Total integrated: ${finalStats.integratedCards}/${finalStats.totalPhygitals}`);
      console.log(`Processing time: ${duration} seconds`);
      console.log('');

      results.final = finalStats;

      // Generate comprehensive report
      const comprehensiveReport = this.generateComprehensiveReport(results, duration);
      
      // Check if target was achieved
      const targetAchieved = finalStats.integrationRate >= 80;
      
      if (targetAchieved) {
        console.log('🎉 SUCCESS! 80%+ INTEGRATION RATE ACHIEVED!');
        console.log('==========================================');
      } else {
        console.log('⚠️  PARTIAL SUCCESS - Manual review recommended');
        console.log('===============================================');
        console.log(`Current rate: ${finalStats.integrationRate}%`);
        console.log(`Target: 80%`);
        console.log(`Gap: ${(80 - finalStats.integrationRate).toFixed(1)}%`);
        console.log('');
        console.log('Next steps:');
        console.log('1. Run manual review: node manual-high-value-reviewer.js');
        console.log('2. Review high-value cards manually');
        console.log('3. Re-run this integration process');
      }

      return {
        success: targetAchieved,
        finalStats,
        results,
        report: comprehensiveReport,
        targetAchieved
      };

    } catch (error) {
      console.error('💥 Complete integration failed:', error);
      return {
        success: false,
        error: error.message,
        results
      };
    } finally {
      this.phygitalsDb.close();
      this.ultimateDb.close();
    }
  }

  generateComprehensiveReport(results, duration) {
    console.log('\n📄 GENERATING COMPREHENSIVE REPORT');
    console.log('==================================');

    const report = {
      integrationSummary: {
        startTime: results.phase1 ? new Date().toISOString() : null,
        duration: `${duration} seconds`,
        initialRate: results.phase1 ? results.phase1.integrationRate : 0,
        finalRate: results.final ? results.final.integrationRate : 0,
        improvement: results.phase1 && results.final ? 
          (results.final.integrationRate - results.phase1.integrationRate).toFixed(1) : 0,
        targetAchieved: results.final ? results.final.integrationRate >= 80 : false
      },
      phaseResults: {
        phase1: results.phase1,
        phase2: results.phase2 ? {
          success: results.phase2.success,
          newMatches: results.phase2.newMatches,
          highValueMatches: results.phase2.highValueMatches
        } : null,
        final: results.final
      },
      recommendations: this.generateRecommendations(results)
    };

    // Get top arbitrage opportunities
    const topArbitrageOps = this.ultimateDb.prepare(`
      SELECT 
        cc_title, 
        final_market_value, 
        phygitals_price, 
        (final_market_value - phygitals_price) as profit,
        ((final_market_value - phygitals_price) / final_market_value * 100) as profit_percentage
      FROM collector_crypt_ultimate_pricing 
      WHERE phygitals_price IS NOT NULL 
        AND final_market_value > phygitals_price
        AND final_market_value > 50
      ORDER BY profit DESC 
      LIMIT 20
    `).all();

    report.topArbitrageOpportunities = topArbitrageOps.map(op => ({
      cardName: op.cc_title,
      phygitalsPrice: op.phygitals_price,
      marketValue: op.final_market_value.toFixed(2),
      potentialProfit: op.profit.toFixed(2),
      profitPercentage: `${op.profit_percentage.toFixed(1)}%`
    }));

    // Save report
    fs.writeFileSync('complete-phygitals-integration-report.json', JSON.stringify(report, null, 2));
    console.log('📄 Comprehensive report saved to: complete-phygitals-integration-report.json');

    return report;
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (results.final && results.final.integrationRate < 80) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Manual Review',
        description: 'Run manual review for high-value cards to improve integration rate',
        command: 'node manual-high-value-reviewer.js'
      });
    }

    if (results.phase2 && results.phase2.highValueMatches > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'High-Value Validation',
        description: 'Validate high-value matches for accuracy',
        command: 'Review high-value-cards-review.json'
      });
    }

    if (results.final && results.final.integrationRate >= 80) {
      recommendations.push({
        priority: 'LOW',
        action: 'Monitor Integration',
        description: 'Set up regular monitoring of integration rate',
        command: 'Schedule regular integration checks'
      });
    }

    return recommendations;
  }

  // Quick integration check
  quickCheck() {
    console.log('🔍 QUICK INTEGRATION CHECK');
    console.log('==========================');
    
    const stats = this.getCurrentStats();
    console.log(`Current integration rate: ${stats.integrationRate}%`);
    console.log(`Target: 80%`);
    console.log(`Status: ${stats.integrationRate >= 80 ? '✅ TARGET ACHIEVED' : '⚠️  NEEDS IMPROVEMENT'}`);
    
    if (stats.integrationRate < 80) {
      console.log(`\n📋 RECOMMENDED ACTIONS:`);
      console.log(`1. Run advanced matching: node advanced-phygitals-matcher.js`);
      console.log(`2. Run manual review: node manual-high-value-reviewer.js`);
      console.log(`3. Re-run complete integration: node complete-phygitals-integration.js`);
    }
    
    return stats;
  }
}

// Run complete integration
async function main() {
  const integration = new CompletePhygitalsIntegration();
  
  // Check if user wants quick check or full integration
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    integration.quickCheck();
  } else {
    await integration.runCompleteIntegration();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = CompletePhygitalsIntegration;
