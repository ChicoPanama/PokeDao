#!/usr/bin/env node
/**
 * 🎯 FANATICS COLLECT ULTIMATE MOBILE INTERCEPTOR
 * ==============================================
 * 
 * COMPREHENSIVE MOBILE API EXTRACTION SYSTEM
 * Leverages every possible angle to extract Fanatics Collect data
 */

const { chromium } = require('playwright');
const Database = require('better-sqlite3');
const fs = require('fs');
const https = require('https');
const http = require('http');

class FanaticsUltimateMobileInterceptor {
    constructor() {
        this.db = null;
        this.browser = null;
        this.page = null;
        this.extractedCards = 0;
        this.discoveredEndpoints = new Set();
        this.authTokens = new Set();
        this.apiResponses = [];
        
        // Mobile app signatures
        this.mobileUserAgents = [
            'Fanatics Collect/1.0 (iPhone; iOS 17.0; Scale/3.0)',
            'Fanatics Collect/1.0 (Android 13; Samsung SM-G991B)',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'Mozilla/5.0 (Android 13; Mobile; rv:110.0) Gecko/110.0 Firefox/110.0'
        ];
        
        // Common mobile API patterns
        this.mobileEndpoints = [
            '/api/v1/cards',
            '/api/v1/auctions',
            '/api/v1/search',
            '/api/v1/pokemon',
            '/mobile/api/cards',
            '/mobile/api/auctions',
            '/mobile/search',
            '/app/api/v1/cards',
            '/app/api/v1/auctions',
            '/rest/v1/cards',
            '/rest/v1/auctions',
            '/graphql',
            '/api/cards/search',
            '/api/auctions/search',
            '/api/collectibles',
            '/api/marketplace',
            '/v1/cards',
            '/v1/auctions',
            '/v2/cards',
            '/v2/auctions'
        ];
    }

    async initialize() {
        console.log('🎯 FANATICS ULTIMATE MOBILE INTERCEPTOR');
        console.log('=======================================');
        console.log('🔥 Leveraging every possible extraction angle');
        
        this.setupDatabase();
        
        // Launch browser with mobile simulation
        this.browser = await chromium.launch({
            headless: false, // Show for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--user-agent=' + this.mobileUserAgents[0]
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Simulate mobile device
        await this.page.setViewportSize({ width: 375, height: 812 }); // iPhone 13
        await this.page.setUserAgent(this.mobileUserAgents[0]);
        
        // Intercept ALL network traffic
        await this.setupNetworkInterception();
        
        console.log('✅ Ultimate mobile interceptor initialized');
    }

    setupDatabase() {
        this.db = new Database('fanatics-ultimate-mobile-data.db');
        
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
                api_endpoint TEXT,
                raw_data TEXT,
                harvest_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS api_endpoints (
                endpoint TEXT PRIMARY KEY,
                method TEXT,
                response_type TEXT,
                auth_required BOOLEAN,
                data_count INTEGER,
                discovery_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token_type TEXT,
                token_value TEXT,
                endpoint TEXT,
                discovery_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log('✅ Ultimate mobile database initialized');
    }

    async setupNetworkInterception() {
        // Intercept ALL requests and responses
        await this.page.route('**/*', async (route, request) => {
            const url = request.url();
            const method = request.method();
            
            // Log all requests for analysis
            console.log(`📡 ${method} ${url.substring(0, 100)}...`);
            
            // Discover API endpoints
            if (url.includes('/api/') || url.includes('/mobile/') || url.includes('/app/')) {
                this.discoveredEndpoints.add(url);
                console.log(`🔍 API Endpoint Discovered: ${url}`);
            }
            
            // Continue the request
            await route.continue();
        });

        // Intercept ALL responses
        this.page.on('response', async (response) => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            try {
                // Analyze API responses
                if (contentType.includes('application/json')) {
                    const data = await response.json();
                    
                    // Save API response for analysis
                    this.apiResponses.push({
                        url: url,
                        data: data,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Extract Pokemon data from any JSON response
                    await this.extractPokemonFromApiData(data, url);
                    
                    // Look for authentication tokens
                    this.extractAuthTokens(data, url);
                    
                    console.log(`📊 JSON Response: ${url} (${JSON.stringify(data).length} chars)`);
                }
            } catch (error) {
                // Silent fail - some JSON responses might be malformed
            }
        });
        
        console.log('🕸️ Network interception active - monitoring all traffic');
    }

    async executeUltimateExtraction() {
        console.log('🚀 EXECUTING ULTIMATE MOBILE EXTRACTION');
        console.log('=======================================');
        
        // Strategy 1: Mobile website simulation
        await this.simulateMobileApp();
        
        // Strategy 2: Direct API endpoint testing
        await this.testDirectApiEndpoints();
        
        // Strategy 3: Mobile search simulation
        await this.simulateMobileSearch();
        
        // Strategy 4: Mobile auction browsing
        await this.browseMobileAuctions();
        
        // Strategy 5: API endpoint brute force
        await this.bruteForceApiEndpoints();
        
        console.log('✅ Ultimate extraction strategies completed');
    }

    async simulateMobileApp() {
        console.log('📱 STRATEGY 1: Mobile App Simulation');
        
        try {
            // Visit mobile website
            await this.page.goto('https://m.fanaticscollect.com', { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            await this.delay(3000);
            
            // Try mobile-specific interactions
            await this.page.evaluate(() => {
                // Trigger mobile app-like interactions
                window.scrollTo(0, document.body.scrollHeight / 3);
                
                // Try to trigger lazy loading
                const event = new Event('scroll');
                window.dispatchEvent(event);
            });
            
            await this.delay(2000);
            
        } catch (error) {
            console.log('⚠️ Mobile site not accessible, trying main site with mobile user-agent');
            
            await this.page.goto('https://www.fanaticscollect.com', {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            
            await this.delay(3000);
        }
        
        console.log('✅ Mobile simulation completed');
    }

    async testDirectApiEndpoints() {
        console.log('🎯 STRATEGY 2: Direct API Endpoint Testing');
        
        for (const endpoint of this.mobileEndpoints) {
            const fullUrl = `https://www.fanaticscollect.com${endpoint}`;
            
            try {
                console.log(`🔍 Testing: ${fullUrl}`);
                
                const response = await this.page.goto(fullUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000
                });
                
                if (response && response.status() === 200) {
                    console.log(`✅ Endpoint accessible: ${endpoint}`);
                    
                    // Save endpoint info
                    this.saveApiEndpoint(endpoint, 'GET', response.headers()['content-type'], response.status());
                    
                    await this.delay(1000);
                } else {
                    console.log(`❌ Endpoint blocked: ${endpoint} (${response?.status() || 'timeout'})`);
                }
                
            } catch (error) {
                console.log(`❌ Endpoint failed: ${endpoint}`);
            }
            
            await this.delay(500); // Rate limiting
        }
        
        console.log('✅ Direct API testing completed');
    }

    async simulateMobileSearch() {
        console.log('🔍 STRATEGY 3: Mobile Search Simulation');
        
        const pokemonSearches = ['pokemon', 'pikachu', 'charizard', 'cards'];
        
        for (const searchTerm of pokemonSearches) {
            try {
                // Try mobile search URL patterns
                const searchUrls = [
                    `https://www.fanaticscollect.com/search?q=${searchTerm}`,
                    `https://www.fanaticscollect.com/search?query=${searchTerm}`,
                    `https://www.fanaticscollect.com/api/search?q=${searchTerm}`,
                    `https://www.fanaticscollect.com/mobile/search?query=${searchTerm}`
                ];
                
                for (const url of searchUrls) {
                    console.log(`🔍 Mobile search: ${url}`);
                    
                    await this.page.goto(url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 15000
                    });
                    
                    await this.delay(2000);
                    
                    // Extract any Pokemon data found
                    await this.extractCurrentPageData();
                    
                    await this.delay(1000);
                }
                
            } catch (error) {
                console.log(`⚠️ Mobile search failed for: ${searchTerm}`);
            }
        }
        
        console.log('✅ Mobile search simulation completed');
    }

    async browseMobileAuctions() {
        console.log('⏰ STRATEGY 4: Mobile Auction Browsing');
        
        try {
            await this.page.goto('https://www.fanaticscollect.com/auctions', {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            
            await this.delay(3000);
            
            // Simulate mobile auction browsing
            await this.page.evaluate(() => {
                // Scroll through auctions
                for (let i = 0; i < 5; i++) {
                    window.scrollTo(0, (i + 1) * (window.innerHeight / 2));
                }
            });
            
            await this.delay(2000);
            
            // Extract auction data
            await this.extractAuctionData();
            
        } catch (error) {
            console.log('⚠️ Mobile auction browsing failed');
        }
        
        console.log('✅ Mobile auction browsing completed');
    }

    async bruteForceApiEndpoints() {
        console.log('⚡ STRATEGY 5: API Endpoint Brute Force');
        
        const apiPatterns = [
            '/api/v1/collections/pokemon',
            '/api/v1/cards/search?category=pokemon',
            '/api/v1/auctions/pokemon',
            '/mobile/api/pokemon',
            '/app/pokemon/cards',
            '/rest/collections/pokemon',
            '/graphql?query=pokemon'
        ];
        
        for (const pattern of apiPatterns) {
            try {
                const fullUrl = `https://www.fanaticscollect.com${pattern}`;
                console.log(`⚡ Brute force: ${fullUrl}`);
                
                await this.page.goto(fullUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 8000
                });
                
                await this.delay(1000);
                
            } catch (error) {
                // Expected - most will fail
            }
        }
        
        console.log('✅ API brute force completed');
    }

    async extractPokemonFromApiData(data, sourceUrl) {
        let extractedCount = 0;
        
        const processDataRecursively = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;
            
            const objString = JSON.stringify(obj).toLowerCase();
            
            // Check if this object contains Pokemon data
            if (this.isPokemonData(objString)) {
                const pokemonCard = this.extractPokemonCard(obj, sourceUrl);
                if (pokemonCard) {
                    this.savePokemonCard(pokemonCard, 'mobile_api', sourceUrl);
                    extractedCount++;
                }
            }
            
            // Recursively process nested objects and arrays
            for (const key in obj) {
                const value = obj[key];
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        processDataRecursively(item, `${path}.${key}[${index}]`);
                    });
                } else if (value && typeof value === 'object') {
                    processDataRecursively(value, `${path}.${key}`);
                }
            }
        };
        
        processDataRecursively(data);
        
        if (extractedCount > 0) {
            console.log(`🎯 Extracted ${extractedCount} Pokemon cards from mobile API: ${sourceUrl.substring(0, 60)}...`);
        }
    }

    isPokemonData(dataString) {
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'bulbasaur', 'squirtle', 'charmander',
            'base set', 'jungle', 'fossil', 'shadowless', 'first edition', '1st edition',
            'neo genesis', 'team rocket', 'gym heroes', 'gym challenge',
            'wizards', 'wotc', 'holo', 'holographic', 'psa', 'bgs', 'cgc'
        ];
        
        return pokemonIndicators.some(indicator => dataString.includes(indicator));
    }

    extractPokemonCard(data, sourceUrl) {
        try {
            // Try to extract card information from various data structures
            const card = {
                id: data.id || data.cardId || data.item_id || `mobile_${Date.now()}_${Math.random()}`,
                name: data.name || data.title || data.cardName || data.item_name || 'Pokemon Card',
                price: this.extractPrice(data.price || data.currentBid || data.cost || data.value || 0),
                image_url: data.image || data.imageUrl || data.img || data.photo || '',
                detail_url: data.url || data.link || data.detailUrl || sourceUrl,
                description: data.description || data.desc || JSON.stringify(data).substring(0, 200),
                raw_data: JSON.stringify(data)
            };
            
            // Only return if it has meaningful Pokemon data
            if (card.name.toLowerCase().includes('pokemon') || 
                card.description.toLowerCase().includes('pokemon') ||
                this.isPokemonData(JSON.stringify(data).toLowerCase())) {
                return card;
            }
            
        } catch (error) {
            // Skip malformed data
        }
        
        return null;
    }

    extractPrice(priceValue) {
        if (!priceValue) return 0;
        
        const priceString = priceValue.toString()
            .replace(/[^\d.,]/g, '')
            .replace(/,/g, '');
            
        return parseFloat(priceString) || 0;
    }

    async extractCurrentPageData() {
        const cards = await this.page.evaluate(() => {
            const selectors = [
                '[data-testid*="card"]', '.card', '[class*="card"]',
                '.auction-item', '.item', '[class*="item"]',
                '.listing', '[class*="listing"]', 'article'
            ];
            
            const extractedCards = [];
            
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                
                elements.forEach((element, index) => {
                    try {
                        const text = element.textContent?.toLowerCase() || '';
                        
                        if (text.includes('pokemon') || text.includes('pikachu') || text.includes('charizard')) {
                            const card = {
                                id: `mobile_page_${Date.now()}_${index}`,
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
                
                if (extractedCards.length > 0) break;
            }
            
            return extractedCards;
        });
        
        for (const card of cards) {
            this.savePokemonCard(card, 'mobile_page', this.page.url());
        }
        
        if (cards.length > 0) {
            console.log(`📱 Extracted ${cards.length} Pokemon cards from mobile page`);
        }
        
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
                            id: `mobile_auction_${Date.now()}_${index}`,
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
            
            return extractedAuctions.slice(0, 15); // Limit results
        });
        
        for (const auction of auctions) {
            this.savePokemonCard(auction, 'mobile_auction', this.page.url());
        }
        
        if (auctions.length > 0) {
            console.log(`⏰ Extracted ${auctions.length} Pokemon auctions from mobile`);
        }
    }

    savePokemonCard(cardData, method, sourceUrl) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO pokemon_cards (
                    id, name, price, image_url, detail_url, 
                    description, extraction_method, source_url, raw_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                cardData.id || `mobile_${Date.now()}_${Math.random()}`,
                cardData.name || 'Pokemon Card',
                cardData.price || 0,
                cardData.image_url || cardData.image || '',
                cardData.detail_url || cardData.link || sourceUrl,
                cardData.description || '',
                method,
                sourceUrl,
                cardData.raw_data || JSON.stringify(cardData)
            );
            
            this.extractedCards++;
            
            if (this.extractedCards % 10 === 0) {
                console.log(`💾 Mobile extraction progress: ${this.extractedCards} Pokemon cards saved`);
            }
            
        } catch (error) {
            // Silent save errors
        }
    }

    saveApiEndpoint(endpoint, method, contentType, statusCode) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO api_endpoints (
                    endpoint, method, response_type, auth_required, data_count
                ) VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run(endpoint, method, contentType, statusCode !== 200, 0);
        } catch (error) {
            // Silent save
        }
    }

    extractAuthTokens(data, sourceUrl) {
        try {
            const dataString = JSON.stringify(data);
            
            // Look for common auth token patterns
            const tokenPatterns = [
                /["\']token["\']:\s*["\']([^"\']+)["\']/.exec(dataString),
                /["\']auth["\']:\s*["\']([^"\']+)["\']/.exec(dataString),
                /["\']jwt["\']:\s*["\']([^"\']+)["\']/.exec(dataString),
                /["\']bearer["\']:\s*["\']([^"\']+)["\']/.exec(dataString)
            ];
            
            for (const match of tokenPatterns) {
                if (match && match[1]) {
                    this.authTokens.add(match[1]);
                    console.log(`🔑 Auth token discovered: ${match[1].substring(0, 20)}...`);
                }
            }
        } catch (error) {
            // Silent token extraction
        }
    }

    async generateUltimateReport() {
        console.log('📊 Generating ultimate mobile extraction report...');
        
        const totalCards = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get();
        const byMethod = this.db.prepare('SELECT extraction_method, COUNT(*) as count FROM pokemon_cards GROUP BY extraction_method').all();
        const discoveredEndpoints = this.db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get();
        const avgPrice = this.db.prepare('SELECT AVG(price) as avg FROM pokemon_cards WHERE price > 0').get();
        
        const report = {
            timestamp: new Date().toISOString(),
            extraction_type: 'Ultimate Mobile Interception',
            results: {
                total_pokemon_cards: totalCards.count,
                extraction_methods: byMethod,
                discovered_api_endpoints: discoveredEndpoints.count,
                discovered_auth_tokens: this.authTokens.size,
                network_responses: this.apiResponses.length,
                average_price: avgPrice.avg?.toFixed(2) || '0.00'
            },
            discovered_endpoints: Array.from(this.discoveredEndpoints),
            extraction_summary: {
                mobile_simulation: 'Completed',
                api_endpoint_testing: 'Completed',
                mobile_search: 'Completed', 
                auction_browsing: 'Completed',
                brute_force: 'Completed'
            },
            integration_ready: true,
            next_steps: [
                'Format extracted data for unified pipeline',
                'Cross-reference with existing Pokemon database',
                'Identify unique Fanatics pricing intelligence',
                'Deploy comprehensive market analysis'
            ]
        };
        
        const reportPath = `fanatics-ultimate-mobile-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Also save API responses for analysis
        const apiDataPath = `fanatics-mobile-api-data-${Date.now()}.json`;
        fs.writeFileSync(apiDataPath, JSON.stringify(this.apiResponses, null, 2));
        
        console.log('🎯 FANATICS ULTIMATE MOBILE EXTRACTION COMPLETE');
        console.log('===============================================');
        console.log(`📱 Pokemon Cards Extracted: ${totalCards.count.toLocaleString()}`);
        console.log(`🔍 API Endpoints Discovered: ${discoveredEndpoints.count}`);
        console.log(`🔑 Auth Tokens Found: ${this.authTokens.size}`);
        console.log(`📡 Network Responses: ${this.apiResponses.length}`);
        console.log(`💰 Average Price: $${avgPrice.avg?.toFixed(2) || '0.00'}`);
        console.log(`📄 Report: ${reportPath}`);
        console.log(`📊 API Data: ${apiDataPath}`);
        console.log('🚀 Ready for unified data pipeline integration!');
        
        return report;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        console.log('🧹 Cleaning up mobile interceptor...');
        
        if (this.browser) {
            await this.browser.close();
        }
        if (this.db) {
            this.db.close();
        }
        
        console.log('✅ Mobile interception cleanup complete');
    }
}

async function main() {
    const interceptor = new FanaticsUltimateMobileInterceptor();
    
    try {
        await interceptor.initialize();
        await interceptor.executeUltimateExtraction();
        await interceptor.generateUltimateReport();
        
    } catch (error) {
        console.error('❌ Ultimate mobile interception error:', error.message);
    } finally {
        await interceptor.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsUltimateMobileInterceptor;
