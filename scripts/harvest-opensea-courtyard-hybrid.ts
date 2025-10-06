/**
 * Hybrid OpenSea + Courtyard Harvester
 *
 * Strategy:
 * 1. Fetch all OpenSea active listings for Courtyard NFTs
 * 2. Load Courtyard Polygon metadata (353K NFTs with insuredValue)
 * 3. Match OpenSea listings by token ID
 * 4. Use OpenSea listing price OR Courtyard insuredValue as fallback
 * 5. Filter to Pokemon cards only using Courtyard Category trait
 *
 * Run: pnpm tsx scripts/harvest-opensea-courtyard-hybrid.ts
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const BASE_URL = 'https://api.opensea.io/api/v2';
const COLLECTION_SLUG = 'courtyard-nft';
const CONTRACT_ADDRESS = '0x251be3a17af4892035c37ebf5890f4a4d889dcad';
const CHAIN = 'polygon';
const RATE_LIMIT_MS = 500;
const BATCH_SIZE = 50;

interface CourtyardMetadata {
  tokenId: string;
  name?: string;
  metadata?: {
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  insuredValue?: string;
}

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
    throw new Error(`OpenSea API error: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function harvestHybrid() {
  const startTime = Date.now();

  console.log('🚀 HYBRID OPENSEA + COURTYARD HARVESTER');
  console.log('='.repeat(60));
  console.log('📡 OpenSea API: ' + BASE_URL);
  console.log('🗄️  Courtyard Metadata: polygon-checkpoint.json');
  console.log('='.repeat(60));
  console.log('');

  // Load Courtyard Polygon metadata
  console.log('📦 Loading Courtyard Polygon metadata...');
  const courtyardData = JSON.parse(
    readFileSync('data/courtyard/polygon-checkpoint.json', 'utf-8')
  );
  const courtyardNFTs: CourtyardMetadata[] = courtyardData.nfts || [];
  console.log(`✓ Loaded ${courtyardNFTs.length.toLocaleString()} Courtyard NFTs`);

  // Index by token ID for fast lookup
  const nftByToken = new Map<string, CourtyardMetadata>();
  for (const nft of courtyardNFTs) {
    nftByToken.set(nft.tokenId, nft);
  }
  console.log('✓ Indexed NFTs by token ID');
  console.log('');

  // Get ETH and POL prices
  const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network&vs_currencies=usd');
  const priceData: any = await priceResponse.json();
  const ethPriceUSD = priceData.ethereum.usd;
  const polPriceUSD = priceData['matic-network'].usd;
  console.log(`💱 ETH Price: $${ethPriceUSD.toFixed(2)}`);
  console.log(`💱 POL Price: $${polPriceUSD.toFixed(2)}`);
  console.log('');

  let totalListings = 0;
  let pokemonListings = 0;
  let nonPokemonListings = 0;
  let savedListings = 0;
  let withOpenSeaPrice = 0;
  let withInsuredValue = 0;
  let cursor: string | undefined = undefined;
  let page = 1;

  do {
    console.log(`📥 Fetching page ${page}...`);

    const data = await fetchOpenSeaListings(cursor);
    const listings = data.listings || [];

    if (listings.length === 0) {
      console.log('  ✓ No more listings found');
      break;
    }

    totalListings += listings.length;

    for (const listing of listings) {
      try {
        // Extract token ID
        const nftOffer = listing.protocol_data?.parameters?.offer?.[0];
        if (!nftOffer || nftOffer.itemType !== 2) continue;

        const tokenId = nftOffer.identifierOrCriteria;

        // Look up in Courtyard metadata
        const courtyardNFT = nftByToken.get(tokenId);
        if (!courtyardNFT) {
          console.log(`  ⚠️  Token ${tokenId} not found in Courtyard metadata`);
          continue;
        }

        // Check if Pokemon using Category trait
        const attributes = courtyardNFT.metadata?.attributes || [];
        const categoryTrait = attributes.find((a: any) => a.trait_type === 'Category');

        const isPokemon = categoryTrait && (
          String(categoryTrait.value).includes('Pokémon') ||
          String(categoryTrait.value).includes('Pokemon')
        );

        if (!isPokemon) {
          nonPokemonListings++;
          continue;
        }

        pokemonListings++;

        // Price priority:
        // 1. OpenSea listing price (active market price)
        // 2. Courtyard insuredValue (insurance/valuation)
        let priceCents = 0;
        let priceSource = 'none';

        // Try OpenSea listing price first
        const priceObj = listing.price?.current;
        if (priceObj?.value) {
          const decimals = priceObj.decimals || 18;
          const currency = priceObj.currency || 'WETH';
          const tokenAmount = parseFloat(priceObj.value) / Math.pow(10, decimals);

          let priceUSD = 0;
          if (currency === 'WETH' || currency === 'ETH') {
            priceUSD = tokenAmount * ethPriceUSD;
          } else if (currency === 'USDC') {
            priceUSD = tokenAmount;
          } else if (currency === 'POL' || currency === 'MATIC') {
            priceUSD = tokenAmount * polPriceUSD;
          }

          if (priceUSD > 0) {
            priceCents = Math.round(priceUSD * 100);
            priceSource = 'opensea';
            withOpenSeaPrice++;
          }
        }

        // Fallback to Courtyard insuredValue
        if (priceCents === 0 && courtyardNFT.insuredValue) {
          const insuredUSD = parseFloat(courtyardNFT.insuredValue);
          if (!isNaN(insuredUSD) && insuredUSD > 0) {
            priceCents = Math.round(insuredUSD * 100);
            priceSource = 'insuredValue';
            withInsuredValue++;
          }
        }

        if (priceCents === 0) {
          console.log(`  ⚠️  No pricing for token ${tokenId}`);
          continue;
        }

        // Extract card info from Courtyard traits
        const getTrait = (name: string) => {
          const trait = attributes.find((a: any) => a.trait_type === name);
          return trait?.value || '';
        };

        const cardName = getTrait('Title/PKMN') || getTrait('Name') || courtyardNFT.name || 'Unknown';
        const setName = getTrait('Set') || 'Unknown';
        const cardNumber = getTrait('Card Number') || null;
        const gradeStr = getTrait('Grade');
        const gradeCompany = getTrait('Grader') || null;
        const rarity = getTrait('Rarity') || null;

        // Parse grade as float
        let grade: number | null = null;
        if (gradeStr && gradeStr !== 'Ungraded') {
          const gradeMatch = String(gradeStr).match(/(\d+(?:\.\d+)?)/);
          if (gradeMatch) {
            grade = parseFloat(gradeMatch[1]);
          }
        }

        const title = `${cardName} - ${setName}`;

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
            rawTitle: (courtyardNFT.name || '').substring(0, 255),
            cardName: String(cardName).substring(0, 255),
            setName: String(setName).substring(0, 255),
            cardNumber: cardNumber ? String(cardNumber).substring(0, 10) : null,
            variant: rarity ? String(rarity).substring(0, 100) : null,
            gradeCompany: gradeCompany && gradeCompany !== 'Ungraded' ? String(gradeCompany).substring(0, 50) : null,
            grade: grade,
            condition: null,
            priceCents,
            currency: 'USD',
            url: `https://opensea.io/assets/polygon/${CONTRACT_ADDRESS}/${tokenId}`.substring(0, 500),
            dataQuality: priceSource === 'opensea' ? 0.95 : 0.85,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            priceCents,
            dataQuality: priceSource === 'opensea' ? 0.95 : 0.85,
            updatedAt: new Date(),
          },
        });

        savedListings++;

      } catch (error: any) {
        console.error(`  ✗ Error processing listing: ${error.message}`);
      }
    }

    console.log(`  🎮 Pokémon: ${pokemonListings} | 🏈 Sports: ${nonPokemonListings} | 💾 Saved: ${savedListings}`);
    console.log(`  💰 OpenSea price: ${withOpenSeaPrice} | 🏦 Insured value: ${withInsuredValue}`);
    console.log('');

    cursor = data.next;
    page++;

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
  console.log(`📈 With OpenSea Price: ${withOpenSeaPrice}`);
  console.log(`🏦 With Insured Value: ${withInsuredValue}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));
}

harvestHybrid()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
