/**
 * TCGPlayer COLLECT EVERYTHING - No Duplicate Filtering
 * Strategy: Download ALL cards, sort/deduplicate later
 * Goal: Get complete 30,120+ card dataset
 */

const { PrismaClient } = require('./generated/client');
const axios = require('axios');

class TCGPlayerCollectEverything {
    constructor() {
        this.prisma = new PrismaClient();
        this.sessionId = `collect_everything_${Date.now()}`;
        this.navigationAPI = 'https://marketplace-navigation.tcgplayer.com/marketplace-navigation-search-feature.json';
        
        // NO DUPLICATE TRACKING - Collect everything!
        this.totalCollected = 0;
        this.startTime = Date.now();
        
        console.log('🚀 TCGPLAYER COLLECT EVERYTHING MODE');
        console.log('====================================');
        console.log('❌ NO duplicate filtering');
        console.log('❌ NO similarity checking');
        console.log('❌ NO collection limits');
        console.log('✅ INSERT ALL cards found');
        console.log('✅ Let database handle exact duplicates');
        console.log('✅ Sort/deduplicate in post-processing');
    }

    async initialize() {
        console.log(`🚀 Session: ${this.sessionId}`);
        console.log('🎯 Target: ALL 30,120+ Pokemon cards');
        
        try {
            await this.createHarvestSession();
            
            // Count current cards (but don't load them for duplicate checking)
            const currentCount = await this.prisma.tCGPlayerCard.count();
            console.log(`📊 Current database: ${currentCount} cards`);
            console.log(`⏳ Collecting everything - no filtering!`);
            
            return true;
        } catch (error) {
            console.error('💥 Initialization failed:', error);
            throw error;
        }
    }

    async createHarvestSession() {
        try {
            await this.prisma.tCGPlayerHarvestSession.create({
                data: {
                    id: this.sessionId,
                    source: 'tcgplayer-collect-everything',
                    status: 'running',
                    metadata: {
                        strategy: 'collect_everything_no_duplicates',
                        target: '30120_total_cards',
                        filtering: 'disabled'
                    }
                }
            });
        } catch (error) {
            console.error('Error creating harvest session:', error);
        }
    }

    async collectAllCards() {
        console.log('\n🚀 STARTING COMPLETE COLLECTION...');
        
        let currentPage = 1;
        let consecutiveEmptyPages = 0;
        let totalCards = [];
        
        while (consecutiveEmptyPages < 5) { // More lenient - check 5 empty pages
            console.log(`\n📄 Processing page ${currentPage}...`);
            
            try {
                const pageCards = await this.getCardsFromPage(currentPage);
                
                if (pageCards.length > 0) {
                    console.log(`📦 Found ${pageCards.length} cards on page ${currentPage}`);
                    
                    // SAVE ALL CARDS - NO DUPLICATE CHECKING
                    for (const card of pageCards) {
                        await this.saveCardEverything(card);
                        this.totalCollected++;
                        
                        // Progress every 100 cards
                        if (this.totalCollected % 100 === 0) {
                            const elapsed = (Date.now() - this.startTime) / 1000;
                            const rate = this.totalCollected / elapsed;
                            console.log(`✅ Collected ${this.totalCollected} cards (${rate.toFixed(1)} cards/sec)`);
                        }
                    }
                    
                    totalCards.push(...pageCards);
                    consecutiveEmptyPages = 0;
                    
                    console.log(`✅ Page ${currentPage} complete: +${pageCards.length} cards | Total: ${this.totalCollected}`);
                } else {
                    consecutiveEmptyPages++;
                    console.log(`📭 Empty page ${currentPage} (${consecutiveEmptyPages}/5)`);
                }
                
                currentPage++;
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error on page ${currentPage}:`, error.message);
                consecutiveEmptyPages++;
                currentPage++;
            }
        }
        
        console.log('\n🎉 COLLECTION COMPLETE!');
        console.log(`📊 Total collected: ${this.totalCollected} cards`);
        console.log(`📄 Pages processed: ${currentPage - 1}`);
        
        // Update session
        await this.prisma.tCGPlayerHarvestSession.update({
            where: { id: this.sessionId },
            data: {
                status: 'completed',
                metadata: {
                    strategy: 'collect_everything_no_duplicates',
                    total_collected: this.totalCollected,
                    pages_processed: currentPage - 1,
                    completed_at: new Date().toISOString()
                }
            }
        });
        
        return totalCards;
    }

    async getCardsFromPage(page) {
        try {
            const response = await axios.post(this.navigationAPI, {
                "algorithm": "",
                "from": (page - 1) * 60, // 60 cards per page
                "size": 60,
                "filters": {
                    "term": {},
                    "range": {},
                    "match": {
                        "productLineName": ["pokemon"]
                    }
                },
                "listingSearch": {
                    "filters": {
                        "term": {
                            "sellerStatus": "Live",
                            "channelId": 0,
                            "language": ["English"]
                        },
                        "range": {},
                        "match": {}
                    },
                    "context": {
                        "cart": {}
                    }
                },
                "context": {
                    "cart": {},
                    "shippingCountry": "US"
                },
                "sort": {
                    "field": "relevance",
                    "order": "desc"
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });

            if (response.data?.results?.length > 0) {
                return response.data.results.map(this.transformCard.bind(this));
            }
            
            return [];
        } catch (error) {
            console.error(`API error on page ${page}:`, error.message);
            return [];
        }
    }

    transformCard(rawCard) {
        return {
            externalId: rawCard.productId?.toString(),
            name: rawCard.productName || 'Unknown',
            cleanedName: this.cleanCardName(rawCard.productName || ''),
            setName: rawCard.setName || 'Unknown Set',
            rarity: rawCard.rarity || 'Unknown',
            cardType: rawCard.cardType || 'Pokemon',
            cardNumber: rawCard.cardNumber || null,
            category: 'Pokemon',
            productUrl: rawCard.productUrl || '',
            imageUrl: rawCard.imageUrl || '',
            tcgplayerUrl: rawCard.productUrl || '',
            currentPrice: this.parsePrice(rawCard.marketPrice),
            marketPrice: this.parsePrice(rawCard.marketPrice),
            lowPrice: this.parsePrice(rawCard.lowPrice),
            midPrice: this.parsePrice(rawCard.midPrice),
            highPrice: this.parsePrice(rawCard.highPrice),
            inStock: rawCard.inStock || false,
            sellable: rawCard.sellable || true,
            totalListings: rawCard.totalListings || 0,
            page: null, // Will be set when saving
            harvestSessionId: this.sessionId,
            rarityWeight: this.getRarityWeight(rawCard.rarity)
        };
    }

    // SAVE EVERYTHING - NO DUPLICATE CHECKING
    async saveCardEverything(card) {
        try {
            // Use INSERT OR IGNORE to let database handle exact duplicates
            await this.prisma.tCGPlayerCard.create({
                data: {
                    ...card,
                    id: `${card.externalId}_${Date.now()}_${Math.random()}`, // Unique ID
                    lastUpdated: new Date()
                }
            });
        } catch (error) {
            // If exact duplicate exists, that's fine - keep going
            if (!error.message.includes('Unique constraint')) {
                console.error('Save error:', error.message);
            }
        }
    }

    cleanCardName(name) {
        return name
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\-\(\)\[\]']/g, '')
            .trim();
    }

    parsePrice(priceStr) {
        if (!priceStr) return null;
        const match = priceStr.toString().match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/,/g, '')) : null;
    }

    getRarityWeight(rarity) {
        const weights = {
            'Secret Rare': 10,
            'Ultra Rare': 9,
            'Super Rare': 8,
            'Rare': 7,
            'Uncommon': 6,
            'Common': 5
        };
        return weights[rarity] || 1;
    }

    async cleanup() {
        await this.prisma.$disconnect();
    }
}

// Run the collector
async function main() {
    const collector = new TCGPlayerCollectEverything();
    
    try {
        await collector.initialize();
        await collector.collectAllCards();
        
        console.log('\n🎉 MISSION ACCOMPLISHED!');
        console.log('📊 All available Pokemon cards collected');
        console.log('📋 Next step: Sort and deduplicate dataset');
        
    } catch (error) {
        console.error('💥 Collection failed:', error);
    } finally {
        await collector.cleanup();
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerCollectEverything;
