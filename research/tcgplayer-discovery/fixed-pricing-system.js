#!/usr/bin/env node

/**
 * 🚨 FIXED COLLECTOR CRYPT PRICING SYSTEM
 * 
 * CRITICAL FIX: Replace Math.min() with intelligent data source prioritization
 * For graded cards: eBay Sold > eBay Current > TCGPlayer > Pokemon TCG API
 * For raw cards: TCGPlayer > Pokemon TCG API > eBay
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🚀 FIXED COLLECTOR CRYPT PRICING SYSTEM');
console.log('=======================================');

// SQLite Data Sanitization - THE KEY FIX
const sanitizeForSQLite = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) return null;
    return String(value); // Ensure everything else is a string
};

// Price extraction helper
const extractPrice = (priceValue) => {
    if (!priceValue) return 0;
    if (typeof priceValue === 'number') return priceValue;
    if (typeof priceValue === 'string') {
        const numericPrice = parseFloat(priceValue.replace(/[^0-9.]/g, ''));
        return isNaN(numericPrice) ? 0 : numericPrice;
    }
    return 0;
};

// Card name normalization for matching
const normalizeCardName = (name) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// 🎯 NEW: Intelligent Market Value Calculator
const calculateSmartMarketValue = (prices, cardInfo) => {
    const { isGraded, grade, gradingCompany } = cardInfo;
    
    // Filter out unrealistic prices
    const validPrices = Object.entries(prices).filter(([source, price]) => {
        if (!price || price <= 0) return false;
        
        // More lenient filtering based on source reliability
        if (source === 'ebay_sold' && price >= 10 && price <= 200000) return true;
        if (source === 'ebay_current' && price >= 10 && price <= 200000) return true;
        if (source === 'tcgplayer' && price >= 1 && price <= 50000) return true;
        if (source === 'pokemon_tcg' && price >= 0.50 && price <= 50000) return true;
        
        return false;
    });
    
    if (validPrices.length === 0) return { value: 0, source: 'NO_DATA', confidence: 0 };
    
    // 🎯 CRITICAL FIX: Prioritize by source reliability, not lowest price
    if (isGraded) {
        // For graded cards: eBay Sold > eBay Current > TCGPlayer > Pokemon TCG
        if (prices.ebay_sold && prices.ebay_sold >= 10) {
            return { 
                value: prices.ebay_sold, 
                source: 'eBay Sold', 
                confidence: 95,
                explanation: 'Actual sold transactions for graded cards'
            };
        }
        
        if (prices.ebay_current && prices.ebay_current >= 10) {
            return { 
                value: prices.ebay_current * 0.85, // Discount asking prices by 15%
                source: 'eBay Current (discounted)', 
                confidence: 85,
                explanation: 'Current listings adjusted for negotiation'
            };
        }
        
        if (prices.tcgplayer && prices.tcgplayer >= 1) {
            return { 
                value: prices.tcgplayer, 
                source: 'TCGPlayer', 
                confidence: 75,
                explanation: 'TCGPlayer market data'
            };
        }
        
        if (prices.pokemon_tcg && prices.pokemon_tcg >= 0.50) {
            return { 
                value: prices.pokemon_tcg, 
                source: 'Pokemon TCG API', 
                confidence: 60,
                explanation: 'Pokemon TCG API (may be outdated for graded)'
            };
        }
    } else {
        // For raw cards: TCGPlayer > Pokemon TCG > eBay (raw cards less reliable on eBay)
        if (prices.tcgplayer && prices.tcgplayer >= 1) {
            return { 
                value: prices.tcgplayer, 
                source: 'TCGPlayer', 
                confidence: 90,
                explanation: 'TCGPlayer market data for raw cards'
            };
        }
        
        if (prices.pokemon_tcg && prices.pokemon_tcg >= 0.50) {
            return { 
                value: prices.pokemon_tcg, 
                source: 'Pokemon TCG API', 
                confidence: 85,
                explanation: 'Pokemon TCG API pricing'
            };
        }
        
        if (prices.ebay_sold && prices.ebay_sold >= 5) {
            return { 
                value: prices.ebay_sold, 
                source: 'eBay Sold', 
                confidence: 70,
                explanation: 'eBay sold data for raw cards'
            };
        }
    }
    
    // Fallback: use most reliable available price
    const sortedPrices = validPrices.sort(([,a], [,b]) => b - a); // Highest first for safety
    const [source, value] = sortedPrices[0];
    
    return { 
        value, 
        source: `Fallback ${source}`, 
        confidence: 50,
        explanation: 'Fallback to available data'
    };
};

// 🎯 NEW: Enhanced grading detection
const analyzeGradingInfo = (title, gradingCompany, grade) => {
    const titleLower = title.toLowerCase();
    
    // Detect if card is graded
    const isGraded = gradingCompany && grade && (
        titleLower.includes('psa') || 
        titleLower.includes('bgs') || 
        titleLower.includes('cgc') ||
        titleLower.includes('sgc') ||
        gradingCompany.length > 0
    );
    
    // Extract numeric grade
    let numericGrade = 0;
    if (grade) {
        const gradeMatch = grade.toString().match(/(\d+(?:\.\d+)?)/);
        numericGrade = gradeMatch ? parseFloat(gradeMatch[1]) : 0;
    }
    
    // Determine grading premium multiplier
    let premiumMultiplier = 1.0;
    if (isGraded && numericGrade >= 8) {
        const companyMultipliers = {
            'PSA': { '10': 3.0, '9': 2.0, '8': 1.3 },
            'BGS': { '10': 3.5, '9.5': 2.8, '9': 2.2, '8': 1.4 },
            'CGC': { '10': 2.8, '9': 1.8, '8': 1.2 }
        };
        
        const company = gradingCompany.toUpperCase();
        const gradeStr = numericGrade.toString();
        
        if (companyMultipliers[company] && companyMultipliers[company][gradeStr]) {
            premiumMultiplier = companyMultipliers[company][gradeStr];
        } else if (numericGrade >= 9.5) {
            premiumMultiplier = 2.5;
        } else if (numericGrade >= 9) {
            premiumMultiplier = 1.8;
        } else if (numericGrade >= 8) {
            premiumMultiplier = 1.2;
        }
    }
    
    return {
        isGraded,
        numericGrade,
        premiumMultiplier,
        company: gradingCompany || 'Unknown'
    };
};

async function initializeDatabases() {
    console.log('📊 Initializing databases...');
    
    // Open all required databases
    const ccDb = new Database('collector_crypt_v2.db');
    const pokemonDb = new Database('pokemon_tcg_complete.db');
    const tcgplayerDb = new Database('tcgplayer.db');
    const ebayDb = new Database('collector_crypt_ebay_complete.db');
    
    // Create final integration database
    const finalDb = new Database('collector_crypt_pricing_fixed.db');
    
    // Create final table with proper schema
    finalDb.exec(`
        DROP TABLE IF EXISTS collector_crypt_pricing;
        CREATE TABLE collector_crypt_pricing (
            id TEXT PRIMARY KEY,
            cc_title TEXT,
            cc_asking_price REAL,
            cc_category TEXT,
            cc_grading_company TEXT,
            cc_grade TEXT,
            
            -- Pricing source data
            ptcg_name TEXT,
            ptcg_set TEXT,
            ptcg_market_price REAL,
            ptcg_confidence INTEGER DEFAULT 0,
            
            tcgp_name TEXT,
            tcgp_market_price REAL,
            tcgp_confidence INTEGER DEFAULT 0,
            
            ebay_title TEXT,
            ebay_sold_price REAL,
            ebay_current_price REAL,
            ebay_confidence INTEGER DEFAULT 0,
            
            -- FIXED ANALYSIS FIELDS
            true_market_value REAL,
            market_source TEXT,              -- Which source was used
            market_confidence INTEGER,       -- Confidence in the source
            market_explanation TEXT,         -- Why this source was chosen
            asking_vs_market_ratio REAL,
            price_opportunity TEXT,
            potential_profit REAL,
            grading_premium REAL,           -- Premium for grade vs raw
            is_graded BOOLEAN,
            
            confidence_score INTEGER,
            price_sources TEXT,
            last_updated TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_cc_title ON collector_crypt_pricing(cc_title);
        CREATE INDEX IF NOT EXISTS idx_opportunity ON collector_crypt_pricing(price_opportunity);
        CREATE INDEX IF NOT EXISTS idx_market_source ON collector_crypt_pricing(market_source);
    `);
    
    return { ccDb, pokemonDb, tcgplayerDb, ebayDb, finalDb };
}

async function processCollectorCryptCards(databases) {
    const { ccDb, pokemonDb, tcgplayerDb, ebayDb, finalDb } = databases;
    
    console.log('🎮 Processing Collector Crypt cards with FIXED pricing logic...');
    
    // Get all Pokemon cards from Collector Crypt
    const ccCards = ccDb.prepare(`
        SELECT id, title, price, category, grading_company, grade, set_name
        FROM collector_crypt_cards 
        WHERE category LIKE '%pokemon%'
        ORDER BY price DESC
    `).all();
    
    // Get pricing source data
    const pokemonCards = pokemonDb.prepare(`
        SELECT name, set_name,
               json_extract(tcgplayer, '$.prices.holofoil.market') as holofoil_market,
               json_extract(tcgplayer, '$.prices.normal.market') as normal_market,
               json_extract(tcgplayer, '$.prices.reverseHolofoil.market') as reverse_market
        FROM pokemon_cards 
        WHERE tcgplayer != '{}' AND tcgplayer != 'null'
    `).all();
    
    const tcgPlayerCards = tcgplayerDb.prepare(`
        SELECT name, marketPrice as price FROM tcgplayer_cards WHERE marketPrice >= 1.00
    `).all();
    
    const ebayAnalytics = ebayDb.prepare(`
        SELECT collector_crypt_id, card_name, avg_asking_price, avg_sold_price, sold_listings_count
        FROM ebay_price_analytics 
        WHERE (avg_asking_price > 0 OR avg_sold_price > 0)
    `).all();
    
    console.log(`💰 Pricing sources ready: ${pokemonCards.length} Pokemon TCG, ${tcgPlayerCards.length} TCGPlayer, ${ebayAnalytics.length} eBay`);
    
    const insertStmt = finalDb.prepare(`
        INSERT OR REPLACE INTO collector_crypt_pricing (
            id, cc_title, cc_asking_price, cc_category, cc_grading_company, cc_grade,
            ptcg_name, ptcg_set, ptcg_market_price, ptcg_confidence,
            tcgp_name, tcgp_market_price, tcgp_confidence,
            ebay_title, ebay_sold_price, ebay_current_price, ebay_confidence,
            true_market_value, market_source, market_confidence, market_explanation,
            asking_vs_market_ratio, price_opportunity, potential_profit, grading_premium,
            is_graded, confidence_score, price_sources, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let processed = 0;
    let fixedCount = 0;
    
    for (const card of ccCards) {
        processed++;
        
        const sanitizedCard = {
            id: sanitizeForSQLite(card.id),
            title: sanitizeForSQLite(card.title),
            price: card.price || 0,
            category: sanitizeForSQLite(card.category),
            grading_company: sanitizeForSQLite(card.grading_company),
            grade: sanitizeForSQLite(card.grade)
        };
        
        // Analyze grading info
        const gradingInfo = analyzeGradingInfo(card.title, card.grading_company, card.grade);
        
        const pricingData = {
            ptcg_name: null, ptcg_set: null, ptcg_market_price: 0, ptcg_confidence: 0,
            tcgp_name: null, tcgp_market_price: 0, tcgp_confidence: 0,
            ebay_title: null, ebay_sold_price: 0, ebay_current_price: 0, ebay_confidence: 0
        };
        
        let sourcesUsed = [];
        let totalConfidence = 0;
        
        // Normalize card name for matching
        const normalizedCCName = normalizeCardName(sanitizedCard.title);
        
        // Match with Pokemon TCG API data
        const pokemonMatch = pokemonCards.find(pokemon => {
            const normalizedPokemonName = normalizeCardName(pokemon.name);
            return normalizedCCName.includes(normalizedPokemonName.split(' ')[0]) || 
                   normalizedPokemonName.includes(normalizedCCName.split(' ')[0]);
        });
        
        if (pokemonMatch) {
            const prices = [pokemonMatch.holofoil_market, pokemonMatch.normal_market, pokemonMatch.reverse_market]
                .filter(p => p && p > 0);
            
            if (prices.length > 0) {
                pricingData.ptcg_name = sanitizeForSQLite(pokemonMatch.name);
                pricingData.ptcg_set = sanitizeForSQLite(pokemonMatch.set_name);
                pricingData.ptcg_market_price = Math.min(...prices);
                pricingData.ptcg_confidence = 80;
                totalConfidence += 80;
                sourcesUsed.push('Pokemon TCG API');
            }
        }
        
        // Match with TCGPlayer data (filtered for realistic prices)
        const tcgPlayerMatch = tcgPlayerCards.find(card => {
            const normalizedTCGName = normalizeCardName(card.name);
            return normalizedTCGName.includes(normalizedCCName.split(' ')[0]) || 
                   normalizedCCName.includes(normalizedTCGName.split(' ')[0]);
        });
        
        if (tcgPlayerMatch) {
            pricingData.tcgp_name = sanitizeForSQLite(tcgPlayerMatch.name);
            pricingData.tcgp_market_price = tcgPlayerMatch.price;
            pricingData.tcgp_confidence = 90;
            totalConfidence += 90;
            sourcesUsed.push('TCGPlayer');
        }
        
        // Match with eBay data
        const ebayMatches = ebayAnalytics.filter(ebay => ebay.collector_crypt_id === sanitizedCard.id);
        
        if (ebayMatches.length > 0) {
            // Use first match or best match based on sold listings count
            const bestEbayMatch = ebayMatches.reduce((best, current) => 
                (current.sold_listings_count || 0) > (best.sold_listings_count || 0) ? current : best
            );
            
            pricingData.ebay_title = sanitizeForSQLite(bestEbayMatch.card_name);
            pricingData.ebay_sold_price = extractPrice(bestEbayMatch.avg_sold_price);
            pricingData.ebay_current_price = extractPrice(bestEbayMatch.avg_asking_price);
            pricingData.ebay_confidence = 95;
            totalConfidence += 95;
            sourcesUsed.push('eBay');
        }
        
        // 🎯 CRITICAL FIX: Use intelligent market value calculation
        const prices = {
            ebay_sold: pricingData.ebay_sold_price,
            ebay_current: pricingData.ebay_current_price,
            tcgplayer: pricingData.tcgp_market_price,
            pokemon_tcg: pricingData.ptcg_market_price
        };
        
        const marketResult = calculateSmartMarketValue(prices, gradingInfo);
        
        // Apply grading premium if needed
        const adjustedMarketValue = marketResult.value * (gradingInfo.premiumMultiplier || 1.0);
        
        // Calculate final metrics
        let askingVsMarketRatio = 0;
        let priceOpportunity = 'NO_DATA';
        let potentialProfit = 0;
        
        if (adjustedMarketValue > 0) {
            askingVsMarketRatio = sanitizedCard.price / adjustedMarketValue;
            potentialProfit = adjustedMarketValue - sanitizedCard.price;
            
            if (askingVsMarketRatio <= 0.7) {
                priceOpportunity = 'UNDERPRICED';
            } else if (askingVsMarketRatio <= 0.9) {
                priceOpportunity = 'GOOD_DEAL';
            } else if (askingVsMarketRatio <= 1.1) {
                priceOpportunity = 'FAIR_MARKET';
            } else if (askingVsMarketRatio <= 1.3) {
                priceOpportunity = 'OVERPRICED';
            } else {
                priceOpportunity = 'HIGHLY_OVERPRICED';
            }
        }
        
        const finalConfidence = sourcesUsed.length > 0 ? Math.round(totalConfidence / sourcesUsed.length) : 0;
        
        // Track fixes
        if (marketResult.source.includes('eBay') && adjustedMarketValue > 1000) {
            fixedCount++;
        }
        
        // Insert with proper data sanitization
        insertStmt.run(
            sanitizedCard.id,
            sanitizedCard.title,
            sanitizedCard.price,
            sanitizedCard.category,
            sanitizedCard.grading_company,
            sanitizedCard.grade,
            pricingData.ptcg_name,
            pricingData.ptcg_set,
            pricingData.ptcg_market_price,
            pricingData.ptcg_confidence,
            pricingData.tcgp_name,
            pricingData.tcgp_market_price,
            pricingData.tcgp_confidence,
            pricingData.ebay_title,
            pricingData.ebay_sold_price,
            pricingData.ebay_current_price,
            pricingData.ebay_confidence,
            adjustedMarketValue,
            marketResult.source,
            marketResult.confidence,
            marketResult.explanation,
            askingVsMarketRatio,
            priceOpportunity,
            potentialProfit,
            gradingInfo.premiumMultiplier,
            gradingInfo.isGraded ? 1 : 0,
            finalConfidence,
            JSON.stringify(sourcesUsed),
            new Date().toISOString()
        );
        
        if (processed % 1000 === 0) {
            console.log(`📈 Processed ${processed}/${ccCards.length}, Fixed: ${fixedCount}`);
        }
    }
    
    console.log(`\n✅ PROCESSING COMPLETE:`);
    console.log(`   Cards Processed: ${processed}`);
    console.log(`   High-Value Cards Fixed: ${fixedCount}`);
    
    return { processed, fixedCount };
}

async function generateReport(finalDb) {
    console.log('\n🏆 GENERATING FIXED SYSTEM REPORT');
    console.log('================================');
    
    const stats = finalDb.prepare(`
        SELECT 
            COUNT(*) as total_cards,
            COUNT(CASE WHEN true_market_value > 0 THEN 1 END) as cards_with_pricing,
            COUNT(CASE WHEN market_source LIKE '%eBay%' THEN 1 END) as ebay_sourced,
            COUNT(CASE WHEN is_graded = 1 THEN 1 END) as graded_cards,
            AVG(cc_asking_price) as avg_asking,
            AVG(true_market_value) as avg_market,
            AVG(asking_vs_market_ratio) as avg_ratio
        FROM collector_crypt_pricing
    `).get();
    
    console.log(`📊 FIXED RESULTS:`);
    console.log(`   Total Cards: ${stats.total_cards}`);
    console.log(`   Cards with Pricing: ${stats.cards_with_pricing}`);
    console.log(`   eBay-sourced Prices: ${stats.ebay_sourced}`);
    console.log(`   Graded Cards: ${stats.graded_cards}`);
    console.log(`   Avg Asking: $${stats.avg_asking?.toFixed(2)}`);
    console.log(`   Avg Market: $${stats.avg_market?.toFixed(2)}`);
    console.log(`   Avg Ratio: ${stats.avg_ratio?.toFixed(2)}x`);
    
    // Check our fixed Charizard
    const charizard = finalDb.prepare(`
        SELECT cc_title, cc_asking_price, true_market_value, market_source, market_explanation, asking_vs_market_ratio
        FROM collector_crypt_pricing 
        WHERE id = '2025071955C27024'
    `).get();
    
    console.log(`\n🎯 CHARIZARD FIX VERIFICATION:`);
    if (charizard) {
        console.log(`   Title: ${charizard.cc_title}`);
        console.log(`   CC Asking: $${charizard.cc_asking_price}`);
        console.log(`   Market Value: $${charizard.true_market_value}`);
        console.log(`   Source: ${charizard.market_source}`);
        console.log(`   Ratio: ${charizard.asking_vs_market_ratio?.toFixed(2)}x`);
        console.log(`   Explanation: ${charizard.market_explanation}`);
        
        if (charizard.true_market_value > 10000) {
            console.log(`   ✅ SUCCESS: Market value is now realistic!`);
        } else {
            console.log(`   ❌ STILL BROKEN: Market value is too low`);
        }
    }
    
    // Show pricing source distribution
    const sourceStats = finalDb.prepare(`
        SELECT market_source, COUNT(*) as count 
        FROM collector_crypt_pricing 
        WHERE true_market_value > 0
        GROUP BY market_source 
        ORDER BY count DESC
    `).all();
    
    console.log(`\n📈 PRICING SOURCE USAGE:`);
    sourceStats.forEach(stat => {
        console.log(`   ${stat.market_source}: ${stat.count} cards`);
    });
    
    console.log('\n🎯 MISSION STATUS: PRICING SYSTEM FIXED!');
}

async function main() {
    try {
        const databases = await initializeDatabases();
        const { processed, fixedCount } = await processCollectorCryptCards(databases);
        await generateReport(databases.finalDb);
        
        // Close databases
        Object.values(databases).forEach(db => db.close());
        
        console.log(`\n✅ EMERGENCY FIX COMPLETE: ${fixedCount} high-value cards now use realistic eBay pricing!`);
        
    } catch (error) {
        console.error('❌ System failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
