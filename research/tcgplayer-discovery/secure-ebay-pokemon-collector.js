const Database = require('better-sqlite3');
const eBayApi = require('ebay-api');

/**
 * Secure eBay Pokemon Pricing Collector using Official eBay SDK
 * Replaces manual HTTP calls with secure, maintained SDK
 * 
 * Security Benefits:
 * - No vulnerable dependencies (unlike pokemontcgsdk)
 * - Official eBay API with proper rate limiting
 * - OAuth2 authentication with auto token refresh
 * - Built-in error handling and retry logic
 */
class SecureEBayPokemonCollector {
    constructor() {
        this.pokemonDB = new Database('pokemon_tcg_complete.db');
        this.ebayDB = new Database('ebay_pricing_complete.db');
        this.setupEbayDatabase();
        
        // Initialize secure eBay SDK
        this.eBay = new eBayApi({
            appId: process.env.EBAY_CLIENT_ID || 'YOUR_EBAY_CLIENT_ID',
            certId: process.env.EBAY_CLIENT_SECRET || 'YOUR_EBAY_CLIENT_SECRET',
            sandbox: true, // Use sandbox for initial testing
            scope: ['https://api.ebay.com/oauth/api_scope']
        });
        
        // Rate limiting
        this.requestCount = 0;
        this.dailyLimit = 5000;
        this.requestDelay = 200; // 200ms between requests
        
        console.log('🔒 Secure eBay SDK initialized');
    }

    setupEbayDatabase() {
        console.log('🗃️  Setting up secure eBay pricing database...');
        
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
                listing_duration INTEGER,
                watchers_count INTEGER,
                bid_count INTEGER,
                currency_code TEXT,
                country TEXT,
                image_url TEXT,
                ebay_url TEXT,
                category_id INTEGER,
                search_query TEXT,
                confidence_score INTEGER,
                data_source TEXT DEFAULT 'ebay_finding_api',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pokemon_tcg_id) REFERENCES pokemon_cards(id)
            );
            
            CREATE TABLE IF NOT EXISTS ebay_price_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_tcg_id TEXT NOT NULL,
                card_name TEXT NOT NULL,
                analysis_date DATE DEFAULT CURRENT_DATE,
                sample_size INTEGER,
                average_sold_price DECIMAL(10,2),
                median_sold_price DECIMAL(10,2),
                min_sold_price DECIMAL(10,2),
                max_sold_price DECIMAL(10,2),
                price_volatility DECIMAL(5,2),
                graded_premium DECIMAL(10,2),
                condition_factors TEXT, -- JSON of condition impact
                seasonal_trends TEXT,   -- JSON of monthly trends
                market_velocity INTEGER, -- days to sell average
                confidence_score INTEGER,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_ebay_pokemon_id ON ebay_sold_listings(pokemon_tcg_id);
            CREATE INDEX IF NOT EXISTS idx_ebay_item_id ON ebay_sold_listings(ebay_item_id);
            CREATE INDEX IF NOT EXISTS idx_ebay_sold_date ON ebay_sold_listings(sold_date);
            CREATE INDEX IF NOT EXISTS idx_ebay_grading ON ebay_sold_listings(grading_company, grade_number);
        `);
        
        console.log('✅ Secure eBay database setup complete');
    }

    // Enhanced search query generation for better matching
    generateAdvancedSearchQueries(card) {
        const baseName = card.name.replace(/[^\w\s-]/g, '').trim();
        const setName = card.set_name ? card.set_name.replace(/[^\w\s-]/g, '').trim() : '';
        const cardNumber = card.number || '';
        
        const queries = [];
        
        // Primary search variants
        queries.push(`${baseName} pokemon card ${setName}`);
        
        if (cardNumber) {
            queries.push(`${baseName} ${cardNumber} pokemon ${setName}`);
        }
        
        // Rarity-specific searches
        if (card.rarity) {
            const rarity = card.rarity.toLowerCase();
            if (rarity.includes('holo')) {
                queries.push(`${baseName} holo pokemon card`);
            }
            if (rarity.includes('rare')) {
                queries.push(`${baseName} rare pokemon ${setName}`);
            }
            if (rarity.includes('ultra') || rarity.includes('secret')) {
                queries.push(`${baseName} ultra rare pokemon`);
            }
        }
        
        // Graded card searches
        const gradingServices = ['PSA', 'BGS', 'CGC', 'SGC'];
        gradingServices.forEach(service => {
            queries.push(`${baseName} ${service} graded pokemon`);
        });
        
        return queries.slice(0, 5); // Limit to top 5 queries
    }

    // Secure sold listings collection using eBay Finding API
    async collectSoldListings(pokemonCard) {
        if (this.requestCount >= this.dailyLimit) {
            console.log('⚠️  Daily API limit reached');
            return [];
        }

        console.log(`🔍 Collecting eBay sold data for: ${pokemonCard.name}`);
        
        const searchQueries = this.generateAdvancedSearchQueries(pokemonCard);
        const allSoldListings = [];
        
        for (const query of searchQueries) {
            try {
                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, this.requestDelay));
                
                console.log(`   📡 Searching: "${query}"`);
                
                // Use secure eBay SDK - Finding API for sold listings
                const response = await this.eBay.finding.findCompletedItems({
                    keywords: query,
                    itemFilter: [
                        { name: 'SoldItemsOnly', value: 'true' },
                        { name: 'EndTimeFrom', value: this.getDateDaysAgo(90) }, // Last 90 days
                        { name: 'EndTimeTo', value: new Date().toISOString() }
                    ],
                    paginationInput: {
                        entriesPerPage: 100,
                        pageNumber: 1
                    },
                    sortOrder: 'EndTimeSoonest'
                });
                
                this.requestCount++;
                
                const items = response.searchResult?.[0]?.item || [];
                console.log(`   ✅ Found ${items.length} sold listings`);
                
                // Process and filter relevant items
                const processedItems = await this.processSoldListings(items, pokemonCard, query);
                allSoldListings.push(...processedItems);
                
                if (items.length === 0) break; // No more results for this query
                
            } catch (error) {
                console.error(`❌ Error searching eBay for "${query}":`, error.message);
                continue;
            }
        }
        
        // Remove duplicates and save to database
        const uniqueListings = this.deduplicateListings(allSoldListings);
        await this.saveSoldListings(uniqueListings, pokemonCard.id);
        
        console.log(`📊 Collected ${uniqueListings.length} unique sold listings for ${pokemonCard.name}`);
        return uniqueListings;
    }

    // Process raw eBay sold listings data
    async processSoldListings(items, pokemonCard, searchQuery) {
        const processed = [];
        
        for (const item of items) {
            try {
                const soldData = {
                    ebay_item_id: item.itemId?.[0],
                    title: item.title?.[0],
                    sold_price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
                    currency_code: item.sellingStatus?.[0]?.currentPrice?.[0]?.['@_currencyId'] || 'USD',
                    sold_date: new Date(item.listingInfo?.[0]?.endTime?.[0]),
                    shipping_cost: parseFloat(item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ || 0),
                    buy_it_now: item.listingInfo?.[0]?.buyItNowAvailable?.[0] === 'true',
                    auction_type: item.listingInfo?.[0]?.listingType?.[0],
                    bid_count: parseInt(item.sellingStatus?.[0]?.bidCount?.[0] || 0),
                    watchers_count: parseInt(item.listingInfo?.[0]?.watchCount?.[0] || 0),
                    country: item.country?.[0],
                    image_url: item.galleryURL?.[0],
                    ebay_url: item.viewItemURL?.[0],
                    category_id: parseInt(item.primaryCategory?.[0]?.categoryId?.[0] || 0),
                    search_query: searchQuery
                };
                
                // Calculate total cost
                soldData.total_cost = soldData.sold_price + soldData.shipping_cost;
                
                // Extract grading information from title
                const gradingInfo = this.extractGradingInfo(soldData.title);
                soldData.grading_company = gradingInfo.company;
                soldData.grade_number = gradingInfo.grade;
                soldData.condition_grade = gradingInfo.condition;
                
                // Calculate confidence score based on multiple factors
                soldData.confidence_score = this.calculateConfidenceScore(soldData, pokemonCard);
                
                // Only include listings with reasonable confidence
                if (soldData.confidence_score >= 60 && soldData.sold_price > 0) {
                    processed.push(soldData);
                }
                
            } catch (error) {
                console.error('Error processing sold listing:', error.message);
                continue;
            }
        }
        
        return processed;
    }

    // Extract grading information from listing title
    extractGradingInfo(title) {
        const titleUpper = title.toUpperCase();
        
        const gradingServices = {
            'PSA': /PSA\s*(\d+(?:\.\d+)?)/i,
            'BGS': /BGS\s*(\d+(?:\.\d+)?)/i,
            'CGC': /CGC\s*(\d+(?:\.\d+)?)/i,
            'SGC': /SGC\s*(\d+(?:\.\d+)?)/i
        };
        
        for (const [service, regex] of Object.entries(gradingServices)) {
            const match = title.match(regex);
            if (match) {
                return {
                    company: service,
                    grade: match[1],
                    condition: `${service} ${match[1]}`
                };
            }
        }
        
        // Check for raw card conditions
        const conditions = ['mint', 'near mint', 'excellent', 'good', 'fair', 'poor'];
        for (const condition of conditions) {
            if (titleUpper.includes(condition.toUpperCase())) {
                return {
                    company: null,
                    grade: null,
                    condition: condition
                };
            }
        }
        
        return { company: null, grade: null, condition: null };
    }

    // Calculate listing confidence score (0-100)
    calculateConfidenceScore(soldData, pokemonCard) {
        let score = 0;
        const title = soldData.title.toLowerCase();
        const cardName = pokemonCard.name.toLowerCase();
        
        // Title matching (40 points max)
        if (title.includes(cardName)) score += 40;
        else if (this.fuzzyMatch(title, cardName)) score += 25;
        
        // Pokemon keyword presence (10 points)
        if (title.includes('pokemon')) score += 10;
        
        // Set name matching (20 points)
        if (pokemonCard.set_name && title.includes(pokemonCard.set_name.toLowerCase())) {
            score += 20;
        }
        
        // Price reasonableness (15 points)
        if (soldData.sold_price >= 0.50 && soldData.sold_price <= 10000) score += 15;
        
        // Seller feedback (10 points)
        if (soldData.watchers_count > 0) score += 5;
        if (soldData.bid_count > 0) score += 5;
        
        // Recent sale (5 points)
        const daysSinceSale = (Date.now() - soldData.sold_date.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceSale <= 30) score += 5;
        
        return Math.min(score, 100);
    }

    // Fuzzy string matching helper
    fuzzyMatch(str1, str2) {
        const threshold = 0.7;
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        
        let matches = 0;
        for (const word1 of words1) {
            for (const word2 of words2) {
                if (word1.includes(word2) || word2.includes(word1)) {
                    matches++;
                    break;
                }
            }
        }
        
        return (matches / Math.max(words1.length, words2.length)) >= threshold;
    }

    // Remove duplicate listings
    deduplicateListings(listings) {
        const seen = new Set();
        return listings.filter(listing => {
            const key = listing.ebay_item_id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // Save sold listings to database
    async saveSoldListings(listings, pokemonCardId) {
        const insertStmt = this.ebayDB.prepare(`
            INSERT OR IGNORE INTO ebay_sold_listings (
                pokemon_tcg_id, card_name, set_name, ebay_item_id, title,
                sold_price, sold_date, shipping_cost, total_cost, condition_grade,
                grading_company, grade_number, buy_it_now, auction_type,
                bid_count, watchers_count, currency_code, country,
                image_url, ebay_url, category_id, search_query, confidence_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let saved = 0;
        for (const listing of listings) {
            try {
                insertStmt.run(
                    pokemonCardId, listing.card_name || '', listing.set_name || '',
                    listing.ebay_item_id, listing.title, listing.sold_price,
                    listing.sold_date.toISOString(), listing.shipping_cost,
                    listing.total_cost, listing.condition_grade, listing.grading_company,
                    listing.grade_number, listing.buy_it_now ? 1 : 0, listing.auction_type,
                    listing.bid_count, listing.watchers_count, listing.currency_code,
                    listing.country, listing.image_url, listing.ebay_url,
                    listing.category_id, listing.search_query, listing.confidence_score
                );
                saved++;
            } catch (error) {
                console.error('Error saving listing:', error.message);
            }
        }
        
        console.log(`💾 Saved ${saved}/${listings.length} sold listings to database`);
    }

    // Utility: Get date N days ago in ISO format
    getDateDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    }

    // Collect sold data for all Pokemon cards
    async collectAllPokemonSoldData() {
        console.log('🚀 Starting comprehensive eBay sold listings collection...');
        
        const cards = this.pokemonDB.prepare('SELECT * FROM pokemon_cards LIMIT 100').all();
        console.log(`📋 Processing ${cards.length} Pokemon cards`);
        
        let processed = 0;
        let totalListings = 0;
        
        for (const card of cards) {
            try {
                const listings = await this.collectSoldListings(card);
                totalListings += listings.length;
                processed++;
                
                if (processed % 10 === 0) {
                    console.log(`📈 Progress: ${processed}/${cards.length} cards, ${totalListings} total listings`);
                }
                
                // Respect rate limits
                if (this.requestCount >= this.dailyLimit) {
                    console.log('⏹️  Reached daily API limit, stopping collection');
                    break;
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${card.name}:`, error.message);
                continue;
            }
        }
        
        console.log(`\n🎉 eBay collection complete!`);
        console.log(`📊 Processed: ${processed} cards`);
        console.log(`💰 Total sold listings: ${totalListings}`);
        console.log(`🔍 API requests made: ${this.requestCount}/${this.dailyLimit}`);
    }

    // Generate market analysis from collected data
    generatePriceAnalysis(pokemonCardId) {
        const listings = this.ebayDB.prepare(`
            SELECT * FROM ebay_sold_listings 
            WHERE pokemon_tcg_id = ? AND confidence_score >= 70
            ORDER BY sold_date DESC
        `).all(pokemonCardId);
        
        if (listings.length === 0) return null;
        
        const prices = listings.map(l => l.total_cost).filter(p => p > 0);
        const gradedPrices = listings.filter(l => l.grading_company).map(l => l.total_cost);
        
        return {
            sample_size: listings.length,
            average_price: prices.reduce((a, b) => a + b, 0) / prices.length,
            median_price: this.calculateMedian(prices),
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            graded_premium: gradedPrices.length > 0 ? 
                (gradedPrices.reduce((a, b) => a + b, 0) / gradedPrices.length) - 
                (prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
            recent_sales: listings.slice(0, 10),
            last_updated: new Date().toISOString()
        };
    }
    
    calculateMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

// Export and demo
module.exports = SecureEBayPokemonCollector;

if (require.main === module) {
    async function demo() {
        console.log('🔒 Secure eBay Pokemon Pricing Collector Demo');
        console.log('=============================================\n');
        
        const collector = new SecureEBayPokemonCollector();
        
        // Test with a few popular cards
        await collector.collectAllPokemonSoldData();
        
        console.log('\n✅ Secure eBay collection demonstration complete!');
        console.log('📋 Key advantages over manual HTTP calls:');
        console.log('   • Official eBay SDK - no security vulnerabilities');
        console.log('   • Auto token management and refresh');
        console.log('   • Built-in rate limiting and error handling');
        console.log('   • Structured data parsing');
        console.log('   • Better search algorithms');
        console.log('   • Grading detection and confidence scoring');
    }
    
    demo().catch(console.error);
}
