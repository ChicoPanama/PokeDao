/**
 * Tensor + Solana Blockchain Phygitals Harvester
 * Uses correct Tensor API endpoints and direct Solana blockchain access
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const fs = require('fs');

class TensorSolanaPhygitalsHarvester {
  constructor() {
    // Correct Tensor API endpoints
    this.tensorBaseURL = 'https://api.tensor.so';
    this.solanaRPC = 'https://api.mainnet-beta.solana.com';
    
    this.db = new Database('tensor_solana_phygitals.db');
    this.setupDatabase();
    this.totalProcessed = 0;
    this.errors = [];
    this.sessionId = Date.now();
    
    // Rate limiting
    this.requestDelay = 1000;
    this.maxRetries = 3;
    
    // Solana conversion
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
    
    // Metaplex program IDs
    this.METAPLEX_METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
    this.METAPLEX_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    
    console.log('🚀 TENSOR + SOLANA PHYGITALS HARVESTER');
    console.log('🎯 Target: Phygitals data from Tensor API + Solana blockchain');
    console.log('📅 Session:', this.sessionId);
  }

  setupDatabase() {
    console.log('🗃️ Setting up Tensor + Solana database schema...');
    
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
        is_holographic BOOLEAN,
        
        -- Data source
        data_source TEXT -- 'tensor' or 'solana'
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
      CREATE INDEX IF NOT EXISTS idx_tensor_source ON tensor_phygitals(data_source);
      
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
        harvest_session TEXT,
        data_source TEXT
      );
      
      -- Solana blockchain metadata
      CREATE TABLE IF NOT EXISTS solana_metadata (
        mint_address TEXT PRIMARY KEY,
        name TEXT,
        symbol TEXT,
        description TEXT,
        image TEXT,
        external_url TEXT,
        attributes_json TEXT,
        collection_key TEXT,
        update_authority TEXT,
        metadata_uri TEXT,
        harvest_session TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Tensor + Solana database setup complete');
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

  async makeSolanaRPCRequest(method, params = []) {
    try {
      const response = await axios.post(this.solanaRPC, {
        jsonrpc: '2.0',
        id: 1,
        method: method,
        params: params
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      return response.data;
    } catch (error) {
      console.log(`   ❌ Solana RPC error: ${error.message}`);
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

  async discoverTensorCollections() {
    console.log('🔍 DISCOVERING COLLECTIONS ON TENSOR (CORRECT API)');
    console.log('=================================================');

    try {
      // Use correct Tensor API endpoint
      const collectionsUrl = `${this.tensorBaseURL}/sol/collections`;
      console.log(`   📡 Requesting: ${collectionsUrl}`);
      
      const data = await this.makeRequest(collectionsUrl);
      
      const phygitalsCollections = [];
      
      if (data && Array.isArray(data)) {
        for (const collection of data) {
          if (collection.name && (
            collection.name.toLowerCase().includes('phygitals') ||
            collection.name.toLowerCase().includes('pokemon') ||
            collection.name.toLowerCase().includes('trading card')
          )) {
            console.log(`   ✅ Found collection: ${collection.name}`);
            phygitalsCollections.push(collection);
          }
        }
      }

      console.log(`\n📊 Tensor Discovery Results:`);
      console.log(`   Total collections found: ${data ? data.length : 0}`);
      console.log(`   Phygitals/Pokemon collections: ${phygitalsCollections.length}`);

      return phygitalsCollections;

    } catch (error) {
      console.log(`   ❌ Error discovering Tensor collections: ${error.message}`);
      return [];
    }
  }

  async searchSolanaBlockchain() {
    console.log('\n🔍 SEARCHING SOLANA BLOCKCHAIN FOR PHYGITALS');
    console.log('============================================');

    try {
      // Search for Metaplex metadata accounts
      console.log('   📡 Querying Metaplex Metadata Program...');
      
      const metadataAccounts = await this.makeSolanaRPCRequest('getProgramAccounts', [
        this.METAPLEX_METADATA_PROGRAM,
        {
          encoding: 'jsonParsed',
          filters: [
            {
              dataSize: 679 // Standard metadata account size
            }
          ]
        }
      ]);

      console.log(`   📊 Found ${metadataAccounts.result ? metadataAccounts.result.length : 0} metadata accounts`);

      if (metadataAccounts.result && metadataAccounts.result.length > 0) {
        // Filter for Phygitals-related metadata
        const phygitalsMetadata = [];
        
        for (const account of metadataAccounts.result.slice(0, 100)) { // Limit to first 100 for testing
          try {
            const accountInfo = account.account.data.parsed.info;
            if (accountInfo && accountInfo.name) {
              const name = accountInfo.name.toLowerCase();
              if (name.includes('phygitals') || name.includes('pokemon') || name.includes('trading card')) {
                console.log(`   ✅ Found Phygitals metadata: ${accountInfo.name}`);
                phygitalsMetadata.push({
                  mint: accountInfo.mint,
                  name: accountInfo.name,
                  symbol: accountInfo.symbol,
                  description: accountInfo.description,
                  image: accountInfo.image,
                  external_url: accountInfo.external_url,
                  attributes: accountInfo.attributes || [],
                  collection: accountInfo.collection
                });
              }
            }
          } catch (error) {
            // Skip invalid accounts
          }
        }

        console.log(`   🎯 Phygitals metadata found: ${phygitalsMetadata.length}`);
        return phygitalsMetadata;
      }

      return [];

    } catch (error) {
      console.log(`   ❌ Error searching Solana blockchain: ${error.message}`);
      return [];
    }
  }

  async processTensorCollection(collection) {
    console.log(`\n🚀 PROCESSING TENSOR COLLECTION: ${collection.name}`);
    
    try {
      // Get collection details
      const collectionUrl = `${this.tensorBaseURL}/sol/collections/${collection.symbol}`;
      const collectionData = await this.makeRequest(collectionUrl);
      
      console.log(`   📊 Collection data retrieved`);
      
      // Store collection info
      const collectionStmt = this.db.prepare(`
        INSERT OR REPLACE INTO tensor_collections 
        (symbol, name, description, image_url, total_supply, floor_price, 
         volume_24h, volume_7d, volume_30d, market_cap, num_owners, 
         num_listed, last_updated, harvest_session, data_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      collectionStmt.run(
        collection.symbol,
        collection.name,
        collection.description || '',
        collection.image || '',
        collection.totalSupply || 0,
        collection.floorPrice || 0,
        collection.volume24h || 0,
        collection.volume7d || 0,
        collection.volume30d || 0,
        collection.marketCap || 0,
        collection.ownerCount || 0,
        collection.listedCount || 0,
        new Date().toISOString(),
        this.sessionId,
        'tensor'
      );

      return true;

    } catch (error) {
      console.log(`   ❌ Error processing Tensor collection: ${error.message}`);
      return false;
    }
  }

  async processSolanaMetadata(metadata) {
    console.log(`\n🚀 PROCESSING SOLANA METADATA: ${metadata.name}`);
    
    try {
      const pokemonInfo = this.extractPokemonInfo(metadata.name);
      
      // Store metadata
      const metadataStmt = this.db.prepare(`
        INSERT OR REPLACE INTO solana_metadata 
        (mint_address, name, symbol, description, image, external_url, 
         attributes_json, collection_key, update_authority, metadata_uri, 
         harvest_session)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      metadataStmt.run(
        metadata.mint,
        metadata.name,
        metadata.symbol || '',
        metadata.description || '',
        metadata.image || '',
        metadata.external_url || '',
        JSON.stringify(metadata.attributes),
        metadata.collection ? metadata.collection.key : '',
        metadata.collection ? metadata.collection.updateAuthority : '',
        metadata.external_url || '',
        this.sessionId
      );

      // Also store in main table
      const mainStmt = this.db.prepare(`
        INSERT OR REPLACE INTO tensor_phygitals 
        (id, mint_address, name, description, symbol, collection, collection_name,
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
         is_first_edition, is_shadowless, is_holographic, data_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const tokenData = [
        metadata.mint,
        metadata.mint,
        metadata.name,
        metadata.description || '',
        metadata.symbol || '',
        metadata.collection ? metadata.collection.key : '',
        metadata.collection ? metadata.collection.name : '',
        
        // Pricing (unknown from metadata)
        0, 0, 0, 'SOL', 0, 0, 0, 0, 0,
        
        // Card specifics
        pokemonInfo.setName || '',
        '', '', '', 'English', '', '', '', '', '',
        
        // Market data
        'unknown', '', '', 0, '', 0, 0,
        
        // Metadata
        metadata.image || '',
        '', metadata.external_url || '',
        JSON.stringify(metadata.attributes),
        '{}',
        JSON.stringify(metadata),
        
        // Timestamps
        '', '', '', '',
        
        // Source tracking
        metadata.external_url || '',
        `https://tensor.trade/item/${metadata.mint}`,
        this.sessionId,
        new Date().toISOString(),
        
        // Enhanced search fields
        metadata.name.toLowerCase(),
        pokemonInfo.pokemonName,
        pokemonInfo.year,
        pokemonInfo.isVintage ? 1 : 0,
        pokemonInfo.isGraded ? 1 : 0,
        pokemonInfo.isFirstEdition ? 1 : 0,
        pokemonInfo.isShadowless ? 1 : 0,
        pokemonInfo.isHolographic ? 1 : 0,
        'solana'
      ];

      mainStmt.run(tokenData);
      this.totalProcessed++;

      console.log(`   ✅ Metadata processed: ${metadata.name}`);
      return true;

    } catch (error) {
      console.log(`   ❌ Error processing Solana metadata: ${error.message}`);
      return false;
    }
  }

  async generateReport() {
    console.log('\n📊 GENERATING TENSOR + SOLANA HARVEST REPORT');
    console.log('============================================');

    const stats = {
      totalTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals').get().count,
      tensorTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE data_source = ?').get('tensor').count,
      solanaTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE data_source = ?').get('solana').count,
      pokemonTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE pokemon_name IS NOT NULL').get().count,
      gradedTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE is_graded = 1').get().count,
      vintageTokens: this.db.prepare('SELECT COUNT(*) as count FROM tensor_phygitals WHERE is_vintage = 1').get().count
    };

    const topTokens = this.db.prepare(`
      SELECT name, usd_price, grader, grade, set_name, pokemon_name, data_source
      FROM tensor_phygitals 
      ORDER BY usd_price DESC 
      LIMIT 20
    `).all();

    const pokemonBreakdown = this.db.prepare(`
      SELECT pokemon_name, COUNT(*) as count, data_source
      FROM tensor_phygitals 
      WHERE pokemon_name IS NOT NULL
      GROUP BY pokemon_name, data_source
      ORDER BY count DESC 
      LIMIT 15
    `).all();

    console.log(`\n🎉 TENSOR + SOLANA HARVEST COMPLETE!`);
    console.log(`===================================`);
    console.log(`📦 Total tokens harvested: ${stats.totalTokens.toLocaleString()}`);
    console.log(`🎯 Tensor tokens: ${stats.tensorTokens.toLocaleString()}`);
    console.log(`⛓️ Solana blockchain tokens: ${stats.solanaTokens.toLocaleString()}`);
    console.log(`🎴 Pokemon tokens identified: ${stats.pokemonTokens.toLocaleString()}`);
    console.log(`🏆 Graded tokens: ${stats.gradedTokens.toLocaleString()}`);
    console.log(`⭐ Vintage tokens (≤2003): ${stats.vintageTokens.toLocaleString()}`);

    console.log(`\n🏆 TOP 10 TOKENS BY SOURCE:`);
    topTokens.slice(0, 10).forEach((token, index) => {
      console.log(`   ${index + 1}. ${token.name} [${token.data_source}]`);
      if (token.grader && token.grade) {
        console.log(`      🏅 ${token.grader} ${token.grade}`);
      }
    });

    console.log(`\n🎯 POKEMON BREAKDOWN BY SOURCE:`);
    pokemonBreakdown.slice(0, 10).forEach((pokemon, index) => {
      console.log(`   ${index + 1}. ${pokemon.pokemon_name}: ${pokemon.count} tokens [${pokemon.data_source}]`);
    });

    // Save report
    const report = {
      harvestSummary: {
        sessionId: this.sessionId,
        totalTokens: stats.totalTokens,
        tensorTokens: stats.tensorTokens,
        solanaTokens: stats.solanaTokens,
        pokemonTokens: stats.pokemonTokens,
        gradedTokens: stats.gradedTokens,
        vintageTokens: stats.vintageTokens,
        errors: this.errors.length,
        harvestTimestamp: new Date().toISOString()
      },
      topTokens: topTokens,
      pokemonBreakdown: pokemonBreakdown,
      errors: this.errors.slice(0, 50)
    };

    fs.writeFileSync('tensor-solana-phygitals-harvest.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: tensor-solana-phygitals-harvest.json`);

    return report;
  }

  async runHarvest() {
    console.log('\n🚀 STARTING TENSOR + SOLANA PHYGITALS HARVEST');
    console.log('=============================================');

    try {
      // Step 1: Try Tensor API
      console.log('\n📡 PHASE 1: TENSOR API HARVEST');
      const tensorCollections = await this.discoverTensorCollections();
      
      if (tensorCollections.length > 0) {
        for (const collection of tensorCollections) {
          await this.processTensorCollection(collection);
        }
      } else {
        console.log('   ⚠️ No Tensor collections found');
      }

      // Step 2: Search Solana blockchain
      console.log('\n⛓️ PHASE 2: SOLANA BLOCKCHAIN SEARCH');
      const solanaMetadata = await this.searchSolanaBlockchain();
      
      if (solanaMetadata.length > 0) {
        for (const metadata of solanaMetadata) {
          await this.processSolanaMetadata(metadata);
        }
      } else {
        console.log('   ⚠️ No Solana metadata found');
      }

      // Step 3: Generate report
      const report = await this.generateReport();

      console.log(`\n🎉 SUCCESS! Tensor + Solana harvest complete!`);
      console.log(`📊 Total tokens processed: ${this.totalProcessed}`);
      
      return { success: true, report };

    } catch (error) {
      console.error('💥 Tensor + Solana harvest failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.db.close();
    }
  }
}

// Execute the harvest
async function main() {
  const harvester = new TensorSolanaPhygitalsHarvester();
  await harvester.runHarvest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TensorSolanaPhygitalsHarvester;
