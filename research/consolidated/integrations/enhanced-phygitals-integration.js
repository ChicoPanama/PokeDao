/**
 * Enhanced Phygitals Integration Analysis & Improvement
 * Addresses the low matching rate and provides better integration coverage
 */

const Database = require('better-sqlite3');
const fs = require('fs');

class EnhancedPhygitalsAnalysis {
  constructor() {
    const path = require('path');
    const workingDir = process.cwd();
    
    this.phygitalsDb = new Database(path.join(workingDir, 'phygitals_pokemon_complete.db'));
    this.ultimateDb = new Database(path.join(workingDir, 'collector_crypt_ultimate_pricing.db'));
    
    // Solana conversion rate
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
  }

  analyzeMatchingIssues() {
    console.log('🔍 ANALYZING PHYGITALS MATCHING ISSUES');
    console.log('====================================');

    // Get sample Phygitals cards that weren't matched
    const unmatchedPhygitals = this.phygitalsDb.prepare(`
      SELECT id, name, price FROM phygitals_cards 
      WHERE price > 0 
      AND id NOT IN (
        SELECT phygitals_source FROM collector_crypt_ultimate_pricing 
        WHERE phygitals_source IS NOT NULL
        AND phygitals_source LIKE '%phygitals.com%'
      )
      LIMIT 20
    `).all();

    console.log('\n❌ SAMPLE UNMATCHED PHYGITALS CARDS:');
    unmatchedPhygitals.forEach((card, index) => {
      const usdPrice = (card.price / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD;
      console.log(`  ${index + 1}. ${card.name} - $${usdPrice.toFixed(2)}`);
    });

    // Get sample ultimate database card names for comparison
    const ultimateCards = this.ultimateDb.prepare(`
      SELECT cc_title FROM collector_crypt_ultimate_pricing 
      WHERE cc_title LIKE '%charizard%' 
      LIMIT 10
    `).all();

    console.log('\n✅ SAMPLE ULTIMATE DATABASE CARDS (Charizard):');
    ultimateCards.forEach((card, index) => {
      console.log(`  ${index + 1}. ${card.cc_title}`);
    });

    return { unmatchedPhygitals, ultimateCards };
  }

  improveMatching() {
    console.log('\n🚀 IMPLEMENTING IMPROVED MATCHING ALGORITHM');
    console.log('==========================================');

    // Get all unmatched Phygitals cards with prices
    const unmatchedCards = this.phygitalsDb.prepare(`
      SELECT id, name, price, grader, grade 
      FROM phygitals_cards 
      WHERE price > 0 
      AND id NOT IN (
        SELECT SUBSTR(phygitals_source, -44) FROM collector_crypt_ultimate_pricing 
        WHERE phygitals_source IS NOT NULL
        AND phygitals_source LIKE '%phygitals.com/card/%'
      )
    `).all();

    console.log(`🎴 Processing ${unmatchedCards.length} unmatched Phygitals cards...`);

    let newMatches = 0;
    let priceUpdates = 0;

    for (const phygitalsCard of unmatchedCards) {
      const normalizedPrice = this.normalizePhygitalsPrice(phygitalsCard.price);
      if (!normalizedPrice || normalizedPrice < 1) continue; // Skip very low prices

      // Enhanced matching strategies
      const matches = this.enhancedCardMatching(phygitalsCard);
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        
        // Update with Phygitals pricing
        const updateStmt = this.ultimateDb.prepare(`
          UPDATE collector_crypt_ultimate_pricing 
          SET phygitals_price = ?, phygitals_source = ?
          WHERE id = ?
        `);
        
        updateStmt.run(
          normalizedPrice, 
          `https://www.phygitals.com/card/${phygitalsCard.id}`, 
          bestMatch.id
        );
        
        newMatches++;
        priceUpdates++;

        if (priceUpdates % 50 === 0) {
          console.log(`📈 New matches: ${newMatches}...`);
        }
      }
    }

    console.log(`✅ Enhanced matching complete: ${newMatches} new matches added`);
    return newMatches;
  }

  enhancedCardMatching(phygitalsCard) {
    // Strategy 1: Extract key Pokemon information
    const pokemonInfo = this.extractPokemonInfo(phygitalsCard.name);
    
    // Strategy 2: Try multiple matching approaches
    let matches = [];

    // Approach 1: Pokemon name + key terms
    if (pokemonInfo.pokemonName) {
      matches = this.ultimateDb.prepare(`
        SELECT id, cc_title FROM collector_crypt_ultimate_pricing
        WHERE LOWER(cc_title) LIKE LOWER(?)
          AND phygitals_price IS NULL
        LIMIT 1
      `).all(`%${pokemonInfo.pokemonName}%`);
    }

    // Approach 2: Year + Pokemon + set info
    if (matches.length === 0 && pokemonInfo.year && pokemonInfo.pokemonName) {
      matches = this.ultimateDb.prepare(`
        SELECT id, cc_title FROM collector_crypt_ultimate_pricing
        WHERE LOWER(cc_title) LIKE LOWER(?)
          AND LOWER(cc_title) LIKE LOWER(?)
          AND phygitals_price IS NULL
        LIMIT 1
      `).all(`%${pokemonInfo.year}%`, `%${pokemonInfo.pokemonName}%`);
    }

    // Approach 3: Grading info matching
    if (matches.length === 0 && pokemonInfo.gradingInfo && pokemonInfo.pokemonName) {
      matches = this.ultimateDb.prepare(`
        SELECT id, cc_title FROM collector_crypt_ultimate_pricing
        WHERE LOWER(cc_title) LIKE LOWER(?)
          AND LOWER(cc_title) LIKE LOWER(?)
          AND phygitals_price IS NULL
        LIMIT 1
      `).all(`%${pokemonInfo.pokemonName}%`, `%${pokemonInfo.gradingInfo}%`);
    }

    // Approach 4: Fuzzy matching with key terms
    if (matches.length === 0) {
      const keyTerms = this.extractKeyTerms(phygitalsCard.name);
      if (keyTerms.length >= 2) {
        let query = `
          SELECT id, cc_title FROM collector_crypt_ultimate_pricing
          WHERE phygitals_price IS NULL
        `;
        let params = [];

        keyTerms.forEach(() => {
          query += ` AND LOWER(cc_title) LIKE LOWER(?)`;
          params.push(`%${keyTerms.shift()}%`);
        });

        query += ` LIMIT 1`;
        matches = this.ultimateDb.prepare(query).all(...params);
      }
    }

    return matches;
  }

  extractPokemonInfo(cardName) {
    const info = {
      year: null,
      pokemonName: null,
      set: null,
      gradingInfo: null,
      cardNumber: null
    };

    // Extract year
    const yearMatch = cardName.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) info.year = yearMatch[0];

    // Extract Pokemon name (common patterns)
    const pokemonPatterns = [
      /\b(Charizard|Pikachu|Blastoise|Venusaur|Mew|Mewtwo|Lugia|Ho-oh|Rayquaza|Arceus|Dialga|Palkia|Giratina|Reshiram|Zekrom|Kyurem|Xerneas|Yveltal|Zygarde|Solgaleo|Lunala|Necrozma|Zacian|Zamazenta|Eternatus)\b/i,
      /Pokemon\s+.*?\b([A-Z][a-z]+(?:'s)?)\b/i,
      /\b([A-Z][a-z]+)\s+(?:ex|EX|GX|V|VMAX|VSTAR)\b/i
    ];

    for (const pattern of pokemonPatterns) {
      const match = cardName.match(pattern);
      if (match) {
        info.pokemonName = match[1].toLowerCase();
        break;
      }
    }

    // Extract grading info
    const gradingMatch = cardName.match(/(PSA|BGS|CGC)\s*(\d+(?:\.\d+)?)/i);
    if (gradingMatch) {
      info.gradingInfo = `${gradingMatch[1]} ${gradingMatch[2]}`;
    }

    // Extract set information
    const setPatterns = [
      /Base Set/i,
      /Shadowless/i,
      /1st Edition/i,
      /Jungle/i,
      /Fossil/i,
      /Team Rocket/i,
      /Gym/i,
      /Neo/i,
      /Expedition/i,
      /Aquapolis/i,
      /Skyridge/i
    ];

    for (const pattern of setPatterns) {
      if (pattern.test(cardName)) {
        info.set = cardName.match(pattern)[0];
        break;
      }
    }

    return info;
  }

  extractKeyTerms(cardName) {
    // Remove common noise words and extract meaningful terms
    const noiseWords = ['pokemon', 'card', 'trading', 'game', 'holo', 'reverse', 'foil', 'promo', 'japanese', 'jpn', 'english', 'mint', 'nm', 'lp'];
    
    const terms = cardName
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => 
        term.length > 2 && 
        !noiseWords.includes(term) &&
        !/^\d+$/.test(term) // Remove pure numbers
      )
      .slice(0, 4); // Limit to 4 most relevant terms

    return terms;
  }

  normalizePhygitalsPrice(lamportPrice) {
    if (!lamportPrice || lamportPrice <= 0) return null;
    
    const solPrice = lamportPrice / this.LAMPORTS_PER_SOL;
    const usdPrice = solPrice * this.SOL_TO_USD;
    
    // Reasonable Pokemon card price range
    if (usdPrice < 1 || usdPrice > 100000) return null;
    
    return Math.round(usdPrice * 100) / 100;
  }

  generateEnhancedReport() {
    console.log('\n📊 GENERATING ENHANCED INTEGRATION REPORT');
    console.log('========================================');

    // Get updated statistics
    const totalPhygitals = this.phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_cards WHERE price > 0').get().count;
    const integratedCards = this.ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_ultimate_pricing WHERE phygitals_price IS NOT NULL').get().count;
    
    const priceStats = this.ultimateDb.prepare(`
      SELECT 
        AVG(final_market_value) as avg_ultimate,
        AVG(phygitals_price) as avg_phygitals,
        AVG(ebay_sold_price) as avg_ebay,
        COUNT(*) as total_integrated
      FROM collector_crypt_ultimate_pricing 
      WHERE phygitals_price IS NOT NULL
    `).get();

    const topArbitrageOps = this.ultimateDb.prepare(`
      SELECT 
        cc_title, 
        final_market_value, 
        phygitals_price, 
        ebay_sold_price,
        (final_market_value - phygitals_price) as profit,
        ((final_market_value - phygitals_price) / final_market_value * 100) as profit_percentage
      FROM collector_crypt_ultimate_pricing 
      WHERE phygitals_price IS NOT NULL 
        AND final_market_value > phygitals_price
        AND final_market_value > 50
      ORDER BY profit DESC 
      LIMIT 15
    `).all();

    console.log(`\n✅ ENHANCED PHYGITALS INTEGRATION COMPLETE!`);
    console.log(`📊 Total Phygitals cards with prices: ${totalPhygitals}`);
    console.log(`🎯 Successfully integrated: ${integratedCards}`);
    console.log(`📈 Integration rate: ${((integratedCards / totalPhygitals) * 100).toFixed(1)}%`);
    console.log(`💰 Average Phygitals price: $${priceStats.avg_phygitals.toFixed(2)}`);
    console.log(`🏦 Average market value: $${priceStats.avg_ultimate.toFixed(2)}`);

    if (topArbitrageOps.length > 0) {
      console.log(`\n🏆 TOP ARBITRAGE OPPORTUNITIES:`);
      topArbitrageOps.slice(0, 10).forEach((opportunity, index) => {
        console.log(`\n  ${index + 1}. ${opportunity.cc_title}`);
        console.log(`     💵 Phygitals Price: $${opportunity.phygitals_price}`);
        console.log(`     💎 Market Value: $${opportunity.final_market_value.toFixed(2)}`);
        console.log(`     💰 Potential Profit: $${opportunity.profit.toFixed(2)} (${opportunity.profit_percentage.toFixed(1)}%)`);
        console.log(`     🏪 eBay Reference: $${opportunity.ebay_sold_price ? opportunity.ebay_sold_price.toFixed(2) : 'N/A'}`);
      });
    }

    const enhancedReport = {
      enhancedIntegrationSummary: {
        totalPhygitalsCards: totalPhygitals,
        successfullyIntegrated: integratedCards,
        integrationRate: `${((integratedCards / totalPhygitals) * 100).toFixed(1)}%`,
        averagePhygitalsPrice: priceStats.avg_phygitals.toFixed(2),
        averageMarketValue: priceStats.avg_ultimate.toFixed(2),
        arbitrageOpportunities: topArbitrageOps.length
      },
      topArbitrageOpportunities: topArbitrageOps.map(op => ({
        cardName: op.cc_title,
        phygitalsPrice: op.phygitals_price,
        marketValue: op.final_market_value.toFixed(2),
        potentialProfit: op.profit.toFixed(2),
        profitPercentage: `${op.profit_percentage.toFixed(1)}%`,
        ebayReference: op.ebay_sold_price ? op.ebay_sold_price.toFixed(2) : null
      }))
    };

    fs.writeFileSync('enhanced-phygitals-integration-report.json', JSON.stringify(enhancedReport, null, 2));
    console.log(`\n📄 Enhanced report saved to: enhanced-phygitals-integration-report.json`);

    return enhancedReport;
  }

  async runEnhancedIntegration() {
    console.log('🚀 STARTING ENHANCED PHYGITALS INTEGRATION');
    console.log('==========================================');

    try {
      // Analyze current matching issues
      this.analyzeMatchingIssues();
      
      // Improve matching with better algorithms
      const newMatches = this.improveMatching();
      
      // Generate enhanced report
      const report = this.generateEnhancedReport();
      
      return { success: true, newMatches, report };

    } catch (error) {
      console.error('💥 Enhanced integration failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.phygitalsDb.close();
      this.ultimateDb.close();
    }
  }
}

// Run the enhanced analysis
async function main() {
  const enhancedIntegration = new EnhancedPhygitalsAnalysis();
  await enhancedIntegration.runEnhancedIntegration();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnhancedPhygitalsAnalysis;
