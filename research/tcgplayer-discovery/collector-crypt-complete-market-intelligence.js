#!/usr/bin/env node

const Database = require('better-sqlite3');

function generateCompleteMarketReport() {
    console.log('🎯 COLLECTOR CRYPT COMPLETE MARKET INTELLIGENCE');
    console.log('==============================================\n');
    
    // Connect to all databases
    const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
    const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });
    const ebayDb = new Database('collector_crypt_ebay_complete.db', { readonly: true });
    
    console.log('📊 DATABASE OVERVIEW:');
    
    // Collector Crypt data
    const ccCount = ccDb.prepare("SELECT COUNT(*) as count FROM collector_crypt WHERE game_name = 'Pokemon'").get();
    console.log(`   Collector Crypt Pokemon Cards: ${ccCount.count.toLocaleString()}`);
    
    // Pricing data
    const pricingCount = pricingDb.prepare("SELECT COUNT(*) as count FROM pricing_complete WHERE pokemon_tcg_price IS NOT NULL").get();
    console.log(`   Cards with Pokemon TCG Pricing: ${pricingCount.count.toLocaleString()}`);
    
    const tcgCount = pricingDb.prepare("SELECT COUNT(*) as count FROM pricing_complete WHERE tcgplayer_price IS NOT NULL").get();
    console.log(`   Cards with TCGPlayer Pricing: ${tcgCount.count.toLocaleString()}`);
    
    // eBay data
    const ebayCount = ebayDb.prepare("SELECT COUNT(*) as count FROM ebay_price_analytics").get();
    console.log(`   Cards with eBay Market Data: ${ebayCount.count.toLocaleString()}\n`);
    
    // Complete market analysis
    console.log('🏆 COMPLETE MARKET ANALYSIS:');
    console.log('============================');
    
    const marketAnalysis = pricingDb.prepare(`
        SELECT 
            cc.collector_crypt_id,
            cc.card_name,
            cc.price as collector_crypt_asking,
            pc.pokemon_tcg_price,
            pc.tcgplayer_price,
            pc.asking_vs_pokemon_ratio,
            pc.asking_vs_tcg_ratio,
            pc.price_opportunity,
            pc.opportunity_type
        FROM collector_crypt cc
        JOIN pricing_complete pc ON cc.collector_crypt_id = pc.collector_crypt_id
        WHERE cc.game_name = 'Pokemon' 
        AND (pc.pokemon_tcg_price IS NOT NULL OR pc.tcgplayer_price IS NOT NULL)
        ORDER BY cc.price DESC
        LIMIT 20
    `).all();
    
    console.log('\n🎯 TOP 20 HIGHEST PRICED COLLECTOR CRYPT CARDS:');
    console.log('CC ID | Card Name | CC Ask | Pokemon TCG | TCGPlayer | Opportunity');
    console.log(''.padEnd(80, '-'));
    
    marketAnalysis.forEach(card => {
        const ccAsk = `$${card.collector_crypt_asking?.toFixed(2) || 'N/A'}`;
        const pokemonPrice = card.pokemon_tcg_price ? `$${card.pokemon_tcg_price.toFixed(2)}` : 'N/A';
        const tcgPrice = card.tcgplayer_price ? `$${card.tcgplayer_price.toFixed(2)}` : 'N/A';
        const opportunity = card.price_opportunity || 'NONE';
        
        const cardId = card.collector_crypt_id.substring(0, 15) + '...';
        const cardName = card.card_name.length > 15 ? card.card_name.substring(0, 12) + '...' : card.card_name;
        
        console.log(`${cardId} | ${cardName.padEnd(15)} | ${ccAsk.padEnd(8)} | ${pokemonPrice.padEnd(11)} | ${tcgPrice.padEnd(9)} | ${opportunity}`);
    });
    
    // Opportunity analysis
    console.log('\n💰 PRICE OPPORTUNITY ANALYSIS:');
    
    const opportunitiesQuery = pricingDb.prepare(`
        SELECT 
            opportunity_type,
            COUNT(*) as count,
            AVG(asking_vs_pokemon_ratio) as avg_pokemon_ratio,
            AVG(asking_vs_tcg_ratio) as avg_tcg_ratio
        FROM pricing_complete 
        WHERE opportunity_type != 'NONE'
        GROUP BY opportunity_type
        ORDER BY count DESC
    `).all();
    
    opportunitiesQuery.forEach(opp => {
        console.log(`   ${opp.opportunity_type}: ${opp.count.toLocaleString()} cards`);
        if (opp.avg_pokemon_ratio) {
            console.log(`     Avg ratio vs Pokemon TCG: ${opp.avg_pokemon_ratio.toFixed(2)}x`);
        }
        if (opp.avg_tcg_ratio) {
            console.log(`     Avg ratio vs TCGPlayer: ${opp.avg_tcg_ratio.toFixed(2)}x`);
        }
    });
    
    // eBay market intelligence
    console.log('\n🛒 EBAY MARKET INTELLIGENCE:');
    
    const ebayStats = ebayDb.prepare(`
        SELECT 
            COUNT(*) as total_cards,
            SUM(current_listings_count) as total_current,
            AVG(avg_asking_price) as avg_ebay_asking,
            SUM(sold_listings_count) as total_sold,
            AVG(avg_sold_price) as avg_ebay_sold,
            AVG(asking_vs_sold_ratio) as avg_asking_sold_ratio,
            AVG(market_velocity) as avg_days_to_sell
        FROM ebay_price_analytics
    `).get();
    
    if (ebayStats.total_cards > 0) {
        console.log(`   Cards Tracked: ${ebayStats.total_cards.toLocaleString()}`);
        console.log(`   Current eBay Listings: ${ebayStats.total_current.toLocaleString()}`);
        console.log(`   Average eBay Asking: $${ebayStats.avg_ebay_asking.toFixed(2)}`);
        console.log(`   Total Sold (90 days): ${ebayStats.total_sold.toLocaleString()}`);
        console.log(`   Average eBay Sold: $${ebayStats.avg_ebay_sold.toFixed(2)}`);
        console.log(`   eBay Asking vs Sold Ratio: ${ebayStats.avg_asking_sold_ratio.toFixed(2)}x`);
        console.log(`   Average Days to Sell: ${Math.round(ebayStats.avg_days_to_sell)} days`);
    }
    
    // Cross-platform comparison for cards with all data sources
    console.log('\n🔄 CROSS-PLATFORM PRICE COMPARISON:');
    console.log('===================================');
    
    const crossPlatform = pricingDb.prepare(`
        SELECT 
            cc.collector_crypt_id,
            cc.card_name,
            cc.price as cc_asking,
            pc.pokemon_tcg_price,
            pc.tcgplayer_price
        FROM collector_crypt cc
        JOIN pricing_complete pc ON cc.collector_crypt_id = pc.collector_crypt_id
        WHERE cc.game_name = 'Pokemon' 
        AND pc.pokemon_tcg_price IS NOT NULL 
        AND pc.tcgplayer_price IS NOT NULL
        AND cc.price > 100
        ORDER BY cc.price DESC
        LIMIT 10
    `).all();
    
    console.log('\nTop 10 cards with data from all sources:');
    console.log('Card Name | CC Ask | Pokemon TCG | TCGPlayer | CC vs Market');
    console.log(''.padEnd(70, '-'));
    
    crossPlatform.forEach(card => {
        const marketAvg = (card.pokemon_tcg_price + card.tcgplayer_price) / 2;
        const ccVsMarket = card.cc_asking / marketAvg;
        const cardName = card.card_name.length > 20 ? card.card_name.substring(0, 17) + '...' : card.card_name;
        
        console.log(`${cardName.padEnd(20)} | $${card.cc_asking.toFixed(0).padStart(6)} | $${card.pokemon_tcg_price.toFixed(0).padStart(9)} | $${card.tcgplayer_price.toFixed(0).padStart(8)} | ${ccVsMarket.toFixed(2)}x`);
    });
    
    // Final summary
    console.log('\n🎯 MARKET INTELLIGENCE SUMMARY:');
    console.log('===============================');
    
    const totalCards = ccCount.count;
    const cardsWithPricing = pricingCount.count;
    const cardsWithTCG = tcgCount.count;
    const cardsWithEbay = ebayCount.count;
    
    const pricingCoverage = ((cardsWithPricing / totalCards) * 100).toFixed(1);
    const tcgCoverage = ((cardsWithTCG / totalCards) * 100).toFixed(1);
    const ebayCoverage = ((cardsWithEbay / totalCards) * 100).toFixed(1);
    
    console.log(`✅ Total Pokemon Cards in Collector Crypt: ${totalCards.toLocaleString()}`);
    console.log(`📊 Pokemon TCG API Coverage: ${pricingCoverage}% (${cardsWithPricing.toLocaleString()} cards)`);
    console.log(`💰 TCGPlayer Coverage: ${tcgCoverage}% (${cardsWithTCG.toLocaleString()} cards)`);
    console.log(`🛒 eBay Market Data Coverage: ${ebayCoverage}% (${cardsWithEbay.toLocaleString()} cards)`);
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('- Use collector-crypt-pricing-api.js for price lookups');
    console.log('- Use collector-crypt-ebay-api.js for eBay market data');
    console.log('- Query pricing_complete table for opportunity analysis');
    console.log('- Query ebay_price_analytics for market intelligence');
    
    // Close databases
    ccDb.close();
    pricingDb.close();
    ebayDb.close();
}

// Run the report
try {
    generateCompleteMarketReport();
} catch (error) {
    console.error('❌ Error generating market report:', error);
}
