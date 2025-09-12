/**
 * Comprehensive Pokemon Card Data Analysis
 * Analyzes all databases and data sources to provide complete overview
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class ComprehensivePokemonAnalysis {
  constructor() {
    this.databases = {};
    this.analysisResults = {};
    
    // Solana conversion rates for Phygitals
    this.LAMPORTS_PER_SOL = 1000000000;
    this.SOL_TO_USD = 140;
  }

  async analyzeAllDatabases() {
    console.log('🔍 COMPREHENSIVE POKEMON CARD DATA ANALYSIS');
    console.log('==========================================');
    
    // Find all database files
    const dbFiles = this.findDatabaseFiles();
    console.log(`📊 Found ${dbFiles.length} database files to analyze\n`);
    
    // Analyze each database
    for (const dbFile of dbFiles) {
      await this.analyzeDatabase(dbFile);
    }
    
    // Generate comprehensive report
    this.generateComprehensiveReport();
    
    // Identify arbitrage opportunities
    this.identifyArbitrageOpportunities();
    
    // Close all database connections
    this.closeDatabases();
  }
  
  findDatabaseFiles() {
    const currentDir = process.cwd();
    const files = fs.readdirSync(currentDir);
    
    return files
      .filter(file => file.endsWith('.db'))
      .map(file => path.join(currentDir, file));
  }
  
  async analyzeDatabase(dbPath) {
    const dbName = path.basename(dbPath, '.db');
    console.log(`📋 Analyzing: ${dbName}`);
    
    try {
      const db = new Database(dbPath);
      this.databases[dbName] = db;
      
      // Get all tables
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      
      const dbAnalysis = {
        path: dbPath,
        size: this.getFileSize(dbPath),
        tables: {},
        totalRecords: 0,
        keyMetrics: {}
      };
      
      // Analyze each table
      for (const table of tables) {
        const tableName = table.name;
        console.log(`  📊 Table: ${tableName}`);
        
        // Get table info
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
        
        dbAnalysis.tables[tableName] = {
          recordCount: count,
          columns: schema.map(col => ({ name: col.name, type: col.type }))
        };
        
        dbAnalysis.totalRecords += count;
        
        // Special analysis for key tables
        await this.analyzeSpecialTable(db, tableName, dbAnalysis);
        
        console.log(`    ✅ ${count.toLocaleString()} records`);
      }
      
      this.analysisResults[dbName] = dbAnalysis;
      console.log(`  📊 Total: ${dbAnalysis.totalRecords.toLocaleString()} records (${dbAnalysis.size})\n`);
      
    } catch (error) {
      console.log(`  ❌ Error analyzing ${dbName}: ${error.message}\n`);
    }
  }
  
  async analyzeSpecialTable(db, tableName, dbAnalysis) {
    try {
      // Phygitals analysis
      if (tableName.includes('phygitals') || tableName.includes('cards')) {
        const priceAnalysis = this.analyzePricing(db, tableName);
        if (priceAnalysis) {
          dbAnalysis.keyMetrics.pricing = priceAnalysis;
        }
      }
      
      // Pokemon-specific analysis
      if (tableName.includes('pokemon')) {
        const pokemonAnalysis = this.analyzePokemonData(db, tableName);
        if (pokemonAnalysis) {
          dbAnalysis.keyMetrics.pokemon = pokemonAnalysis;
        }
      }
      
      // TCG analysis
      if (tableName.includes('tcg') || tableName.includes('collector')) {
        const tcgAnalysis = this.analyzeTCGData(db, tableName);
        if (tcgAnalysis) {
          dbAnalysis.keyMetrics.tcg = tcgAnalysis;
        }
      }
      
    } catch (error) {
      // Silent fail for analysis - table structure might not match expectations
    }
  }
  
  analyzePricing(db, tableName) {
    try {
      // Try different price column names
      const priceColumns = ['price', 'asking_price', 'market_value', 'final_market_value', 'phygitals_price'];
      let priceColumn = null;
      
      for (const col of priceColumns) {
        try {
          const test = db.prepare(`SELECT ${col} FROM ${tableName} LIMIT 1`).get();
          priceColumn = col;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!priceColumn) return null;
      
      const priceStats = db.prepare(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(${priceColumn}) as with_prices,
          MIN(${priceColumn}) as min_price,
          MAX(${priceColumn}) as max_price,
          AVG(${priceColumn}) as avg_price
        FROM ${tableName}
        WHERE ${priceColumn} IS NOT NULL AND ${priceColumn} > 0
      `).get();
      
      // Convert Phygitals lamports to USD if needed
      if (tableName.includes('phygitals') && priceStats.max_price > 1000000) {
        return {
          totalRecords: priceStats.total_records,
          withPrices: priceStats.with_prices,
          minPrice: this.convertLamportsToUSD(priceStats.min_price),
          maxPrice: this.convertLamportsToUSD(priceStats.max_price),
          avgPrice: this.convertLamportsToUSD(priceStats.avg_price),
          currency: 'USD (converted from lamports)',
          priceColumn: priceColumn
        };
      }
      
      return {
        totalRecords: priceStats.total_records,
        withPrices: priceStats.with_prices,
        minPrice: priceStats.min_price,
        maxPrice: priceStats.max_price,
        avgPrice: priceStats.avg_price,
        currency: 'USD',
        priceColumn: priceColumn
      };
      
    } catch (error) {
      return null;
    }
  }
  
  analyzePokemonData(db, tableName) {
    try {
      // Try to find Pokemon-specific columns
      const nameColumns = ['name', 'cc_title', 'title', 'card_name'];
      let nameColumn = null;
      
      for (const col of nameColumns) {
        try {
          const test = db.prepare(`SELECT ${col} FROM ${tableName} LIMIT 1`).get();
          nameColumn = col;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!nameColumn) return null;
      
      // Find popular Pokemon
      const popularPokemon = db.prepare(`
        SELECT 
          CASE 
            WHEN LOWER(${nameColumn}) LIKE '%charizard%' THEN 'Charizard'
            WHEN LOWER(${nameColumn}) LIKE '%pikachu%' THEN 'Pikachu'
            WHEN LOWER(${nameColumn}) LIKE '%blastoise%' THEN 'Blastoise'
            WHEN LOWER(${nameColumn}) LIKE '%venusaur%' THEN 'Venusaur'
            WHEN LOWER(${nameColumn}) LIKE '%mew%' THEN 'Mew'
            WHEN LOWER(${nameColumn}) LIKE '%mewtwo%' THEN 'Mewtwo'
            WHEN LOWER(${nameColumn}) LIKE '%lugia%' THEN 'Lugia'
            WHEN LOWER(${nameColumn}) LIKE '%rayquaza%' THEN 'Rayquaza'
            ELSE 'Other'
          END as pokemon,
          COUNT(*) as count
        FROM ${tableName}
        GROUP BY pokemon
        ORDER BY count DESC
        LIMIT 10
      `).all();
      
      return {
        nameColumn: nameColumn,
        popularPokemon: popularPokemon
      };
      
    } catch (error) {
      return null;
    }
  }
  
  analyzeTCGData(db, tableName) {
    try {
      // Try to find grading information
      const gradingColumns = ['grade', 'grading_company', 'grader'];
      let gradingData = null;
      
      for (const col of gradingColumns) {
        try {
          const gradingStats = db.prepare(`
            SELECT ${col}, COUNT(*) as count 
            FROM ${tableName} 
            WHERE ${col} IS NOT NULL 
            GROUP BY ${col} 
            ORDER BY count DESC 
            LIMIT 5
          `).all();
          
          if (gradingStats.length > 0) {
            gradingData = { column: col, stats: gradingStats };
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      return gradingData;
      
    } catch (error) {
      return null;
    }
  }
  
  convertLamportsToUSD(lamports) {
    if (!lamports || lamports <= 0) return 0;
    const sol = lamports / this.LAMPORTS_PER_SOL;
    return Math.round(sol * this.SOL_TO_USD * 100) / 100;
  }
  
  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const bytes = stats.size;
      
      if (bytes === 0) return '0 B';
      
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      return 'Unknown';
    }
  }
  
  generateComprehensiveReport() {
    console.log('\n🏆 COMPREHENSIVE ANALYSIS REPORT');
    console.log('================================');
    
    let totalCards = 0;
    let totalPricedCards = 0;
    let highestValueCard = { price: 0, database: '', source: '' };
    let largestDatabase = { records: 0, name: '', size: '' };
    
    // Summary by database
    for (const [dbName, analysis] of Object.entries(this.analysisResults)) {
      console.log(`\n📊 ${dbName.toUpperCase()}`);
      console.log(`   💾 Size: ${analysis.size}`);
      console.log(`   📁 Records: ${analysis.totalRecords.toLocaleString()}`);
      
      totalCards += analysis.totalRecords;
      
      if (analysis.totalRecords > largestDatabase.records) {
        largestDatabase = {
          records: analysis.totalRecords,
          name: dbName,
          size: analysis.size
        };
      }
      
      // Pricing information
      if (analysis.keyMetrics.pricing) {
        const pricing = analysis.keyMetrics.pricing;
        console.log(`   💰 Cards with prices: ${pricing.withPrices.toLocaleString()}`);
        console.log(`   💵 Price range: $${pricing.minPrice} - $${pricing.maxPrice ? pricing.maxPrice.toLocaleString() : 'N/A'}`);
        console.log(`   📈 Average price: $${pricing.avgPrice ? pricing.avgPrice.toFixed(2) : 'N/A'}`);
        
        totalPricedCards += pricing.withPrices;
        
        if (pricing.maxPrice > highestValueCard.price) {
          highestValueCard = {
            price: pricing.maxPrice,
            database: dbName,
            source: pricing.currency
          };
        }
      }
      
      // Pokemon data
      if (analysis.keyMetrics.pokemon) {
        const pokemon = analysis.keyMetrics.pokemon;
        console.log(`   🎴 Popular Pokemon:`);
        pokemon.popularPokemon.slice(0, 3).forEach(p => {
          if (p.pokemon !== 'Other') {
            console.log(`      ${p.pokemon}: ${p.count.toLocaleString()} cards`);
          }
        });
      }
      
      // TCG/Grading data
      if (analysis.keyMetrics.tcg) {
        const tcg = analysis.keyMetrics.tcg;
        console.log(`   🏅 Grading info (${tcg.column}):`);
        tcg.stats.slice(0, 3).forEach(g => {
          console.log(`      ${g[tcg.column]}: ${g.count.toLocaleString()} cards`);
        });
      }
    }
    
    // Overall summary
    console.log(`\n🎯 OVERALL SUMMARY`);
    console.log(`   🃏 Total Pokemon cards: ${totalCards.toLocaleString()}`);
    console.log(`   💰 Cards with pricing: ${totalPricedCards.toLocaleString()}`);
    console.log(`   💎 Highest value card: $${highestValueCard.price.toLocaleString()} (${highestValueCard.database})`);
    console.log(`   📊 Largest database: ${largestDatabase.name} (${largestDatabase.records.toLocaleString()} records, ${largestDatabase.size})`);
    
    // Save detailed report
    const detailedReport = {
      analysisDate: new Date().toISOString(),
      summary: {
        totalCards,
        totalPricedCards,
        databasesAnalyzed: Object.keys(this.analysisResults).length,
        highestValueCard,
        largestDatabase
      },
      databases: this.analysisResults
    };
    
    fs.writeFileSync('comprehensive-pokemon-analysis.json', JSON.stringify(detailedReport, null, 2));
    console.log(`\n📄 Detailed report saved: comprehensive-pokemon-analysis.json`);
  }
  
  identifyArbitrageOpportunities() {
    console.log(`\n🚀 ARBITRAGE OPPORTUNITY ANALYSIS`);
    console.log(`=================================`);
    
    // Look for databases with pricing data
    const pricingDatabases = Object.entries(this.analysisResults)
      .filter(([name, analysis]) => analysis.keyMetrics.pricing)
      .map(([name, analysis]) => ({
        name,
        ...analysis.keyMetrics.pricing
      }));
    
    if (pricingDatabases.length < 2) {
      console.log(`❌ Need at least 2 databases with pricing for arbitrage analysis`);
      console.log(`   Found: ${pricingDatabases.length} databases with pricing`);
      return;
    }
    
    console.log(`✅ Found ${pricingDatabases.length} databases with pricing data:`);
    pricingDatabases.forEach(db => {
      console.log(`   📊 ${db.name}: ${db.withPrices.toLocaleString()} priced cards ($${db.minPrice}-$${db.maxPrice.toLocaleString()})`);
    });
    
    // Check for ultimate pricing database with cross-platform data
    const ultimateDb = this.databases['collector_crypt_ultimate_pricing'];
    if (ultimateDb) {
      console.log(`\n🎯 CROSS-PLATFORM ARBITRAGE ANALYSIS`);
      try {
        const arbitrageOps = ultimateDb.prepare(`
          SELECT 
            cc_title as card_name,
            final_market_value,
            phygitals_price,
            ebay_sold_price,
            (final_market_value - phygitals_price) as profit_potential,
            ((final_market_value - phygitals_price) / final_market_value * 100) as profit_percentage
          FROM collector_crypt_ultimate_pricing 
          WHERE phygitals_price IS NOT NULL 
            AND final_market_value IS NOT NULL
            AND final_market_value > phygitals_price
            AND final_market_value > 100
          ORDER BY profit_potential DESC 
          LIMIT 10
        `).all();
        
        if (arbitrageOps.length > 0) {
          console.log(`💰 Top ${arbitrageOps.length} arbitrage opportunities:`);
          arbitrageOps.forEach((op, index) => {
            console.log(`\n   ${index + 1}. ${op.card_name.substring(0, 60)}...`);
            console.log(`      🏪 Phygitals: $${op.phygitals_price}`);
            console.log(`      💎 Market: $${op.final_market_value.toFixed(2)}`);
            console.log(`      🏦 eBay: $${op.ebay_sold_price ? op.ebay_sold_price.toFixed(2) : 'N/A'}`);
            console.log(`      💰 Profit: $${op.profit_potential.toFixed(2)} (${op.profit_percentage.toFixed(1)}%)`);
          });
          
          const totalProfitPotential = arbitrageOps.reduce((sum, op) => sum + op.profit_potential, 0);
          console.log(`\n   🎯 Total profit potential (top 10): $${totalProfitPotential.toLocaleString()}`);
        } else {
          console.log(`❌ No arbitrage opportunities found in ultimate pricing database`);
        }
        
      } catch (error) {
        console.log(`❌ Error analyzing arbitrage opportunities: ${error.message}`);
      }
    }
  }
  
  closeDatabases() {
    for (const db of Object.values(this.databases)) {
      try {
        db.close();
      } catch (error) {
        // Silent fail
      }
    }
  }
}

// Run the comprehensive analysis
async function main() {
  const analyzer = new ComprehensivePokemonAnalysis();
  await analyzer.analyzeAllDatabases();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ComprehensivePokemonAnalysis;
