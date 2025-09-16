/**
 * Direct Solana Blockchain Phygitals Harvester
 * Uses public Solana RPC endpoints to find Phygitals metadata
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const fs = require('fs');

class SolanaDirectPhygitalsHarvester {
  constructor() {
    // Multiple public Solana RPC endpoints for redundancy
    this.rpcEndpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana',
      'https://solana-mainnet.g.alchemy.com/v2/demo'
    ];
    this.currentRpcIndex = 0;
    
    this.db = new Database('solana_direct_phygitals.db');
    this.setupDatabase();
    this.totalProcessed = 0;
    this.errors = [];
    this.sessionId = Date.now();
    
    // Rate limiting
    this.requestDelay = 2000; // 2 seconds between requests
    this.maxRetries = 3;
    
    // Metaplex program IDs
    this.METAPLEX_METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
    this.METAPLEX_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    
    console.log('🚀 SOLANA DIRECT PHYGITALS HARVESTER');
    console.log('🎯 Target: Phygitals metadata directly from Solana blockchain');
    console.log('📅 Session:', this.sessionId);
  }

  setupDatabase() {
    console.log('🗃️ Setting up Solana direct database schema...');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS solana_phygitals (
        id TEXT PRIMARY KEY,
        mint_address TEXT UNIQUE,
        name TEXT,
        symbol TEXT,
        description TEXT,
        image TEXT,
        external_url TEXT,
        attributes_json TEXT,
        collection_key TEXT,
        update_authority TEXT,
        metadata_uri TEXT,
        creator_addresses TEXT,
        verified_creators TEXT,
        seller_fee_basis_points INTEGER,
        primary_sale_happened BOOLEAN,
        is_mutable BOOLEAN,
        
        -- Enhanced fields
        pokemon_name TEXT,
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
        set_year INTEGER,
        is_vintage BOOLEAN,
        is_graded BOOLEAN,
        is_first_edition BOOLEAN,
        is_shadowless BOOLEAN,
        is_holographic BOOLEAN,
        
        -- Timestamps
        created_at TEXT,
        updated_at TEXT,
        harvest_session TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Indexing
      CREATE INDEX IF NOT EXISTS idx_solana_name ON solana_phygitals(name);
      CREATE INDEX IF NOT EXISTS idx_solana_pokemon ON solana_phygitals(pokemon_name);
      CREATE INDEX IF NOT EXISTS idx_solana_grader ON solana_phygitals(grader, grade);
      CREATE INDEX IF NOT EXISTS idx_solana_set ON solana_phygitals(set_name);
      CREATE INDEX IF NOT EXISTS idx_solana_mint ON solana_phygitals(mint_address);
      CREATE INDEX IF NOT EXISTS idx_solana_session ON solana_phygitals(harvest_session);
      
      -- Collections tracking
      CREATE TABLE IF NOT EXISTS solana_collections (
        collection_key TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        image TEXT,
        update_authority TEXT,
        verified BOOLEAN,
        total_supply INTEGER,
        harvest_session TEXT,
        harvest_timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Solana direct database setup complete');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeSolanaRPCRequest(method, params = []) {
    const rpcUrl = this.rpcEndpoints[this.currentRpcIndex];
    
    try {
      console.log(`   📡 Using RPC: ${rpcUrl}`);
      
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: method,
        params: params
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      });
      
      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }
      
      return response.data;
    } catch (error) {
      console.log(`   ⚠️ RPC ${this.currentRpcIndex + 1} failed: ${error.message}`);
      
      // Try next RPC endpoint
      this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcEndpoints.length;
      
      if (this.currentRpcIndex === 0) {
        throw new Error('All RPC endpoints failed');
      }
      
      console.log(`   🔄 Switching to RPC ${this.currentRpcIndex + 1}...`);
      await this.delay(2000);
      return this.makeSolanaRPCRequest(method, params);
    }
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

  async searchForPhygitalsCollections() {
    console.log('🔍 SEARCHING FOR PHYGITALS COLLECTIONS ON SOLANA');
    console.log('===============================================');

    try {
      // First, let's try to get some metadata accounts
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
        // Process first 50 accounts to find Phygitals
        const phygitalsMetadata = [];
        const processedCount = Math.min(50, metadataAccounts.result.length);
        
        console.log(`   🔍 Processing first ${processedCount} accounts for Phygitals...`);
        
        for (let i = 0; i < processedCount; i++) {
          const account = metadataAccounts.result[i];
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
                  collection: accountInfo.collection,
                  creators: accountInfo.creators || [],
                  seller_fee_basis_points: accountInfo.seller_fee_basis_points,
                  primary_sale_happened: accountInfo.primary_sale_happened,
                  is_mutable: accountInfo.is_mutable
                });
              }
            }
          } catch (error) {
            // Skip invalid accounts
          }
          
          // Progress reporting
          if ((i + 1) % 10 === 0) {
            console.log(`     📈 Processed ${i + 1}/${processedCount} accounts...`);
          }
        }

        console.log(`   🎯 Phygitals metadata found: ${phygitalsMetadata.length}`);
        return phygitalsMetadata;
      }

      return [];

    } catch (error) {
      console.log(`   ❌ Error searching for Phygitals collections: ${error.message}`);
      return [];
    }
  }

  async processPhygitalsMetadata(metadata) {
    console.log(`\n🚀 PROCESSING PHYGITALS METADATA: ${metadata.name}`);
    
    try {
      const pokemonInfo = this.extractPokemonInfo(metadata.name);
      
      // Store metadata
      const metadataStmt = this.db.prepare(`
        INSERT OR REPLACE INTO solana_phygitals 
        (id, mint_address, name, symbol, description, image, external_url, 
         attributes_json, collection_key, update_authority, metadata_uri,
         creator_addresses, verified_creators, seller_fee_basis_points,
         primary_sale_happened, is_mutable,
         pokemon_name, set_name, card_number, rarity, card_type, language,
         condition_grade, grader, grade, grade_type, certification,
         set_year, is_vintage, is_graded, is_first_edition, is_shadowless, is_holographic,
         created_at, updated_at, harvest_session)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      metadataStmt.run(
        metadata.mint,
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
        JSON.stringify(metadata.creators.map(c => c.address)),
        JSON.stringify(metadata.creators.filter(c => c.verified).map(c => c.address)),
        metadata.seller_fee_basis_points || 0,
        metadata.primary_sale_happened || false,
        metadata.is_mutable || false,
        
        // Enhanced fields
        pokemonInfo.pokemonName,
        pokemonInfo.setName || '',
        '', '', '', 'English', '', '', '', '', '',
        pokemonInfo.year,
        pokemonInfo.isVintage ? 1 : 0,
        pokemonInfo.isGraded ? 1 : 0,
        pokemonInfo.isFirstEdition ? 1 : 0,
        pokemonInfo.isShadowless ? 1 : 0,
        pokemonInfo.isHolographic ? 1 : 0,
        
        // Timestamps
        new Date().toISOString(),
        new Date().toISOString(),
        this.sessionId
      );

      this.totalProcessed++;

      console.log(`   ✅ Metadata processed: ${metadata.name}`);
      return true;

    } catch (error) {
      console.log(`   ❌ Error processing Phygitals metadata: ${error.message}`);
      return false;
    }
  }

  async generateReport() {
    console.log('\n📊 GENERATING SOLANA DIRECT HARVEST REPORT');
    console.log('==========================================');

    const stats = {
      totalTokens: this.db.prepare('SELECT COUNT(*) as count FROM solana_phygitals').get().count,
      pokemonTokens: this.db.prepare('SELECT COUNT(*) as count FROM solana_phygitals WHERE pokemon_name IS NOT NULL').get().count,
      gradedTokens: this.db.prepare('SELECT COUNT(*) as count FROM solana_phygitals WHERE is_graded = 1').get().count,
      vintageTokens: this.db.prepare('SELECT COUNT(*) as count FROM solana_phygitals WHERE is_vintage = 1').get().count,
      phygitalsTokens: this.db.prepare('SELECT COUNT(*) as count FROM solana_phygitals WHERE name LIKE ?').get('%phygitals%').count
    };

    const topTokens = this.db.prepare(`
      SELECT name, symbol, pokemon_name, grader, grade, set_name, mint_address
      FROM solana_phygitals 
      ORDER BY name
      LIMIT 20
    `).all();

    const pokemonBreakdown = this.db.prepare(`
      SELECT pokemon_name, COUNT(*) as count
      FROM solana_phygitals 
      WHERE pokemon_name IS NOT NULL
      GROUP BY pokemon_name
      ORDER BY count DESC 
      LIMIT 15
    `).all();

    console.log(`\n🎉 SOLANA DIRECT HARVEST COMPLETE!`);
    console.log(`===================================`);
    console.log(`📦 Total tokens harvested: ${stats.totalTokens.toLocaleString()}`);
    console.log(`🎴 Pokemon tokens identified: ${stats.pokemonTokens.toLocaleString()}`);
    console.log(`🏆 Graded tokens: ${stats.gradedTokens.toLocaleString()}`);
    console.log(`⭐ Vintage tokens (≤2003): ${stats.vintageTokens.toLocaleString()}`);
    console.log(`🎯 Phygitals-specific tokens: ${stats.phygitalsTokens.toLocaleString()}`);

    console.log(`\n🏆 TOP 20 TOKENS FOUND:`);
    topTokens.forEach((token, index) => {
      console.log(`   ${index + 1}. ${token.name}`);
      if (token.pokemon_name) {
        console.log(`      🎴 Pokemon: ${token.pokemon_name}`);
      }
      if (token.grader && token.grade) {
        console.log(`      🏅 ${token.grader} ${token.grade}`);
      }
    });

    if (pokemonBreakdown.length > 0) {
      console.log(`\n🎯 POKEMON BREAKDOWN:`);
      pokemonBreakdown.forEach((pokemon, index) => {
        console.log(`   ${index + 1}. ${pokemon.pokemon_name}: ${pokemon.count} tokens`);
      });
    }

    // Save report
    const report = {
      harvestSummary: {
        sessionId: this.sessionId,
        totalTokens: stats.totalTokens,
        pokemonTokens: stats.pokemonTokens,
        gradedTokens: stats.gradedTokens,
        vintageTokens: stats.vintageTokens,
        phygitalsTokens: stats.phygitalsTokens,
        errors: this.errors.length,
        harvestTimestamp: new Date().toISOString()
      },
      topTokens: topTokens,
      pokemonBreakdown: pokemonBreakdown,
      errors: this.errors.slice(0, 50)
    };

    fs.writeFileSync('solana-direct-phygitals-harvest.json', JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: solana-direct-phygitals-harvest.json`);

    return report;
  }

  async runHarvest() {
    console.log('\n🚀 STARTING SOLANA DIRECT PHYGITALS HARVEST');
    console.log('===========================================');

    try {
      // Search for Phygitals collections
      const phygitalsMetadata = await this.searchForPhygitalsCollections();
      
      if (phygitalsMetadata.length > 0) {
        console.log(`\n🚀 PROCESSING ${phygitalsMetadata.length} PHYGITALS METADATA ENTRIES`);
        
        for (const metadata of phygitalsMetadata) {
          await this.processPhygitalsMetadata(metadata);
          await this.delay(this.requestDelay);
        }
      } else {
        console.log('   ⚠️ No Phygitals metadata found on Solana blockchain');
      }

      // Generate report
      const report = await this.generateReport();

      console.log(`\n🎉 SUCCESS! Solana direct harvest complete!`);
      console.log(`📊 Total tokens processed: ${this.totalProcessed}`);
      
      return { success: true, report };

    } catch (error) {
      console.error('💥 Solana direct harvest failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.db.close();
    }
  }
}

// Execute the harvest
async function main() {
  const harvester = new SolanaDirectPhygitalsHarvester();
  await harvester.runHarvest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SolanaDirectPhygitalsHarvester;
