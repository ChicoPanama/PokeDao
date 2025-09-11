/**
 * FANATICS COLLECT COMPREHENSIVE POKEMON SCRAPER
 * Complete data harvester for ALL Pokemon cards including sold/completed auctions
 * 
 * Target: All Pokemon listings (active + sold) across all categories
 * Focus: Historical pricing data from completed auctions for market intelligence
 * 
 * Based on PokeDAO's proven scraping architecture
 */

const { chromium } = require('playwright');
const fs = require('fs');
const Database = require('better-sqlite3');

class FanaticsComprehensiveScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.db = new Database('fanatics_complete_pokemon.db');
    this.setupDatabase();
    
    this.results = {
      totalCards: 0,
      activeListings: 0,
      soldListings: 0,
      totalValue: 0,
      categories: {
        english: 0,
        japanese: 0,
        other: 0
      },
      priceRanges: {
        under50: 0,
        under200: 0,
        under1000: 0,
        under5000: 0,
        over5000: 0
      },
      sets: new Map(),
      rarities: new Map(),
      conditions: new Map()
    };

    this.seenCards = new Set();
    this.apiResponses = [];
  }

  setupDatabase() {
    console.log('🗃️  Setting up Fanatics Complete database...');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fanatics_pokemon (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        language TEXT,
        current_price REAL,
        sold_price REAL,
        starting_price REAL,
        buy_now_price REAL,
        listing_type TEXT,
        listing_status TEXT,
        sale_date TEXT,
        end_date TEXT,
        bid_count INTEGER,
        view_count INTEGER,
        watch_count INTEGER,
        seller_name TEXT,
        seller_rating REAL,
        condition_grade TEXT,
        certification TEXT,
        cert_number TEXT,
        set_name TEXT,
        card_number TEXT,
        rarity TEXT,
        year INTEGER,
        artist TEXT,
        card_type TEXT,
        pokemon_name TEXT,
        image_urls TEXT,
        listing_url TEXT,
        shipping_cost REAL,
        location TEXT,
        market_value REAL,
        price_trend TEXT,
        comparable_sales TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        raw_data_json TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_title ON fanatics_pokemon(title);
      CREATE INDEX IF NOT EXISTS idx_sold_price ON fanatics_pokemon(sold_price);
      CREATE INDEX IF NOT EXISTS idx_listing_status ON fanatics_pokemon(listing_status);
      CREATE INDEX IF NOT EXISTS idx_set_name ON fanatics_pokemon(set_name);
      CREATE INDEX IF NOT EXISTS idx_pokemon_name ON fanatics_pokemon(pokemon_name);
      CREATE INDEX IF NOT EXISTS idx_certification ON fanatics_pokemon(certification);
      CREATE INDEX IF NOT EXISTS idx_sale_date ON fanatics_pokemon(sale_date);
      CREATE INDEX IF NOT EXISTS idx_rarity ON fanatics_pokemon(rarity);
      CREATE INDEX IF NOT EXISTS idx_condition ON fanatics_pokemon(condition_grade);
    `);
    
    console.log('✅ Database setup complete');
  }

  async initialize() {
    console.log('🎯 FANATICS COLLECT COMPREHENSIVE POKEMON SCRAPER');
    console.log('===============================================');
    console.log('Target: ALL Pokemon cards (active + sold)');
    console.log('Focus: Complete pricing intelligence including sold data');
    console.log('Architecture: Multi-strategy approach with API monitoring\n');
    
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
    console.log('🌐 Setting up comprehensive network monitoring...');
    
    // Monitor ALL network responses for Pokemon data
    this.page.on('response', async (response) => {
      const url = response.url();
      
      try {
        // GraphQL, REST APIs, and JSON endpoints
        if ((url.includes('api') || url.includes('graphql') || url.includes('.json')) && 
            response.status() === 200) {
          
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            await this.processAPIResponse(url, data);
          }
        }
      } catch (error) {
        // Silent fail for non-JSON responses
      }
    });

    // Log important requests
    this.page.on('request', (request) => {
      const url = request.url();
      if (url.includes('pokemon') || url.includes('card') || url.includes('auction')) {
        console.log(`🔍 Pokemon-related request: ${request.method()} ${url}`);
      }
    });
  }

  async processAPIResponse(url, data) {
    try {
      // Look for Pokemon card data in various structures
      const pokemonData = this.extractPokemonFromResponse(data);
      
      if (pokemonData && pokemonData.length > 0) {
        console.log(`✅ Found ${pokemonData.length} Pokemon cards in API response from: ${url}`);
        
        for (const card of pokemonData) {
          await this.processPokemonCard(card, 'api', url);
        }
      }
      
      // Store API response for analysis
      this.apiResponses.push({
        timestamp: new Date().toISOString(),
        url,
        dataCount: pokemonData ? pokemonData.length : 0,
        data: data
      });
      
    } catch (error) {
      console.log(`⚠️  Error processing API response from ${url}: ${error.message}`);
    }
  }

  extractPokemonFromResponse(data) {
    // Multiple possible data structures for Pokemon cards
    const possiblePaths = [
      data.data?.listings,
      data.data?.auctions,
      data.data?.items,
      data.data?.cards,
      data.data?.collectListings,
      data.data?.products,
      data.listings,
      data.auctions,
      data.items,
      data.cards,
      data.results,
      data.collectListings,
      data.products
    ];

    for (const path of possiblePaths) {
      if (Array.isArray(path) && path.length > 0) {
        // Filter for Pokemon-related items
        return path.filter(item => this.isPokemonRelated(item));
      }
    }

    // Check if single item is Pokemon-related
    if (this.isPokemonRelated(data)) {
      return [data];
    }

    return null;
  }

  isPokemonRelated(item) {
    const text = JSON.stringify(item).toLowerCase();
    const pokemonIndicators = [
      'pokemon', 'pikachu', 'charizard', 'base set', 'neo', 'gym', 
      'rocket', 'jungle', 'fossil', 'wizards', 'wotc', 'tcg',
      'trading card game', 'psa', 'bgs', 'cgc', 'shadowless',
      'first edition', 'holo', 'holographic', 'promo'
    ];

    return pokemonIndicators.some(indicator => text.includes(indicator));
  }

  async harvestAllPokemon() {
    console.log('🎯 Starting comprehensive Pokemon harvest...');
    
    const targets = [
      // Main Pokemon search pages
      'https://www.fanaticscollect.com/search?query=pokemon',
      'https://www.fanaticscollect.com/search?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
      'https://www.fanaticscollect.com/search?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese)',
      
      // Auction sections
      'https://www.fanaticscollect.com/auctions?query=pokemon',
      'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
      
      // Sold/completed listings - MOST IMPORTANT for pricing intelligence
      'https://www.fanaticscollect.com/sold?query=pokemon',
      'https://www.fanaticscollect.com/completed?query=pokemon',
      
      // Browse by popular sets
      'https://www.fanaticscollect.com/search?query=base+set+pokemon',
      'https://www.fanaticscollect.com/search?query=neo+genesis+pokemon',
      'https://www.fanaticscollect.com/search?query=charizard+pokemon',
      'https://www.fanaticscollect.com/search?query=first+edition+pokemon'
    ];

    for (const [index, targetUrl] of targets.entries()) {
      console.log(`\n📄 Processing page ${index + 1}/${targets.length}: ${targetUrl}`);
      
      try {
        await this.harvestPage(targetUrl);
        
        // Rate limiting - respect the platform
        console.log('⏱️  Rate limiting pause...');
        await this.page.waitForTimeout(3000 + Math.random() * 2000);
        
      } catch (error) {
        console.log(`❌ Error processing ${targetUrl}: ${error.message}`);
      }
    }
  }

  async harvestPage(url) {
    console.log(`🌐 Navigating to: ${url}`);
    
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 60000 
      });
      
      // Wait for content to load
      await this.page.waitForTimeout(5000);
      
      console.log('📄 Page loaded, analyzing structure...');
      
      // Multiple strategies to extract data
      await this.scrapeVisibleContent();
      await this.triggerLazyLoading();
      await this.navigatePagination();
      
    } catch (error) {
      console.log(`❌ Page harvest error: ${error.message}`);
    }
  }

  async scrapeVisibleContent() {
    console.log('🔍 Scraping visible Pokemon cards...');
    
    try {
      // Comprehensive list of possible selectors for card items
      const selectors = [
        '[data-testid*="card"]',
        '[data-testid*="listing"]',
        '[data-testid*="auction"]',
        '[data-testid*="item"]',
        '[class*="card"]',
        '[class*="listing"]',
        '[class*="auction"]',
        '[class*="item"]',
        '[class*="product"]',
        '.card-container',
        '.listing-item',
        '.auction-item',
        '.product-card',
        'article',
        '[role="article"]'
      ];

      let foundElements = 0;

      for (const selector of selectors) {
        try {
          const elements = await this.page.$$(selector);
          
          if (elements.length > 0) {
            console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
            
            for (const element of elements.slice(0, 50)) { // Limit to prevent overload
              await this.extractCardFromElement(element);
              foundElements++;
            }
            
            if (foundElements > 10) break; // Found working pattern
          }
        } catch (error) {
          // Continue with next selector
        }
      }
      
      console.log(`📊 Processed ${foundElements} visible elements`);
      
    } catch (error) {
      console.log(`❌ Visible content scraping error: ${error.message}`);
    }
  }

  async extractCardFromElement(element) {
    try {
      const cardData = await element.evaluate((el) => {
        // Extract comprehensive data from element
        const getText = (selector) => {
          const elem = el.querySelector(selector);
          return elem ? elem.textContent.trim() : null;
        };

        const getAllText = () => el.textContent || '';
        const getHTML = () => el.innerHTML || '';
        
        // Look for various data patterns
        const text = getAllText();
        const html = getHTML();
        
        // Price extraction
        const priceMatches = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
        
        // Status indicators
        const isSold = /sold|ended|completed/i.test(text);
        const isActive = /active|live|bidding/i.test(text);
        
        // Pokemon indicators
        const isPokemon = /pokemon|pikachu|charizard|base set|neo|gym|rocket|tcg/i.test(text);
        
        return {
          title: getText('h1, h2, h3, .title, [class*="title"]') || text.split('\n')[0],
          fullText: text,
          html: html,
          prices: priceMatches,
          isSold: isSold,
          isActive: isActive,
          isPokemon: isPokemon,
          links: Array.from(el.querySelectorAll('a')).map(a => a.href)
        };
      });

      if (cardData.isPokemon) {
        await this.processPokemonCard(cardData, 'page_scrape');
      }
      
    } catch (error) {
      console.log(`⚠️  Element extraction error: ${error.message}`);
    }
  }

  async triggerLazyLoading() {
    console.log('📜 Triggering lazy loading and pagination...');
    
    try {
      // Scroll to trigger lazy loading
      for (let i = 0; i < 5; i++) {
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        await this.page.waitForTimeout(2000);
        
        // Look for "Load More" buttons
        const loadMoreButtons = await this.page.$$('button:has-text("Load"), button:has-text("More"), button:has-text("Show")');
        
        for (const button of loadMoreButtons) {
          try {
            await button.click();
            await this.page.waitForTimeout(3000);
            console.log('✅ Clicked load more button');
          } catch (error) {
            // Continue if button not clickable
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️  Lazy loading error: ${error.message}`);
    }
  }

  async navigatePagination() {
    console.log('📖 Checking for pagination...');
    
    try {
      // Look for pagination elements
      const paginationSelectors = [
        'a:has-text("Next")',
        'button:has-text("Next")',
        '[aria-label*="next"]',
        '.pagination a',
        '[class*="pagination"] a'
      ];

      for (const selector of paginationSelectors) {
        try {
          const nextButton = await this.page.$(selector);
          
          if (nextButton) {
            console.log(`✅ Found pagination with selector: ${selector}`);
            
            // Navigate up to 5 pages to get more data
            for (let page = 2; page <= 5; page++) {
              try {
                await nextButton.click();
                await this.page.waitForTimeout(5000);
                
                console.log(`📄 Navigated to page ${page}, collecting data...`);
                await this.scrapeVisibleContent();
                
                // Check if still has next button
                const stillHasNext = await this.page.$(selector);
                if (!stillHasNext) break;
                
              } catch (error) {
                console.log(`❌ Pagination error on page ${page}: ${error.message}`);
                break;
              }
            }
            
            break; // Found working pagination
          }
        } catch (error) {
          // Try next selector
        }
      }
      
    } catch (error) {
      console.log(`⚠️  Pagination navigation error: ${error.message}`);
    }
  }

  async processPokemonCard(cardData, source, sourceUrl = '') {
    try {
      // Generate unique ID
      const id = this.generateCardId(cardData);
      
      // Skip duplicates
      if (this.seenCards.has(id)) {
        return;
      }
      
      this.seenCards.add(id);
      
      // Parse and clean data
      const cleanData = this.parseCardData(cardData);
      
      // Store in database
      await this.storeCard(id, cleanData, source);
      
      // Update statistics
      this.updateStatistics(cleanData);
      
      console.log(`💾 Processed: ${cleanData.title?.substring(0, 60)}... [${source}]`);
      
    } catch (error) {
      console.log(`❌ Error processing Pokemon card: ${error.message}`);
    }
  }

  generateCardId(cardData) {
    const title = cardData.title || cardData.fullText?.substring(0, 100) || 'unknown';
    const price = cardData.prices?.[0] || '';
    return `fanatics_${Buffer.from(title + price).toString('base64').substring(0, 20)}`;
  }

  parseCardData(raw) {
    const text = raw.fullText || raw.title || '';
    
    return {
      title: this.extractTitle(raw),
      description: text.substring(0, 1000),
      currentPrice: this.extractCurrentPrice(raw),
      soldPrice: this.extractSoldPrice(raw),
      listingStatus: this.extractStatus(raw),
      setName: this.extractSetName(text),
      pokemonName: this.extractPokemonName(text),
      certification: this.extractCertification(text),
      condition: this.extractCondition(text),
      rarity: this.extractRarity(text),
      year: this.extractYear(text),
      cardNumber: this.extractCardNumber(text),
      imageUrls: this.extractImages(raw),
      listingUrl: this.extractUrl(raw),
      rawData: JSON.stringify(raw)
    };
  }

  extractTitle(data) {
    return data.title || 
           data.fullText?.split('\n')[0] || 
           'Unknown Pokemon Card';
  }

  extractCurrentPrice(data) {
    if (!data.prices || data.prices.length === 0) return null;
    
    const price = data.prices[0].replace(/[$,]/g, '');
    return parseFloat(price) || null;
  }

  extractSoldPrice(data) {
    if (!data.isSold || !data.prices) return null;
    
    // If it's sold, current price is actually sold price
    return this.extractCurrentPrice(data);
  }

  extractStatus(data) {
    if (data.isSold) return 'sold';
    if (data.isActive) return 'active';
    return 'unknown';
  }

  extractSetName(text) {
    const setPatterns = [
      /base set/i,
      /jungle/i,
      /fossil/i,
      /team rocket/i,
      /neo genesis/i,
      /neo discovery/i,
      /gym heroes/i,
      /gym challenge/i,
      /aquapolis/i,
      /skyridge/i
    ];

    for (const pattern of setPatterns) {
      if (pattern.test(text)) {
        return text.match(pattern)[0];
      }
    }

    return null;
  }

  extractPokemonName(text) {
    const pokemonNames = [
      'charizard', 'blastoise', 'venusaur', 'pikachu', 'raichu',
      'alakazam', 'machamp', 'gengar', 'dragonite', 'mew', 'mewtwo'
    ];

    for (const name of pokemonNames) {
      if (text.toLowerCase().includes(name)) {
        return name;
      }
    }

    return null;
  }

  extractCertification(text) {
    const certPatterns = [
      /PSA\s*(\d+(?:\.\d+)?)/i,
      /BGS\s*(\d+(?:\.\d+)?)/i,
      /CGC\s*(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of certPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  extractCondition(text) {
    const conditions = ['mint', 'near mint', 'excellent', 'very good', 'good', 'fair', 'poor'];
    
    for (const condition of conditions) {
      if (text.toLowerCase().includes(condition)) {
        return condition;
      }
    }

    return null;
  }

  extractRarity(text) {
    const rarities = ['common', 'uncommon', 'rare', 'holo', 'holographic', 'promo', 'secret rare'];
    
    for (const rarity of rarities) {
      if (text.toLowerCase().includes(rarity)) {
        return rarity;
      }
    }

    return null;
  }

  extractYear(text) {
    const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
    return yearMatch ? parseInt(yearMatch[1]) : null;
  }

  extractCardNumber(text) {
    const numberMatch = text.match(/\b(\d{1,3})\/(\d{1,3})\b/);
    return numberMatch ? numberMatch[0] : null;
  }

  extractImages(data) {
    const html = data.html || '';
    const imageMatches = html.match(/https?:\/\/[^"\s]+\.(jpg|jpeg|png|webp)/gi);
    
    if (imageMatches && imageMatches.length > 0) {
      return JSON.stringify(imageMatches.slice(0, 3));
    }
    
    return null;
  }

  extractUrl(data) {
    if (data.links && data.links.length > 0) {
      return data.links.find(link => link.includes('fanatics')) || data.links[0];
    }
    
    return null;
  }

  async storeCard(id, data, source) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO fanatics_pokemon (
        id, title, description, current_price, sold_price, listing_status,
        set_name, pokemon_name, certification, condition_grade, rarity,
        year, card_number, image_urls, listing_url, raw_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, data.title, data.description, data.currentPrice, data.soldPrice,
      data.listingStatus, data.setName, data.pokemonName, data.certification,
      data.condition, data.rarity, data.year, data.cardNumber,
      data.imageUrls, data.listingUrl, data.rawData
    );
  }

  updateStatistics(data) {
    this.results.totalCards++;
    
    if (data.listingStatus === 'active') {
      this.results.activeListings++;
    } else if (data.listingStatus === 'sold') {
      this.results.soldListings++;
    }
    
    // Price ranges
    const price = data.currentPrice || data.soldPrice || 0;
    if (price < 50) this.results.priceRanges.under50++;
    else if (price < 200) this.results.priceRanges.under200++;
    else if (price < 1000) this.results.priceRanges.under1000++;
    else if (price < 5000) this.results.priceRanges.under5000++;
    else this.results.priceRanges.over5000++;
    
    this.results.totalValue += price;
    
    // Track sets, rarities, conditions
    if (data.setName) {
      this.results.sets.set(data.setName, (this.results.sets.get(data.setName) || 0) + 1);
    }
    if (data.rarity) {
      this.results.rarities.set(data.rarity, (this.results.rarities.get(data.rarity) || 0) + 1);
    }
    if (data.condition) {
      this.results.conditions.set(data.condition, (this.results.conditions.get(data.condition) || 0) + 1);
    }
  }

  async generateComprehensiveReport() {
    console.log('\n📊 FANATICS COMPLETE POKEMON HARVEST REPORT');
    console.log('=========================================');
    
    console.log(`🎯 Total Pokemon Cards: ${this.results.totalCards.toLocaleString()}`);
    console.log(`🔴 Active Listings: ${this.results.activeListings.toLocaleString()}`);
    console.log(`✅ Sold Listings: ${this.results.soldListings.toLocaleString()}`);
    console.log(`💰 Total Market Value: $${this.results.totalValue.toLocaleString()}`);
    
    if (this.results.totalCards > 0) {
      const avgPrice = this.results.totalValue / this.results.totalCards;
      console.log(`📈 Average Price: $${avgPrice.toFixed(2)}`);
    }
    
    console.log('\n💰 Price Distribution:');
    console.log(`   Under $50: ${this.results.priceRanges.under50.toLocaleString()}`);
    console.log(`   $50-$200: ${this.results.priceRanges.under200.toLocaleString()}`);
    console.log(`   $200-$1,000: ${this.results.priceRanges.under1000.toLocaleString()}`);
    console.log(`   $1,000-$5,000: ${this.results.priceRanges.under5000.toLocaleString()}`);
    console.log(`   Over $5,000: ${this.results.priceRanges.over5000.toLocaleString()}`);
    
    // Top sets
    console.log('\n📚 Top Pokemon Sets:');
    const topSets = Array.from(this.results.sets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    topSets.forEach(([set, count]) => {
      console.log(`   ${set}: ${count.toLocaleString()} cards`);
    });
    
    // Database analytics
    const dbStats = this.getDatabaseAnalytics();
    console.log('\n📊 Database Analytics:');
    console.log(`   Total records: ${dbStats.totalRecords.toLocaleString()}`);
    console.log(`   Records with sold prices: ${dbStats.soldRecords.toLocaleString()}`);
    console.log(`   Average sold price: $${dbStats.avgSoldPrice}`);
    console.log(`   Highest sold price: $${dbStats.maxSoldPrice}`);
    console.log(`   Certified cards: ${dbStats.certifiedCards.toLocaleString()}`);
    
    // Save comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        ...this.results,
        sets: Object.fromEntries(this.results.sets),
        rarities: Object.fromEntries(this.results.rarities),
        conditions: Object.fromEntries(this.results.conditions)
      },
      databaseAnalytics: dbStats,
      apiResponses: this.apiResponses.length,
      integration: {
        status: 'Ready for PokeDAO integration',
        nextSteps: [
          'Cross-reference with eBay sold prices',
          'Compare with TCGPlayer market values', 
          'Identify arbitrage opportunities',
          'Build comprehensive pricing model'
        ]
      }
    };
    
    const filename = `fanatics-complete-pokemon-report-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Complete report saved: ${filename}`);
    console.log('🔗 Ready for integration with PokeDAO pricing intelligence!');
  }

  getDatabaseAnalytics() {
    const totalRecords = this.db.prepare('SELECT COUNT(*) as count FROM fanatics_pokemon').get().count;
    const soldRecords = this.db.prepare('SELECT COUNT(*) as count FROM fanatics_pokemon WHERE sold_price IS NOT NULL').get().count;
    
    const avgSoldPrice = this.db.prepare('SELECT AVG(sold_price) as avg FROM fanatics_pokemon WHERE sold_price IS NOT NULL').get().avg;
    const maxSoldPrice = this.db.prepare('SELECT MAX(sold_price) as max FROM fanatics_pokemon WHERE sold_price IS NOT NULL').get().max;
    
    const certifiedCards = this.db.prepare('SELECT COUNT(*) as count FROM fanatics_pokemon WHERE certification IS NOT NULL').get().count;
    
    return {
      totalRecords,
      soldRecords,
      avgSoldPrice: avgSoldPrice ? parseFloat(avgSoldPrice).toFixed(2) : '0.00',
      maxSoldPrice: maxSoldPrice ? parseFloat(maxSoldPrice).toFixed(2) : '0.00',
      certifiedCards
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
      await this.harvestAllPokemon();
      await this.generateComprehensiveReport();
      
      console.log('\n✅ Fanatics Complete Pokemon harvest finished!');
      console.log('🎯 All Pokemon cards including sold data collected');
      console.log('🔗 Ready for PokeDAO market intelligence integration');
      
    } catch (error) {
      console.log(`❌ Harvest failed: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the comprehensive scraper
if (require.main === module) {
  const scraper = new FanaticsComprehensiveScraper();
  scraper.run().catch(console.error);
}

module.exports = FanaticsComprehensiveScraper;
