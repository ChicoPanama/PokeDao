#!/usr/bin/env node

/**
 * eBay Pokemon Collector - Demo Mode
 * Works without credentials to show the system architecture
 * Simulates what real eBay data collection would look like
 */

const Database = require('better-sqlite3');

class EBayDemoCollector {
    constructor() {
        this.pokemonDB = null;
        this.ebayDB = null;
        this.setupDatabases();
        
        // Demo configuration
        this.demoMode = !process.env.EBAY_CLIENT_ID;
        this.processedCards = 0;
        
        console.log('🎯 eBay Pokemon Collector - Demo Mode');
        console.log('=====================================\n');
        
        if (this.demoMode) {
            console.log('📋 Running in DEMO MODE (no eBay credentials)');
            console.log('   • Will simulate eBay data collection');
            console.log('   • Shows database structure and analysis');
            console.log('   • Ready for real credentials when available\n');
        }
    }
    
    setupDatabases() {
        console.log('🗃️  Setting up eBay pricing database...');
        
        // Create eBay pricing database
        this.ebayDB = new Database('ebay_pricing_demo.db');
        
        this.ebayDB.exec(`
            CREATE TABLE IF NOT EXISTS ebay_sold_listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_tcg_id TEXT NOT NULL,
                card_name TEXT NOT NULL,
                set_name TEXT NOT NULL,
                ebay_item_id TEXT UNIQUE,
                title TEXT,
                sold_price DECIMAL(10,2),
                sold_date DATETIME,
                shipping_cost DECIMAL(8,2),
                total_cost DECIMAL(10,2),
                condition_grade TEXT,
                grading_company TEXT,
                grade_number TEXT,
                seller_feedback INTEGER,
                buy_it_now BOOLEAN,
                auction_type TEXT,
                bid_count INTEGER,
                watchers_count INTEGER,
                currency_code TEXT DEFAULT 'USD',
                country TEXT,
                image_url TEXT,
                ebay_url TEXT,
                category_id INTEGER,
                search_query TEXT,
                confidence_score INTEGER,
                data_source TEXT DEFAULT 'ebay_finding_api_demo',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS ebay_market_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_tcg_id TEXT NOT NULL,
                card_name TEXT NOT NULL,
                analysis_date DATE DEFAULT CURRENT_DATE,
                sample_size INTEGER,
                average_sold_price DECIMAL(10,2),
                median_sold_price DECIMAL(10,2),
                min_sold_price DECIMAL(10,2),
                max_sold_price DECIMAL(10,2),
                graded_average DECIMAL(10,2),
                raw_average DECIMAL(10,2),
                graded_premium DECIMAL(10,2),
                market_velocity_days DECIMAL(5,2),
                price_volatility DECIMAL(5,2),
                confidence_score INTEGER,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_ebay_pokemon_id ON ebay_sold_listings(pokemon_tcg_id);
            CREATE INDEX IF NOT EXISTS idx_ebay_sold_date ON ebay_sold_listings(sold_date);
            CREATE INDEX IF NOT EXISTS idx_ebay_confidence ON ebay_sold_listings(confidence_score);
        `);
        
        console.log('✅ eBay database setup complete');
        
        // Try to connect to existing Pokemon database
        try {
            this.pokemonDB = new Database('pokemon_tcg_complete.db');
            console.log('✅ Connected to Pokemon TCG database');
        } catch (error) {
            console.log('⚠️  Pokemon TCG database not found - will use demo data');
        }
    }
    
    // Generate realistic demo data for popular Pokemon cards
    generateDemoSoldListings(card) {
        const demoListings = [];
        const basePrice = Math.random() * 100 + 10; // $10-$110 base
        
        // Generate 5-15 demo sold listings
        const listingCount = Math.floor(Math.random() * 10) + 5;
        
        for (let i = 0; i < listingCount; i++) {
            const isGraded = Math.random() > 0.6;
            const gradingServices = ['PSA', 'BGS', 'CGC', 'SGC'];
            const conditions = ['Near Mint', 'Mint', 'Excellent', 'Good'];
            
            let price = basePrice * (0.7 + Math.random() * 0.6); // ±30% variance
            let condition = 'Raw';
            let gradingCompany = null;
            let gradeNumber = null;
            
            if (isGraded) {
                gradingCompany = gradingServices[Math.floor(Math.random() * gradingServices.length)];
                gradeNumber = (Math.random() * 4 + 6).toFixed(1); // Grade 6.0-10.0
                condition = `${gradingCompany} ${gradeNumber}`;
                price *= (1.2 + Math.random() * 0.8); // Graded premium 20-100%
            } else {
                condition = conditions[Math.floor(Math.random() * conditions.length)];
            }
            
            const shippingCost = Math.random() * 10 + 2; // $2-$12 shipping
            const soldDate = new Date();
            soldDate.setDate(soldDate.getDate() - Math.floor(Math.random() * 90)); // Last 90 days
            
            demoListings.push({
                ebay_item_id: `demo_${Date.now()}_${i}`,
                title: `${card.name} Pokemon Card ${condition} ${card.set_name || ''}`.trim(),
                sold_price: Math.round(price * 100) / 100,
                sold_date: soldDate,
                shipping_cost: Math.round(shippingCost * 100) / 100,
                total_cost: Math.round((price + shippingCost) * 100) / 100,
                condition_grade: condition,
                grading_company: gradingCompany,
                grade_number: gradeNumber,
                seller_feedback: Math.floor(Math.random() * 5000) + 100,
                buy_it_now: Math.random() > 0.3,
                auction_type: Math.random() > 0.3 ? 'FixedPrice' : 'Auction',
                bid_count: Math.random() > 0.7 ? Math.floor(Math.random() * 15) + 1 : 0,
                watchers_count: Math.floor(Math.random() * 25),
                country: 'US',
                confidence_score: Math.floor(Math.random() * 30) + 70 // 70-100
            });
        }
        
        return demoListings;
    }
    
    async collectDemoData() {
        console.log('📊 Starting eBay demo data collection...\n');
        
        // Get sample Pokemon cards
        let cards = [];
        
        if (this.pokemonDB) {
            try {
                cards = this.pokemonDB.prepare(`
                    SELECT id, name, set_name, rarity 
                    FROM pokemon_cards 
                    WHERE name IN ('Charizard', 'Pikachu', 'Blastoise', 'Venusaur', 'Mewtwo')
                    LIMIT 10
                `).all();
                console.log(`🃏 Found ${cards.length} Pokemon cards in database`);
            } catch (error) {
                console.log('⚠️  Could not query Pokemon database, using demo cards');
            }
        }
        
        // Fallback demo cards if no database
        if (cards.length === 0) {
            cards = [
                { id: 'demo-1', name: 'Charizard', set_name: 'Base Set', rarity: 'Rare Holo' },
                { id: 'demo-2', name: 'Pikachu', set_name: 'Yellow Version', rarity: 'Promo' },
                { id: 'demo-3', name: 'Blastoise', set_name: 'Base Set', rarity: 'Rare Holo' },
                { id: 'demo-4', name: 'Venusaur', set_name: 'Base Set', rarity: 'Rare Holo' },
                { id: 'demo-5', name: 'Mewtwo', set_name: 'Movie Promo', rarity: 'Promo' }
            ];
            console.log('🎮 Using demo Pokemon cards for demonstration');
        }
        
        console.log();
        
        // Process each card
        for (const card of cards) {
            console.log(`🔍 Processing: ${card.name} (${card.set_name})`);
            
            // Generate demo sold listings
            const soldListings = this.generateDemoSoldListings(card);
            console.log(`   📈 Generated ${soldListings.length} demo sold listings`);
            
            // Save to database
            await this.saveSoldListings(soldListings, card.id, card.name, card.set_name);
            
            // Generate market analysis
            const analysis = this.generateMarketAnalysis(soldListings, card);
            await this.saveMarketAnalysis(analysis, card.id, card.name);
            
            console.log(`   💰 Average price: $${analysis.average_sold_price}`);
            console.log(`   🏆 Graded premium: +$${analysis.graded_premium}`);
            console.log(`   ⚡ Market velocity: ${analysis.market_velocity_days} days\n`);
            
            this.processedCards++;
            
            // Small delay for demo effect
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Show final statistics
        this.showCollectionSummary();
    }
    
    async saveSoldListings(listings, cardId, cardName, setName) {
        const insertStmt = this.ebayDB.prepare(`
            INSERT OR IGNORE INTO ebay_sold_listings (
                pokemon_tcg_id, card_name, set_name, ebay_item_id, title,
                sold_price, sold_date, shipping_cost, total_cost, condition_grade,
                grading_company, grade_number, seller_feedback, buy_it_now,
                auction_type, bid_count, watchers_count, country, confidence_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let saved = 0;
        for (const listing of listings) {
            try {
                insertStmt.run(
                    cardId, cardName, setName || '', listing.ebay_item_id,
                    listing.title, listing.sold_price, listing.sold_date.toISOString(),
                    listing.shipping_cost, listing.total_cost, listing.condition_grade,
                    listing.grading_company, listing.grade_number, listing.seller_feedback,
                    listing.buy_it_now ? 1 : 0, listing.auction_type, listing.bid_count,
                    listing.watchers_count, listing.country, listing.confidence_score
                );
                saved++;
            } catch (error) {
                console.error('   ❌ Error saving listing:', error.message);
            }
        }
        
        console.log(`   💾 Saved ${saved}/${listings.length} sold listings`);
    }
    
    generateMarketAnalysis(listings, card) {
        const prices = listings.map(l => l.total_cost);
        const gradedListings = listings.filter(l => l.grading_company);
        const rawListings = listings.filter(l => !l.grading_company);
        
        const gradedPrices = gradedListings.map(l => l.total_cost);
        const rawPrices = rawListings.map(l => l.total_cost);
        
        return {
            sample_size: listings.length,
            average_sold_price: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
            median_sold_price: this.calculateMedian(prices),
            min_sold_price: Math.min(...prices),
            max_sold_price: Math.max(...prices),
            graded_average: gradedPrices.length > 0 ? 
                Math.round((gradedPrices.reduce((a, b) => a + b, 0) / gradedPrices.length) * 100) / 100 : null,
            raw_average: rawPrices.length > 0 ? 
                Math.round((rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length) * 100) / 100 : null,
            graded_premium: gradedPrices.length > 0 && rawPrices.length > 0 ? 
                Math.round(((gradedPrices.reduce((a, b) => a + b, 0) / gradedPrices.length) - 
                (rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length)) * 100) / 100 : 0,
            market_velocity_days: Math.round((Math.random() * 5 + 1) * 10) / 10, // 1-6 days
            price_volatility: Math.round((Math.random() * 0.3 + 0.1) * 100) / 100, // 10-40%
            confidence_score: Math.floor(Math.random() * 20) + 80 // 80-100
        };
    }
    
    calculateMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? 
            sorted[mid] : 
            Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
    }
    
    async saveMarketAnalysis(analysis, cardId, cardName) {
        const insertStmt = this.ebayDB.prepare(`
            INSERT OR REPLACE INTO ebay_market_analysis (
                pokemon_tcg_id, card_name, sample_size, average_sold_price,
                median_sold_price, min_sold_price, max_sold_price,
                graded_average, raw_average, graded_premium, market_velocity_days,
                price_volatility, confidence_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run(
            cardId, cardName, analysis.sample_size, analysis.average_sold_price,
            analysis.median_sold_price, analysis.min_sold_price, analysis.max_sold_price,
            analysis.graded_average, analysis.raw_average, analysis.graded_premium,
            analysis.market_velocity_days, analysis.price_volatility, analysis.confidence_score
        );
    }
    
    showCollectionSummary() {
        console.log('📊 EBAY DEMO COLLECTION SUMMARY');
        console.log('================================\n');
        
        const totalListings = this.ebayDB.prepare('SELECT COUNT(*) as count FROM ebay_sold_listings').get();
        const totalAnalyses = this.ebayDB.prepare('SELECT COUNT(*) as count FROM ebay_market_analysis').get();
        const avgPrice = this.ebayDB.prepare('SELECT AVG(average_sold_price) as avg FROM ebay_market_analysis').get();
        const gradedPremium = this.ebayDB.prepare('SELECT AVG(graded_premium) as avg FROM ebay_market_analysis WHERE graded_premium > 0').get();
        
        console.log(`🃏 Pokemon cards processed: ${this.processedCards}`);
        console.log(`💰 Total sold listings: ${totalListings.count}`);
        console.log(`📈 Market analyses: ${totalAnalyses.count}`);
        console.log(`💵 Average card price: $${Math.round(avgPrice.avg * 100) / 100}`);
        console.log(`🏆 Average graded premium: +$${Math.round(gradedPremium.avg * 100) / 100}`);
        
        console.log('\n📋 SAMPLE DATA:');
        console.log('================');
        
        const sampleListings = this.ebayDB.prepare(`
            SELECT card_name, sold_price, condition_grade, sold_date 
            FROM ebay_sold_listings 
            ORDER BY sold_price DESC 
            LIMIT 5
        `).all();
        
        sampleListings.forEach(listing => {
            const date = new Date(listing.sold_date).toLocaleDateString();
            console.log(`• ${listing.card_name}: $${listing.sold_price} (${listing.condition_grade}) - ${date}`);
        });
        
        console.log('\n🎯 WHAT THIS DEMONSTRATES:');
        console.log('===========================');
        console.log('✅ eBay API integration architecture');
        console.log('✅ Sold listing data collection and storage');
        console.log('✅ Grading premium analysis (PSA, BGS, etc.)');
        console.log('✅ Market velocity and volatility tracking');
        console.log('✅ Confidence scoring for data quality');
        console.log('✅ Multi-condition pricing (graded vs raw)');
        console.log('✅ Database schema for production use');
        
        console.log('\n🚀 READY FOR PRODUCTION:');
        console.log('=========================');
        console.log('• Add eBay API credentials');
        console.log('• Replace demo data with real eBay API calls');
        console.log('• Deploy across all 19,500 Pokemon cards');
        console.log('• Integrate with unified pricing system');
        
        if (this.demoMode) {
            console.log('\n💡 TO ACTIVATE REAL EBAY DATA:');
            console.log('===============================');
            console.log('1. Get eBay Developer credentials');
            console.log('2. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET');
            console.log('3. Run: node secure-ebay-pokemon-collector.js');
        }
        
        console.log('\n✅ eBay demo collection complete!');
    }
}

// Run demo
if (require.main === module) {
    const collector = new EBayDemoCollector();
    collector.collectDemoData().catch(console.error);
}

module.exports = EBayDemoCollector;
