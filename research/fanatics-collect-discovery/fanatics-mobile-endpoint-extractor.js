#!/usr/bin/env node
/**
 * 🎯 FANATICS MOBILE ENDPOINT EXTRACTOR
 * ====================================
 * 
 * FOCUSED MOBILE API ENDPOINT DISCOVERY & EXTRACTION
 * Concentrates only on mobile app endpoints and data extraction
 */

const { chromium } = require('playwright');
const Database = require('better-sqlite3');
const fs = require('fs');

class FanaticsMobileEndpointExtractor {
    constructor() {
        this.db = null;
        this.browser = null;
        this.page = null;
        this.discoveredEndpoints = new Map();
        this.apiResponses = [];
        this.extractedData = [];
        
        // Mobile app user agents
        this.mobileUserAgents = [
            'Fanatics Collect/1.0 CFNetwork/1404.0.5 Darwin/22.3.0',
            'Fanatics Collect/1.0 (iPhone; iOS 17.0; Scale/3.0)',
            'Fanatics Collect/1.0 (Android 13; Samsung SM-G991B)'
        ];
        
        // Target mobile API patterns
        this.mobileApiPatterns = [
            '/api/v1/',
            '/api/v2/',
            '/mobile/api/',
            '/app/api/',
            '/rest/v1/',
            '/graphql',
            '/api/cards',
            '/api/auctions',
            '/api/search',
            '/api/collectibles'
        ];
    }

    async initialize() {
        console.log('📱 FANATICS MOBILE ENDPOINT EXTRACTOR');
        console.log('====================================');
        console.log('🎯 Focus: Mobile API endpoint discovery & extraction only');
        
        this.setupDatabase();
        
        // Launch browser with mobile configuration
        this.browser = await chromium.launch({
            headless: false, // Show browser for monitoring
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--user-agent=' + this.mobileUserAgents[0]
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Configure as mobile device (iPhone 13)
        await this.page.setViewportSize({ width: 375, height: 812 });
        await this.page.setUserAgent(this.mobileUserAgents[0]);
        
        // Setup focused network interception for mobile endpoints
        await this.setupMobileNetworkInterception();
        
        console.log('✅ Mobile endpoint extractor initialized');
    }

    setupDatabase() {
        this.db = new Database('fanatics-mobile-endpoints.db');
        
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS mobile_endpoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint_url TEXT UNIQUE,
                method TEXT,
                status_code INTEGER,
                content_type TEXT,
                response_size INTEGER,
                contains_pokemon_data BOOLEAN DEFAULT FALSE,
                discovery_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS mobile_api_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint_url TEXT,
                response_data TEXT,
                pokemon_data_extracted INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS pokemon_mobile_data (
                id TEXT PRIMARY KEY,
                name TEXT,
                price REAL,
                endpoint_source TEXT,
                raw_json TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log('✅ Mobile endpoint database initialized');
    }

    async setupMobileNetworkInterception() {
        console.log('🕸️ Setting up mobile network interception...');
        
        // Intercept ALL network requests to discover mobile endpoints
        this.page.on('request', request => {
            const url = request.url();
            const method = request.method();
            
            // Focus on API endpoints only
            if (this.isMobileApiEndpoint(url)) {
                console.log(`📡 Mobile API Request: ${method} ${url}`);
                
                // Store endpoint discovery
                this.discoveredEndpoints.set(url, {
                    method: method,
                    url: url,
                    discovered: new Date().toISOString()
                });
            }
        });

        // Intercept ALL responses to extract data from mobile endpoints
        this.page.on('response', async response => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            const status = response.status();
            
            // Focus only on mobile API responses
            if (this.isMobileApiEndpoint(url)) {
                console.log(`📊 Mobile API Response: ${status} ${url.substring(0, 80)}...`);
                
                // Save endpoint info
                this.saveMobileEndpoint(url, 'GET', status, contentType);
                
                try {
                    // Extract JSON data from mobile API responses
                    if (contentType.includes('application/json')) {
                        const responseData = await response.json();
                        
                        // Store API response
                        this.apiResponses.push({
                            url: url,
                            data: responseData,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Extract Pokemon data if found
                        const pokemonCount = await this.extractPokemonFromMobileApi(responseData, url);
                        
                        // Save API response to database
                        this.saveMobileApiResponse(url, responseData, pokemonCount);
                        
                        console.log(`🎯 Mobile API Data: ${url} - ${pokemonCount} Pokemon cards extracted`);
                    }
                } catch (error) {
                    console.log(`⚠️ Could not parse mobile API response: ${url}`);
                }
            }
        });
        
        console.log('✅ Mobile network interception active');
    }

    isMobileApiEndpoint(url) {
        return this.mobileApiPatterns.some(pattern => url.includes(pattern)) ||
               url.includes('/api/') ||
               url.includes('/mobile/') ||
               url.includes('/app/');
    }

    async executeMobileEndpointExtraction() {
        console.log('🚀 EXECUTING MOBILE ENDPOINT EXTRACTION');
        console.log('======================================');
        
        // Strategy 1: Navigate to mobile website to trigger API calls
        await this.triggerMobileApiCalls();
        
        // Strategy 2: Test discovered endpoints directly
        await this.testDiscoveredEndpoints();
        
        // Strategy 3: Brute force common mobile endpoints
        await this.bruteforceMobileEndpoints();
        
        console.log('✅ Mobile endpoint extraction completed');
    }

    async triggerMobileApiCalls() {
        console.log('📱 STEP 1: Triggering mobile API calls through website navigation');
        
        try {
            // Visit main site as mobile device
            console.log('🌐 Loading Fanatics Collect as mobile device...');
            await this.page.goto('https://www.fanaticscollect.com', {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            
            await this.delay(3000);
            
            // Try to search for Pokemon to trigger search APIs
            console.log('🔍 Attempting Pokemon search to trigger API calls...');
            try {
                const searchSelector = 'input[type="search"], [placeholder*="search"], input[name*="search"]';
                await this.page.fill(searchSelector, 'pokemon');
                await this.page.press(searchSelector, 'Enter');
                await this.delay(5000);
            } catch (error) {
                console.log('⚠️ Search input not found, trying alternative methods');
            }
            
            // Navigate to auctions page to trigger auction APIs
            console.log('⏰ Navigating to auctions to trigger auction APIs...');
            await this.page.goto('https://www.fanaticscollect.com/auctions', {
                waitUntil: 'networkidle',
                timeout: 20000
            });
            
            await this.delay(3000);
            
            // Scroll to trigger lazy loading APIs
            console.log('📜 Scrolling to trigger lazy loading APIs...');
            await this.page.evaluate(() => {
                for (let i = 0; i < 3; i++) {
                    window.scrollTo(0, (i + 1) * window.innerHeight);
                }
            });
            
            await this.delay(2000);
            
        } catch (error) {
            console.log('⚠️ Website navigation failed, proceeding with direct endpoint testing');
        }
        
        console.log(`✅ Mobile navigation completed - ${this.discoveredEndpoints.size} endpoints discovered`);
    }

    async testDiscoveredEndpoints() {
        console.log('🎯 STEP 2: Testing discovered mobile endpoints directly');
        
        for (const [url, info] of this.discoveredEndpoints) {
            console.log(`🔍 Testing discovered endpoint: ${url}`);
            
            try {
                await this.page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000
                });
                
                await this.delay(1000);
                
            } catch (error) {
                console.log(`❌ Discovered endpoint failed: ${url}`);
            }
        }
        
        console.log('✅ Discovered endpoint testing completed');
    }

    async bruteforceMobileEndpoints() {
        console.log('⚡ STEP 3: Brute forcing common mobile API endpoints');
        
        const commonMobileEndpoints = [
            'https://www.fanaticscollect.com/api/v1/cards',
            'https://www.fanaticscollect.com/api/v1/auctions',
            'https://www.fanaticscollect.com/api/v1/search?q=pokemon',
            'https://www.fanaticscollect.com/api/v1/collectibles',
            'https://www.fanaticscollect.com/api/v2/cards',
            'https://www.fanaticscollect.com/api/v2/auctions',
            'https://www.fanaticscollect.com/mobile/api/cards',
            'https://www.fanaticscollect.com/mobile/api/auctions',
            'https://www.fanaticscollect.com/app/api/v1/cards',
            'https://www.fanaticscollect.com/rest/v1/cards',
            'https://www.fanaticscollect.com/graphql'
        ];
        
        for (const endpoint of commonMobileEndpoints) {
            console.log(`⚡ Testing: ${endpoint}`);
            
            try {
                await this.page.goto(endpoint, {
                    waitUntil: 'domcontentloaded',
                    timeout: 8000
                });
                
                await this.delay(500);
                
            } catch (error) {
                // Expected - most will return 404 or be blocked
            }
        }
        
        console.log('✅ Mobile endpoint brute force completed');
    }

    async extractPokemonFromMobileApi(apiData, sourceUrl) {
        let extractedCount = 0;
        
        const extractFromObject = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;
            
            // Check if this object contains Pokemon-related data
            const objString = JSON.stringify(obj).toLowerCase();
            if (this.containsPokemonData(objString)) {
                const pokemonCard = this.parsePokemonCard(obj, sourceUrl);
                if (pokemonCard) {
                    this.savePokemonMobileData(pokemonCard, sourceUrl);
                    extractedCount++;
                }
            }
            
            // Recursively check nested objects and arrays
            for (const key in obj) {
                const value = obj[key];
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        extractFromObject(item, `${path}.${key}[${index}]`);
                    });
                } else if (value && typeof value === 'object') {
                    extractFromObject(value, `${path}.${key}`);
                }
            }
        };
        
        extractFromObject(apiData);
        return extractedCount;
    }

    containsPokemonData(dataString) {
        const pokemonKeywords = [
            'pokemon', 'pikachu', 'charizard', 'bulbasaur', 'squirtle',
            'base set', 'jungle', 'fossil', 'shadowless', 'first edition',
            'neo genesis', 'team rocket', 'gym heroes', 'wotc'
        ];
        
        return pokemonKeywords.some(keyword => dataString.includes(keyword));
    }

    parsePokemonCard(cardData, sourceUrl) {
        try {
            const card = {
                id: cardData.id || cardData.cardId || `mobile_${Date.now()}_${Math.random()}`,
                name: cardData.name || cardData.title || cardData.cardName || 'Pokemon Card',
                price: this.parsePrice(cardData.price || cardData.currentBid || cardData.value || 0),
                endpoint_source: sourceUrl,
                raw_json: JSON.stringify(cardData)
            };
            
            // Only return if it has meaningful data
            if (card.name.toLowerCase().includes('pokemon') || 
                this.containsPokemonData(JSON.stringify(cardData).toLowerCase())) {
                return card;
            }
            
        } catch (error) {
            // Skip malformed data
        }
        
        return null;
    }

    parsePrice(priceValue) {
        if (!priceValue) return 0;
        
        const cleanPrice = priceValue.toString()
            .replace(/[^\d.,]/g, '')
            .replace(/,/g, '');
            
        return parseFloat(cleanPrice) || 0;
    }

    saveMobileEndpoint(url, method, statusCode, contentType) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO mobile_endpoints (
                    endpoint_url, method, status_code, content_type, contains_pokemon_data
                ) VALUES (?, ?, ?, ?, ?)
            `);
            
            const containsPokemon = this.containsPokemonData(url.toLowerCase());
            stmt.run(url, method, statusCode, contentType, containsPokemon);
            
        } catch (error) {
            // Silent save error
        }
    }

    saveMobileApiResponse(url, responseData, pokemonCount) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO mobile_api_responses (
                    endpoint_url, response_data, pokemon_data_extracted
                ) VALUES (?, ?, ?)
            `);
            
            stmt.run(url, JSON.stringify(responseData), pokemonCount);
            
        } catch (error) {
            // Silent save error
        }
    }

    savePokemonMobileData(pokemonCard, sourceUrl) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO pokemon_mobile_data (
                    id, name, price, endpoint_source, raw_json
                ) VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                pokemonCard.id,
                pokemonCard.name,
                pokemonCard.price,
                sourceUrl,
                pokemonCard.raw_json
            );
            
            this.extractedData.push(pokemonCard);
            
        } catch (error) {
            // Silent save error
        }
    }

    async generateMobileExtractionReport() {
        console.log('📊 Generating mobile endpoint extraction report...');
        
        const endpointCount = this.db.prepare('SELECT COUNT(*) as count FROM mobile_endpoints').get();
        const pokemonEndpoints = this.db.prepare('SELECT COUNT(*) as count FROM mobile_endpoints WHERE contains_pokemon_data = TRUE').get();
        const apiResponseCount = this.db.prepare('SELECT COUNT(*) as count FROM mobile_api_responses').get();
        const pokemonDataCount = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_mobile_data').get();
        const totalExtracted = this.db.prepare('SELECT SUM(pokemon_data_extracted) as total FROM mobile_api_responses').get();
        
        // Get sample endpoints
        const sampleEndpoints = this.db.prepare('SELECT endpoint_url, status_code FROM mobile_endpoints LIMIT 10').all();
        
        const report = {
            timestamp: new Date().toISOString(),
            extraction_focus: 'Mobile Endpoints & API Data Only',
            results: {
                total_endpoints_discovered: endpointCount.count,
                pokemon_related_endpoints: pokemonEndpoints.count,
                api_responses_captured: apiResponseCount.count,
                pokemon_cards_extracted: pokemonDataCount.count,
                total_pokemon_data_points: totalExtracted.total || 0
            },
            sample_endpoints: sampleEndpoints,
            discovered_endpoints: Array.from(this.discoveredEndpoints.keys()),
            database_files: [
                'fanatics-mobile-endpoints.db'
            ],
            next_steps: [
                'Analyze discovered endpoints for authentication requirements',
                'Test endpoints with different parameters',
                'Format extracted Pokemon data for unified pipeline',
                'Cross-reference with existing Pokemon database'
            ]
        };
        
        const reportPath = `fanatics-mobile-endpoint-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('📱 MOBILE ENDPOINT EXTRACTION COMPLETE');
        console.log('=====================================');
        console.log(`🔍 Endpoints Discovered: ${endpointCount.count}`);
        console.log(`🎯 Pokemon Endpoints: ${pokemonEndpoints.count}`);
        console.log(`📊 API Responses: ${apiResponseCount.count}`);
        console.log(`🃏 Pokemon Cards: ${pokemonDataCount.count}`);
        console.log(`📄 Report: ${reportPath}`);
        console.log(`💾 Database: fanatics-mobile-endpoints.db`);
        
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
        
        console.log('✅ Mobile endpoint extractor cleanup completed');
    }
}

async function main() {
    const extractor = new FanaticsMobileEndpointExtractor();
    
    try {
        await extractor.initialize();
        await extractor.executeMobileEndpointExtraction();
        await extractor.generateMobileExtractionReport();
        
    } catch (error) {
        console.error('❌ Mobile endpoint extraction error:', error.message);
    } finally {
        await extractor.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsMobileEndpointExtractor;
