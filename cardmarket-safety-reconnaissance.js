/**
 * CardMarket API Safety Reconnaissance Tool
 * Comprehensive analysis before any data extraction
 */

const https = require('https');
const fs = require('fs');

class CardMarketSafetyAnalyzer {
    constructor() {
        this.baseUrl = 'https://api.cardmarket.com';
        this.results = {
            timestamp: new Date().toISOString(),
            safetyChecks: {},
            apiStructure: {},
            rateLimit: {},
            authentication: {},
            pokemonAvailability: {},
            recommendations: []
        };
    }

    // Make safe HTTP request with error handling
    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = `${this.baseUrl}${path}`;
            console.log(`🔍 Analyzing: ${url}`);
            
            const requestOptions = {
                method: 'GET',
                headers: {
                    'User-Agent': 'PokeDAO-Safety-Analyzer/1.0 (Research Purpose)',
                    'Accept': 'application/json, application/xml, text/html',
                    ...options.headers
                }
            };

            const req = https.request(url, requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        url: url
                    });
                });
            });

            req.on('error', (error) => {
                resolve({
                    statusCode: 0,
                    headers: {},
                    body: '',
                    error: error.message,
                    url: url
                });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({
                    statusCode: 0,
                    headers: {},
                    body: '',
                    error: 'Request timeout',
                    url: url
                });
            });

            req.end();
        });
    }

    // Test basic API accessibility
    async testBasicAccess() {
        console.log('\n🛡️  SAFETY CHECK 1: Basic API Access');
        
        const endpoints = [
            '/ws/v2.0/games',
            '/ws/v2.0/output.json/games',
            '/ws/documentation',
            '/ws/v2.0/products/find?search=test'
        ];

        for (const endpoint of endpoints) {
            const response = await this.makeRequest(endpoint);
            
            this.results.safetyChecks[endpoint] = {
                accessible: response.statusCode > 0,
                statusCode: response.statusCode,
                requiresAuth: response.statusCode === 401 || response.statusCode === 403,
                hasRateLimit: !!response.headers['x-request-limit-max'],
                contentType: response.headers['content-type'],
                error: response.error
            };

            if (response.headers['x-request-limit-max']) {
                this.results.rateLimit = {
                    maxRequests: response.headers['x-request-limit-max'],
                    currentCount: response.headers['x-request-limit-count'],
                    resetTime: response.headers['x-request-limit-reset']
                };
            }

            // Small delay between requests for politeness
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Analyze authentication requirements
    async analyzeAuthentication() {
        console.log('\n🔐 SAFETY CHECK 2: Authentication Analysis');
        
        // Test without authentication
        const noAuthResponse = await this.makeRequest('/ws/v2.0/games');
        
        this.results.authentication = {
            requiredForGames: noAuthResponse.statusCode === 401 || noAuthResponse.statusCode === 403,
            oauthRequired: noAuthResponse.body.includes('OAuth') || noAuthResponse.body.includes('oauth'),
            publicEndpoints: noAuthResponse.statusCode === 200,
            authErrorMessage: noAuthResponse.statusCode >= 400 ? noAuthResponse.body : null
        };

        // Check if any endpoints work without authentication
        if (noAuthResponse.statusCode === 200) {
            console.log('✅ Some endpoints accessible without authentication');
            this.results.recommendations.push('SAFE: Public endpoints available without authentication');
        } else {
            console.log('⚠️  Authentication required for API access');
            this.results.recommendations.push('CAUTION: Full authentication required - need API keys');
        }
    }

    // Test rate limiting behavior
    async testRateLimits() {
        console.log('\n⏱️  SAFETY CHECK 3: Rate Limit Analysis');
        
        const testRequests = [];
        const startTime = Date.now();
        
        // Make 5 rapid requests to test rate limiting
        for (let i = 0; i < 5; i++) {
            testRequests.push(this.makeRequest('/ws/v2.0/games'));
        }

        const responses = await Promise.all(testRequests);
        const endTime = Date.now();
        
        const rateLimitHit = responses.some(r => r.statusCode === 429 || r.statusCode === 503);
        const avgResponseTime = (endTime - startTime) / responses.length;
        
        this.results.rateLimit.testResults = {
            rapidRequestsBlocked: rateLimitHit,
            averageResponseTime: avgResponseTime,
            totalTestTime: endTime - startTime,
            successfulRequests: responses.filter(r => r.statusCode === 200).length
        };

        if (rateLimitHit) {
            console.log('⚠️  Rate limiting detected - need careful request spacing');
            this.results.recommendations.push('IMPORTANT: Implement request throttling (>1 second between requests)');
        } else {
            console.log('✅ No immediate rate limiting detected');
            this.results.recommendations.push('SAFE: Can make multiple requests, but still be respectful');
        }
    }

    // Check Pokemon game availability
    async checkPokemonAvailability() {
        console.log('\n🎮 SAFETY CHECK 4: Pokemon Data Availability');
        
        // Try to get games list
        const gamesResponse = await this.makeRequest('/ws/v2.0/output.json/games');
        
        if (gamesResponse.statusCode === 200) {
            try {
                const gamesData = JSON.parse(gamesResponse.body);
                const games = gamesData.game || gamesData.games || [];
                
                const pokemonGame = games.find(game => 
                    game.name && game.name.toLowerCase().includes('pokemon')
                );
                
                this.results.pokemonAvailability = {
                    gamesAccessible: true,
                    totalGames: games.length,
                    pokemonFound: !!pokemonGame,
                    pokemonGameId: pokemonGame ? pokemonGame.idGame : null,
                    pokemonGameName: pokemonGame ? pokemonGame.name : null,
                    allGames: games.map(g => ({ id: g.idGame, name: g.name })).slice(0, 10)
                };

                if (pokemonGame) {
                    console.log(`✅ Pokemon found! Game ID: ${pokemonGame.idGame}, Name: ${pokemonGame.name}`);
                    this.results.recommendations.push(`EXCELLENT: Pokemon game available (ID: ${pokemonGame.idGame})`);
                    
                    // Test Pokemon product search
                    await this.testPokemonProductSearch(pokemonGame.idGame);
                } else {
                    console.log('⚠️  Pokemon game not found in games list');
                    this.results.recommendations.push('WARNING: Pokemon not found in supported games');
                }
            } catch (error) {
                console.log(`❌ Error parsing games data: ${error.message}`);
                this.results.pokemonAvailability.error = error.message;
            }
        } else {
            console.log(`❌ Cannot access games endpoint: ${gamesResponse.statusCode}`);
            this.results.pokemonAvailability.error = `HTTP ${gamesResponse.statusCode}`;
        }
    }

    // Test Pokemon product search capability
    async testPokemonProductSearch(pokemonGameId) {
        console.log('\n🔍 SAFETY CHECK 5: Pokemon Product Search Test');
        
        const searchTerms = ['Charizard', 'Pikachu', 'Base Set'];
        
        for (const term of searchTerms) {
            const searchUrl = `/ws/v2.0/output.json/products/find?search=${encodeURIComponent(term)}&idGame=${pokemonGameId}`;
            const response = await this.makeRequest(searchUrl);
            
            this.results.pokemonAvailability.searchTests = this.results.pokemonAvailability.searchTests || {};
            this.results.pokemonAvailability.searchTests[term] = {
                statusCode: response.statusCode,
                accessible: response.statusCode === 200,
                hasResults: false,
                resultCount: 0
            };

            if (response.statusCode === 200) {
                try {
                    const searchData = JSON.parse(response.body);
                    const products = searchData.product || searchData.products || [];
                    
                    this.results.pokemonAvailability.searchTests[term].hasResults = products.length > 0;
                    this.results.pokemonAvailability.searchTests[term].resultCount = products.length;
                    
                    console.log(`✅ "${term}" search: ${products.length} results found`);
                } catch (error) {
                    console.log(`⚠️  Error parsing "${term}" search results: ${error.message}`);
                }
            } else {
                console.log(`❌ "${term}" search failed: HTTP ${response.statusCode}`);
            }
            
            // Respectful delay between searches
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Analyze API structure and endpoints
    async analyzeApiStructure() {
        console.log('\n📊 SAFETY CHECK 6: API Structure Analysis');
        
        const endpoints = [
            '/ws/v2.0/expansions',
            '/ws/v2.0/products',
            '/ws/v2.0/articles',
            '/ws/v2.0/users'
        ];

        for (const endpoint of endpoints) {
            const response = await this.makeRequest(endpoint);
            
            this.results.apiStructure[endpoint] = {
                statusCode: response.statusCode,
                requiresParams: response.statusCode === 400,
                accessible: response.statusCode !== 404,
                responseSize: response.body.length,
                contentType: response.headers['content-type']
            };

            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Generate safety recommendations
    generateSafetyReport() {
        console.log('\n📋 GENERATING SAFETY REPORT');
        
        // Analyze results and add recommendations
        const authRequired = this.results.authentication.requiredForGames;
        const rateLimitExists = Object.keys(this.results.rateLimit).length > 0;
        const pokemonAvailable = this.results.pokemonAvailability.pokemonFound;
        
        if (authRequired) {
            this.results.recommendations.push('CRITICAL: Setup OAuth authentication before any data extraction');
        }
        
        if (rateLimitExists) {
            this.results.recommendations.push('MANDATORY: Implement rate limiting (recommend 1 request per 2 seconds)');
        }
        
        if (pokemonAvailable) {
            this.results.recommendations.push('READY: Pokemon data is available for extraction');
        }
        
        // Overall safety assessment
        let safetyLevel = 'HIGH';
        if (authRequired && !pokemonAvailable) safetyLevel = 'LOW';
        else if (authRequired || !pokemonAvailable) safetyLevel = 'MEDIUM';
        
        this.results.overallSafety = {
            level: safetyLevel,
            readyForExtraction: pokemonAvailable && !authRequired,
            requiresSetup: authRequired,
            dataAvailable: pokemonAvailable
        };
    }

    // Save results to file
    async saveResults() {
        const filename = `cardmarket-safety-analysis-${Date.now()}.json`;
        const filepath = `/Users/arcadio/dev/pokedao/${filename}`;
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log(`\n💾 Safety analysis saved to: ${filename}`);
        
        return filepath;
    }

    // Run complete safety analysis
    async runCompleteAnalysis() {
        console.log('🚀 Starting CardMarket Safety Reconnaissance...\n');
        
        try {
            await this.testBasicAccess();
            await this.analyzeAuthentication();
            await this.testRateLimits();
            await this.checkPokemonAvailability();
            await this.analyzeApiStructure();
            
            this.generateSafetyReport();
            
            const reportPath = await this.saveResults();
            
            // Print summary
            console.log('\n' + '='.repeat(60));
            console.log('🛡️  CARDMARKET SAFETY ANALYSIS COMPLETE');
            console.log('='.repeat(60));
            console.log(`📊 Overall Safety Level: ${this.results.overallSafety.level}`);
            console.log(`🎯 Ready for Extraction: ${this.results.overallSafety.readyForExtraction ? 'YES' : 'NO'}`);
            console.log(`🔑 Authentication Required: ${this.results.overallSafety.requiresSetup ? 'YES' : 'NO'}`);
            console.log(`🎮 Pokemon Data Available: ${this.results.overallSafety.dataAvailable ? 'YES' : 'NO'}`);
            
            console.log('\n📋 KEY RECOMMENDATIONS:');
            this.results.recommendations.forEach((rec, i) => {
                console.log(`${i + 1}. ${rec}`);
            });
            
            console.log(`\n📄 Full report: ${reportPath}`);
            console.log('='.repeat(60));
            
            return this.results;
            
        } catch (error) {
            console.error(`❌ Safety analysis failed: ${error.message}`);
            throw error;
        }
    }
}

// Execute safety analysis
async function runSafetyCheck() {
    const analyzer = new CardMarketSafetyAnalyzer();
    await analyzer.runCompleteAnalysis();
}

if (require.main === module) {
    runSafetyCheck().catch(console.error);
}

module.exports = { CardMarketSafetyAnalyzer };
