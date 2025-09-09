/**
 * Phygitals.com Pokemon Card Data Harvester
 * Using the same methodology as Collector Crypt to extract comprehensive Pokemon pricing data
 * Based on our successful API endpoint discovery
 */

const PhygitalsAPI = require('./phygitals-api-client.js');
const fs = require('fs');
const Database = require('better-sqlite3');

class PhygitalsPokemonHarvester {
  constructor() {
    this.api = new PhygitalsAPI();
    this.db = new Database('phygitals_pokemon_complete.db');
    this.setupDatabase();
    
    this.stats = {
      totalCards: 0,
      totalUsers: 0,
      totalSales: 0,
      totalListings: 0,
      startTime: new Date(),
      errors: []
    };
  }

  setupDatabase() {
    // Main cards table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phygitals_cards (
        id TEXT PRIMARY KEY,
        name TEXT,
        set_name TEXT,
        image_url TEXT,
        price REAL,
        fmv REAL,
        grader TEXT,
        grade TEXT,
        grade_type TEXT,
        rarity TEXT,
        card_type TEXT,
        language TEXT,
        category TEXT,
        owner_address TEXT,
        owner_username TEXT,
        listing_status TEXT,
        created_at TEXT,
        updated_at TEXT,
        metadata_json TEXT,
        source_url TEXT
      )
    `);

    // Sales data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phygitals_sales (
        txid TEXT PRIMARY KEY,
        card_address TEXT,
        from_address TEXT,
        to_address TEXT,
        amount REAL,
        sale_time TEXT,
        card_name TEXT,
        card_metadata TEXT
      )
    `);

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phygitals_users (
        wallet_address TEXT PRIMARY KEY,
        username TEXT,
        total_volume REAL,
        total_cards INTEGER,
        referral_code TEXT,
        referral_rank TEXT,
        created_at TEXT,
        profile_picture TEXT
      )
    `);

    // Market filters for Pokemon sets
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phygitals_sets (
        set_name TEXT PRIMARY KEY,
        count INTEGER,
        category TEXT
      )
    `);

    console.log('✅ Database tables created');
  }

  async harvestMarketplaceListings(maxPages = 50) {
    console.log('\n🛒 HARVESTING MARKETPLACE LISTINGS');
    console.log('===================================');

    try {
      let page = 0;
      let hasMoreData = true;
      
      while (hasMoreData && page < maxPages) {
        console.log(`📄 Fetching page ${page + 1}...`);
        
        const listings = await this.api.getMarketplaceListings({
          searchTerm: 'pokemon',
          sortBy: 'price-low-high',
          itemsPerPage: 50,
          page: page
        });

        if (!listings.listings || listings.listings.length === 0) {
          console.log('📄 No more listings found');
          hasMoreData = false;
          break;
        }

        console.log(`🎴 Found ${listings.listings.length} Pokemon cards`);

        for (const listing of listings.listings) {
          await this.processListing(listing);
        }

        this.stats.totalListings += listings.listings.length;
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error('❌ Error harvesting marketplace:', error.message);
      this.stats.errors.push({ source: 'marketplace', error: error.message });
    }
  }

  async processListing(listing) {
    try {
      const cardData = {
        id: listing.address,
        name: listing.name || 'Unknown Pokemon Card',
        image_url: listing.image,
        price: parseFloat(listing.price) || 0,
        fmv: parseFloat(listing.fmv) || 0,
        owner_address: listing.owner,
        listing_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata_json: JSON.stringify(listing),
        source_url: `https://www.phygitals.com/card/${listing.slug || listing.address}`
      };

      // Extract Pokemon-specific metadata if available
      if (listing.metadata) {
        const metadata = listing.metadata;
        cardData.set_name = this.extractSetName(metadata.name || listing.name);
        cardData.grader = this.extractGrader(metadata.name || listing.name);
        cardData.grade = this.extractGrade(metadata.name || listing.name);
        cardData.rarity = this.extractRarity(metadata);
        cardData.language = this.extractLanguage(metadata.name || listing.name);
      }

      // Insert or update card
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO phygitals_cards 
        (id, name, set_name, image_url, price, fmv, grader, grade, rarity, language, 
         owner_address, listing_status, created_at, updated_at, metadata_json, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        cardData.id, cardData.name, cardData.set_name, cardData.image_url, 
        cardData.price, cardData.fmv, cardData.grader, cardData.grade, 
        cardData.rarity, cardData.language, cardData.owner_address, 
        cardData.listing_status, cardData.created_at, cardData.updated_at, 
        cardData.metadata_json, cardData.source_url
      );

      this.stats.totalCards++;

    } catch (error) {
      console.error('❌ Error processing listing:', error.message);
      this.stats.errors.push({ source: 'listing', error: error.message, listing: listing.address });
    }
  }

  async harvestSalesData() {
    console.log('\n💰 HARVESTING SALES DATA');
    console.log('========================');

    try {
      let page = 0;
      let hasMoreData = true;
      
      while (hasMoreData && page < 20) { // Limit sales pages
        console.log(`📊 Fetching sales page ${page + 1}...`);
        
        const salesData = await this.api.getSalesData(50, page);

        if (!salesData.sales || salesData.sales.length === 0) {
          console.log('💰 No more sales found');
          hasMoreData = false;
          break;
        }

        console.log(`💵 Found ${salesData.sales.length} sales transactions`);

        for (const sale of salesData.sales) {
          await this.processSale(sale);
        }

        this.stats.totalSales += salesData.sales.length;
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } catch (error) {
      console.error('❌ Error harvesting sales:', error.message);
      this.stats.errors.push({ source: 'sales', error: error.message });
    }
  }

  async processSale(sale) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO phygitals_sales 
        (txid, card_address, from_address, to_address, amount, sale_time, card_metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        sale.txid,
        sale.universalNFTDataAddress,
        sale.from,
        sale.to,
        parseFloat(sale.amount) || 0,
        sale.time,
        JSON.stringify(sale)
      );

    } catch (error) {
      console.error('❌ Error processing sale:', error.message);
      this.stats.errors.push({ source: 'sale', error: error.message, txid: sale.txid });
    }
  }

  async harvestUserData() {
    console.log('\n👥 HARVESTING USER DATA');
    console.log('=======================');

    try {
      // Get leaderboard users first
      const leaderboard = await this.api.getLeaderboard(0, 100, 100);
      
      if (leaderboard.leaderboard) {
        console.log(`🏆 Found ${leaderboard.leaderboard.length} leaderboard users`);
        
        for (const user of leaderboard.leaderboard) {
          await this.processUser(user);
        }
      }

      // Get weekly leaderboard as well
      const weeklyLeaderboard = await this.api.getLeaderboard(0, 100, 100); // This would need weekly endpoint
      
    } catch (error) {
      console.error('❌ Error harvesting users:', error.message);
      this.stats.errors.push({ source: 'users', error: error.message });
    }
  }

  async processUser(user) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO phygitals_users 
        (wallet_address, total_volume, total_cards, created_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        user.address,
        parseFloat(user.volume) || 0,
        parseInt(user.cards) || 0,
        new Date().toISOString()
      );

      this.stats.totalUsers++;

    } catch (error) {
      console.error('❌ Error processing user:', error.message);
      this.stats.errors.push({ source: 'user', error: error.message, address: user.address });
    }
  }

  async harvestPokemonSets() {
    console.log('\n🎴 HARVESTING POKEMON SETS DATA');
    console.log('===============================');

    try {
      const filters = await this.api.getMarketplaceFilters();
      
      if (filters.filters && filters.filters.metadata && filters.filters.metadata.Set) {
        const sets = filters.filters.metadata.Set;
        console.log(`📦 Found ${sets.length} Pokemon sets`);
        
        for (const set of sets) {
          if (typeof set === 'object' && set.value) {
            const stmt = this.db.prepare(`
              INSERT OR REPLACE INTO phygitals_sets (set_name, count, category)
              VALUES (?, ?, ?)
            `);
            
            stmt.run(
              set.value,
              set.count || 0,
              'Pokemon'
            );
          }
        }
        
        console.log(`✅ Processed ${sets.length} Pokemon sets`);
      }

    } catch (error) {
      console.error('❌ Error harvesting sets:', error.message);
      this.stats.errors.push({ source: 'sets', error: error.message });
    }
  }

  // Helper methods for extracting Pokemon card metadata
  extractSetName(name) {
    const patterns = [
      /(\d{4})\s+Pokemon\s+(.+?)(?:\s+#|\s+PSA|\s+BGS|\s+CGC|$)/i,
      /Pokemon\s+(.+?)(?:\s+#|\s+PSA|\s+BGS|\s+CGC|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match) return match[2] || match[1];
    }
    
    return null;
  }

  extractGrader(name) {
    if (name.includes('PSA')) return 'PSA';
    if (name.includes('BGS')) return 'BGS';
    if (name.includes('CGC')) return 'CGC';
    return null;
  }

  extractGrade(name) {
    const gradeMatch = name.match(/(?:PSA|BGS|CGC)\s*(\d+(?:\.\d+)?)/i);
    return gradeMatch ? gradeMatch[1] : null;
  }

  extractLanguage(name) {
    if (name.toLowerCase().includes('japanese') || name.toLowerCase().includes('jpn')) return 'Japanese';
    if (name.toLowerCase().includes('english')) return 'English';
    return 'English'; // Default
  }

  extractRarity(metadata) {
    // This would depend on the actual metadata structure
    return null;
  }

  async generateReport() {
    console.log('\n📊 GENERATING HARVEST REPORT');
    console.log('============================');

    const endTime = new Date();
    const duration = Math.round((endTime - this.stats.startTime) / 1000);

    // Get database stats
    const cardCount = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards').get().count;
    const salesCount = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_sales').get().count;
    const usersCount = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_users').get().count;
    const setsCount = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_sets').get().count;

    // Get pricing stats
    const priceStats = this.db.prepare(`
      SELECT 
        COUNT(*) as cards_with_price,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        SUM(price) as total_value
      FROM phygitals_cards 
      WHERE price > 0
    `).get();

    // Get top graded cards
    const topGraded = this.db.prepare(`
      SELECT name, grader, grade, price, set_name
      FROM phygitals_cards 
      WHERE grader IS NOT NULL AND price > 0
      ORDER BY price DESC 
      LIMIT 10
    `).all();

    const report = {
      harvestSummary: {
        duration: `${duration} seconds`,
        totalCards: cardCount,
        totalSales: salesCount,
        totalUsers: usersCount,
        totalSets: setsCount,
        errors: this.stats.errors.length
      },
      pricingAnalysis: {
        cardsWithPricing: priceStats.cards_with_price,
        averagePrice: Math.round(priceStats.avg_price * 100) / 100,
        priceRange: `$${priceStats.min_price} - $${priceStats.max_price}`,
        totalMarketValue: Math.round(priceStats.total_value * 100) / 100
      },
      topGradedCards,
      database: 'phygitals_pokemon_complete.db',
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync('phygitals-harvest-report.json', JSON.stringify(report, null, 2));

    console.log(`\n✅ PHYGITALS HARVEST COMPLETE!`);
    console.log(`📊 Duration: ${duration} seconds`);
    console.log(`🎴 Cards: ${cardCount}`);
    console.log(`💰 Sales: ${salesCount}`);
    console.log(`👥 Users: ${usersCount}`);
    console.log(`📦 Sets: ${setsCount}`);
    console.log(`💵 Average Price: $${Math.round(priceStats.avg_price * 100) / 100}`);
    console.log(`🏆 Top Price: $${priceStats.max_price}`);
    console.log(`📄 Report: phygitals-harvest-report.json`);
    console.log(`🗄️  Database: phygitals_pokemon_complete.db`);

    if (this.stats.errors.length > 0) {
      console.log(`⚠️  Errors: ${this.stats.errors.length} (check report for details)`);
    }

    return report;
  }

  async harvest() {
    console.log('🚀 STARTING PHYGITALS POKEMON HARVEST');
    console.log('====================================');
    console.log('Using discovered API endpoints for comprehensive data extraction\n');

    try {
      // Harvest all data sources
      await this.harvestPokemonSets();
      await this.harvestMarketplaceListings();
      await this.harvestSalesData();
      await this.harvestUserData();

      // Generate final report
      return await this.generateReport();

    } catch (error) {
      console.error('💥 Harvest failed:', error);
      this.stats.errors.push({ source: 'main', error: error.message });
      return await this.generateReport();
    } finally {
      this.db.close();
    }
  }
}

// Run the harvester
async function main() {
  const harvester = new PhygitalsPokemonHarvester();
  await harvester.harvest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PhygitalsPokemonHarvester;
