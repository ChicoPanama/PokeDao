#!/usr/bin/env node

/**
 * 🎯 NORMAL VALUE CARDS PRICING ANALYSIS
 * 
 * Analyzes pricing logic and sources for regular/normal valued cards
 * vs high-value cards to understand the pricing strategy
 */

const Database = require('better-sqlite3');

console.log('🎯 NORMAL VALUE CARDS PRICING ANALYSIS');
console.log('=====================================\n');

async function analyzeNormalValueCards() {
    console.log('📊 Loading comprehensive pricing database...');
    
    const finalDb = new Database('collector_crypt_all_cards_fixed.db');
    
    // Define value categories
    console.log('\n📊 VALUE CATEGORY ANALYSIS:');
    
    const valueDistribution = finalDb.prepare(`
        SELECT 
            CASE 
                WHEN adjusted_market_value >= 1000 THEN 'High Value ($1000+)'
                WHEN adjusted_market_value >= 100 THEN 'Mid Value ($100-999)'
                WHEN adjusted_market_value >= 20 THEN 'Low-Mid Value ($20-99)'
                WHEN adjusted_market_value >= 5 THEN 'Normal Value ($5-19)'
                WHEN adjusted_market_value > 0 THEN 'Budget Cards (<$5)'
                ELSE 'No Value Data'
            END as value_category,
            COUNT(*) as card_count,
            AVG(adjusted_market_value) as avg_market_value,
            AVG(cc_asking_price) as avg_asking_price
        FROM collector_crypt_comprehensive_pricing
        GROUP BY 
            CASE 
                WHEN adjusted_market_value >= 1000 THEN 'High Value ($1000+)'
                WHEN adjusted_market_value >= 100 THEN 'Mid Value ($100-999)'
                WHEN adjusted_market_value >= 20 THEN 'Low-Mid Value ($20-99)'
                WHEN adjusted_market_value >= 5 THEN 'Normal Value ($5-19)'
                WHEN adjusted_market_value > 0 THEN 'Budget Cards (<$5)'
                ELSE 'No Value Data'
            END
        ORDER BY avg_market_value DESC
    `).all();
    
    valueDistribution.forEach(category => {
        console.log(`   ${category.value_category}: ${category.card_count.toLocaleString()} cards`);
        console.log(`      Avg Market: $${category.avg_market_value?.toFixed(2) || '0'} | Avg Ask: $${category.avg_asking_price?.toFixed(2) || '0'}`);
    });
    
    // Analyze source selection by value category
    console.log('\n🎯 PRICING SOURCE BY VALUE CATEGORY:');
    
    const sourceByValue = finalDb.prepare(`
        SELECT 
            CASE 
                WHEN adjusted_market_value >= 1000 THEN 'High Value ($1000+)'
                WHEN adjusted_market_value >= 100 THEN 'Mid Value ($100-999)'
                WHEN adjusted_market_value >= 20 THEN 'Low-Mid Value ($20-99)'
                WHEN adjusted_market_value >= 5 THEN 'Normal Value ($5-19)'
                WHEN adjusted_market_value > 0 THEN 'Budget Cards (<$5)'
            END as value_category,
            market_source,
            COUNT(*) as count,
            AVG(market_confidence) as avg_confidence,
            AVG(adjusted_market_value) as avg_value
        FROM collector_crypt_comprehensive_pricing
        WHERE adjusted_market_value > 0
        GROUP BY value_category, market_source
        ORDER BY value_category, count DESC
    `).all();
    
    const categories = [...new Set(sourceByValue.map(row => row.value_category))];
    
    categories.forEach(category => {
        console.log(`\n   📈 ${category}:`);
        const categorySources = sourceByValue.filter(row => row.value_category === category);
        
        categorySources.forEach(source => {
            const percentage = (source.count / categorySources.reduce((sum, s) => sum + s.count, 0) * 100);
            console.log(`      ${source.market_source}: ${source.count.toLocaleString()} cards (${percentage.toFixed(1)}%)`);
            console.log(`         Confidence: ${source.avg_confidence?.toFixed(0) || '0'}% | Avg Value: $${source.avg_value?.toFixed(2) || '0'}`);
        });
    });
    
    // Deep dive on normal value cards ($5-19 range)
    console.log('\n🔍 DEEP DIVE: NORMAL VALUE CARDS ($5-19):');
    
    const normalValueCards = finalDb.prepare(`
        SELECT 
            market_source,
            COUNT(*) as count,
            AVG(market_confidence) as avg_confidence,
            AVG(adjusted_market_value) as avg_market,
            AVG(cc_asking_price) as avg_asking,
            AVG(ptcg_price) as avg_ptcg,
            AVG(tcgp_price) as avg_tcgp,
            AVG(ebay_sold_price) as avg_ebay_sold,
            AVG(ebay_current_price) as avg_ebay_current,
            COUNT(CASE WHEN ptcg_valid = 1 THEN 1 END) as ptcg_valid_count,
            COUNT(CASE WHEN tcgp_valid = 1 THEN 1 END) as tcgp_valid_count,
            COUNT(CASE WHEN ebay_valid = 1 THEN 1 END) as ebay_valid_count
        FROM collector_crypt_comprehensive_pricing
        WHERE adjusted_market_value >= 5 AND adjusted_market_value < 20
        GROUP BY market_source
        ORDER BY count DESC
    `).all();
    
    const normalTotal = normalValueCards.reduce((sum, source) => sum + source.count, 0);
    
    normalValueCards.forEach(source => {
        const percentage = (source.count / normalTotal * 100);
        console.log(`\n   🎯 ${source.market_source}: ${source.count.toLocaleString()} cards (${percentage.toFixed(1)}%)`);
        console.log(`      Confidence: ${source.avg_confidence?.toFixed(0) || '0'}%`);
        console.log(`      Market Value: $${source.avg_market?.toFixed(2) || '0'}`);
        console.log(`      Available Sources:`);
        console.log(`         Pokemon TCG: ${source.ptcg_valid_count} valid (avg: $${source.avg_ptcg?.toFixed(2) || '0'})`);
        console.log(`         TCGPlayer: ${source.tcgp_valid_count} valid (avg: $${source.avg_tcgp?.toFixed(2) || '0'})`);
        console.log(`         eBay: ${source.ebay_valid_count} valid (avg sold: $${source.avg_ebay_sold?.toFixed(2) || '0'})`);
    });
    
    // Compare graded vs raw for normal cards
    console.log('\n⚖️  GRADED vs RAW CARDS LOGIC:');
    
    const gradedVsRaw = finalDb.prepare(`
        SELECT 
            CASE WHEN is_graded = 1 THEN 'Graded Cards' ELSE 'Raw Cards' END as card_type,
            market_source,
            COUNT(*) as count,
            AVG(market_confidence) as avg_confidence,
            AVG(grading_multiplier) as avg_multiplier
        FROM collector_crypt_comprehensive_pricing
        WHERE adjusted_market_value >= 5 AND adjusted_market_value < 100
        GROUP BY card_type, market_source
        ORDER BY card_type, count DESC
    `).all();
    
    ['Graded Cards', 'Raw Cards'].forEach(cardType => {
        console.log(`\n   🎴 ${cardType}:`);
        const typeData = gradedVsRaw.filter(row => row.card_type === cardType);
        const typeTotal = typeData.reduce((sum, s) => sum + s.count, 0);
        
        typeData.forEach(source => {
            const percentage = (source.count / typeTotal * 100);
            console.log(`      ${source.market_source}: ${source.count.toLocaleString()} cards (${percentage.toFixed(1)}%)`);
            console.log(`         Confidence: ${source.avg_confidence?.toFixed(0)}% | Multiplier: ${source.avg_multiplier?.toFixed(2)}x`);
        });
    });
    
    // Sample normal value cards with different sources
    console.log('\n📋 SAMPLE NORMAL VALUE CARDS BY SOURCE:');
    
    const sampleCards = finalDb.prepare(`
        SELECT 
            cc_title,
            cc_asking_price,
            adjusted_market_value,
            market_source,
            market_confidence,
            is_graded,
            card_category,
            ptcg_price,
            tcgp_price,
            ebay_sold_price
        FROM collector_crypt_comprehensive_pricing
        WHERE adjusted_market_value >= 5 AND adjusted_market_value < 20
        ORDER BY market_source, adjusted_market_value DESC
        LIMIT 15
    `).all();
    
    const groupedSamples = sampleCards.reduce((acc, card) => {
        if (!acc[card.market_source]) acc[card.market_source] = [];
        acc[card.market_source].push(card);
        return acc;
    }, {});
    
    Object.entries(groupedSamples).forEach(([source, cards]) => {
        console.log(`\n   💡 ${source} Examples:`);
        cards.slice(0, 3).forEach((card, i) => {
            console.log(`      ${i+1}. ${card.cc_title.substring(0, 50)}...`);
            console.log(`         Ask: $${card.cc_asking_price} | Market: $${card.adjusted_market_value.toFixed(2)} | ${card.is_graded ? 'Graded' : 'Raw'} ${card.card_category}`);
            console.log(`         Sources: PTCG: $${card.ptcg_price || 0} | TCG: $${card.tcgp_price || 0} | eBay: $${card.ebay_sold_price || 0}`);
        });
    });
    
    // Source reliability analysis
    console.log('\n📊 SOURCE RELIABILITY FOR NORMAL CARDS:');
    
    const reliability = finalDb.prepare(`
        SELECT 
            market_source,
            AVG(market_confidence) as avg_confidence,
            COUNT(*) as usage_count,
            AVG(asking_vs_market_ratio) as avg_ratio,
            COUNT(CASE WHEN price_opportunity = 'UNDERPRICED' THEN 1 END) as underpriced_found,
            COUNT(CASE WHEN price_opportunity = 'OVERPRICED' THEN 1 END) as overpriced_found
        FROM collector_crypt_comprehensive_pricing
        WHERE adjusted_market_value >= 5 AND adjusted_market_value < 100
        GROUP BY market_source
        ORDER BY usage_count DESC
    `).all();
    
    reliability.forEach(source => {
        console.log(`\n   📈 ${source.market_source}:`);
        console.log(`      Usage: ${source.usage_count.toLocaleString()} cards`);
        console.log(`      Confidence: ${source.avg_confidence?.toFixed(0)}%`);
        console.log(`      Avg Ask/Market Ratio: ${source.avg_ratio?.toFixed(2)}x`);
        console.log(`      Opportunities: ${source.underpriced_found} underpriced | ${source.overpriced_found} overpriced`);
    });
    
    console.log('\n🎯 KEY INSIGHTS:');
    console.log('================');
    
    // Calculate key insights
    const ebayDominance = normalValueCards.find(s => s.market_source === 'eBay Sold');
    const ptcgUsage = normalValueCards.find(s => s.market_source === 'Pokemon TCG API');
    const tcgUsage = normalValueCards.find(s => s.market_source === 'TCGPlayer');
    
    if (ebayDominance && ebayDominance.count > normalTotal * 0.8) {
        console.log('✅ eBay Sold prices dominate normal value cards (80%+ usage)');
        console.log('   - System prioritizes real transaction data over list prices');
        console.log('   - High confidence in actual market values');
    }
    
    if (ptcgUsage && ptcgUsage.count > 0) {
        console.log(`✅ Pokemon TCG API used for ${ptcgUsage.count} normal cards`);
        console.log('   - Reliable fallback when eBay data unavailable');
        console.log(`   - Average confidence: ${ptcgUsage.avg_confidence?.toFixed(0)}%`);
    }
    
    if (tcgUsage && tcgUsage.count > 0) {
        console.log(`✅ TCGPlayer used for ${tcgUsage.count} normal cards`);
        console.log('   - After filtering out suspicious low prices');
        console.log(`   - Average confidence: ${tcgUsage.avg_confidence?.toFixed(0)}%`);
    }
    
    finalDb.close();
}

analyzeNormalValueCards().catch(console.error);
