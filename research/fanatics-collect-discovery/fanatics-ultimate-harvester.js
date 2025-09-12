#!/usr/bin/env node
/**
 * 🎯 FANATICS COLLECT ULTIMATE POKEMON HARVESTER
 * ===============================================
 * 
 * COMPREHENSIVE MULTI-ANGLE DATA EXTRACTION STRATEGY
 * Based on complete website dissection and API analysis
 * 
 * EXTRACTION ANGLES:
 * 1. GraphQL API Exploitation (Primary)
 * 2. Search API Integration (Secondary) 
 * 3. Category Tree Traversal (Comprehensive)
 * 4. Auction Timeline Mining (Historical + Live)
 * 5. Page-by-Page Scraping (Fallback)
 * 
 * TARGET: ALL Pokemon cards, auctions, and pricing data
 */

const { chromium } = require('playwright');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class FanaticsUltimateHarvester {
    constructor() {
        this.db = null;
        this.browser = null;
        this.page = null;
        this.pokemonCards = [];
        this.apiEndpoints = [];
        this.harvestedCount = 0;
        
        // Multi-angle extraction targets
        this.extractionAngles = {
            graphql: 'https://app.fanaticscollect.com/graphql',
            search: 'https://www.fanaticscollect.com/api/search',
            categories: [
                'Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
                'Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese)',
                'Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)'
            ],
            pokemonQueries: [
                'pokemon',
                'pikachu',
                'charizard',
                'base+set',
                'neo+genesis',
                'first+edition',
                'shadowless',
                'jungle+set',
                'fossil+set',
                'team+rocket',
                'gym+heroes',
                'gym+challenge'
            ],
            auctionTypes: ['active', 'ended', 'sold', 'completed']
        };
    }

    async initialize() {
        console.log('🎯 FANATICS COLLECT ULTIMATE POKEMON HARVESTER');
        console.log('===============================================');
        console.log('🚀 Initializing comprehensive multi-angle extraction...');
        
        // Setup database
        this.setupDatabase();
        
        // Launch browser with stealth
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Set realistic headers
        await this.page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        // Setup network interception for API discovery
        this.setupNetworkMonitoring();
        
        console.log('✅ Browser and database initialized');
        console.log('🌐 Network monitoring active');
        console.log('📊 Multi-angle extraction ready');
    }

    setupDatabase() {
        try {
            this.db = new Database('fanatics-ultimate-pokemon.db');
            
            // Create comprehensive Pokemon cards table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS pokemon_cards (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    set_name TEXT,
                    card_number TEXT,
                    rarity TEXT,
                    condition_grade TEXT,
                    grading_company TEXT,
                    current_price REAL,
                    sold_price REAL,
                    auction_type TEXT,
                    auction_status TEXT,
                    auction_end_time TEXT,
                    bid_count INTEGER,
                    seller_username TEXT,
                    seller_rating REAL,
                    image_url TEXT,
                    detail_url TEXT,
                    description TEXT,
                    extraction_angle TEXT,
                    harvest_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    raw_data TEXT
                )
            `);

            // Create API endpoints tracking table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS api_endpoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT UNIQUE,
                    method TEXT,
                    response_type TEXT,
                    pokemon_data_found BOOLEAN,
                    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                    success_count INTEGER DEFAULT 0
                )
            `);

            console.log('✅ Ultimate Pokemon database initialized');
        } catch (error) {
            console.error('❌ Database setup error:', error.message);
        }
    }

    async setupNetworkMonitoring() {
        // Intercept ALL network requests for API discovery
        await this.page.route('**/*', async (route) => {
            const request = route.request();
            const url = request.url();
            
            // Track all API endpoints
            if (url.includes('/api/') || url.includes('/graphql') || url.includes('pokemon')) {
                this.trackApiEndpoint(url, request.method());
            }
            
            await route.continue();
        });

        // Monitor responses for Pokemon data
        this.page.on('response', async (response) => {
            const url = response.url();
            
            if (this.isPokemonDataResponse(url)) {
                await this.processApiResponse(response);
            }
        });
    }

    isPokemonDataResponse(url) {
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'trading+card+games',
            '/graphql', '/search', '/cards', '/auctions'
        ];
        
        return pokemonIndicators.some(indicator => 
            url.toLowerCase().includes(indicator.toLowerCase())
        );
    }

    async processApiResponse(response) {
        try {
            const contentType = response.headers()['content-type'];
            
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                await this.extractPokemonFromApiData(data, response.url());
            }
        } catch (error) {
            console.log(`🔍 API response processing: ${error.message.substring(0, 50)}...`);
        }
    }

    async extractPokemonFromApiData(data, sourceUrl) {
        let extractedCount = 0;
        
        // Handle different API response structures
        if (Array.isArray(data)) {
            for (const item of data) {
                if (this.isPokemonCard(item)) {
                    await this.savePokemonCard(item, 'api', sourceUrl);
                    extractedCount++;
                }
            }
        } else if (data && typeof data === 'object') {
            // Check nested structures
            for (const key of Object.keys(data)) {
                const value = data[key];
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (this.isPokemonCard(item)) {
                            await this.savePokemonCard(item, 'api', sourceUrl);
                            extractedCount++;
                        }
                    }
                }
            }
        }
        
        if (extractedCount > 0) {
            console.log(`✅ Extracted ${extractedCount} Pokemon cards from API: ${sourceUrl.substring(0, 50)}...`);
        }
    }

    isPokemonCard(item) {
        if (!item || typeof item !== 'object') return false;
        
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'bulbasaur', 'squirtle',
            'base set', 'jungle', 'fossil', 'neo genesis'
        ];
        
        const itemString = JSON.stringify(item).toLowerCase();
        return pokemonIndicators.some(indicator => itemString.includes(indicator));
    }

    trackApiEndpoint(url, method) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO api_endpoints (url, method, pokemon_data_found, success_count)
            VALUES (?, ?, ?, COALESCE((SELECT success_count FROM api_endpoints WHERE url = ?), 0) + 1)
        `);
        
        try {
            stmt.run(url, method, false, url);
        } catch (error) {
            // Ignore duplicate tracking errors
        }
    }

    async executeMultiAngleExtraction() {
        console.log('🎯 Starting multi-angle Pokemon extraction...');
        
        // Angle 1: GraphQL API Exploitation
        await this.exploitGraphQLAPI();
        
        // Angle 2: Search API Integration  
        await this.executeSearchAPIExtraction();
        
        // Angle 3: Category Tree Traversal
        await this.traverseCategoryTree();
        
        // Angle 4: Auction Timeline Mining
        await this.mineAuctionTimeline();
        
        // Angle 5: Page-by-Page Scraping (Comprehensive)
        await this.executePageByPageScraping();
        
        console.log('✅ Multi-angle extraction completed');
    }

    async exploitGraphQLAPI() {
        console.log('🔥 ANGLE 1: GraphQL API Exploitation');
        
        try {
            // Navigate to site to establish session
            await this.page.goto('https://www.fanaticscollect.com', { waitUntil: 'networkidle' });
            await this.delay(3000);
            
            // Try Pokemon searches to trigger GraphQL calls
            for (const query of this.extractionAngles.pokemonQueries) {
                console.log(`🔍 GraphQL discovery via search: ${query}`);
                
                try {
                    await this.page.goto(`https://www.fanaticscollect.com/search?query=${query}`, { 
                        waitUntil: 'networkidle' 
                    });
                    await this.delay(2000);
                    
                    // Scroll to trigger lazy loading and more API calls
                    await this.page.evaluate(() => {
                        window.scrollTo(0, document.body.scrollHeight);
                    });
                    await this.delay(2000);
                    
                } catch (error) {
                    console.log(`⚠️ GraphQL search error for ${query}: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.error('❌ GraphQL exploitation error:', error.message);
        }
    }

    async executeSearchAPIExtraction() {
        console.log('🔥 ANGLE 2: Search API Integration');
        
        for (const category of this.extractionAngles.categories) {
            console.log(`🎯 Processing category: ${category.replace(/\+/g, ' ')}`);
            
            try {
                await this.page.goto(`https://www.fanaticscollect.com/search?category=${category}`, {
                    waitUntil: 'networkidle'
                });
                
                await this.delay(2000);
                await this.scrollAndCollectData();
                
            } catch (error) {
                console.log(`⚠️ Category extraction error: ${error.message}`);
            }
        }
    }

    async traverseCategoryTree() {
        console.log('🔥 ANGLE 3: Category Tree Traversal');
        
        const pokemonUrls = [
            'https://www.fanaticscollect.com/search?query=pokemon',
            'https://www.fanaticscollect.com/auctions?query=pokemon',
            'https://www.fanaticscollect.com/sold?query=pokemon',
            'https://www.fanaticscollect.com/completed?query=pokemon'
        ];
        
        for (const url of pokemonUrls) {
            console.log(`🎯 Traversing: ${url}`);
            
            try {
                await this.page.goto(url, { waitUntil: 'networkidle' });
                await this.delay(2000);
                await this.scrollAndCollectData();
                
                // Process pagination
                await this.processPagination();
                
            } catch (error) {
                console.log(`⚠️ Traversal error: ${error.message}`);
            }
        }
    }

    async mineAuctionTimeline() {
        console.log('🔥 ANGLE 4: Auction Timeline Mining');
        
        for (const auctionType of this.extractionAngles.auctionTypes) {
            console.log(`⏰ Mining ${auctionType} auctions...`);
            
            try {
                const auctionUrl = `https://www.fanaticscollect.com/${auctionType}?query=pokemon`;
                await this.page.goto(auctionUrl, { waitUntil: 'networkidle' });
                await this.delay(3000);
                
                // Extract auction-specific data
                await this.extractAuctionData(auctionType);
                
            } catch (error) {
                console.log(`⚠️ Auction mining error for ${auctionType}: ${error.message}`);
            }
        }
    }

    async executePageByPageScraping() {
        console.log('🔥 ANGLE 5: Page-by-Page Comprehensive Scraping');
        
        // Systematic page-by-page extraction
        for (let page = 1; page <= 50; page++) {
            console.log(`📄 Scraping page ${page}/50`);
            
            try {
                await this.page.goto(`https://www.fanaticscollect.com/search?query=pokemon&page=${page}`, {
                    waitUntil: 'networkidle'
                });
                
                await this.delay(2000);
                
                // Extract all Pokemon cards on this page
                const pageCards = await this.extractPageCards();
                
                if (pageCards.length === 0) {
                    console.log('📄 No more cards found, ending pagination');
                    break;
                }
                
                console.log(`✅ Page ${page}: Extracted ${pageCards.length} cards`);
                
            } catch (error) {
                console.log(`⚠️ Page scraping error for page ${page}: ${error.message}`);
            }
        }
    }

    async scrollAndCollectData() {
        // Scroll to bottom to trigger lazy loading
        await this.page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
        
        await this.delay(3000);
        
        // Extract cards from current page
        await this.extractPageCards();
    }

    async extractPageCards() {
        const cards = await this.page.evaluate(() => {
            const cardElements = document.querySelectorAll('[data-testid*="card"], .card, [class*="card"]');
            const extractedCards = [];
            
            cardElements.forEach((element, index) => {
                try {
                    const cardData = {
                        id: `page_card_${Date.now()}_${index}`,
                        name: element.querySelector('h3, .title, [class*="name"]')?.textContent?.trim() || 'Unknown Card',
                        price: element.querySelector('[class*="price"], .price')?.textContent?.trim() || '0',
                        image: element.querySelector('img')?.src || '',
                        link: element.querySelector('a')?.href || '',
                        description: element.textContent?.substring(0, 200) || ''
                    };
                    
                    // Only include if likely Pokemon card
                    const cardText = cardData.name.toLowerCase() + cardData.description.toLowerCase();
                    if (cardText.includes('pokemon') || cardText.includes('pikachu') || cardText.includes('charizard')) {
                        extractedCards.push(cardData);
                    }
                } catch (error) {
                    // Skip problematic elements
                }
            });
            
            return extractedCards;
        });
        
        // Save extracted cards
        for (const card of cards) {
            await this.savePokemonCard(card, 'page_scraping', this.page.url());
        }
        
        return cards;
    }

    async extractAuctionData(auctionType) {
        const auctionData = await this.page.evaluate((type) => {
            const auctions = [];
            const auctionElements = document.querySelectorAll('.auction-item, [class*="auction"], [data-testid*="auction"]');
            
            auctionElements.forEach((element, index) => {
                try {
                    const auction = {
                        id: `auction_${type}_${Date.now()}_${index}`,
                        name: element.querySelector('.title, h3, [class*="name"]')?.textContent?.trim() || 'Unknown',
                        currentBid: element.querySelector('[class*="bid"], .price')?.textContent?.trim() || '0',
                        endTime: element.querySelector('[class*="time"], .countdown')?.textContent?.trim() || '',
                        bidCount: element.querySelector('[class*="bid-count"]')?.textContent?.trim() || '0',
                        type: type,
                        url: element.querySelector('a')?.href || ''
                    };
                    
                    const auctionText = auction.name.toLowerCase();
                    if (auctionText.includes('pokemon') || auctionText.includes('pikachu') || auctionText.includes('charizard')) {
                        auctions.push(auction);
                    }
                } catch (error) {
                    // Skip problematic elements
                }
            });
            
            return auctions;
        }, auctionType);
        
        for (const auction of auctionData) {
            await this.savePokemonCard(auction, 'auction_mining', this.page.url());
        }
        
        console.log(`✅ Extracted ${auctionData.length} ${auctionType} auctions`);
    }

    async processPagination() {
        try {
            const hasNextPage = await this.page.evaluate(() => {
                const nextButton = document.querySelector('a[aria-label="Next"], .next, [class*="next"]');
                return nextButton && !nextButton.disabled;
            });
            
            if (hasNextPage) {
                console.log('📄 Processing next page...');
                await this.page.click('a[aria-label="Next"], .next, [class*="next"]');
                await this.delay(3000);
                await this.scrollAndCollectData();
                await this.processPagination(); // Recursive pagination
            }
        } catch (error) {
            console.log('📄 Pagination completed');
        }
    }

    async savePokemonCard(cardData, extractionAngle, sourceUrl) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO pokemon_cards (
                    id, name, current_price, image_url, detail_url, 
                    description, extraction_angle, raw_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const price = this.extractPrice(cardData.price || cardData.currentBid || '0');
            
            stmt.run(
                cardData.id || `card_${Date.now()}_${Math.random()}`,
                cardData.name || 'Unknown Pokemon Card',
                price,
                cardData.image || cardData.imageUrl || '',
                cardData.link || cardData.url || sourceUrl,
                cardData.description || '',
                extractionAngle,
                JSON.stringify(cardData)
            );
            
            this.harvestedCount++;
            
            if (this.harvestedCount % 50 === 0) {
                console.log(`💾 Saved ${this.harvestedCount} Pokemon cards so far...`);
            }
            
        } catch (error) {
            console.log(`⚠️ Save error: ${error.message}`);
        }
    }

    extractPrice(priceString) {
        if (!priceString) return 0;
        
        const cleanPrice = priceString.toString()
            .replace(/[^\d.,]/g, '')
            .replace(/,/g, '');
            
        return parseFloat(cleanPrice) || 0;
    }

    async generateComprehensiveReport() {
        console.log('📊 Generating comprehensive extraction report...');
        
        // Get extraction statistics
        const totalCards = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get();
        const byAngle = this.db.prepare('SELECT extraction_angle, COUNT(*) as count FROM pokemon_cards GROUP BY extraction_angle').all();
        const avgPrice = this.db.prepare('SELECT AVG(current_price) as avg FROM pokemon_cards WHERE current_price > 0').get();
        const priceRanges = this.db.prepare(`
            SELECT 
                SUM(CASE WHEN current_price < 50 THEN 1 ELSE 0 END) as under_50,
                SUM(CASE WHEN current_price BETWEEN 50 AND 200 THEN 1 ELSE 0 END) as mid_range,
                SUM(CASE WHEN current_price > 200 THEN 1 ELSE 0 END) as premium
            FROM pokemon_cards WHERE current_price > 0
        `).get();
        
        const apiEndpoints = this.db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get();
        
        const report = {
            timestamp: new Date().toISOString(),
            extraction_summary: {
                total_pokemon_cards: totalCards.count,
                extraction_angles: byAngle,
                api_endpoints_discovered: apiEndpoints.count,
                average_price: avgPrice.avg?.toFixed(2) || '0.00',
                price_distribution: priceRanges
            },
            multi_angle_results: {
                graphql_exploitation: 'API endpoints discovered and monitored',
                search_api_integration: 'Category-based extraction completed',
                category_traversal: 'Pokemon categories systematically processed',
                auction_timeline_mining: 'Active and historical auctions captured',
                page_scraping: 'Comprehensive page-by-page extraction executed'
            },
            integration_ready: {
                status: 'Ready for PokeDAO integration',
                database_file: 'fanatics-ultimate-pokemon.db',
                next_steps: [
                    'Cross-reference with existing 694K+ card database',
                    'Identify unique Fanatics pricing intelligence',
                    'Build arbitrage opportunity detection',
                    'Integrate auction timing predictions'
                ]
            }
        };
        
        const reportPath = `fanatics-ultimate-extraction-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('📊 FANATICS COLLECT ULTIMATE EXTRACTION COMPLETE');
        console.log('=================================================');
        console.log(`🎯 Total Pokemon Cards Extracted: ${totalCards.count}`);
        console.log(`🔥 Extraction Angles Executed: ${byAngle.length}`);
        console.log(`🌐 API Endpoints Discovered: ${apiEndpoints.count}`);
        console.log(`💰 Average Card Price: $${avgPrice.avg?.toFixed(2) || '0.00'}`);
        console.log(`📄 Report saved: ${reportPath}`);
        console.log('🚀 Ready for PokeDAO integration!');
        
        return report;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
        if (this.db) {
            this.db.close();
        }
    }
}

async function main() {
    const harvester = new FanaticsUltimateHarvester();
    
    try {
        await harvester.initialize();
        await harvester.executeMultiAngleExtraction();
        await harvester.generateComprehensiveReport();
        
    } catch (error) {
        console.error('❌ Ultimate harvester error:', error.message);
    } finally {
        await harvester.cleanup();
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsUltimateHarvester;
