#!/usr/bin/env node
/**
 * 🔍 STEP 4: POKEMON URL TESTING
 * =============================
 * 
 * Test the discovered Pokemon URLs to extract actual card data
 * Focus on the working patterns we found in Step 3
 */

const https = require('https');
const fs = require('fs');

class PokemonUrlTester {
    constructor() {
        this.baseUrl = 'www.fanaticscollect.com';
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
        this.pokemonCards = [];
        this.testedUrls = [];
        
        // Pokemon URLs discovered in Step 3
        this.pokemonUrls = [
            '/vault-marketplace?type=FIXED&category=Trading+Card+Games+>+Pokémon+(English),Trading+Card+Games+>+Pokémon+(Japanese),Trading+Card+Games+>+Pokémon+(Other+Languages)&page=1&greatPrice=true&sortBy=prod_item_state_v1',
            '/weekly-auction?category=Trading+Card+Games+>+Pokémon+(English),Trading+Card+Games+>+Pokémon+(Japanese),Trading+Card+Games+>+Pokémon+(Other+Languages)&type=WEEKLY',
            '/vault-marketplace?category=Trading+Card+Games+>+Pokémon+(English)&type=FIXED&page=1',
            '/vault-marketplace?category=Trading+Card+Games+>+Pokémon+(Japanese)&type=FIXED&page=1',
            '/weekly-auction?category=Trading+Card+Games+>+Pokémon+(English)&type=WEEKLY&page=1',
            '/weekly-auction?category=Trading+Card+Games+>+Pokémon+(Japanese)&type=WEEKLY&page=1'
        ];

        // Also test some manual Pokemon searches
        this.searchUrls = [
            '/vault-marketplace?q=pokemon&type=FIXED&page=1',
            '/vault-marketplace?q=pikachu&type=FIXED&page=1', 
            '/vault-marketplace?q=charizard&type=FIXED&page=1',
            '/weekly-auction?q=pokemon&type=WEEKLY&page=1',
            '/weekly-auction?q=base+set&type=WEEKLY&page=1'
        ];
    }

    async testPokemonUrls() {
        console.log('🔍 STEP 4: POKEMON URL TESTING');
        console.log('=============================');
        console.log('Testing discovered Pokemon URLs for card data extraction...\n');

        const allUrls = [...this.pokemonUrls, ...this.searchUrls];
        let urlCount = 0;

        console.log('🎯 TESTING POKEMON CATEGORY URLS:');
        for (const url of this.pokemonUrls) {
            urlCount++;
            console.log(`\n[${urlCount}/${allUrls.length}] ${url.substring(0, 80)}...`);
            
            try {
                const result = await this.testUrl(url, 'category');
                this.testedUrls.push(result);
                
                if (result.pokemonCards > 0) {
                    console.log(`  ✅ SUCCESS: ${result.pokemonCards} Pokemon cards found!`);
                } else if (result.statusCode === 200) {
                    console.log(`  📄 Page loaded but no Pokemon cards detected`);
                } else {
                    console.log(`  ❌ Failed: HTTP ${result.statusCode}`);
                }
                
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
            
            await this.delay(2000); // Rate limiting
        }

        console.log('\n🔍 TESTING POKEMON SEARCH URLS:');
        for (const url of this.searchUrls) {
            urlCount++;
            console.log(`\n[${urlCount}/${allUrls.length}] ${url.substring(0, 80)}...`);
            
            try {
                const result = await this.testUrl(url, 'search');
                this.testedUrls.push(result);
                
                if (result.pokemonCards > 0) {
                    console.log(`  ✅ SUCCESS: ${result.pokemonCards} Pokemon cards found!`);
                } else if (result.statusCode === 200) {
                    console.log(`  📄 Page loaded but no Pokemon cards detected`);
                } else {
                    console.log(`  ❌ Failed: HTTP ${result.statusCode}`);
                }
                
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
            
            await this.delay(2000); // Rate limiting
        }

        return this.generateReport();
    }

    async testUrl(url, type) {
        const content = await this.fetchPage(url);
        const pokemonCards = this.extractPokemonCards(content, url);
        
        return {
            url: url,
            type: type,
            statusCode: 200,
            contentLength: content.length,
            pokemonCards: pokemonCards.length,
            cards: pokemonCards,
            timestamp: new Date().toISOString()
        };
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
                    'Connection': 'keep-alive',
                    'Referer': 'https://www.fanaticscollect.com/'
                },
                timeout: 20000
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

    extractPokemonCards(html, sourceUrl) {
        const cards = [];
        
        try {
            // Look for card data patterns in HTML
            const cardPatterns = [
                // Pattern 1: Card containers with Pokemon data
                /<div[^>]*class="[^"]*card[^"]*"[^>]*>[\s\S]*?pokemon[\s\S]*?<\/div>/gi,
                
                // Pattern 2: Product items with Pokemon in text
                /<div[^>]*class="[^"]*item[^"]*"[^>]*>[\s\S]*?pokemon[\s\S]*?<\/div>/gi,
                
                // Pattern 3: Article elements with Pokemon content
                /<article[^>]*>[\s\S]*?pokemon[\s\S]*?<\/article>/gi,
                
                // Pattern 4: Any div with Pokemon text and price indicators
                /<div[^>]*>[\s\S]*?pokemon[\s\S]*?\$[\d,]+[\s\S]*?<\/div>/gi
            ];

            for (const pattern of cardPatterns) {
                const matches = html.match(pattern) || [];
                
                for (const match of matches) {
                    const card = this.parseCardFromHtml(match, sourceUrl);
                    if (card) {
                        cards.push(card);
                    }
                }
            }

            // Also look for JSON data embedded in the page
            const jsonCards = this.extractJsonCards(html, sourceUrl);
            cards.push(...jsonCards);

            // Remove duplicates based on card ID or name
            const uniqueCards = this.removeDuplicateCards(cards);
            
            return uniqueCards;
            
        } catch (error) {
            console.log(`  ⚠️ Card extraction error: ${error.message}`);
            return [];
        }
    }

    parseCardFromHtml(htmlSnippet, sourceUrl) {
        try {
            const lowerHtml = htmlSnippet.toLowerCase();
            
            // Must contain Pokemon reference
            if (!lowerHtml.includes('pokemon') && !lowerHtml.includes('pokémon')) {
                return null;
            }

            // Extract card information
            const card = {
                id: this.generateCardId(),
                name: this.extractCardName(htmlSnippet),
                price: this.extractPrice(htmlSnippet),
                image: this.extractImage(htmlSnippet),
                description: this.extractDescription(htmlSnippet),
                grade: this.extractGrade(htmlSnippet),
                set: this.extractSet(htmlSnippet),
                sourceUrl: sourceUrl,
                extractionMethod: 'html_parsing',
                rawHtml: htmlSnippet.substring(0, 500)
            };

            // Only return if we have meaningful data
            if (card.name && (card.price > 0 || card.description.length > 10)) {
                return card;
            }

        } catch (error) {
            console.log(`  ⚠️ HTML parsing error: ${error.message}`);
        }

        return null;
    }

    extractJsonCards(html, sourceUrl) {
        const cards = [];
        
        try {
            // Look for JSON data in script tags or data attributes
            const jsonPatterns = [
                /<script[^>]*>[\s\S]*?({[\s\S]*?pokemon[\s\S]*?})[\s\S]*?<\/script>/gi,
                /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/gi,
                /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?});/gi
            ];

            for (const pattern of jsonPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    try {
                        const jsonStr = match[1];
                        const data = JSON.parse(jsonStr);
                        
                        // Recursively look for Pokemon cards in JSON structure
                        const foundCards = this.findCardsInJson(data, sourceUrl);
                        cards.push(...foundCards);
                        
                    } catch (jsonError) {
                        // Skip malformed JSON
                    }
                }
            }
            
        } catch (error) {
            console.log(`  ⚠️ JSON extraction error: ${error.message}`);
        }

        return cards;
    }

    findCardsInJson(obj, sourceUrl, path = '') {
        const cards = [];
        
        if (!obj || typeof obj !== 'object') return cards;
        
        try {
            // Check if current object looks like a Pokemon card
            if (this.isJsonPokemonCard(obj)) {
                const card = {
                    id: obj.id || this.generateCardId(),
                    name: obj.name || obj.title || obj.cardName || 'Pokemon Card',
                    price: this.parsePrice(obj.price || obj.currentPrice || obj.cost || 0),
                    image: obj.image || obj.imageUrl || obj.thumbnail || '',
                    description: obj.description || obj.details || '',
                    grade: obj.grade || obj.gradeValue || '',
                    set: obj.set || obj.series || obj.setName || '',
                    category: obj.category || 'Pokemon',
                    sourceUrl: sourceUrl,
                    extractionMethod: 'json_parsing',
                    jsonPath: path
                };
                
                cards.push(card);
            }
            
            // Recursively search nested objects and arrays
            for (const key in obj) {
                const value = obj[key];
                const newPath = path ? `${path}.${key}` : key;
                
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        const nestedCards = this.findCardsInJson(item, sourceUrl, `${newPath}[${index}]`);
                        cards.push(...nestedCards);
                    });
                } else if (value && typeof value === 'object') {
                    const nestedCards = this.findCardsInJson(value, sourceUrl, newPath);
                    cards.push(...nestedCards);
                }
            }
            
        } catch (error) {
            // Skip problematic objects
        }

        return cards;
    }

    isJsonPokemonCard(obj) {
        if (!obj || typeof obj !== 'object') return false;
        
        const objStr = JSON.stringify(obj).toLowerCase();
        
        // Must contain Pokemon reference
        if (!objStr.includes('pokemon') && !objStr.includes('pokémon')) {
            return false;
        }
        
        // Should have card-like properties
        const cardProperties = ['name', 'title', 'price', 'cost', 'image', 'grade'];
        const hasCardProps = cardProperties.some(prop => obj.hasOwnProperty(prop));
        
        return hasCardProps;
    }

    // Helper extraction methods
    extractCardName(html) {
        const namePatterns = [
            /<h[1-6][^>]*>([^<]*pokemon[^<]*)<\/h[1-6]>/gi,
            /<[^>]*title[^>]*>([^<]*pokemon[^<]*)<\/[^>]*>/gi,
            /<[^>]*name[^>]*>([^<]*pokemon[^<]*)<\/[^>]*>/gi
        ];

        for (const pattern of namePatterns) {
            const match = pattern.exec(html);
            if (match && match[1]) {
                return match[1].trim().substring(0, 100);
            }
        }

        return 'Pokemon Card';
    }

    extractPrice(html) {
        const pricePatterns = [
            /\$([0-9,]+\.?[0-9]*)/g,
            /price[^>]*>[\s]*\$?([0-9,]+\.?[0-9]*)/gi,
            /cost[^>]*>[\s]*\$?([0-9,]+\.?[0-9]*)/gi
        ];

        for (const pattern of pricePatterns) {
            const match = pattern.exec(html);
            if (match && match[1]) {
                return this.parsePrice(match[1]);
            }
        }

        return 0;
    }

    extractImage(html) {
        const imgMatch = html.match(/<img[^>]*src=["']([^"']*pokemon[^"']*|[^"']*card[^"']*)[^>]*>/i);
        return imgMatch ? imgMatch[1] : '';
    }

    extractDescription(html) {
        const textContent = html.replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200);
        return textContent;
    }

    extractGrade(html) {
        const gradePatterns = [
            /(PSA|BGS|CGC)\s*(\d+\.?\d*)/gi,
            /grade[^>]*>[\s]*(PSA|BGS|CGC)?\s*(\d+\.?\d*)/gi
        ];

        for (const pattern of gradePatterns) {
            const match = pattern.exec(html);
            if (match) {
                return `${match[1] || 'GRADED'} ${match[2] || match[1]}`.trim();
            }
        }

        return '';
    }

    extractSet(html) {
        const setPatterns = [
            /(base set|jungle|fossil|shadowless|first edition|1st edition)/gi,
            /set[^>]*>([^<]+)</gi
        ];

        for (const pattern of setPatterns) {
            const match = pattern.exec(html);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return '';
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        
        const cleanPrice = priceStr.toString()
            .replace(/[$,]/g, '')
            .trim();
            
        const price = parseFloat(cleanPrice);
        return isNaN(price) ? 0 : Math.round(price * 100) / 100;
    }

    generateCardId() {
        return `fanatics_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    removeDuplicateCards(cards) {
        const seen = new Set();
        return cards.filter(card => {
            const key = `${card.name}_${card.price}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    generateReport() {
        console.log('\n📊 STEP 4 COMPLETE - POKEMON URL TESTING REPORT');
        console.log('==============================================');

        const successfulUrls = this.testedUrls.filter(result => result.pokemonCards > 0);
        const totalCards = this.testedUrls.reduce((sum, result) => sum + result.pokemonCards, 0);
        
        // Combine all cards
        const allCards = [];
        this.testedUrls.forEach(result => {
            if (result.cards) {
                allCards.push(...result.cards);
            }
        });

        const report = {
            step: 4,
            description: 'Pokemon URL Testing',
            summary: {
                urls_tested: this.testedUrls.length,
                successful_urls: successfulUrls.length,
                total_pokemon_cards: totalCards,
                success_rate: `${Math.round((successfulUrls.length / this.testedUrls.length) * 100)}%`
            },
            successful_urls: successfulUrls.map(result => ({
                url: result.url,
                type: result.type,
                pokemon_cards: result.pokemonCards
            })),
            pokemon_cards: allCards,
            price_analysis: this.analyzePrices(allCards),
            extraction_methods: this.analyzeExtractionMethods(allCards),
            next_steps: this.generateNextSteps(successfulUrls, totalCards)
        };

        // Save detailed report
        const reportPath = 'step4-pokemon-url-testing-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Save just the Pokemon cards
        if (allCards.length > 0) {
            const cardsPath = 'fanatics-pokemon-cards-extracted.json';
            fs.writeFileSync(cardsPath, JSON.stringify(allCards, null, 2));
            console.log(`🎴 Pokemon cards saved: ${cardsPath}`);
        }

        // Display summary
        console.log(`🔗 URLs Tested: ${this.testedUrls.length}`);
        console.log(`✅ Successful URLs: ${successfulUrls.length}`);
        console.log(`🎴 Pokemon Cards Found: ${totalCards}`);
        console.log(`📈 Success Rate: ${report.summary.success_rate}`);

        if (successfulUrls.length > 0) {
            console.log('\n🏆 SUCCESSFUL URLS:');
            successfulUrls.forEach(result => {
                console.log(`  ✅ ${result.pokemonCards} cards from: ${result.url.substring(0, 60)}...`);
            });
        }

        if (totalCards > 0) {
            console.log(`\n🎯 EXTRACTION SUCCESS! Found ${totalCards} Pokemon cards from Fanatics Collect!`);
            console.log(`📄 Report: ${reportPath}`);
        } else {
            console.log('\n⚠️ No Pokemon cards extracted - may need different approach');
        }

        console.log('➡️  Ready for Step 5: Data Enhancement (if cards found)');

        return report;
    }

    analyzePrices(cards) {
        const withPrices = cards.filter(card => card.price > 0);
        
        if (withPrices.length === 0) {
            return { message: 'No price data available' };
        }

        const prices = withPrices.map(card => card.price);
        return {
            total_cards_with_prices: withPrices.length,
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            avg_price: Math.round((prices.reduce((sum, price) => sum + price, 0) / prices.length) * 100) / 100
        };
    }

    analyzeExtractionMethods(cards) {
        const methods = {};
        cards.forEach(card => {
            const method = card.extractionMethod || 'unknown';
            methods[method] = (methods[method] || 0) + 1;
        });
        return methods;
    }

    generateNextSteps(successfulUrls, totalCards) {
        const steps = [];

        if (totalCards > 0) {
            steps.push('SUCCESS: Pokemon cards extracted from Fanatics Collect!');
            steps.push('Enhance extracted data with additional details');
            steps.push('Integrate with existing PokeDAO database');
            steps.push('Identify arbitrage opportunities');
        } else {
            steps.push('Try alternative extraction methods');
            steps.push('Analyze JavaScript files for API endpoints');
            steps.push('Consider browser automation for dynamic content');
        }

        if (successfulUrls.length > 0) {
            steps.push('Scale up extraction from working URLs');
            steps.push('Test pagination for more cards');
        }

        return steps;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    const tester = new PokemonUrlTester();
    await tester.testPokemonUrls();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PokemonUrlTester;
