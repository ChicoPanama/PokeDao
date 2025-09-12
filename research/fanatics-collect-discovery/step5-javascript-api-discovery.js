#!/usr/bin/env node
/**
 * 🔍 STEP 5: JAVASCRIPT API DISCOVERY  
 * ==================================
 * 
 * Analyze JavaScript files to discover the actual API endpoints
 * that load Pokemon card data dynamically
 */

const https = require('https');
const fs = require('fs');

class JavaScriptApiDiscovery {
    constructor() {
        this.baseUrl = 'www.fanaticscollect.com';
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
        this.discoveredApis = new Set();
        this.jsFiles = [];
        this.apiPatterns = [];
        
        // JavaScript files discovered in Step 3
        this.targetJsFiles = [
            '/_next/static/chunks/fd9d1056-0b76c300ca70144f.js',
            '/_next/static/chunks/2117-059bd95312bc1f5c.js', 
            '/_next/static/chunks/main-app-5294d1645fe5526e.js'
        ];
    }

    async discoverJavaScriptApis() {
        console.log('🔍 STEP 5: JAVASCRIPT API DISCOVERY');
        console.log('==================================');
        console.log('Analyzing JavaScript files for Pokemon API endpoints...\n');

        // First, get fresh list of JS files from homepage
        await this.refreshJavaScriptFiles();

        // Analyze each JavaScript file
        let jsCount = 0;
        for (const jsFile of this.jsFiles.slice(0, 10)) { // Limit to first 10 files
            jsCount++;
            console.log(`\n[${jsCount}/${Math.min(10, this.jsFiles.length)}] Analyzing: ${jsFile.substring(0, 60)}...`);
            
            try {
                const jsContent = await this.fetchJavaScriptFile(jsFile);
                console.log(`  📜 Downloaded: ${jsContent.length.toLocaleString()} characters`);
                
                const apis = this.extractApiEndpoints(jsContent, jsFile);
                console.log(`  🎯 API endpoints found: ${apis.length}`);
                
                if (apis.length > 0) {
                    apis.slice(0, 3).forEach(api => {
                        console.log(`    - ${api}`);
                    });
                }
                
            } catch (error) {
                console.log(`  ❌ Failed to analyze: ${error.message}`);
            }
            
            await this.delay(1000); // Rate limiting
        }

        // Test discovered API endpoints
        await this.testDiscoveredApis();

        return this.generateReport();
    }

    async refreshJavaScriptFiles() {
        console.log('🔄 Refreshing JavaScript file list from homepage...');
        
        try {
            const homepage = await this.fetchPage('/');
            
            // Extract all JavaScript files from homepage
            const jsPattern = /<script[^>]*src=["']([^"']*\.js[^"']*?)["'][^>]*>/gi;
            let match;
            
            while ((match = jsPattern.exec(homepage)) !== null) {
                const jsFile = match[1];
                
                // Skip external JS files
                if (!jsFile.startsWith('http') && !jsFile.includes('google') && !jsFile.includes('facebook')) {
                    this.jsFiles.push(jsFile);
                }
            }
            
            console.log(`  📜 Found ${this.jsFiles.length} JavaScript files`);
            
        } catch (error) {
            console.log('  ⚠️ Using fallback JS file list');
            this.jsFiles = [...this.targetJsFiles];
        }
    }

    async fetchPage(path) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: path,
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml',
                    'Connection': 'keep-alive'
                },
                timeout: 15000
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });

            req.end();
        });
    }

    async fetchJavaScriptFile(jsPath) {
        return new Promise((resolve, reject) => {
            // Ensure absolute URL
            const fullPath = jsPath.startsWith('/') ? jsPath : '/' + jsPath;
            
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: fullPath,
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/javascript, text/javascript, */*',
                    'Referer': `https://${this.baseUrl}/`,
                    'Connection': 'keep-alive'
                },
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });

            req.end();
        });
    }

    extractApiEndpoints(jsContent, sourceFile) {
        const foundApis = [];
        
        try {
            // Patterns to find API endpoints in JavaScript
            const apiPatterns = [
                // Direct API calls
                /["']([^"']*\/api\/[^"']*)["']/g,
                /["']([^"']*\/graphql[^"']*)["']/g,
                
                // Fetch calls
                /fetch\s*\(\s*["']([^"']*)["']/g,
                /axios\.[get|post|put|delete]+\s*\(\s*["']([^"']*)["']/g,
                
                // URL building patterns  
                /baseURL\s*[:=]\s*["']([^"']*)["']/g,
                /apiUrl\s*[:=]\s*["']([^"']*)["']/g,
                /endpoint\s*[:=]\s*["']([^"']*)["']/g,
                
                // NextJS patterns
                /_next\/static\/chunks\/.*["']([^"']*\/api\/[^"']*)["']/g,
                
                // Query patterns that might be Pokemon-related
                /["']([^"']*pokemon[^"']*)["']/gi,
                /["']([^"']*card[^"']*)["']/gi,
                /["']([^"']*auction[^"']*)["']/gi,
                /["']([^"']*marketplace[^"']*)["']/gi,
                
                // Route definitions
                /route\s*[:=]\s*["']([^"']*)["']/g,
                /path\s*[:=]\s*["']([^"']*)["']/g
            ];

            for (const pattern of apiPatterns) {
                let match;
                while ((match = pattern.exec(jsContent)) !== null) {
                    const endpoint = match[1];
                    
                    if (endpoint && this.isValidApiEndpoint(endpoint)) {
                        foundApis.push(endpoint);
                        this.discoveredApis.add(endpoint);
                    }
                }
            }

            // Look for Pokemon-specific function names or variables
            const pokemonPatterns = [
                /function\s+(\w*pokemon\w*)/gi,
                /const\s+(\w*pokemon\w*)/gi,
                /let\s+(\w*pokemon\w*)/gi,
                /(\w*pokemon\w*)\s*[:=]/gi
            ];

            for (const pattern of pokemonPatterns) {
                let match;
                while ((match = pattern.exec(jsContent)) !== null) {
                    console.log(`    🎴 Pokemon function/variable: ${match[1]}`);
                }
            }

        } catch (error) {
            console.log(`    ⚠️ API extraction error: ${error.message}`);
        }

        return [...new Set(foundApis)]; // Remove duplicates
    }

    isValidApiEndpoint(endpoint) {
        // Filter out invalid or irrelevant endpoints
        if (!endpoint || endpoint.length < 3) return false;
        if (endpoint.includes('google.com')) return false;
        if (endpoint.includes('facebook.com')) return false;
        if (endpoint.includes('twitter.com')) return false;
        if (endpoint.startsWith('data:')) return false;
        if (endpoint.startsWith('blob:')) return false;
        if (endpoint.endsWith('.css')) return false;
        if (endpoint.endsWith('.png')) return false;
        if (endpoint.endsWith('.jpg')) return false;
        
        // Must look like an API endpoint
        const hasApiPattern = endpoint.includes('/api/') || 
                             endpoint.includes('/graphql') ||
                             endpoint.includes('pokemon') ||
                             endpoint.includes('card') ||
                             endpoint.includes('auction') ||
                             endpoint.includes('marketplace');
                             
        return hasApiPattern;
    }

    async testDiscoveredApis() {
        console.log('\n🎯 TESTING DISCOVERED API ENDPOINTS');
        console.log('===================================');

        const uniqueApis = Array.from(this.discoveredApis);
        console.log(`Testing ${uniqueApis.length} discovered API endpoints...\n`);

        let apiCount = 0;
        for (const endpoint of uniqueApis.slice(0, 15)) { // Limit to 15 tests
            apiCount++;
            console.log(`[${apiCount}/${Math.min(15, uniqueApis.length)}] ${endpoint}`);
            
            try {
                const result = await this.testApiEndpoint(endpoint);
                
                if (result.statusCode === 200) {
                    console.log(`  ✅ ${result.statusCode} - ${result.contentLength} bytes`);
                    
                    if (result.containsPokemon) {
                        console.log(`  🎴 POKEMON DATA FOUND!`);
                    }
                } else {
                    console.log(`  ❌ ${result.statusCode}`);
                }
                
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
            
            await this.delay(1000);
        }
    }

    async testApiEndpoint(endpoint) {
        // Make endpoint absolute if needed
        let fullPath = endpoint;
        if (!fullPath.startsWith('/')) {
            fullPath = '/' + fullPath;
        }

        const content = await this.fetchPage(fullPath);
        
        return {
            endpoint: endpoint,
            statusCode: 200,
            contentLength: content.length,
            containsPokemon: this.containsPokemonData(content),
            content: content.substring(0, 1000) // First 1KB for analysis
        };
    }

    containsPokemonData(content) {
        if (!content) return false;
        
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'base set',
            'psa', 'bgs', 'graded', 'trading card'
        ];
        
        const lowerContent = content.toLowerCase();
        return pokemonIndicators.some(indicator => lowerContent.includes(indicator));
    }

    generateReport() {
        console.log('\n📊 STEP 5 COMPLETE - JAVASCRIPT API DISCOVERY REPORT');
        console.log('==================================================');

        const pokemonApis = Array.from(this.discoveredApis).filter(api => 
            api.toLowerCase().includes('pokemon') ||
            api.toLowerCase().includes('card') ||
            api.toLowerCase().includes('auction')
        );

        const report = {
            step: 5,
            description: 'JavaScript API Discovery',
            summary: {
                js_files_analyzed: this.jsFiles.length,
                total_apis_discovered: this.discoveredApis.size,
                pokemon_related_apis: pokemonApis.length
            },
            discovered_endpoints: Array.from(this.discoveredApis),
            pokemon_endpoints: pokemonApis,
            js_files_analyzed: this.jsFiles.slice(0, 10),
            recommendations: this.generateRecommendations()
        };

        // Save report
        const reportPath = 'step5-javascript-api-discovery-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Display summary
        console.log(`📜 JS Files Analyzed: ${this.jsFiles.length}`);
        console.log(`🎯 API Endpoints Discovered: ${this.discoveredApis.size}`);
        console.log(`🎴 Pokemon-Related APIs: ${pokemonApis.length}`);

        if (pokemonApis.length > 0) {
            console.log('\n🎴 POKEMON API ENDPOINTS:');
            pokemonApis.forEach(api => {
                console.log(`  - ${api}`);
            });
        }

        if (this.discoveredApis.size > 0) {
            console.log('\n🔍 ALL DISCOVERED ENDPOINTS:');
            Array.from(this.discoveredApis).slice(0, 10).forEach(api => {
                console.log(`  - ${api}`);
            });
            if (this.discoveredApis.size > 10) {
                console.log(`  ... and ${this.discoveredApis.size - 10} more`);
            }
        }

        console.log(`\n📄 Report saved: ${reportPath}`);
        
        if (this.discoveredApis.size > 0) {
            console.log('➡️  Ready for Step 6: API Endpoint Testing');
        } else {
            console.log('⚠️  No APIs discovered - may need browser automation');
        }

        return report;
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.discoveredApis.size > 0) {
            recommendations.push('API endpoints discovered - test for Pokemon data');
        } else {
            recommendations.push('No APIs found - try browser automation approach');
        }

        const pokemonApis = Array.from(this.discoveredApis).filter(api => 
            api.toLowerCase().includes('pokemon')
        );

        if (pokemonApis.length > 0) {
            recommendations.push('Pokemon-specific APIs found - high success probability');
        }

        recommendations.push('Consider using Playwright/Puppeteer for dynamic content');
        recommendations.push('Monitor network traffic with browser dev tools');

        return recommendations;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    const discovery = new JavaScriptApiDiscovery();
    await discovery.discoverJavaScriptApis();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = JavaScriptApiDiscovery;
