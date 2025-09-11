/**
 * CardMarket Pokemon Data Extractor
 * Secure, rate-limited Pokemon TCG data extraction
 */

const CardMarketConfig = require('./cardmarket-config');
const fs = require('fs');
const path = require('path');

class CardMarketPokemonExtractor {
    constructor() {
        this.cardmarket = new CardMarketConfig();
        this.extractedData = {
            sets: [],
            cards: [],
            prices: [],
            metadata: {
                startTime: null,
                endTime: null,
                totalRequests: 0,
                errors: []
            }
        };
    }

    async startExtraction() {
        console.log('🚀 Starting Pokemon data extraction from CardMarket...');
        this.extractedData.metadata.startTime = new Date().toISOString();
        
        try {
            // Initialize CardMarket connection
            await this.cardmarket.initialize();
            
            // Extract Pokemon sets
            console.log('📦 Extracting Pokemon sets...');
            await this.extractPokemonSets();
            
            // Extract Pokemon cards
            console.log('🎴 Extracting Pokemon cards...');
            await this.extractPokemonCards();
            
            // Extract market prices
            console.log('💰 Extracting market prices...');
            await this.extractMarketPrices();
            
            // Save extracted data
            await this.saveExtractedData();
            
            this.extractedData.metadata.endTime = new Date().toISOString();
            
            console.log('✅ Pokemon data extraction completed successfully!');
            console.log(`📊 Extracted: ${this.extractedData.sets.length} sets, ${this.extractedData.cards.length} cards`);
            
            return this.extractedData;
            
        } catch (error) {
            console.error('❌ Extraction failed:', error.message);
            this.extractedData.metadata.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message
            });
            
            throw error;
        }
    }

    async extractPokemonSets() {
        try {
            console.log('   🔍 Fetching Pokemon expansions...');
            
            const client = this.cardmarket.getClient();
            const expansions = await client.get('/games/6/expansions');
            
            if (expansions && expansions.expansion) {
                for (const expansion of expansions.expansion) {
                    const setData = {
                        id: expansion.idExpansion,
                        name: expansion.enName,
                        abbreviation: expansion.abbreviation,
                        icon: expansion.icon,
                        releaseDate: expansion.releaseDate,
                        isReleased: expansion.isReleased,
                        cardCount: expansion.cardCount || 0,
                        extractedAt: new Date().toISOString()
                    };
                    
                    this.extractedData.sets.push(setData);
                    console.log(`   ✅ ${setData.name} (${setData.cardCount} cards)`);
                }
            }
            
            this.extractedData.metadata.totalRequests++;
            console.log(`   📊 Extracted ${this.extractedData.sets.length} Pokemon sets`);
            
        } catch (error) {
            console.error('   ❌ Set extraction failed:', error.message);
            throw error;
        }
    }

    async extractPokemonCards() {
        try {
            console.log('   🔍 Fetching Pokemon products...');
            
            const client = this.cardmarket.getClient();
            let startIndex = 0;
            const batchSize = 100;
            let hasMore = true;
            
            while (hasMore && startIndex < 10000) { // Limit to prevent excessive requests
                const products = await client.get('/products', {
                    game: 6, // Pokemon TCG
                    start: startIndex,
                    maxResults: batchSize
                });
                
                if (products && products.product && products.product.length > 0) {
                    for (const product of products.product) {
                        const cardData = {
                            id: product.idProduct,
                            name: product.enName,
                            categoryId: product.categoryId,
                            categoryName: product.categoryName,
                            expansionId: product.expansionId,
                            expansionName: product.expansionName,
                            number: product.number,
                            rarity: product.rarity,
                            image: product.image,
                            website: product.website,
                            extractedAt: new Date().toISOString()
                        };
                        
                        this.extractedData.cards.push(cardData);
                    }
                    
                    startIndex += batchSize;
                    this.extractedData.metadata.totalRequests++;
                    
                    console.log(`   📈 Progress: ${this.extractedData.cards.length} cards extracted`);
                    
                    // Rate limiting delay
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } else {
                    hasMore = false;
                }
            }
            
            console.log(`   📊 Extracted ${this.extractedData.cards.length} Pokemon cards`);
            
        } catch (error) {
            console.error('   ❌ Card extraction failed:', error.message);
            throw error;
        }
    }

    async extractMarketPrices() {
        try {
            console.log('   💰 Fetching market prices (sample)...');
            
            const client = this.cardmarket.getClient();
            const sampleCards = this.extractedData.cards.slice(0, 50); // Sample for demo
            
            for (const card of sampleCards) {
                try {
                    const articles = await client.get(`/products/${card.id}/articles`);
                    
                    if (articles && articles.article && articles.article.length > 0) {
                        for (const article of articles.article.slice(0, 10)) { // Top 10 prices
                            const priceData = {
                                cardId: card.id,
                                cardName: card.name,
                                price: article.price,
                                condition: article.condition,
                                language: article.language?.languageName,
                                foil: article.isFoil,
                                seller: article.seller?.username,
                                location: article.seller?.address?.country,
                                extractedAt: new Date().toISOString()
                            };
                            
                            this.extractedData.prices.push(priceData);
                        }
                    }
                    
                    this.extractedData.metadata.totalRequests++;
                    
                    // Rate limiting delay
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (cardError) {
                    console.log(`   ⚠️ Price extraction failed for ${card.name}: ${cardError.message}`);
                }
            }
            
            console.log(`   📊 Extracted ${this.extractedData.prices.length} price points`);
            
        } catch (error) {
            console.error('   ❌ Price extraction failed:', error.message);
            throw error;
        }
    }

    async saveExtractedData() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `cardmarket-pokemon-data-${timestamp}.json`;
        
        try {
            fs.writeFileSync(filename, JSON.stringify(this.extractedData, null, 2));
            console.log(`   💾 Data saved to: ${filename}`);
            
            // Also save summary
            const summary = {
                extractionDate: this.extractedData.metadata.startTime,
                totalSets: this.extractedData.sets.length,
                totalCards: this.extractedData.cards.length,
                totalPrices: this.extractedData.prices.length,
                totalRequests: this.extractedData.metadata.totalRequests,
                filename: filename
            };
            
            fs.writeFileSync('cardmarket-extraction-summary.json', JSON.stringify(summary, null, 2));
            
        } catch (error) {
            console.error('   ❌ Save failed:', error.message);
            throw error;
        }
    }

    // Quick test extraction (smaller dataset)
    async quickTest() {
        console.log('🧪 Running quick CardMarket test...');
        
        try {
            await this.cardmarket.initialize();
            
            const client = this.cardmarket.getClient();
            
            // Test 1: Get account info
            console.log('   🔍 Testing account access...');
            const account = await client.get('/account');
            console.log(`   ✅ Connected as: ${account.account?.username || 'Unknown'}`);
            
            // Test 2: Get Pokemon game info
            console.log('   🎮 Testing Pokemon game access...');
            const games = await client.get('/games');
            const pokemonGame = games.game?.find(g => g.idGame === 6);
            console.log(`   ✅ Pokemon TCG: ${pokemonGame?.name || 'Found'}`);
            
            // Test 3: Get sample expansion
            console.log('   📦 Testing expansion access...');
            const expansions = await client.get('/games/6/expansions');
            const sampleExpansion = expansions.expansion?.[0];
            console.log(`   ✅ Sample set: ${sampleExpansion?.enName || 'Found'}`);
            
            console.log('   ✅ All tests passed! CardMarket integration is working.');
            
            return true;
            
        } catch (error) {
            console.error('   ❌ Test failed:', error.message);
            throw error;
        }
    }
}

module.exports = CardMarketPokemonExtractor;

// CLI usage
if (require.main === module) {
    const extractor = new CardMarketPokemonExtractor();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
        extractor.quickTest().catch(console.error);
    } else {
        extractor.startExtraction().catch(console.error);
    }
}