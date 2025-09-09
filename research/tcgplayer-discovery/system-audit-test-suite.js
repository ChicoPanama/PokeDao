#!/usr/bin/env node

/**
 * COMPREHENSIVE SYSTEM TESTING SUITE
 * Tests all critical functions and data integrity
 */

const Database = require('better-sqlite3');

// Test data sanitization function
function sanitizeForSQLite(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' || typeof value === 'bigint') return value;
    if (typeof value === 'string') return value;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function runSystemTests() {
    console.log('🧪 COMPREHENSIVE SYSTEM TESTING SUITE');
    console.log('=====================================\n');

    const testResults = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    function test(name, testFn) {
        try {
            console.log(`Testing: ${name}...`);
            const result = testFn();
            if (result === true) {
                console.log(`✅ ${name} - PASSED`);
                testResults.passed++;
            } else if (result === 'warning') {
                console.log(`⚠️  ${name} - WARNING`);
                testResults.warnings++;
            } else {
                console.log(`❌ ${name} - FAILED`);
                testResults.failed++;
            }
        } catch (error) {
            console.log(`❌ ${name} - ERROR: ${error.message}`);
            testResults.failed++;
        }
        console.log('');
    }

    // Test 1: Database Connectivity
    test('Database Connectivity', () => {
        const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
        const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });
        const ebayDb = new Database('collector_crypt_ebay_complete.db', { readonly: true });
        
        const ccCount = ccDb.prepare("SELECT COUNT(*) as count FROM collector_crypt_cards").get();
        const pricingCount = pricingDb.prepare("SELECT COUNT(*) as count FROM collector_crypt_pricing").get();
        const ebayCount = ebayDb.prepare("SELECT COUNT(*) as count FROM ebay_price_analytics").get();
        
        ccDb.close();
        pricingDb.close();
        ebayDb.close();
        
        return ccCount.count > 20000 && pricingCount.count > 20000 && ebayCount.count > 20000;
    });

    // Test 2: Data Sanitization Function
    test('Data Sanitization Function', () => {
        const testCases = [
            [null, null],
            [undefined, null],
            [123, 123],
            ['test', 'test'],
            [true, 1],
            [false, 0],
            [{key: 'value'}, '{"key":"value"}'],
            [['a', 'b'], '["a","b"]']
        ];
        
        for (const [input, expected] of testCases) {
            const result = sanitizeForSQLite(input);
            if (result !== expected) {
                console.log(`Sanitization failed for ${input}: expected ${expected}, got ${result}`);
                return false;
            }
        }
        return true;
    });

    // Test 3: Price Data Integrity
    test('Price Data Integrity', () => {
        const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });
        
        const priceCheck = pricingDb.prepare(`
            SELECT COUNT(*) as count 
            FROM collector_crypt_pricing 
            WHERE cc_asking_price < 0 OR ptcg_market_price < 0 OR tcgp_market_price < 0
        `).get();
        
        const ratioCheck = pricingDb.prepare(`
            SELECT COUNT(*) as count 
            FROM collector_crypt_pricing 
            WHERE asking_vs_market_ratio < 0 OR asking_vs_market_ratio > 10000
        `).get();
        
        pricingDb.close();
        
        return priceCheck.count === 0 && ratioCheck.count < 100; // Allow some extreme ratios
    });

    // Test 4: eBay Data Consistency
    test('eBay Data Consistency', () => {
        const ebayDb = new Database('collector_crypt_ebay_complete.db', { readonly: true });
        
        const analyticsCards = ebayDb.prepare("SELECT COUNT(DISTINCT collector_crypt_id) as count FROM ebay_price_analytics").get();
        const currentCards = ebayDb.prepare("SELECT COUNT(DISTINCT collector_crypt_id) as count FROM ebay_current_listings").get();
        const soldCards = ebayDb.prepare("SELECT COUNT(DISTINCT collector_crypt_id) as count FROM ebay_sold_listings").get();
        
        const negativeChecks = ebayDb.prepare(`
            SELECT COUNT(*) as count 
            FROM ebay_price_analytics 
            WHERE avg_asking_price < 0 OR avg_sold_price < 0
        `).get();
        
        ebayDb.close();
        
        return analyticsCards.count > 20000 && 
               currentCards.count > 20000 && 
               soldCards.count > 20000 &&
               negativeChecks.count === 0;
    });

    // Test 5: Cross-Database Referential Integrity
    test('Cross-Database Referential Integrity', () => {
        const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
        const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });
        
        // Check if pricing records have corresponding CC records
        const ccIds = new Set();
        const ccCards = ccDb.prepare("SELECT id FROM collector_crypt_cards WHERE category LIKE '%pokemon%'").all();
        ccCards.forEach(card => ccIds.add(card.id));
        
        const pricingRecords = pricingDb.prepare("SELECT id FROM collector_crypt_pricing LIMIT 1000").all();
        let missingCount = 0;
        
        pricingRecords.forEach(record => {
            if (!ccIds.has(record.id)) {
                missingCount++;
            }
        });
        
        ccDb.close();
        pricingDb.close();
        
        return missingCount < 10; // Allow small number of mismatches
    });

    // Test 6: Pricing Calculation Accuracy
    test('Pricing Calculation Accuracy', () => {
        const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });
        
        const sampleRecords = pricingDb.prepare(`
            SELECT cc_asking_price, ptcg_market_price, asking_vs_market_ratio 
            FROM collector_crypt_pricing 
            WHERE ptcg_market_price > 0 AND cc_asking_price > 0
            LIMIT 100
        `).all();
        
        let calculationErrors = 0;
        
        sampleRecords.forEach(record => {
            const expectedRatio = record.cc_asking_price / record.ptcg_market_price;
            const actualRatio = record.asking_vs_market_ratio;
            
            // Allow 1% tolerance for floating point precision
            if (Math.abs(expectedRatio - actualRatio) / expectedRatio > 0.01) {
                calculationErrors++;
            }
        });
        
        pricingDb.close();
        
        return calculationErrors < 5; // Allow small number of calculation differences
    });

    // Test 7: Performance - Query Response Times
    test('Query Performance', () => {
        const start = Date.now();
        
        const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
        
        // Test complex query performance
        const complexQuery = ccDb.prepare(`
            SELECT category, grading_company, COUNT(*) as count, AVG(price) as avg_price
            FROM collector_crypt_cards 
            WHERE category LIKE '%pokemon%' 
            GROUP BY category, grading_company
        `).all();
        
        ccDb.close();
        
        const duration = Date.now() - start;
        console.log(`Query completed in ${duration}ms`);
        
        return duration < 5000; // Should complete in under 5 seconds
    });

    // Test 8: Memory Usage Check
    test('Memory Usage', () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Simulate memory-intensive operation
        const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
        const allCards = ccDb.prepare("SELECT * FROM collector_crypt_cards LIMIT 1000").all();
        ccDb.close();
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
        
        console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
        
        return memoryIncrease < 100; // Should use less than 100MB for this operation
    });

    // Test 9: API File Existence and Basic Structure
    test('API Files Structure', () => {
        const fs = require('fs');
        
        const criticalFiles = [
            'collector-crypt-ebay-api.js',
            'collector-crypt-pricing-api.js',
            'collector-crypt-final-system.js',
            'collector-crypt-ebay-system.js'
        ];
        
        for (const file of criticalFiles) {
            if (!fs.existsSync(file)) {
                console.log(`Missing critical file: ${file}`);
                return false;
            }
            
            const content = fs.readFileSync(file, 'utf8');
            if (content.length < 100) {
                console.log(`File too small or empty: ${file}`);
                return false;
            }
        }
        
        return true;
    });

    // Test 10: Data Completeness
    test('Data Completeness', () => {
        const ccDb = new Database('collector_crypt_v2.db', { readonly: true });
        const pricingDb = new Database('collector_crypt_pricing_complete.db', { readonly: true });
        
        const totalCC = ccDb.prepare("SELECT COUNT(*) as count FROM collector_crypt_cards WHERE category LIKE '%pokemon%'").get();
        const totalPricing = pricingDb.prepare("SELECT COUNT(*) as count FROM collector_crypt_pricing").get();
        
        const completeness = (totalPricing.count / totalCC.count) * 100;
        console.log(`Pricing coverage: ${completeness.toFixed(1)}%`);
        
        ccDb.close();
        pricingDb.close();
        
        return completeness > 90; // Should have pricing for >90% of cards
    });

    // Display final results
    console.log('🏆 TEST SUITE RESULTS');
    console.log('====================');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings}`);
    
    const totalTests = testResults.passed + testResults.failed + testResults.warnings;
    const successRate = ((testResults.passed / totalTests) * 100).toFixed(1);
    
    console.log(`\n📊 Success Rate: ${successRate}%`);
    
    if (testResults.failed === 0) {
        console.log('🎉 ALL CRITICAL TESTS PASSED!');
        console.log('✅ System is ready for production use');
    } else {
        console.log('⚠️  Some tests failed - review results above');
    }
    
    return {
        success: testResults.failed === 0,
        results: testResults,
        successRate: parseFloat(successRate)
    };
}

// Run the tests
runSystemTests();
