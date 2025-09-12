#!/usr/bin/env node
/**
 * 🎯 FANATICS MOBILE ENDPOINT EXTRACTOR
 * ====================================
 * 
 * FOCUSED MOBILE API ENDPOINT DISCOVERY & EXTRACTION
 * Streamlined approach targeting only mobile endpoints
 */

const { chromium } = require('playwright');
const Database = require('better-sqlite3');
const fs = require('fs');

class FanaticsMobileEndpointExtractor {
    constructor() {
        this.db = null;
        this.browser = null;
        this.page = null;
        this.discoveredEndpoints = new Set();
        this.extractedData = [];
        
        // Core mobile endpoints to test
        this.targetEndpoints = [
            '/api/v1/cards',
            '/api/v1/auctions', 
            '/api/v1/search',
            '/mobile/api/cards',
            '/mobile/api/auctions',
            '/app/api/cards',
            '/rest/v1/cards',
            '/graphql'
        ];
    }

    async initialize() {
        console.log('🎯 FANATICS MOBILE ENDPOINT EXTRACTOR');
        console.log('====================================');
        console.log('🔍 Focused on mobile API discovery only');
        
        this.setupDatabase();
        
        this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Mobile user agent
        await this.page.setUserAgent('Fanatics Collect/1.0 (iPhone; iOS 17.0)');
        
        // Network interception for endpoint discovery
        this.page.on('response', async (response) => {
            const url = response.url();
            
            if (url.includes('/api/') || url.includes('/mobile/') || url.includes('/app/')) {
                this.discoveredEndpoints.add(url);
                console.log(`🔍 Endpoint discovered: ${url}`);
                
                try {
                    if (response.headers()['content-type']?.includes('application/json')) {
                        const data = await response.json();
                        this.analyzeApiResponse(data, url);
                    }
                } catch (error) {
                    // Silent fail for response parsing
                }
            }
        });
        
        console.log('✅ Mobile endpoint extractor initialized');
    }

    setupDatabase() {
        this.db = new Database('fanatics-mobile-endpoints.db');
        
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS discovered_endpoints (
                url TEXT PRIMARY KEY,
                status_code INTEGER,
                content_type TEXT,
                has_pokemon_data BOOLEAN,
                data_sample TEXT,
                discovery_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS extracted_pokemon (
                id TEXT PRIMARY KEY,
                name TEXT,
                price REAL,
                source_endpoint TEXT,
                raw_data TEXT,
                extraction_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log('✅ Mobile endpoint database ready');
    }

    async executeEndpointDiscovery() {
        console.log('🚀 EXECUTING MOBILE ENDPOINT DISCOVERY');
        console.log('=====================================');
        
        // Step 1: Visit mobile site to trigger endpoint discovery
        await this.visitMobileSite();
        
        // Step 2: Test known mobile endpoint patterns
        await this.testMobileEndpoints();
        
        // Step 3: Analyze discovered endpoints
        await this.analyzeDiscoveredEndpoints();
        
        console.log('✅ Mobile endpoint discovery completed');
    }

    async visitMobileSite() {
        console.log('📱 Visiting mobile site to discover endpoints...');
        
        try {
            await this.page.goto('https://www.fanaticscollect.com', { 
                waitUntil: 'networkidle',
                timeout: 20000 
            });
            
            await this.delay(3000);
            
            // Trigger mobile interactions that might call APIs
            await this.page.evaluate(() => {
                // Scroll to trigger lazy loading
                window.scrollTo(0, document.body.scrollHeight / 2);
                
                // Try to trigger search if available
                const searchInput = document.querySelector('input[type="search"], [placeholder*="search"]');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.value = 'pokemon';
                    const event = new Event('input', { bubbles: true });
                    searchInput.dispatchEvent(event);
                }
            });
            
            await this.delay(2000);
            
        } catch (error) {
            console.log('⚠️ Mobile site visit failed:', error.message.substring(0, 50));
        }
        
        console.log(`📱 Site visit complete. Discovered ${this.discoveredEndpoints.size} endpoints`);
    }

    async testMobileEndpoints() {
        console.log('🎯 Testing mobile endpoint patterns...');
        
        const baseUrl = 'https://www.fanaticscollect.com';
        
        for (const endpoint of this.targetEndpoints) {
            const fullUrl = baseUrl + endpoint;
            
            try {
                console.log(`🔍 Testing: ${endpoint}`);
                
                const response = await this.page.goto(fullUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000
                });
                
                if (response) {
                    const status = response.status();
                    const contentType = response.headers()['content-type'] || '';
                    
                    console.log(`📊 ${endpoint}: ${status} (${contentType.substring(0, 20)})`);
                    
                    this.saveEndpointInfo(fullUrl, status, contentType);
                    
                    if (status === 200 && contentType.includes('json')) {
                        console.log(`✅ Accessible JSON endpoint: ${endpoint}`);
                    }
                }
                
            } catch (error) {
                console.log(`❌ ${endpoint}: Failed`);
            }
            
            await this.delay(1000); // Rate limiting
        }
        
        console.log('✅ Mobile endpoint testing completed');
    }

    async analyzeDiscoveredEndpoints() {
        console.log('🔬 Analyzing discovered endpoints for Pokemon data...');
        
        const endpoints = Array.from(this.discoveredEndpoints);
        
        for (const endpointUrl of endpoints) {
            try {
                console.log(`🔬 Analyzing: ${endpointUrl.substring(0, 60)}...`);
                
                const response = await this.page.goto(endpointUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 8000
                });
                
                if (response && response.status() === 200) {
                    const contentType = response.headers()['content-type'] || '';
                    
                    if (contentType.includes('json')) {
                        const data = await response.json();
                        const hasPokemonData = this.containsPokemonData(data);
                        
                        if (hasPokemonData) {
                            console.log(`🎯 Pokemon data found in: ${endpointUrl}`);
                            this.extractPokemonFromEndpoint(data, endpointUrl);
                        }
                        
                        this.saveEndpointInfo(endpointUrl, response.status(), contentType, hasPokemonData, JSON.stringify(data).substring(0, 200));
                    }
                }
                
            } catch (error) {
                console.log(`⚠️ Analysis failed for: ${endpointUrl.substring(0, 40)}...`);
            }
            
            await this.delay(500);
        }
        
        console.log('✅ Endpoint analysis completed');
    }

    analyzeApiResponse(data, sourceUrl) {
        if (this.containsPokemonData(data)) {
            console.log(`🎯 Pokemon data detected in API response: ${sourceUrl}`);
            this.extractPokemonFromEndpoint(data, sourceUrl);
        }
    }

    containsPokemonData(data) {
        const dataString = JSON.stringify(data).toLowerCase();
        
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'base set', 
            'shadowless', 'first edition', 'holo', 'psa'
        ];
        
        return pokemonIndicators.some(indicator => dataString.includes(indicator));
    }

    extractPokemonFromEndpoint(data, sourceUrl) {
        let extractedCount = 0;
        
        const extractRecursively = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            
            // Check if this object represents a Pokemon card
            if (this.isPokemonCard(obj)) {
                const pokemonData = {
                    id: obj.id || obj.cardId || `endpoint_${Date.now()}_${Math.random()}`,
                    name: obj.name || obj.title || 'Pokemon Card',
                    price: this.extractPrice(obj.price || obj.currentBid || 0),
                    source_endpoint: sourceUrl,
                    raw_data: JSON.stringify(obj)
                };
                
                this.savePokemonData(pokemonData);
                extractedCount++;
            }
            
            // Recursively check nested objects and arrays
            for (const key in obj) {
                const value = obj[key];
                if (Array.isArray(value)) {
                    value.forEach(item => extractRecursively(item));
                } else if (value && typeof value === 'object') {
                    extractRecursively(value);
                }
            }
        };
        
        extractRecursively(data);
        
        if (extractedCount > 0) {
            console.log(`✅ Extracted ${extractedCount} Pokemon cards from ${sourceUrl}`);
        }
    }

    isPokemonCard(obj) {
        const objString = JSON.stringify(obj).toLowerCase();
        return objString.includes('pokemon') || objString.includes('pikachu') || objString.includes('charizard');
    }

    extractPrice(priceValue) {
        if (!priceValue) return 0;
        const priceString = priceValue.toString().replace(/[^\d.,]/g, '').replace(/,/g, '');
        return parseFloat(priceString) || 0;
    }

    saveEndpointInfo(url, statusCode, contentType, hasPokemonData = false, dataSample = '') {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO discovered_endpoints 
                (url, status_code, content_type, has_pokemon_data, data_sample) 
                VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run(url, statusCode, contentType, hasPokemonData, dataSample);
        } catch (error) {
            // Silent save error
        }
    }

    savePokemonData(pokemonData) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO extracted_pokemon 
                (id, name, price, source_endpoint, raw_data) 
                VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                pokemonData.id,
                pokemonData.name, 
                pokemonData.price,
                pokemonData.source_endpoint,
                pokemonData.raw_data
            );
            
            this.extractedData.push(pokemonData);
        } catch (error) {
            // Silent save error
        }
    }

    async generateEndpointReport() {
        console.log('📊 Generating mobile endpoint discovery report...');
        
        const totalEndpoints = this.db.prepare('SELECT COUNT(*) as count FROM discovered_endpoints').get();
        const pokemonEndpoints = this.db.prepare('SELECT COUNT(*) as count FROM discovered_endpoints WHERE has_pokemon_data = 1').get();
        const totalPokemon = this.db.prepare('SELECT COUNT(*) as count FROM extracted_pokemon').get();
        const successfulEndpoints = this.db.prepare('SELECT * FROM discovered_endpoints WHERE status_code = 200').all();
        
        const report = {
            timestamp: new Date().toISOString(),
            discovery_type: 'Mobile Endpoint Extraction',
            summary: {
                total_endpoints_discovered: totalEndpoints.count,
                pokemon_data_endpoints: pokemonEndpoints.count,
                total_pokemon_extracted: totalPokemon.count,
                successful_endpoints: successfulEndpoints.length
            },
            accessible_endpoints: successfulEndpoints.map(ep => ({
                url: ep.url,
                content_type: ep.content_type,
                has_pokemon_data: ep.has_pokemon_data
            })),
            extraction_status: totalPokemon.count > 0 ? 'SUCCESS' : 'NO_POKEMON_DATA_FOUND',
            next_steps: [
                'Analyze accessible endpoints for data extraction patterns',
                'Test authentication requirements for protected endpoints',
                'Scale extraction for discovered Pokemon data sources'
            ]
        };
        
        const reportPath = `fanatics-mobile-endpoints-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('🎯 MOBILE ENDPOINT DISCOVERY COMPLETE');
        console.log('====================================');
        console.log(`🔍 Total Endpoints Discovered: ${totalEndpoints.count}`);
        console.log(`🎯 Pokemon Data Endpoints: ${pokemonEndpoints.count}`);
        console.log(`📱 Pokemon Cards Extracted: ${totalPokemon.count}`);
        console.log(`📄 Report: ${reportPath}`);
        
        if (totalPokemon.count > 0) {
            console.log('🚀 SUCCESS: Pokemon data successfully extracted from mobile endpoints!');
        } else {
            console.log('⚠️ No Pokemon data found - endpoints may require authentication or different approach');
        }
        
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
        console.log('✅ Mobile endpoint extractor cleanup complete');
    }
}

async function main() {
    const extractor = new FanaticsMobileEndpointExtractor();
    
    try {
        await extractor.initialize();
        await extractor.executeEndpointDiscovery();
        await extractor.generateEndpointReport();
        
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
