const https = require('https');
const fs = require('fs');
const Database = require('better-sqlite3');

// Safe Pokemon TCG API downloader without vulnerable dependencies
class SafePokemonTCGDownloader {
    constructor() {
        this.baseURL = 'https://api.pokemontcg.io/v2';
        this.db = new Database('pokemon_tcg_complete.db');
        this.setupDatabase();
        this.totalCards = 0;
        this.processedCards = 0;
    }

    setupDatabase() {
        console.log('🗃️  Setting up Pokemon TCG database...');
        
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
                ancientTrait TEXT,
                abilities TEXT,
                attacks TEXT,
                weaknesses TEXT,
                resistances TEXT,
                retreatCost TEXT,
                convertedRetreatCost INTEGER,
                set_id TEXT,
                set_name TEXT,
                set_series TEXT,
                set_printedTotal INTEGER,
                set_total INTEGER,
                set_releaseDate TEXT,
                number TEXT,
                artist TEXT,
                rarity TEXT,
                flavorText TEXT,
                nationalPokedexNumbers TEXT,
                legalities TEXT,
                images TEXT,
                tcgplayer TEXT,
                cardmarket TEXT,
                markets TEXT,
                extractedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_name ON pokemon_cards(name);
            CREATE INDEX IF NOT EXISTS idx_set_name ON pokemon_cards(set_name);
            CREATE INDEX IF NOT EXISTS idx_rarity ON pokemon_cards(rarity);
            CREATE INDEX IF NOT EXISTS idx_types ON pokemon_cards(types);
        `);
        
        console.log('✅ Database setup complete');
    }

    makeRequest(url) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'PokeDAO/1.0 (Research Project)'
                }
            }, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (error) {
                        reject(new Error(`JSON Parse Error: ${error.message}`));
                    }
                });
            });
            
            request.on('error', (error) => {
                reject(error);
            });
            
            request.setTimeout(10000, () => {
                request.abort();
                reject(new Error('Request timeout'));
            });
        });
    }

    async downloadAllCards() {
        console.log('🚀 Starting complete Pokemon TCG card download...');
        console.log('📊 Using official Pokemon TCG API v2');
        
        let page = 1;
        let totalPages = 1;
        let allCards = [];
        
        // Insert statement
        const insertCard = this.db.prepare(`
            INSERT OR REPLACE INTO pokemon_cards (
                id, name, supertype, subtypes, hp, types, evolvesFrom, evolvesTo,
                rules, ancientTrait, abilities, attacks, weaknesses, resistances,
                retreatCost, convertedRetreatCost, set_id, set_name, set_series,
                set_printedTotal, set_total, set_releaseDate, number, artist,
                rarity, flavorText, nationalPokedexNumbers, legalities, images,
                tcgplayer, cardmarket, markets, extractedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        while (page <= totalPages) {
            try {
                console.log(`📄 Downloading page ${page}/${totalPages}...`);
                
                const url = `${this.baseURL}/cards?page=${page}&pageSize=250`;
                const response = await this.makeRequest(url);
                
                if (page === 1) {
                    totalPages = Math.ceil(response.totalCount / 250);
                    this.totalCards = response.totalCount;
                    console.log(`🎯 Found ${this.totalCards} total Pokemon cards across ${totalPages} pages`);
                }
                
                const cards = response.data || [];
                console.log(`   ✅ Downloaded ${cards.length} cards from page ${page}`);
                
                // Process and save cards
                for (const card of cards) {
                    try {
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
                            JSON.stringify(card.ancientTrait || null),
                            JSON.stringify(card.abilities || []),
                            JSON.stringify(card.attacks || []),
                            JSON.stringify(card.weaknesses || []),
                            JSON.stringify(card.resistances || []),
                            JSON.stringify(card.retreatCost || []),
                            card.convertedRetreatCost,
                            card.set?.id,
                            card.set?.name,
                            card.set?.series,
                            card.set?.printedTotal,
                            card.set?.total,
                            card.set?.releaseDate,
                            card.number,
                            card.artist,
                            card.rarity,
                            card.flavorText,
                            JSON.stringify(card.nationalPokedexNumbers || []),
                            JSON.stringify(card.legalities || {}),
                            JSON.stringify(card.images || {}),
                            JSON.stringify(card.tcgplayer || {}),
                            JSON.stringify(card.cardmarket || {}),
                            JSON.stringify({
                                tcgplayer: card.tcgplayer,
                                cardmarket: card.cardmarket
                            }),
                            new Date().toISOString()
                        ];
                        
                        insertCard.run(cardData);
                        this.processedCards++;
                        
                    } catch (error) {
                        console.log(`   ⚠️  Error processing card ${card.id}: ${error.message}`);
                    }
                }
                
                // Progress update
                const progress = ((page / totalPages) * 100).toFixed(1);
                console.log(`   📊 Progress: ${progress}% (${this.processedCards}/${this.totalCards} cards)`);
                
                // Rate limiting - be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`   ❌ Error downloading page ${page}: ${error.message}`);
                console.log('   ⏳ Retrying in 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue; // Retry the same page
            }
            
            page++;
        }
        
        // Final statistics
        const finalCount = this.db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get().count;
        console.log(`\n🏁 DOWNLOAD COMPLETE!`);
        console.log(`📊 Total cards in database: ${finalCount}`);
        console.log(`💾 Database file: pokemon_tcg_complete.db`);
        
        // Show some sample data
        const sampleCards = this.db.prepare(`
            SELECT name, set_name, rarity, types 
            FROM pokemon_cards 
            ORDER BY RANDOM() 
            LIMIT 5
        `).all();
        
        console.log(`\n🎴 Sample cards:`);
        sampleCards.forEach(card => {
            const types = JSON.parse(card.types || '[]').join(', ');
            console.log(`   • ${card.name} (${card.set_name}) - ${card.rarity} [${types}]`);
        });
        
        this.db.close();
    }
}

// Start the download
const downloader = new SafePokemonTCGDownloader();
downloader.downloadAllCards().catch(console.error);
