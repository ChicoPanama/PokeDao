/**
 * Phygitals.com Pokemon Card Integration into Ultimate Pricing System
 * Normalizes Phygitals data and integrates it with our existing comprehensive pricing intelligence
 */

const Database = require('better-sqlite3');
const fs = require('fs');

class PhygitalsIntegrationSystem {
  constructor() {
    // Open both databases
    this.phygitalsDb = new Database('phygitals_pokemon_complete.db');
    this.ultimateDb = new Database('../tcgplayer-discovery/collector_crypt_ultimate_pricing.db');
    
    // Solana conversion rate (assuming prices are in lamports)
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140; // Approximate SOL price (would need real-time data in production)
    
    this.stats = {
      processedCards: 0,
      matchedCards: 0,
      newPriceUpdates: 0,
      validPrices: 0,
      startTime: new Date()
    };
  }

  analyzePhygitalsData() {
    console.log('🔍 ANALYZING PHYGITALS DATA STRUCTURE');
    console.log('====================================');

    // Get overview statistics
    const cardCount = this.phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_cards').get().count;
    const salesCount = this.phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_sales').get().count;
    const usersCount = this.phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_users').get().count;
    const setsCount = this.phygitalsDb.prepare('SELECT COUNT(*) as count FROM phygitals_sets').get().count;

    console.log(`📊 Total Cards: ${cardCount}`);
    console.log(`💰 Total Sales: ${salesCount}`);
    console.log(`👥 Total Users: ${usersCount}`);
    console.log(`📦 Pokemon Sets: ${setsCount}`);

    // Analyze pricing data
    const priceAnalysis = this.phygitalsDb.prepare(`
      SELECT 
        COUNT(*) as cards_with_prices,
        MIN(price) as min_price_lamports,
        MAX(price) as max_price_lamports,
        AVG(price) as avg_price_lamports
      FROM phygitals_cards 
      WHERE price > 0
    `).get();

    const minUSD = (priceAnalysis.min_price_lamports / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD;
    const maxUSD = (priceAnalysis.max_price_lamports / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD;
    const avgUSD = (priceAnalysis.avg_price_lamports / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD;

    console.log(`\n💵 PRICING ANALYSIS:`);
    console.log(`Cards with prices: ${priceAnalysis.cards_with_prices}`);
    console.log(`Price range (USD): $${minUSD.toFixed(2)} - $${maxUSD.toFixed(2)}`);
    console.log(`Average price (USD): $${avgUSD.toFixed(2)}`);

    // Get sample high-value cards
    const highValueCards = this.phygitalsDb.prepare(`
      SELECT name, price, grader, grade, set_name
      FROM phygitals_cards 
      WHERE price > 0 
      ORDER BY price DESC 
      LIMIT 10
    `).all();

    console.log('\n🏆 TOP 10 HIGHEST VALUE CARDS:');
    highValueCards.forEach((card, index) => {
      const usdPrice = (card.price / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD;
      const gradeInfo = card.grader && card.grade ? `${card.grader} ${card.grade}` : 'Ungraded';
      console.log(`  ${index + 1}. ${card.name} - $${usdPrice.toFixed(2)} (${gradeInfo})`);
    });

    return {
      cardCount,
      salesCount,
      usersCount,
      setsCount,
      priceAnalysis: {
        ...priceAnalysis,
        minUSD: minUSD.toFixed(2),
        maxUSD: maxUSD.toFixed(2),
        avgUSD: avgUSD.toFixed(2)
      },
      highValueCards: highValueCards.map(card => ({
        ...card,
        usdPrice: ((card.price / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD).toFixed(2)
      }))
    };
  }

  normalizePhygitalsPrice(lamportPrice) {
    if (!lamportPrice || lamportPrice <= 0) return null;
    
    // Convert lamports to SOL to USD
    const solPrice = lamportPrice / this.LAMPORTS_PER_SOL;
    const usdPrice = solPrice * this.SOL_TO_USD;
    
    // Sanity check: reasonable Pokemon card price range
    if (usdPrice < 0.1 || usdPrice > 1000000) return null;
    
    return Math.round(usdPrice * 100) / 100; // Round to 2 decimal places
  }

  integrateWithUltimatePricing() {
    console.log('\n🔗 INTEGRATING PHYGITALS DATA WITH ULTIMATE PRICING SYSTEM');
    console.log('========================================================');

    // Check if ultimate pricing database exists
    try {
      const ultimateCount = this.ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards_ultimate').get().count;
      console.log(`🗄️  Ultimate pricing database has ${ultimateCount} cards`);
    } catch (error) {
      console.log('❌ Ultimate pricing database not found. Run comprehensive-pricing-system-v2.js first');
      return false;
    }

    // Add Phygitals pricing column if it doesn't exist
    try {
      this.ultimateDb.exec(`ALTER TABLE collector_crypt_cards_ultimate ADD COLUMN phygitals_price REAL`);
      this.ultimateDb.exec(`ALTER TABLE collector_crypt_cards_ultimate ADD COLUMN phygitals_source TEXT`);
      console.log('✅ Added Phygitals pricing columns');
    } catch (error) {
      // Columns might already exist
      console.log('ℹ️  Phygitals columns already exist');
    }

    // Get all Phygitals cards with valid prices
    const phygitalsCards = this.phygitalsDb.prepare(`
      SELECT name, price, grader, grade, set_name, id
      FROM phygitals_cards 
      WHERE price > 0
    `).all();

    console.log(`🎴 Processing ${phygitalsCards.length} Phygitals cards for integration...`);

    let matchedCards = 0;
    let priceUpdates = 0;

    for (const phygitalsCard of phygitalsCards) {
      this.stats.processedCards++;
      
      const normalizedPrice = this.normalizePhygitalsPrice(phygitalsCard.price);
      if (!normalizedPrice) continue;
      
      this.stats.validPrices++;

      // Try to match with existing cards using fuzzy name matching
      const matches = this.findCardMatches(phygitalsCard);
      
      if (matches.length > 0) {
        matchedCards++;
        this.stats.matchedCards++;
        
        // Update the best match with Phygitals pricing
        const bestMatch = matches[0];
        
        const updateStmt = this.ultimateDb.prepare(`
          UPDATE collector_crypt_cards_ultimate 
          SET phygitals_price = ?, phygitals_source = ?
          WHERE id = ?
        `);
        
        updateStmt.run(normalizedPrice, `https://www.phygitals.com/card/${phygitalsCard.id}`, bestMatch.id);
        priceUpdates++;
        this.stats.newPriceUpdates++;
        
        if (priceUpdates % 100 === 0) {
          console.log(`📈 Updated ${priceUpdates} cards with Phygitals pricing...`);
        }
      }
    }

    console.log(`✅ Integration complete: ${matchedCards} matches, ${priceUpdates} price updates`);
    return true;
  }

  findCardMatches(phygitalsCard) {
    // Clean and normalize the card name for matching
    const cleanName = this.cleanCardName(phygitalsCard.name);
    
    // Try exact name match first
    let matches = this.ultimateDb.prepare(`
      SELECT id, name FROM collector_crypt_cards_ultimate
      WHERE LOWER(name) LIKE LOWER(?)
      LIMIT 1
    `).all(`%${cleanName}%`);

    if (matches.length === 0) {
      // Try matching by Pokemon name extracted from the title
      const pokemonName = this.extractPokemonName(phygitalsCard.name);
      if (pokemonName) {
        matches = this.ultimateDb.prepare(`
          SELECT id, name FROM collector_crypt_cards_ultimate
          WHERE LOWER(name) LIKE LOWER(?)
          LIMIT 1
        `).all(`%${pokemonName}%`);
      }
    }

    return matches;
  }

  cleanCardName(name) {
    // Remove common prefixes and suffixes for better matching
    return name
      .replace(/^\d{4}\s+/, '') // Remove year
      .replace(/\s+Pokemon\s+/i, ' ')
      .replace(/\s+PSA\s+\d+.*$/i, '') // Remove PSA info
      .replace(/\s+BGS\s+\d+.*$/i, '') // Remove BGS info  
      .replace(/\s+CGC\s+\d+.*$/i, '') // Remove CGC info
      .replace(/\s+#\d+.*$/i, '') // Remove card numbers
      .replace(/\s+\|\s+.*$/i, '') // Remove everything after |
      .trim();
  }

  extractPokemonName(cardName) {
    // Try to extract the actual Pokemon name from the title
    const patterns = [
      /Pokemon.*?([A-Z][a-z]+)\s+/i,
      /\b([A-Z][a-z]+)\s+(?:ex|EX|GX|V|VMAX|VSTAR)/i,
      /\b([A-Z][a-z]{2,})\s+(?:#|\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = cardName.match(pattern);
      if (match && match[1]) {
        const pokemonName = match[1].toLowerCase();
        // Filter out common non-Pokemon words
        const excludeWords = ['base', 'set', 'holo', 'reverse', 'promo', 'first', 'edition'];
        if (!excludeWords.includes(pokemonName)) {
          return pokemonName;
        }
      }
    }
    
    return null;
  }

  enhanceUltimatePricingWithPhygitals() {
    console.log('\n🚀 ENHANCING ULTIMATE PRICING SYSTEM WITH PHYGITALS DATA');
    console.log('=======================================================');

    // Recalculate ultimate prices including Phygitals data
    const cardsWithPhygitals = this.ultimateDb.prepare(`
      SELECT 
        id, name, ebay_sold_avg, enhanced_pokemon_tcg_price, phygitals_price,
        ultimate_market_value, confidence_score
      FROM collector_crypt_cards_ultimate 
      WHERE phygitals_price IS NOT NULL
    `).all();

    console.log(`🎯 Enhancing ${cardsWithPhygitals.length} cards with Phygitals pricing data...`);

    let enhancedCards = 0;

    for (const card of cardsWithPhygitals) {
      // Recalculate ultimate price with Phygitals as additional data source
      const prices = [];
      const sources = [];
      
      if (card.ebay_sold_avg > 0) {
        prices.push(card.ebay_sold_avg);
        sources.push('eBay Sold');
      }
      
      if (card.enhanced_pokemon_tcg_price > 0) {
        prices.push(card.enhanced_pokemon_tcg_price);
        sources.push('Pokemon TCG API');
      }
      
      if (card.phygitals_price > 0) {
        prices.push(card.phygitals_price);
        sources.push('Phygitals');
      }

      if (prices.length >= 2) {
        // Calculate enhanced price using weighted average
        // eBay Sold (50%), Pokemon TCG (30%), Phygitals (20%)
        let weightedPrice = 0;
        let totalWeight = 0;

        prices.forEach((price, index) => {
          const source = sources[index];
          let weight = 0;
          
          if (source === 'eBay Sold') weight = 0.5;
          else if (source === 'Pokemon TCG API') weight = 0.3;
          else if (source === 'Phygitals') weight = 0.2;
          
          weightedPrice += price * weight;
          totalWeight += weight;
        });

        const enhancedPrice = totalWeight > 0 ? weightedPrice / totalWeight : card.ultimate_market_value;
        const enhancedConfidence = Math.min(95, card.confidence_score + 5); // Boost confidence slightly

        // Update with enhanced pricing
        const updateStmt = this.ultimateDb.prepare(`
          UPDATE collector_crypt_cards_ultimate 
          SET ultimate_market_value = ?, confidence_score = ?
          WHERE id = ?
        `);

        updateStmt.run(
          Math.round(enhancedPrice * 100) / 100,
          enhancedConfidence,
          card.id
        );

        enhancedCards++;
      }
    }

    console.log(`✅ Enhanced ${enhancedCards} cards with multi-source pricing including Phygitals`);
    return enhancedCards;
  }

  generateIntegrationReport() {
    console.log('\n📊 GENERATING PHYGITALS INTEGRATION REPORT');
    console.log('==========================================');

    const endTime = new Date();
    const duration = Math.round((endTime - this.stats.startTime) / 1000);

    // Get final statistics
    const totalCards = this.ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards_ultimate').get().count;
    const cardsWithPhygitals = this.ultimateDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards_ultimate WHERE phygitals_price IS NOT NULL').get().count;
    
    const priceComparison = this.ultimateDb.prepare(`
      SELECT 
        AVG(ultimate_market_value) as avg_ultimate_price,
        AVG(phygitals_price) as avg_phygitals_price,
        AVG(ebay_sold_avg) as avg_ebay_price
      FROM collector_crypt_cards_ultimate 
      WHERE phygitals_price IS NOT NULL AND ultimate_market_value > 0
    `).get();

    const topPhygitalsDeals = this.ultimateDb.prepare(`
      SELECT 
        name, ultimate_market_value, phygitals_price, ebay_sold_avg,
        (ultimate_market_value - phygitals_price) as price_difference
      FROM collector_crypt_cards_ultimate 
      WHERE phygitals_price IS NOT NULL 
        AND ultimate_market_value > phygitals_price
        AND ultimate_market_value > 10
      ORDER BY price_difference DESC 
      LIMIT 10
    `).all();

    const report = {
      integrationSummary: {
        duration: `${duration} seconds`,
        totalCards: totalCards,
        cardsProcessed: this.stats.processedCards,
        cardsMatched: this.stats.matchedCards,
        priceUpdates: this.stats.newPriceUpdates,
        phygitalsIntegrated: cardsWithPhygitals,
        integrationRate: `${((cardsWithPhygitals / totalCards) * 100).toFixed(1)}%`
      },
      priceAnalysis: {
        averageUltimatePrice: Math.round(priceComparison.avg_ultimate_price * 100) / 100,
        averagePhygitalsPrice: Math.round(priceComparison.avg_phygitals_price * 100) / 100,
        averageEbayPrice: Math.round(priceComparison.avg_ebay_price * 100) / 100
      },
      investmentOpportunities: topPhygitalsDeals.map(card => ({
        name: card.name,
        ultimatePrice: card.ultimate_market_value,
        phygitalsPrice: card.phygitals_price,
        ebayPrice: card.ebay_sold_avg,
        potentialSavings: Math.round(card.price_difference * 100) / 100,
        percentageDeal: `${Math.round(((card.price_difference / card.ultimate_market_value) * 100) * 100) / 100}%`
      })),
      dataQuality: 'HIGH - Phygitals provides complementary pricing data from blockchain marketplace',
      nextSteps: [
        'Monitor Phygitals for real-time price updates',
        'Implement automated arbitrage opportunity detection',
        'Cross-reference with additional data sources for validation'
      ]
    };

    fs.writeFileSync('phygitals-integration-report.json', JSON.stringify(report, null, 2));

    console.log(`\n✅ PHYGITALS INTEGRATION COMPLETE!`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🎴 Cards Enhanced: ${cardsWithPhygitals}`);
    console.log(`📊 Integration Rate: ${((cardsWithPhygitals / totalCards) * 100).toFixed(1)}%`);
    console.log(`💰 Average Phygitals Price: $${Math.round(priceComparison.avg_phygitals_price * 100) / 100}`);
    console.log(`🎯 Investment Opportunities: ${topPhygitalsDeals.length}`);
    console.log(`📄 Report: phygitals-integration-report.json`);

    if (topPhygitalsDeals.length > 0) {
      console.log(`\n🏆 TOP PHYGITALS ARBITRAGE OPPORTUNITIES:`);
      topPhygitalsDeals.slice(0, 5).forEach((deal, index) => {
        console.log(`  ${index + 1}. ${deal.name}`);
        console.log(`     Phygitals: $${deal.phygitalsPrice} | Market Value: $${deal.ultimatePrice}`);
        console.log(`     Potential Profit: $${Math.round(deal.price_difference * 100) / 100}`);
      });
    }

    return report;
  }

  async integrate() {
    console.log('🚀 STARTING PHYGITALS INTEGRATION WITH ULTIMATE PRICING SYSTEM');
    console.log('==============================================================');

    try {
      // Analyze Phygitals data
      const analysisResults = this.analyzePhygitalsData();
      
      // Integrate with ultimate pricing
      const integrationSuccess = this.integrateWithUltimatePricing();
      
      if (integrationSuccess) {
        // Enhance ultimate pricing with Phygitals data
        this.enhanceUltimatePricingWithPhygitals();
        
        // Generate comprehensive report
        return this.generateIntegrationReport();
      } else {
        console.log('❌ Integration failed - Ultimate pricing database not available');
        return null;
      }

    } catch (error) {
      console.error('💥 Integration failed:', error);
      return null;
    } finally {
      this.phygitalsDb.close();
      this.ultimateDb.close();
    }
  }
}

// Run the integration
async function main() {
  const integrator = new PhygitalsIntegrationSystem();
  await integrator.integrate();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PhygitalsIntegrationSystem;
