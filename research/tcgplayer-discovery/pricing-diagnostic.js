#!/usr/bin/env node

const Database = require('better-sqlite3');

console.log('🔍 PRICING CALCULATION DIAGNOSTIC');
console.log('=================================\n');

const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });

// Get a few specific examples to debug
const examples = pricingDb.prepare(`
    SELECT 
        cc_asking_price, 
        ptcg_market_price, 
        tcgp_market_price, 
        asking_vs_market_ratio,
        true_market_value
    FROM collector_crypt_pricing 
    WHERE ptcg_market_price > 0 
    AND cc_asking_price > 0
    AND ptcg_market_price < 200  -- Focus on reasonable prices
    LIMIT 5
`).all();

console.log('Sample records with detailed analysis:');
console.log('=====================================');

examples.forEach((record, i) => {
    console.log(`\nExample ${i + 1}:`);
    console.log(`CC Asking Price: $${record.cc_asking_price}`);
    console.log(`Pokemon TCG Price: $${record.ptcg_market_price || 'N/A'}`);
    console.log(`TCGPlayer Price: $${record.tcgp_market_price || 'N/A'}`);
    console.log(`Stored True Market: $${record.true_market_value || 'N/A'}`);
    console.log(`Stored Ratio: ${record.asking_vs_market_ratio}`);
    
    // Calculate what the ratio should be
    let expectedMarketValue = 0;
    let priceCount = 0;
    
    if (record.ptcg_market_price > 0) {
        expectedMarketValue += record.ptcg_market_price;
        priceCount++;
    }
    
    if (record.tcgp_market_price > 0) {
        expectedMarketValue += record.tcgp_market_price;
        priceCount++;
    }
    
    if (priceCount > 0) {
        expectedMarketValue = expectedMarketValue / priceCount;
        const expectedRatio = record.cc_asking_price / expectedMarketValue;
        
        console.log(`Expected Market Value: $${expectedMarketValue.toFixed(2)} (avg of ${priceCount} sources)`);
        console.log(`Expected Ratio: ${expectedRatio.toFixed(2)}`);
        console.log(`Ratio Difference: ${Math.abs(expectedRatio - record.asking_vs_market_ratio).toFixed(2)}`);
        
        if (Math.abs(expectedRatio - record.asking_vs_market_ratio) > 0.1) {
            console.log('⚠️  RATIO MISMATCH DETECTED!');
        } else {
            console.log('✅ Ratio calculation correct');
        }
    }
});

pricingDb.close();
