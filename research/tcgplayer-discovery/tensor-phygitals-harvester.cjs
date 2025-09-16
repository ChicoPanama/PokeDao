/**
 * Tensor Phygitals Harvester
 * Tensor is a major Solana NFT marketplace that aggregates data from multiple sources
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const fs = require('fs');

class TensorPhygitalsHarvester {
  constructor() {
    this.baseURL = 'https://api.tensor.trade';
    this.db = new Database('tensor_phygitals.db');
    this.setupDatabase();
    this.totalProcessed = 0;
    this.errors = [];
    this.sessionId = Date.now();
    
    // Rate limiting
    this.requestDelay = 1000; // 1 second between requests
    this.maxRetries = 3;
    
    // Solana conversion
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
    
    console.log('🚀 TENSOR PHYGITALS HARVESTER');
    console.log('🎯 Target: All Phygitals Pokemon cards from Tensor');
    console.log('📅 Session:', this.sessionId);
  }

  setupDatabase() {
    console.log('🗃️ Setting up Tensor database schema...');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tensor_phygitals (
        id TEXT PRIMARY KEY,
        mint_address TEXT UNIQUE,
        name TEXT,
        description TEXT,
        symbol TEXT,
        collection TEXT,
        collection_name TEXT,
        
        -- Pricing information
        price REAL,
        price_lamports BIGINT,
        usd_price REAL,
        currency TEXT,
        floor_price REAL,
        market_cap REAL,
        volume_24h REAL,
        volume_7d REAL,
        volume_30d REAL,
        
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
        owner_address TEXT,
        seller_address TEXT,
        last_sale_price REAL,
        last_sale_date TEXT,
        num_owners INTEGER,
        num_listed INTEGER,
        
        -- Metadata
        image_url TEXT,
        animation_url TEXT,
        external_url TEXT,
        attributes_json TEXT,
        properties_json TEXT,
        metadata_json TEXT,
        
        -- Timestamps
        created_at TEXT,
        updated_at TEXT,
        listed_at TEXT,
        last_sale_at TEXT,
        
        -- Source tracking
        source_url TEXT,
        tensor_url TEXT,
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
      CREATE INDEX IF NOT EXISTS idx_tensor_name ON tensor_phygitals(name);
      CREATE INDEX IF NOT EXISTS idx_tensor_price ON tensor_phygitals(usd_price);
      CREATE INDEX IF NOT EXISTS idx_tensor_pokemon ON tensor_phygitals(pokemon_name);
      CREATE INDEX IF NOT EXISTS idx_tensor_grader ON tensor_phygitals(grader, grade);
      CREATE INDEX IF NOT EXISTS idx_tensor_set ON tensor_phygitals(set_name);
      CREATE INDEX IF NOT EXISTS idx_tensor_collection ON tensor_phygitals(collection);
      CREATE INDEX IF NOT EXISTS idx_tensor_mint ON tensor_phygitals(mint_address);
      CREATE INDEX IF NOT EXISTS idx_tensor_session ON tensor_phygitals(harvest_session);
      
      -- Sales tracking table
      CREATE TABLE IF NOT EXISTS tensor_sales (
        id TEXT PRIMARY KEY,
        mint_address TEXT,
        sale_price REAL,
        sale_price_lamports BIGINT,
        usd_sale_price REAL,
        buyer_address TEXT,
        seller_address TEXT,
        transaction_signature TEXT,
        sale_date TEXT,
        marketplace_fees REAL,
        harvest_session TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mint_address) REFERENCES tensor_phygitals(mint_address)
      );
      
      -- Collections tracking
      CREATE TABLE IF NOT EXISTS tensor_collections (
        symbol TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        image_url TEXT,
        total_supply INTEGER,
        floor_price REAL,
        volume_24h REAL,
        volume_7d REAL,
        volume_30d REAL,
        market_cap REAL,
        num_owners INTEGER,
        num_listed INTEGER,
        last_updated TEXT,
        harvest_session TEXT
      );
    `);
    
    console.log('✅ Tensor database setup complete');
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
          'Pragma': 'no-cache',
          'Referer': 'https://tensor.trade/',
          'Origin': 'https://tensor.trade'
        },
        timeout: 30000,
        maxRedirects: 5
      });
      
      return response.data;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const waitTime = Math.pow(2, retryCount) * 1000;
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
      /\b(Charizard|Pikachu|Blastoise|Venusaur|Mew|Mewtwo|Lugia|Ho-oh|Rayquaza|Arceus|Dialga|Palkia|Giratina|Reshiram|Zekrom|Kyurem|Xerneas|Yveltal|Zygarde|Solgaleo|Lunala|Necrozma|Zacian|Zamazenta|Eternatus|Alakazam|Machamp|Gengar|Dragonite|Typhlosion|Feraligatr|Ampharos|Espeon|Umbreon|Celebi|Blaziken|Swampert|Sceptile|Gardevoir|Salamence|Metagross|Latios|Latias|Groudon|Kyogre|Deoxys|Garchomp|Lucario|Darkrai|Shaymin|Victini|Serperior|Emboar|Samurott|Zoroark|Greninja|Talonflame|Sylveon|Goodra|Trevenant|Decidueye|Incineroar|Primarina|Lycanroc|Mimikyu|Toxapex|Kommo-o|Tapu|Ultra|Melmetal|Dragapult|Corviknight|Grimmsnarl|Alcremie|Ferrothorn|Rotom)\b/i,
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

  async discoverPhygitalsCollections() {
    console.log('🔍 DISCOVERING PHYGITALS COLLECTIONS ON TENSOR');
    console.log('==============================================');

    try {
      // Search for collections
      const searchUrl = `${this.baseURL}/v1/collections?offset=0&limit=100&sortBy=volume&sortDirection=desc`;
      const data = await this.makeRequest(searchUrl);
      
      const phygitalsCollections = [];
      
      if (data.collections) {
        for (const collection of data.collections) {
          if (collection.name && collection.name.toLowerCase().includes('phygitals')) {
            console.log(`   ✅ Found Phygitals collection: ${collection.name}`);
            phygitalsCollections.push(collection);
          }
        }
      }

      // Also search for Pokemon-related collections
      const pokemonCollections = [];
      for (const collection of data.collections || []) {
        if (collection.name && (
          collection.name.toLowerCase().includes('pokemon') ||
          collection.name.toLowerCase().includes('trading card') ||
          collection.name.toLowerCase().includes('collectible')
        )) {
          console.log(`   🎴 Found Pokemon collection: ${collection.name}`);
          pokemonCollections.push(collection);
        }
      }

      console.log(`\n📊 Discovery Results:`);
      console.log(`   Phygitals collections: ${phygitalsCollections.length}`);
      console.log(`   Pokemon collections: ${pokemonCollections.length}`);

      return [...phygitalsCollections, ...pokemonCollections];

    } catch (error) {
      console.log(`   ❌ Error discovering collections: ${error.message}`);
      return [];
    }
  }

  async harvestCollection(collection) {
    console.log(`\n🚀 HARVESTING COLLECTION: ${collection.name}`);
    console.log(`📊 Symbol: ${collection.symbol}`);

    try {
      // Get collection stats
      const statsUrl = `${this.baseURL}/v1/collections/${collection.symbol}/stats`;
      const stats = await this.makeRequest(statsUrl);
      
      console.log(`   📈 Floor Price: ${stats.floorPrice} SOL`);
      console.log(`   📊 Listed Count: ${stats.listedCount}`);
      console.log(`   👥 Owner Count: ${stats.ownerCount}`);

      // Store collection info
      const collectionStmt = this.db.prepare(`
        INSERT OR REPLACE INTO tensor_collections 
        (symbol, name, description, image_url, total_supply, floor_price, 
         volume_24h, volume_7d, volume_30d, market_cap, num_owners, 
         num_listed, last_updated, harvest_session)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      collectionStmt.run(
        collection.symbol,
        collection.name,
        collection.description || '',
        collection.image || '',
        collection.totalSupply || 0,
        stats.floorPrice || 0,
        stats.volume24h || 0,
        stats.volume7d || 0,
        stats.volume30d || 0,
        stats.marketCap || 0,
        stats.ownerCount || 0,
        stats.listedCount || 0,
        new Date().toISOString(),
        this.sessionId
      );

      // Get all tokens in collection
      let offset = 0;
      const limit = 100;
      let totalHarvested = 0;

      while (offset < 10000) { // Safety limit
        try {
          const tokensUrl = `${this.baseURL}/v1/collections/${collection.symbol}/tokens?offset=${offset}&limit=${limit}`;
          const tokensData = await this.makeRequest(tokensUrl);
          
          if (!tokensData.tokens || tokensData.tokens.length === 0) {
            console.log(`   ✅ No more tokens at offset ${offset}`);
            break;
          }

          console.log(`   📦 Processing ${tokensData.tokens.length} tokens (offset ${offset})...`);

          for (const token of tokensData.tokens) {
            await this.processAndStoreToken(token, collection);
            totalHarvested++;
          }

          offset += limit;
          await this.delay(this.requestDelay);

        } catch (error) {
          console.log(`   ❌ Error at offset ${offset}: ${error.message}`);
          break;
        }
      }

      console.log(`   🏁 Collection complete: ${totalHarvested} tokens harvested`);
      return totalHarvested;

    } catch (error) {
      console.log(`   ❌ Error harvesting collection: ${error.message}`);
      return 0;
    }
  }

  async processAndStoreToken(token, collection) {
    try {
      if (!token.mintAddress) return;

      const cardName = token.name || '';
      const pokemonInfo = this.extractPokemonInfo(cardName);
      
      // Convert pricing
      const priceLamports = token.price || 0;
      const usdPrice = this.convertLamportsToUSD(priceLamports);
      
      // Prepare token data
      const tokenData = [
        token.mintAddress,
        token.mintAddress,
        cardName,
        token.description || '',
        token.symbol || '',
        collection.symbol,
        collection.name,
        
        // Pricing
        priceLamports / this.LAMPORTS_PER_SOL, // SOL price
        priceLamports,
        usdPrice,
        'SOL',
        token.floorPrice || 0,
        token.marketCap || 0,
        token.volume24h || 0,
        token.volume7d || 0,
        token.volume30d || 0,
        
        // Card specifics
        pokemonInfo.setName || '',
        token.attributes?.find(attr => attr.trait_type === 'Card Number')?.value || '',
        token.attributes?.find(attr => attr.trait_type === 'Rarity')?.value || '',
        token.attributes?.find(attr => attr.trait_type === 'Card Type')?.value || '',
        token.attributes?.find(attr => attr.trait_type === 'Language')?.value || 'English',
        token.attributes?.find(attr => attr.trait_type === 'Condition')?.value || '',
        token.attributes?.find(attr => attr.trait_type === 'Grader')?.value || '',
        token.attributes?.find(attr => attr.trait_type === 'Grade')?.value || '',
        token.attributes?.find(attr => attr.trait_type === 'Grade Type')?.value || '',
        token.attributes?.find(attr => attr.trait_type === 'Certification')?.value || '',
        
        // Market data
        token.listed ? 'listed' : 'unlisted',
        token.owner || '',
        token.seller || '',
        token.lastSalePrice || 0,
        token.lastSaleDate || '',
        token.numOwners || 0,
        token.numListed || 0,
        
        // Metadata
        token.image || '',
        token.animationUrl || '',
        token.externalUrl || '',
        JSON.stringify(token.attributes || []),
        JSON.stringify(token.properties || {}),
        JSON.stringify(token),
        
        // Timestamps
        token.createdAt || '',
        token.updatedAt || '',
        token.listedAt || '',
        token.lastSaleAt || '',
        
        // Source tracking
        `https://tensor.trade/item/${token.mintAddress}`,
        `https://tensor.trade/item/${token.mintAddress}`,
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
        INSERT OR REPLACE INTO tensor_phygitals (
          id, mint_address, name, description, symbol, collection, collection_name,
          price, price_lamports, usd_price, currency, floor_price, market_cap,
          volume_24h, volume_7d, volume_30d,
          set_name, card_number, rarity, card_type, language, condition_grade,
          grader, grade, grade_type, certification,
          listing_status, owner_address, seller_address, last_sale_price, last_sale_date,
          num_owners, num_listed,
          image_url, animation_url, external_url, attributes_json, properties_json, metadata_json,
          created_at, updated_at, listed_at, last_sale_at,
          source_url, tensor_url, harvest_session, harvest_timestamp,
          search_terms, pokemon_name, set_year, is_vintage, is_graded,
          is_first_edition, is_shadowless, is_holographic
        ) VALUES (${Array(tokenData.length).fill('?').join(',')})
      `);

      insertStmt.run(tokenData);
      this.totalProcessed++;

      // Progress reporting
      if (this.totalProcessed % 50 === 0) {
        console.log(`     📈 Progress: ${this.totalProcessed} tokens processed...`);
      }

    } catch (error) {
      console.log(`     ⚠️ Error processing token: ${error.message}`);
      this.errors.push({ mintAddress: token.mintAddress, error: error.message });
    }
  }

  async generateReport() {
    console.log('\n📊 GENERATING TENSOR HARVEST REPORT');
    console.log('===================================');

    const stats = {
      totalTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals').get().count,
      tokensWithPrices: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE usd_price > 0').get().count,
      pokemonTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE pokemon_name IS NOT NULL').get().count,
      gradedTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE is_graded = 1').get().count,
      vintageTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE is_vintage = 1').get().count,
      highValueTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE usd_price > 100').get().count
    };

    const priceStats = this.db.prepare(`
      SELECT 
        MIN(usd_price) as min_price,
        MAX(usd_price) as max_price,
        AVG(usd_price) as avg_price,
        COUNT(*) as total_with_prices
      FROM tensor_phygitals 
      WHERE usd_price > 0
    `).get();

    const topTokens = this.db.prepare(`
      SELECT name, usd_price, grader, grade, set_name, pokemon_name
      FROM tensor_phygitals 
      WHERE usd_price > 0 
      ORDER BY usd_price DESC 
      LIMIT 20
    `).all();

    const pokemonBreakdown = this.db.prepare(`
      SELECT pokemon_name, COUNT(*) as count, AVG(usd_price) as avg_price
      FROM tensor_phygitals 
      WHERE pokemon_name IS NOT NULL AND usd_price > 0
      GROUP BY pokemon_name 
      ORDER BY count DESC 
      LIMIT 15
    `).all();

    console.log(`\n🎉 TENSOR HARVEST COMPLETE!`);
    console.log(`===================================`);
    console.log(`📦 Total tokens harvested: ${stats.totalTokens.toLocaleString()}`);
    console.log(`🎴 Pokemon tokens identified: ${stats.pokemonTokens.toLocaleString()}`);
    console.log(`💰 Tokens with pricing: ${stats.tokensWithPrices.toLocaleString()}`);
    console.log(`🏆 Graded tokens: ${stats.gradedTokens.toLocaleString()}`);
    console.log(`⭐ Vintage tokens (≤2003): ${stats.vintageTokens.toLocaleString()}`);
    console.log(`💎 High-value tokens (>$100): ${stats.highValueTokens.toLocaleString()}`);

    console.log(`\n💵 PRICING ANALYSIS:`);
    console.log(`   Min price: $${priceStats.min_price?.toFixed(2) || 0}`);
    console.log(`   Max price: $${priceStats.max_price?.toLocaleString() || 0}`);
    console.log(`   Average price: $${priceStats.avg_price?.toFixed(2) || 0}`);

    console.log(`\n🏆 TOP 10 HIGHEST VALUE TOKENS:`);
    topTokens.slice(0, 10).forEach((token, index) => {
      console.log(`   ${index + 1}. ${token.name} - $${token.usd_price?.toLocaleString()}`);
      if (token.grader && token.grade) {
        console.log(`      🏅 ${token.grader} ${token.grade}`);
      }
    });

    console.log(`\n🎯 POKEMON BREAKDOWN (Top 10):`);
    pokemonBreakdown.slice(0, 10).forEach((pokemon, index) => {
      console.log(`   ${index + 1}. ${pokemon.pokemon_name}: ${pokemon.count} tokens (avg $${pokemon.avg_price?.toFixed(2)})`);
    });

    // Save report
    const report = {
      harvestSummary: {
        sessionId: this.sessionId,
        totalTokens: stats.totalTokens,
        pokemonTokens: stats.pokemonTokens,
        tokensWithPrices: stats.tokensWithPrices,
        gradedTokens: stats.gradedTokens,
        vintageTokens: stats.vintageTokens,
        highValueTokens: stats.highValueTokens,
        errors: this.errors.length,
        harvestTimestamp: new Date().toISOString()
      },
      pricingAnalysis: priceStats,
      topValueTokens: topTokens.slice(0, 20),
      pokemonBreakdown: pokemonBreakdown,
      errors: this.errors.slice(0, 50)
    };

    fs.writeFileSync('tensor-phygitals-harvest.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: tensor-phygitals-harvest.json`);

    return report;
  }

  async runHarvest() {
    console.log('\n🚀 STARTING TENSOR PHYGITALS HARVEST');
    console.log('====================================');

    try {
      // Step 1: Discover Phygitals collections
      const collections = await this.discoverPhygitalsCollections();
      
      if (collections.length === 0) {
        console.log('⚠️ No Phygitals collections found on Tensor');
        return { success: false, error: 'No collections found' };
      }

      // Step 2: Harvest from each collection
      let totalHarvested = 0;
      
      for (const collection of collections) {
        const harvested = await this.harvestCollection(collection);
        totalHarvested += harvested;
        
        console.log(`✅ ${collection.name}: ${harvested} tokens harvested`);
        console.log(`📊 Running total: ${totalHarvested} tokens`);
      }

      // Step 3: Generate report
      const report = await this.generateReport();

      console.log(`\n🎉 SUCCESS! Tensor harvest complete!`);
      console.log(`📊 Total tokens processed: ${this.totalProcessed}`);
      
      return { success: true, report };

    } catch (error) {
      console.error('💥 Tensor harvest failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.db.close();
    }
  }
}

// Execute the harvest
async function main() {
  const harvester = new TensorPhygitalsHarvester();
  await harvester.runHarvest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TensorPhygitalsHarvester;
