#!/usr/bin/env node
/**
 * 🔍 STEP 3: PAGE CONTENT ANALYSIS
 * ===============================
 * 
 * Analyze Fanatics Collect homepage to discover:
 * - Actual URL patterns
 * - JavaScript API calls
 * - Hidden Pokemon content
 * Simple text-based analysis - no browser required
 */

const https = require('https');
const fs = require('fs');

class PageContentAnalyzer {
    constructor() {
        this.baseUrl = 'www.fanaticscollect.com';
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
        
        this.findings = {
            urls: new Set(),
            apiEndpoints: new Set(), 
            pokemonMentions: [],
            jsFiles: new Set(),
            cssFiles: new Set(),
            images: new Set()
        };
    }

    async analyzePage() {
        console.log('🔍 STEP 3: PAGE CONTENT ANALYSIS');
        console.log('===============================');
        console.log('Analyzing homepage content for Pokemon data and URL patterns...\n');

        try {
            // Get homepage content
            const homepage = await this.fetchPage('/');
            console.log(`📄 Homepage loaded: ${homepage.length.toLocaleString()} characters`);

            // Analyze the content
            this.analyzeHtmlContent(homepage);
            this.findApiEndpoints(homepage);
            this.findPokemonContent(homepage);
            this.extractUrls(homepage);
            this.extractResources(homepage);

            return this.generateReport();

        } catch (error) {
            console.error('❌ Page analysis failed:', error.message);
            return null;
        }
    }

    fetchPage(path) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: path,
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
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

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    analyzeHtmlContent(html) {
        console.log('🔍 Analyzing HTML structure...');

        // Look for forms (might reveal search functionality)
        const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi) || [];
        console.log(`📝 Forms found: ${formMatches.length}`);

        // Look for search inputs
        const searchInputs = html.match(/<input[^>]*type=["\']search["\'][^>]*>/gi) || [];
        const textInputs = html.match(/<input[^>]*type=["\']text["\'][^>]*>/gi) || [];
        console.log(`🔍 Search inputs: ${searchInputs.length}`);
        console.log(`📝 Text inputs: ${textInputs.length}`);

        // Look for navigation links
        const navLinks = html.match(/<a[^>]*href=["\'][^"\']*["\'][^>]*>[\s\S]*?<\/a>/gi) || [];
        console.log(`🔗 Navigation links: ${navLinks.length}`);

        // Look for data attributes (often used by SPAs)
        const dataAttrs = html.match(/data-[a-zA-Z-]+=["\'][^"\']*["\']/gi) || [];
        console.log(`📊 Data attributes: ${dataAttrs.length}`);
    }

    findApiEndpoints(html) {
        console.log('🔍 Searching for API endpoints...');

        // Common API endpoint patterns
        const apiPatterns = [
            /["\']([^"\']*\/api\/[^"\']*)["\']/gi,
            /["\']([^"\']*\/graphql[^"\']*)["\']/gi,
            /["\']([^"\']*\/rest\/[^"\']*)["\']/gi,
            /fetch\(["\']([^"\']*)["\']/gi,
            /axios\.[get|post]+\(["\']([^"\']*)["\']/gi,
            /\$\.ajax\(["\']([^"\']*)["\']/gi
        ];

        for (const pattern of apiPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const endpoint = match[1];
                if (endpoint && (endpoint.includes('api') || endpoint.includes('graphql'))) {
                    this.findings.apiEndpoints.add(endpoint);
                }
            }
        }

        console.log(`🎯 API endpoints discovered: ${this.findings.apiEndpoints.size}`);
        if (this.findings.apiEndpoints.size > 0) {
            console.log('   Found endpoints:');
            Array.from(this.findings.apiEndpoints).slice(0, 5).forEach(endpoint => {
                console.log(`   - ${endpoint}`);
            });
        }
    }

    findPokemonContent(html) {
        console.log('🔍 Searching for Pokemon content...');

        const pokemonKeywords = [
            'pokemon', 'pikachu', 'charizard', 'mewtwo', 'mew',
            'base set', 'shadowless', 'first edition', '1st edition',
            'psa', 'bgs', 'cgc', 'graded', 'trading card', 'tcg'
        ];

        for (const keyword of pokemonKeywords) {
            const regex = new RegExp(keyword, 'gi');
            const matches = html.match(regex) || [];
            
            if (matches.length > 0) {
                this.findings.pokemonMentions.push({
                    keyword: keyword,
                    count: matches.length
                });
            }
        }

        console.log(`🎴 Pokemon keywords found: ${this.findings.pokemonMentions.length} types`);
        if (this.findings.pokemonMentions.length > 0) {
            console.log('   Top mentions:');
            this.findings.pokemonMentions
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .forEach(mention => {
                    console.log(`   - ${mention.keyword}: ${mention.count} times`);
                });
        }
    }

    extractUrls(html) {
        console.log('🔍 Extracting URL patterns...');

        // Extract all href attributes
        const hrefPattern = /href=["\']([^"\']*)["\']/gi;
        let match;
        
        while ((match = hrefPattern.exec(html)) !== null) {
            const url = match[1];
            
            // Filter for interesting URLs (not external, not assets)
            if (url && 
                !url.startsWith('http') && 
                !url.startsWith('mailto:') && 
                !url.startsWith('#') &&
                !url.includes('.css') &&
                !url.includes('.js') &&
                !url.includes('.png') &&
                !url.includes('.jpg')) {
                
                this.findings.urls.add(url);
            }
        }

        console.log(`🔗 Internal URLs found: ${this.findings.urls.size}`);
        
        // Look for Pokemon-related URLs
        const pokemonUrls = Array.from(this.findings.urls).filter(url => 
            url.toLowerCase().includes('pokemon') ||
            url.toLowerCase().includes('card') ||
            url.toLowerCase().includes('auction') ||
            url.toLowerCase().includes('search')
        );
        
        if (pokemonUrls.length > 0) {
            console.log('🎴 Pokemon-related URLs:');
            pokemonUrls.slice(0, 5).forEach(url => {
                console.log(`   - ${url}`);
            });
        }
    }

    extractResources(html) {
        console.log('🔍 Extracting JavaScript files...');

        // Extract JavaScript files (might contain API endpoints)
        const jsPattern = /<script[^>]*src=["\']([^"\']*\.js[^"\']*)["\'][^>]*>/gi;
        let match;
        
        while ((match = jsPattern.exec(html)) !== null) {
            const jsFile = match[1];
            if (jsFile && !jsFile.includes('google') && !jsFile.includes('facebook')) {
                this.findings.jsFiles.add(jsFile);
            }
        }

        console.log(`📜 JavaScript files: ${this.findings.jsFiles.size}`);
        
        // Show a few JS files that might contain API calls
        if (this.findings.jsFiles.size > 0) {
            console.log('   Key JS files:');
            Array.from(this.findings.jsFiles).slice(0, 3).forEach(file => {
                console.log(`   - ${file}`);
            });
        }
    }

    generateReport() {
        console.log('\n📊 STEP 3 COMPLETE - PAGE CONTENT ANALYSIS REPORT');
        console.log('================================================');

        const report = {
            step: 3,
            description: 'Page Content Analysis',
            summary: {
                total_urls: this.findings.urls.size,
                api_endpoints: this.findings.apiEndpoints.size,
                pokemon_keywords: this.findings.pokemonMentions.length,
                js_files: this.findings.jsFiles.size
            },
            discoveries: {
                internal_urls: Array.from(this.findings.urls).slice(0, 20),
                api_endpoints: Array.from(this.findings.apiEndpoints),
                pokemon_mentions: this.findings.pokemonMentions,
                javascript_files: Array.from(this.findings.jsFiles).slice(0, 10)
            },
            pokemon_analysis: {
                content_detected: this.findings.pokemonMentions.length > 0,
                top_keywords: this.findings.pokemonMentions
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5),
                pokemon_urls: Array.from(this.findings.urls).filter(url => 
                    url.toLowerCase().includes('pokemon') ||
                    url.toLowerCase().includes('card') ||
                    url.toLowerCase().includes('auction')
                )
            },
            next_steps: this.generateNextSteps()
        };

        // Save report
        const reportPath = 'step3-page-analysis-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Display summary
        console.log(`🔗 URLs Found: ${report.summary.total_urls}`);
        console.log(`🎯 API Endpoints: ${report.summary.api_endpoints}`);
        console.log(`🎴 Pokemon Content: ${report.pokemon_analysis.content_detected ? 'YES' : 'NO'}`);
        console.log(`📜 JS Files: ${report.summary.js_files}`);

        if (report.discoveries.api_endpoints.length > 0) {
            console.log('\n🎯 DISCOVERED API ENDPOINTS:');
            report.discoveries.api_endpoints.forEach(endpoint => {
                console.log(`  - ${endpoint}`);
            });
        }

        if (report.pokemon_analysis.pokemon_urls.length > 0) {
            console.log('\n🎴 POKEMON-RELATED URLS:');
            report.pokemon_analysis.pokemon_urls.forEach(url => {
                console.log(`  - ${url}`);
            });
        }

        console.log(`\n📄 Report saved: ${reportPath}`);
        console.log('➡️  Ready for Step 4: JavaScript Analysis');

        return report;
    }

    generateNextSteps() {
        const steps = [];

        if (this.findings.apiEndpoints.size > 0) {
            steps.push('Test discovered API endpoints for Pokemon data');
        }

        if (this.findings.jsFiles.size > 0) {
            steps.push('Analyze JavaScript files for hidden API calls');
        }

        const pokemonUrls = Array.from(this.findings.urls).filter(url => 
            url.toLowerCase().includes('pokemon') ||
            url.toLowerCase().includes('card') ||
            url.toLowerCase().includes('auction')
        );

        if (pokemonUrls.length > 0) {
            steps.push('Explore Pokemon-related URLs for data');
        }

        if (this.findings.pokemonMentions.length > 0) {
            steps.push('Pokemon content exists - focus on data extraction');
        } else {
            steps.push('No Pokemon content in homepage - try deeper navigation');
        }

        return steps;
    }
}

async function main() {
    const analyzer = new PageContentAnalyzer();
    await analyzer.analyzePage();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PageContentAnalyzer;
