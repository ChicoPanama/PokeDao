#!/usr/bin/env node

/**
 * 🚨 EMERGENCY PRICING DEBUG - TRACE EXACT CALCULATION
 * 
 * This will trace the EXACT calculation for our problematic Charizard
 * to see why eBay's $32K price isn't being used vs the wrong $127 price
 */

const Database = require('better-sqlite3');

console.log('🚨 EMERGENCY PRICING DEBUG - CHARIZARD TRACE');
console.log('==============================================\n');

try {
    // Open databases
    const ccDb = new Database('collector_crypt_v2.db');
    const pokemonDb = new Database('pokemon_tcg_complete.db');  
    const tcgplayerDb = new Database('tcgplayer.db');
    const ebayDb = new Database('collector_crypt_ebay_complete.db');
    
    // Get our problem card
    const charizard = ccDb.prepare(`
        SELECT id, title, price, category, grading_company, grade 
        FROM collector_crypt_cards 
        WHERE id = '2025071955C27024'
    `).get();
    
    console.log('🎯 TARGET CARD:');
    console.log(`   ID: ${charizard.id}`);
    console.log(`   Title: ${charizard.title}`);
    console.log(`   CC Asking: $${charizard.price}`);
    console.log(`   Grade: ${charizard.grade} ${charizard.grading_company}\n`);
    
    // Check Pokemon TCG API match
    console.log('1️⃣ POKEMON TCG API MATCHING:');
    const normalizedTitle = charizard.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    console.log(`   Normalized title: "${normalizedTitle}"`);
    
    const pokemonCards = pokemonDb.prepare(`
        SELECT name, 
               json_extract(tcgplayer, '$.prices.holofoil.market') as holofoil_market,
               json_extract(tcgplayer, '$.prices.normal.market') as normal_market,
               json_extract(tcgplayer, '$.prices.reverseHolofoil.market') as reverse_market,
               json_extract(tcgplayer, '$.updatedAt') as updated
        FROM pokemon_cards 
        WHERE name LIKE '%Charizard%' AND tcgplayer != '{}' AND tcgplayer != 'null'
        ORDER BY holofoil_market DESC
        LIMIT 5
    `).all();
    
    console.log(`   Found ${pokemonCards.length} Pokemon TCG Charizard matches:`);
    pokemonCards.forEach((card, i) => {
        const prices = [card.holofoil_market, card.normal_market, card.reverse_market].filter(p => p && p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        console.log(`      ${i+1}. ${card.name}: $${minPrice} (updated: ${card.updated})`);
    });
    
    // Check TCGPlayer match
    console.log('\n2️⃣ TCGPLAYER MATCHING:');
    const tcgPlayerCards = tcgplayerDb.prepare(`
        SELECT name, marketPrice, currentPrice
        FROM tcgplayer_cards 
        WHERE name LIKE '%Charizard%' AND marketPrice >= 1.00
        ORDER BY marketPrice DESC
        LIMIT 5
    `).all();
    
    console.log(`   Found ${tcgPlayerCards.length} TCGPlayer realistic Charizard matches:`);
    tcgPlayerCards.forEach((card, i) => {
        console.log(`      ${i+1}. ${card.name}: Market $${card.marketPrice}, Current $${card.currentPrice}`);
    });
    
    // Check eBay match - THIS IS THE CRITICAL ONE
    console.log('\n3️⃣ EBAY MATCHING:');
    const ebayMatches = ebayDb.prepare(`
        SELECT collector_crypt_id, card_name, avg_asking_price, avg_sold_price, sold_listings_count
        FROM ebay_price_analytics 
        WHERE collector_crypt_id = '2025071955C27024'
    `).all();
    
    console.log(`   Found ${ebayMatches.length} eBay matches for this exact card:`);
    ebayMatches.forEach((match, i) => {
        console.log(`      ${i+1}. ${match.card_name}: Sold $${match.avg_sold_price}, Ask $${match.avg_asking_price} (${match.sold_listings_count} sales)`);
    });
    
    // Now simulate the CURRENT pricing logic from the system
    console.log('\n4️⃣ CURRENT SYSTEM LOGIC SIMULATION:');
    console.log('===================================');
    
    let marketPrices = [];
    let sourcesUsed = [];
    
    // Step 1: Pokemon TCG match (what the system currently finds)
    const pokemonMatch = pokemonCards.find(card => 
        card.name.toLowerCase().includes('charizard')
    );
    
    if (pokemonMatch) {
        const prices = [pokemonMatch.holofoil_market, pokemonMatch.normal_market, pokemonMatch.reverse_market]
            .filter(p => p && p > 0);
        
        if (prices.length > 0) {
            const pokemonPrice = Math.min(...prices);
            marketPrices.push(pokemonPrice);
            sourcesUsed.push('Pokemon TCG API');
            console.log(`   ✅ Pokemon TCG: $${pokemonPrice} from "${pokemonMatch.name}"`);
        }
    }
    
    // Step 2: TCGPlayer match (filtered for realistic prices)
    const tcgMatch = tcgPlayerCards.find(card => 
        card.name.toLowerCase().includes('charizard') && card.marketPrice >= 1.00
    );
    
    if (tcgMatch) {
        marketPrices.push(tcgMatch.marketPrice);
        sourcesUsed.push('TCGPlayer');
        console.log(`   ✅ TCGPlayer: $${tcgMatch.marketPrice} from "${tcgMatch.name}"`);
    }
    
    // Step 3: eBay match - THE MISSING PIECE
    if (ebayMatches.length > 0) {
        const ebayMatch = ebayMatches[0]; // Take first match
        
        // Add both current and sold prices
        if (ebayMatch.avg_asking_price > 0) {
            marketPrices.push(ebayMatch.avg_asking_price);
            sourcesUsed.push('eBay Current');
            console.log(`   ✅ eBay Current: $${ebayMatch.avg_asking_price}`);
        }
        
        if (ebayMatch.avg_sold_price > 0) {
            marketPrices.push(ebayMatch.avg_sold_price);
            sourcesUsed.push('eBay Sold');
            console.log(`   ✅ eBay Sold: $${ebayMatch.avg_sold_price}`);
        }
    }
    
    // Calculate final result
    console.log('\n5️⃣ FINAL CALCULATION:');
    console.log('=====================');
    console.log(`   All market prices: [${marketPrices.join(', ')}]`);
    console.log(`   Sources used: ${sourcesUsed.join(', ')}`);
    
    if (marketPrices.length > 0) {
        const validPrices = marketPrices.filter(price => price >= 0.50);
        const trueMarketValue = Math.min(...validPrices);
        const ratio = charizard.price / trueMarketValue;
        
        console.log(`\n   📊 RESULTS:`);
        console.log(`      Valid prices: [${validPrices.join(', ')}]`);
        console.log(`      True Market Value: $${trueMarketValue}`);
        console.log(`      CC Asking: $${charizard.price}`);
        console.log(`      Ratio: ${ratio.toFixed(2)}x`);
        
        if (trueMarketValue < 1000) {
            console.log(`\n   🚨 BUG IDENTIFIED: Market value $${trueMarketValue} is too low for PSA 9 Charizard!`);
            console.log(`      Expected range: $3,000 - $8,000`);
            console.log(`      Issue: System is choosing lowest price instead of most reliable price`);
        } else {
            console.log(`\n   ✅ Market value $${trueMarketValue} seems realistic for PSA 9 Charizard`);
        }
    }
    
    console.log('\n6️⃣ SYSTEM ISSUE DIAGNOSIS:');
    console.log('===========================');
    
    if (marketPrices.includes(127.01) && marketPrices.includes(32006.35)) {
        console.log('   🎯 PROBLEM FOUND: System has both $127 (Pokemon TCG) and $32K (eBay) prices');
        console.log('   ❌ Math.min() choosing $127 instead of realistic $32K');
        console.log('   🔧 FIX NEEDED: Use data source prioritization instead of Math.min()');
        console.log('   💡 SOLUTION: eBay sold prices should override Pokemon TCG API for graded cards');
    }
    
    console.log('\n✅ DIAGNOSTIC COMPLETE');

} catch (error) {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
}
