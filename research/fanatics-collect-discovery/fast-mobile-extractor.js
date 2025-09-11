#!/usr/bin/env node
/**
 * 🎯 FANATICS MOBILE POKEMON EXTRACTOR - STREAMLINED
 * =================================================
 * 
 * Fast, focused mobile API extraction for Pokemon cards only
 */

const https = require('https');
const fs = require('fs');

class FastFanaticsMobileExtractor {
    constructor() {
        this.results = [];
        this.mobileHeaders = {
            'User-Agent': 'FanaticsCollect/3.2.1 (iPhone; iOS 16.0; Scale/3.00)',
            'Accept': 'application/json, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'X-Requested-With': 'com.fanatics.collect',
            'X-App-Version': '3.2.1',
            'Content-Type': 'application/json'
        };
        
        // Most likely mobile endpoints
        this.endpoints = [
            'https://api.fanaticscollect.com/api/v1/search?q=pokemon',
            'https://api.fanaticscollect.com/api/v1/cards/pokemon',
            'https://api.fanaticscollect.com/mobile/search?query=pokemon',
            'https://www.fanaticscollect.com/api/search?category=pokemon',
            'https://www.fanaticscollect.com/graphql'
        ];
    }

    async fastRequest(url, data = null) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log(`⏰ Timeout: ${url}`);
                resolve(null);
            }, 5000); // 5 second timeout

            try {
                const urlObj = new URL(url);
                const options = {
                    hostname: urlObj.hostname,
                    path: urlObj.pathname + urlObj.search,
                    method: data ? 'POST' : 'GET',
                    headers: this.mobileHeaders,
                    timeout: 5000
                };

                const req = https.request(options, (res) => {
                    let responseData = '';
                    res.on('data', (chunk) => responseData += chunk);
                    res.on('end', () => {
                        clearTimeout(timeout);
                        resolve({
                            status: res.statusCode,
                            data: responseData,
                            url: url
                        });
                    });
                });

                req.on('error', () => {
                    clearTimeout(timeout);
                    resolve(null);
                });

                if (data) req.write(JSON.stringify(data));
                req.end();

            } catch (error) {
                clearTimeout(timeout);
                resolve(null);
            }
        });
    }

    async testEndpoint(url) {
        console.log(`🔍 Testing: ${url.substring(0, 60)}...`);
        
        // Test GET request
        let response = await this.fastRequest(url);
        
        if (response && response.status < 400) {
            console.log(`✅ GET Success: ${response.status}`);
            this.analyzeResponse(response);
        } else {
            console.log(`❌ GET Failed: ${response?.status || 'timeout'}`);
        }
        
        // Test POST with Pokemon query
        if (url.includes('graphql') || url.includes('search')) {
            const pokemonQuery = url.includes('graphql') ? 
                { query: '{ cards(filter: {name: "pokemon"}) { id name price } }' } :
                { q: 'pokemon', category: 'trading-cards' };
                
            response = await this.fastRequest(url, pokemonQuery);
            
            if (response && response.status < 400) {
                console.log(`✅ POST Success: ${response.status}`);
                this.analyzeResponse(response);
            } else {
                console.log(`❌ POST Failed: ${response?.status || 'timeout'}`);
            }
        }
    }

    analyzeResponse(response) {
        try {
            const data = JSON.parse(response.data);
            let pokemonCards = 0;
            
            // Count Pokemon-related items in response
            const dataStr = JSON.stringify(data).toLowerCase();
            const pokemonMatches = (dataStr.match(/pokemon/g) || []).length;
            
            if (pokemonMatches > 0) {
                pokemonCards = this.extractPokemonCount(data);
                console.log(`🎴 Found ${pokemonCards} Pokemon items in response`);
                
                this.results.push({
                    url: response.url,
                    pokemon_count: pokemonCards,
                    response_size: response.data.length,
                    sample_data: JSON.stringify(data).substring(0, 200) + '...'
                });
            }
            
        } catch (error) {
            // Not JSON or parsing failed
            if (response.data.toLowerCase().includes('pokemon')) {
                console.log(`📄 HTML response contains Pokemon content`);
                this.results.push({
                    url: response.url,
                    type: 'html',
                    contains_pokemon: true,
                    size: response.data.length
                });
            }
        }
    }

    extractPokemonCount(data) {
        let count = 0;
        
        const countInObject = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            
            const objStr = JSON.stringify(obj).toLowerCase();
            if (objStr.includes('pokemon')) count++;
            
            for (const key in obj) {
                if (Array.isArray(obj[key])) {
                    obj[key].forEach(countInObject);
                } else if (typeof obj[key] === 'object') {
                    countInObject(obj[key]);
                }
            }
        };
        
        countInObject(data);
        return count;
    }

    async execute() {
        console.log('🚀 FAST FANATICS MOBILE POKEMON EXTRACTION');
        console.log('==========================================');
        console.log('⚡ Testing mobile endpoints with 5s timeouts...\n');

        // Test all endpoints in parallel for speed
        const promises = this.endpoints.map(url => this.testEndpoint(url));
        await Promise.all(promises);

        console.log('\n📊 EXTRACTION RESULTS');
        console.log('=====================');
        
        if (this.results.length === 0) {
            console.log('❌ No Pokemon data found in mobile endpoints');
            console.log('🔒 Fanatics Collect mobile APIs appear to be protected');
        } else {
            console.log(`✅ Found Pokemon data in ${this.results.length} endpoints:`);
            this.results.forEach((result, i) => {
                console.log(`${i + 1}. ${result.url}`);
                console.log(`   Pokemon items: ${result.pokemon_count || 'Unknown'}`);
                console.log(`   Type: ${result.type || 'JSON'}`);
            });
        }

        // Save results
        const report = {
            timestamp: new Date().toISOString(),
            extraction_method: 'Fast Mobile API Testing',
            endpoints_tested: this.endpoints.length,
            successful_endpoints: this.results.length,
            results: this.results,
            conclusion: this.results.length > 0 ? 
                'Pokemon data accessible via mobile APIs' : 
                'Mobile APIs protected or no Pokemon data available'
        };

        fs.writeFileSync('fanatics-mobile-quick-test.json', JSON.stringify(report, null, 2));
        
        console.log('\n🎯 CONCLUSION');
        console.log('=============');
        console.log(`📄 Report saved: fanatics-mobile-quick-test.json`);
        
        if (this.results.length === 0) {
            console.log('💡 RECOMMENDATION: Focus on existing 694K+ Pokemon dataset');
            console.log('   - eBay: 505K records ✅');
            console.log('   - Pokemon TCG API: 19.5K cards ✅');
            console.log('   - Collector Crypt: 24K cards ✅');
            console.log('   - Phygitals: 1.2K cards ✅');
            console.log('   → Total: 550K+ Pokemon cards already available!');
        } else {
            console.log('🚀 SUCCESS: Mobile endpoints discovered!');
            console.log('   → Proceed with full mobile extraction');
        }

        return report;
    }
}

// Execute immediately
async function main() {
    const extractor = new FastFanaticsMobileExtractor();
    await extractor.execute();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FastFanaticsMobileExtractor;
