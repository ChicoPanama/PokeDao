const Database = require('better-sqlite3');

/**
 * Unified Pricing Analyzer
 * Combines Pokemon TCG API, TCGPlayer scraped data, and eBay sold listings
 * to provide comprehensive market analysis
 */
class UnifiedPokemonPricingAnalyzer {
    constructor() {
        this.pokemonDB = new Database('pokemon_tcg_complete.db');
        this.tcgplayerDB = new Database('tcgplayer.db');
        this.ebayDB = new Database('ebay_pricing_complete.db');
        this.unifiedDB = new Database('unified_pokemon_pricing.db');
        this.setupUnifiedDatabase();
    }

    setupUnifiedDatabase() {
        console.log('🗃️  Setting up unified pricing database...');
        
        this.unifiedDB.exec(`
            CREATE TABLE IF NOT EXISTS unified_pricing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_name TEXT NOT NULL,
                set_name TEXT NOT NULL,
                pokemon_tcg_id TEXT,
                
                -- Pokemon TCG API Data
                tcg_api_market_price DECIMAL(10,2),
                tcg_api_low_price DECIMAL(10,2),
                tcg_api_high_price DECIMAL(10,2),
                tcg_api_updated DATE,
                
                -- TCGPlayer Scraped Data
                tcgplayer_scraped_price DECIMAL(10,2),
                tcgplayer_listings_count INTEGER,
                tcgplayer_updated DATE,
                
                -- eBay Sold Data
                ebay_average_price DECIMAL(10,2),
                ebay_median_price DECIMAL(10,2),
                ebay_sample_size INTEGER,
                ebay_trend TEXT,
                ebay_confidence INTEGER,
                ebay_updated DATE,
                
                -- Unified Analysis
                recommended_price DECIMAL(10,2),
                price_confidence_score INTEGER,
                market_trend TEXT,
                volatility_score INTEGER,
                data_quality_score INTEGER,
                
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_unified_card_name ON unified_pricing(card_name);
            CREATE INDEX IF NOT EXISTS idx_unified_set_name ON unified_pricing(set_name);
            CREATE INDEX IF NOT EXISTS idx_recommended_price ON unified_pricing(recommended_price);
        `);
        
        console.log('✅ Unified database setup complete');
    }

    // Extract Pokemon TCG API pricing data
    getPokemonTCGPricing(cardName, setName) {
        try {
            const card = this.pokemonDB.prepare(`
                SELECT id, tcgplayer, cardmarket, extractedAt
                FROM pokemon_cards 
                WHERE name LIKE ? AND set_name LIKE ?
                LIMIT 1
            `).get(`%${cardName}%`, `%${setName}%`);
            
            if (!card) return null;
            
            let tcgplayerData = null;
            try {
                const tcgplayer = JSON.parse(card.tcgplayer || '{}');
                if (tcgplayer.prices) {
                    const prices = tcgplayer.prices;
                    tcgplayerData = {
                        marketPrice: prices.holofoil?.market || prices.normal?.market || prices.reverseHolofoil?.market,
                        lowPrice: prices.holofoil?.low || prices.normal?.low || prices.reverseHolofoil?.low,
                        highPrice: prices.holofoil?.high || prices.normal?.high || prices.reverseHolofoil?.high,
                        updatedAt: tcgplayer.updatedAt
                    };
                }
            } catch (e) {
                console.log(`  ⚠️  Error parsing TCG API data: ${e.message}`);
            }
            
            return {
                pokemonTcgId: card.id,
                tcgplayerData,
                extractedAt: card.extractedAt
            };
        } catch (error) {
            console.log(`  ⚠️  Error getting Pokemon TCG data: ${error.message}`);
            return null;
        }
    }

    // Get TCGPlayer scraped data
    getTCGPlayerScrapedData(cardName) {
        try {
            const results = this.tcgplayerDB.prepare(`
                SELECT currentPrice, marketPrice, listingCount, extractedAt
                FROM tcgplayer_cards 
                WHERE name LIKE ?
                ORDER BY extractedAt DESC
                LIMIT 5
            `).all(`%${cardName}%`);
            
            if (results.length === 0) return null;
            
            // Calculate average from recent listings
            const avgPrice = results.reduce((sum, r) => sum + (r.currentPrice || r.marketPrice || 0), 0) / results.length;
            const totalListings = results.reduce((sum, r) => sum + (r.listingCount || 0), 0);
            
            return {
                averagePrice: avgPrice,
                totalListings: totalListings,
                sampleSize: results.length,
                latestUpdate: results[0].extractedAt
            };
        } catch (error) {
            console.log(`  ⚠️  Error getting TCGPlayer scraped data: ${error.message}`);
            return null;
        }
    }

    // Get eBay pricing analysis
    getEBayPricingData(pokemonTcgId, cardName) {
        try {
            const analysis = this.ebayDB.prepare(`
                SELECT average_price, median_price, sample_size, price_trend, 
                       confidence_score, last_updated
                FROM ebay_price_analysis 
                WHERE pokemon_tcg_id = ? OR card_name LIKE ?
                ORDER BY last_updated DESC
                LIMIT 1
            `).get(pokemonTcgId, `%${cardName}%`);
            
            return analysis;
        } catch (error) {
            console.log(`  ⚠️  Error getting eBay data: ${error.message}`);
            return null;
        }
    }

    // Calculate unified pricing recommendation
    calculateUnifiedPricing(tcgApiData, tcgplayerData, ebayData) {
        const prices = [];
        const weights = [];
        const confidenceFactors = [];
        
        // Pokemon TCG API pricing (high confidence for current market)
        if (tcgApiData?.marketPrice) {
            prices.push(tcgApiData.marketPrice);
            weights.push(0.4); // 40% weight
            confidenceFactors.push(85); // High confidence
        }
        
        // eBay sold listings (high confidence for real transactions)
        if (ebayData?.average_price) {
            prices.push(ebayData.average_price);
            weights.push(0.35); // 35% weight
            confidenceFactors.push(ebayData.confidence_score || 70);
        }
        
        // TCGPlayer scraped data (moderate confidence)
        if (tcgplayerData?.averagePrice) {
            prices.push(tcgplayerData.averagePrice);
            weights.push(0.25); // 25% weight
            confidenceFactors.push(60); // Moderate confidence
        }
        
        if (prices.length === 0) return null;
        
        // Normalize weights
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const normalizedWeights = weights.map(w => w / totalWeight);
        
        // Calculate weighted average
        const recommendedPrice = prices.reduce((sum, price, i) => 
            sum + (price * normalizedWeights[i]), 0
        );
        
        // Calculate overall confidence
        const overallConfidence = confidenceFactors.reduce((sum, conf, i) => 
            sum + (conf * normalizedWeights[i]), 0
        );
        
        // Calculate volatility (price spread)
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const volatility = prices.length > 1 ? 
            Math.round(((maxPrice - minPrice) / recommendedPrice) * 100) : 0;
        
        // Determine market trend
        let marketTrend = 'stable';
        if (ebayData?.price_trend) {
            marketTrend = ebayData.price_trend;
        }
        
        // Calculate data quality score
        const dataQuality = Math.min(100, 
            (prices.length / 3) * 50 + // Source diversity
            (overallConfidence * 0.3) + // Confidence factor
            Math.max(0, 30 - volatility) // Volatility penalty
        );
        
        return {
            recommendedPrice: Math.round(recommendedPrice * 100) / 100,
            confidenceScore: Math.round(overallConfidence),
            volatilityScore: volatility,
            dataQualityScore: Math.round(dataQuality),
            marketTrend: marketTrend,
            sourceCount: prices.length
        };
    }

    // Store unified pricing data
    storeUnifiedPricing(cardName, setName, tcgApiData, tcgplayerData, ebayData, analysis) {
        const insert = this.unifiedDB.prepare(`
            INSERT OR REPLACE INTO unified_pricing (
                card_name, set_name, pokemon_tcg_id,
                tcg_api_market_price, tcg_api_low_price, tcg_api_high_price, tcg_api_updated,
                tcgplayer_scraped_price, tcgplayer_listings_count, tcgplayer_updated,
                ebay_average_price, ebay_median_price, ebay_sample_size, ebay_trend, 
                ebay_confidence, ebay_updated,
                recommended_price, price_confidence_score, market_trend, 
                volatility_score, data_quality_score, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        insert.run([
            cardName,
            setName,
            tcgApiData?.pokemonTcgId,
            tcgApiData?.tcgplayerData?.marketPrice,
            tcgApiData?.tcgplayerData?.lowPrice,
            tcgApiData?.tcgplayerData?.highPrice,
            tcgApiData?.tcgplayerData?.updatedAt,
            tcgplayerData?.averagePrice,
            tcgplayerData?.totalListings,
            tcgplayerData?.latestUpdate,
            ebayData?.average_price,
            ebayData?.median_price,
            ebayData?.sample_size,
            ebayData?.price_trend,
            ebayData?.confidence_score,
            ebayData?.last_updated,
            analysis?.recommendedPrice,
            analysis?.confidenceScore,
            analysis?.marketTrend,
            analysis?.volatilityScore,
            analysis?.dataQualityScore
        ]);
    }

    // Main analysis process
    async analyzeUnifiedPricing() {
        console.log('🚀 Starting unified Pokemon pricing analysis...');
        
        // Get sample of popular Pokemon cards for analysis
        const popularCards = this.pokemonDB.prepare(`
            SELECT DISTINCT name, set_name 
            FROM pokemon_cards 
            WHERE tcgplayer LIKE '%prices%'
            ORDER BY RANDOM()
            LIMIT 200
        `).all();
        
        console.log(`📊 Analyzing ${popularCards.length} Pokemon cards across all data sources...`);
        
        let processedCards = 0;
        let unifiedEntries = 0;
        
        for (const card of popularCards) {
            try {
                console.log(`\n📄 Analyzing: ${card.name} (${card.set_name})`);
                
                // Get data from all sources
                const tcgApiData = this.getPokemonTCGPricing(card.name, card.set_name);
                const tcgplayerData = this.getTCGPlayerScrapedData(card.name);
                const ebayData = this.getEBayPricingData(tcgApiData?.pokemonTcgId, card.name);
                
                // Calculate unified pricing
                const analysis = this.calculateUnifiedPricing(
                    tcgApiData?.tcgplayerData, 
                    tcgplayerData, 
                    ebayData
                );
                
                if (analysis) {
                    console.log(`  💰 Recommended price: $${analysis.recommendedPrice}`);
                    console.log(`  🎯 Confidence: ${analysis.confidenceScore}%`);
                    console.log(`  📊 Data quality: ${analysis.dataQualityScore}%`);
                    console.log(`  📈 Trend: ${analysis.marketTrend}`);
                    
                    this.storeUnifiedPricing(
                        card.name, 
                        card.set_name, 
                        tcgApiData, 
                        tcgplayerData, 
                        ebayData, 
                        analysis
                    );
                    
                    unifiedEntries++;
                } else {
                    console.log(`  ⚠️  No pricing data available from any source`);
                }
                
                processedCards++;
                
                if (processedCards % 25 === 0) {
                    console.log(`\n📈 Progress: ${processedCards}/${popularCards.length} analyzed, ${unifiedEntries} unified entries created`);
                }
                
            } catch (error) {
                console.log(`❌ Error analyzing ${card.name}: ${error.message}`);
            }
        }
        
        // Generate final statistics
        const stats = this.unifiedDB.prepare(`
            SELECT 
                COUNT(*) as total_entries,
                AVG(recommended_price) as avg_price,
                AVG(price_confidence_score) as avg_confidence,
                AVG(data_quality_score) as avg_quality,
                COUNT(CASE WHEN ebay_average_price IS NOT NULL THEN 1 END) as ebay_coverage,
                COUNT(CASE WHEN tcg_api_market_price IS NOT NULL THEN 1 END) as tcg_api_coverage,
                COUNT(CASE WHEN tcgplayer_scraped_price IS NOT NULL THEN 1 END) as tcgplayer_coverage
            FROM unified_pricing
        `).get();
        
        console.log(`\n🏁 UNIFIED PRICING ANALYSIS COMPLETE!`);
        console.log(`📊 Total entries created: ${stats.total_entries}`);
        console.log(`💰 Average recommended price: $${stats.avg_price?.toFixed(2)}`);
        console.log(`🎯 Average confidence: ${stats.avg_confidence?.toFixed(1)}%`);
        console.log(`📊 Average data quality: ${stats.avg_quality?.toFixed(1)}%`);
        console.log(`\n📈 DATA SOURCE COVERAGE:`);
        console.log(`  Pokemon TCG API: ${stats.tcg_api_coverage} cards`);
        console.log(`  eBay sold data: ${stats.ebay_coverage} cards`);
        console.log(`  TCGPlayer scraped: ${stats.tcgplayer_coverage} cards`);
        console.log(`💾 Database: unified_pokemon_pricing.db`);
        
        this.pokemonDB.close();
        this.tcgplayerDB.close();
        this.ebayDB.close();
        this.unifiedDB.close();
        
        console.log(`\n✅ Unified pricing database ready for PokeDAO integration!`);
    }
}

// Start the unified analysis
console.log('🚀 Initializing Unified Pokemon Pricing Analyzer...');
const analyzer = new UnifiedPokemonPricingAnalyzer();
analyzer.analyzeUnifiedPricing().catch(console.error);
