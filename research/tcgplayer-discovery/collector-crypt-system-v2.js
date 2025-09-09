const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

class CollectorCryptFocusedSystemV2 {
    constructor() {
        this.ccDB = null;
    }

    initDatabase() {
        const dbPath = path.join(__dirname, 'collector_crypt_v2.db');
        this.ccDB = new Database(dbPath);
        
        // Create table with proper schema
        this.ccDB.exec(`
            CREATE TABLE IF NOT EXISTS collector_crypt_cards (
                id TEXT PRIMARY KEY,
                title TEXT,
                category TEXT,
                grade TEXT,
                grade_num REAL,
                grading_company TEXT,
                grading_id TEXT,
                price REAL DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                seller TEXT,
                url TEXT,
                front_image TEXT,
                back_image TEXT,
                blockchain TEXT,
                vault TEXT,
                authenticated INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                scraped_at TEXT,
                year INTEGER,
                set_name TEXT,
                serial TEXT,
                nft_address TEXT,
                status TEXT,
                raw_data TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_category ON collector_crypt_cards(category);
            CREATE INDEX IF NOT EXISTS idx_price ON collector_crypt_cards(price);
            CREATE INDEX IF NOT EXISTS idx_graded ON collector_crypt_cards(grading_company);
            CREATE INDEX IF NOT EXISTS idx_pokemon ON collector_crypt_cards(category) WHERE category LIKE '%pokemon%';
        `);
        
        console.log('✅ Database initialized');
    }

    safeString(value) {
        if (value === null || value === undefined) return '';
        return String(value);
    }

    safeNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        const num = Number(value);
        return isNaN(num) ? 0 : num;
    }

    safeInteger(value) {
        return value ? 1 : 0;
    }

    async importCollectorCryptCards(cards) {
        console.log('💾 Importing Collector Crypt cards into focused database...');
        
        const insertStmt = this.ccDB.prepare(`
            INSERT OR REPLACE INTO collector_crypt_cards (
                id, title, category, grade, grade_num, grading_company, grading_id,
                price, currency, seller, url, front_image, back_image,
                blockchain, vault, authenticated, is_active, scraped_at,
                year, set_name, serial, nft_address, status, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let imported = 0;
        let pokemon_count = 0;
        let error_count = 0;
        
        for (const card of cards) {
            try {
                // Carefully extract and convert each field
                const cardId = this.safeString(card.id || `cc_${Date.now()}_${imported}`);
                const title = this.safeString(card.itemName || card.title || card.name);
                const category = this.safeString(card.category);
                const grade = card.grade ? this.safeString(card.grade) : null;
                const gradeNum = this.safeNumber(card.gradeNum);
                const gradingCompany = card.gradingCompany ? this.safeString(card.gradingCompany) : null;
                const gradingID = card.gradingID ? this.safeString(card.gradingID) : null;
                const price = this.safeNumber(card.insuredValue || card.price);
                const currency = this.safeString(card.currency || 'USD');
                const seller = this.safeString(card.seller || 'Collector Crypt');
                const url = card.url ? this.safeString(card.url) : null;
                const frontImage = card.frontImage ? this.safeString(card.frontImage) : null;
                const backImage = card.backImage ? this.safeString(card.backImage) : null;
                const blockchain = card.blockchain ? this.safeString(card.blockchain) : null;
                const vault = card.vault ? this.safeString(card.vault) : null;
                const authenticated = this.safeInteger(card.authenticated);
                const isActive = this.safeInteger(card.status !== 'Burned' && card.status !== 'Inactive');
                const scrapedAt = this.safeString(card.updatedAt || card.createdAt || new Date().toISOString());
                const year = this.safeNumber(card.year);
                const setName = card.set ? this.safeString(card.set) : null;
                const serial = card.serial ? this.safeString(card.serial) : null;
                const nftAddress = card.nftAddress ? this.safeString(card.nftAddress) : null;
                const status = this.safeString(card.status);
                const rawData = JSON.stringify(card);

                insertStmt.run(
                    cardId, title, category, grade, gradeNum, gradingCompany, gradingID,
                    price, currency, seller, url, frontImage, backImage,
                    blockchain, vault, authenticated, isActive, scrapedAt,
                    year, setName, serial, nftAddress, status, rawData
                );
                
                imported++;
                
                if (category.toLowerCase().includes('pokemon')) {
                    pokemon_count++;
                }
                
            } catch (error) {
                error_count++;
                if (error_count <= 5) { // Only log first 5 errors to avoid spam
                    console.error(`Error importing card ${card.id || 'unknown'}:`, error.message);
                }
            }
        }
        
        console.log(`✅ Imported ${imported} Collector Crypt cards`);
        console.log(`🎯 Pokemon cards: ${pokemon_count} (${Math.round(pokemon_count/imported*100 || 0)}%)`);
        if (error_count > 0) {
            console.log(`⚠️  ${error_count} cards failed to import`);
        }
        
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
        console.log(`Pokemon Cards: ${pokemonCards.count} (${Math.round(pokemonCards.count/(totalCards.count || 1)*100)}%)`);
        console.log(`Graded Cards: ${gradedCards.count} (${Math.round(gradedCards.count/(totalCards.count || 1)*100)}%)`);
        console.log(`Authenticated: ${authenticatedCards.count} (${Math.round(authenticatedCards.count/(totalCards.count || 1)*100)}%)`);
        
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
        console.log(`  Price range: $${priceStats.min_price || 0} - $${priceStats.max_price || 0}`);
        console.log(`  Average price: $${Math.round(priceStats.avg_price || 0)}`);
        
        return {
            total: totalCards.count,
            pokemon: pokemonCards.count,
            graded: gradedCards.count,
            authenticated: authenticatedCards.count
        };
    }

    async run() {
        try {
            console.log('🚀 COLLECTOR CRYPT FOCUSED SYSTEM V2');
            console.log('===================================');
            
            // Initialize database
            this.initDatabase();
            
            // Load Collector Crypt data
            console.log('📋 Loading Collector Crypt dataset...');
            const ccData = JSON.parse(fs.readFileSync('/Users/arcadio/dev/pokedao/worker/unified-collector-crypt-dataset.json', 'utf8'));
            console.log(`📊 Found ${ccData.length} Collector Crypt cards`);
            
            // Import cards
            const importResult = await this.importCollectorCryptCards(ccData);
            
            // Analyze coverage
            const analysisResult = await this.analyzeCollectorCryptCoverage();
            
            console.log(`\n🏆 COLLECTOR CRYPT SYSTEM V2 RESULTS`);
            console.log(`====================================`);
            console.log(`📊 Successfully imported ${importResult.imported} cards`);
            console.log(`🎯 Pokemon cards: ${importResult.pokemon_count}`);
            console.log(`✅ Collector Crypt cards are now properly indexed!`);
            
        } catch (error) {
            console.error('❌ System error:', error);
        } finally {
            if (this.ccDB) {
                this.ccDB.close();
            }
        }
    }
}

// Run the system
const system = new CollectorCryptFocusedSystemV2();
system.run().catch(console.error);
