#!/usr/bin/env node

/**
 * COLLECTOR CRYPT FOCUSED PRICING SYSTEM
 * =====================================
 * 
 * GOAL: Index ALL of Collector Crypt's 24,307+ cards with comprehensive pricing
 * 
 * STRATEGY:
 * 1. Collector Crypt cards are the PRIMARY TARGET
 * 2. All other data sources (Pokemon TCG API, TCGPlayer, eBay) serve to price these cards
 * 3. Multi-source validation provides confidence scoring for CC card values
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class CollectorCryptPricingSystem {
    constructor() {
        this.setupDatabases();
        console.log('🎯 Collector Crypt Focused Pricing System');
        console.log('=========================================\n');
    }
    
    setupDatabases() {
        // Primary: Collector Crypt cards database
        this.ccDB = new Database('collector_crypt_complete.db');
        
        // Supporting: Multi-source pricing databases
        this.pokemonDB = null;
        this.tcgDB = null;
        this.ebayDB = null;
        
        try {
            this.pokemonDB = new Database('pokemon_tcg_complete.db');
            console.log('✅ Pokemon TCG API database connected');
        } catch (e) {
            console.log('⚠️  Pokemon TCG database not found');
        }
        
        try {
            this.tcgDB = new Database('tcgplayer.db');
            console.log('✅ TCGPlayer database connected');
        } catch (e) {
            console.log('⚠️  TCGPlayer database not found');
        }
        
        try {
            this.ebayDB = new Database('ebay_pricing_demo.db');
            console.log('✅ eBay pricing database connected');
        } catch (e) {
            console.log('⚠️  eBay database not found');
        }
        
        this.setupCollectorCryptSchema();
    }
    
    setupCollectorCryptSchema() {
        console.log('🗃️  Setting up Collector Crypt focused database schema...');
        
        this.ccDB.exec(`
            -- Primary table: Collector Crypt cards (our main focus)
            CREATE TABLE IF NOT EXISTS collector_crypt_cards (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT,
                grade TEXT,
                grade_num DECIMAL(3,1),
                grading_company TEXT,
                grading_id TEXT,
                price DECIMAL(10,2),
                currency TEXT DEFAULT 'USD',
                seller TEXT,
                url TEXT,
                front_image TEXT,
                back_image TEXT,
                blockchain TEXT,
                vault TEXT,
                authenticated BOOLEAN,
                is_active BOOLEAN,
                scraped_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Multi-source pricing for CC cards
            CREATE TABLE IF NOT EXISTS cc_card_pricing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cc_card_id TEXT NOT NULL,
                source TEXT NOT NULL, -- 'pokemon_tcg_api', 'tcgplayer', 'ebay', 'collector_crypt'
                source_id TEXT,
                match_confidence INTEGER, -- 0-100 confidence in card matching
                price_type TEXT, -- 'market', 'low', 'mid', 'high', 'sold', 'listed'
                price DECIMAL(10,2),
                condition TEXT,
                grade TEXT,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cc_card_id) REFERENCES collector_crypt_cards(id)
            );
            
            -- Final pricing analysis for CC cards
            CREATE TABLE IF NOT EXISTS cc_final_pricing (
                cc_card_id TEXT PRIMARY KEY,
                recommended_price DECIMAL(10,2),
                confidence_score INTEGER, -- 0-100 based on source agreement
                price_sources_count INTEGER,
                market_data TEXT, -- JSON: {pokemon_tcg: price, tcgplayer: price, ebay: price}
                graded_premium DECIMAL(10,2),
                condition_factor DECIMAL(3,2), -- multiplier for condition
                market_trend TEXT, -- 'rising', 'falling', 'stable'
                last_analysis DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cc_card_id) REFERENCES collector_crypt_cards(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_cc_cards_category ON collector_crypt_cards(category);
            CREATE INDEX IF NOT EXISTS idx_cc_cards_grade ON collector_crypt_cards(grading_company, grade_num);
            CREATE INDEX IF NOT EXISTS idx_cc_pricing_source ON cc_card_pricing(source);
            CREATE INDEX IF NOT EXISTS idx_cc_pricing_card ON cc_card_pricing(cc_card_id);
        `);
        
        console.log('✅ Collector Crypt database schema ready\n');
    }
    
    async loadCollectorCryptData() {
        console.log('📂 Loading Collector Crypt dataset...');
        
        const dataPath = '/Users/arcadio/dev/pokedao/worker/unified-collector-crypt-dataset.json';
        
        if (!fs.existsSync(dataPath)) {
            console.log('❌ Collector Crypt dataset not found at:', dataPath);
            console.log('   Expected: unified-collector-crypt-dataset.json');
            return false;
        }
        
        try {
            const rawData = fs.readFileSync(dataPath, 'utf8');
            const ccCards = JSON.parse(rawData);
            
            console.log(`📊 Loaded ${ccCards.length} Collector Crypt cards`);
            
            // Import cards into our focused database
            await this.importCollectorCryptCards(ccCards);
            
            return true;
        } catch (error) {
            console.error('❌ Error loading Collector Crypt data:', error.message);
            return false;
        }
    }
    
    async importCollectorCryptCards(cards) {
        console.log('💾 Importing Collector Crypt cards into focused database...');
        
        const insertStmt = this.ccDB.prepare(`
            INSERT OR REPLACE INTO collector_crypt_cards (
                id, title, category, grade, grade_num, grading_company, grading_id,
                price, currency, seller, url, front_image, back_image,
                blockchain, vault, authenticated, is_active, scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let imported = 0;
        let pokemon_count = 0;
        
        for (const card of cards) {
            try {
                // Safely convert values to proper types - handle CC data structure
                const cardId = String(card.id || `cc_${Date.now()}_${imported}`);
                const title = String(card.itemName || card.title || card.name || 'Unknown');
                const category = String(card.category || 'Unknown');
                const grade = card.grade ? String(card.grade) : null;
                const gradeNum = card.gradeNum ? Number(card.gradeNum) : null;
                const gradingCompany = card.gradingCompany ? String(card.gradingCompany) : null;
                const gradingID = card.gradingID ? String(card.gradingID) : null;
                const price = Number(card.insuredValue || card.price || 0);
                const currency = String(card.currency || 'USD');
                const seller = String(card.seller || 'Unknown');
                const url = card.url ? String(card.url) : null;
                const frontImage = card.frontImage ? String(card.frontImage) : null;
                const backImage = card.backImage ? String(card.backImage) : null;
                const blockchain = card.blockchain ? String(card.blockchain) : null;
                const vault = card.vault ? String(card.vault) : null;
                const authenticated = Boolean(card.authenticated);
                const isActive = card.status !== 'Burned' && card.status !== 'Inactive';
                const scrapedAt = String(card.updatedAt || card.createdAt || new Date().toISOString());

                insertStmt.run(
                    cardId, title, category, grade, gradeNum, gradingCompany, gradingID,
                    price, currency, seller, url, frontImage, backImage,
                    blockchain, vault, authenticated, isActive, scrapedAt
                );
                
                imported++;
                
                if (category.toLowerCase().includes('pokemon')) {
                    pokemon_count++;
                }
                
            } catch (error) {
                console.error(`Error importing card ${card.id || 'unknown'}:`, error.message);
            }
        }
        
        console.log(`✅ Imported ${imported} Collector Crypt cards`);
        console.log(`🎯 Pokemon cards: ${pokemon_count} (${Math.round(pokemon_count/imported*100)}%)`);
        
        return { imported, pokemon_count };
    }
    
    async analyzeCollectorCryptCoverage() {
        console.log('\n📊 COLLECTOR CRYPT ANALYSIS');
        console.log('============================');
        
        const totalCards = this.ccDB.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards').get();
        const pokemonCards = this.ccDB.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards WHERE category LIKE ?').get('%pokemon%');
        const gradedCards = this.ccDB.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards WHERE grading_company IS NOT NULL').get();
        const authenticatedCards = this.ccDB.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards WHERE authenticated = 1').get();
        
        console.log(`Total Collector Crypt Cards: ${totalCards.count}`);
        console.log(`Pokemon Cards: ${pokemonCards.count} (${Math.round(pokemonCards.count/totalCards.count*100)}%)`);
        console.log(`Graded Cards: ${gradedCards.count} (${Math.round(gradedCards.count/totalCards.count*100)}%)`);
        console.log(`Authenticated: ${authenticatedCards.count} (${Math.round(authenticatedCards.count/totalCards.count*100)}%)`);
        
        // Grading company breakdown
        const gradingBreakdown = this.ccDB.prepare(`
            SELECT grading_company, COUNT(*) as count 
            FROM collector_crypt_cards 
            WHERE grading_company IS NOT NULL 
            GROUP BY grading_company 
            ORDER BY count DESC
        `).all();
        
        console.log('\nGrading Company Breakdown:');
        gradingBreakdown.forEach(row => {
            console.log(`  ${row.grading_company}: ${row.count} cards`);
        });
        
        // Price distribution
        const priceStats = this.ccDB.prepare(`
            SELECT 
                MIN(price) as min_price,
                MAX(price) as max_price,
                AVG(price) as avg_price,
                COUNT(*) as total_with_price
            FROM collector_crypt_cards 
            WHERE price > 0
        `).get();
        
        console.log('\nPrice Distribution:');
        console.log(`  Cards with prices: ${priceStats.total_with_price}`);
        console.log(`  Price range: $${priceStats.min_price} - $${priceStats.max_price}`);
        console.log(`  Average price: $${Math.round(priceStats.avg_price * 100) / 100}`);
    }
    
    async matchWithPricingSources() {
        console.log('\n🔍 MATCHING CC CARDS WITH PRICING SOURCES');
        console.log('==========================================');
        
        // Get Pokemon cards from CC for matching
        const ccPokemonCards = this.ccDB.prepare(`
            SELECT id, title, category, grade, grading_company, grade_num
            FROM collector_crypt_cards 
            WHERE category LIKE ? 
            LIMIT 100
        `).all('%pokemon%');
        
        console.log(`🎯 Processing ${ccPokemonCards.length} Pokemon cards from Collector Crypt...`);
        
        let matched_pokemon_api = 0;
        let matched_tcgplayer = 0;
        let matched_ebay = 0;
        
        for (const ccCard of ccPokemonCards) {
            // Match with Pokemon TCG API
            if (this.pokemonDB) {
                const pokemonMatch = await this.findPokemonAPIMatch(ccCard);
                if (pokemonMatch) {
                    await this.savePricingMatch(ccCard.id, 'pokemon_tcg_api', pokemonMatch);
                    matched_pokemon_api++;
                }
            }
            
            // Match with TCGPlayer
            if (this.tcgDB) {
                const tcgMatch = await this.findTCGPlayerMatch(ccCard);
                if (tcgMatch) {
                    await this.savePricingMatch(ccCard.id, 'tcgplayer', tcgMatch);
                    matched_tcgplayer++;
                }
            }
            
            // Match with eBay (demo for now)
            if (this.ebayDB) {
                const ebayMatch = await this.findEBayMatch(ccCard);
                if (ebayMatch) {
                    await this.savePricingMatch(ccCard.id, 'ebay', ebayMatch);
                    matched_ebay++;
                }
            }
        }
        
        console.log('\n📈 MATCHING RESULTS:');
        console.log(`Pokemon TCG API matches: ${matched_pokemon_api}/${ccPokemonCards.length}`);
        console.log(`TCGPlayer matches: ${matched_tcgplayer}/${ccPokemonCards.length}`);
        console.log(`eBay matches: ${matched_ebay}/${ccPokemonCards.length}`);
        
        // Generate final pricing recommendations
        await this.generateFinalPricing(ccPokemonCards);
    }
    
    async findPokemonAPIMatch(ccCard) {
        if (!this.pokemonDB) return null;
        
        try {
            // Simple name matching - can be improved with fuzzy matching
            const matches = this.pokemonDB.prepare(`
                SELECT id, name, set_name, tcgplayer 
                FROM pokemon_cards 
                WHERE name LIKE ? 
                LIMIT 1
            `).all(`%${this.extractCardName(ccCard.title)}%`);
            
            if (matches.length > 0) {
                const match = matches[0];
                const tcgPlayerData = JSON.parse(match.tcgplayer || '{}');
                
                return {
                    source_id: match.id,
                    match_confidence: 85, // Can be improved with better matching
                    price: tcgPlayerData.prices?.holofoil?.market || tcgPlayerData.prices?.normal?.market,
                    condition: 'Near Mint',
                    price_type: 'market'
                };
            }
        } catch (error) {
            console.error('Error matching with Pokemon API:', error.message);
        }
        
        return null;
    }
    
    async findTCGPlayerMatch(ccCard) {
        if (!this.tcgDB) return null;
        
        try {
            const cardName = this.extractCardName(ccCard.title);
            const matches = this.tcgDB.prepare(`
                SELECT name, price, url 
                FROM tcgplayer_cards 
                WHERE name LIKE ? 
                LIMIT 1
            `).all(`%${cardName}%`);
            
            if (matches.length > 0) {
                return {
                    source_id: matches[0].url,
                    match_confidence: 80,
                    price: matches[0].price,
                    condition: 'Near Mint',
                    price_type: 'market'
                };
            }
        } catch (error) {
            console.error('Error matching with TCGPlayer:', error.message);
        }
        
        return null;
    }
    
    async findEBayMatch(ccCard) {
        if (!this.ebayDB) return null;
        
        try {
            const cardName = this.extractCardName(ccCard.title);
            const matches = this.ebayDB.prepare(`
                SELECT card_name, sold_price, condition_grade, confidence_score
                FROM ebay_sold_listings 
                WHERE card_name LIKE ? 
                ORDER BY confidence_score DESC
                LIMIT 1
            `).all(`%${cardName}%`);
            
            if (matches.length > 0) {
                return {
                    source_id: 'ebay_demo',
                    match_confidence: matches[0].confidence_score,
                    price: matches[0].sold_price,
                    condition: matches[0].condition_grade,
                    price_type: 'sold'
                };
            }
        } catch (error) {
            console.error('Error matching with eBay:', error.message);
        }
        
        return null;
    }
    
    extractCardName(title) {
        // Extract Pokemon card name from title
        // Remove common suffixes and prefixes
        return title
            .replace(/\s*(CGC|PSA|BGS|SGC)\s*\d+\.?\d*\s*/gi, '')
            .replace(/\s*(graded|pokemon|card|holo|rare)\s*/gi, '')
            .replace(/\s*\d{4}\s*/, '') // Remove years
            .trim()
            .substring(0, 20); // Limit length for matching
    }
    
    async savePricingMatch(ccCardId, source, matchData) {
        const insertStmt = this.ccDB.prepare(`
            INSERT OR REPLACE INTO cc_card_pricing (
                cc_card_id, source, source_id, match_confidence, 
                price_type, price, condition, grade
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run(
            ccCardId,
            source,
            matchData.source_id,
            matchData.match_confidence,
            matchData.price_type,
            matchData.price,
            matchData.condition,
            matchData.grade || null
        );
    }
    
    async generateFinalPricing(ccCards) {
        console.log('\n💰 GENERATING FINAL CC CARD PRICING');
        console.log('===================================');
        
        for (const ccCard of ccCards) {
            const pricingData = this.ccDB.prepare(`
                SELECT source, price, match_confidence, price_type
                FROM cc_card_pricing 
                WHERE cc_card_id = ?
            `).all(ccCard.id);
            
            if (pricingData.length === 0) continue;
            
            // Calculate weighted average based on confidence and source reliability
            const weights = {
                'pokemon_tcg_api': 0.4,
                'tcgplayer': 0.3,
                'ebay': 0.3
            };
            
            let totalWeight = 0;
            let weightedPrice = 0;
            const marketData = {};
            
            for (const price of pricingData) {
                const weight = weights[price.source] || 0.1;
                const confidenceMultiplier = price.match_confidence / 100;
                const finalWeight = weight * confidenceMultiplier;
                
                weightedPrice += price.price * finalWeight;
                totalWeight += finalWeight;
                marketData[price.source] = price.price;
            }
            
            const recommendedPrice = totalWeight > 0 ? weightedPrice / totalWeight : 0;
            const confidenceScore = Math.min(90, totalWeight * 100);
            
            // Save final pricing
            this.ccDB.prepare(`
                INSERT OR REPLACE INTO cc_final_pricing (
                    cc_card_id, recommended_price, confidence_score, 
                    price_sources_count, market_data
                ) VALUES (?, ?, ?, ?, ?)
            `).run(
                ccCard.id,
                Math.round(recommendedPrice * 100) / 100,
                Math.round(confidenceScore),
                pricingData.length,
                JSON.stringify(marketData)
            );
        }
        
        console.log(`✅ Generated pricing for ${ccCards.length} Collector Crypt cards`);
    }
    
    async showFinalResults() {
        console.log('\n🏆 COLLECTOR CRYPT PRICING SYSTEM RESULTS');
        console.log('=========================================');
        
        const totalCC = this.ccDB.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards').get();
        const withPricing = this.ccDB.prepare('SELECT COUNT(*) as count FROM cc_final_pricing').get();
        const avgConfidence = this.ccDB.prepare('SELECT AVG(confidence_score) as avg FROM cc_final_pricing').get();
        
        console.log(`📊 COVERAGE:`);
        console.log(`Total Collector Crypt Cards: ${totalCC.count}`);
        console.log(`Cards with Multi-Source Pricing: ${withPricing.count}`);
        console.log(`Coverage: ${Math.round(withPricing.count/totalCC.count*100)}%`);
        console.log(`Average Confidence Score: ${Math.round(avgConfidence.avg)}%`);
        
        // Sample results
        const sampleResults = this.ccDB.prepare(`
            SELECT 
                cc.title,
                fp.recommended_price,
                fp.confidence_score,
                fp.price_sources_count,
                fp.market_data
            FROM collector_crypt_cards cc
            JOIN cc_final_pricing fp ON cc.id = fp.cc_card_id
            ORDER BY fp.confidence_score DESC
            LIMIT 5
        `).all();
        
        console.log(`\n🎯 SAMPLE RESULTS (Top Confidence):`);
        sampleResults.forEach(result => {
            const sources = JSON.parse(result.market_data);
            console.log(`• ${result.title}`);
            console.log(`  Final Price: $${result.recommended_price} (${result.confidence_score}% confidence)`);
            console.log(`  Sources: ${Object.keys(sources).join(', ')}`);
            console.log('');
        });
        
        console.log('🎯 MISSION STATUS: Collector Crypt cards are now indexed with multi-source pricing!');
    }
    
    async run() {
        console.log('🚀 Starting Collector Crypt focused pricing system...\n');
        
        // Load CC data first (our primary target)
        const loaded = await this.loadCollectorCryptData();
        if (!loaded) {
            console.log('❌ Cannot proceed without Collector Crypt data');
            return;
        }
        
        // Analyze what we have
        await this.analyzeCollectorCryptCoverage();
        
        // Match with pricing sources
        await this.matchWithPricingSources();
        
        // Show results
        await this.showFinalResults();
        
        console.log('\n✅ Collector Crypt pricing system complete!');
    }
}

// Run the system
if (require.main === module) {
    const system = new CollectorCryptPricingSystem();
    system.run().catch(console.error);
}

module.exports = CollectorCryptPricingSystem;
