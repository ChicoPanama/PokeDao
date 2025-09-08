const axios = require('axios');
const fs = require('fs');

/**
 * TCGPlayer Web API Client
 * Uses the actual discovered endpoints from site analysis
 * Targets marketplace and navigation APIs instead of the protected catalog API
 */
class TCGPlayerWebAPIClient {
    constructor() {
        this.endpoints = {
            homepage: 'https://homepage.marketplace.tcgplayer.com',
            navigation: 'https://marketplace-navigation.tcgplayer.com',
            discovery: 'https://www.tcgplayer.com/js/modules/discovery',
            search: 'https://www.tcgplayer.com/search'
        };
        
        this.session = {
            startTime: new Date().toISOString(),
            totalRequests: 0,
            successfulRequests: 0,
            errors: [],
            pokemonData: [],
            discoveredAPIs: []
        };
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.tcgplayer.com/',
            'Origin': 'https://www.tcgplayer.com'
        };
    }

    /**
     * Initialize and discover working API endpoints
     */
    async initialize() {
        console.log('🚀 Initializing TCGPlayer Web API Client...');
        
        // Test the discovered endpoints from dynamic analysis
        const knownWorkingEndpoints = [
            // Homepage marketplace APIs
            `${this.endpoints.homepage}/sitealert.json`,
            `${this.endpoints.homepage}/default.json`,
            
            // Navigation APIs
            `${this.endpoints.navigation}/marketplace-navigation-search-feature.json`,
            
            // Discovery module
            `${this.endpoints.discovery}/mf-discovery.json`
        ];

        for (const endpoint of knownWorkingEndpoints) {
            await this.testAndMapEndpoint(endpoint);
            await this.sleep(500);
        }

        // Try to find Pokemon-specific endpoints
        await this.discoverPokemonAPIs();

        console.log(`✅ Web API Client initialized with ${this.session.discoveredAPIs.length} working endpoints`);
        return this.session.discoveredAPIs;
    }

    /**
     * Test an endpoint and map its structure
     */
    async testAndMapEndpoint(url) {
        this.session.totalRequests++;
        
        try {
            console.log(`🔍 Testing: ${url}`);
            
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 10000,
                validateStatus: () => true
            });

            if (response.status >= 200 && response.status < 300) {
                this.session.successfulRequests++;
                
                const apiInfo = {
                    url,
                    status: response.status,
                    contentType: response.headers['content-type'],
                    dataStructure: this.analyzeDataStructure(response.data),
                    hasPokemonData: this.containsPokemonData(response.data),
                    data: response.data
                };

                this.session.discoveredAPIs.push(apiInfo);
                
                console.log(`✅ ${url} - ${response.status} (${apiInfo.dataStructure})`);
                
                if (apiInfo.hasPokemonData) {
                    console.log(`🎯 Pokemon data found in ${url}!`);
                }
                
                return apiInfo;
            } else {
                console.log(`❌ ${url} - ${response.status}`);
                return null;
            }
            
        } catch (error) {
            this.session.errors.push({ url, error: error.message, timestamp: new Date().toISOString() });
            console.log(`💥 ${url} - ERROR: ${error.message}`);
            return null;
        }
    }

    /**
     * Discover Pokemon-specific API endpoints
     */
    async discoverPokemonAPIs() {
        console.log('🎯 Discovering Pokemon-specific APIs...');
        
        // Try search-based approaches
        const pokemonSearchEndpoints = [
            // Direct search URLs (might have internal APIs)
            'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page=1',
            'https://www.tcgplayer.com/search/pokemon/product?q=charizard',
            'https://www.tcgplayer.com/search/pokemon/product?q=pikachu',
            
            // Potential internal APIs
            'https://www.tcgplayer.com/api/search/pokemon',
            'https://www.tcgplayer.com/api/catalog/pokemon',
            'https://search.tcgplayer.com/pokemon',
            
            // Category-based endpoints
            'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/pokemon',
        ];

        for (const endpoint of pokemonSearchEndpoints) {
            await this.testAndMapEndpoint(endpoint);
            await this.sleep(1000);
        }
    }

    /**
     * Analyze data structure of API response
     */
    analyzeDataStructure(data) {
        if (!data) return 'null';
        if (typeof data === 'string') return 'string';
        if (Array.isArray(data)) return `array[${data.length}]`;
        
        if (typeof data === 'object') {
            const keys = Object.keys(data);
            return `object{${keys.join(', ')}}`;
        }
        
        return typeof data;
    }

    /**
     * Check if data contains Pokemon-related information
     */
    containsPokemonData(data) {
        if (!data) return false;
        
        const dataString = JSON.stringify(data).toLowerCase();
        
        return dataString.includes('pokemon') || 
               dataString.includes('pokémon') ||
               dataString.includes('charizard') ||
               dataString.includes('pikachu') ||
               dataString.includes('categoryid":3') ||
               dataString.includes('category":"pokemon');
    }

    /**
     * Extract Pokemon data from working endpoints
     */
    async extractPokemonData() {
        console.log('🌾 Extracting Pokemon data from discovered APIs...');
        
        const pokemonAPIs = this.session.discoveredAPIs.filter(api => api.hasPokemonData);
        
        if (pokemonAPIs.length === 0) {
            console.log('⚠️  No APIs with Pokemon data found, trying web scraping approach...');
            return await this.fallbackToWebScraping();
        }

        let allPokemonData = [];
        
        for (const api of pokemonAPIs) {
            console.log(`📡 Extracting from: ${api.url}`);
            
            try {
                const pokemonItems = this.extractPokemonFromResponse(api.data);
                
                if (pokemonItems.length > 0) {
                    console.log(`📦 Found ${pokemonItems.length} Pokemon items from ${api.url}`);
                    allPokemonData.push(...pokemonItems);
                }
                
            } catch (error) {
                console.error(`💥 Error extracting from ${api.url}:`, error.message);
            }
        }

        this.session.pokemonData = this.deduplicateData(allPokemonData);
        console.log(`🎉 Total unique Pokemon items extracted: ${this.session.pokemonData.length}`);
        
        return this.session.pokemonData;
    }

    /**
     * Extract Pokemon items from API response
     */
    extractPokemonFromResponse(data) {
        if (!data) return [];
        
        let items = [];
        
        // Handle different response structures
        if (Array.isArray(data)) {
            items = data;
        } else if (data.categories && Array.isArray(data.categories)) {
            // Found in navigation data
            const pokemonCategory = data.categories.find(cat => 
                cat.title && cat.title.toLowerCase().includes('pokemon')
            );
            
            if (pokemonCategory && pokemonCategory.menus) {
                for (const menu of pokemonCategory.menus) {
                    if (menu.links) {
                        items.push(...menu.links);
                    }
                }
            }
        } else if (data.results && Array.isArray(data.results)) {
            items = data.results;
        }

        // Transform to standard format
        return items.map((item, index) => ({
            id: `tcgplayer_web_${index}`,
            source: 'tcgplayer_web_api',
            title: item.title || item.name,
            url: item.url,
            type: item.type || 'unknown',
            category: 'pokemon',
            extractedAt: new Date().toISOString(),
            rawData: item
        })).filter(item => item.title); // Only keep items with titles
    }

    /**
     * Fallback to web scraping if APIs don't have enough data
     */
    async fallbackToWebScraping() {
        console.log('🕷️  Falling back to hybrid web scraping approach...');
        
        try {
            // Import playwright for dynamic content
            const { chromium } = require('playwright');
            
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            
            // Set headers to match our API requests
            await page.setExtraHTTPHeaders(this.headers);
            
            // Navigate to Pokemon search page
            const searchUrl = 'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page=1';
            console.log(`📍 Navigating to: ${searchUrl}`);
            
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
            
            // Extract data using selectors
            const pokemonData = await page.evaluate(() => {
                const items = [];
                
                // Try multiple selectors
                const selectors = [
                    '.search-result',
                    '.product-card',
                    '[data-testid="product"]',
                    '.listing-item',
                    '.card-item'
                ];
                
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        console.log(`Found ${elements.length} items with selector: ${selector}`);
                        
                        Array.from(elements).forEach((el, index) => {
                            const name = el.querySelector('.product-name, .card-name, h3, h4')?.textContent?.trim();
                            const price = el.querySelector('.price, .market-price')?.textContent?.trim();
                            const link = el.querySelector('a')?.href;
                            
                            if (name) {
                                items.push({
                                    id: `tcgplayer_scrape_${index}`,
                                    name,
                                    price,
                                    url: link,
                                    selector: selector,
                                    extractedAt: new Date().toISOString()
                                });
                            }
                        });
                        
                        break; // Use first working selector
                    }
                }
                
                return items;
            });
            
            await browser.close();
            
            console.log(`🕷️  Web scraping extracted ${pokemonData.length} Pokemon items`);
            this.session.pokemonData = pokemonData;
            
            return pokemonData;
            
        } catch (error) {
            console.error('💥 Web scraping fallback failed:', error.message);
            return [];
        }
    }

    /**
     * Remove duplicate data
     */
    deduplicateData(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = item.title || item.name || item.url;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Save all results
     */
    async saveResults() {
        const timestamp = Date.now();
        
        // Save API discovery results
        const discoveryFile = `tcgplayer-web-api-discovery-${timestamp}.json`;
        const discoveryData = {
            session: this.session,
            summary: {
                totalAPIs: this.session.discoveredAPIs.length,
                pokemonAPIs: this.session.discoveredAPIs.filter(api => api.hasPokemonData).length,
                totalPokemonItems: this.session.pokemonData.length,
                successRate: this.session.successfulRequests / this.session.totalRequests
            }
        };
        
        fs.writeFileSync(discoveryFile, JSON.stringify(discoveryData, null, 2));
        console.log(`💾 API discovery saved to: ${discoveryFile}`);
        
        // Save Pokemon data
        let pokemonFile = null;
        if (this.session.pokemonData.length > 0) {
            pokemonFile = `tcgplayer-pokemon-data-${timestamp}.json`;
            const pokemonData = {
                metadata: {
                    extractedAt: new Date().toISOString(),
                    totalItems: this.session.pokemonData.length,
                    source: 'tcgplayer_web_api',
                    method: 'hybrid_api_scraping'
                },
                items: this.session.pokemonData
            };
            
            fs.writeFileSync(pokemonFile, JSON.stringify(pokemonData, null, 2));
            console.log(`🎴 Pokemon data saved to: ${pokemonFile}`);
        }
        
        return { discoveryFile, pokemonFile: pokemonFile };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Complete extraction workflow
     */
    async runFullExtraction() {
        try {
            console.log('🚀 Starting TCGPlayer Web API Full Extraction...');
            
            await this.initialize();
            const pokemonData = await this.extractPokemonData();
            await this.saveResults();
            
            console.log('\n🎉 TCGPlayer Web API Extraction Complete!');
            console.log(`📊 Results:`);
            console.log(`   📡 Working APIs: ${this.session.discoveredAPIs.length}`);
            console.log(`   🎯 Pokemon APIs: ${this.session.discoveredAPIs.filter(api => api.hasPokemonData).length}`);
            console.log(`   🎴 Pokemon Items: ${this.session.pokemonData.length}`);
            console.log(`   ⚠️  Errors: ${this.session.errors.length}`);
            
            return {
                success: true,
                pokemonData: this.session.pokemonData,
                apis: this.session.discoveredAPIs,
                summary: {
                    totalItems: this.session.pokemonData.length,
                    workingAPIs: this.session.discoveredAPIs.length,
                    errors: this.session.errors.length
                }
            };
            
        } catch (error) {
            console.error('💥 Critical error:', error);
            await this.saveResults();
            return { success: false, error: error.message };
        }
    }
}

// Main execution
async function main() {
    const client = new TCGPlayerWebAPIClient();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--discovery')) {
        await client.initialize();
        await client.saveResults();
    } else {
        await client.runFullExtraction();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerWebAPIClient;
