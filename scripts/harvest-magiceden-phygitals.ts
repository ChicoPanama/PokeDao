/**
 * Harvest Phygitals Pokemon card listings from Magic Eden
 *
 * Magic Eden Public API (no key required):
 * - Rate limit: 120 requests/minute (2/second)
 * - Collection: phygitals
 * - Prices in SOL
 *
 * Run: pnpm tsx scripts/harvest-magiceden-phygitals.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v2';
const COLLECTION_SYMBOL = 'phygitals';
const RATE_LIMIT_MS = 600; // 600ms = 100 req/min (safe under 120 limit)
const LISTINGS_PER_PAGE = 100; // Max per request

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data: any = await response.json();
    return data.solana?.usd || 200; // Fallback to ~$200 if API fails
  } catch (error) {
    console.error('  ⚠️  Failed to fetch SOL price, using $200 fallback');
    return 200;
  }
}

async function harvestMagicEden() {
  const startTime = Date.now();

  console.log('🪄 MAGIC EDEN PHYGITALS HARVESTER');
  console.log('='.repeat(60));
  console.log(`📡 API: ${MAGIC_EDEN_API}`);
  console.log(`🎯 Collection: ${COLLECTION_SYMBOL}`);
  console.log('='.repeat(60));
  console.log('');

  // Get current SOL price
  console.log('💰 Fetching SOL price...');
  const solPriceUSD = await getSolPrice();
  console.log(`  ✓ SOL = $${solPriceUSD.toFixed(2)} USD`);
  console.log('');

  // Fetch all listings with pagination
  console.log('📥 Fetching Phygitals listings from Magic Eden...');
  let offset = 0;
  let totalFetched = 0;
  let savedListings = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      await sleep(RATE_LIMIT_MS);

      const url = `${MAGIC_EDEN_API}/collections/${COLLECTION_SYMBOL}/listings?offset=${offset}&limit=${LISTINGS_PER_PAGE}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`  ✗ API error: ${response.status} ${response.statusText}`);
        break;
      }

      const listings: any[] = await response.json();

      if (listings.length === 0) {
        hasMore = false;
        break;
      }

      totalFetched += listings.length;

      // Process each listing
      for (const listing of listings) {
        try {
          const tokenMint = listing.tokenMint || listing.tokenAddress;
          const token = listing.token || {};
          const attributes = token.attributes || [];

          // Extract pricing (in SOL)
          const priceSol = listing.price || 0;
          const priceUSD = priceSol * solPriceUSD;
          const priceCents = Math.round(priceUSD * 100);

          if (priceCents === 0) continue;

          // Extract card info from attributes
          const getName = (trait: string) => {
            const attr = attributes.find((a: any) => a.trait_type === trait);
            return attr?.value || '';
          };

          const cardName = getName('Name') || token.name?.split(' ').slice(-2, -1)[0] || 'Unknown';
          const setName = getName('Set') || 'Unknown';
          const cardNumber = getName('Number') || '';
          const gradeStr = getName('Grade') || '';
          const gradeCompany = getName('Grader') || null;
          const rarity = getName('Rarity') || null;
          const title = getName('Title') || token.name || '';

          // Parse grade as float (e.g., "CGC 8.5" -> 8.5, "PSA 10" -> 10)
          let grade: number | null = null;
          if (gradeStr && gradeStr !== 'Ungraded') {
            const gradeMatch = gradeStr.match(/(\d+(?:\.\d+)?)/);
            if (gradeMatch) {
              grade = parseFloat(gradeMatch[1]);
            }
          }

          // Save to database
          await prisma.unifiedMarketListing.upsert({
            where: {
              source_sourceId: {
                source: 'MAGICEDEN',
                sourceId: tokenMint.substring(0, 100),
              },
            },
            create: {
              id: `magiceden-${tokenMint}`.substring(0, 191),
              source: 'MAGICEDEN',
              sourceId: tokenMint.substring(0, 100),
              title: title.substring(0, 500),
              rawTitle: (token.name || '').substring(0, 255),
              cardName: cardName.substring(0, 255),
              setName: setName.substring(0, 255),
              cardNumber: cardNumber ? cardNumber.substring(0, 10) : null,
              variant: rarity ? rarity.substring(0, 100) : null,
              gradeCompany: gradeCompany && gradeCompany !== 'Ungraded' ? gradeCompany.substring(0, 50) : null,
              grade: grade,
              condition: null,
              priceCents: priceCents,
              currency: 'USD',
              url: `https://magiceden.io/item-details/${tokenMint}`.substring(0, 500),
              dataQuality: 0.9, // Magic Eden has high-quality metadata
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            update: {
              priceCents: priceCents,
              cardName: cardName.substring(0, 255),
              setName: setName.substring(0, 255),
              dataQuality: 0.9,
              updatedAt: new Date(),
            },
          });

          savedListings++;

        } catch (error: any) {
          console.error(`  ✗ Error processing listing ${listing.tokenMint}: ${error.message}`);
        }
      }

      console.log(`  💾 Processed ${totalFetched} listings (${savedListings} with prices)...`);

      offset += LISTINGS_PER_PAGE;

      // Safety break at 50,000 listings
      if (offset >= 50000) {
        console.log('  ⚠️  Reached 50,000 listing limit, stopping');
        break;
      }

    } catch (error: any) {
      console.error(`  ✗ Error fetching page at offset ${offset}: ${error.message}`);
      hasMore = false;
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total Listings Fetched: ${totalFetched}`);
  console.log(`💰 Saved with Pricing: ${savedListings}`);
  console.log(`💵 SOL Price: $${solPriceUSD.toFixed(2)} USD`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));
}

harvestMagicEden()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
