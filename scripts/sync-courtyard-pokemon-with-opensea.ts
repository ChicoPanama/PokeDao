/**
 * COURTYARD POKEMON SYNC with OpenSea Pricing
 *
 * Strategy:
 * 1. Load 880k Courtyard NFTs from checkpoint
 * 2. Filter for POKEMON cards only (check name/description/attributes)
 * 3. Extract card metadata from blockchain data
 * 4. Match with OpenSea pricing by tokenId
 * 5. Save to database with COURTYARD source
 *
 * This gives us the blockchain data + OpenSea pricing layer
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';

const COURTYARD_CHECKPOINT = 'data/courtyard/polygon-checkpoint.json';
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const OPENSEA_BASE_URL = 'https://api.opensea.io/api/v2';
const SYNC_CHECKPOINT = 'data/courtyard/pokemon-sync-checkpoint.json';

interface CourtyardNFT {
  tokenId: string;
  name?: string;
  description?: string;
  image?: string;
  metadata?: {
    attributes?: Array<{trait_type?: string; value?: any}>;
    item_info?: {
      storage?: {
        insured?: boolean;
        vaulted?: boolean;
      };
    };
  };
}

interface SyncCheckpoint {
  processedCount: number;
  pokemonFound: number;
  pokemonSaved: number;
  openSeaPriced: number;
  lastTokenId?: string;
}

function isPokemonCard(nft: CourtyardNFT): boolean {
  const name = (nft.name || '').toLowerCase();
  const description = (nft.description || '').toLowerCase();

  // Check name/description for Pokemon indicators
  const indicators = ['pokemon', 'pokémon', 'pikachu', 'charizard', 'tcg'];
  const hasIndicator = indicators.some(indicator =>
    name.includes(indicator) || description.includes(indicator)
  );

  if (hasIndicator) return true;

  // Check attributes
  const attributes = nft.metadata?.attributes || [];
  for (const attr of attributes) {
    const value = String(attr.value || '').toLowerCase();
    if (indicators.some(ind => value.includes(ind))) {
      return true;
    }
  }

  return false;
}

function parseCardFromName(name: string): {
  cardName: string;
  setName: string;
  cardNumber: string | null;
  gradeCompany: 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'ACE' | null;
  grade: number | null;
  variant: string | null;
} {
  // Name format: "2000 Black Star Promos #9 Mew - Holo (CGC 9 MINT)"

  // Extract grade
  const gradeMatch = name.match(/\(?(PSA|BGS|CGC|SGC|ACE)\s+(\d+(?:\.\d+)?)/i);
  const gradeCompany = gradeMatch ? gradeMatch[1].toUpperCase() as any : null;
  const grade = gradeMatch ? parseFloat(gradeMatch[2]) : null;

  // Extract card number
  const numberMatch = name.match(/#(\d+)/);
  const cardNumber = numberMatch ? numberMatch[1] : null;

  // Extract variant (Holo, Reverse Holo, etc)
  const variantMatch = name.match(/-(.*?)(?:\(|$)/);
  const variant = variantMatch ? variantMatch[1].trim() : null;

  // Extract set name (year + set name before #)
  const setMatch = name.match(/^(\d{4}\s+[^#]+?)(?:#|$)/);
  const setName = setMatch ? setMatch[1].trim() : 'Unknown';

  // Extract card name (after # and before -)
  let cardName = 'Unknown';
  const cardMatch = name.match(/#\d+\s+([^-\(]+)/);
  if (cardMatch) {
    cardName = cardMatch[1].trim();
  } else {
    // Fallback: use everything after set name
    const afterSet = name.replace(/^\d{4}\s+[^#]+#\d+\s+/, '');
    cardName = afterSet.split(/[-\(]/)[0].trim();
  }

  return {
    cardName,
    setName,
    cardNumber,
    gradeCompany,
    grade,
    variant,
  };
}

async function getOpenSeaPrice(tokenId: string): Promise<number | null> {
  try {
    // Query OpenSea for this specific NFT listing
    const url = `${OPENSEA_BASE_URL}/orders/polygon/seaport/listings`;
    const params = new URLSearchParams({
      asset_contract_address: '0x251be3a17af4892035c37ebf5890f4a4d889dcad',
      token_ids: tokenId,
      limit: '1',
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'X-API-KEY': OPENSEA_API_KEY!,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data: any = await response.json();
    const orders = data.orders || [];

    if (orders.length === 0) return null;

    const order = orders[0];
    const priceData = order.current_price || order.price;

    if (!priceData) return null;

    // Convert from wei to USD
    const value = parseFloat(priceData.value || priceData);
    const decimals = parseInt(priceData.decimals || '18');
    const currency = priceData.currency || 'ETH';

    // Simple conversion (should use real-time rates)
    let usdValue = 0;
    if (currency === 'ETH' || currency === 'WETH') {
      usdValue = (value / Math.pow(10, decimals)) * 4500; // $4500/ETH approx
    } else if (currency === 'MATIC' || currency === 'POL') {
      usdValue = (value / Math.pow(10, decimals)) * 1; // $1/MATIC approx
    } else if (currency === 'USDC') {
      usdValue = value / Math.pow(10, decimals);
    }

    return Math.round(usdValue * 100); // Return cents
  } catch (error) {
    return null;
  }
}

async function syncPokemonCards() {
  const startTime = Date.now();

  console.log('🚀 COURTYARD POKEMON + OPENSEA PRICE SYNC');
  console.log('='.repeat(70));

  if (!existsSync(COURTYARD_CHECKPOINT)) {
    console.error('❌ Courtyard checkpoint not found!');
    console.error(`   Expected: ${COURTYARD_CHECKPOINT}`);
    process.exit(1);
  }

  // Load checkpoint
  let syncCheckpoint: SyncCheckpoint = {
    processedCount: 0,
    pokemonFound: 0,
    pokemonSaved: 0,
    openSeaPriced: 0,
  };

  if (existsSync(SYNC_CHECKPOINT)) {
    syncCheckpoint = JSON.parse(readFileSync(SYNC_CHECKPOINT, 'utf8'));
    console.log(`\n🔄 Resuming from checkpoint:`);
    console.log(`   Processed: ${syncCheckpoint.processedCount.toLocaleString()}`);
    console.log(`   Pokemon Found: ${syncCheckpoint.pokemonFound.toLocaleString()}`);
    console.log(`   Saved to DB: ${syncCheckpoint.pokemonSaved.toLocaleString()}`);
    console.log(`   With OpenSea Price: ${syncCheckpoint.openSeaPriced.toLocaleString()}`);
  }

  console.log('\n📦 Loading Courtyard NFTs...');
  const courtyardData = JSON.parse(readFileSync(COURTYARD_CHECKPOINT, 'utf8'));
  const allNFTs: CourtyardNFT[] = courtyardData.nfts || [];
  console.log(`   ✓ Loaded ${allNFTs.length.toLocaleString()} total NFTs`);

  console.log('\n🔍 Filtering for Pokemon cards...\n');

  let skipCount = syncCheckpoint.processedCount;

  for (let i = skipCount; i < allNFTs.length; i++) {
    const nft = allNFTs[i];
    syncCheckpoint.processedCount++;

    if (!isPokemonCard(nft)) {
      continue;
    }

    syncCheckpoint.pokemonFound++;

    if (!nft.name) {
      console.log(`⚠️  Pokemon NFT without name: ${nft.tokenId}`);
      continue;
    }

    const parsed = parseCardFromName(nft.name);

    // Try to get OpenSea pricing
    const openSeaPrice = await getOpenSeaPrice(nft.tokenId);
    const priceCents = openSeaPrice || 0;

    if (openSeaPrice) {
      syncCheckpoint.openSeaPriced++;
    }

    // Calculate data quality
    let dataQuality = 0.7; // Base for Courtyard
    if (parsed.cardName !== 'Unknown') dataQuality += 0.1;
    if (parsed.setName !== 'Unknown') dataQuality += 0.1;
    if (parsed.gradeCompany) dataQuality += 0.05;
    if (openSeaPrice) dataQuality += 0.05;

    try {
      await prisma.unifiedMarketListing.upsert({
        where: {
          source_sourceId: {
            source: 'COURTYARD',
            sourceId: nft.tokenId,
          },
        },
        create: {
          id: `courtyard-${nft.tokenId}`.substring(0, 191),
          source: 'COURTYARD',
          sourceId: nft.tokenId.substring(0, 100),
          title: nft.name.substring(0, 500),
          rawTitle: nft.name.substring(0, 500),
          cardName: parsed.cardName.substring(0, 255),
          setName: parsed.setName.substring(0, 255),
          cardNumber: parsed.cardNumber?.substring(0, 50),
          gradeCompany: parsed.gradeCompany,
          grade: parsed.grade,
          variant: parsed.variant?.substring(0, 100),
          priceCents,
          currency: 'USD',
          url: `https://courtyard.io/nft/polygon/${nft.tokenId}`.substring(0, 500),
          dataQuality,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          priceCents,
          dataQuality,
          updatedAt: new Date(),
        },
      });

      syncCheckpoint.pokemonSaved++;

      if (syncCheckpoint.pokemonSaved % 100 === 0) {
        console.log(`✅ Saved ${syncCheckpoint.pokemonSaved.toLocaleString()} Pokemon cards (${syncCheckpoint.openSeaPriced} with OpenSea pricing)`);

        // Save checkpoint
        syncCheckpoint.lastTokenId = nft.tokenId;
        writeFileSync(SYNC_CHECKPOINT, JSON.stringify(syncCheckpoint, null, 2));
      }

    } catch (error: any) {
      console.error(`   ❌ Error saving ${nft.name}: ${error.message}`);
    }

    // Rate limit OpenSea API (no more than 1 req/sec)
    if (syncCheckpoint.pokemonFound % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('✅ SYNC COMPLETE');
  console.log('='.repeat(70));
  console.log(`📊 Total NFTs Processed: ${syncCheckpoint.processedCount.toLocaleString()}/${allNFTs.length.toLocaleString()}`);
  console.log(`🎴 Pokemon Cards Found: ${syncCheckpoint.pokemonFound.toLocaleString()}`);
  console.log(`💾 Saved to Database: ${syncCheckpoint.pokemonSaved.toLocaleString()}`);
  console.log(`💰 With OpenSea Pricing: ${syncCheckpoint.openSeaPriced.toLocaleString()}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

syncPokemonCards().catch(console.error);
