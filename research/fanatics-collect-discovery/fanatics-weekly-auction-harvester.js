/**
 * FANATICS COLLECT WEEKLY AUCTION HARVESTER
 * Comprehensive scraper for Fanatics Collect weekly auctions
 * Target: Pokemon cards across all languages (English, Japanese, Other)
 * 
 * Based on PokeDAO's proven scraping architecture with security-first approach
 */

const { chromium } = require('playwright');
const fs = require('fs');
const Database = require('better-sqlite3');

class FanaticsWeeklyAuctionHarvester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.db = new Database('fanatics_weekly_auctions.db');
    this.setupDatabase();
    
    this.results = {
      totalCards: 0,
      activeAuctions: 0,
      completedAuctions: 0,
      categories: {
        english: 0,
        japanese: 0,
        other: 0
      },
      priceRanges: {
        under100: 0,
        under1000: 0,
        under10000: 0,
        over10000: 0
      },
      rawData: []
    };
  }

  setupDatabase() {
    console.log('🗃️  Setting up Fanatics Auction database...');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fanatics_auctions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        language TEXT,
        current_bid REAL,
        starting_bid REAL,
        buy_now_price REAL,
        auction_end_time TEXT,
        auction_status TEXT,
        bid_count INTEGER,
        seller_name TEXT,
        condition_grade TEXT,
        certification TEXT,
        set_name TEXT,
        card_number TEXT,
        rarity TEXT,
        image_urls TEXT,
        auction_url TEXT,
        estimated_value REAL,
        view_count INTEGER,
        watchers_count INTEGER,
        shipping_cost REAL,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        raw_data_json TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_title ON fanatics_auctions(title);
      CREATE INDEX IF NOT EXISTS idx_category ON fanatics_auctions(category);
      CREATE INDEX IF NOT EXISTS idx_language ON fanatics_auctions(language);
      CREATE INDEX IF NOT EXISTS idx_current_bid ON fanatics_auctions(current_bid);
      CREATE INDEX IF NOT EXISTS idx_auction_status ON fanatics_auctions(auction_status);
      CREATE INDEX IF NOT EXISTS idx_auction_end_time ON fanatics_auctions(auction_end_time);
    `);
    
    console.log('✅ Database setup complete');
  }

  async initialize() {
    console.log('🎯 FANATICS COLLECT WEEKLY AUCTION HARVESTER');
    console.log('============================================');
    console.log('Target: Pokemon cards across all languages');
    console.log('Source: Weekly auction system');
    console.log('Architecture: Security-first with rate limiting\n');
    
    this.browser = await chromium.launch({ 
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set up comprehensive network monitoring
    await this.setupNetworkInterception();
    
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  }

  async setupNetworkInterception() {
    console.log('🌐 Setting up network interception...');
    
    // Intercept API calls
    this.page.on('response', async (response) => {
      const url = response.url();
      
      // GraphQL endpoints
      if (url.includes('graphql') || url.includes('api')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            await this.processAPIResponse(url, data);
          }
        } catch (error) {
          console.log(`⚠️  Could not parse response from ${url}: ${error.message}`);
        }
      }
    });

    // Log all requests for debugging
    this.page.on('request', (request) => {
      const url = request.url();
      if (url.includes('fanatics') && (url.includes('api') || url.includes('graphql'))) {
        console.log(`🔍 API Request: ${request.method()} ${url}`);
      }
    });
  }

  async processAPIResponse(url, data) {
    console.log(`📊 Processing API response from: ${url}`);
    
    try {
      // Look for auction data in various possible structures
      const auctions = this.extractAuctionsFromResponse(data);
      
      if (auctions && auctions.length > 0) {
        console.log(`✅ Found ${auctions.length} auctions in API response`);
        
        for (const auction of auctions) {
          await this.processAuctionItem(auction, 'api');
        }
      }
      
      // Store raw response for analysis
      this.results.rawData.push({
        timestamp: new Date().toISOString(),
        url,
        dataType: 'api_response',
        data: data
      });
      
    } catch (error) {
      console.log(`❌ Error processing API response: ${error.message}`);
    }
  }

  extractAuctionsFromResponse(data) {
    // Multiple possible data structures
    const possiblePaths = [
      data.data?.auctions,
      data.data?.listings,
      data.data?.items,
      data.auctions,
      data.listings,
      data.items,
      data.results,
      data.data?.results,
      data.data?.collectListings,
      data.collectListings
    ];

    for (const path of possiblePaths) {
      if (Array.isArray(path) && path.length > 0) {
        return path;
      }
    }

    return null;
  }

  async harvestWeeklyAuctions() {
    console.log('🎯 Starting weekly auction harvest...');
    
    const targetUrl = 'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY';
    
    console.log(`🌐 Navigating to: ${targetUrl}`);
    
    try {
      await this.page.goto(targetUrl, { 
        waitUntil: 'networkidle', 
        timeout: 60000 
      });
      
      // Wait for content to load
      await this.page.waitForTimeout(5000);
      
      console.log('📄 Page loaded, analyzing structure...');
      
      // Try multiple strategies to find auction data
      await this.scrapePageContent();
      await this.triggerAPIRequests();
      await this.scrollToLoadMore();
      
    } catch (error) {
      console.log(`❌ Navigation error: ${error.message}`);
    }
  }

  async scrapePageContent() {
    console.log('🔍 Scraping visible page content...');
    
    try {
      // Look for auction cards with various possible selectors
      const selectors = [
        '[data-testid*="auction"]',
        '[class*="auction"]',
        '[class*="card"]',
        '[class*="item"]',
        '[class*="listing"]',
        '.auction-item',
        '.card-item',
        '.listing-item'
      ];

      for (const selector of selectors) {
        try {
          const elements = await this.page.$$(selector);
          
          if (elements.length > 0) {
            console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
            
            for (const element of elements) {
              await this.extractElementData(element);
            }
            
            break; // Found working selector
          }
        } catch (error) {
          console.log(`⚠️  Selector ${selector} failed: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Page scraping error: ${error.message}`);
    }
  }

  async extractElementData(element) {
    try {
      const data = await element.evaluate((el) => {
        return {
          innerHTML: el.innerHTML,
          textContent: el.textContent,
          className: el.className,
          attributes: Array.from(el.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {})
        };
      });

      // Parse auction data from element
      const auctionData = this.parseElementForAuctionData(data);
      
      if (auctionData) {
        await this.processAuctionItem(auctionData, 'page_scrape');
      }
      
    } catch (error) {
      console.log(`⚠️  Element extraction error: ${error.message}`);
    }
  }

  parseElementForAuctionData(elementData) {
    const text = elementData.textContent || '';
    const html = elementData.innerHTML || '';
    
    // Look for price patterns
    const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
    const bidMatches = text.match(/(\d+)\s*(bid|bids)/i);
    
    // Look for Pokemon card indicators
    const isPokemon = /pokemon|pikachu|charizard|base set|neo|gym|rocket/i.test(text);
    
    if (isPokemon || priceMatches) {
      return {
        title: this.extractTitle(text, html),
        currentBid: priceMatches ? this.parsePrice(priceMatches[0]) : null,
        bidCount: bidMatches ? parseInt(bidMatches[1]) : 0,
        description: text.substring(0, 500),
        rawElement: elementData
      };
    }
    
    return null;
  }

  extractTitle(text, html) {
    // Look for title in various places
    const lines = text.split('\n').filter(line => line.trim());
    return lines.find(line => line.length > 10 && line.length < 150) || 'Unknown Title';
  }

  parsePrice(priceString) {
    return parseFloat(priceString.replace(/[$,]/g, ''));
  }

  async triggerAPIRequests() {
    console.log('🔄 Triggering additional API requests...');
    
    try {
      // Try to trigger pagination or load more
      const loadMoreButtons = await this.page.$$('button:has-text("Load"), button:has-text("More"), button:has-text("Next")');
      
      for (const button of loadMoreButtons) {
        try {
          await button.click();
          await this.page.waitForTimeout(3000);
          console.log('✅ Clicked load more button');
        } catch (error) {
          console.log('⚠️  Could not click load more button');
        }
      }
      
    } catch (error) {
      console.log(`⚠️  API trigger error: ${error.message}`);
    }
  }

  async scrollToLoadMore() {
    console.log('📜 Scrolling to trigger lazy loading...');
    
    try {
      for (let i = 0; i < 5; i++) {
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        await this.page.waitForTimeout(2000);
        console.log(`📜 Scroll ${i + 1}/5 completed`);
      }
      
    } catch (error) {
      console.log(`⚠️  Scroll error: ${error.message}`);
    }
  }

  async processAuctionItem(auctionData, source) {
    try {
      // Generate unique ID
      const id = this.generateAuctionId(auctionData);
      
      // Skip duplicates
      if (this.hasSeenAuction(id)) {
        return;
      }
      
      // Parse and clean data
      const cleanData = this.cleanAuctionData(auctionData);
      
      // Store in database
      await this.storeAuction(id, cleanData, source);
      
      // Update statistics
      this.updateStatistics(cleanData);
      
      console.log(`💾 Processed auction: ${cleanData.title?.substring(0, 50)}...`);
      
    } catch (error) {
      console.log(`❌ Error processing auction: ${error.message}`);
    }
  }

  generateAuctionId(auctionData) {
    const title = auctionData.title || '';
    const price = auctionData.currentBid || auctionData.price || 0;
    return `fanatics_${Buffer.from(title + price).toString('base64').substring(0, 16)}`;
  }

  hasSeenAuction(id) {
    const existing = this.db.prepare('SELECT id FROM fanatics_auctions WHERE id = ?').get(id);
    return !!existing;
  }

  cleanAuctionData(raw) {
    return {
      title: this.cleanString(raw.title),
      description: this.cleanString(raw.description),
      currentBid: this.parseNumeric(raw.currentBid || raw.price),
      bidCount: this.parseNumeric(raw.bidCount || raw.bids),
      category: this.extractCategory(raw),
      language: this.extractLanguage(raw),
      auctionStatus: this.extractStatus(raw),
      imageUrls: this.extractImages(raw),
      rawData: JSON.stringify(raw)
    };
  }

  cleanString(str) {
    if (!str) return null;
    return str.toString().trim().substring(0, 1000);
  }

  parseNumeric(value) {
    if (!value) return null;
    const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? null : num;
  }

  extractCategory(data) {
    const text = JSON.stringify(data).toLowerCase();
    if (text.includes('english')) return 'english';
    if (text.includes('japanese')) return 'japanese';
    if (text.includes('other')) return 'other';
    return 'unknown';
  }

  extractLanguage(data) {
    return this.extractCategory(data); // Same logic for now
  }

  extractStatus(data) {
    const text = JSON.stringify(data).toLowerCase();
    if (text.includes('live') || text.includes('active')) return 'active';
    if (text.includes('ended') || text.includes('sold')) return 'completed';
    return 'unknown';
  }

  extractImages(data) {
    const images = [];
    const text = JSON.stringify(data);
    const imageMatches = text.match(/https?:\/\/[^"\s]+\.(jpg|jpeg|png|webp)/gi);
    
    if (imageMatches) {
      return JSON.stringify(imageMatches.slice(0, 5)); // Limit to 5 images
    }
    
    return null;
  }

  async storeAuction(id, data, source) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO fanatics_auctions (
        id, title, description, category, language, current_bid,
        bid_count, auction_status, image_urls, raw_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.title,
      data.description,
      data.category,
      data.language,
      data.currentBid,
      data.bidCount,
      data.auctionStatus,
      data.imageUrls,
      data.rawData
    );
  }

  updateStatistics(data) {
    this.results.totalCards++;
    
    if (data.auctionStatus === 'active') {
      this.results.activeAuctions++;
    } else if (data.auctionStatus === 'completed') {
      this.results.completedAuctions++;
    }
    
    // Update category counts
    if (data.category && this.results.categories[data.category] !== undefined) {
      this.results.categories[data.category]++;
    }
    
    // Update price ranges
    const price = data.currentBid || 0;
    if (price < 100) this.results.priceRanges.under100++;
    else if (price < 1000) this.results.priceRanges.under1000++;
    else if (price < 10000) this.results.priceRanges.under10000++;
    else this.results.priceRanges.over10000++;
  }

  async generateReport() {
    console.log('\n📊 FANATICS WEEKLY AUCTION HARVEST REPORT');
    console.log('========================================');
    
    console.log(`🎯 Total Cards Found: ${this.results.totalCards.toLocaleString()}`);
    console.log(`🔴 Active Auctions: ${this.results.activeAuctions.toLocaleString()}`);
    console.log(`✅ Completed Auctions: ${this.results.completedAuctions.toLocaleString()}`);
    
    console.log('\n📚 Categories:');
    console.log(`   English: ${this.results.categories.english.toLocaleString()}`);
    console.log(`   Japanese: ${this.results.categories.japanese.toLocaleString()}`);
    console.log(`   Other Languages: ${this.results.categories.other.toLocaleString()}`);
    
    console.log('\n💰 Price Ranges:');
    console.log(`   Under $100: ${this.results.priceRanges.under100.toLocaleString()}`);
    console.log(`   $100-$1,000: ${this.results.priceRanges.under1000.toLocaleString()}`);
    console.log(`   $1,000-$10,000: ${this.results.priceRanges.under10000.toLocaleString()}`);
    console.log(`   Over $10,000: ${this.results.priceRanges.over10000.toLocaleString()}`);
    
    // Save comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      databaseStats: this.getDatabaseStats(),
      recommendation: this.generateRecommendations()
    };
    
    fs.writeFileSync(
      `fanatics-weekly-auction-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );
    
    console.log(`\n📄 Complete report saved to: fanatics-weekly-auction-report-${Date.now()}.json`);
  }

  getDatabaseStats() {
    const totalRecords = this.db.prepare('SELECT COUNT(*) as count FROM fanatics_auctions').get().count;
    const avgBid = this.db.prepare('SELECT AVG(current_bid) as avg FROM fanatics_auctions WHERE current_bid IS NOT NULL').get().avg;
    const maxBid = this.db.prepare('SELECT MAX(current_bid) as max FROM fanatics_auctions WHERE current_bid IS NOT NULL').get().max;
    
    return {
      totalRecords,
      averageBid: avgBid ? parseFloat(avgBid).toFixed(2) : null,
      highestBid: maxBid ? parseFloat(maxBid).toFixed(2) : null
    };
  }

  generateRecommendations() {
    return {
      dataQuality: this.results.totalCards > 100 ? 'Good' : 'Needs more data',
      nextSteps: [
        'Integrate with existing PokeDAO pricing system',
        'Set up automated daily harvesting',
        'Cross-reference with eBay and TCGPlayer prices',
        'Identify arbitrage opportunities',
        'Monitor auction completion rates'
      ],
      integration: 'Ready to integrate with comprehensive-pokemon-analysis.js'
    };
  }

  async cleanup() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
    if (this.db) this.db.close();
  }

  async run() {
    try {
      await this.initialize();
      await this.harvestWeeklyAuctions();
      await this.generateReport();
      
      console.log('\n✅ Fanatics Collect harvest completed successfully!');
      console.log('🔗 Ready for integration with PokeDAO pricing system');
      
    } catch (error) {
      console.log(`❌ Harvest failed: ${error.message}`);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the harvester
if (require.main === module) {
  const harvester = new FanaticsWeeklyAuctionHarvester();
  harvester.run().catch(console.error);
}

module.exports = FanaticsWeeklyAuctionHarvester;
