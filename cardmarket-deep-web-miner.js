/**
 * CardMarket Deep Web Mining Tool
 * Aggressive discovery of undocumented APIs and data endpoints
 * Inspired by successful Collector Crypt patterns
 */

const https = require('https');
const fs = require('fs');

class CardMarketDeepMiner {
    constructor() {
        this.baseUrl = 'https://www.cardmarket.com';
        this.results = {
            timestamp: new Date().toISOString(),
            webEndpoints: {},
            ajaxEndpoints: {},
            hiddenApis: {},
            pokemonUrls: {},
            dataFiles: {},
            workingEndpoints: []
        };
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve) => {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.cardmarket.com/',
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            };

            console.log(`🕵️  Deep mining: ${url}`);

            const req = https.request(url, { 
                method: options.method || 'GET', 
                headers,
                timeout: 15000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        url,
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        size: data.length
                    });
                });
            });

            req.on('error', () => {
                resolve({ url, statusCode: 0, body: '', size: 0, error: true });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ url, statusCode: 0, body: '', size: 0, timeout: true });
            });

            req.end();
        });
    }

    // Mine Pokemon web pages for hidden API endpoints
    async minePokemonWebPages() {
        console.log('\n🎮 DEEP MINING: Pokemon Web Pages');
        
        const pokemonUrls = [
            `${this.baseUrl}/en/Pokemon`,
            `${this.baseUrl}/en/Pokemon/Cards`,
            `${this.baseUrl}/en/Pokemon/Products`,
            `${this.baseUrl}/en/Pokemon/Singles`,
            `${this.baseUrl}/en/Pokemon/Base-Set`,
            `${this.baseUrl}/en/Pokemon/Charizard`
        ];

        for (const url of pokemonUrls) {
            const response = await this.makeRequest(url);
            
            this.results.pokemonUrls[url] = {
                accessible: response.statusCode === 200,
                statusCode: response.statusCode,
                size: response.size
            };

            if (response.statusCode === 200) {
                console.log(`✅ Pokemon page accessible: ${url}`);
                await this.extractApiEndpoints(url, response.body);
                await this.extractDataUrls(url, response.body);
            }

            await this.delay(800);
        }
    }

    // Extract API endpoints from page source
    async extractApiEndpoints(pageUrl, html) {
        console.log(`🔍 Extracting APIs from: ${pageUrl}`);
        
        // Patterns for finding API endpoints in JavaScript/HTML
        const apiPatterns = [
            // Direct API URLs
            /['"]https?:\/\/[^'"]*\/api\/[^'"]+/g,
            /['"]\/api\/[^'"]+/g,
            /['"]\/ajax\/[^'"]+/g,
            
            // Fetch calls
            /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /\$\.ajax\s*\(\s*{[^}]*url\s*:\s*['"`]([^'"`]+)['"`]/g,
            /\$\.get\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /\$\.post\s*\(\s*['"`]([^'"`]+)['"`]/g,
            
            // XMLHttpRequest
            /xhr\.open\s*\(\s*['"`]GET['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
            /request\.open\s*\(\s*['"`]GET['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
            
            // Data URLs and endpoints
            /data-url\s*=\s*['"`]([^'"`]+)['"`]/g,
            /data-endpoint\s*=\s*['"`]([^'"`]+)['"`]/g,
            /data-api\s*=\s*['"`]([^'"`]+)['"`]/g,
        ];

        const foundEndpoints = new Set();
        
        for (const pattern of apiPatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const endpoint = match[1] || match[0];
                if (endpoint && !endpoint.includes('google') && !endpoint.includes('facebook')) {
                    foundEndpoints.add(endpoint.replace(/['"]/g, ''));
                }
            }
        }

        if (foundEndpoints.size > 0) {
            console.log(`📊 Found ${foundEndpoints.size} potential API endpoints`);
            
            // Test each discovered endpoint
            for (const endpoint of Array.from(foundEndpoints).slice(0, 10)) {
                const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
                await this.testDiscoveredEndpoint(fullUrl, pageUrl);
                await this.delay(500);
            }
        }
    }

    // Test discovered endpoints
    async testDiscoveredEndpoint(url, sourceUrl) {
        const response = await this.makeRequest(url);
        
        this.results.ajaxEndpoints[url] = {
            sourceUrl,
            accessible: response.statusCode === 200,
            statusCode: response.statusCode,
            isJson: this.isJsonResponse(response),
            hasData: response.size > 100,
            size: response.size
        };

        if (response.statusCode === 200) {
            console.log(`🎯 Working endpoint discovered: ${url}`);
            this.results.workingEndpoints.push(url);
            
            if (this.isJsonResponse(response)) {
                console.log(`📄 JSON data available at: ${url}`);
                await this.analyzeJsonEndpoint(url, response.body);
            }
        }
    }

    // Look for data files and exports
    async extractDataUrls(pageUrl, html) {
        const dataPatterns = [
            // Export/download links
            /href\s*=\s*['"`]([^'"`]*\.json[^'"`]*)['"`]/g,
            /href\s*=\s*['"`]([^'"`]*\.csv[^'"`]*)['"`]/g,
            /href\s*=\s*['"`]([^'"`]*export[^'"`]*)['"`]/g,
            /href\s*=\s*['"`]([^'"`]*download[^'"`]*)['"`]/g,
            
            // Data URLs
            /data-file\s*=\s*['"`]([^'"`]+)['"`]/g,
            /data-export\s*=\s*['"`]([^'"`]+)['"`]/g,
        ];

        for (const pattern of dataPatterns) {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const dataUrl = match[1];
                if (dataUrl) {
                    const fullUrl = dataUrl.startsWith('http') ? dataUrl : `${this.baseUrl}${dataUrl}`;
                    console.log(`📁 Data file found: ${fullUrl}`);
                    
                    const response = await this.makeRequest(fullUrl);
                    this.results.dataFiles[fullUrl] = {
                        accessible: response.statusCode === 200,
                        statusCode: response.statusCode,
                        size: response.size,
                        type: this.getFileType(dataUrl)
                    };
                    
                    await this.delay(400);
                }
            }
        }
    }

    // Test common web API patterns
    async testCommonWebPatterns() {
        console.log('\n🌐 DEEP MINING: Common Web API Patterns');
        
        const commonPatterns = [
            // Search and autocomplete
            '/search/autocomplete',
            '/api/search/suggestions',
            '/autocomplete/products',
            '/suggest/cards',
            
            // Product APIs
            '/api/products/search',
            '/products/find',
            '/cards/search',
            '/products/pokemon',
            
            // Data feeds
            '/feed/products.json',
            '/data/cards.json',
            '/export/products',
            '/api/export/cards',
            
            // Mobile/App APIs
            '/mobile/api/products',
            '/app/search',
            '/m/products',
            
            // Admin/Internal
            '/internal/api/products',
            '/admin/api/cards',
            '/staff/data',
            
            // Version-less APIs
            '/api/products',
            '/api/cards',
            '/api/search',
            '/api/games'
        ];

        for (const pattern of commonPatterns) {
            const url = `${this.baseUrl}${pattern}`;
            const response = await this.makeRequest(url);
            
            if (response.statusCode === 200 || response.statusCode === 302) {
                console.log(`🎯 Pattern success: ${pattern} (${response.statusCode})`);
                this.results.hiddenApis[pattern] = {
                    accessible: true,
                    statusCode: response.statusCode,
                    size: response.size,
                    isRedirect: response.statusCode === 302
                };
            }

            await this.delay(600);
        }
    }

    // Test Pokemon-specific search patterns
    async testPokemonSearchPatterns() {
        console.log('\n🔍 DEEP MINING: Pokemon Search Patterns');
        
        const pokemonSearches = [
            '/search?q=charizard',
            '/search?query=pikachu',
            '/api/search?term=base+set',
            '/products/search?name=charizard',
            '/cards?search=pokemon',
            '/find?q=pokemon+charizard',
            '/autocomplete?q=char',
            '/suggest?term=pika',
            '/products?game=pokemon',
            '/cards/pokemon/charizard'
        ];

        for (const searchUrl of pokemonSearches) {
            const fullUrl = `${this.baseUrl}${searchUrl}`;
            const response = await this.makeRequest(fullUrl);
            
            if (response.statusCode === 200) {
                console.log(`🎮 Pokemon search working: ${searchUrl}`);
                this.results.pokemonUrls[searchUrl] = {
                    accessible: true,
                    statusCode: 200,
                    hasPokemonData: this.containsPokemonData(response.body),
                    isApi: this.isJsonResponse(response)
                };
                
                if (this.isJsonResponse(response)) {
                    console.log(`📊 Pokemon JSON API found: ${searchUrl}`);
                    await this.analyzeJsonEndpoint(fullUrl, response.body);
                }
            }

            await this.delay(700);
        }
    }

    // Analyze JSON endpoints for Pokemon data
    async analyzeJsonEndpoint(url, jsonData) {
        try {
            const data = JSON.parse(jsonData);
            console.log(`🔍 Analyzing JSON structure from: ${url}`);
            
            const analysis = {
                hasProducts: !!(data.products || data.items || data.cards),
                hasSearch: !!(data.results || data.matches),
                hasPricing: this.hasPricingData(data),
                hasPokemon: this.containsPokemonInData(data),
                keys: Object.keys(data).slice(0, 10),
                sampleData: this.extractSampleData(data)
            };
            
            this.results.ajaxEndpoints[url] = {
                ...this.results.ajaxEndpoints[url],
                analysis
            };
            
            if (analysis.hasPokemon) {
                console.log(`🎯 JACKPOT: Pokemon data found in JSON at ${url}`);
            }
            
        } catch (error) {
            console.log(`⚠️ Invalid JSON from ${url}: ${error.message}`);
        }
    }

    // Utility methods
    isJsonResponse(response) {
        return response.headers['content-type']?.includes('application/json') ||
               response.body.trim().startsWith('{') || 
               response.body.trim().startsWith('[');
    }

    containsPokemonData(text) {
        return /pokemon|charizard|pikachu|base.?set|trading.?card/i.test(text);
    }

    containsPokemonInData(data) {
        const jsonStr = JSON.stringify(data).toLowerCase();
        return /pokemon|charizard|pikachu|tcg/.test(jsonStr);
    }

    hasPricingData(data) {
        const jsonStr = JSON.stringify(data).toLowerCase();
        return /price|cost|value|\$|\€|currency/.test(jsonStr);
    }

    extractSampleData(data) {
        if (Array.isArray(data)) {
            return data.slice(0, 2);
        } else if (data.products || data.items) {
            const items = data.products || data.items;
            return Array.isArray(items) ? items.slice(0, 2) : items;
        }
        return null;
    }

    getFileType(url) {
        if (url.includes('.json')) return 'JSON';
        if (url.includes('.csv')) return 'CSV';
        if (url.includes('.xml')) return 'XML';
        return 'UNKNOWN';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate comprehensive report
    generateDeepMiningReport() {
        console.log('\n📋 GENERATING DEEP MINING REPORT');
        
        const workingEndpoints = this.results.workingEndpoints;
        const jsonApis = Object.entries(this.results.ajaxEndpoints)
            .filter(([_, data]) => data.isJson && data.accessible)
            .map(([url, _]) => url);
        
        const pokemonApis = Object.entries(this.results.pokemonUrls)
            .filter(([_, data]) => data.accessible && data.hasPokemonData)
            .map(([url, _]) => url);

        this.results.summary = {
            totalWorkingEndpoints: workingEndpoints.length,
            jsonApisFound: jsonApis.length,
            pokemonApisFound: pokemonApis.length,
            dataFilesFound: Object.keys(this.results.dataFiles).length,
            extractionPossible: workingEndpoints.length > 0,
            recommendedEndpoint: workingEndpoints[0] || null
        };
    }

    async saveResults() {
        const filename = `cardmarket-deep-mining-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
        console.log(`💾 Deep mining report saved: ${filename}`);
        return filename;
    }

    // Main execution
    async runDeepMining() {
        console.log('🕵️  Starting CardMarket Deep Web Mining...\n');
        
        try {
            await this.minePokemonWebPages();
            await this.testCommonWebPatterns();
            await this.testPokemonSearchPatterns();
            
            this.generateDeepMiningReport();
            const reportPath = await this.saveResults();
            
            console.log('\n' + '='.repeat(70));
            console.log('🕵️  CARDMARKET DEEP MINING COMPLETE');
            console.log('='.repeat(70));
            console.log(`🎯 Working Endpoints: ${this.results.summary.totalWorkingEndpoints}`);
            console.log(`📊 JSON APIs: ${this.results.summary.jsonApisFound}`);
            console.log(`🎮 Pokemon APIs: ${this.results.summary.pokemonApisFound}`);
            console.log(`📁 Data Files: ${this.results.summary.dataFilesFound}`);
            console.log(`✅ Extraction Possible: ${this.results.summary.extractionPossible ? 'YES' : 'NO'}`);
            
            if (this.results.summary.recommendedEndpoint) {
                console.log(`🎯 Recommended Endpoint: ${this.results.summary.recommendedEndpoint}`);
            }
            
            console.log(`\n📄 Full report: ${reportPath}`);
            console.log('='.repeat(70));
            
            return this.results;
            
        } catch (error) {
            console.error(`❌ Deep mining failed: ${error.message}`);
            throw error;
        }
    }
}

// Execute deep mining
async function runDeepMining() {
    const miner = new CardMarketDeepMiner();
    await miner.runDeepMining();
}

if (require.main === module) {
    runDeepMining().catch(console.error);
}

module.exports = { CardMarketDeepMiner };
