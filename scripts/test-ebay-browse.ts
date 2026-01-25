/**
 * Simple eBay Browse API test - saves to JSON, no Prisma
 */
import 'dotenv/config';

const EBAY_APP_ID = process.env.EBAY_APP_ID || '';
const EBAY_CERT_ID = process.env.EBAY_CERT_ID || '';

async function getOAuthToken(): Promise<string> {
  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

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
    throw new Error(`OAuth failed: ${response.status} - ${text}`);
  }

  const data = await response.json() as any;
  console.log('✅ OAuth token obtained, expires in:', data.expires_in, 'seconds');
  return data.access_token;
}

async function searchItems(token: string, keyword: string): Promise<any> {
  const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  url.searchParams.set('q', keyword);
  url.searchParams.set('category_ids', '183454'); // Pokemon TCG
  url.searchParams.set('filter', 'price:[100..],priceCurrency:USD');
  url.searchParams.set('limit', '10');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Browse API failed: ${response.status} - ${text}`);
  }

  return response.json();
}

async function main() {
  console.log('🔍 Testing eBay Browse API...\n');
  console.log('App ID:', EBAY_APP_ID ? EBAY_APP_ID.substring(0, 20) + '...' : 'NOT SET');
  console.log('Cert ID:', EBAY_CERT_ID ? 'Set (' + EBAY_CERT_ID.length + ' chars)' : 'NOT SET');

  if (!EBAY_CERT_ID) {
    console.error('\n❌ EBAY_CERT_ID is required for OAuth');
    console.error('Add it to your .env file');
    process.exit(1);
  }

  try {
    const token = await getOAuthToken();
    console.log('\n🔎 Searching for Charizard PSA 10...');

    const results = await searchItems(token, 'Charizard PSA 10 Pokemon');

    console.log('\n📊 Results:');
    console.log('Total:', results.total);

    if (results.itemSummaries) {
      results.itemSummaries.slice(0, 5).forEach((item: any, i: number) => {
        const title = item.title ? item.title.substring(0, 50) : 'Unknown';
        const price = item.price ? item.price.value : '?';
        const condition = item.condition || 'Unknown';
        console.log((i+1) + '. ' + title + '...');
        console.log('   Price: $' + price + ' | ' + condition);
      });
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
