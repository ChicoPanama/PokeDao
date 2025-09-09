const https = require('https');
const Database = require('better-sqlite3');

// Safe Pokemon TCG API client following SDK patterns but without vulnerabilities
class SafePokemonTCGClient {
    constructor(apiKey = null) {
        this.baseURL = 'https://api.pokemontcg.io/v2';
        this.apiKey = apiKey;
        this.headers = {
            'User-Agent': 'PokeDAO/1.0 (Research Project)',
            'Accept': 'application/json'
        };
        
        if (this.apiKey) {
            this.headers['X-Api-Key'] = this.apiKey;
        }
    }

    // Make safe HTTPS requests without vulnerable dependencies
    makeRequest(endpoint, params = {}) {
        return new Promise((resolve, reject) => {
            const queryString = new URLSearchParams(params).toString();
            const url = `${this.baseURL}${endpoint}${queryString ? '?' + queryString : ''}`;
            
            const request = https.get(url, { headers: this.headers }, (response) => {
                let data = '';
                
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error(`JSON Parse Error: ${error.message}`));
                    }
                });
            });
            
            request.on('error', reject);
            request.setTimeout(15000, () => {
                request.abort();
                reject(new Error('Request timeout'));
            });
        });
    }

    // Get all cards with pagination (following SDK pattern)
    async getAllCards(params = {}) {
        const defaultParams = {
            page: 1,
            pageSize: 250,
            ...params
        };
        
        return this.makeRequest('/cards', defaultParams);
    }

    // Get all sets (following SDK pattern)
    async getAllSets() {
        return this.makeRequest('/sets');
    }

    // Search cards by query (following SDK pattern)
    async searchCards(query, params = {}) {
        const searchParams = {
            q: query,
            pageSize: 250,
            ...params
        };
        
        return this.makeRequest('/cards', searchParams);
    }

    // Get card by ID (following SDK pattern)
    async getCardById(id) {
        return this.makeRequest(`/cards/${id}`);
    }
}

// Complete data collection using SDK patterns
class CompletePokemonTCGCollector {
    constructor() {
        this.client = new SafePokemonTCGClient();
        this.db = new Database('complete_pokemon_tcg_sdk_style.db');
        this.setupDatabase();
        this.totalCards = 0;
        this.processedCards = 0;
    }

    setupDatabase() {
        console.log('🗃️  Setting up complete Pokemon TCG database (SDK style)...');
        
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pokemon_cards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                supertype TEXT,
                subtypes TEXT,
                hp TEXT,
                types TEXT,
                evolvesFrom TEXT,
                evolvesTo TEXT,
                rules TEXT,
                abilities TEXT,
                attacks TEXT,
                weaknesses TEXT,
                resistances TEXT,
                retreatCost TEXT,
                convertedRetreatCost INTEGER,
                set_id TEXT,
                set_name TEXT,
                set_series TEXT,
                set_total INTEGER,
                set_releaseDate TEXT,
                number TEXT,
                artist TEXT,
                rarity TEXT,
                flavorText TEXT,
                nationalPokedexNumbers TEXT,
                legalities TEXT,
                images TEXT,
                tcgplayer_prices TEXT,
                cardmarket_prices TEXT,
                tcgplayer_url TEXT,
                cardmarket_url TEXT,
                extractedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_name ON pokemon_cards(name);
            CREATE INDEX IF NOT EXISTS idx_set_name ON pokemon_cards(set_name);
            CREATE INDEX IF NOT EXISTS idx_rarity ON pokemon_cards(rarity);
        `);
        
        console.log('✅ Database setup complete');
    }

    async collectAllData() {
        console.log('🚀 Starting complete Pokemon TCG collection (SDK style)...');
        console.log('📊 Using safe Pokemon TCG API v2 without vulnerabilities');
        
        // Get total count first
        const firstPage = await this.client.getAllCards({ page: 1, pageSize: 1 });
        this.totalCards = firstPage.totalCount;
        const totalPages = Math.ceil(this.totalCards / 250);
        
        console.log(`🎯 Found ${this.totalCards} total Pokemon cards across ${totalPages} pages`);
        
        const insertCard = this.db.prepare(`
            INSERT OR REPLACE INTO pokemon_cards (
                id, name, supertype, subtypes, hp, types, evolvesFrom, evolvesTo,
                rules, abilities, attacks, weaknesses, resistances, retreatCost,
                convertedRetreatCost, set_id, set_name, set_series, set_total,
                set_releaseDate, number, artist, rarity, flavorText,
                nationalPokedexNumbers, legalities, images, tcgplayer_prices,
                cardmarket_prices, tcgplayer_url, cardmarket_url, extractedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Collect all pages
        for (let page = 1; page <= totalPages; page++) {
            try {
                console.log(`📄 Collecting page ${page}/${totalPages}...`);
                
                const response = await this.client.getAllCards({ page, pageSize: 250 });
                const cards = response.data || [];
                
                console.log(`   ✅ Retrieved ${cards.length} cards from page ${page}`);
                
                // Process each card following SDK data structure
                for (const card of cards) {
                    try {
                        // Extract pricing data safely
                        const tcgplayerPrices = card.tcgplayer?.prices ? JSON.stringify(card.tcgplayer.prices) : null;
                        const cardmarketPrices = card.cardmarket?.prices ? JSON.stringify(card.cardmarket.prices) : null;
                        const tcgplayerUrl = card.tcgplayer?.url || null;
                        const cardmarketUrl = card.cardmarket?.url || null;
                        
                        const cardData = [
                            card.id,
                            card.name,
                            card.supertype,
                            JSON.stringify(card.subtypes || []),
                            card.hp,
                            JSON.stringify(card.types || []),
                            card.evolvesFrom,
                            JSON.stringify(card.evolvesTo || []),
                            JSON.stringify(card.rules || []),
                            JSON.stringify(card.abilities || []),
                            JSON.stringify(card.attacks || []),
                            JSON.stringify(card.weaknesses || []),
                            JSON.stringify(card.resistances || []),
                            JSON.stringify(card.retreatCost || []),
                            card.convertedRetreatCost,
                            card.set?.id,
                            card.set?.name,
                            card.set?.series,
                            card.set?.total,
                            card.set?.releaseDate,
                            card.number,
                            card.artist,
                            card.rarity,
                            card.flavorText,
                            JSON.stringify(card.nationalPokedexNumbers || []),
                            JSON.stringify(card.legalities || {}),
                            JSON.stringify(card.images || {}),
                            tcgplayerPrices,
                            cardmarketPrices,
                            tcgplayerUrl,
                            cardmarketUrl,
                            new Date().toISOString()
                        ];
                        
                        insertCard.run(cardData);
                        this.processedCards++;
                        
                    } catch (error) {
                        console.log(`   ⚠️  Error processing card ${card.id}: ${error.message}`);
                    }
                }
                
                const progress = ((page / totalPages) * 100).toFixed(1);
                console.log(`   📊 Progress: ${progress}% (${this.processedCards}/${this.totalCards} cards)`);
                
                // Respectful rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`   ❌ Error on page ${page}: ${error.message}`);
                console.log('   ⏳ Retrying in 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                page--; // Retry the same page
            }
        }
        
        // Generate comprehensive statistics
        const finalCount = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get().count;
        const withTCGPrices = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_cards WHERE tcgplayer_prices IS NOT NULL').get().count;
        const withCardMarketPrices = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_cards WHERE cardmarket_prices IS NOT NULL').get().count;
        
        console.log(`\n🏁 COMPLETE COLLECTION FINISHED!`);
        console.log(`📊 Total cards collected: ${finalCount}`);
        console.log(`💰 Cards with TCGPlayer pricing: ${withTCGPrices}`);
        console.log(`💰 Cards with CardMarket pricing: ${withCardMarketPrices}`);
        console.log(`💾 Database: complete_pokemon_tcg_sdk_style.db`);
        
        // Show pricing examples
        const pricedCards = this.db.prepare(`
            SELECT name, set_name, tcgplayer_prices, cardmarket_prices 
            FROM pokemon_cards 
            WHERE tcgplayer_prices IS NOT NULL 
            ORDER BY RANDOM() 
            LIMIT 3
        `).all();
        
        console.log(`\n💰 Sample pricing data:`);
        pricedCards.forEach(card => {
            console.log(`   • ${card.name} (${card.set_name})`);
            if (card.tcgplayer_prices) {
                const prices = JSON.parse(card.tcgplayer_prices);
                console.log(`     TCGPlayer: ${JSON.stringify(prices, null, 2).slice(0, 100)}...`);
            }
        });
        
        this.db.close();
        console.log(`\n✅ Collection complete! Database ready for analysis.`);
    }
}

// Start the complete collection
console.log('🚀 Starting Pokemon TCG collection using safe SDK-style approach...');
const collector = new CompletePokemonTCGCollector();
collector.collectAllData().catch(console.error);
