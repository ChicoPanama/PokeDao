/**
 * PROVEN PHYGITALS COMPLETE HARVESTER
 * Uses the exact successful API patterns from our working discovery
 * Target: Get ALL 7,261+ cards using marketplace-listings endpoint
 */

const fs = require('fs');
const Database = require('better-sqlite3');

class ProvenPhygitalsCompleteHarvester {
  constructor() {
    // Use the exact working API pattern from successful discovery
    this.baseURL = 'https://api.phygitals.com/api';
    this.db = new Database('phygitals_complete_all.db');
    this.setupDatabase();
    this.totalProcessed = 0;
    
    // Very conservative rate limiting
    this.requestDelay = 5000; // 5 seconds between requests
    
    // Solana conversion
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
    
    console.log('🎯 PROVEN PHYGITALS COMPLETE HARVESTER');
    console.log('📊 Using exact working API from successful discovery');
    console.log('🚀 Target: ALL 7,261+ cards via marketplace-listings');
  }

  setupDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phygitals_complete (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        price REAL,
        price_lamports BIGINT,
        usd_price REAL,
        fmv REAL,
        set_name TEXT,
        grader TEXT,
        grade TEXT,
        grade_type TEXT,
        rarity TEXT,
        card_type TEXT,
        language TEXT,
        category TEXT,
        owner_address TEXT,
        owner_username TEXT,
        seller_address TEXT,
        seller_username TEXT,
        listing_status TEXT,
        image_url TEXT,
        source_url TEXT,
        source_page INTEGER,
        metadata_json TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        pokemon_name TEXT,
        is_graded BOOLEAN,
        is_vintage BOOLEAN,
        is_high_value BOOLEAN,
        created_at TEXT,
        updated_at TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_complete_name ON phygitals_complete(name);
      CREATE INDEX IF NOT EXISTS idx_complete_price ON phygitals_complete(usd_price);
      CREATE INDEX IF NOT EXISTS idx_complete_pokemon ON phygitals_complete(pokemon_name);
    `);
    console.log('✅ Database ready');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequestWithFetch(url) {
    console.log(`      🌐 Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.phygitals.com/',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  convertPrice(lamports) {
    if (!lamports || lamports <= 0) return null;
    return Math.round((lamports / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD * 100) / 100;
  }

  extractPokemonName(cardName) {
    if (!cardName) return null;
    
    const pokemonNames = [
      'Charizard', 'Pikachu', 'Blastoise', 'Venusaur', 'Mew', 'Mewtwo', 'Lugia', 'Ho-oh', 
      'Rayquaza', 'Arceus', 'Dialga', 'Palkia', 'Giratina', 'Reshiram', 'Zekrom', 'Kyurem',
      'Xerneas', 'Yveltal', 'Zygarde', 'Solgaleo', 'Lunala', 'Necrozma', 'Zacian', 'Zamazenta',
      'Eternatus', 'Alakazam', 'Machamp', 'Gengar', 'Dragonite', 'Typhlosion', 'Feraligatr',
      'Ampharos', 'Espeon', 'Umbreon', 'Celebi', 'Blaziken', 'Swampert', 'Sceptile', 'Gardevoir',
      'Salamence', 'Metagross', 'Latios', 'Latias', 'Groudon', 'Kyogre', 'Deoxys', 'Garchomp',
      'Lucario', 'Darkrai', 'Shaymin', 'Victini', 'Serperior', 'Emboar', 'Samurott', 'Zoroark',
      'Greninja', 'Talonflame', 'Sylveon', 'Goodra', 'Trevenant', 'Decidueye', 'Incineroar',
      'Primarina', 'Lycanroc', 'Mimikyu', 'Toxapex', 'Kommo-o', 'Dragapult', 'Corviknight',
      'Grimmsnarl', 'Alcremie', 'Ferrothorn', 'Rotom'
    ];
    
    for (const pokemon of pokemonNames) {
      if (cardName.toLowerCase().includes(pokemon.toLowerCase())) {
        return pokemon.toLowerCase();
      }
    }
    return null;
  }

  async processListingItem(item, page) {
    if (!item.id && !item._id) return;
    
    const cardId = item.id || item._id;
    const cardName = item.name || item.title || item.productName || '';
    const price = item.price || item.listPrice || item.currentPrice || 0;
    const usdPrice = this.convertPrice(price);
    
    const pokemonName = this.extractPokemonName(cardName);
    const isGraded = /\b(PSA|BGS|CGC|ARS)\b/i.test(cardName);
    const isVintage = /\b(199\d|200[0-3])\b/.test(cardName);
    const isHighValue = usdPrice && usdPrice > 100;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO phygitals_complete (
          id, name, description, price, price_lamports, usd_price, fmv,
          set_name, grader, grade, grade_type, rarity, card_type, language, category,
          owner_address, owner_username, seller_address, seller_username,
          listing_status, image_url, source_url, source_page,
          metadata_json, pokemon_name, is_graded, is_vintage, is_high_value,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        cardId,
        cardName,
        item.description || '',
        price,
        price,
        usdPrice,
        item.fmv || item.estimatedValue || usdPrice,
        item.set?.name || item.setName || '',
        item.grader || '',
        item.grade || '',
        item.gradeType || '',
        item.rarity || '',
        item.type || item.cardType || '',
        item.language || 'English',
        item.category || '',
        item.owner?.address || item.ownerAddress || '',
        item.owner?.username || item.ownerUsername || '',
        item.seller?.address || item.sellerAddress || '',
        item.seller?.username || item.sellerUsername || '',
        item.status || item.listingStatus || 'unknown',
        item.image || item.imageUrl || item.thumbnail || '',
        `https://www.phygitals.com/card/${cardId}`,
        page,
        JSON.stringify(item),
        pokemonName,
        isGraded ? 1 : 0,
        isVintage ? 1 : 0,
        isHighValue ? 1 : 0,
        item.createdAt || item.created || '',
        item.updatedAt || item.updated || ''
      );

      this.totalProcessed++;
    } catch (error) {
      console.log(`      ⚠️ Error storing card ${cardId}: ${error.message}`);
    }
  }

  async harvestAllPages() {
    console.log('\n🚀 HARVESTING ALL PAGES FROM MARKETPLACE-LISTINGS');
    console.log('================================================');

    let page = 0; // Phygitals uses 0-based pagination
    let totalHarvested = 0;
    let consecutiveEmptyPages = 0;
    let maxEmptyPages = 10;

    // Start with large page size to get more cards per request
    const itemsPerPage = 100; // Max items per page

    while (page <= 500 && consecutiveEmptyPages < maxEmptyPages) {
      try {
        console.log(`\n📄 Processing page ${page}...`);

        // Use the exact working API pattern from successful discovery
        const params = new URLSearchParams({
          searchTerm: '', // Get all items
          sortBy: 'price-low-high', // Consistent sorting
          itemsPerPage: itemsPerPage,
          page: page,
          metadataConditions: JSON.stringify({
            set: [],
            grader: [],
            grade: [],
            rarity: [],
            type: [],
            'set release date': [],
            'grade type': [],
            language: [],
            category: []
          }),
          priceRange: JSON.stringify([null, null]), // All prices
          fmvRange: JSON.stringify([null, null]), // All FMVs
          listedStatus: 'any' // All listing statuses
        });
        
        const url = `${this.baseURL}/marketplace/marketplace-listings?${params}`;
        const data = await this.makeRequestWithFetch(url);

        if (!data) {
          console.log(`   ❌ Page ${page}: No data received`);
          consecutiveEmptyPages++;
          page++;
          await this.delay(this.requestDelay);
          continue;
        }

        // Extract listings from response
        const listings = data.listings || data.data || data.results || [];
        
        if (listings.length === 0) {
          console.log(`   📭 Page ${page}: Empty (${consecutiveEmptyPages + 1}/${maxEmptyPages})`);
          consecutiveEmptyPages++;
        } else {
          console.log(`   📦 Page ${page}: ${listings.length} listings found`);
          consecutiveEmptyPages = 0; // Reset counter
          
          // Process all listings
          for (const listing of listings) {
            await this.processListingItem(listing, page);
          }
          
          totalHarvested += listings.length;
          
          // Show progress every 10 pages
          if (page % 10 === 0) {
            const dbCount = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_complete').get().count;
            console.log(`   📊 Page ${page} progress: +${listings.length} | Database: ${dbCount.toLocaleString()} cards`);
            
            // Check if we've hit our target
            if (dbCount >= 7261) {
              console.log(`   🎉 TARGET ACHIEVED! ${dbCount} >= 7,261 cards`);
              break;
            }
          }
        }

        page++;
        await this.delay(this.requestDelay);

      } catch (error) {
        console.log(`   ❌ Page ${page} error: ${error.message}`);
        
        if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          console.log(`   ⏳ Rate limited - waiting longer...`);
          await this.delay(this.requestDelay * 3); // Wait 15 seconds
        } else {
          consecutiveEmptyPages++;
          await this.delay(this.requestDelay);
        }
        
        page++;
      }
    }

    console.log(`\n🏁 Harvest complete: ${totalHarvested} listings processed`);
    return totalHarvested;
  }

  async generateReport() {
    console.log('\n📊 GENERATING COMPLETE HARVEST REPORT');
    console.log('====================================');

    const stats = {
      totalCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_complete').get().count,
      withPrices: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_complete WHERE usd_price > 0').get().count,
      pokemonCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_complete WHERE pokemon_name IS NOT NULL').get().count,
      gradedCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_complete WHERE is_graded = 1').get().count,
      vintageCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_complete WHERE is_vintage = 1').get().count,
      highValueCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_complete WHERE is_high_value = 1').get().count
    };

    const priceStats = this.db.prepare(`
      SELECT MIN(usd_price) as min, MAX(usd_price) as max, AVG(usd_price) as avg
      FROM phygitals_complete WHERE usd_price > 0
    `).get();

    const topCards = this.db.prepare(`
      SELECT name, usd_price, grader, grade, pokemon_name
      FROM phygitals_complete WHERE usd_price > 0
      ORDER BY usd_price DESC LIMIT 20
    `).all();

    const pokemonStats = this.db.prepare(`
      SELECT pokemon_name, COUNT(*) as count, AVG(usd_price) as avg_price
      FROM phygitals_complete WHERE pokemon_name IS NOT NULL AND usd_price > 0
      GROUP BY pokemon_name ORDER BY count DESC LIMIT 15
    `).all();

    console.log(`\n🎉 COMPLETE HARVEST RESULTS!`);
    console.log(`===========================`);
    console.log(`📦 Total cards: ${stats.totalCards.toLocaleString()}`);
    console.log(`🎴 Pokemon cards: ${stats.pokemonCards.toLocaleString()}`);
    console.log(`💰 With pricing: ${stats.withPrices.toLocaleString()}`);
    console.log(`🏆 Graded cards: ${stats.gradedCards.toLocaleString()}`);
    console.log(`⭐ Vintage cards: ${stats.vintageCards.toLocaleString()}`);
    console.log(`💎 High-value (>$100): ${stats.highValueCards.toLocaleString()}`);

    if (priceStats.max) {
      console.log(`\n💵 PRICE ANALYSIS:`);
      console.log(`   Range: $${priceStats.min?.toFixed(2)} - $${priceStats.max?.toLocaleString()}`);
      console.log(`   Average: $${priceStats.avg?.toFixed(2)}`);
    }

    console.log(`\n🏆 TOP 10 HIGHEST VALUE CARDS:`);
    topCards.slice(0, 10).forEach((card, i) => {
      console.log(`   ${i+1}. ${card.name} - $${card.usd_price?.toLocaleString()}`);
      if (card.grader && card.grade) {
        console.log(`      🏅 ${card.grader} ${card.grade}`);
      }
    });

    console.log(`\n🎯 POKEMON BREAKDOWN:`);
    pokemonStats.slice(0, 10).forEach((pokemon, i) => {
      console.log(`   ${i+1}. ${pokemon.pokemon_name}: ${pokemon.count} cards (avg $${pokemon.avg_price?.toFixed(2)})`);
    });

    // Calculate target achievement
    const targetAchievement = ((stats.totalCards / 7261) * 100).toFixed(1);
    console.log(`\n🎯 TARGET ACHIEVEMENT:`);
    console.log(`   Harvested: ${stats.totalCards.toLocaleString()} cards`);
    console.log(`   Target: 7,261 cards`);
    console.log(`   Achievement: ${targetAchievement}%`);

    if (stats.totalCards >= 7261) {
      console.log(`   🎉 SUCCESS! Target exceeded!`);
    } else if (stats.totalCards >= 5000) {
      console.log(`   💪 Strong performance! ${targetAchievement}% of target achieved`);
    } else {
      console.log(`   📈 Good progress made: ${stats.totalCards.toLocaleString()} cards harvested`);
    }

    // Save detailed report
    const report = {
      harvestSummary: stats,
      pricingAnalysis: priceStats,
      topValueCards: topCards,
      pokemonBreakdown: pokemonStats,
      targetAchievement: {
        harvested: stats.totalCards,
        target: 7261,
        percentage: `${targetAchievement}%`,
        status: stats.totalCards >= 7261 ? 'SUCCESS' : stats.totalCards >= 5000 ? 'STRONG' : 'PROGRESS'
      },
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync('phygitals-complete-harvest-report.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved: phygitals-complete-harvest-report.json`);

    return report;
  }

  async run() {
    console.log('🚀 STARTING PROVEN COMPLETE HARVEST');
    console.log('==================================');

    try {
      // Harvest all pages using proven API pattern
      await this.harvestAllPages();
      
      // Generate comprehensive report
      const report = await this.generateReport();
      
      console.log('\n✅ HARVEST COMPLETE!');
      return { success: true, report };

    } catch (error) {
      console.error('💥 Harvest failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.db.close();
    }
  }
}

// Run the complete harvest
async function main() {
  const harvester = new ProvenPhygitalsCompleteHarvester();
  await harvester.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ProvenPhygitalsCompleteHarvester;
