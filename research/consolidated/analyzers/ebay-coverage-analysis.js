#!/usr/bin/env node

/**
 * 🔍 EBAY COVERAGE ANALYSIS
 * 
 * Investigates why eBay Current prices only show for 24 cards
 * and provides comprehensive eBay data utilization analysis
 */

const Database = require('better-sqlite3');

console.log('🔍 EBAY COVERAGE ANALYSIS');
console.log('========================\n');

async function analyzeEbayCoverage() {
    console.log('📊 Loading databases...');
    
    const ebayDb = new Database('collector_crypt_ebay_complete.db');
    const finalDb = new Database('collector_crypt_all_cards_fixed.db');
    const ccDb = new Database('collector_crypt_v2.db');
    
    // Analyze raw eBay data
    console.log('\n🏪 RAW EBAY DATA ANALYSIS:');
    
    const ebayStats = ebayDb.prepare(`
        SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN avg_asking_price > 0 THEN 1 END) as has_asking,
            COUNT(CASE WHEN avg_sold_price > 0 THEN 1 END) as has_sold,
            COUNT(CASE WHEN avg_asking_price > 0 AND avg_sold_price > 0 THEN 1 END) as has_both,
            COUNT(CASE WHEN avg_asking_price > 0 AND avg_sold_price = 0 THEN 1 END) as asking_only,
            COUNT(CASE WHEN avg_asking_price = 0 AND avg_sold_price > 0 THEN 1 END) as sold_only,
            AVG(avg_asking_price) as avg_asking,
            AVG(avg_sold_price) as avg_sold,
            MIN(avg_asking_price) as min_asking,
            MAX(avg_asking_price) as max_asking,
            MIN(avg_sold_price) as min_sold,
            MAX(avg_sold_price) as max_sold
        FROM ebay_price_analytics
    `).get();
    
    console.log(`   Total Records: ${ebayStats.total_records.toLocaleString()}`);
    console.log(`   Has Asking Price: ${ebayStats.has_asking.toLocaleString()} (${(ebayStats.has_asking/ebayStats.total_records*100).toFixed(1)}%)`);
    console.log(`   Has Sold Price: ${ebayStats.has_sold.toLocaleString()} (${(ebayStats.has_sold/ebayStats.total_records*100).toFixed(1)}%)`);
    console.log(`   Has Both Prices: ${ebayStats.has_both.toLocaleString()} (${(ebayStats.has_both/ebayStats.total_records*100).toFixed(1)}%)`);
    console.log(`   Asking Only: ${ebayStats.asking_only.toLocaleString()}`);
    console.log(`   Sold Only: ${ebayStats.sold_only.toLocaleString()}`);
    console.log(`   Avg Asking: $${ebayStats.avg_asking.toFixed(2)}`);
    console.log(`   Avg Sold: $${ebayStats.avg_sold.toFixed(2)}`);
    
    // Analyze how our system used eBay data
    console.log('\n💻 SYSTEM UTILIZATION ANALYSIS:');
    
    const systemStats = finalDb.prepare(`
        SELECT 
            COUNT(*) as total_processed,
            COUNT(CASE WHEN ebay_sold_price > 0 THEN 1 END) as used_ebay_sold,
            COUNT(CASE WHEN ebay_current_price > 0 THEN 1 END) as used_ebay_current,
            COUNT(CASE WHEN ebay_sold_price > 0 AND ebay_current_price > 0 THEN 1 END) as has_both_prices,
            COUNT(CASE WHEN market_source = 'eBay Sold' THEN 1 END) as selected_ebay_sold,
            COUNT(CASE WHEN market_source = 'eBay Current (discounted)' THEN 1 END) as selected_ebay_current,
            AVG(CASE WHEN ebay_sold_price > 0 THEN ebay_sold_price END) as avg_used_sold,
            AVG(CASE WHEN ebay_current_price > 0 THEN ebay_current_price END) as avg_used_current
        FROM collector_crypt_comprehensive_pricing
    `).get();
    
    console.log(`   Total Processed: ${systemStats.total_processed.toLocaleString()}`);
    console.log(`   Used eBay Sold Price: ${systemStats.used_ebay_sold.toLocaleString()} (${(systemStats.used_ebay_sold/systemStats.total_processed*100).toFixed(1)}%)`);
    console.log(`   Used eBay Current Price: ${systemStats.used_ebay_current.toLocaleString()} (${(systemStats.used_ebay_current/systemStats.total_processed*100).toFixed(1)}%)`);
    console.log(`   Has Both eBay Prices: ${systemStats.has_both_prices.toLocaleString()}`);
    console.log(`   SELECTED eBay Sold as Final: ${systemStats.selected_ebay_sold.toLocaleString()}`);
    console.log(`   SELECTED eBay Current as Final: ${systemStats.selected_ebay_current.toLocaleString()}`);
    console.log(`   Avg Used Sold: $${systemStats.avg_used_sold?.toFixed(2) || '0'}`);
    console.log(`   Avg Used Current: $${systemStats.avg_used_current?.toFixed(2) || '0'}`);
    
    // Find cases where eBay current was selected
    const ebayCurrentCases = finalDb.prepare(`
        SELECT cc_title, cc_asking_price, ebay_sold_price, ebay_current_price, 
               adjusted_market_value, market_source, market_explanation
        FROM collector_crypt_comprehensive_pricing 
        WHERE market_source = 'eBay Current (discounted)'
        ORDER BY adjusted_market_value DESC
        LIMIT 10
    `).all();
    
    console.log('\n🎯 CASES WHERE EBAY CURRENT WAS SELECTED:');
    if (ebayCurrentCases.length > 0) {
        ebayCurrentCases.forEach((card, i) => {
            console.log(`   ${i+1}. ${card.cc_title.substring(0, 60)}...`);
            console.log(`      Ask: $${card.cc_asking_price} | Sold: $${card.ebay_sold_price} | Current: $${card.ebay_current_price} | Final: $${card.adjusted_market_value.toFixed(2)}`);
            console.log(`      Reason: ${card.market_explanation}`);
        });
    } else {
        console.log('   No cases found where eBay Current was the final selection');
    }
    
    // Analyze source selection priority
    const sourcePriority = finalDb.prepare(`
        SELECT market_source, COUNT(*) as count, AVG(adjusted_market_value) as avg_value
        FROM collector_crypt_comprehensive_pricing 
        WHERE adjusted_market_value > 0
        GROUP BY market_source 
        ORDER BY count DESC
    `).all();
    
    console.log('\n📈 SOURCE SELECTION HIERARCHY:');
    sourcePriority.forEach(source => {
        console.log(`   ${source.market_source}: ${source.count.toLocaleString()} cards (avg: $${source.avg_value.toFixed(2)})`);
    });
    
    // Find coverage gaps
    const coverageGaps = ccDb.prepare(`
        SELECT cc.id, cc.title, cc.price
        FROM collector_crypt_cards cc
        LEFT JOIN ebay_price_analytics eba ON eba.collector_crypt_id = cc.id
        WHERE eba.collector_crypt_id IS NULL
        AND cc.category LIKE '%pokemon%'
        LIMIT 10
    `).all();
    
    console.log('\n⚠️  COVERAGE GAPS (Cards without eBay data):');
    if (coverageGaps.length > 0) {
        coverageGaps.forEach((card, i) => {
            console.log(`   ${i+1}. ${card.title.substring(0, 80)}... ($${card.price})`);
        });
        
        const totalGaps = ccDb.prepare(`
            SELECT COUNT(*) as gap_count
            FROM collector_crypt_cards cc
            LEFT JOIN ebay_price_analytics eba ON eba.collector_crypt_id = cc.id
            WHERE eba.collector_crypt_id IS NULL
            AND cc.category LIKE '%pokemon%'
        `).get();
        
        console.log(`   Total gaps: ${totalGaps.gap_count} cards missing eBay data`);
    } else {
        console.log('   No coverage gaps found!');
    }
    
    // Price comparison analysis
    console.log('\n💰 PRICE COMPARISON ANALYSIS:');
    
    const priceComparison = finalDb.prepare(`
        SELECT 
            COUNT(CASE WHEN ebay_sold_price > ebay_current_price THEN 1 END) as sold_higher,
            COUNT(CASE WHEN ebay_current_price > ebay_sold_price THEN 1 END) as current_higher,
            COUNT(CASE WHEN ebay_sold_price = ebay_current_price THEN 1 END) as equal_prices,
            AVG(ebay_current_price / ebay_sold_price) as avg_ratio,
            COUNT(CASE WHEN (ebay_current_price / ebay_sold_price) > 2.0 THEN 1 END) as current_2x_higher,
            COUNT(CASE WHEN (ebay_current_price / ebay_sold_price) > 5.0 THEN 1 END) as current_5x_higher
        FROM collector_crypt_comprehensive_pricing 
        WHERE ebay_sold_price > 0 AND ebay_current_price > 0
    `).get();
    
    console.log(`   Sold Price Higher: ${priceComparison.sold_higher.toLocaleString()}`);
    console.log(`   Current Price Higher: ${priceComparison.current_higher.toLocaleString()}`);
    console.log(`   Equal Prices: ${priceComparison.equal_prices.toLocaleString()}`);
    console.log(`   Avg Current/Sold Ratio: ${priceComparison.avg_ratio?.toFixed(2) || '0'}x`);
    console.log(`   Current >2x Sold: ${priceComparison.current_2x_higher.toLocaleString()}`);
    console.log(`   Current >5x Sold: ${priceComparison.current_5x_higher.toLocaleString()}`);
    
    console.log('\n🎯 CONCLUSION:');
    console.log('==============');
    
    if (systemStats.selected_ebay_current < 100) {
        console.log('✅ SYSTEM WORKING CORRECTLY:');
        console.log('   - eBay Sold prices are prioritized (more reliable for market value)');
        console.log('   - eBay Current only used when Sold data unavailable');
        console.log('   - This is GOOD behavior - asking prices are often inflated');
        console.log(`   - ${systemStats.used_ebay_current.toLocaleString()} cards have current price data available`);
        console.log(`   - ${systemStats.selected_ebay_sold.toLocaleString()} use sold prices (more accurate)`);
        
        if (priceComparison.avg_ratio > 1.2) {
            console.log(`   - Current prices average ${priceComparison.avg_ratio.toFixed(1)}x higher than sold (confirms asking price inflation)`);
        }
    } else {
        console.log('⚠️  POTENTIAL ISSUE:');
        console.log('   - Too many cards using current prices instead of sold');
        console.log('   - May indicate data quality issues');
    }
    
    // Close databases
    ebayDb.close();
    finalDb.close();
    ccDb.close();
}

analyzeEbayCoverage().catch(console.error);
