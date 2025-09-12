/**
 * CardMarket Advanced API Mining Tool
 * Comprehensive API discovery and bypass techniques
 * Based on successful patterns from Collector Crypt extraction
 */

const https = require('https');
const fs = require('fs');

class CardMarketApiMiner {
    constructor() {
        this.baseUrl = 'https://api.cardmarket.com';
        this.webUrl = 'https://www.cardmarket.com';
        this.results = {
            timestamp: new Date().toISOString(),
            discoveredEndpoints: {},
            bypassMethods: {},
            publicApis: {},
            mobileApis: {},
            graphqlEndpoints: {},
            pokemonData: {},
            recommendations: []
        };
        
        // Common API patterns discovered from other platforms
        this.apiPatterns = [
            // Public API patterns
            '/api/v1/public/',
            '/api/v2/public/',
            '/api/public/',
            '/public/api/',
            '/open/',
            '/free/',
            
            // Mobile API patterns
            '/mobile/',
            '/m/',
            '/app/',
            '/api/mobile/',
            
            // Search patterns
            '/search/',
            '/find/',
            '/query/',
            '/autocomplete/',
            '/suggest/',
            
            // GraphQL patterns
            '/graphql',
            '/gql',
            '/api/graphql',
            
            // Data export patterns
            '/export/',
            '/download/',
            '/feed/',
            '/rss/',
            '/json/',
            '/csv/',
            
            // Pokemon specific
            '/pokemon/',
            '/cards/',
            '/products/',
            '/games/',
            
            // Alternative domains/subdomains
            'https://m.cardmarket.com',
            'https://mobile.cardmarket.com',
            'https://app.cardmarket.com',
            'https://api-public.cardmarket.com',
            'https://open.cardmarket.com'
        ];
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.cardmarket.com/',
            'X-Requested-With': 'XMLHttpRequest'
        };
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve) => {
            const requestOptions = {
                method: options.method || 'GET',
                headers: { ...this.headers, ...options.headers },
                timeout: 10000
            };

            console.log(`🔍 Mining: ${url}`);

            const req = https.request(url, requestOptions, (res) => {
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
                resolve({ url, statusCode: 0, headers: {}, body: '', size: 0, error: true });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ url, statusCode: 0, headers: {}, body: '', size: 0, timeout: true });
            });

            if (options.data) {
                req.write(options.data);
            }
            req.end();
        });
    }

    // Discover public API endpoints (similar to Collector Crypt approach)
    async discoverPublicEndpoints() {
        console.log('\n🌐 PHASE 1: Discovering Public API Endpoints');
        
        const publicEndpoints = [
            `${this.baseUrl}/ws/documentation`,
            `${this.baseUrl}/ws/public`,
            `${this.baseUrl}/public`,
            `${this.baseUrl}/api/public`,
            `${this.baseUrl}/open`,
            `${this.baseUrl}/free`,
            `${this.webUrl}/api`,
            `${this.webUrl}/public/api`,
            `${this.webUrl}/mobile/api`,
            `${this.webUrl}/app/api`
        ];

        for (const endpoint of publicEndpoints) {
            const response = await this.makeRequest(endpoint);
            
            this.results.discoveredEndpoints[endpoint] = {
                accessible: response.statusCode === 200,
                statusCode: response.statusCode,
                contentType: response.headers['content-type'],
                size: response.size,
                isJson: this.isJsonResponse(response),
                hasData: response.size > 1000
            };

            if (response.statusCode === 200) {
                console.log(`✅ Found accessible endpoint: ${endpoint}`);
                await this.analyzeEndpointContent(endpoint, response);
            }

            await this.delay(300);
        }
    }

    // Test mobile API endpoints (often less restricted)
    async testMobileApis() {
        console.log('\n📱 PHASE 2: Testing Mobile API Endpoints');
        
        const mobileHeaders = {
            'User-Agent': 'CardMarket/iOS 1.0 CFNetwork/1240.0.4 Darwin/20.6.0',
            'X-Requested-With': 'com.cardmarket.app',
            'Accept': 'application/json'
        };

        const mobileEndpoints = [
            `${this.webUrl}/m/api/games`,
            `${this.webUrl}/mobile/games`,
            `${this.webUrl}/app/games`,
            `${this.webUrl}/api/m/games`,
            `${this.baseUrl}/mobile/games`,
            `${this.webUrl}/m/pokemon`,
            `${this.webUrl}/mobile/pokemon`,
            `${this.webUrl}/app/pokemon`
        ];

        for (const endpoint of mobileEndpoints) {
            const response = await this.makeRequest(endpoint, { headers: mobileHeaders });
            
            this.results.mobileApis[endpoint] = {
                accessible: response.statusCode === 200,
                statusCode: response.statusCode,
                bypassesAuth: response.statusCode === 200 && endpoint.includes('api'),
                hasGameData: this.containsGameData(response.body)
            };

            if (response.statusCode === 200) {
                console.log(`📱 Mobile API success: ${endpoint}`);
            }

            await this.delay(400);
        }
    }

    // Discover GraphQL endpoints (common bypass method)
    async discoverGraphQLEndpoints() {
        console.log('\n🎯 PHASE 3: Discovering GraphQL Endpoints');
        
        const graphqlEndpoints = [
            `${this.webUrl}/graphql`,
            `${this.webUrl}/api/graphql`,
            `${this.webUrl}/gql`,
            `${this.baseUrl}/graphql`,
            `${this.baseUrl}/api/graphql`
        ];

        const introspectionQuery = {
            query: `
                query IntrospectionQuery {
                    __schema {
                        queryType { name }
                        mutationType { name }
                        types {
                            name
                            kind
                            fields {
                                name
                                type { name }
                            }
                        }
                    }
                }
            `
        };

        for (const endpoint of graphqlEndpoints) {
            // Test basic GraphQL endpoint
            const getResponse = await this.makeRequest(endpoint);
            
            // Test GraphQL POST with introspection
            const postResponse = await this.makeRequest(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(introspectionQuery)
            });

            this.results.graphqlEndpoints[endpoint] = {
                getAccessible: getResponse.statusCode === 200,
                postAccessible: postResponse.statusCode === 200,
                hasIntrospection: this.hasGraphQLIntrospection(postResponse.body),
                schemas: this.extractGraphQLSchemas(postResponse.body)
            };

            if (postResponse.statusCode === 200) {
                console.log(`🎯 GraphQL endpoint found: ${endpoint}`);
            }

            await this.delay(500);
        }
    }

    // Test bypass methods discovered from other platforms
    async testBypassMethods() {
        console.log('\n🔓 PHASE 4: Testing Authentication Bypass Methods');
        
        const bypassMethods = [
            // Header manipulation
            { name: 'Remove Authorization', headers: { 'Authorization': '' }},
            { name: 'Public Token', headers: { 'Authorization': 'Bearer public' }},
            { name: 'Guest Token', headers: { 'Authorization': 'Bearer guest' }},
            { name: 'Anonymous', headers: { 'X-User-Type': 'anonymous' }},
            
            // Referrer manipulation  
            { name: 'Internal Referrer', headers: { 'Referer': 'https://www.cardmarket.com/en/Pokemon' }},
            { name: 'Admin Referrer', headers: { 'Referer': 'https://admin.cardmarket.com' }},
            
            // API version manipulation
            { name: 'API v1.0', url: '/ws/v1.0/games' },
            { name: 'API v0.9', url: '/ws/v0.9/games' },
            { name: 'API beta', url: '/ws/beta/games' },
            
            // Format manipulation
            { name: 'XML Format', url: '/ws/v2.0/output.xml/games' },
            { name: 'Plain Format', url: '/ws/v2.0/games.json' },
            { name: 'RSS Format', url: '/ws/v2.0/games.rss' }
        ];

        for (const method of bypassMethods) {
            const testUrl = method.url ? `${this.baseUrl}${method.url}` : `${this.baseUrl}/ws/v2.0/games`;
            const response = await this.makeRequest(testUrl, { headers: method.headers || {} });
            
            this.results.bypassMethods[method.name] = {
                successful: response.statusCode === 200,
                statusCode: response.statusCode,
                hasData: response.size > 100,
                method: method
            };

            if (response.statusCode === 200) {
                console.log(`🔓 Bypass successful: ${method.name}`);
            }

            await this.delay(600);
        }
    }

    // Search for Pokemon-specific endpoints
    async searchPokemonEndpoints() {
        console.log('\n🎮 PHASE 5: Pokemon-Specific Endpoint Discovery');
        
        const pokemonEndpoints = [
            // Direct Pokemon URLs
            `${this.webUrl}/en/Pokemon`,
            `${this.webUrl}/en/Pokemon/Cards`,
            `${this.webUrl}/en/Pokemon/Products`,
            `${this.webUrl}/pokemon`,
            `${this.webUrl}/cards/pokemon`,
            
            // API patterns for Pokemon
            `${this.webUrl}/api/pokemon`,
            `${this.webUrl}/api/games/pokemon`,
            `${this.webUrl}/api/search/pokemon`,
            `${this.webUrl}/api/products/pokemon`,
            
            // Search patterns
            `${this.webUrl}/search?q=pokemon`,
            `${this.webUrl}/api/search?game=pokemon`,
            `${this.webUrl}/autocomplete?q=pokemon`
        ];

        for (const endpoint of pokemonEndpoints) {
            const response = await this.makeRequest(endpoint);
            
            this.results.pokemonData[endpoint] = {
                accessible: response.statusCode === 200,
                statusCode: response.statusCode,
                hasPokemonContent: this.containsPokemonContent(response.body),
                hasProductData: this.containsProductData(response.body),
                isPokemonApi: this.isPokemonApiResponse(response)
            };

            if (response.statusCode === 200 && this.containsPokemonContent(response.body)) {
                console.log(`🎮 Pokemon data found: ${endpoint}`);
                await this.extractPokemonApiPatterns(endpoint, response);
            }

            await this.delay(400);
        }
    }

    // Extract API patterns from Pokemon pages
    async extractPokemonApiPatterns(url, response) {
        console.log(`🔍 Analyzing Pokemon page: ${url}`);
        
        // Look for AJAX/API calls in the page content
        const apiPatternRegexes = [
            /\/api\/[^"'\s]+/g,
            /\/ajax\/[^"'\s]+/g,
            /fetch\(['"]([^'"]+)['"]\)/g,
            /xhr\.open\(['"]GET['"],\s*['"]([^'"]+)['"]\)/g,
            /url:\s*['"]([^'"]+)['"]/g
        ];

        const foundPatterns = [];
        for (const regex of apiPatternRegexes) {
            const matches = response.body.match(regex) || [];
            foundPatterns.push(...matches);
        }

        if (foundPatterns.length > 0) {
            console.log(`📊 Found ${foundPatterns.length} potential API endpoints`);
            this.results.pokemonData[url].discoveredApis = foundPatterns.slice(0, 10);
            
            // Test discovered API endpoints
            for (const pattern of foundPatterns.slice(0, 5)) {
                const cleanUrl = pattern.replace(/['"]/g, '');
                const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `${this.webUrl}${cleanUrl}`;
                
                const apiResponse = await this.makeRequest(fullUrl);
                if (apiResponse.statusCode === 200) {
                    console.log(`✅ Working API discovered: ${fullUrl}`);
                    this.results.pokemonData[`discovered_${fullUrl}`] = {
                        discovered: true,
                        accessible: true,
                        statusCode: 200,
                        hasJsonData: this.isJsonResponse(apiResponse)
                    };
                }
                
                await this.delay(500);
            }
        }
    }

    // Test alternative domains and subdomains
    async testAlternativeDomains() {
        console.log('\n🌐 PHASE 6: Testing Alternative Domains');
        
        const alternativeDomains = [
            'https://m.cardmarket.com/api/games',
            'https://mobile.cardmarket.com/api/games', 
            'https://app.cardmarket.com/api/games',
            'https://api-public.cardmarket.com/games',
            'https://open.cardmarket.com/api/games',
            'https://cdn.cardmarket.com/api/games',
            'https://static.cardmarket.com/api/games'
        ];

        for (const domain of alternativeDomains) {
            const response = await this.makeRequest(domain);
            
            if (response.statusCode === 200) {
                console.log(`🌐 Alternative domain success: ${domain}`);
                this.results.discoveredEndpoints[domain] = {
                    accessible: true,
                    statusCode: 200,
                    alternative: true,
                    bypasses: true
                };
            }

            await this.delay(700);
        }
    }

    // Utility methods
    isJsonResponse(response) {
        return response.headers['content-type']?.includes('json') || 
               (response.body.startsWith('{') || response.body.startsWith('['));
    }

    containsGameData(body) {
        return /pokemon|magic|yugioh|games|products/i.test(body);
    }

    containsPokemonContent(body) {
        return /pokemon|charizard|pikachu|base\s+set/i.test(body);
    }

    containsProductData(body) {
        return /product|card|price|listing/i.test(body);
    }

    isPokemonApiResponse(response) {
        return this.isJsonResponse(response) && this.containsPokemonContent(response.body);
    }

    hasGraphQLIntrospection(body) {
        return body.includes('__schema') || body.includes('queryType');
    }

    extractGraphQLSchemas(body) {
        try {
            const data = JSON.parse(body);
            return data.data?.__schema?.types?.map(t => t.name) || [];
        } catch {
            return [];
        }
    }

    async analyzeEndpointContent(endpoint, response) {
        if (this.isJsonResponse(response)) {
            try {
                const data = JSON.parse(response.body);
                console.log(`📊 JSON endpoint found: ${Object.keys(data).join(', ')}`);
            } catch (e) {
                console.log(`⚠️ Invalid JSON in response from ${endpoint}`);
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate comprehensive report
    generateMiningReport() {
        console.log('\n📋 GENERATING COMPREHENSIVE API MINING REPORT');
        
        const successfulEndpoints = Object.entries(this.results.discoveredEndpoints)
            .filter(([_, data]) => data.accessible)
            .map(([url, _]) => url);

        const bypassMethods = Object.entries(this.results.bypassMethods)
            .filter(([_, data]) => data.successful)
            .map(([name, _]) => name);

        const pokemonEndpoints = Object.entries(this.results.pokemonData)
            .filter(([_, data]) => data.accessible && data.hasPokemonContent)
            .map(([url, _]) => url);

        this.results.summary = {
            totalEndpointsTested: Object.keys(this.results.discoveredEndpoints).length,
            successfulEndpoints: successfulEndpoints.length,
            workingBypassMethods: bypassMethods.length,
            pokemonEndpointsFound: pokemonEndpoints.length,
            recommendedApproach: this.getRecommendedApproach(successfulEndpoints, bypassMethods, pokemonEndpoints)
        };

        // Add specific recommendations
        if (pokemonEndpoints.length > 0) {
            this.results.recommendations.push('EXCELLENT: Pokemon data accessible through discovered endpoints');
            this.results.recommendations.push(`Proceed with extraction from: ${pokemonEndpoints[0]}`);
        }

        if (bypassMethods.length > 0) {
            this.results.recommendations.push(`SUCCESS: ${bypassMethods.length} bypass method(s) discovered`);
            this.results.recommendations.push(`Use bypass: ${bypassMethods[0]}`);
        }

        if (successfulEndpoints.length === 0) {
            this.results.recommendations.push('No direct API access found - consider alternative data sources');
        }
    }

    getRecommendedApproach(successful, bypasses, pokemon) {
        if (pokemon.length > 0) return 'DIRECT_POKEMON_API';
        if (bypasses.length > 0) return 'BYPASS_METHOD';
        if (successful.length > 0) return 'PUBLIC_ENDPOINT';
        return 'ALTERNATIVE_SOURCES';
    }

    async saveResults() {
        const filename = `cardmarket-api-mining-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
        console.log(`💾 Complete mining report saved: ${filename}`);
        return filename;
    }

    // Main execution method
    async runComprehensiveMining() {
        console.log('⛏️  Starting CardMarket Comprehensive API Mining...\n');
        
        try {
            await this.discoverPublicEndpoints();
            await this.testMobileApis();
            await this.discoverGraphQLEndpoints();
            await this.testBypassMethods();
            await this.searchPokemonEndpoints();
            await this.testAlternativeDomains();
            
            this.generateMiningReport();
            const reportPath = await this.saveResults();
            
            console.log('\n' + '='.repeat(70));
            console.log('⛏️  CARDMARKET API MINING COMPLETE');
            console.log('='.repeat(70));
            console.log(`📊 Endpoints Tested: ${this.results.summary.totalEndpointsTested}`);
            console.log(`✅ Successful: ${this.results.summary.successfulEndpoints}`);
            console.log(`🔓 Bypass Methods: ${this.results.summary.workingBypassMethods}`);
            console.log(`🎮 Pokemon Endpoints: ${this.results.summary.pokemonEndpointsFound}`);
            console.log(`🎯 Recommended Approach: ${this.results.summary.recommendedApproach}`);
            
            console.log('\n📋 KEY FINDINGS:');
            this.results.recommendations.forEach((rec, i) => {
                console.log(`${i + 1}. ${rec}`);
            });
            
            console.log(`\n📄 Full mining report: ${reportPath}`);
            console.log('='.repeat(70));
            
            return this.results;
            
        } catch (error) {
            console.error(`❌ API mining failed: ${error.message}`);
            throw error;
        }
    }
}

// Execute comprehensive mining
async function runApiMining() {
    const miner = new CardMarketApiMiner();
    await miner.runComprehensiveMining();
}

if (require.main === module) {
    runApiMining().catch(console.error);
}

module.exports = { CardMarketApiMiner };
