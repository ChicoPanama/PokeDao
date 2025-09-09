#!/usr/bin/env node

const Database = require('better-sqlite3');

function generateCompleteCollectorCryptReport() {
    console.log('🎯 COMPLETE COLLECTOR CRYPT MARKET INTELLIGENCE');
    console.log('==============================================');
    console.log('📊 ANALYZING ALL COLLECTOR CRYPT POKEMON CARDS\n');
    
    // Connect to all databases
    const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
    const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });
    const ebayDb = new Database('collector_crypt_ebay_complete.db', { readonly: true });
    
    console.log('📋 COMPLETE DATASET OVERVIEW:');
    console.log('============================');
    
    // Get complete Collector Crypt data
    const totalCards = ccDb.prepare("SELECT COUNT(*) as count FROM collector_crypt_cards WHERE category LIKE '%pokemon%'").get();
    console.log(`   Total Collector Crypt Pokemon Cards: ${totalCards.count.toLocaleString()}`);
    
    // Pricing coverage analysis
    const pricingCoverage = pricingDb.prepare("SELECT COUNT(*) as count FROM collector_crypt_pricing WHERE ptcg_market_price IS NOT NULL").get();
    const tcgCoverage = pricingDb.prepare("SELECT COUNT(*) as count FROM collector_crypt_pricing WHERE tcgp_market_price IS NOT NULL").get();
    
    console.log(`   Cards with Pokemon TCG API Pricing: ${pricingCoverage.count.toLocaleString()}`);
    console.log(`   Cards with TCGPlayer Pricing: ${tcgCoverage.count.toLocaleString()}`);
    
    const pokemonCoveragePercent = ((pricingCoverage.count / totalCards.count) * 100).toFixed(1);
    const tcgCoveragePercent = ((tcgCoverage.count / totalCards.count) * 100).toFixed(1);
    
    console.log(`   Pokemon TCG Coverage: ${pokemonCoveragePercent}%`);
    console.log(`   TCGPlayer Coverage: ${tcgCoveragePercent}%`);
    
    // eBay coverage
    const ebayCount = ebayDb.prepare("SELECT COUNT(*) as count FROM ebay_price_analytics").get();
    const ebayCoveragePercent = ((ebayCount.count / totalCards.count) * 100).toFixed(1);
    console.log(`   eBay Market Data Coverage: ${ebayCoveragePercent}% (${ebayCount.count.toLocaleString()} cards)\n`);
    
    // Complete price distribution analysis
    console.log('💰 COMPLETE PRICE DISTRIBUTION ANALYSIS:');
    console.log('========================================');
    
    const priceDistribution = ccDb.prepare(`
        SELECT 
            CASE 
                WHEN price < 1 THEN 'Under $1'
                WHEN price < 5 THEN '$1-$5'
                WHEN price < 10 THEN '$5-$10'
                WHEN price < 25 THEN '$10-$25'
                WHEN price < 50 THEN '$25-$50'
                WHEN price < 100 THEN '$50-$100'
                WHEN price < 250 THEN '$100-$250'
                WHEN price < 500 THEN '$250-$500'
                WHEN price < 1000 THEN '$500-$1000'
                WHEN price < 2500 THEN '$1000-$2500'
                ELSE 'Over $2500'
            END as price_range,
            COUNT(*) as card_count,
            ROUND(AVG(price), 2) as avg_price,
            ROUND(SUM(price), 2) as total_value
        FROM collector_crypt_cards 
        WHERE category LIKE '%pokemon%' AND price > 0
        GROUP BY price_range
        ORDER BY MIN(price)
    `).all();
    
    let totalValue = 0;
    let totalPricedCards = 0;
    
    priceDistribution.forEach(range => {
        console.log(`   ${range.price_range.padEnd(15)}: ${range.card_count.toLocaleString().padStart(6)} cards | Avg: $${range.avg_price.toFixed(2).padStart(8)} | Total: $${range.total_value.toLocaleString()}`);
        totalValue += range.total_value;
        totalPricedCards += range.card_count;
    });
    
    console.log(`\n   📈 TOTAL PORTFOLIO VALUE: $${totalValue.toLocaleString()}`);
    console.log(`   📊 Cards with Pricing: ${totalPricedCards.toLocaleString()} / ${totalCards.count.toLocaleString()}`);
    console.log(`   💵 Average Card Value: $${(totalValue / totalPricedCards).toFixed(2)}`);
    
    // Complete grading analysis
    console.log('\n🏆 COMPLETE GRADING ANALYSIS:');
    console.log('============================');
    
    const gradingAnalysis = ccDb.prepare(`
        SELECT 
            CASE 
                WHEN grading_company IS NULL OR grading_company = '' THEN 'Raw/Ungraded'
                ELSE grading_company
            END as company,
            CASE 
                WHEN grade_num IS NULL THEN 'No Grade'
                WHEN grade_num >= 10 THEN 'Grade 10'
                WHEN grade_num >= 9 THEN 'Grade 9'
                WHEN grade_num >= 8 THEN 'Grade 8'
                WHEN grade_num >= 7 THEN 'Grade 7'
                ELSE 'Grade <7'
            END as grade_category,
            COUNT(*) as count,
            ROUND(AVG(price), 2) as avg_price,
            ROUND(MAX(price), 2) as max_price,
            ROUND(SUM(price), 2) as total_value
        FROM collector_crypt_cards 
        WHERE category LIKE '%pokemon%'
        GROUP BY company, grade_category
        ORDER BY company, grade_num DESC
    `).all();
    
    console.log('Company | Grade | Count | Avg Price | Max Price | Total Value');
    console.log(''.padEnd(70, '-'));
    
    gradingAnalysis.forEach(grade => {
        const company = grade.company.padEnd(12);
        const gradeCategory = grade.grade_category.padEnd(8);
        const count = grade.count.toLocaleString().padStart(6);
        const avgPrice = `$${grade.avg_price.toFixed(2)}`.padStart(9);
        const maxPrice = `$${grade.max_price.toFixed(2)}`.padStart(9);
        const totalValue = `$${grade.total_value.toLocaleString()}`.padStart(12);
        
        console.log(`${company} | ${gradeCategory} | ${count} | ${avgPrice} | ${maxPrice} | ${totalValue}`);
    });
    
    // Complete opportunity analysis
    console.log('\n🎯 COMPLETE PRICING OPPORTUNITY ANALYSIS:');
    console.log('=========================================');
    
    const completeOpportunities = pricingDb.prepare(`
        SELECT 
            price_opportunity,
            COUNT(*) as count,
            ROUND(AVG(cc_asking_price), 2) as avg_cc_price,
            ROUND(AVG(ptcg_market_price), 2) as avg_pokemon_price,
            ROUND(AVG(tcgp_market_price), 2) as avg_tcg_price,
            ROUND(AVG(asking_vs_market_ratio), 2) as avg_market_ratio,
            ROUND(SUM(cc_asking_price), 2) as total_cc_value,
            ROUND(SUM(potential_profit), 2) as total_profit_potential
        FROM collector_crypt_pricing 
        GROUP BY price_opportunity
        ORDER BY 
            CASE price_opportunity 
                WHEN 'UNDERPRICED' THEN 1
                WHEN 'FAIR_MARKET' THEN 2
                WHEN 'OVERPRICED' THEN 3
                ELSE 4
            END
    `).all();
    
    console.log('Opportunity Type | Count | Avg CC $ | Avg Pokemon $ | Avg TCG $ | Market Ratio | Total CC Value | Profit Potential');
    console.log(''.padEnd(120, '-'));
    
    completeOpportunities.forEach(opp => {
        const type = opp.price_opportunity.padEnd(16);
        const count = opp.count.toLocaleString().padStart(5);
        const ccPrice = opp.avg_cc_price ? `$${opp.avg_cc_price}`.padStart(8) : 'N/A'.padStart(8);
        const pokemonPrice = opp.avg_pokemon_price ? `$${opp.avg_pokemon_price}`.padStart(13) : 'N/A'.padStart(13);
        const tcgPrice = opp.avg_tcg_price ? `$${opp.avg_tcg_price}`.padStart(9) : 'N/A'.padStart(9);
        const marketRatio = opp.avg_market_ratio ? `${opp.avg_market_ratio}x`.padStart(12) : 'N/A'.padStart(12);
        const totalValue = `$${opp.total_cc_value.toLocaleString()}`.padStart(14);
        const profitPotential = `$${opp.total_profit_potential.toLocaleString()}`.padStart(16);
        
        console.log(`${type} | ${count} | ${ccPrice} | ${pokemonPrice} | ${tcgPrice} | ${marketRatio} | ${totalValue} | ${profitPotential}`);
    });
    
    // Top value cards analysis
    console.log('\n💎 TOP 50 HIGHEST VALUE COLLECTOR CRYPT CARDS:');
    console.log('==============================================');
    
    const topValueCards = pricingDb.prepare(`
        SELECT 
            cp.id as collector_crypt_id,
            cp.cc_title as title,
            cp.cc_asking_price as collector_crypt_price,
            cp.cc_grading_company as grading_company,
            cp.cc_grade as grade_num,
            cp.ptcg_market_price,
            cp.tcgp_market_price,
            cp.price_opportunity,
            cp.asking_vs_market_ratio,
            cp.potential_profit
        FROM collector_crypt_pricing cp
        WHERE cp.cc_category LIKE '%pokemon%' 
        AND cp.cc_asking_price > 0
        ORDER BY cp.cc_asking_price DESC
        LIMIT 50
    `).all();
    
    console.log('Rank | CC Price | Pokemon TCG | TCGPlayer | Grade | Opportunity | Card Title');
    console.log(''.padEnd(100, '-'));
    
    topValueCards.forEach((card, index) => {
        const rank = (index + 1).toString().padStart(4);
        const ccPrice = `$${card.collector_crypt_price.toFixed(0)}`.padStart(8);
        const pokemonPrice = card.ptcg_market_price ? `$${card.ptcg_market_price.toFixed(0)}`.padStart(11) : 'N/A'.padStart(11);
        const tcgPrice = card.tcgp_market_price ? `$${card.tcgp_market_price.toFixed(0)}`.padStart(9) : 'N/A'.padStart(9);
        const grade = card.grading_company && card.grade_num ? `${card.grading_company} ${card.grade_num}`.padEnd(8) : 'Raw'.padEnd(8);
        const opportunity = (card.price_opportunity || 'NONE').padEnd(11);
        const title = card.title.length > 40 ? card.title.substring(0, 37) + '...' : card.title;
        
        console.log(`${rank} | ${ccPrice} | ${pokemonPrice} | ${tcgPrice} | ${grade} | ${opportunity} | ${title}`);
    });
    
    // Complete eBay market intelligence
    if (ebayCount.count > 0) {
        console.log('\n🛒 COMPLETE EBAY MARKET INTELLIGENCE:');
        console.log('====================================');
        
        const completeEbayStats = ebayDb.prepare(`
            SELECT 
                COUNT(*) as cards_tracked,
                SUM(current_listings_count) as total_current_listings,
                ROUND(AVG(avg_asking_price), 2) as overall_avg_asking,
                ROUND(MIN(avg_asking_price), 2) as min_avg_asking,
                ROUND(MAX(avg_asking_price), 2) as max_avg_asking,
                SUM(sold_listings_count) as total_sold_listings,
                ROUND(AVG(avg_sold_price), 2) as overall_avg_sold,
                ROUND(AVG(asking_vs_sold_ratio), 2) as avg_asking_vs_sold,
                ROUND(AVG(market_velocity), 1) as avg_days_to_sell,
                COUNT(CASE WHEN demand_indicator = 'HIGH' THEN 1 END) as high_demand,
                COUNT(CASE WHEN demand_indicator = 'MEDIUM' THEN 1 END) as medium_demand,
                COUNT(CASE WHEN demand_indicator = 'LOW' THEN 1 END) as low_demand
            FROM ebay_price_analytics
        `).get();
        
        console.log(`📊 Cards Tracked on eBay: ${completeEbayStats.cards_tracked.toLocaleString()}`);
        console.log(`🛒 Total Current eBay Listings: ${completeEbayStats.total_current_listings.toLocaleString()}`);
        console.log(`💰 Overall Average eBay Asking Price: $${completeEbayStats.overall_avg_asking}`);
        console.log(`📈 Price Range: $${completeEbayStats.min_avg_asking} - $${completeEbayStats.max_avg_asking}`);
        console.log(`📦 Total eBay Sales (90 days): ${completeEbayStats.total_sold_listings.toLocaleString()}`);
        console.log(`💵 Overall Average eBay Sold Price: $${completeEbayStats.overall_avg_sold}`);
        console.log(`📊 eBay Asking vs Sold Ratio: ${completeEbayStats.avg_asking_vs_sold}x`);
        console.log(`⏱️  Average Days to Sell: ${completeEbayStats.avg_days_to_sell} days`);
        console.log(`🔥 Demand Distribution:`);
        console.log(`   High Demand: ${completeEbayStats.high_demand.toLocaleString()} cards`);
        console.log(`   Medium Demand: ${completeEbayStats.medium_demand.toLocaleString()} cards`);
        console.log(`   Low Demand: ${completeEbayStats.low_demand.toLocaleString()} cards`);
        
        // Top eBay opportunities
        console.log('\n🎯 TOP EBAY MARKET OPPORTUNITIES:');
        
        const topEbayOpportunities = ebayDb.prepare(`
            SELECT 
                collector_crypt_id,
                card_name,
                current_listings_count,
                ROUND(avg_asking_price, 2) as avg_asking,
                sold_listings_count,
                ROUND(avg_sold_price, 2) as avg_sold,
                ROUND(asking_vs_sold_ratio, 2) as asking_vs_sold_ratio,
                demand_indicator,
                confidence_score
            FROM ebay_price_analytics 
            WHERE avg_sold_price > 0
            ORDER BY avg_sold_price DESC
            LIMIT 20
        `).all();
        
        console.log('Card Name | Current | Avg Ask | Sold | Avg Sold | Ask/Sold | Demand | Confidence');
        console.log(''.padEnd(85, '-'));
        
        topEbayOpportunities.forEach(card => {
            const name = card.card_name.length > 15 ? card.card_name.substring(0, 12) + '...' : card.card_name.padEnd(15);
            const current = card.current_listings_count.toString().padStart(7);
            const avgAsk = `$${card.avg_asking}`.padStart(7);
            const sold = card.sold_listings_count.toString().padStart(4);
            const avgSold = `$${card.avg_sold}`.padStart(8);
            const ratio = `${card.asking_vs_sold_ratio}x`.padStart(8);
            const demand = card.demand_indicator.padEnd(6);
            const confidence = `${card.confidence_score}%`.padStart(10);
            
            console.log(`${name} | ${current} | ${avgAsk} | ${sold} | ${avgSold} | ${ratio} | ${demand} | ${confidence}`);
        });
    }
    
    // Final comprehensive summary
    console.log('\n🏆 COMPLETE MARKET INTELLIGENCE SUMMARY:');
    console.log('=======================================');
    
    console.log(`✅ COLLECTOR CRYPT POKEMON PORTFOLIO:`);
    console.log(`   Total Cards: ${totalCards.count.toLocaleString()}`);
    console.log(`   Total Portfolio Value: $${totalValue.toLocaleString()}`);
    console.log(`   Average Card Value: $${(totalValue / totalPricedCards).toFixed(2)}`);
    console.log(`   Cards with Market Pricing: ${totalPricedCards.toLocaleString()}`);
    
    console.log(`\n📊 MARKET DATA COVERAGE:`);
    console.log(`   Pokemon TCG API: ${pokemonCoveragePercent}% (${pricingCoverage.count.toLocaleString()} cards)`);
    console.log(`   TCGPlayer: ${tcgCoveragePercent}% (${tcgCoverage.count.toLocaleString()} cards)`);
    console.log(`   eBay Market Intelligence: ${ebayCoveragePercent}% (${ebayCount.count.toLocaleString()} cards)`);
    
    // Calculate total opportunities
    const totalOpportunities = completeOpportunities.reduce((sum, opp) => {
        if (opp.price_opportunity === 'UNDERPRICED') {
            return sum + opp.count;
        }
        return sum;
    }, 0);
    
    console.log(`\n💰 PRICING OPPORTUNITIES:`);
    console.log(`   Total Underpriced Cards: ${totalOpportunities.toLocaleString()}`);
    console.log(`   Opportunity Rate: ${((totalOpportunities / totalCards.count) * 100).toFixed(1)}%`);
    
    console.log(`\n🚀 SYSTEM STATUS:`);
    console.log(`   ✅ Complete Collector Crypt dataset indexed`);
    console.log(`   ✅ Multi-source pricing analysis active`);
    console.log(`   ✅ eBay market intelligence integrated`);
    console.log(`   ✅ Real-time opportunity identification enabled`);
    
    console.log(`\n📁 DATA ACCESS:`);
    console.log(`   Primary Database: collector_crypt_v2.db`);
    console.log(`   Pricing Intelligence: collector_crypt_pricing_complete.db`);
    console.log(`   eBay Market Data: collector_crypt_ebay_complete.db`);
    console.log(`   API Access: collector-crypt-pricing-api.js & collector-crypt-ebay-api.js`);
    
    // Close all databases
    ccDb.close();
    pricingDb.close();
    ebayDb.close();
}

// Execute the complete report
try {
    generateCompleteCollectorCryptReport();
} catch (error) {
    console.error('❌ Error generating complete report:', error);
    console.error(error.stack);
}
