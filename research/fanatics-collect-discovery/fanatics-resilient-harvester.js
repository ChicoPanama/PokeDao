#!/usr/bin/env node
/**
 * 🎯 FANATICS COLLECT RESILIENT POKEMON HARVESTER
 * ===============================================
 * 
 * OPTIMIZED FOR RELIABILITY WITH AGGRESSIVE FALLBACK STRATEGIES
 * Designed to handle network timeouts and site protections
 */

const { chromium } = require('playwright');
const Database = require('better-sqlite3');
const fs = require('fs');

class FanaticsResilientHarvester {
    constructor() {
        this.db = null;
        this.browser = null;
        this.page = null;
        this.harvestedCount = 0;
        this.retryAttempts = 3;
        this.shortTimeout = 10000;  // 10 seconds
        this.mediumTimeout = 20000; // 20 seconds
        
        // Simplified but comprehensive extraction targets
        this.pokemonSearches = [
            'pokemon',
            'pikachu', 
            'charizard',
            'base set',
            'shadowless',
            'first edition'
        ];
    }

    async initialize() {
        console.log('🎯 FANATICS RESILIENT POKEMON HARVESTER');
        console.log('=======================================');
        console.log('🛡️ Optimized for reliability and fallback strategies');
        
        this.setupDatabase();
        
        // Launch with more aggressive settings for reliability
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Set shorter timeouts and more realistic headers
        await this.page.setDefaultTimeout(this.shortTimeout);
        await this.page.setDefaultNavigationTimeout(this.mediumTimeout);
        
        await this.page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        // Simple network monitoring
        this.page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('pokemon') || url.includes('card') || url.includes('auction')) {
                console.log(`🔍 Pokemon-related response: ${url.substring(0, 80)}...`);
                await this.tryExtractFromResponse(response);
            }
        });
        
        console.log('✅ Resilient harvester initialized');
    }

    setupDatabase() {
        this.db = new Database('fanatics-resilient-pokemon.db');
        
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pokemon_cards (
                id TEXT PRIMARY KEY,
                name TEXT,
                price REAL,
                image_url TEXT,
                detail_url TEXT,
                description TEXT,
                extraction_method TEXT,
                source_url TEXT,
                harvest_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Resilient database setup complete');
    }

    async tryExtractFromResponse(response) {
        try {
            const contentType = response.headers()['content-type'] || '';
            
            if (contentType.includes('application/json')) {
                const data = await response.json();
                
                if (data && typeof data === 'object') {
                    await this.extractPokemonFromData(data, response.url());
                }
            }
        } catch (error) {
            // Silent fail for response extraction
        }
    }

    async extractPokemonFromData(data, sourceUrl) {
        let count = 0;
        
        const processItem = (item, path = '') => {
            if (!item || typeof item !== 'object') return;
            
            const itemStr = JSON.stringify(item).toLowerCase();
            
            if (this.isPokemonData(itemStr)) {
                this.savePokemonFromApiData(item, sourceUrl);
                count++;
            }
            
            // Recursively check nested objects and arrays
            for (const key in item) {
                const value = item[key];
                if (Array.isArray(value)) {
                    value.forEach((arrayItem, index) => {
                        processItem(arrayItem, `${path}.${key}[${index}]`);
                    });
                } else if (value && typeof value === 'object') {
                    processItem(value, `${path}.${key}`);
                }
            }
        };
        
        processItem(data);
        
        if (count > 0) {
            console.log(`✅ Extracted ${count} Pokemon items from API response`);
        }
    }

    isPokemonData(dataString) {
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'bulbasaur', 'squirtle',
            'base set', 'jungle', 'fossil', 'shadowless', 'first edition',
            'neo genesis', 'team rocket', 'gym heroes'
        ];
        
        return pokemonIndicators.some(indicator => dataString.includes(indicator));
    }

    async executeResilientExtraction() {
        console.log('🎯 Starting resilient multi-strategy extraction...');
        
        // Strategy 1: Direct Pokemon searches
        await this.executeDirectSearches();
        
        // Strategy 2: Category browsing  
        await this.browsePokemonCategories();
        
        // Strategy 3: Auction exploration
        await this.exploreAuctions();
        
        // Strategy 4: Page enumeration
        await this.enumeratePages();
        
        console.log('✅ Resilient extraction completed');
    }

    async executeDirectSearches() {
        console.log('🔥 STRATEGY 1: Direct Pokemon Searches');
        
        for (const search of this.pokemonSearches) {
            console.log(`🔍 Searching for: ${search}`);
            
            const success = await this.retryOperation(async () => {
                const searchUrl = `https://www.fanaticscollect.com/search?query=${encodeURIComponent(search)}`;
                await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
                await this.delay(2000);
                
                // Quick scroll to trigger any lazy loading
                await this.page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight / 2);
                });
                await this.delay(1000);
                
                return await this.extractCurrentPageData();
            });
            
            if (success) {
                console.log(`✅ Successfully processed search: ${search}`);
            } else {
                console.log(`⚠️ Could not process search: ${search}`);
            }
            
            await this.delay(3000); // Rate limiting
        }
    }

    async browsePokemonCategories() {
        console.log('🔥 STRATEGY 2: Pokemon Category Browsing');
        
        const categories = [
            'https://www.fanaticscollect.com/search?category=Trading+Card+Games',
            'https://www.fanaticscollect.com/auctions',
            'https://www.fanaticscollect.com/sold',
            'https://www.fanaticscollect.com/completed'
        ];
        
        for (const categoryUrl of categories) {
            console.log(`🎯 Browsing category: ${categoryUrl}`);
            
            const success = await this.retryOperation(async () => {
                await this.page.goto(categoryUrl, { waitUntil: 'domcontentloaded' });
                await this.delay(2000);
                
                // Try to filter to Pokemon if possible
                try {
                    await this.page.fill('input[type="search"], [placeholder*="search"]', 'pokemon');
                    await this.page.press('input[type="search"], [placeholder*="search"]', 'Enter');
                    await this.delay(3000);
                } catch (error) {
                    // No search box found, continue anyway
                }
                
                return await this.extractCurrentPageData();
            });
            
            if (success) {
                console.log(`✅ Successfully browsed category`);
            }
            
            await this.delay(5000); // Longer delay between categories
        }
    }

    async exploreAuctions() {
        console.log('🔥 STRATEGY 3: Auction Exploration');
        
        const success = await this.retryOperation(async () => {
            await this.page.goto('https://www.fanaticscollect.com/auctions?query=pokemon', {
                waitUntil: 'domcontentloaded'
            });
            await this.delay(3000);
            
            return await this.extractAuctionData();
        });
        
        if (success) {
            console.log('✅ Auction exploration completed');
        }
    }

    async enumeratePages() {
        console.log('🔥 STRATEGY 4: Page Enumeration');
        
        // Try systematic page enumeration with Pokemon query
        for (let page = 1; page <= 10; page++) {
            console.log(`📄 Processing page ${page}/10`);
            
            const success = await this.retryOperation(async () => {
                const pageUrl = `https://www.fanaticscollect.com/search?query=pokemon&page=${page}`;
                await this.page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
                await this.delay(2000);
                
                const extracted = await this.extractCurrentPageData();
                
                if (extracted === 0) {
                    console.log(`📄 No data on page ${page}, stopping enumeration`);
                    return false; // Stop pagination
                }
                
                return true;
            });
            
            if (!success) break;
            
            await this.delay(4000); // Rate limiting between pages
        }
    }

    async retryOperation(operation, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                return result;
            } catch (error) {
                console.log(`⚠️ Attempt ${attempt}/${maxRetries} failed: ${error.message.substring(0, 50)}...`);
                
                if (attempt === maxRetries) {
                    console.log(`❌ All ${maxRetries} attempts failed`);
                    return false;
                }
                
                // Wait longer between retries
                await this.delay(attempt * 2000);
            }
        }
        
        return false;
    }

    async extractCurrentPageData() {
        const cards = await this.page.evaluate(() => {
            const selectors = [
                '[data-testid*="card"]',
                '.card',
                '[class*="card"]',
                '.auction-item',
                '[class*="item"]',
                'article',
                '[class*="listing"]'
            ];
            
            const extractedCards = [];
            
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                
                elements.forEach((element, index) => {
                    try {
                        const text = element.textContent?.toLowerCase() || '';
                        
                        // Only process if contains Pokemon-related terms
                        if (text.includes('pokemon') || text.includes('pikachu') || text.includes('charizard')) {
                            const card = {
                                id: `page_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                                name: element.querySelector('h1, h2, h3, .title, [class*="name"]')?.textContent?.trim() || 'Pokemon Card',
                                price: element.querySelector('[class*="price"], .price, [class*="bid"]')?.textContent?.trim() || '0',
                                image: element.querySelector('img')?.src || '',
                                link: element.querySelector('a')?.href || window.location.href,
                                description: text.substring(0, 200)
                            };
                            
                            extractedCards.push(card);
                        }
                    } catch (error) {
                        // Skip problematic elements
                    }
                });
                
                if (extractedCards.length > 0) break; // Found data with this selector
            }
            
            return extractedCards;
        });
        
        // Save extracted cards
        for (const card of cards) {
            this.savePokemonCard(card, 'page_extraction', this.page.url());
        }
        
        console.log(`📊 Extracted ${cards.length} Pokemon cards from page`);
        return cards.length;
    }

    async extractAuctionData() {
        const auctions = await this.page.evaluate(() => {
            const auctionElements = document.querySelectorAll('*');
            const extractedAuctions = [];
            
            auctionElements.forEach((element, index) => {
                try {
                    const text = element.textContent?.toLowerCase() || '';
                    
                    if ((text.includes('pokemon') || text.includes('pikachu')) && 
                        (text.includes('auction') || text.includes('bid') || text.includes('$'))) {
                        
                        const auction = {
                            id: `auction_${Date.now()}_${index}`,
                            name: element.querySelector('h1, h2, h3, .title')?.textContent?.trim() || 'Pokemon Auction',
                            currentBid: text.match(/\$[\d,]+\.?\d*/)?.[0] || '0',
                            description: text.substring(0, 150)
                        };
                        
                        extractedAuctions.push(auction);
                    }
                } catch (error) {
                    // Skip problematic elements
                }
            });
            
            return extractedAuctions.slice(0, 20); // Limit to 20 to avoid duplicates
        });
        
        for (const auction of auctions) {
            this.savePokemonCard(auction, 'auction_extraction', this.page.url());
        }
        
        console.log(`⏰ Extracted ${auctions.length} Pokemon auctions`);
        return auctions.length;
    }

    savePokemonCard(cardData, method, sourceUrl) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO pokemon_cards (
                    id, name, price, image_url, detail_url, 
                    description, extraction_method, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const price = this.extractPrice(cardData.price || cardData.currentBid || '0');
            
            stmt.run(
                cardData.id || `card_${Date.now()}_${Math.random()}`,
                cardData.name || 'Pokemon Card',
                price,
                cardData.image || '',
                cardData.link || sourceUrl,
                cardData.description || '',
                method,
                sourceUrl
            );
            
            this.harvestedCount++;
            
            if (this.harvestedCount % 25 === 0) {
                console.log(`💾 Total cards saved: ${this.harvestedCount}`);
            }
            
        } catch (error) {
            // Silent save errors to avoid spam
        }
    }

    savePokemonFromApiData(data, sourceUrl) {
        try {
            const card = {
                id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: data.name || data.title || 'API Pokemon Card',
                price: data.price || data.currentBid || data.bid || 0,
                image: data.image || data.imageUrl || '',
                link: data.url || data.link || sourceUrl,
                description: JSON.stringify(data).substring(0, 200)
            };
            
            this.savePokemonCard(card, 'api_extraction', sourceUrl);
            
        } catch (error) {
            // Silent API save errors
        }
    }

    extractPrice(priceString) {
        if (!priceString) return 0;
        
        const cleanPrice = priceString.toString()
            .replace(/[^\d.,]/g, '')
            .replace(/,/g, '');
            
        return parseFloat(cleanPrice) || 0;
    }

    async generateFinalReport() {
        console.log('📊 Generating comprehensive extraction report...');
        
        const totalCards = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get();
        const byMethod = this.db.prepare('SELECT extraction_method, COUNT(*) as count FROM pokemon_cards GROUP BY extraction_method').all();
        const avgPrice = this.db.prepare('SELECT AVG(price) as avg FROM pokemon_cards WHERE price > 0').get();
        const maxPrice = this.db.prepare('SELECT MAX(price) as max FROM pokemon_cards WHERE price > 0').get();
        
        const report = {
            timestamp: new Date().toISOString(),
            harvester_type: 'Resilient Multi-Strategy',
            extraction_results: {
                total_pokemon_cards: totalCards.count,
                extraction_methods: byMethod,
                pricing_analysis: {
                    average_price: avgPrice.avg?.toFixed(2) || '0.00',
                    highest_price: maxPrice.max?.toFixed(2) || '0.00'
                }
            },
            integration_status: {
                database_file: 'fanatics-resilient-pokemon.db',
                ready_for_pokedao: true,
                next_steps: [
                    'Cross-reference with existing 694K+ card database',
                    'Identify Fanatics-unique pricing data', 
                    'Build comprehensive market analysis',
                    'Deploy arbitrage detection algorithms'
                ]
            }
        };
        
        const reportPath = `fanatics-resilient-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('📊 FANATICS RESILIENT EXTRACTION COMPLETE');
        console.log('=========================================');
        console.log(`🎯 Pokemon Cards Extracted: ${totalCards.count.toLocaleString()}`);
        console.log(`💰 Average Price: $${avgPrice.avg?.toFixed(2) || '0.00'}`);
        console.log(`💎 Highest Price: $${maxPrice.max?.toFixed(2) || '0.00'}`);
        console.log(`📄 Report: ${reportPath}`);
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
    const harvester = new FanaticsResilientHarvester();
    
    try {
        await harvester.initialize();
        await harvester.executeResilientExtraction();
        await harvester.generateFinalReport();
        
    } catch (error) {
        console.error('❌ Resilient harvester error:', error.message);
    } finally {
        await harvester.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsResilientHarvester;
