/**
 * ENHANCED PHYGITALS HARVESTER V2 
 * Target: Capture ALL 7,261+ cards (not just 1,195)
 * 
 * Issues with previous harvester:
 * 1. Only captured 16.5% of available cards
 * 2. Limited API endpoint discovery
 * 3. Insufficient pagination handling
 * 4. Missing category-specific endpoints
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const fs = require('fs');

class ComprehensivePhygitalsHarvester {
  constructor() {
    this.baseURL = 'https://api.phygitals.com';
    this.db = new Database('phygitals_pokemon_complete_v2.db');
    this.setupDatabase();
    this.totalProcessed = 0;
    this.errors = [];
    this.sessionId = Date.now();
    
    // Enhanced rate limiting
    this.requestDelay = 2000; // 2 seconds between requests
    this.batchSize = 50;
    this.maxRetries = 5;
    
    // Solana conversion
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
    
    console.log('🚀 COMPREHENSIVE PHYGITALS HARVESTER V2');
    console.log('🎯 Target: ALL 7,261+ Pokemon cards');
    console.log('📅 Session:', this.sessionId);
  }

  setupDatabase() {
    console.log('🗃️ Setting up enhanced database schema...');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phygitals_cards_v2 (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        category TEXT,
        subcategory TEXT,
        collection_name TEXT,
        
        -- Pricing information
        price REAL,
        original_price_lamports BIGINT,
        usd_price REAL,
        price_currency TEXT,
        fmv REAL,
        
        -- Card specifics
        set_name TEXT,
        card_number TEXT,
        rarity TEXT,
        card_type TEXT,
        language TEXT,
        condition_grade TEXT,
        grader TEXT,
        grade TEXT,
        grade_type TEXT,
        certification TEXT,
        
        -- Market data
        listing_status TEXT,
        availability TEXT,
        seller_username TEXT,
        seller_address TEXT,
        owner_address TEXT,
        owner_username TEXT,
        
        -- Metadata
        image_url TEXT,
        thumbnail_url TEXT,
        external_links TEXT,
        tags TEXT,
        attributes_json TEXT,
        metadata_json TEXT,
        
        -- Timestamps
        created_at TEXT,
        updated_at TEXT,
        listed_at TEXT,
        last_sale_at TEXT,
        
        -- Source tracking
        source_url TEXT,
        source_page INTEGER,
        source_endpoint TEXT,
        harvest_session TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        
        -- Enhanced search fields
        search_terms TEXT,
        pokemon_name TEXT,
        set_year INTEGER,
        is_vintage BOOLEAN,
        is_graded BOOLEAN,
        is_first_edition BOOLEAN,
        is_shadowless BOOLEAN,
        is_holographic BOOLEAN
      );
      
      -- Comprehensive indexing
      CREATE INDEX IF NOT EXISTS idx_v2_name ON phygitals_cards_v2(name);
      CREATE INDEX IF NOT EXISTS idx_v2_price ON phygitals_cards_v2(usd_price);
      CREATE INDEX IF NOT EXISTS idx_v2_pokemon ON phygitals_cards_v2(pokemon_name);
      CREATE INDEX IF NOT EXISTS idx_v2_grader ON phygitals_cards_v2(grader, grade);
      CREATE INDEX IF NOT EXISTS idx_v2_set ON phygitals_cards_v2(set_name);
      CREATE INDEX IF NOT EXISTS idx_v2_session ON phygitals_cards_v2(harvest_session);
      CREATE INDEX IF NOT EXISTS idx_v2_status ON phygitals_cards_v2(listing_status);
      
      -- Sales tracking table
      CREATE TABLE IF NOT EXISTS phygitals_sales_v2 (
        id TEXT PRIMARY KEY,
        card_id TEXT,
        sale_price REAL,
        sale_price_lamports BIGINT,
        usd_sale_price REAL,
        buyer_address TEXT,
        seller_address TEXT,
        transaction_hash TEXT,
        sale_date TEXT,
        marketplace_fees REAL,
        harvest_session TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (card_id) REFERENCES phygitals_cards_v2(id)
      );
      
      -- API endpoints tracking
      CREATE TABLE IF NOT EXISTS phygitals_endpoints_v2 (
        endpoint TEXT PRIMARY KEY,
        endpoint_type TEXT,
        total_results INTEGER,
        pages_processed INTEGER,
        last_processed TEXT,
        status TEXT,
        harvest_session TEXT
      );
    `);
    
    console.log('✅ Enhanced database setup complete');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(url, retryCount = 0) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 30000,
        maxRedirects: 5
      });
      
      return response.data;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`   ⚠️ Request failed, retrying in ${waitTime/1000}s... (${retryCount + 1}/${this.maxRetries})`);
        await this.delay(waitTime);
        return this.makeRequest(url, retryCount + 1);
      }
      throw error;
    }
  }

  convertLamportsToUSD(lamports) {
    if (!lamports || lamports <= 0) return null;
    const solPrice = lamports / this.LAMPORTS_PER_SOL;
    return Math.round(solPrice * this.SOL_TO_USD * 100) / 100;
  }

  extractPokemonInfo(cardName) {
    const info = {
      pokemonName: null,
      setName: null,
      year: null,
      isVintage: false,
      isGraded: false,
      isFirstEdition: false,
      isShadowless: false,
      isHolographic: false
    };

    if (!cardName) return info;

    // Extract Pokemon name
    const pokemonPatterns = [
      /\b(Charizard|Pikachu|Blastoise|Venusaur|Mew|Mewtwo|Lugia|Ho-oh|Rayquaza|Arceus|Dialga|Palkia|Giratina|Reshiram|Zekrom|Kyurem|Xerneas|Yveltal|Zygarde|Solgaleo|Lunala|Necrozma|Zacian|Zamazenta|Eternatus|Alakazam|Machamp|Gengar|Dragonite|Typhlosion|Feraligatr|Ampharos|Espeon|Umbreon|Celebi|Blaziken|Swampert|Sceptile|Gardevoir|Salamence|Metagross|Latios|Latias|Groudon|Kyogre|Deoxys|Garchomp|Lucario|Darkrai|Shaymin|Victini|Serperior|Emboar|Samurott|Zoroark|Reshiram|Zekrom|Kyurem|Keldeo|Genesect|Greninja|Talonflame|Sylveon|Goodra|Trevenant|Decidueye|Incineroar|Primarina|Lycanroc|Mimikyu|Toxapex|Kommo-o|Tapu|Ultra|Necrozma|Melmetal|Dragapult|Corviknight|Grimmsnarl|Alcremie|Dragapult|Toxapex|Ferrothorn|Rotom)\b/i,
      /\b([A-Z][a-z]+)\s+(?:ex|EX|GX|V|VMAX|VSTAR|Prime|Legend|BREAK)\b/i
    ];

    for (const pattern of pokemonPatterns) {
      const match = cardName.match(pattern);
      if (match) {
        info.pokemonName = match[1].toLowerCase();
        break;
      }
    }

    // Extract year
    const yearMatch = cardName.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      info.year = parseInt(yearMatch[0]);
      info.isVintage = info.year <= 2003;
    }

    // Detect grading
    info.isGraded = /\b(PSA|BGS|CGC|ARS|TAG)\b/i.test(cardName);

    // Detect special characteristics
    info.isFirstEdition = /\b1st\s+edition\b/i.test(cardName);
    info.isShadowless = /\bshadowless\b/i.test(cardName);
    info.isHolographic = /\b(holo|holographic|holofoil)\b/i.test(cardName);

    // Extract set name
    const setPatterns = [
      /\b(base\s+set|jungle|fossil|team\s+rocket|gym|neo|expedition|aquapolis|skyridge|ruby|sapphire|emerald|diamond|pearl|platinum|heartgold|soulsilver|black|white|xy|sun|moon|sword|shield|brilliant|diamond|shining|pearl|lost|origin|astral|radiance|pokemon\s+go|silver\s+tempest|crown\s+zenith|paldea|evolved|obsidian|flames|lost\s+origin|silver\s+tempest|crown\s+zenith|scarlet|violet)\b/i
    ];

    for (const pattern of setPatterns) {
      const match = cardName.match(pattern);
      if (match) {
        info.setName = match[0];
        break;
      }
    }

    return info;
  }

  async discoverAllEndpoints() {
    console.log('🔍 DISCOVERING ALL PHYGITALS API ENDPOINTS');
    console.log('==========================================');

    const endpoints = new Set();
    
    // Core marketplace endpoints
    const coreEndpoints = [
      '/api/marketplace/cards',
      '/api/marketplace/products',
      '/api/marketplace/listings', 
      '/api/marketplace/search',
      '/api/cards',
      '/api/products',
      '/api/collections',
      '/api/nfts',
      '/api/marketplace',
      '/api/search'
    ];

    // Pokemon-specific category endpoints
    const pokemonEndpoints = [
      '/api/marketplace/cards?category=pokemon',
      '/api/marketplace/products?category=pokemon',
      '/api/marketplace/search?query=pokemon',
      '/api/cards?type=pokemon',
      '/api/collections/pokemon',
      '/api/marketplace/cards?collection=pokemon'
    ];

    // Grading company endpoints
    const gradingEndpoints = [
      '/api/marketplace/cards?grader=psa',
      '/api/marketplace/cards?grader=bgs',
      '/api/marketplace/cards?grader=cgc',
      '/api/marketplace/products?certified=true'
    ];

    // Combine all discovered endpoints
    [...coreEndpoints, ...pokemonEndpoints, ...gradingEndpoints].forEach(ep => endpoints.add(ep));

    console.log(`🎯 Testing ${endpoints.size} potential endpoints...`);

    const validEndpoints = [];

    for (const endpoint of endpoints) {
      try {
        const url = `${this.baseURL}${endpoint}`;
        console.log(`   Testing: ${endpoint}`);
        
        const data = await this.makeRequest(url);
        
        if (data && (data.data || data.results || data.cards || data.products)) {
          const count = (data.data?.length || data.results?.length || data.cards?.length || data.products?.length || 0);
          console.log(`   ✅ Valid endpoint: ${endpoint} (${count} items)`);
          
          validEndpoints.push({
            endpoint,
            url,
            itemCount: count,
            totalCount: data.total || data.totalCount || count,
            hasData: count > 0
          });

          // Store endpoint info
          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO phygitals_endpoints_v2 
            (endpoint, endpoint_type, total_results, status, harvest_session)
            VALUES (?, ?, ?, ?, ?)
          `);
          stmt.run(endpoint, 'marketplace', data.total || count, 'discovered', this.sessionId);
        }
        
        await this.delay(this.requestDelay);
        
      } catch (error) {
        console.log(`   ❌ Invalid endpoint: ${endpoint}`);
      }
    }

    console.log(`\n✅ Discovery complete: ${validEndpoints.length} valid endpoints found`);
    return validEndpoints;
  }

  async harvestFromEndpoint(endpointInfo) {
    console.log(`\n🚀 HARVESTING FROM: ${endpointInfo.endpoint}`);
    console.log(`📊 Expected items: ${endpointInfo.totalCount || 'Unknown'}`);

    let page = 1;
    let totalHarvested = 0;
    let hasMorePages = true;

    while (hasMorePages && page <= 500) { // Safety limit
      try {
        const pageUrl = `${endpointInfo.url}${endpointInfo.url.includes('?') ? '&' : '?'}page=${page}&limit=100`;
        console.log(`   📄 Page ${page}: ${pageUrl}`);
        
        const data = await this.makeRequest(pageUrl);
        
        if (!data) {
          console.log(`   ❌ No data received for page ${page}`);
          break;
        }

        // Extract items from various response formats
        const items = data.data || data.results || data.cards || data.products || [];
        
        if (items.length === 0) {
          console.log(`   ✅ No more items on page ${page} - endpoint complete`);
          hasMorePages = false;
          break;
        }

        console.log(`   📦 Processing ${items.length} items...`);

        // Process each item
        for (const item of items) {
          await this.processAndStoreCard(item, endpointInfo.endpoint, page);
          totalHarvested++;
        }

        console.log(`   ✅ Page ${page} complete: ${items.length} items processed`);
        
        // Check if we have more pages
        const hasNext = data.hasNext || 
                       data.hasNextPage || 
                       (data.pagination && data.pagination.hasNext) ||
                       (page * 100 < (data.total || data.totalCount || 0)) ||
                       items.length >= 100;
        
        if (!hasNext) {
          hasMorePages = false;
        }

        page++;
        await this.delay(this.requestDelay);

      } catch (error) {
        console.log(`   ❌ Error on page ${page}: ${error.message}`);
        this.errors.push({ endpoint: endpointInfo.endpoint, page, error: error.message });
        
        if (error.response?.status === 404 || error.response?.status === 429) {
          console.log(`   🛑 Endpoint exhausted or rate limited - moving to next`);
          break;
        }
        
        // Continue to next page on other errors
        page++;
        await this.delay(this.requestDelay * 2);
      }
    }

    console.log(`   🏁 Endpoint complete: ${totalHarvested} items harvested`);

    // Update endpoint status
    const stmt = this.db.prepare(`
      UPDATE phygitals_endpoints_v2 
      SET pages_processed = ?, last_processed = ?, status = ?
      WHERE endpoint = ? AND harvest_session = ?
    `);
    stmt.run(page - 1, new Date().toISOString(), 'completed', endpointInfo.endpoint, this.sessionId);

    return totalHarvested;
  }

  async processAndStoreCard(item, sourceEndpoint, sourcePage) {
    try {
      if (!item.id && !item._id && !item.productId) {
        return; // Skip items without ID
      }

      const cardId = item.id || item._id || item.productId;
      const cardName = item.name || item.title || item.productName || '';
      
      // Extract Pokemon information
      const pokemonInfo = this.extractPokemonInfo(cardName);
      
      // Convert pricing
      const originalPrice = item.price || item.listPrice || item.currentPrice || 0;
      const usdPrice = this.convertLamportsToUSD(originalPrice);
      
      // Prepare card data
      const cardData = [
        cardId,
        cardName,
        item.description || '',
        item.category || '',
        item.subcategory || '',
        item.collection?.name || item.collectionName || '',
        
        // Pricing
        originalPrice,
        originalPrice,
        usdPrice,
        'SOL',
        item.fmv || item.estimatedValue || usdPrice,
        
        // Card specifics
        item.set?.name || item.setName || pokemonInfo.setName || '',
        item.cardNumber || item.number || '',
        item.rarity || '',
        item.cardType || item.type || '',
        item.language || 'English',
        item.condition || '',
        item.grader || '',
        item.grade || '',
        item.gradeType || '',
        item.certification || '',
        
        // Market data
        item.status || item.listingStatus || 'unknown',
        item.availability || '',
        item.seller?.username || item.sellerUsername || '',
        item.seller?.address || item.sellerAddress || '',
        item.owner?.address || item.ownerAddress || '',
        item.owner?.username || item.ownerUsername || '',
        
        // Metadata
        item.image || item.imageUrl || item.thumbnail || '',
        item.thumbnail || item.thumbnailUrl || '',
        JSON.stringify(item.externalLinks || {}),
        JSON.stringify(item.tags || []),
        JSON.stringify(item.attributes || {}),
        JSON.stringify(item),
        
        // Timestamps
        item.createdAt || item.created || '',
        item.updatedAt || item.updated || '',
        item.listedAt || item.listed || '',
        item.lastSaleAt || '',
        
        // Source tracking
        `https://www.phygitals.com/card/${cardId}`,
        sourcePage,
        sourceEndpoint,
        this.sessionId,
        new Date().toISOString(),
        
        // Enhanced search fields
        cardName.toLowerCase(),
        pokemonInfo.pokemonName,
        pokemonInfo.year,
        pokemonInfo.isVintage ? 1 : 0,
        pokemonInfo.isGraded ? 1 : 0,
        pokemonInfo.isFirstEdition ? 1 : 0,
        pokemonInfo.isShadowless ? 1 : 0,
        pokemonInfo.isHolographic ? 1 : 0
      ];

      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO phygitals_cards_v2 (
          id, name, description, category, subcategory, collection_name,
          price, original_price_lamports, usd_price, price_currency, fmv,
          set_name, card_number, rarity, card_type, language, condition_grade,
          grader, grade, grade_type, certification,
          listing_status, availability, seller_username, seller_address,
          owner_address, owner_username,
          image_url, thumbnail_url, external_links, tags, attributes_json, metadata_json,
          created_at, updated_at, listed_at, last_sale_at,
          source_url, source_page, source_endpoint, harvest_session, harvest_timestamp,
          search_terms, pokemon_name, set_year, is_vintage, is_graded,
          is_first_edition, is_shadowless, is_holographic
        ) VALUES (${Array(cardData.length).fill('?').join(',')})
      `);

      insertStmt.run(cardData);
      this.totalProcessed++;

      // Progress reporting
      if (this.totalProcessed % 100 === 0) {
        console.log(`     📈 Progress: ${this.totalProcessed} cards processed...`);
      }

    } catch (error) {
      console.log(`     ⚠️ Error processing card: ${error.message}`);
      this.errors.push({ cardId: item.id, error: error.message });
    }
  }

  async generateComprehensiveReport() {
    console.log('\n📊 GENERATING COMPREHENSIVE HARVEST REPORT');
    console.log('==========================================');

    const stats = {
      totalCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards_v2').get().count,
      cardsWithPrices: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards_v2 WHERE usd_price > 0').get().count,
      pokemonCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards_v2 WHERE pokemon_name IS NOT NULL').get().count,
      gradedCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards_v2 WHERE is_graded = 1').get().count,
      vintageCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards_v2 WHERE is_vintage = 1').get().count,
      highValueCards: this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards_v2 WHERE usd_price > 100').get().count
    };

    const priceStats = this.db.prepare(`
      SELECT 
        MIN(usd_price) as min_price,
        MAX(usd_price) as max_price,
        AVG(usd_price) as avg_price,
        COUNT(*) as total_with_prices
      FROM phygitals_cards_v2 
      WHERE usd_price > 0
    `).get();

    const topCards = this.db.prepare(`
      SELECT name, usd_price, grader, grade, set_name, pokemon_name
      FROM phygitals_cards_v2 
      WHERE usd_price > 0 
      ORDER BY usd_price DESC 
      LIMIT 20
    `).all();

    const pokemonBreakdown = this.db.prepare(`
      SELECT pokemon_name, COUNT(*) as count, AVG(usd_price) as avg_price
      FROM phygitals_cards_v2 
      WHERE pokemon_name IS NOT NULL AND usd_price > 0
      GROUP BY pokemon_name 
      ORDER BY count DESC 
      LIMIT 15
    `).all();

    const endpointStats = this.db.prepare(`
      SELECT source_endpoint, COUNT(*) as cards_harvested
      FROM phygitals_cards_v2 
      GROUP BY source_endpoint 
      ORDER BY cards_harvested DESC
    `).all();

    console.log(`\n🎉 COMPREHENSIVE HARVEST COMPLETE!`);
    console.log(`===================================`);
    console.log(`📦 Total cards harvested: ${stats.totalCards.toLocaleString()}`);
    console.log(`🎴 Pokemon cards identified: ${stats.pokemonCards.toLocaleString()}`);
    console.log(`💰 Cards with pricing: ${stats.cardsWithPrices.toLocaleString()}`);
    console.log(`🏆 Graded cards: ${stats.gradedCards.toLocaleString()}`);
    console.log(`⭐ Vintage cards (≤2003): ${stats.vintageCards.toLocaleString()}`);
    console.log(`💎 High-value cards (>$100): ${stats.highValueCards.toLocaleString()}`);

    console.log(`\n💵 PRICING ANALYSIS:`);
    console.log(`   Min price: $${priceStats.min_price?.toFixed(2) || 0}`);
    console.log(`   Max price: $${priceStats.max_price?.toLocaleString() || 0}`);
    console.log(`   Average price: $${priceStats.avg_price?.toFixed(2) || 0}`);

    console.log(`\n🏆 TOP 10 HIGHEST VALUE CARDS:`);
    topCards.slice(0, 10).forEach((card, index) => {
      console.log(`   ${index + 1}. ${card.name} - $${card.usd_price?.toLocaleString()}`);
      if (card.grader && card.grade) {
        console.log(`      🏅 ${card.grader} ${card.grade}`);
      }
    });

    console.log(`\n🎯 POKEMON BREAKDOWN (Top 10):`);
    pokemonBreakdown.slice(0, 10).forEach((pokemon, index) => {
      console.log(`   ${index + 1}. ${pokemon.pokemon_name}: ${pokemon.count} cards (avg $${pokemon.avg_price?.toFixed(2)})`);
    });

    console.log(`\n📊 HARVEST SOURCE BREAKDOWN:`);
    endpointStats.forEach((endpoint, index) => {
      console.log(`   ${index + 1}. ${endpoint.source_endpoint}: ${endpoint.cards_harvested.toLocaleString()} cards`);
    });

    if (this.errors.length > 0) {
      console.log(`\n⚠️ ERRORS ENCOUNTERED: ${this.errors.length}`);
      console.log(`   (See error log for details)`);
    }

    // Save comprehensive report
    const report = {
      harvestSummary: {
        sessionId: this.sessionId,
        totalCards: stats.totalCards,
        pokemonCards: stats.pokemonCards,
        cardsWithPrices: stats.cardsWithPrices,
        gradedCards: stats.gradedCards,
        vintageCards: stats.vintageCards,
        highValueCards: stats.highValueCards,
        errors: this.errors.length,
        harvestTimestamp: new Date().toISOString()
      },
      pricingAnalysis: priceStats,
      topValueCards: topCards.slice(0, 20),
      pokemonBreakdown: pokemonBreakdown,
      sourceBreakdown: endpointStats,
      errors: this.errors.slice(0, 50) // Limit error details
    };

    fs.writeFileSync('comprehensive-phygitals-harvest-v2.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: comprehensive-phygitals-harvest-v2.json`);

    return report;
  }

  async runComprehensiveHarvest() {
    console.log('\n🚀 STARTING COMPREHENSIVE PHYGITALS HARVEST');
    console.log('============================================');

    try {
      // Step 1: Discover all endpoints
      const endpoints = await this.discoverAllEndpoints();
      
      if (endpoints.length === 0) {
        throw new Error('No valid endpoints discovered');
      }

      // Step 2: Harvest from each endpoint
      let totalHarvested = 0;
      
      for (const endpoint of endpoints) {
        if (endpoint.hasData) {
          const harvested = await this.harvestFromEndpoint(endpoint);
          totalHarvested += harvested;
          
          console.log(`✅ ${endpoint.endpoint}: ${harvested} items harvested`);
          console.log(`📊 Running total: ${totalHarvested} items`);
        }
      }

      // Step 3: Generate comprehensive report
      const report = await this.generateComprehensiveReport();

      console.log(`\n🎉 SUCCESS! Comprehensive harvest complete!`);
      console.log(`📊 Total items processed: ${this.totalProcessed}`);
      console.log(`🎯 Target was 7,261+ cards - achieved ${report.harvestSummary.totalCards}!`);
      
      return { success: true, report };

    } catch (error) {
      console.error('💥 Comprehensive harvest failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.db.close();
    }
  }
}

// Execute the comprehensive harvest
async function main() {
  const harvester = new ComprehensivePhygitalsHarvester();
  await harvester.runComprehensiveHarvest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ComprehensivePhygitalsHarvester;
