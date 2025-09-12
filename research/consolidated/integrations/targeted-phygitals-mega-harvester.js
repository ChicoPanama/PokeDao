/**
 * TARGETED PHYGITALS MEGA HARVESTER
 * Uses the proven successful endpoints from our previous harvest
 * Target: Get ALL 7,261+ cards by thoroughly paginating known working endpoints
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const fs = require('fs');

class TargetedPhygitalsMegaHarvester {
  constructor() {
    // Use the working API patterns we discovered
    this.baseURL = 'https://api.phygitals.com';
    this.workingEndpoints = [
      '/api/marketplace/search',
      '/api/marketplace/products', 
      '/api/marketplace/cards',
      '/api/search'
    ];
    
    this.db = new Database('phygitals_mega_harvest.db');
    this.setupDatabase();
    this.totalProcessed = 0;
    
    // Conservative rate limiting for stability
    this.requestDelay = 3000; // 3 seconds between requests
    this.maxRetries = 3;
    
    // Solana conversion
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
    
    console.log('🎯 TARGETED PHYGITALS MEGA HARVESTER');
    console.log('📊 Target: ALL 7,261+ cards via proven endpoints');
    console.log('⚡ Using conservative approach for maximum success');
  }

  setupDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phygitals_mega (
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
        rarity TEXT,
        card_type TEXT,
        language TEXT,
        owner_address TEXT,
        owner_username TEXT,
        seller_address TEXT,
        seller_username TEXT,
        listing_status TEXT,
        image_url TEXT,
        source_url TEXT,
        source_endpoint TEXT,
        source_page INTEGER,
        metadata_json TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        pokemon_name TEXT,
        is_graded BOOLEAN,
        is_vintage BOOLEAN,
        is_high_value BOOLEAN
      );
      
      CREATE INDEX IF NOT EXISTS idx_mega_name ON phygitals_mega(name);
      CREATE INDEX IF NOT EXISTS idx_mega_price ON phygitals_mega(usd_price);
      CREATE INDEX IF NOT EXISTS idx_mega_pokemon ON phygitals_mega(pokemon_name);
      CREATE INDEX IF NOT EXISTS idx_mega_endpoint ON phygitals_mega(source_endpoint);
    `);
    console.log('✅ Database ready');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(url, retryCount = 0) {
    try {
      console.log(`      🌐 Request: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 45000,
        maxRedirects: 10
      });
      
      return response.data;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const waitTime = Math.pow(2, retryCount + 1) * 2000;
        console.log(`      ⚠️ Request failed, waiting ${waitTime/1000}s before retry ${retryCount + 1}/${this.maxRetries}`);
        await this.delay(waitTime);
        return this.makeRequest(url, retryCount + 1);
      }
      throw error;
    }
  }

  convertPrice(lamports) {
    if (!lamports || lamports <= 0) return null;
    return Math.round((lamports / this.LAMPORTS_PER_SOL) * this.SOL_TO_USD * 100) / 100;
  }

  extractPokemonName(cardName) {
    if (!cardName) return null;
    
    const patterns = [
      /\b(Charizard|Pikachu|Blastoise|Venusaur|Mew|Mewtwo|Lugia|Ho-oh|Rayquaza|Arceus|Dialga|Palkia|Giratina|Reshiram|Zekrom|Kyurem|Xerneas|Yveltal|Zygarde|Solgaleo|Lunala|Necrozma|Zacian|Zamazenta|Eternatus|Alakazam|Machamp|Gengar|Dragonite|Typhlosion|Feraligatr|Ampharos|Espeon|Umbreon|Celebi|Blaziken|Swampert|Sceptile|Gardevoir|Salamence|Metagross|Latios|Latias|Groudon|Kyogre|Deoxys|Garchomp|Lucario|Darkrai|Shaymin|Victini|Serperior|Emboar|Samurott|Zoroark|Greninja|Talonflame|Sylveon|Goodra|Trevenant|Decidueye|Incineroar|Primarina|Lycanroc|Mimikyu|Toxapex|Kommo-o|Dragapult|Corviknight|Grimmsnarl|Alcremie|Ferrothorn|Rotom)\b/i
    ];
    
    for (const pattern of patterns) {
      const match = cardName.match(pattern);
      if (match) return match[1].toLowerCase();
    }
    return null;
  }

  async processCard(item, endpoint, page) {
    if (!item.id && !item._id) return;
    
    const cardId = item.id || item._id;
    const cardName = item.name || item.title || '';
    const price = item.price || item.listPrice || 0;
    const usdPrice = this.convertPrice(price);
    
    const pokemonName = this.extractPokemonName(cardName);
    const isGraded = /\b(PSA|BGS|CGC)\b/i.test(cardName);
    const isVintage = /\b(199\d|200[0-3])\b/.test(cardName);
    const isHighValue = usdPrice && usdPrice > 100;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO phygitals_mega (
          id, name, description, price, price_lamports, usd_price, fmv,
          set_name, grader, grade, rarity, card_type, language,
          owner_address, owner_username, seller_address, seller_username,
          listing_status, image_url, source_url, source_endpoint, source_page,
          metadata_json, pokemon_name, is_graded, is_vintage, is_high_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        cardId,
        cardName,
        item.description || '',
        price,
        price,
        usdPrice,
        item.fmv || usdPrice,
        item.set?.name || '',
        item.grader || '',
        item.grade || '',
        item.rarity || '',
        item.type || '',
        item.language || 'English',
        item.owner?.address || '',
        item.owner?.username || '',
        item.seller?.address || '',
        item.seller?.username || '',
        item.status || 'unknown',
        item.image || '',
        `https://www.phygitals.com/card/${cardId}`,
        endpoint,
        page,
        JSON.stringify(item),
        pokemonName,
        isGraded ? 1 : 0,
        isVintage ? 1 : 0,
        isHighValue ? 1 : 0
      );

      this.totalProcessed++;
    } catch (error) {
      console.log(`      ⚠️ Error storing card ${cardId}: ${error.message}`);
    }
  }

  async harvestEndpointCompletely(endpoint) {
    console.log(`\n🚀 MEGA HARVESTING: ${endpoint}`);
    console.log('=====================================');

    let page = 1;
    let totalFromEndpoint = 0;
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmpty = 5;

    while (page <= 1000 && consecutiveEmptyPages < maxConsecutiveEmpty) {
      try {
        // Try multiple URL patterns for each endpoint
        const urlPatterns = [
          `${this.baseURL}${endpoint}?page=${page}&limit=100`,
          `${this.baseURL}${endpoint}?page=${page}&pageSize=100`, 
          `${this.baseURL}${endpoint}?offset=${(page-1)*100}&limit=100`,
          `${this.baseURL}${endpoint}?p=${page}&ps=100`,
          `${this.baseURL}${endpoint}?query=pokemon&page=${page}&limit=100`
        ];

        let data = null;
        let workingUrl = null;

        // Try each URL pattern until one works
        for (const url of urlPatterns) {
          try {
            data = await this.makeRequest(url);
            if (data && (data.data || data.results || data.items)) {
              workingUrl = url;
              break;
            }
          } catch (error) {
            // Continue to next pattern
            continue;
          }
        }

        if (!data || !workingUrl) {
          console.log(`   ❌ Page ${page}: No working URL pattern found`);
          consecutiveEmptyPages++;
          page++;
          await this.delay(this.requestDelay);
          continue;
        }

        // Extract items from response
        const items = data.data || data.results || data.items || [];
        
        if (items.length === 0) {
          console.log(`   📭 Page ${page}: Empty (${consecutiveEmptyPages + 1}/${maxConsecutiveEmpty} consecutive empty)`);
          consecutiveEmptyPages++;
        } else {
          console.log(`   📦 Page ${page}: ${items.length} items found`);
          consecutiveEmptyPages = 0; // Reset counter
          
          // Process all items
          for (const item of items) {
            await this.processCard(item, endpoint, page);
          }
          
          totalFromEndpoint += items.length;
          
          // Progress update
          if (page % 10 === 0) {
            const currentTotal = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega').get().count;
            console.log(`   📊 Endpoint progress: ${totalFromEndpoint} items | Database total: ${currentTotal}`);
          }
        }

        page++;
        await this.delay(this.requestDelay);

      } catch (error) {
        console.log(`   ❌ Page ${page} error: ${error.message}`);
        consecutiveEmptyPages++;
        page++;
        await this.delay(this.requestDelay * 2);
      }
    }

    console.log(`   🏁 Endpoint complete: ${totalFromEndpoint} items harvested`);
    return totalFromEndpoint;
  }

  async generateMegaReport() {
    console.log('\n📊 GENERATING MEGA HARVEST REPORT');
    console.log('=================================');

    const stats = {
      totalCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega').get().count,
      withPrices: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega WHERE usd_price > 0').get().count,
      pokemonCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega WHERE pokemon_name IS NOT NULL').get().count,
      gradedCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega WHERE is_graded = 1').get().count,
      vintageCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega WHERE is_vintage = 1').get().count,
      highValueCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega WHERE is_high_value = 1').get().count
    };

    const priceStats = this.db.prepare(`
      SELECT MIN(usd_price) as min, MAX(usd_price) as max, AVG(usd_price) as avg
      FROM phygitals_mega WHERE usd_price > 0
    `).get();

    const topCards = this.db.prepare(`
      SELECT name, usd_price, grader, grade, pokemon_name
      FROM phygitals_mega WHERE usd_price > 0
      ORDER BY usd_price DESC LIMIT 15
    `).all();

    const endpointBreakdown = this.db.prepare(`
      SELECT source_endpoint, COUNT(*) as count
      FROM phygitals_mega GROUP BY source_endpoint ORDER BY count DESC
    `).all();

    console.log(`\n🎉 MEGA HARVEST COMPLETE!`);
    console.log(`========================`);
    console.log(`📦 Total cards: ${stats.totalCards.toLocaleString()}`);
    console.log(`🎴 Pokemon cards: ${stats.pokemonCards.toLocaleString()}`);
    console.log(`💰 With pricing: ${stats.withPrices.toLocaleString()}`);
    console.log(`🏆 Graded cards: ${stats.gradedCards.toLocaleString()}`);
    console.log(`⭐ Vintage cards: ${stats.vintageCards.toLocaleString()}`);
    console.log(`💎 High-value (>$100): ${stats.highValueCards.toLocaleString()}`);

    if (priceStats.max) {
      console.log(`\n💵 PRICE RANGE: $${priceStats.min?.toFixed(2)} - $${priceStats.max?.toLocaleString()}`);
      console.log(`💵 AVERAGE PRICE: $${priceStats.avg?.toFixed(2)}`);
    }

    console.log(`\n🏆 TOP VALUE CARDS:`);
    topCards.forEach((card, i) => {
      console.log(`   ${i+1}. ${card.name} - $${card.usd_price?.toLocaleString()}`);
    });

    console.log(`\n📊 ENDPOINT BREAKDOWN:`);
    endpointBreakdown.forEach((ep, i) => {
      console.log(`   ${i+1}. ${ep.source_endpoint}: ${ep.count.toLocaleString()} cards`);
    });

    const targetAchievement = ((stats.totalCards / 7261) * 100).toFixed(1);
    console.log(`\n🎯 TARGET ACHIEVEMENT: ${targetAchievement}% (${stats.totalCards}/7,261)`);

    if (stats.totalCards >= 7261) {
      console.log(`🎉 SUCCESS! Exceeded target of 7,261 cards!`);
    } else if (stats.totalCards >= 5000) {
      console.log(`💪 Strong harvest! Got ${stats.totalCards} cards (${targetAchievement}% of target)`);
    } else {
      console.log(`⚠️ Partial success: ${stats.totalCards} cards captured`);
    }

    // Save report
    const report = {
      harvestSummary: stats,
      pricingAnalysis: priceStats,
      topValueCards: topCards,
      endpointBreakdown: endpointBreakdown,
      targetAchievement: `${targetAchievement}%`,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync('phygitals-mega-harvest-report.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: phygitals-mega-harvest-report.json`);

    return report;
  }

  async runMegaHarvest() {
    console.log('🚀 STARTING PHYGITALS MEGA HARVEST');
    console.log('==================================');

    try {
      let totalHarvested = 0;

      // Harvest from each working endpoint completely
      for (const endpoint of this.workingEndpoints) {
        console.log(`\n🎯 Processing endpoint: ${endpoint}`);
        const harvested = await this.harvestEndpointCompletely(endpoint);
        totalHarvested += harvested;
        
        console.log(`✅ ${endpoint}: ${harvested} items`);
        console.log(`📊 Total so far: ${totalHarvested} items`);

        // Check database size periodically
        const dbSize = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_mega').get().count;
        console.log(`💾 Database contains: ${dbSize.toLocaleString()} unique cards`);

        if (dbSize >= 7261) {
          console.log(`🎉 TARGET ACHIEVED! ${dbSize} >= 7,261 cards`);
          break;
        }
      }

      // Generate final report
      await this.generateMegaReport();

      return { success: true };

    } catch (error) {
      console.error('💥 Mega harvest failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.db.close();
    }
  }
}

// Run the mega harvest
async function main() {
  const harvester = new TargetedPhygitalsMegaHarvester();
  await harvester.runMegaHarvest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TargetedPhygitalsMegaHarvester;
