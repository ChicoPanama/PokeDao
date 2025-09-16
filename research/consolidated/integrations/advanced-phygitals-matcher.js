/**
 * Advanced Phygitals Fuzzy Matching System
 * Implements sophisticated algorithms to achieve 80%+ integration rate
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

class AdvancedPhygitalsMatcher {
  constructor() {
    const workingDir = process.cwd();
    
    this.phygitalsDb = new Database(path.join(workingDir, 'phygitals_pokemon_complete.db'));
    this.ultimateDb = new Database(path.join(workingDir, 'collector_crypt_ultimate_pricing.db'));
    
    // Solana conversion rate
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
    
    // Pokemon name variations and aliases
    this.pokemonAliases = {
      'charizard': ['charizard', 'char', 'charizard ex', 'charizard v', 'charizard vmax'],
      'pikachu': ['pikachu', 'pika', 'pikachu ex', 'pikachu v', 'pikachu vmax'],
      'blastoise': ['blastoise', 'blastoise ex', 'blastoise v', 'blastoise vmax'],
      'venusaur': ['venusaur', 'venusaur ex', 'venusaur v', 'venusaur vmax'],
      'mew': ['mew', 'mew ex', 'mew v', 'mew vmax'],
      'mewtwo': ['mewtwo', 'mewtwo ex', 'mewtwo v', 'mewtwo vmax'],
      'lugia': ['lugia', 'lugia ex', 'lugia v', 'lugia vmax'],
      'ho-oh': ['ho-oh', 'hooh', 'ho-oh ex', 'ho-oh v', 'ho-oh vmax'],
      'rayquaza': ['rayquaza', 'rayquaza ex', 'rayquaza v', 'rayquaza vmax'],
      'arceus': ['arceus', 'arceus ex', 'arceus v', 'arceus vmax']
    };
    
    // Set name variations
    this.setAliases = {
      'base set': ['base set', 'base', 'base set 1st edition', 'base set shadowless'],
      'jungle': ['jungle', 'jungle set'],
      'fossil': ['fossil', 'fossil set'],
      'team rocket': ['team rocket', 'rocket'],
      'gym heroes': ['gym heroes', 'gym'],
      'gym challenge': ['gym challenge', 'gym'],
      'neo genesis': ['neo genesis', 'neo'],
      'neo discovery': ['neo discovery', 'neo'],
      'neo revelation': ['neo revelation', 'neo'],
      'neo destiny': ['neo destiny', 'neo'],
      'expedition': ['expedition', 'expedition base set'],
      'aquapolis': ['aquapolis'],
      'skyridge': ['skyridge'],
      'ex ruby & sapphire': ['ex ruby & sapphire', 'ruby sapphire', 'ex'],
      'ex sandstorm': ['ex sandstorm', 'sandstorm', 'ex'],
      'ex dragon': ['ex dragon', 'dragon', 'ex'],
      'ex team magma vs team aqua': ['ex team magma vs team aqua', 'magma aqua', 'ex'],
      'ex hidden legends': ['ex hidden legends', 'hidden legends', 'ex'],
      'ex firered & leafgreen': ['ex firered & leafgreen', 'firered leafgreen', 'ex'],
      'ex team rocket returns': ['ex team rocket returns', 'rocket returns', 'ex'],
      'ex deoxys': ['ex deoxys', 'deoxys', 'ex'],
      'ex emerald': ['ex emerald', 'emerald', 'ex'],
      'ex unseen forces': ['ex unseen forces', 'unseen forces', 'ex'],
      'ex delta species': ['ex delta species', 'delta species', 'ex'],
      'ex legend maker': ['ex legend maker', 'legend maker', 'ex'],
      'ex holon phantoms': ['ex holon phantoms', 'holon phantoms', 'ex'],
      'ex crystal guardians': ['ex crystal guardians', 'crystal guardians', 'ex'],
      'ex dragon frontiers': ['ex dragon frontiers', 'dragon frontiers', 'ex'],
      'ex power keepers': ['ex power keepers', 'power keepers', 'ex']
    };
    
    // Grading company variations
    this.gradingAliases = {
      'psa': ['psa', 'professional sports authenticator'],
      'bgs': ['bgs', 'beckett grading services', 'beckett'],
      'cgc': ['cgc', 'certified guarantee company'],
      'sgc': ['sgc', 'sportscard guaranty corporation']
    };
  }

  // Advanced fuzzy matching using multiple strategies
  advancedFuzzyMatch(phygitalsCard) {
    const normalizedPrice = this.normalizePhygitalsPrice(phygitalsCard.price);
    if (!normalizedPrice || normalizedPrice < 1) return [];

    const cardInfo = this.extractAdvancedCardInfo(phygitalsCard.name);
    let matches = [];

    // Strategy 1: Exact Pokemon + Set + Grade match
    if (cardInfo.pokemonName && cardInfo.set && cardInfo.grade) {
      matches = this.findExactMatch(cardInfo);
    }

    // Strategy 2: Pokemon + Set match (ignore grade)
    if (matches.length === 0 && cardInfo.pokemonName && cardInfo.set) {
      matches = this.findSetMatch(cardInfo);
    }

    // Strategy 3: Pokemon + Year match
    if (matches.length === 0 && cardInfo.pokemonName && cardInfo.year) {
      matches = this.findYearMatch(cardInfo);
    }

    // Strategy 4: Pokemon + Grade match (ignore set)
    if (matches.length === 0 && cardInfo.pokemonName && cardInfo.grade) {
      matches = this.findGradeMatch(cardInfo);
    }

    // Strategy 5: Pokemon name only with price range validation
    if (matches.length === 0 && cardInfo.pokemonName) {
      matches = this.findPokemonMatch(cardInfo, normalizedPrice);
    }

    // Strategy 6: Fuzzy string matching with Levenshtein distance
    if (matches.length === 0) {
      matches = this.findFuzzyStringMatch(phygitalsCard.name, normalizedPrice);
    }

    // Strategy 7: Manual high-value card matching
    if (matches.length === 0 && normalizedPrice >= 1000) {
      matches = this.findHighValueMatch(phygitalsCard, normalizedPrice);
    }

    return matches;
  }

  extractAdvancedCardInfo(cardName) {
    const info = {
      year: null,
      pokemonName: null,
      set: null,
      grade: null,
      gradingCompany: null,
      cardNumber: null,
      edition: null,
      condition: null,
      language: null,
      variant: null
    };

    // Extract year (more comprehensive)
    const yearMatch = cardName.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) info.year = yearMatch[0];

    // Extract Pokemon name with aliases
    const lowerName = cardName.toLowerCase();
    for (const [canonical, aliases] of Object.entries(this.pokemonAliases)) {
      for (const alias of aliases) {
        if (lowerName.includes(alias)) {
          info.pokemonName = canonical;
          break;
        }
      }
      if (info.pokemonName) break;
    }

    // Extract set with aliases
    for (const [canonical, aliases] of Object.entries(this.setAliases)) {
      for (const alias of aliases) {
        if (lowerName.includes(alias)) {
          info.set = canonical;
          break;
        }
      }
      if (info.set) break;
    }

    // Extract grading information
    const gradingMatch = cardName.match(/(PSA|BGS|CGC|SGC)\s*(\d+(?:\.\d+)?)/i);
    if (gradingMatch) {
      info.gradingCompany = gradingMatch[1].toLowerCase();
      info.grade = gradingMatch[2];
    }

    // Extract edition information
    if (lowerName.includes('1st edition') || lowerName.includes('first edition')) {
      info.edition = '1st edition';
    } else if (lowerName.includes('shadowless')) {
      info.edition = 'shadowless';
    }

    // Extract language
    if (lowerName.includes('japanese') || lowerName.includes('jpn')) {
      info.language = 'japanese';
    } else if (lowerName.includes('english')) {
      info.language = 'english';
    }

    // Extract condition
    if (lowerName.includes('mint')) {
      info.condition = 'mint';
    } else if (lowerName.includes('near mint') || lowerName.includes('nm')) {
      info.condition = 'near mint';
    } else if (lowerName.includes('lightly played') || lowerName.includes('lp')) {
      info.condition = 'lightly played';
    }

    // Extract card number
    const numberMatch = cardName.match(/#(\d+)/);
    if (numberMatch) {
      info.cardNumber = numberMatch[1];
    }

    return info;
  }

  findExactMatch(cardInfo) {
    let query = `
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND LOWER(cc_title) LIKE LOWER(?)
        AND LOWER(cc_title) LIKE LOWER(?)
        AND LOWER(cc_title) LIKE LOWER(?)
    `;
    let params = [`%${cardInfo.pokemonName}%`, `%${cardInfo.set}%`, `%${cardInfo.grade}%`];

    if (cardInfo.edition) {
      query += ` AND LOWER(cc_title) LIKE LOWER(?)`;
      params.push(`%${cardInfo.edition}%`);
    }

    query += ` LIMIT 3`;
    return this.ultimateDb.prepare(query).all(...params);
  }

  findSetMatch(cardInfo) {
    return this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND LOWER(cc_title) LIKE LOWER(?)
        AND LOWER(cc_title) LIKE LOWER(?)
      LIMIT 3
    `).all(`%${cardInfo.pokemonName}%`, `%${cardInfo.set}%`);
  }

  findYearMatch(cardInfo) {
    return this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND LOWER(cc_title) LIKE LOWER(?)
        AND LOWER(cc_title) LIKE LOWER(?)
      LIMIT 3
    `).all(`%${cardInfo.pokemonName}%`, `%${cardInfo.year}%`);
  }

  findGradeMatch(cardInfo) {
    return this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND LOWER(cc_title) LIKE LOWER(?)
        AND LOWER(cc_title) LIKE LOWER(?)
      LIMIT 3
    `).all(`%${cardInfo.pokemonName}%`, `%${cardInfo.grade}%`);
  }

  findPokemonMatch(cardInfo, price) {
    // Find Pokemon matches within reasonable price range
    const priceMin = price * 0.5;
    const priceMax = price * 2.0;
    
    return this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND LOWER(cc_title) LIKE LOWER(?)
        AND final_market_value BETWEEN ? AND ?
      ORDER BY ABS(final_market_value - ?) ASC
      LIMIT 3
    `).all(`%${cardInfo.pokemonName}%`, priceMin, priceMax, price);
  }

  findFuzzyStringMatch(cardName, price) {
    // Use Levenshtein distance for fuzzy matching
    const allCards = this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND final_market_value BETWEEN ? AND ?
    `).all(price * 0.3, price * 3.0);

    const matches = [];
    for (const card of allCards) {
      const distance = this.levenshteinDistance(
        cardName.toLowerCase(), 
        card.cc_title.toLowerCase()
      );
      const similarity = 1 - (distance / Math.max(cardName.length, card.cc_title.length));
      
      if (similarity > 0.6) { // 60% similarity threshold
        matches.push({ ...card, similarity });
      }
    }

    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }

  findHighValueMatch(phygitalsCard, price) {
    // Special handling for high-value cards ($1000+)
    const highValueCards = this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND final_market_value >= 1000
        AND final_market_value BETWEEN ? AND ?
      ORDER BY ABS(final_market_value - ?) ASC
      LIMIT 5
    `).all(price * 0.5, price * 2.0, price);

    // For high-value cards, be more lenient with matching
    const cardInfo = this.extractAdvancedCardInfo(phygitalsCard.name);
    const matches = [];

    for (const card of highValueCards) {
      let score = 0;
      
      // Pokemon name match
      if (cardInfo.pokemonName && card.cc_title.toLowerCase().includes(cardInfo.pokemonName)) {
        score += 3;
      }
      
      // Year match
      if (cardInfo.year && card.cc_title.includes(cardInfo.year)) {
        score += 2;
      }
      
      // Set match
      if (cardInfo.set && card.cc_title.toLowerCase().includes(cardInfo.set)) {
        score += 2;
      }
      
      // Grade match
      if (cardInfo.grade && card.cc_title.includes(cardInfo.grade)) {
        score += 2;
      }
      
      // Price proximity
      const priceDiff = Math.abs(card.final_market_value - price);
      const priceScore = Math.max(0, 3 - (priceDiff / price));
      score += priceScore;

      if (score >= 4) { // Minimum score for high-value matches
        matches.push({ ...card, score });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  normalizePhygitalsPrice(lamportPrice) {
    if (!lamportPrice || lamportPrice <= 0) return null;
    
    const solPrice = lamportPrice / this.LAMPORTS_PER_SOL;
    const usdPrice = solPrice * this.SOL_TO_USD;
    
    // Reasonable Pokemon card price range
    if (usdPrice < 1 || usdPrice > 100000) return null;
    
    return Math.round(usdPrice * 100) / 100;
  }

  // Manual review system for high-value cards
  generateHighValueReviewList() {
    console.log('\n🔍 GENERATING HIGH-VALUE CARD REVIEW LIST');
    console.log('========================================');

    const highValuePhygitals = this.phygitalsDb.prepare(`
      SELECT id, name, price, grader, grade 
      FROM phygitals_cards 
      WHERE price > 0 
      AND (price / ${this.LAMPORTS_PER_SOL} * ${this.SOL_TO_USD}) >= 1000
      AND id NOT IN (
        SELECT SUBSTR(phygitals_source, -44) FROM collector_crypt_ultimate_pricing 
        WHERE phygitals_source IS NOT NULL
        AND phygitals_source LIKE '%phygitals.com/card/%'
      )
      ORDER BY price DESC
    `).all();

    console.log(`💰 Found ${highValuePhygitals.length} unmatched high-value cards:`);
    
    const reviewList = [];
    for (const card of highValuePhygitals) {
      const usdPrice = this.normalizePhygitalsPrice(card.price);
      console.log(`\n  💎 ${card.name}`);
      console.log(`     💵 Price: $${usdPrice.toFixed(2)}`);
      console.log(`     🏷️  Grade: ${card.grade || 'Raw'}`);
      console.log(`     🔗 ID: ${card.id}`);
      
      // Find potential matches for manual review
      const potentialMatches = this.findPotentialHighValueMatches(card, usdPrice);
      
      if (potentialMatches.length > 0) {
        console.log(`     🎯 Potential matches:`);
        potentialMatches.forEach((match, index) => {
          console.log(`        ${index + 1}. ${match.cc_title} - $${match.final_market_value.toFixed(2)}`);
        });
      }
      
      reviewList.push({
        phygitalsCard: card,
        usdPrice,
        potentialMatches
      });
    }

    // Save review list to file
    fs.writeFileSync('high-value-cards-review.json', JSON.stringify(reviewList, null, 2));
    console.log(`\n📄 High-value review list saved to: high-value-cards-review.json`);
    
    return reviewList;
  }

  findPotentialHighValueMatches(phygitalsCard, price) {
    const cardInfo = this.extractAdvancedCardInfo(phygitalsCard.name);
    
    // Find cards in similar price range
    return this.ultimateDb.prepare(`
      SELECT id, cc_title, final_market_value FROM collector_crypt_ultimate_pricing
      WHERE phygitals_price IS NULL
        AND final_market_value BETWEEN ? AND ?
      ORDER BY ABS(final_market_value - ?) ASC
      LIMIT 10
    `).all(price * 0.3, price * 3.0, price);
  }

  // Run the complete advanced matching process
  async runAdvancedMatching() {
    console.log('🚀 STARTING ADVANCED PHYGITALS MATCHING');
    console.log('======================================');

    try {
      // Get all unmatched Phygitals cards
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
      let highValueMatches = 0;
      let totalProcessed = 0;

      for (const phygitalsCard of unmatchedCards) {
        totalProcessed++;
        const normalizedPrice = this.normalizePhygitalsPrice(phygitalsCard.price);
        if (!normalizedPrice || normalizedPrice < 1) continue;

        // Use advanced fuzzy matching
        const matches = this.advancedFuzzyMatch(phygitalsCard);
        
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
          if (normalizedPrice >= 1000) {
            highValueMatches++;
          }

          if (newMatches % 25 === 0) {
            console.log(`📈 Progress: ${newMatches} new matches (${highValueMatches} high-value)...`);
          }
        }
      }

      console.log(`\n✅ Advanced matching complete:`);
      console.log(`   📊 Total processed: ${totalProcessed}`);
      console.log(`   🎯 New matches: ${newMatches}`);
      console.log(`   💎 High-value matches: ${highValueMatches}`);

      // Generate high-value review list
      const reviewList = this.generateHighValueReviewList();

      // Generate final report
      const finalReport = this.generateFinalReport();
      
      return { 
        success: true, 
        newMatches, 
        highValueMatches, 
        reviewList,
        report: finalReport 
      };

    } catch (error) {
      console.error('💥 Advanced matching failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.phygitalsDb.close();
      this.ultimateDb.close();
    }
  }

  generateFinalReport() {
    console.log('\n📊 GENERATING FINAL INTEGRATION REPORT');
    console.log('=====================================');

    const totalPhygitals = this.phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_cards WHERE price > 0').get().count;
    const integratedCards = this.ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_ultimate_pricing WHERE phygitals_price IS NOT NULL').get().count;
    
    const integrationRate = ((integratedCards / totalPhygitals) * 100).toFixed(1);
    
    console.log(`\n🎯 FINAL INTEGRATION RESULTS:`);
    console.log(`📊 Total Phygitals cards with prices: ${totalPhygitals}`);
    console.log(`✅ Successfully integrated: ${integratedCards}`);
    console.log(`📈 Integration rate: ${integrationRate}%`);

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

    console.log(`\n🏆 TOP ARBITRAGE OPPORTUNITIES:`);
    topArbitrageOps.slice(0, 10).forEach((opportunity, index) => {
      console.log(`\n  ${index + 1}. ${opportunity.cc_title}`);
      console.log(`     💵 Phygitals: $${opportunity.phygitals_price}`);
      console.log(`     💎 Market: $${opportunity.final_market_value.toFixed(2)}`);
      console.log(`     💰 Profit: $${opportunity.profit.toFixed(2)} (${opportunity.profit_percentage.toFixed(1)}%)`);
    });

    const report = {
      finalIntegrationSummary: {
        totalPhygitalsCards: totalPhygitals,
        successfullyIntegrated: integratedCards,
        integrationRate: `${integrationRate}%`,
        targetAchieved: parseFloat(integrationRate) >= 80,
        arbitrageOpportunities: topArbitrageOps.length
      },
      topArbitrageOpportunities: topArbitrageOps.map(op => ({
        cardName: op.cc_title,
        phygitalsPrice: op.phygitals_price,
        marketValue: op.final_market_value.toFixed(2),
        potentialProfit: op.profit.toFixed(2),
        profitPercentage: `${op.profit_percentage.toFixed(1)}%`
      }))
    };

    fs.writeFileSync('advanced-phygitals-final-report.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Final report saved to: advanced-phygitals-final-report.json`);

    return report;
  }
}

// Run the advanced matching
async function main() {
  const advancedMatcher = new AdvancedPhygitalsMatcher();
  await advancedMatcher.runAdvancedMatching();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default AdvancedPhygitalsMatcher;
