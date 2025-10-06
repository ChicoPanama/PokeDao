/**
 * Get eBay Application Access Token
 *
 * Uses client credentials (App ID + Cert ID) to get an application-level access token
 * This token is valid for ~2 hours and can be used for Browse API queries
 *
 * Run: pnpm tsx scripts/get-ebay-app-token.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;

if (!EBAY_APP_ID || !EBAY_CERT_ID) {
  console.error('❌ Error: Missing EBAY_APP_ID or EBAY_CERT_ID in .env');
  process.exit(1);
}

async function getAppToken() {
  console.log('🔑 EBAY APPLICATION TOKEN GENERATOR');
  console.log('============================================================\n');
  console.log(`App ID: ${EBAY_APP_ID}`);
  console.log(`Cert ID: ${EBAY_CERT_ID.substring(0, 20)}...\n`);

  try {
    // Encode credentials as Base64
    const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

    console.log('🔄 Requesting application token from eBay...\n');

    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      console.error('Response:', errorText);
      process.exit(1);
    }

    const data: any = await response.json();

    console.log('✅ Token received successfully!\n');
    console.log('============================================================');
    console.log('TOKEN DETAILS:');
    console.log('============================================================\n');
    console.log(`Access Token: ${data.access_token}`);
    console.log(`\nToken Type: ${data.token_type}`);
    console.log(`Expires In: ${data.expires_in} seconds (~${Math.floor(data.expires_in / 3600)} hours)`);
    console.log('\n============================================================');
    console.log('ADD THIS TO YOUR .env FILE:');
    console.log('============================================================\n');
    console.log(`EBAY_ACCESS_TOKEN=${data.access_token}`);
    console.log('\n============================================================\n');

    // Test the token
    console.log('🧪 Testing token with a sample query...\n');

    const testResponse = await fetch(
      'https://api.ebay.com/buy/browse/v1/item_summary/search?q=Charizard&limit=1',
      {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      }
    );

    if (testResponse.ok) {
      const testData: any = await testResponse.json();
      console.log('✅ Token works! Successfully queried eBay Browse API');
      console.log(`   Found ${testData.total || 0} Charizard listings\n`);
    } else {
      console.log('⚠️  Token generated but test query failed');
      console.log(`   Status: ${testResponse.status}\n`);
    }

    console.log('🎉 Ready to harvest eBay data!\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

getAppToken();
