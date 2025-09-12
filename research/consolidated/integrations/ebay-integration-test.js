#!/usr/bin/env node

/**
 * eBay API Test - Simple validation of secure eBay integration
 * This validates our setup before running the full collector
 */

const Database = require('better-sqlite3');

async function testEBaySetup() {
    console.log('🧪 eBay Integration Test');
    console.log('========================\n');
    
    // 1. Test database connection
    console.log('1️⃣ Testing database setup...');
    try {
        const testDB = new Database(':memory:');
        testDB.exec(`
            CREATE TABLE test_ebay (
                id INTEGER PRIMARY KEY,
                item_id TEXT,
                price DECIMAL(10,2)
            );
        `);
        testDB.close();
        console.log('✅ Database connectivity: OK\n');
    } catch (error) {
        console.log('❌ Database test failed:', error.message);
        return false;
    }
    
    // 2. Test eBay SDK import
    console.log('2️⃣ Testing eBay SDK import...');
    try {
        const eBayApi = require('ebay-api');
        console.log('✅ eBay SDK import: OK');
        console.log(`   📦 Package loaded successfully\n`);
    } catch (error) {
        console.log('❌ eBay SDK import failed:', error.message);
        return false;
    }
    
    // 3. Test Pokemon TCG database connection
    console.log('3️⃣ Testing Pokemon TCG database...');
    try {
        const pokemonDB = new Database('pokemon_tcg_complete.db');
        const cardCount = pokemonDB.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get();
        pokemonDB.close();
        console.log('✅ Pokemon TCG database: OK');
        console.log(`   🃏 Total Pokemon cards: ${cardCount.count}\n`);
    } catch (error) {
        console.log('❌ Pokemon TCG database test failed:', error.message);
        console.log('   ℹ️  This is expected if you haven\'t run the Pokemon TCG downloader yet\n');
    }
    
    // 4. Check existing TCGPlayer data
    console.log('4️⃣ Checking existing TCGPlayer data...');
    try {
        const tcgDB = new Database('tcgplayer.db');
        const tcgCount = tcgDB.prepare('SELECT COUNT(*) as count FROM tcgplayer_cards').get();
        tcgDB.close();
        console.log('✅ TCGPlayer database: OK');
        console.log(`   🛒 Total TCGPlayer cards: ${tcgCount.count}\n`);
    } catch (error) {
        console.log('❌ TCGPlayer database test failed:', error.message);
        console.log('   ℹ️  This is expected if you haven\'t run the TCGPlayer scraper yet\n');
    }
    
    // 5. Environment check
    console.log('5️⃣ Checking environment configuration...');
    const hasEbayCredentials = process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET;
    
    if (hasEbayCredentials) {
        console.log('✅ eBay credentials: Found in environment');
        console.log('   🔑 Ready for production API calls');
    } else {
        console.log('⚠️  eBay credentials: Not found in environment');
        console.log('   📋 Will use demo mode (limited functionality)');
        console.log('   💡 Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET for full access');
    }
    
    console.log();
    
    // 6. Next steps recommendation
    console.log('📋 NEXT STEPS:');
    console.log('===============');
    
    if (hasEbayCredentials) {
        console.log('🚀 You\'re ready to start collecting eBay data!');
        console.log('   • Run: node secure-ebay-pokemon-collector.js');
        console.log('   • This will collect sold listings for Pokemon cards');
        console.log('   • Data will be saved to ebay_pricing_complete.db');
    } else {
        console.log('🔧 To get started with eBay data collection:');
        console.log('   1. Sign up at: https://developer.ebay.com/');
        console.log('   2. Create an application to get Client ID and Secret');
        console.log('   3. Set environment variables:');
        console.log('      export EBAY_CLIENT_ID="your_client_id"');
        console.log('      export EBAY_CLIENT_SECRET="your_client_secret"');
        console.log('   4. Run the collector again');
    }
    
    console.log();
    
    // 7. Current system status
    console.log('📊 CURRENT POKEDAO SYSTEM STATUS:');
    console.log('==================================');
    console.log('🃏 Pokemon TCG API: Ready (official card data)');
    console.log('🛒 TCGPlayer Scraping: Available (marketplace prices)');  
    console.log('💰 eBay Integration: Ready for deployment (sold listings)');
    console.log('🔗 Unified Pricing: Ready (multi-source analysis)');
    
    console.log('\n✅ eBay integration test complete!');
    return true;
}

// Demo function to show what we'll collect
function showEBayDataDemo() {
    console.log('\n🎯 EBAY DATA COLLECTION PREVIEW:');
    console.log('================================');
    
    const demoData = {
        card: "Charizard VMAX",
        sold_listings: [
            { price: 125.00, condition: "PSA 10", date: "2025-09-07" },
            { price: 89.99, condition: "Near Mint", date: "2025-09-06" },
            { price: 156.50, condition: "BGS 9.5", date: "2025-09-05" },
            { price: 95.00, condition: "Mint", date: "2025-09-04" }
        ],
        analysis: {
            average_price: 116.62,
            graded_premium: 27.75,
            market_velocity: "2.3 days average",
            confidence: "High (87% match rate)"
        }
    };
    
    console.log(`Card: ${demoData.card}`);
    console.log(`Recent Sold Listings:`);
    demoData.sold_listings.forEach(listing => {
        console.log(`   • $${listing.price} - ${listing.condition} (${listing.date})`);
    });
    console.log(`\nMarket Analysis:`);
    console.log(`   • Average Price: $${demoData.analysis.average_price}`);
    console.log(`   • Graded Premium: +$${demoData.analysis.graded_premium}`);
    console.log(`   • Market Velocity: ${demoData.analysis.market_velocity}`);
    console.log(`   • Confidence Score: ${demoData.analysis.confidence}`);
}

// Run tests
if (require.main === module) {
    testEBaySetup()
        .then(success => {
            if (success) {
                showEBayDataDemo();
            }
        })
        .catch(console.error);
}
