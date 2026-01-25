/**
 * eBay Browse API Harvester - Saves to JSON
 *
 * Collects Pokemon TCG sold data and saves to JSON for later database import.
 * No Prisma dependency - works standalone.
 */
import 'dotenv/config';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';

const EBAY_APP_ID = process.env.EBAY_APP_ID || '';
const EBAY_CERT_ID = process.env.EBAY_CERT_ID || '';

// Config
const MIN_PRICE_USD = 50;
const MAX_RESULTS_PER_CARD = 200; // eBay limit is 200 per search
const DELAY_MS = 500;
const OUTPUT_DIR = 'data/ebay-harvest';
const CHECKPOINT_FILE = `${OUTPUT_DIR}/checkpoint.json`;
const RESULTS_FILE = `${OUTPUT_DIR}/ebay-listings.json`;

// High-value cards to search
const SEARCH_TERMS = [
  'Charizard PSA 10',
  'Charizard PSA 9',
  'Charizard BGS 9.5',
  'Pikachu Illustrator',
  'Pikachu PSA 10',
  'Umbreon VMAX PSA 10',
  'Moonbreon PSA 10',
  'Gengar VMAX PSA 10',
  'Lugia PSA 10',
  'Mew PSA 10',
  'Mewtwo PSA 10',
  'Rayquaza PSA 10',
  'Eevee Heroes PSA 10',
  'Shining Fates PSA 10',
  'Crown Zenith PSA 10',
  'Prismatic Evolutions PSA 10',
  'Base Set Holo PSA 10',
  'Shadowless PSA 10',
  '1st Edition PSA 10',
  'Gold Star PSA 10',
];

interface Checkpoint {
  completedSearches: string[];
  totalListings: number;
  lastRun: string;
  accessToken?: string;
  tokenExpiry?: number;
}

interface EbayListing {
  itemId: string;
  title: string;
  priceCents: number;
  currency: string;
  condition: string;
  conditionId: string;
  url: string;
  imageUrl: string;
  seller: string;
  sellerFeedback: number;
  shippingCents: number;
  searchTerm: string;
  harvestedAt: string;
}

// Load/save checkpoint
function loadCheckpoint(): Checkpoint {
  if (existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return {
    completedSearches: [],
    totalListings: 0,
    lastRun: new Date().toISOString(),
  };
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.lastRun = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// Load/save results
function loadResults(): EbayListing[] {
  if (existsSync(RESULTS_FILE)) {
    return JSON.parse(readFileSync(RESULTS_FILE, 'utf8'));
  }
  return [];
}

function saveResults(results: EbayListing[]): void {
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

// OAuth token management
async function getOAuthToken(checkpoint: Checkpoint): Promise<string> {
  // Check if we have a valid cached token
  if (checkpoint.accessToken && checkpoint.tokenExpiry) {
    if (Date.now() < checkpoint.tokenExpiry - 60000) { // 1 min buffer
      return checkpoint.accessToken;
    }
  }

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
  checkpoint.accessToken = data.access_token;
  checkpoint.tokenExpiry = Date.now() + (data.expires_in * 1000);
  saveCheckpoint(checkpoint);

  console.log('✅ New OAuth token obtained');
  return data.access_token;
}

// Search eBay
async function searchEbay(token: string, searchTerm: string, offset = 0): Promise<{
  items: EbayListing[];
  total: number;
}> {
  const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  url.searchParams.set('q', searchTerm + ' Pokemon');
  url.searchParams.set('category_ids', '183454'); // Pokemon TCG
  url.searchParams.set('filter', `price:[${MIN_PRICE_USD}..],priceCurrency:USD`);
  url.searchParams.set('limit', '50');
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('sort', 'price');

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

  const data = await response.json() as any;

  const items: EbayListing[] = (data.itemSummaries || []).map((item: any) => ({
    itemId: item.itemId || '',
    title: item.title || '',
    priceCents: Math.round(parseFloat(item.price?.value || '0') * 100),
    currency: item.price?.currency || 'USD',
    condition: item.condition || '',
    conditionId: item.conditionId || '',
    url: item.itemWebUrl || '',
    imageUrl: item.image?.imageUrl || '',
    seller: item.seller?.username || '',
    sellerFeedback: item.seller?.feedbackScore || 0,
    shippingCents: Math.round(parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || '0') * 100),
    searchTerm,
    harvestedAt: new Date().toISOString(),
  }));

  return { items, total: data.total || 0 };
}

// Parse card info from title
function parseCardFromTitle(title: string): {
  cardName?: string;
  setName?: string;
  grade?: number;
  gradeCompany?: string;
} {
  const result: any = {};

  // Grade company patterns
  const gradeMatch = title.match(/\b(PSA|BGS|CGC|SGC|ACE)\s+(\d+(?:\.\d+)?)\b/i);
  if (gradeMatch) {
    result.gradeCompany = gradeMatch[1].toUpperCase();
    result.grade = parseFloat(gradeMatch[2]);
  }

  // Common card names
  const cardNames = [
    'Charizard', 'Pikachu', 'Mewtwo', 'Mew', 'Lugia', 'Rayquaza',
    'Umbreon', 'Gengar', 'Eevee', 'Blastoise', 'Venusaur', 'Dragonite',
    'Alakazam', 'Machamp', 'Gyarados', 'Tyranitar', 'Gardevoir',
  ];

  for (const name of cardNames) {
    if (title.toLowerCase().includes(name.toLowerCase())) {
      result.cardName = name;
      break;
    }
  }

  // Set patterns
  const setPatterns = [
    /Base Set/i, /Jungle/i, /Fossil/i, /Team Rocket/i, /Evolutions/i,
    /Shining Fates/i, /Crown Zenith/i, /Prismatic Evolutions/i,
    /Hidden Fates/i, /Celebrations/i, /Evolving Skies/i,
  ];

  for (const pattern of setPatterns) {
    const match = title.match(pattern);
    if (match) {
      result.setName = match[0];
      break;
    }
  }

  return result;
}

// Main
async function main() {
  console.log('🔄 eBay Browse API Harvester');
  console.log('='.repeat(60));
  console.log('Min Price: $' + MIN_PRICE_USD);
  console.log('Search Terms: ' + SEARCH_TERMS.length);
  console.log('Output: ' + OUTPUT_DIR);
  console.log('='.repeat(60) + '\n');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load state
  const checkpoint = loadCheckpoint();
  let results = loadResults();
  const existingIds = new Set(results.map(r => r.itemId));

  console.log('📍 Checkpoint: ' + checkpoint.completedSearches.length + ' searches done, ' + results.length + ' listings\n');

  // Get OAuth token
  const token = await getOAuthToken(checkpoint);

  // Process each search term
  for (const searchTerm of SEARCH_TERMS) {
    if (checkpoint.completedSearches.includes(searchTerm)) {
      console.log('⏭️  Skipping (done): ' + searchTerm);
      continue;
    }

    console.log('\n🔍 Searching: ' + searchTerm);

    let offset = 0;
    let totalForTerm = 0;
    let newForTerm = 0;

    while (offset < MAX_RESULTS_PER_CARD) {
      try {
        const { items, total } = await searchEbay(token, searchTerm, offset);

        if (items.length === 0) break;

        // Add new items
        for (const item of items) {
          if (!existingIds.has(item.itemId)) {
            results.push(item);
            existingIds.add(item.itemId);
            newForTerm++;
          }
        }

        totalForTerm = total;
        offset += items.length;

        // Rate limiting
        await new Promise(r => setTimeout(r, DELAY_MS));

        // Progress
        process.stdout.write('\r   Fetched ' + offset + '/' + Math.min(total, MAX_RESULTS_PER_CARD) + ' (' + newForTerm + ' new)');

      } catch (error: any) {
        console.error('\n   ❌ Error: ' + error.message);
        break;
      }
    }

    console.log('\n   ✅ Total available: ' + totalForTerm + ', New: ' + newForTerm);

    // Mark complete and save
    checkpoint.completedSearches.push(searchTerm);
    checkpoint.totalListings = results.length;
    saveCheckpoint(checkpoint);
    saveResults(results);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log('Total Listings: ' + results.length);
  console.log('Unique Cards: ' + new Set(results.map(r => parseCardFromTitle(r.title).cardName)).size);
  console.log('Output File: ' + RESULTS_FILE);
  console.log('='.repeat(60));

  // Show price distribution
  const prices = results.map(r => r.priceCents / 100).sort((a, b) => a - b);
  console.log('\nPrice Distribution:');
  console.log('  Min: $' + prices[0]);
  console.log('  Max: $' + prices[prices.length - 1]);
  console.log('  Median: $' + prices[Math.floor(prices.length / 2)]);
}

main().catch(console.error);
