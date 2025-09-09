#!/usr/bin/env node

/**
 * eBay API Credentials Setup Guide
 * Step-by-step guide to get your eBay Developer credentials
 */

console.log('🔑 eBay API Credentials Setup Guide');
console.log('===================================\n');

console.log('📋 STEP 1: Create eBay Developer Account');
console.log('-----------------------------------------');
console.log('1. Go to: https://developer.ebay.com/');
console.log('2. Click "Get Started" or "Sign In"');
console.log('3. Create account or sign in with existing eBay account');
console.log('4. Accept developer terms and conditions\n');

console.log('🔧 STEP 2: Create Application');
console.log('------------------------------');
console.log('1. Go to "My Account" → "Application Keys"');
console.log('2. Click "Create Application Keys"'); 
console.log('3. Fill out application form:');
console.log('   • Application Name: "PokeDAO Pokemon Card Pricing"');
console.log('   • Application Type: "Public Application"');
console.log('   • Description: "Pokemon card market data collection for pricing analysis"');
console.log('   • Category: "Software Development"');
console.log('4. Submit application\n');

console.log('🔐 STEP 3: Get Your Credentials');
console.log('--------------------------------');
console.log('After approval, you\'ll get:');
console.log('• App ID (Client ID) - starts with your eBay username');
console.log('• Cert ID (Client Secret) - long alphanumeric string');
console.log('• Dev ID - for advanced features (optional for basic use)\n');

console.log('⚙️  STEP 4: Set Environment Variables');
console.log('--------------------------------------');
console.log('Add these to your shell profile (.zshrc, .bashrc, etc.):');
console.log('');
console.log('export EBAY_CLIENT_ID="YourAppID"');
console.log('export EBAY_CLIENT_SECRET="YourCertID"');
console.log('');
console.log('Or run temporarily:');
console.log('EBAY_CLIENT_ID="YourAppID" EBAY_CLIENT_SECRET="YourCertID" node secure-ebay-pokemon-collector.js\n');

console.log('📊 STEP 5: API Limits & Considerations');
console.log('---------------------------------------');
console.log('• Application Token: 5,000 calls/day (free tier)');
console.log('• Perfect for Pokemon card data collection');
console.log('• Sandbox available for testing');
console.log('• Production requires valid credentials\n');

console.log('🧪 STEP 6: Test Your Setup');
console.log('---------------------------');
console.log('Once you have credentials:');
console.log('1. Set environment variables');
console.log('2. Run: node ebay-integration-test.js');
console.log('3. Should show "eBay credentials: Found in environment"');
console.log('4. Run: node secure-ebay-pokemon-collector.js');
console.log('5. Start collecting real Pokemon card sold data!\n');

console.log('🚀 QUICK START (If you already have credentials):');
console.log('==================================================');
console.log('# Set credentials and run collector:');
console.log('export EBAY_CLIENT_ID="your_app_id"');
console.log('export EBAY_CLIENT_SECRET="your_cert_id"');
console.log('node secure-ebay-pokemon-collector.js\n');

console.log('💡 TIPS:');
console.log('--------');
console.log('• Keep credentials secure - don\'t commit them to git');
console.log('• Use sandbox for testing, production for real data');
console.log('• Start with popular cards (Charizard, Pikachu) to test');
console.log('• Monitor API usage to stay under daily limits\n');

console.log('❓ TROUBLESHOOTING:');
console.log('-------------------');
console.log('• Application pending? Usually approved within 24-48 hours');
console.log('• Invalid credentials? Double-check App ID and Cert ID');
console.log('• API errors? Check you\'re using production (not sandbox) URLs');
console.log('• Rate limited? Wait and retry, or implement delays\n');

console.log('✅ Ready to collect Pokemon card sold listing data!');

// If credentials exist, show next step
if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) {
    console.log('\n🎉 CREDENTIALS DETECTED!');
    console.log('========================');
    console.log('Your eBay credentials are already set up.');
    console.log('Ready to start collecting Pokemon card data!');
    console.log('');
    console.log('Next: node secure-ebay-pokemon-collector.js');
}
