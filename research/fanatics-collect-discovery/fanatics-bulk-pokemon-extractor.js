#!/usr/bin/env node

/**
 * 🚀 FANATICS POKEMON BULK DATA EXTRACTOR
 * =======================================
 * Extract ALL Pokemon card data including:
 * - Active marketplace listings
 * - Buy now cards  
 * - Auction data
 * - Past auction results
 * - Card details and pricing
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class FanaticsPokemonBulkExtractor {
    constructor() {
        this.baseUrl = 'www.fanaticscollect.com';
        this.allPokemonData = [];
        this.extractedCards = new Set(); // Prevent duplicates
        this.totalExtracted = 0;
        
        // Mobile headers for better access
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        // Working Pokemon marketplace URLs (discovered in testing)
        this.pokemonUrls = [
            '/marketplace?category=pokemonenglish',
            '/marketplace?category=pokemonjapanese', 
            '/marketplace?category=pokemonother',
            '/marketplace?category=pokemonenglish-pokemonjapanese-pokemonotherlanguage'
        ];
        
        // Pagination and search parameters to try
        this.extractionParams = [
            '',
            '&page=1',
            '&page=2',
            '&page=3',
            '&page=4',
            '&page=5',
            '&limit=100',
            '&sort=price_asc',
            '&sort=price_desc',
            '&sort=newest',
            '&sort=ending_soon',
            '&format=json',
            '&view=list',
            '&type=auction',
            '&type=buy_now',
            '&status=active',
            '&status=ended'
        ];
    }

    async extractAllPokemonData() {
        console.log('🚀 FANATICS POKEMON BULK DATA EXTRACTION');
        console.log('========================================');
        console.log(`📊 Extracting from ${this.pokemonUrls.length} Pokemon marketplace sections`);
        console.log(`🔄 Testing ${this.extractionParams.length} parameter combinations per URL`);
        console.log(`📈 Total extraction attempts: ${this.pokemonUrls.length * this.extractionParams.length}`);
        
        let extractionCount = 0;
        const totalExtractions = this.pokemonUrls.length * this.extractionParams.length;
        
        // Extract from each Pokemon URL with all parameter combinations
        for (const baseUrl of this.pokemonUrls) {
            console.log(`\n🎯 EXTRACTING FROM: ${baseUrl}`);
            console.log('='.repeat(50));
            
            for (const params of this.extractionParams) {
                extractionCount++;
                const fullUrl = baseUrl + params;
                
                console.log(`[${extractionCount}/${totalExtractions}] ${fullUrl.substring(0, 80)}${fullUrl.length > 80 ? '...' : ''}`);
                
                try {
                    const data = await this.extractFromUrl(fullUrl);
                    if (data.pokemonCards && data.pokemonCards.length > 0) {
                        console.log(`   ✅ Found ${data.pokemonCards.length} Pokemon cards`);
                        this.processPokemonData(data.pokemonCards, fullUrl);
                    } else if (data.totalBytes > 50000) {
                        console.log(`   📄 Large page (${data.totalBytes} bytes) - analyzing...`);
                        await this.deepAnalyzePage(data.content, fullUrl);
                    } else {
                        console.log(`   📝 Small page (${data.totalBytes} bytes)`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error: ${error.message}`);
                }
                
                // Rate limiting
                await this.delay(1000);
            }
        }
        
        // Extract from search endpoints
        await this.extractFromSearchEndpoints();
        
        // Extract from API endpoints
        await this.extractFromApiEndpoints();
        
        return this.generateReport();
    }

    async extractFromUrl(urlPath) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: urlPath,
                method: 'GET',
                headers: this.headers,
                timeout: 15000
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk.toString();
                });
                
                res.on('end', () => {
                    const pokemonCards = this.extractPokemonCards(data);
                    resolve({
                        statusCode: res.statusCode,
                        content: data,
                        totalBytes: data.length,
                        pokemonCards: pokemonCards
                    });
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

    extractPokemonCards(htmlContent) {
        const cards = [];
        
        try {
            // Method 1: Look for card data in JSON
            const jsonMatches = htmlContent.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s) ||
                               htmlContent.match(/window\.CARDS_DATA\s*=\s*({.*?});/s) ||
                               htmlContent.match(/"cards":\s*(\[.*?\])/s);
            
            if (jsonMatches) {
                try {
                    const jsonData = JSON.parse(jsonMatches[1]);
                    if (Array.isArray(jsonData)) {
                        cards.push(...this.processJsonCards(jsonData));
                    } else if (jsonData.cards && Array.isArray(jsonData.cards)) {
                        cards.push(...this.processJsonCards(jsonData.cards));
                    }
                } catch (e) {
                    // JSON parse failed, continue with other methods
                }
            }
            
            // Method 2: Extract from HTML structure
            const htmlCards = this.extractCardsFromHtml(htmlContent);
            cards.push(...htmlCards);
            
            // Method 3: Look for Pokemon-specific patterns
            const pokemonPatterns = [
                /pokemon.*?card/gi,
                /charizard|pikachu|mewtwo|mew|rayquaza/gi,
                /base set|jungle|fossil|team rocket/gi,
                /shadowless|first edition|1st edition/gi
            ];
            
            for (const pattern of pokemonPatterns) {
                const matches = htmlContent.match(pattern);
                if (matches && matches.length > 0) {
                    // Found Pokemon references, extract surrounding context
                    const contextCards = this.extractPokemonContext(htmlContent, matches);
                    cards.push(...contextCards);
                }
            }
            
        } catch (error) {
            console.log(`      ⚠️ Card extraction error: ${error.message}`);
        }
        
        return cards;
    }

    processJsonCards(cardsArray) {
        const processedCards = [];
        
        for (const card of cardsArray) {
            if (this.isPokemonCard(card)) {
                const processedCard = {
                    id: card.id || card.cardId || card.itemId,
                    name: card.name || card.title || card.cardName,
                    set: card.set || card.series,
                    price: card.price || card.currentBid || card.buyNowPrice,
                    condition: card.condition || card.grade,
                    seller: card.seller || card.sellerName,
                    endTime: card.endTime || card.auctionEnd,
                    type: card.auctionType || card.listingType || 'marketplace',
                    image: card.image || card.imageUrl || card.thumbnail,
                    url: card.url || card.link,
                    extractedAt: new Date().toISOString(),
                    source: 'fanatics_collect'
                };
                
                if (processedCard.id && !this.extractedCards.has(processedCard.id)) {
                    processedCards.push(processedCard);
                    this.extractedCards.add(processedCard.id);
                }
            }
        }
        
        return processedCards;
    }

    extractCardsFromHtml(htmlContent) {
        const cards = [];
        
        // Look for common card listing patterns
        const cardPatterns = [
            /<div[^>]*class="[^"]*card[^"]*"[^>]*>(.*?)<\/div>/gis,
            /<div[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)<\/div>/gis,
            /<div[^>]*class="[^"]*listing[^"]*"[^>]*>(.*?)<\/div>/gis,
            /<article[^>]*class="[^"]*card[^"]*"[^>]*>(.*?)<\/article>/gis
        ];
        
        for (const pattern of cardPatterns) {
            let match;
            while ((match = pattern.exec(htmlContent)) !== null) {
                const cardHtml = match[1];
                if (cardHtml.toLowerCase().includes('pokemon')) {
                    const card = this.parseCardFromHtml(cardHtml);
                    if (card) {
                        cards.push(card);
                    }
                }
            }
        }
        
        return cards;
    }

    parseCardFromHtml(cardHtml) {
        try {
            const card = {
                id: this.extractFromHtml(cardHtml, /data-id="([^"]+)"|id="([^"]+)"/),
                name: this.extractFromHtml(cardHtml, /<h[1-6][^>]*>([^<]+)</),
                price: this.extractFromHtml(cardHtml, /\$[\d,]+\.?\d*/),
                condition: this.extractFromHtml(cardHtml, /condition[^>]*>([^<]+)/i),
                extractedAt: new Date().toISOString(),
                source: 'fanatics_collect_html'
            };
            
            if (card.name || card.price) {
                return card;
            }
        } catch (error) {
            // Skip malformed cards
        }
        
        return null;
    }

    extractFromHtml(html, regex) {
        const match = html.match(regex);
        return match ? (match[1] || match[2] || match[0]).trim() : null;
    }

    extractPokemonContext(htmlContent, matches) {
        // Extract structured data around Pokemon mentions
        const contextCards = [];
        // Implementation for context extraction
        return contextCards;
    }

    isPokemonCard(card) {
        const pokemonKeywords = ['pokemon', 'pikachu', 'charizard', 'mewtwo', 'base set', 'jungle', 'fossil'];
        const cardString = JSON.stringify(card).toLowerCase();
        
        return pokemonKeywords.some(keyword => cardString.includes(keyword));
    }

    processPokemonData(cards, sourceUrl) {
        for (const card of cards) {
            card.sourceUrl = sourceUrl;
            card.extractedAt = new Date().toISOString();
            this.allPokemonData.push(card);
            this.totalExtracted++;
        }
    }

    async extractFromSearchEndpoints() {
        console.log('\n🔍 EXTRACTING FROM SEARCH ENDPOINTS');
        console.log('===================================');
        
        const searchUrls = [
            '/search?q=pokemon',
            '/search?category=trading-cards&q=pokemon',
            '/search?q=pikachu',
            '/search?q=charizard',
            '/search?q=base+set',
            '/api/search?q=pokemon',
            '/api/search?category=pokemon'
        ];
        
        for (let i = 0; i < searchUrls.length; i++) {
            const searchUrl = searchUrls[i];
            console.log(`[${i + 1}/${searchUrls.length}] ${searchUrl}`);
            
            try {
                const data = await this.extractFromUrl(searchUrl);
                if (data.pokemonCards && data.pokemonCards.length > 0) {
                    console.log(`   ✅ Found ${data.pokemonCards.length} cards`);
                    this.processPokemonData(data.pokemonCards, searchUrl);
                } else {
                    console.log(`   📝 No cards found (${data.totalBytes} bytes)`);
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            await this.delay(1000);
        }
    }

    async extractFromApiEndpoints() {
        console.log('\n🔗 EXTRACTING FROM API ENDPOINTS');
        console.log('================================');
        
        const apiUrls = [
            '/api/marketplaces/calendar',
            '/api/nav/site-wide-message',
            '/api/categories',
            '/api/auctions/active',
            '/api/auctions/ended',
            '/api/marketplace/items'
        ];
        
        for (let i = 0; i < apiUrls.length; i++) {
            const apiUrl = apiUrls[i];
            console.log(`[${i + 1}/${apiUrls.length}] ${apiUrl}`);
            
            try {
                const data = await this.extractFromUrl(apiUrl);
                if (data.statusCode === 200) {
                    console.log(`   ✅ API accessible (${data.totalBytes} bytes)`);
                    // Try to parse as JSON
                    try {
                        const jsonData = JSON.parse(data.content);
                        const cards = this.processApiResponse(jsonData);
                        if (cards.length > 0) {
                            console.log(`   🎴 Extracted ${cards.length} cards from API`);
                            this.processPokemonData(cards, apiUrl);
                        }
                    } catch (e) {
                        // Not JSON, analyze as HTML
                        const cards = this.extractPokemonCards(data.content);
                        if (cards.length > 0) {
                            this.processPokemonData(cards, apiUrl);
                        }
                    }
                } else {
                    console.log(`   ❌ HTTP ${data.statusCode}`);
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            await this.delay(1000);
        }
    }

    processApiResponse(jsonData) {
        const cards = [];
        
        // Try to find card arrays in various JSON structures
        if (Array.isArray(jsonData)) {
            cards.push(...this.processJsonCards(jsonData));
        } else if (jsonData.items && Array.isArray(jsonData.items)) {
            cards.push(...this.processJsonCards(jsonData.items));
        } else if (jsonData.cards && Array.isArray(jsonData.cards)) {
            cards.push(...this.processJsonCards(jsonData.cards));
        } else if (jsonData.data && Array.isArray(jsonData.data)) {
            cards.push(...this.processJsonCards(jsonData.data));
        } else if (jsonData.results && Array.isArray(jsonData.results)) {
            cards.push(...this.processJsonCards(jsonData.results));
        }
        
        return cards;
    }

    async deepAnalyzePage(content, url) {
        // Deep analysis for large pages that might contain hidden Pokemon data
        const pokemonMentions = (content.match(/pokemon/gi) || []).length;
        const cardMentions = (content.match(/card/gi) || []).length;
        const priceMentions = (content.match(/\$[\d,]+/g) || []).length;
        
        if (pokemonMentions > 5 || cardMentions > 10 || priceMentions > 10) {
            console.log(`      🔍 Deep analysis: ${pokemonMentions} pokemon, ${cardMentions} cards, ${priceMentions} prices`);
            
            // Try to extract structured data
            const cards = this.extractPokemonCards(content);
            if (cards.length > 0) {
                console.log(`      ✅ Deep extraction: ${cards.length} cards found`);
                this.processPokemonData(cards, url);
            }
        }
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            extraction_summary: {
                total_pokemon_cards: this.totalExtracted,
                unique_cards: this.allPokemonData.length,
                duplicate_cards_filtered: this.totalExtracted - this.allPokemonData.length,
                sources_accessed: this.pokemonUrls.length
            },
            cards_by_type: this.categorizeCards(),
            sample_cards: this.allPokemonData.slice(0, 10),
            all_pokemon_cards: this.allPokemonData
        };
        
        // Save comprehensive data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = `fanatics-pokemon-extraction-${timestamp}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        // Save CSV for analysis
        if (this.allPokemonData.length > 0) {
            this.saveCsvReport(report, timestamp);
        }
        
        console.log('\n📊 BULK EXTRACTION COMPLETE');
        console.log('===========================');
        console.log(`🎴 Total Pokemon Cards: ${this.totalExtracted}`);
        console.log(`📋 Unique Cards: ${this.allPokemonData.length}`);
        console.log(`🔄 Duplicates Filtered: ${this.totalExtracted - this.allPokemonData.length}`);
        console.log(`💾 Report: ${reportFile}`);
        
        if (this.allPokemonData.length > 0) {
            console.log('\n🎯 SAMPLE EXTRACTED CARDS:');
            this.allPokemonData.slice(0, 5).forEach((card, i) => {
                console.log(`${i + 1}. ${card.name || 'Unknown'} - $${card.price || 'N/A'} (${card.condition || 'Unknown condition'})`);
            });
            
            console.log(`\n✅ SUCCESS: Extracted ${this.allPokemonData.length} Pokemon cards from Fanatics Collect!`);
        } else {
            console.log('\n⚠️ No Pokemon cards extracted - Fanatics may require authentication');
            console.log('💡 Recommendation: Use existing 694K+ card database for comprehensive coverage');
        }
        
        return report;
    }

    categorizeCards() {
        const categories = {
            auctions: 0,
            buy_now: 0,
            graded: 0,
            raw: 0,
            vintage: 0,
            modern: 0
        };
        
        for (const card of this.allPokemonData) {
            if (card.type && card.type.includes('auction')) categories.auctions++;
            if (card.type && card.type.includes('buy')) categories.buy_now++;
            if (card.condition && card.condition.includes('PSA')) categories.graded++;
            if (card.set && ['base', 'jungle', 'fossil'].some(s => card.set.toLowerCase().includes(s))) {
                categories.vintage++;
            } else {
                categories.modern++;
            }
        }
        
        return categories;
    }

    saveCsvReport(report, timestamp) {
        const csvFile = `fanatics-pokemon-cards-${timestamp}.csv`;
        const csvHeader = 'ID,Name,Set,Price,Condition,Type,Seller,Source URL,Extracted At\n';
        const csvRows = this.allPokemonData.map(card => 
            `"${card.id || ''}","${card.name || ''}","${card.set || ''}","${card.price || ''}","${card.condition || ''}","${card.type || ''}","${card.seller || ''}","${card.sourceUrl || ''}","${card.extractedAt || ''}"`
        ).join('\n');
        
        fs.writeFileSync(csvFile, csvHeader + csvRows);
        console.log(`📊 CSV Report: ${csvFile}`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    console.log('🎯 STARTING FANATICS POKEMON BULK DATA EXTRACTION');
    console.log('=================================================');
    console.log('📋 Target: ALL Pokemon cards, auctions, buy-now listings');
    console.log('🎯 Goal: Complete Pokemon card inventory from Fanatics Collect');
    console.log('⏰ Estimated time: 5-10 minutes for comprehensive extraction\n');
    
    const extractor = new FanaticsPokemonBulkExtractor();
    await extractor.extractAllPokemonData();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsPokemonBulkExtractor;
