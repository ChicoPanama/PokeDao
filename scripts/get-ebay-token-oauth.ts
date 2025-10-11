/**
 * Get Fresh eBay OAuth Access Token
 *
 * Generates a new Application Access Token using Client Credentials grant.
 * This token is valid for 2 hours and allows access to public eBay data.
 *
 * Run: pnpm tsx scripts/get-ebay-token-oauth.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const EBAY_APP_ID = process.env.EBAY_APP_ID!;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID!;

async function getAccessToken() {
  console.log('🔑 eBay OAuth Token Generator');
  console.log('='.repeat(60));
  console.log(`App ID: ${EBAY_APP_ID?.slice(0, 20)}...`);
  console.log(`Cert ID: ${EBAY_CERT_ID?.slice(0, 20)}...`);
  console.log('='.repeat(60));
  console.log('');

  if (!EBAY_APP_ID || !EBAY_CERT_ID) {
    console.error('❌ EBAY_APP_ID or EBAY_CERT_ID not found in .env');
    process.exit(1);
  }

  // Base64 encode credentials
  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

  try {
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`eBay OAuth error: ${response.status} - ${text}`);
    }

    const data: any = await response.json();

    console.log('✅ Token Generated Successfully!');
    console.log('');
    console.log('Token Type:', data.token_type);
    console.log('Expires In:', data.expires_in, 'seconds (2 hours)');
    console.log('');
    console.log('Access Token:');
    console.log(data.access_token);
    console.log('');
    console.log('='.repeat(60));
    console.log('📝 Next Steps:');
    console.log('1. Copy the access token above');
    console.log('2. Update your .env file:');
    console.log('   EBAY_ACCESS_TOKEN=<paste_token_here>');
    console.log('3. Run the eBay harvester:');
    console.log('   pnpm tsx scripts/harvest-ebay-browse-oauth.ts');
    console.log('='.repeat(60));

    return data.access_token;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getAccessToken();
