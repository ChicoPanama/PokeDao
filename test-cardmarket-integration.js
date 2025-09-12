/**
 * CardMarket Integration Test
 * Verify SDK installation and configuration
 */

const CardMarketConfig = require('./cardmarket-config');
const CardMarketPokemonExtractor = require('./cardmarket-pokemon-extractor');

async function testCardMarketIntegration() {
    console.log('🧪 Testing CardMarket Integration...\n');
    
    const tests = [
        testSDKInstallation,
        testConfiguration,
        testConnection,
        testPokemonAccess,
        testRateLimiting
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const [index, test] of tests.entries()) {
        console.log(`[${index + 1}/${tests.length}] ${test.name}...`);
        
        try {
            await test();
            console.log(`   ✅ ${test.name} passed`);
            passed++;
        } catch (error) {
            console.log(`   ❌ ${test.name} failed: ${error.message}`);
            failed++;
        }
        
        console.log('');
    }
    
    console.log('🎯 TEST RESULTS:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📊 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! CardMarket integration is ready.');
        console.log('\n🚀 Next steps:');
        console.log('   1. Set up OAuth credentials (see cardmarket-oauth-setup.md)');
        console.log('   2. Run: node cardmarket-pokemon-extractor.js --test');
        console.log('   3. Run: node cardmarket-pokemon-extractor.js (full extraction)');
    } else {
        console.log('\n⚠️ Some tests failed. Please resolve issues before proceeding.');
    }
    
    return { passed, failed, successRate: passed / (passed + failed) };
}

async function testSDKInstallation() {
    // Test if cardmarket-wrapper is installed
    try {
        const CardMarket = require('cardmarket-wrapper');
        
        if (typeof CardMarket !== 'function') {
            throw new Error('CardMarket SDK not properly exported');
        }
        
        return true;
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error('cardmarket-wrapper not installed. Run: npm install cardmarket-wrapper');
        }
        throw error;
    }
}

async function testConfiguration() {
    // Test configuration class
    const config = new CardMarketConfig();
    
    if (!config.config) {
        throw new Error('Configuration not loaded');
    }
    
    if (!config.config.baseURL) {
        throw new Error('Base URL not configured');
    }
    
    if (!config.config.gameId) {
        throw new Error('Pokemon game ID not configured');
    }
    
    return true;
}

async function testConnection() {
    // Test connection (requires credentials)
    const config = new CardMarketConfig();
    
    // Check if credentials are configured
    const hasCredentials = config.config.consumerKey && 
                          config.config.consumerSecret && 
                          config.config.accessToken && 
                          config.config.accessTokenSecret;
    
    if (!hasCredentials) {
        throw new Error('OAuth credentials not configured. See cardmarket-oauth-setup.md');
    }
    
    // Test actual connection
    await config.initialize();
    
    return true;
}

async function testPokemonAccess() {
    // Test Pokemon-specific endpoints
    const extractor = new CardMarketPokemonExtractor();
    
    // This will only work with valid credentials
    const config = new CardMarketConfig();
    const hasCredentials = config.config.consumerKey && config.config.consumerSecret;
    
    if (!hasCredentials) {
        throw new Error('Cannot test Pokemon access without OAuth credentials');
    }
    
    await extractor.quickTest();
    
    return true;
}

async function testRateLimiting() {
    // Test rate limiting configuration
    const config = new CardMarketConfig();
    
    if (!config.config.requestsPerSecond) {
        throw new Error('Rate limiting not configured');
    }
    
    if (config.config.requestsPerSecond > 2) {
        throw new Error('Rate limit too high (max 2 requests/second recommended)');
    }
    
    return true;
}

// Run tests if called directly
if (require.main === module) {
    testCardMarketIntegration().catch(console.error);
}

module.exports = {
    testCardMarketIntegration,
    testSDKInstallation,
    testConfiguration,
    testConnection,
    testPokemonAccess,
    testRateLimiting
};