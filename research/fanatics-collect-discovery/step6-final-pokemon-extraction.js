#!/usr/bin/env node
/**
 * 🎯 STEP 6: FINAL POKEMON EXTRACTION
 * ==================================
 * 
 * Using intelligence from Steps 1-5 to extract Pokemon data:
 * - Pokemon variables: PokemonEnglish, PokemonJapanese, PokemonOther
 * - Working APIs: /api/marketplaces/calendar, /api/nav/site-wide-message
 * - URL pattern: weeklyAuctionUrl?category=pokemonenglish-pokemonjapanese-pokemonotherlanguage
 */

const https = require('https');
const fs = require('fs');

class FinalPokemonExtractor {
    constructor() {
        this.baseUrl = 'www.fanaticscollect.com';
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
        this.pokemonCards = [];
        this.successfulExtractions = 0;
        
        // Intelligence from previous steps
        this.workingApis = [
            '/api/marketplaces/calendar',
            '/api/nav/site-wide-message'
        ];
        
        // Pokemon category patterns discovered
        this.pokemonCategories = [
            'pokemonenglish',
            'pokemonjapanese', 
            'pokemonother',
            'pokemonenglish-pokemonjapanese-pokemonotherlanguage'
        ];
        
        // URL patterns to test with Pokemon categories
        this.pokemonUrlPatterns = [
            '/weekly-auction?category={category}',
            '/vault-marketplace?category={category}', 
            '/premier-auction?category={category}',
            '/marketplace?category={category}',
            '/auctions?category={category}'
        ];
    }

    async extractFinalPokemonData() {
        console.log('🎯 STEP 6: FINAL POKEMON EXTRACTION');
        console.log('==================================');
        console.log('Using discovered intelligence to extract Pokemon card data...\n');

        // Strategy 1: Test working APIs with Pokemon parameters
        console.log('📡 STRATEGY 1: Working APIs with Pokemon Parameters');
        await this.testWorkingApisWithPokemon();

        // Strategy 2: Test Pokemon URL patterns
        console.log('\n🔗 STRATEGY 2: Pokemon URL Pattern Testing');  
        await this.testPokemonUrlPatterns();

        // Strategy 3: Advanced API discovery using calendar endpoint
        console.log('\n📅 STRATEGY 3: Calendar API Intelligence');
        await this.extractCalendarIntelligence();

        // Strategy 4: Direct Pokemon category URLs
        console.log('\n🎴 STRATEGY 4: Direct Pokemon Category Access');
        await this.testDirectPokemonCategories();

        return this.generateFinalReport();
    }

    async testWorkingApisWithPokemon() {
        console.log('Testing working APIs with Pokemon-specific parameters...\n');

        for (const api of this.workingApis) {
            console.log(`🔍 Testing API: ${api}`);
            
            try {
                // Test base API
                const baseResult = await this.fetchApiEndpoint(api);
                console.log(`  ✅ Base API: ${baseResult.contentLength} bytes`);
                
                if (this.containsPokemonData(baseResult.content)) {
                    console.log(`  🎴 Pokemon data found in base API!`);
                    this.extractPokemonFromContent(baseResult.content, api);
                }

                // Test API with Pokemon parameters
                const pokemonParams = [
                    '?category=pokemon',
                    '?q=pokemon',
                    '?search=pokemon',
                    '?filter=pokemon',
                    '?type=pokemon'
                ];

                for (const param of pokemonParams) {
                    try {
                        const paramResult = await this.fetchApiEndpoint(api + param);
                        console.log(`    📊 ${param}: ${paramResult.contentLength} bytes`);
                        
                        if (this.containsPokemonData(paramResult.content)) {
                            console.log(`    🎯 Pokemon data found with ${param}!`);
                            this.extractPokemonFromContent(paramResult.content, api + param);
                        }
                        
                        await this.delay(500);
                    } catch (error) {
                        console.log(`    ❌ ${param}: ${error.message}`);
                    }
                }
                
            } catch (error) {
                console.log(`  ❌ API failed: ${error.message}`);
            }

            await this.delay(1000);
        }
    }

    async testPokemonUrlPatterns() {
        console.log('Testing discovered Pokemon URL patterns...\n');

        let urlCount = 0;
        for (const pattern of this.pokemonUrlPatterns) {
            for (const category of this.pokemonCategories) {
                urlCount++;
                const url = pattern.replace('{category}', category);
                
                console.log(`[${urlCount}] ${url}`);
                
                try {
                    const result = await this.fetchPage(url);
                    console.log(`  ✅ ${result.length} bytes loaded`);
                    
                    if (this.containsPokemonData(result)) {
                        console.log(`  🎴 Pokemon content detected!`);
                        this.extractPokemonFromContent(result, url);
                    }
                    
                } catch (error) {
                    console.log(`  ❌ ${error.message}`);
                }
                
                await this.delay(1000);
            }
        }
    }

    async extractCalendarIntelligence() {
        console.log('Analyzing calendar API for Pokemon auction schedules...\n');

        try {
            const calendarData = await this.fetchApiEndpoint('/api/marketplaces/calendar');
            console.log(`📅 Calendar data: ${calendarData.contentLength} bytes`);
            
            // Parse calendar data for Pokemon auctions
            const pokemonAuctions = this.findPokemonAuctions(calendarData.content);
            
            if (pokemonAuctions.length > 0) {
                console.log(`🎯 Found ${pokemonAuctions.length} Pokemon auction references!`);
                
                // Try to access discovered Pokemon auction URLs
                for (const auction of pokemonAuctions.slice(0, 5)) {
                    console.log(`  Testing: ${auction.url}`);
                    
                    try {
                        const auctionData = await this.fetchPage(auction.url);
                        if (this.containsPokemonData(auctionData)) {
                            console.log(`    🎴 Pokemon data found in auction!`);
                            this.extractPokemonFromContent(auctionData, auction.url);
                        }
                    } catch (error) {
                        console.log(`    ❌ ${error.message}`);
                    }
                    
                    await this.delay(1000);
                }
            } else {
                console.log('  ℹ️ No Pokemon auction references in calendar');
            }
            
        } catch (error) {
            console.log(`❌ Calendar analysis failed: ${error.message}`);
        }
    }

    async testDirectPokemonCategories() {
        console.log('Testing direct Pokemon category access methods...\n');

        // Test various Pokemon category URL formats
        const directUrls = [
            '/weekly-auction?categoryGroup=Trading+Card+Games',
            '/vault-marketplace?categoryGroup=Trading+Card+Games',
            '/weekly-auction?category=Trading+Card+Games>Pokemon',
            '/vault-marketplace?category=Trading+Card+Games>Pokemon',
            '/categories/trading-card-games/pokemon',
            '/categories/pokemon',
            '/search?categoryGroup=Trading+Card+Games&q=pokemon',
            '/api/categories/pokemon',
            '/api/search?category=pokemon',
            '/api/auctions?category=pokemon'
        ];

        let urlNum = 0;
        for (const url of directUrls) {
            urlNum++;
            console.log(`[${urlNum}/${directUrls.length}] ${url}`);
            
            try {
                const content = await this.fetchPage(url);
                console.log(`  ✅ ${content.length} bytes`);
                
                if (this.containsPokemonData(content)) {
                    console.log(`  🎴 Pokemon data detected!`);
                    this.extractPokemonFromContent(content, url);
                }
                
                // Also check for JSON data in the response
                if (this.looksLikeJson(content)) {
                    const pokemonFromJson = this.extractPokemonFromJson(content, url);
                    if (pokemonFromJson.length > 0) {
                        console.log(`  🎯 ${pokemonFromJson.length} Pokemon cards from JSON!`);
                    }
                }
                
            } catch (error) {
                console.log(`  ❌ ${error.message}`);
            }
            
            await this.delay(1500);
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
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Connection': 'keep-alive',
                    'Referer': `https://${this.baseUrl}/`
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

    async fetchApiEndpoint(endpoint) {
        const content = await this.fetchPage(endpoint);
        return {
            endpoint: endpoint,
            contentLength: content.length,
            content: content
        };
    }

    containsPokemonData(content) {
        if (!content) return false;
        
        const pokemonIndicators = [
            'pokemon', 'pokémon', 'pikachu', 'charizard', 'mewtwo',
            'base set', 'jungle', 'fossil', 'shadowless', '1st edition',
            'psa 10', 'bgs 9.5', 'cgc', 'graded pokemon'
        ];
        
        const lowerContent = content.toLowerCase();
        return pokemonIndicators.some(indicator => lowerContent.includes(indicator));
    }

    looksLikeJson(content) {
        const trimmed = content.trim();
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
               (trimmed.startsWith('[') && trimmed.endsWith(']'));
    }

    extractPokemonFromContent(content, sourceUrl) {
        let extractedCount = 0;

        try {
            // Try JSON extraction first
            if (this.looksLikeJson(content)) {
                const jsonCards = this.extractPokemonFromJson(content, sourceUrl);
                this.pokemonCards.push(...jsonCards);
                extractedCount += jsonCards.length;
            }

            // HTML extraction
            const htmlCards = this.extractPokemonFromHtml(content, sourceUrl);
            this.pokemonCards.push(...htmlCards);
            extractedCount += htmlCards.length;

            if (extractedCount > 0) {
                console.log(`    💾 Extracted ${extractedCount} Pokemon cards`);
                this.successfulExtractions++;
            }

        } catch (error) {
            console.log(`    ⚠️ Extraction error: ${error.message}`);
        }

        return extractedCount;
    }

    extractPokemonFromJson(jsonContent, sourceUrl) {
        const cards = [];
        
        try {
            const data = JSON.parse(jsonContent);
            
            // Recursively search for Pokemon cards in JSON
            const findCards = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') return;
                
                // Check if current object is a Pokemon card
                if (this.isPokemonCard(obj)) {
                    const card = this.createCardFromJson(obj, sourceUrl, path);
                    if (card) cards.push(card);
                }
                
                // Search nested objects and arrays
                for (const key in obj) {
                    const value = obj[key];
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            findCards(item, `${path}.${key}[${index}]`);
                        });
                    } else if (value && typeof value === 'object') {
                        findCards(value, `${path}.${key}`);
                    }
                }
            };
            
            findCards(data);
            
        } catch (error) {
            // Not valid JSON or parsing error
        }
        
        return cards;
    }

    extractPokemonFromHtml(html, sourceUrl) {
        const cards = [];
        
        try {
            // Look for Pokemon card patterns in HTML
            const cardPatterns = [
                /<div[^>]*class="[^"]*card[^"]*"[^>]*>[\s\S]*?pokemon[\s\S]*?<\/div>/gi,
                /<article[^>]*>[\s\S]*?pokemon[\s\S]*?\$[\d,]+[\s\S]*?<\/article>/gi,
                /<li[^>]*>[\s\S]*?pokemon[\s\S]*?\$[\d,]+[\s\S]*?<\/li>/gi
            ];

            for (const pattern of cardPatterns) {
                const matches = html.match(pattern) || [];
                
                for (const match of matches) {
                    const card = this.createCardFromHtml(match, sourceUrl);
                    if (card) cards.push(card);
                }
            }

        } catch (error) {
            console.log(`HTML extraction error: ${error.message}`);
        }
        
        return cards;
    }

    isPokemonCard(obj) {
        if (!obj || typeof obj !== 'object') return false;
        
        const objStr = JSON.stringify(obj).toLowerCase();
        const hasPokemon = objStr.includes('pokemon') || objStr.includes('pokémon');
        const hasCardProps = obj.name || obj.title || obj.price || obj.id || obj.cardName;
        
        return hasPokemon && hasCardProps;
    }

    createCardFromJson(obj, sourceUrl, path) {
        try {
            return {
                id: obj.id || `json_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name: obj.name || obj.title || obj.cardName || 'Pokemon Card',
                price: this.parsePrice(obj.price || obj.currentPrice || obj.cost || 0),
                grade: obj.grade || obj.gradeValue || obj.grading || '',
                grader: obj.grader || obj.gradingCompany || '',
                set: obj.set || obj.series || obj.setName || '',
                image: obj.image || obj.imageUrl || obj.thumbnail || '',
                category: 'Pokemon',
                sourceUrl: sourceUrl,
                extractionMethod: 'json',
                jsonPath: path,
                rawData: JSON.stringify(obj).substring(0, 500)
            };
        } catch (error) {
            return null;
        }
    }

    createCardFromHtml(htmlSnippet, sourceUrl) {
        try {
            // Must contain Pokemon reference
            if (!htmlSnippet.toLowerCase().includes('pokemon')) return null;

            return {
                id: `html_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name: this.extractTextByPattern(htmlSnippet, /<h[1-6][^>]*>([^<]*pokemon[^<]*)<\/h[1-6]>/i) || 'Pokemon Card',
                price: this.extractPrice(htmlSnippet),
                grade: this.extractGrade(htmlSnippet),
                image: this.extractTextByPattern(htmlSnippet, /<img[^>]*src=["']([^"']*)[^>]*>/i),
                description: htmlSnippet.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200),
                category: 'Pokemon',
                sourceUrl: sourceUrl,
                extractionMethod: 'html',
                rawHtml: htmlSnippet.substring(0, 300)
            };
        } catch (error) {
            return null;
        }
    }

    findPokemonAuctions(calendarContent) {
        const auctions = [];
        
        try {
            // Look for Pokemon auction references in calendar data
            const pokemonMatches = calendarContent.match(/pokemon[^"'}]*["'}]/gi) || [];
            const urlMatches = calendarContent.match(/\/[^"'}\s]*pokemon[^"'}\s]*/gi) || [];
            
            for (const match of [...pokemonMatches, ...urlMatches]) {
                if (match.includes('/') && (match.includes('auction') || match.includes('marketplace'))) {
                    auctions.push({
                        url: match.replace(/['"}\]]/g, ''),
                        type: 'calendar_reference'
                    });
                }
            }
            
        } catch (error) {
            console.log(`Calendar parsing error: ${error.message}`);
        }
        
        return auctions;
    }

    extractTextByPattern(text, pattern) {
        const match = pattern.exec(text);
        return match ? match[1].trim() : '';
    }

    extractPrice(html) {
        const pricePatterns = [
            /\$([0-9,]+\.?[0-9]*)/,
            /price[^>]*>[\s]*\$?([0-9,]+\.?[0-9]*)/i,
            /cost[^>]*>[\s]*\$?([0-9,]+\.?[0-9]*)/i
        ];

        for (const pattern of pricePatterns) {
            const match = pattern.exec(html);
            if (match) {
                return this.parsePrice(match[1]);
            }
        }

        return 0;
    }

    extractGrade(html) {
        const gradeMatch = html.match(/(PSA|BGS|CGC)\s*(\d+\.?\d*)/i);
        return gradeMatch ? `${gradeMatch[1]} ${gradeMatch[2]}` : '';
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        
        const cleanPrice = priceStr.toString().replace(/[$,]/g, '');
        const price = parseFloat(cleanPrice);
        
        return isNaN(price) ? 0 : Math.round(price * 100) / 100;
    }

    generateFinalReport() {
        console.log('\n📊 STEP 6 COMPLETE - FINAL POKEMON EXTRACTION REPORT');
        console.log('==================================================');

        // Remove duplicate cards
        const uniqueCards = this.removeDuplicates(this.pokemonCards);
        
        const report = {
            step: 6,
            description: 'Final Pokemon Data Extraction',
            extraction_summary: {
                total_pokemon_cards: uniqueCards.length,
                successful_extractions: this.successfulExtractions,
                extraction_methods: this.analyzeExtractionMethods(uniqueCards)
            },
            pokemon_cards: uniqueCards,
            price_analysis: this.analyzePrices(uniqueCards),
            top_cards: this.getTopCards(uniqueCards),
            integration_status: {
                fanatics_extraction_complete: uniqueCards.length > 0,
                ready_for_pokedao_integration: true,
                database_file: 'fanatics-pokemon-final-extraction.db',
                next_steps: this.generateNextSteps(uniqueCards.length)
            }
        };

        // Save comprehensive report
        const reportPath = 'step6-final-pokemon-extraction-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Save Pokemon cards separately
        if (uniqueCards.length > 0) {
            const cardsPath = 'fanatics-pokemon-cards-final.json';
            fs.writeFileSync(cardsPath, JSON.stringify(uniqueCards, null, 2));
            
            // Create CSV for easy analysis
            this.createCsvReport(uniqueCards);
        }

        // Display results
        console.log(`🎴 Pokemon Cards Extracted: ${uniqueCards.length}`);
        console.log(`✅ Successful Extractions: ${this.successfulExtractions}`);
        
        if (uniqueCards.length > 0) {
            const avgPrice = report.price_analysis.average_price || 0;
            const maxPrice = report.price_analysis.max_price || 0;
            
            console.log(`💰 Average Price: $${avgPrice}`);
            console.log(`💎 Highest Price: $${maxPrice}`);
            
            console.log('\n🏆 TOP POKEMON CARDS:');
            report.top_cards.slice(0, 5).forEach((card, index) => {
                console.log(`  ${index + 1}. ${card.name} - $${card.price} ${card.grade}`);
            });
            
            console.log(`\n📄 Report: ${reportPath}`);
            console.log(`🎴 Cards: fanatics-pokemon-cards-final.json`);
            console.log(`📊 CSV: fanatics-pokemon-cards.csv`);
            console.log('\n🚀 SUCCESS! Ready for PokeDAO integration!');
            
        } else {
            console.log('\n⚠️ No Pokemon cards extracted from Fanatics Collect');
            console.log('   Recommendation: Use existing 694K+ card database');
            console.log('   Alternative: Focus on other auction sources (Heritage, PWCC)');
        }

        return report;
    }

    removeDuplicates(cards) {
        const seen = new Set();
        return cards.filter(card => {
            const key = `${card.name}_${card.price}_${card.grade}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    analyzeExtractionMethods(cards) {
        const methods = {};
        cards.forEach(card => {
            const method = card.extractionMethod || 'unknown';
            methods[method] = (methods[method] || 0) + 1;
        });
        return methods;
    }

    analyzePrices(cards) {
        const withPrices = cards.filter(card => card.price > 0);
        
        if (withPrices.length === 0) {
            return { message: 'No price data available' };
        }

        const prices = withPrices.map(card => card.price);
        return {
            cards_with_prices: withPrices.length,
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            average_price: Math.round((prices.reduce((sum, p) => sum + p, 0) / prices.length) * 100) / 100
        };
    }

    getTopCards(cards) {
        return cards
            .filter(card => card.price > 0)
            .sort((a, b) => b.price - a.price)
            .slice(0, 10);
    }

    createCsvReport(cards) {
        const headers = ['Name', 'Price', 'Grade', 'Grader', 'Set', 'Category', 'Source', 'Method'];
        const rows = cards.map(card => [
            card.name || '',
            card.price || 0,
            card.grade || '',
            card.grader || '',
            card.set || '',
            card.category || '',
            card.sourceUrl || '',
            card.extractionMethod || ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        fs.writeFileSync('fanatics-pokemon-cards.csv', csvContent);
    }

    generateNextSteps(cardCount) {
        if (cardCount > 0) {
            return [
                'SUCCESS: Fanatics Collect Pokemon data extracted!',
                'Integrate with existing PokeDAO database (694K+ cards)',
                'Cross-reference pricing with other platforms',
                'Identify arbitrage opportunities',
                'Deploy comprehensive market analysis',
                'Scale extraction for more cards'
            ];
        } else {
            return [
                'Fanatics Collect requires advanced browser automation',
                'Focus on existing successful data sources',
                'Explore alternative auction houses (Heritage, PWCC)',
                'Enhance current 694K+ card intelligence',
                'Deploy arbitrage detection with existing data'
            ];
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    const extractor = new FinalPokemonExtractor();
    await extractor.extractFinalPokemonData();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FinalPokemonExtractor;
