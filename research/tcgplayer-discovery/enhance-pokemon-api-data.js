#!/usr/bin/env node

/**
 * 🔄 POKEMON TCG API DATA ENHANCEMENT
 * 
 * Instead of fighting TCGPlayer's anti-bot measures, let's enhance our 
 * Pokemon TCG API data which already has good prices and is fresh (2025/09/08)
 */

const Database = require('better-sqlite3');

console.log('🔄 POKEMON TCG API DATA ENHANCEMENT');
console.log('===================================\n');

async function enhanceApiData() {
    console.log('📊 Loading databases...');
    
    const pokemonDb = new Database('pokemon_tcg_complete.db');
    const finalDb = new Database('collector_crypt_all_cards_fixed.db');
    
    // First, let's see what we have in Pokemon TCG API
    const apiStats = pokemonDb.prepare(`
        SELECT 
            COUNT(*) as total_cards,
            COUNT(CASE WHEN tcgplayer != '{}' AND tcgplayer != 'null' THEN 1 END) as has_tcgplayer,
            COUNT(CASE WHEN json_extract(tcgplayer, '$.prices.holofoil.market') > 0 THEN 1 END) as has_holofoil,
            COUNT(CASE WHEN json_extract(tcgplayer, '$.prices.normal.market') > 0 THEN 1 END) as has_normal,
            COUNT(CASE WHEN json_extract(tcgplayer, '$.prices.reverseHolofoil.market') > 0 THEN 1 END) as has_reverse,
            COUNT(CASE WHEN json_extract(tcgplayer, '$.updatedAt') = '2025/09/08' THEN 1 END) as updated_today
        FROM pokemon_cards
    `).get();
    
    console.log('📊 POKEMON TCG API ANALYSIS:');
    console.log(`   Total Cards: ${apiStats.total_cards.toLocaleString()}`);
    console.log(`   Has TCGPlayer Data: ${apiStats.has_tcgplayer.toLocaleString()} (${(apiStats.has_tcgplayer/apiStats.total_cards*100).toFixed(1)}%)`);
    console.log(`   Has Holofoil Prices: ${apiStats.has_holofoil.toLocaleString()}`);
    console.log(`   Has Normal Prices: ${apiStats.has_normal.toLocaleString()}`);
    console.log(`   Has Reverse Prices: ${apiStats.has_reverse.toLocaleString()}`);
    console.log(`   Updated Today: ${apiStats.updated_today.toLocaleString()}`);
    
    // Extract all good Pokemon TCG prices
    console.log('\n🔍 Extracting high-quality Pokemon TCG prices...');
    
    const goodPrices = pokemonDb.prepare(`
        SELECT 
            name,
            json_extract(tcgplayer, '$.prices.holofoil.market') as holofoil_price,
            json_extract(tcgplayer, '$.prices.normal.market') as normal_price,
            json_extract(tcgplayer, '$.prices.reverseHolofoil.market') as reverse_price,
            json_extract(tcgplayer, '$.prices.1stEditionHolofoil.market') as first_ed_holofoil,
            json_extract(tcgplayer, '$.prices.unlimitedHolofoil.market') as unlimited_holofoil,
            json_extract(tcgplayer, '$.updatedAt') as updated_at,
            set_name as pokemon_set,
            rarity
        FROM pokemon_cards 
        WHERE tcgplayer != '{}' AND tcgplayer != 'null'
        AND (
            json_extract(tcgplayer, '$.prices.holofoil.market') > 0 OR
            json_extract(tcgplayer, '$.prices.normal.market') > 0 OR
            json_extract(tcgplayer, '$.prices.reverseHolofoil.market') > 0 OR
            json_extract(tcgplayer, '$.prices.1stEditionHolofoil.market') > 0 OR
            json_extract(tcgplayer, '$.prices.unlimitedHolofoil.market') > 0
        )
    `).all();
    
    console.log(`✅ Found ${goodPrices.length.toLocaleString()} cards with valid Pokemon TCG prices`);
    
    // Create enhanced TCGPlayer database
    const enhancedDb = new Database('tcgplayer_enhanced.db');
    enhancedDb.exec(`
        DROP TABLE IF EXISTS tcgplayer_cards_enhanced;
        CREATE TABLE tcgplayer_cards_enhanced (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            set_name TEXT,
            rarity TEXT,
            market_price REAL,
            holofoil_price REAL,
            normal_price REAL,
            reverse_price REAL,
            first_ed_price REAL,
            unlimited_price REAL,
            best_price REAL,
            price_variant TEXT,
            updated_at TEXT,
            data_source TEXT DEFAULT 'Pokemon TCG API',
            quality_score INTEGER
        );
        
        CREATE INDEX idx_enhanced_name ON tcgplayer_cards_enhanced(name);
        CREATE INDEX idx_enhanced_price ON tcgplayer_cards_enhanced(best_price);
    `);
    
    // Process and validate each card
    console.log('\n🔧 Processing and validating prices...');
    
    let processed = 0;
    let valid_cards = 0;
    
    const insertStmt = enhancedDb.prepare(`
        INSERT INTO tcgplayer_cards_enhanced 
        (name, set_name, rarity, market_price, holofoil_price, normal_price, 
         reverse_price, first_ed_price, unlimited_price, best_price, 
         price_variant, updated_at, quality_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const card of goodPrices) {
        processed++;
        
        // Extract all price variants
        const prices = {
            holofoil: parseFloat(card.holofoil_price) || 0,
            normal: parseFloat(card.normal_price) || 0,
            reverse: parseFloat(card.reverse_price) || 0,
            first_ed: parseFloat(card.first_ed_holofoil) || 0,
            unlimited: parseFloat(card.unlimited_holofoil) || 0
        };
        
        // Filter valid prices (>= $0.25)
        const validPrices = Object.entries(prices)
            .filter(([_, price]) => price >= 0.25)
            .sort((a, b) => b[1] - a[1]); // Sort by price descending
        
        if (validPrices.length > 0) {
            // Use the highest valid price as market price
            const [bestVariant, bestPrice] = validPrices[0];
            
            // Calculate quality score
            let qualityScore = 50; // Base score
            if (prices.holofoil > 0) qualityScore += 15;
            if (prices.normal > 0) qualityScore += 10;
            if (prices.reverse > 0) qualityScore += 10;
            if (prices.first_ed > 0) qualityScore += 10;
            if (card.updated_at === '2025/09/08') qualityScore += 5; // Recent data
            
            insertStmt.run(
                card.name,
                card.pokemon_set || 'Unknown',
                card.rarity || 'Unknown',
                bestPrice, // Use best price as market price
                prices.holofoil || null,
                prices.normal || null,
                prices.reverse || null,
                prices.first_ed || null,
                prices.unlimited || null,
                bestPrice,
                bestVariant,
                card.updated_at,
                qualityScore
            );
            
            valid_cards++;
        }
        
        if (processed % 1000 === 0) {
            console.log(`📈 Processed: ${processed.toLocaleString()} | Valid: ${valid_cards.toLocaleString()}`);
        }
    }
    
    console.log(`\n✅ Enhancement complete! ${valid_cards.toLocaleString()} valid cards processed`);
    
    // Generate quality report
    const enhancedStats = enhancedDb.prepare(`
        SELECT 
            COUNT(*) as total_enhanced,
            AVG(best_price) as avg_price,
            MIN(best_price) as min_price,
            MAX(best_price) as max_price,
            AVG(quality_score) as avg_quality,
            COUNT(CASE WHEN best_price >= 100 THEN 1 END) as high_value,
            COUNT(CASE WHEN best_price >= 10 THEN 1 END) as mid_value,
            COUNT(CASE WHEN updated_at = '2025/09/08' THEN 1 END) as fresh_data
        FROM tcgplayer_cards_enhanced
    `).get();
    
    console.log('\n📊 ENHANCED DATA QUALITY REPORT:');
    console.log(`   Total Enhanced Cards: ${enhancedStats.total_enhanced.toLocaleString()}`);
    console.log(`   Average Price: $${enhancedStats.avg_price.toFixed(2)}`);
    console.log(`   Price Range: $${enhancedStats.min_price} - $${enhancedStats.max_price.toLocaleString()}`);
    console.log(`   Average Quality: ${enhancedStats.avg_quality.toFixed(0)}/100`);
    console.log(`   High Value (>$100): ${enhancedStats.high_value.toLocaleString()}`);
    console.log(`   Mid Value (>$10): ${enhancedStats.mid_value.toLocaleString()}`);
    console.log(`   Fresh Data (Today): ${enhancedStats.fresh_data.toLocaleString()}`);
    
    // Show top cards
    const topCards = enhancedDb.prepare(`
        SELECT name, set_name, best_price, price_variant, quality_score
        FROM tcgplayer_cards_enhanced
        ORDER BY best_price DESC
        LIMIT 15
    `).all();
    
    console.log('\n💎 TOP ENHANCED CARDS:');
    topCards.forEach((card, i) => {
        console.log(`   ${i+1}. ${card.name} (${card.set_name})`);
        console.log(`      Price: $${card.best_price.toLocaleString()} (${card.price_variant}) | Quality: ${card.quality_score}/100`);
    });
    
    // Price distribution
    const priceDistribution = enhancedDb.prepare(`
        SELECT 
            CASE 
                WHEN best_price < 1 THEN 'Under $1'
                WHEN best_price < 5 THEN '$1-$5'
                WHEN best_price < 10 THEN '$5-$10'
                WHEN best_price < 50 THEN '$10-$50'
                WHEN best_price < 100 THEN '$50-$100'
                ELSE 'Over $100'
            END as range,
            COUNT(*) as count
        FROM tcgplayer_cards_enhanced
        GROUP BY range
        ORDER BY MIN(best_price)
    `).all();
    
    console.log('\n📈 PRICE DISTRIBUTION:');
    priceDistribution.forEach(range => {
        console.log(`   ${range.range}: ${range.count.toLocaleString()} cards`);
    });
    
    console.log('\n🔄 Now updating comprehensive pricing system...');
    
    // Update our comprehensive system to use this enhanced data
    finalDb.exec(`
        -- Add enhanced TCGPlayer data source flag
        ALTER TABLE collector_crypt_comprehensive_pricing 
        ADD COLUMN enhanced_tcgp_price REAL;
        
        ALTER TABLE collector_crypt_comprehensive_pricing 
        ADD COLUMN enhanced_tcgp_quality INTEGER;
    `);
    
    // Update cards with enhanced Pokemon TCG data
    let updated = 0;
    const ccCards = finalDb.prepare(`
        SELECT id, cc_title FROM collector_crypt_comprehensive_pricing
    `).all();
    
    const updateStmt = finalDb.prepare(`
        UPDATE collector_crypt_comprehensive_pricing 
        SET enhanced_tcgp_price = ?, enhanced_tcgp_quality = ?
        WHERE id = ?
    `);
    
    for (const ccCard of ccCards) {
        // Find matching enhanced card
        const match = enhancedDb.prepare(`
            SELECT best_price, quality_score
            FROM tcgplayer_cards_enhanced 
            WHERE name LIKE ?
            ORDER BY quality_score DESC, best_price DESC
            LIMIT 1
        `).get(`%${ccCard.cc_title.split(' ')[0]}%`);
        
        if (match && match.best_price >= 0.50) {
            updateStmt.run(match.best_price, match.quality_score, ccCard.id);
            updated++;
        }
    }
    
    console.log(`✅ Updated ${updated.toLocaleString()} cards with enhanced Pokemon TCG data`);
    
    // Close databases
    pokemonDb.close();
    enhancedDb.close();
    finalDb.close();
    
    console.log('\n🎉 POKEMON TCG API ENHANCEMENT COMPLETE!');
    console.log('=======================================');
    console.log('✅ High-quality pricing data extracted from Pokemon TCG API');
    console.log('✅ Comprehensive validation and quality scoring applied');
    console.log('✅ Enhanced database created: tcgplayer_enhanced.db');
    console.log('✅ Comprehensive pricing system updated');
}

enhanceApiData().catch(console.error);
