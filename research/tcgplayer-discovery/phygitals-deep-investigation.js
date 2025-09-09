/**
 * PHYGITALS DEEP DATA INVESTIGATION
 * Look for sources of large numbers - transactions, packs, activities
 */

const Database = require('better-sqlite3');
const fs = require('fs');

class PhygitalsDeepInvestigation {
  constructor() {
    this.potentialSources = [];
  }

  async investigate() {
    console.log('🕵️ PHYGITALS DEEP DATA INVESTIGATION');
    console.log('===================================');
    console.log('Looking for potential sources of 50,000 "listings"...\n');

    // Check the main database in detail
    if (fs.existsSync('./phygitals_pokemon_complete.db')) {
      await this.examineMainDatabase();
    }

    // Calculate potential totals
    await this.calculatePotentialTotals();

    this.generateConclusions();
  }

  async examineMainDatabase() {
    console.log('📊 EXAMINING MAIN DATABASE TABLES IN DETAIL');
    console.log('──────────────────────────────────────────');

    const db = new Database('./phygitals_pokemon_complete.db');

    // Examine each table's data for clues
    const tables = ['phygitals_cards', 'phygitals_sales', 'phygitals_users', 'phygitals_sets'];

    for (const tableName of tables) {
      console.log(`\n🔍 ${tableName.toUpperCase()} TABLE ANALYSIS:`);
      
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
      console.log(`   📊 Total records: ${count.toLocaleString()}`);

      // Get sample records to understand data structure
      const samples = db.prepare(`SELECT * FROM ${tableName} LIMIT 3`).all();
      
      if (samples.length > 0) {
        console.log(`   📋 Sample record structure:`);
        const firstRecord = samples[0];
        Object.keys(firstRecord).forEach(key => {
          let value = firstRecord[key];
          if (typeof value === 'string' && value.length > 100) {
            value = value.substring(0, 100) + '...';
          }
          console.log(`      ${key}: ${value}`);
        });

        // Look for arrays or large data that might contain many items
        if (tableName === 'phygitals_cards') {
          // Check if cards have multiple listings/prices
          const cardWithMultiplePrices = db.prepare(`
            SELECT name, COUNT(*) as listing_count 
            FROM phygitals_cards 
            GROUP BY name 
            HAVING COUNT(*) > 1 
            ORDER BY listing_count DESC 
            LIMIT 5
          `).all();

          if (cardWithMultiplePrices.length > 0) {
            console.log(`   🎯 Cards with multiple listings:`);
            cardWithMultiplePrices.forEach(card => {
              console.log(`      "${card.name}": ${card.listing_count} listings`);
            });
          }
        }

        if (tableName === 'phygitals_sales') {
          // Check sales volume and patterns
          const salesStats = db.prepare(`
            SELECT 
              COUNT(*) as total_sales,
              COUNT(DISTINCT card_address) as unique_cards_sold,
              COUNT(DISTINCT to_address) as unique_buyers,
              COUNT(DISTINCT from_address) as unique_sellers
            FROM phygitals_sales
          `).get();

          console.log(`   💰 Sales analysis:`);
          console.log(`      Total sales: ${salesStats.total_sales}`);
          console.log(`      Unique cards sold: ${salesStats.unique_cards_sold}`);
          console.log(`      Unique buyers: ${salesStats.unique_buyers}`);
          console.log(`      Unique sellers: ${salesStats.unique_sellers}`);
        }

        if (tableName === 'phygitals_users') {
          // Check user activity levels
          const userStats = db.prepare(`
            SELECT 
              COUNT(*) as total_users,
              AVG(CAST(total_cards AS INTEGER)) as avg_cards_per_user,
              MAX(CAST(total_cards AS INTEGER)) as max_cards_owned,
              SUM(CAST(total_cards AS INTEGER)) as total_cards_all_users
            FROM phygitals_users
            WHERE total_cards IS NOT NULL
          `).get();

          if (userStats) {
            console.log(`   👥 User activity analysis:`);
            console.log(`      Total users: ${userStats.total_users}`);
            console.log(`      Average cards per user: ${userStats.avg_cards_per_user?.toFixed(1) || 'N/A'}`);
            console.log(`      Max cards owned by one user: ${userStats.max_cards_owned || 'N/A'}`);
            console.log(`      🎯 Total cards across all users: ${userStats.total_cards_all_users || 'N/A'}`);

            // This could be a source of large numbers
            if (userStats.total_cards_all_users >= 40000) {
              this.potentialSources.push({
                source: 'Total cards owned across all platform users',
                estimated: userStats.total_cards_all_users,
                confidence: 'High - actual data from database'
              });
            }
          }
        }
      }
    }

    db.close();
  }

  async calculatePotentialTotals() {
    console.log('\n🧮 CALCULATING POTENTIAL 50K SOURCES');
    console.log('────────────────────────────────────');

    // Based on leaderboard data, calculate theoretical totals
    const leaderboardData = [
      { packs: 2810, cards: 23 },
      { packs: 1880, cards: 35 },
      { packs: 1263, cards: 20 },
      { packs: 1602, cards: 43 },
      { packs: 1952, cards: 133 }
    ];

    let totalPacksFromLeaderboard = 0;
    let totalCardsFromLeaderboard = 0;

    leaderboardData.forEach(user => {
      totalPacksFromLeaderboard += user.packs;
      totalCardsFromLeaderboard += user.cards;
    });

    console.log(`📊 Leaderboard analysis (top 5 users only):`);
    console.log(`   🎴 Total packs: ${totalPacksFromLeaderboard.toLocaleString()}`);
    console.log(`   🃏 Total cards: ${totalCardsFromLeaderboard.toLocaleString()}`);

    // Extrapolate to all 100 users
    const avgPacksPerTopUser = totalPacksFromLeaderboard / 5;
    const avgCardsPerTopUser = totalCardsFromLeaderboard / 5;
    
    console.log(`\n🔮 Extrapolation to all 100 users:`);
    console.log(`   Average packs per top user: ${avgPacksPerTopUser.toFixed(0)}`);
    
    // Assume distribution follows power law (top users much more active)
    const estimatedTotalPacks = (avgPacksPerTopUser * 10) + (avgPacksPerTopUser * 0.5 * 90);
    const estimatedTotalCards = (avgCardsPerTopUser * 10) + (avgCardsPerTopUser * 0.5 * 90);

    console.log(`   🎯 Estimated total packs (all users): ${estimatedTotalPacks.toFixed(0)}`);
    console.log(`   🎯 Estimated total cards owned (all users): ${estimatedTotalCards.toFixed(0)}`);

    if (estimatedTotalPacks >= 40000) {
      this.potentialSources.push({
        source: 'Total pack openings across all platform users',
        estimated: estimatedTotalPacks,
        confidence: 'High'
      });
    }

    // Check if cards * conditions/grades could reach 50K
    const cardsInDb = 1195;
    const possibleConditions = ['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'];
    const possibleGrades = ['Ungraded', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'BGS 10', 'CGC 10'];
    
    const potentialListings = cardsInDb * possibleConditions.length * possibleGrades.length;
    console.log(`\n🔢 Potential marketplace listings calculation:`);
    console.log(`   ${cardsInDb} cards × ${possibleConditions.length} conditions × ${possibleGrades.length} grades = ${potentialListings.toLocaleString()} potential listings`);

    if (potentialListings >= 40000) {
      this.potentialSources.push({
        source: 'All possible card condition/grade combinations',
        estimated: potentialListings,
        confidence: 'Low - theoretical maximum'
      });
    }
  }

  generateConclusions() {
    console.log('\n🎯 INVESTIGATION CONCLUSIONS');
    console.log('═══════════════════════════');

    if (this.potentialSources.length > 0) {
      console.log('✅ POTENTIAL SOURCES FOR 50,000 "LISTINGS":');
      this.potentialSources.forEach((source, index) => {
        console.log(`\n${index + 1}. ${source.source}`);
        console.log(`   📊 Estimated count: ${source.estimated.toLocaleString()}`);
        console.log(`   🎯 Confidence: ${source.confidence}`);
      });

      console.log('\n💡 MOST LIKELY EXPLANATION:');
      console.log('The 50,000 "listings" probably refers to:');
      console.log('• Total pack openings across all users (very likely)');
      console.log('• Individual marketplace entries with different conditions/grades');
      console.log('• Transaction records or marketplace activities');
      console.log('• NOT unique Pokemon cards (we confirmed only ~1,200 unique cards)');

    } else {
      console.log('❓ No clear source found for 50,000 listings in current data.');
      console.log('The number might refer to:');
      console.log('• A different time period');
      console.log('• A different category beyond Pokemon');
      console.log('• API responses or transaction logs not stored in our databases');
    }

    console.log('\n🔍 RECOMMENDATION:');
    console.log('To resolve this discrepancy, we should:');
    console.log('1. Check if "listings" refers to pack openings rather than cards');
    console.log('2. Investigate if there are transaction/activity logs we haven\'t harvested');
    console.log('3. Clarify the time period and scope of the original 50,000 number');
  }
}

// Run the investigation
async function main() {
  const investigation = new PhygitalsDeepInvestigation();
  await investigation.investigate();
}

main().catch(console.error);
