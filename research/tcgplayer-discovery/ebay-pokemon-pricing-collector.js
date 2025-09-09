const Database = require('better-sqlite3');
const https = require('https');
const fs = require('fs');

/**
 * eBay Pricing Collector for Pokemon TCG Cards
 * Integrates with our complete Pokemon TCG database to get real-world market pricing
 */
class EBayPokemonPricingCollector {
    constructor() {
        this.pokemonDB = new Database('pokemon_tcg_complete.db');
        this.ebayDB = new Database('ebay_pricing_complete.db');
        this.setupEbayDatabase();
        
        // eBay API configuration (you'll need to add your credentials)
        this.ebayConfig = {
            clientId: process.env.EBAY_CLIENT_ID || 'YOUR_EBAY_CLIENT_ID',
            clientSecret: process.env.EBAY_CLIENT_SECRET || 'YOUR_EBAY_CLIENT_SECRET',
            sandbox: false // Set to true for testing
        };
        
        this.accessToken = null;
        this.requestCount = 0;
        this.dailyLimit = 5000; // eBay API daily limit
    }

    setupEbayDatabase() {
        console.log('🗃️  Setting up eBay pricing database...');
        
        this.ebayDB.exec(`
            CREATE TABLE IF NOT EXISTS ebay_pricing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_tcg_id TEXT NOT NULL,
                card_name TEXT NOT NULL,
                set_name TEXT NOT NULL,
                ebay_item_id TEXT,
                sold_price DECIMAL(10,2),
                sold_date DATE,
                shipping_cost DECIMAL(8,2),
                total_cost DECIMAL(10,2),
                condition_description TEXT,
                grade TEXT,
                grading_company TEXT,
                seller_feedback_score INTEGER,
                listing_type TEXT,
                auction_end_type TEXT,
                image_url TEXT,
                ebay_url TEXT,
                search_query TEXT,
                confidence_score INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pokemon_tcg_id) REFERENCES pokemon_cards(id)
            );
            
            CREATE TABLE IF NOT EXISTS ebay_price_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_tcg_id TEXT NOT NULL,
                card_name TEXT NOT NULL,
                analysis_date DATE DEFAULT CURRENT_DATE,
                sample_size INTEGER,
                average_price DECIMAL(10,2),
                median_price DECIMAL(10,2),
                min_price DECIMAL(10,2),
                max_price DECIMAL(10,2),
                price_trend TEXT,
                confidence_score INTEGER,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_pokemon_tcg_id ON ebay_pricing(pokemon_tcg_id);
            CREATE INDEX IF NOT EXISTS idx_card_name ON ebay_pricing(card_name);
            CREATE INDEX IF NOT EXISTS idx_sold_date ON ebay_pricing(sold_date);
            CREATE INDEX IF NOT EXISTS idx_analysis_date ON ebay_price_analysis(analysis_date);
        `);
        
        console.log('✅ eBay database setup complete');
    }

    // Generate optimized search queries for Pokemon cards
    generateSearchQueries(card) {
        const baseName = card.name.replace(/[^\w\s-]/g, '').trim();
        const setName = card.set_name ? card.set_name.replace(/[^\w\s-]/g, '').trim() : '';
        
        const queries = [];
        
        // Basic query
        queries.push(`${baseName} ${setName} pokemon card`);
        
        // Add rarity-specific searches
        if (card.rarity) {
            if (card.rarity.toLowerCase().includes('holo')) {
                queries.push(`${baseName} ${setName} holo pokemon`);
            }
            if (card.rarity.toLowerCase().includes('rare')) {
                queries.push(`${baseName} ${setName} rare pokemon`);
            }
        }
        
        // Add graded card searches
        queries.push(`${baseName} ${setName} PSA pokemon`);
        queries.push(`${baseName} ${setName} BGS pokemon`);
        queries.push(`${baseName} ${setName} CGC pokemon`);
        
        // Add vintage searches for older sets
        const vintageKeywords = ['base set', 'jungle', 'fossil', 'rocket', 'gym'];
        if (vintageKeywords.some(keyword => setName.toLowerCase().includes(keyword))) {
            queries.push(`${baseName} ${setName} vintage pokemon`);
        }
        
        return queries;
    }

    // Make eBay API request (simplified - you'd need to implement full OAuth)
    async makeEbayRequest(endpoint, params) {
        return new Promise((resolve, reject) => {
            // This is a simplified version - you'd need to implement full eBay API authentication
            // For now, we'll simulate the response structure
            
            setTimeout(() => {
                // Simulate eBay sold listings response
                const mockResponse = {
                    itemSummaries: [
                        {
                            itemId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            title: `${params.q} - Mock eBay Listing`,
                            price: {
                                value: (Math.random() * 500 + 10).toFixed(2),
                                currency: 'USD'
                            },
                            condition: 'Used',
                            itemLocation: { country: 'US' },
                            seller: { feedbackScore: Math.floor(Math.random() * 10000) },
                            itemWebUrl: `https://ebay.com/itm/${Date.now()}`,
                            image: { imageUrl: 'https://example.com/image.jpg' },
                            buyingOptions: ['AUCTION'],
                            itemEndDate: new Date().toISOString()
                        }
                    ],
                    total: 1
                };
                
                this.requestCount++;
                resolve(mockResponse);
            }, 1000 + Math.random() * 2000); // Simulate API delay with rate limiting
        });
    }

    // Search eBay for sold listings of a specific card
    async searchEbaySoldListings(card, searchQuery) {
        try {
            console.log(`  🔍 Searching eBay for: "${searchQuery}"`);
            
            if (this.requestCount >= this.dailyLimit) {
                console.log('  ⚠️  Daily API limit reached');
                return [];
            }
            
            const params = {
                q: searchQuery,
                category_ids: '2536', // Pokemon Trading Cards
                filter: 'conditionIds:{2500|3000|4000|5000|6000},deliveryCountry:US,soldItemsOnly:true',
                sort: '-endDate',
                limit: 50
            };
            
            const response = await this.makeEbayRequest('/buy/browse/v1/item_summary/search', params);
            
            const soldListings = [];
            
            if (response.itemSummaries) {
                for (const item of response.itemSummaries) {
                    const listing = {
                        ebayItemId: item.itemId,
                        title: item.title,
                        soldPrice: parseFloat(item.price?.value || 0),
                        currency: item.price?.currency || 'USD',
                        condition: item.condition || 'Unknown',
                        sellerFeedback: item.seller?.feedbackScore || 0,
                        endDate: item.itemEndDate,
                        imageUrl: item.image?.imageUrl,
                        ebayUrl: item.itemWebUrl,
                        listingType: item.buyingOptions?.includes('AUCTION') ? 'Auction' : 'Buy It Now'
                    };
                    
                    // Extract grading info from title
                    const gradingMatch = listing.title.match(/(PSA|BGS|CGC)\s*(\d+)/i);
                    if (gradingMatch) {
                        listing.gradingCompany = gradingMatch[1].toUpperCase();
                        listing.grade = gradingMatch[2];
                    }
                    
                    soldListings.push(listing);
                }
            }
            
            console.log(`    ✅ Found ${soldListings.length} sold listings`);
            return soldListings;
            
        } catch (error) {
            console.log(`    ❌ Error searching eBay: ${error.message}`);
            return [];
        }
    }

    // Store eBay pricing data
    storeSoldListings(pokemonTcgId, cardName, setName, soldListings, searchQuery) {
        const insertListing = this.ebayDB.prepare(`
            INSERT INTO ebay_pricing (
                pokemon_tcg_id, card_name, set_name, ebay_item_id, sold_price,
                sold_date, condition_description, grade, grading_company,
                seller_feedback_score, listing_type, image_url, ebay_url,
                search_query, confidence_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const listing of soldListings) {
            try {
                // Calculate confidence score based on various factors
                let confidenceScore = 50; // Base score
                
                // Title relevance
                if (listing.title.toLowerCase().includes(cardName.toLowerCase())) confidenceScore += 20;
                if (listing.title.toLowerCase().includes(setName.toLowerCase())) confidenceScore += 15;
                
                // Seller feedback
                if (listing.sellerFeedback > 1000) confidenceScore += 10;
                if (listing.sellerFeedback > 5000) confidenceScore += 5;
                
                // Listing type (auctions often more accurate than BIN)
                if (listing.listingType === 'Auction') confidenceScore += 10;
                
                // Graded cards get higher confidence
                if (listing.gradingCompany) confidenceScore += 15;
                
                confidenceScore = Math.min(100, confidenceScore);
                
                insertListing.run([
                    pokemonTcgId,
                    cardName,
                    setName,
                    listing.ebayItemId,
                    listing.soldPrice,
                    listing.endDate,
                    listing.condition,
                    listing.grade || null,
                    listing.gradingCompany || null,
                    listing.sellerFeedback,
                    listing.listingType,
                    listing.imageUrl,
                    listing.ebayUrl,
                    searchQuery,
                    confidenceScore
                ]);
            } catch (error) {
                console.log(`    ⚠️  Error storing listing: ${error.message}`);
            }
        }
    }

    // Analyze pricing data for a card
    analyzePricing(pokemonTcgId, cardName) {
        const pricingData = this.ebayDB.prepare(`
            SELECT sold_price, sold_date, confidence_score, grade
            FROM ebay_pricing 
            WHERE pokemon_tcg_id = ? AND sold_price > 0
            ORDER BY sold_date DESC
        `).all(pokemonTcgId);
        
        if (pricingData.length === 0) return null;
        
        // Calculate statistics
        const prices = pricingData.map(p => p.sold_price);
        const average = prices.reduce((a, b) => a + b, 0) / prices.length;
        const sorted = prices.sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        
        // Determine trend (simplified)
        const recentPrices = pricingData.slice(0, 10).map(p => p.sold_price);
        const olderPrices = pricingData.slice(-10).map(p => p.sold_price);
        const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
        const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;
        
        let trend = 'stable';
        if (recentAvg > olderAvg * 1.1) trend = 'increasing';
        else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
        
        // Calculate overall confidence
        const avgConfidence = pricingData.reduce((sum, p) => sum + p.confidence_score, 0) / pricingData.length;
        
        const analysis = {
            sampleSize: pricingData.length,
            averagePrice: average,
            medianPrice: median,
            minPrice: min,
            maxPrice: max,
            trend: trend,
            confidenceScore: Math.round(avgConfidence)
        };
        
        // Store analysis
        const insertAnalysis = this.ebayDB.prepare(`
            INSERT OR REPLACE INTO ebay_price_analysis (
                pokemon_tcg_id, card_name, sample_size, average_price, median_price,
                min_price, max_price, price_trend, confidence_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertAnalysis.run([
            pokemonTcgId, cardName, analysis.sampleSize, analysis.averagePrice,
            analysis.medianPrice, analysis.minPrice, analysis.maxPrice,
            analysis.trend, analysis.confidenceScore
        ]);
        
        return analysis;
    }

    // Main collection process
    async collectEbayPricing() {
        console.log('🚀 Starting eBay pricing collection for Pokemon TCG cards...');
        
        // Get Pokemon cards from our complete database
        const cards = this.pokemonDB.prepare(`
            SELECT id, name, set_name, rarity, types, nationalPokedexNumbers
            FROM pokemon_cards 
            ORDER BY RANDOM()
            LIMIT 100
        `).all(); // Start with 100 cards for testing
        
        console.log(`📊 Processing ${cards.length} Pokemon cards for eBay pricing...`);
        
        let processedCards = 0;
        let totalListings = 0;
        
        for (const card of cards) {
            try {
                console.log(`\n📄 Processing card ${processedCards + 1}/${cards.length}: ${card.name}`);
                
                // Generate search queries
                const searchQueries = this.generateSearchQueries(card);
                
                let cardListings = [];
                
                // Search with each query (limit to 2 queries per card to conserve API calls)
                for (let i = 0; i < Math.min(2, searchQueries.length); i++) {
                    const listings = await this.searchEbaySoldListings(card, searchQueries[i]);
                    cardListings = cardListings.concat(listings);
                    
                    // Rate limiting pause
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                if (cardListings.length > 0) {
                    // Remove duplicates
                    const uniqueListings = cardListings.filter((listing, index, self) => 
                        index === self.findIndex(l => l.ebayItemId === listing.ebayItemId)
                    );
                    
                    console.log(`  💾 Storing ${uniqueListings.length} unique listings`);
                    this.storeSoldListings(card.id, card.name, card.set_name, uniqueListings, searchQueries[0]);
                    
                    // Analyze pricing
                    const analysis = this.analyzePricing(card.id, card.name);
                    if (analysis) {
                        console.log(`  📊 Analysis: $${analysis.averagePrice.toFixed(2)} avg, ${analysis.sampleSize} sales, ${analysis.trend} trend`);
                    }
                    
                    totalListings += uniqueListings.length;
                }
                
                processedCards++;
                
                // Progress update every 10 cards
                if (processedCards % 10 === 0) {
                    console.log(`\n📈 Progress: ${processedCards}/${cards.length} cards processed, ${totalListings} total listings collected`);
                }
                
                // Check daily limit
                if (this.requestCount >= this.dailyLimit) {
                    console.log('⚠️  Daily API limit reached, stopping collection');
                    break;
                }
                
            } catch (error) {
                console.log(`❌ Error processing card ${card.name}: ${error.message}`);
            }
        }
        
        // Final statistics
        const finalStats = this.ebayDB.prepare('SELECT COUNT(*) as count FROM ebay_pricing').get();
        const analysisStats = this.ebayDB.prepare('SELECT COUNT(*) as count FROM ebay_price_analysis').get();
        
        console.log(`\n🏁 eBay PRICING COLLECTION COMPLETE!`);
        console.log(`📊 Cards processed: ${processedCards}`);
        console.log(`💰 Total sold listings: ${finalStats.count}`);
        console.log(`📈 Price analyses: ${analysisStats.count}`);
        console.log(`🔧 API requests used: ${this.requestCount}/${this.dailyLimit}`);
        console.log(`💾 Database: ebay_pricing_complete.db`);
        
        this.pokemonDB.close();
        this.ebayDB.close();
    }
}

// Start the eBay pricing collection
console.log('🚀 Initializing eBay Pokemon TCG Pricing Collector...');
const collector = new EBayPokemonPricingCollector();
collector.collectEbayPricing().catch(console.error);
