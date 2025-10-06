/**
 * Harvest Courtyard NFT listings from OpenSea
 *
 * Fetches active OpenSea listings for Courtyard.io Pokemon cards
 * and matches them with our existing NFT metadata to get card names
 *
 * Run: pnpm tsx scripts/harvest-opensea-courtyard.ts
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const BASE_URL = 'https://api.opensea.io/api/v2';
const COLLECTION_SLUG = 'courtyard-nft';
const CONTRACT_ADDRESS = '0x251be3a17af4892035c37ebf5890f4a4d889dcad';
const CHAIN = 'polygon';
const RATE_LIMIT_MS = 500; // 2 requests per second
const BATCH_SIZE = 50; // OpenSea max per request

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOpenSeaListings(cursor?: string): Promise<any> {
  let url = `${BASE_URL}/listings/collection/${COLLECTION_SLUG}/all?limit=${BATCH_SIZE}`;
  if (cursor) {
    url += `&next=${cursor}`;
  }

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': OPENSEA_API_KEY!,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenSea API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return await response.json();
}

async function fetchNFTMetadata(tokenId: string): Promise<any> {
  const url = `${BASE_URL}/chain/${CHAIN}/contract/${CONTRACT_ADDRESS}/nfts/${tokenId}`;

  await sleep(RATE_LIMIT_MS); // Rate limiting

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': OPENSEA_API_KEY!,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

async function harvestOpenSea() {
  const startTime = Date.now();

  console.log('🚀 OPENSEA COURTYARD NFT HARVESTER');
  console.log('='.repeat(60));
  console.log(`📡 API: ${BASE_URL}`);
  console.log(`🔑 API Key: ${OPENSEA_API_KEY?.slice(0, 10)}...`);
  console.log(`🎯 Collection: ${COLLECTION_SLUG}`);
  console.log('='.repeat(60));
  console.log('');

  if (!OPENSEA_API_KEY) {
    console.error('❌ OPENSEA_API_KEY not found in .env');
    process.exit(1);
  }

  let totalListings = 0;
  let pokemonListings = 0;
  let nonPokemonListings = 0;
  let savedListings = 0;
  let cursor: string | undefined = undefined;
  let page = 1;

  // Get current ETH price in USD for conversion
  const ethPriceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
  const ethPriceData: any = await ethPriceResponse.json();
  const ethPriceUSD = ethPriceData.ethereum.usd;
  console.log(`💱 ETH Price: $${ethPriceUSD.toFixed(2)}`);
  console.log('');

  do {
    console.log(`📥 Fetching page ${page}...`);

    const data = await fetchOpenSeaListings(cursor);
    const listings = data.listings || [];

    if (listings.length === 0) {
      console.log('  ✓ No more listings found');
      break;
    }

    totalListings += listings.length;
    console.log(`  ✓ Found ${listings.length} listings (Total: ${totalListings})`);

    for (const listing of listings) {
      try {
        // Extract token ID from the NFT offer
        const nftOffer = listing.protocol_data?.parameters?.offer?.[0];
        if (!nftOffer || nftOffer.itemType !== 2) continue; // Must be ERC-721

        const tokenId = nftOffer.identifierOrCriteria;

        // Fetch NFT metadata from OpenSea to check category
        const nftData = await fetchNFTMetadata(tokenId);
        if (!nftData || !nftData.nft) {
          continue;
        }

        const traits = nftData.nft.traits || [];
        const categoryTrait = traits.find((t: any) => t.trait_type === 'Category');

        // Only process Pokemon cards
        if (!categoryTrait || categoryTrait.value !== 'Pokémon') {
          nonPokemonListings++;
          continue;
        }

        pokemonListings++;

        // Extract price (in WETH, 18 decimals)
        const priceValue = listing.price?.current?.value;
        if (!priceValue) continue;

        const priceWETH = parseFloat(priceValue) / 1e18;
        const priceUSD = priceWETH * ethPriceUSD;
        const priceCents = Math.round(priceUSD * 100);

        // Extract card info from traits
        const getTrait = (name: string) => {
          const trait = traits.find((t: any) => t.trait_type === name);
          return trait?.value || '';
        };

        const cardName = getTrait('Name') || nftData.nft.name || 'Unknown';
        const setName = getTrait('Set') || 'Unknown';
        const cardNumber = getTrait('Number') || null;
        const gradeStr = getTrait('Grade');
        const gradeCompany = getTrait('Grader') || null;
        const rarity = getTrait('Rarity') || null;

        // Parse grade as float
        let grade: number | null = null;
        if (gradeStr && gradeStr !== 'Ungraded') {
          const gradeMatch = gradeStr.match(/(\d+(?:\.\d+)?)/);
          if (gradeMatch) {
            grade = parseFloat(gradeMatch[1]);
          }
        }

        // Update or create listing with OpenSea price
        const title = getTrait('Title') || nftData.nft.name || `${cardName} ${setName}`;

        await prisma.unifiedMarketListing.upsert({
          where: {
            source_sourceId: {
              source: 'OPENSEA',
              sourceId: tokenId.substring(0, 100),
            },
          },
          create: {
            id: `opensea-${tokenId}`.substring(0, 191),
            source: 'OPENSEA',
            sourceId: tokenId.substring(0, 100),
            title: title.substring(0, 500),
            rawTitle: (nftData.nft.name || '').substring(0, 255),
            cardName: cardName.substring(0, 255),
            setName: setName.substring(0, 255),
            cardNumber: cardNumber ? cardNumber.substring(0, 10) : null,
            variant: rarity ? rarity.substring(0, 100) : null,
            gradeCompany: gradeCompany && gradeCompany !== 'Ungraded' ? gradeCompany.substring(0, 50) : null,
            grade: grade,
            condition: null,
            priceCents,
            currency: 'USD',
            url: `https://opensea.io/assets/polygon/${CONTRACT_ADDRESS}/${tokenId}`.substring(0, 500),
            dataQuality: 0.95,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            priceCents,
            cardName: cardName.substring(0, 255),
            setName: setName.substring(0, 255),
            dataQuality: 0.95,
            updatedAt: new Date(),
          },
        });

        savedListings++;
      } catch (error: any) {
        console.error(`  ✗ Error processing listing: ${error.message}`);
      }
    }

    console.log(`  🎮 Pokémon: ${pokemonListings} | 🏈 Sports: ${nonPokemonListings} | 💾 Saved: ${savedListings}`);
    console.log('');

    cursor = data.next;
    page++;

    // Rate limiting
    await sleep(RATE_LIMIT_MS);

  } while (cursor);

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total Listings Fetched: ${totalListings}`);
  console.log(`🎮 Pokémon Cards: ${pokemonListings}`);
  console.log(`🏈 Sports Cards: ${nonPokemonListings}`);
  console.log(`💰 Saved to Database: ${savedListings}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));
}

harvestOpenSea()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
