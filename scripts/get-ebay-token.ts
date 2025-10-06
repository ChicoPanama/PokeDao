/**
 * Get eBay OAuth Access Token
 *
 * This script uses Client Credentials Grant flow to get an Application token
 * for accessing eBay Finding API in production.
 */

import 'dotenv/config';

const EBAY_APP_ID = process.env.EBAY_APP_ID || '';
const EBAY_CERT_ID = process.env.EBAY_CERT_ID || '';

async function getEbayToken() {
  console.log('🔐 eBay OAuth Token Generator\n');
  console.log(`App ID: ${EBAY_APP_ID.substring(0, 30)}...`);
  console.log(`Cert ID: ${EBAY_CERT_ID.substring(0, 30)}...\n`);

  if (EBAY_APP_ID.includes('SBX')) {
    console.log('⚠️  WARNING: Using SANDBOX credentials!');
    console.log('   Production data requires production credentials.\n');
  }

  // Base64 encode credentials
  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

  console.log('🌐 Requesting OAuth token from eBay...\n');

  try {
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token request failed:');
      console.error(errorText);

      if (errorText.includes('credentials')) {
        console.log('\n💡 Troubleshooting:');
        console.log('1. Check that EBAY_APP_ID and EBAY_CERT_ID are correct');
        console.log('2. Make sure you\'re using PRODUCTION credentials (not SBX)');
        console.log('3. Verify your app has production access at: https://developer.ebay.com/my/keys');
      }

      process.exit(1);
    }

    const data = await response.json();

    console.log('✅ Token received successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Access Token:');
    console.log(data.access_token);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\nToken Type: ${data.token_type}`);
    console.log(`Expires In: ${data.expires_in} seconds (${Math.round(data.expires_in / 60)} minutes)`);

    console.log('\n📝 Add this to your .env file:');
    console.log(`EBAY_OAUTH_TOKEN=${data.access_token}`);

    console.log('\n🔄 Token will expire in ~2 hours. Re-run this script to get a new one.');

    return data;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getEbayToken();
