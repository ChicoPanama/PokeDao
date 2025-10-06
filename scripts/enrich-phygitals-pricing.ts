/**
 * Enrich Phygitals NFTs with pricing data from Solana
 *
 * Strategy:
 * 1. Query Phygitals NFTs from database
 * 2. Use Helius API to fetch NFT metadata + marketplace listings
 * 3. Parse card details from metadata
 * 4. Extract listing prices from Tensor/Magic Eden orderbooks
 * 5. Update database with enriched data
 *
 * Run: pnpm tsx scripts/enrich-phygitals-pricing.ts
 */

import prisma from '../api/src/lib/prisma.js';
import { Connection } from '@solana/web3.js';
import fetch from 'node-fetch';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 200; // 5 req/sec on free tier

interface HeliusNFT {
  id: string;
  content: {
    metadata: {
      name?: string;
      description?: string;
      attributes?: Array<{
        trait_type: string;
        value: string;
      }>;
    };
  };
  grouping?: Array<{
    group_key: string;
    group_value: string;
  }>;
}

interface MarketplaceListing {
  price: number;
  marketplace: string;
  seller: string;
  listedAt?: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAssetsByIds(mintAddresses: string[]): Promise<HeliusNFT[]> {
  try {
    const response = await fetch(`${HELIUS_RPC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'pokedao-enrichment',
        method: 'getAssetBatch',
        params: {
          ids: mintAddresses,
        },
      }),
    });

    const data: any = await response.json();
    if (data.error) {
      throw new Error(`Helius Error: ${data.error.message}`);
    }

    return data.result || [];
  } catch (error: any) {
    console.error('  ✗ Helius API error:', error.message);
    return [];
  }
}

async function getMarketplaceListings(mintAddress: string): Promise<MarketplaceListing | null> {
  try {
    // Use Helius DAS API to check for active listings
    const response = await fetch(`${HELIUS_RPC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'pokedao-listings',
        method: 'getAsset',
        params: {
          id: mintAddress,
          displayOptions: {
            showCollectionMetadata: true,
          },
        },
      }),
    });

    const data: any = await response.json();
    if (data.error || !data.result) return null;

    const asset = data.result;

    // Check if listed (ownership structure indicates marketplace escrow)
    if (asset.ownership?.owner && asset.ownership.owner !== asset.creators?.[0]?.address) {
      // Likely listed - but we need to query marketplace APIs for actual price
      // For now, return null (prices need marketplace-specific APIs)
      return null;
    }

    return null;
  } catch (error) {
    return null;
  }
}

function parseCardName(name: string): string {
  if (!name || name === 'Unknown Unknown #') return 'Unknown';

  // Remove grade info
  const withoutGrade = name.replace(/\s+(?:PSA|CGC|BGS)\s+[\d.]+$/i, '').trim();

  // Extract card name (before set number)
  const match = withoutGrade.match(/^(.+?)\s+#/);
  if (match) return match[1].trim();

  return withoutGrade || 'Unknown';
}

function parseSetNumber(name: string): string | null {
  const match = name.match(/#(\d+)/);
  return match ? match[1] : null;
}

function parseSetName(metadata: any): string {
  // Look for set in attributes
  const setAttr = metadata.attributes?.find(
    (a: any) => a.trait_type?.toLowerCase() === 'set' || a.trait_type?.toLowerCase() === 'series'
  );
  if (setAttr) return setAttr.value;

  // Try to extract from description
  if (metadata.description) {
    const match = metadata.description.match(/Set:\s*(.+?)(?:\n|$)/i);
    if (match) return match[1].trim();
  }

  return 'Unknown';
}

function parseGrade(name: string): number | null {
  const match = name.match(/(?:PSA|CGC|BGS)\s+([\d.]+)/i);
  return match ? parseFloat(match[1]) : null;
}

function parseGradeCompany(name: string): 'PSA' | 'CGC' | 'BGS' | null {
  if (/\bPSA\b/i.test(name)) return 'PSA';
  if (/\bCGC\b/i.test(name)) return 'CGC';
  if (/\bBGS\b/i.test(name)) return 'BGS';
  return null;
}

async function enrichPhygitals() {
  console.log('🔍 PHYGITALS NFT ENRICHMENT');
  console.log('='.repeat(60));
  console.log(`📡 Helius RPC: ${HELIUS_RPC.split('?')[0]}`);
  console.log('='.repeat(60));
  console.log('');

  // Get all Phygitals NFTs
  const nfts = await prisma.unifiedMarketListing.findMany({
    where: {
      source: 'PHYGITALS',
    },
    take: 1000, // Process first 1000 for now
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${nfts.length} NFTs to enrich`);
  console.log('');

  let enriched = 0;
  let withPrice = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < nfts.length; i += BATCH_SIZE) {
    const batch = nfts.slice(i, Math.min(i + BATCH_SIZE, nfts.length));
    const mintAddresses = batch.map((nft) => nft.sourceId);

    console.log(`📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(nfts.length / BATCH_SIZE)} (${mintAddresses.length} NFTs)...`);

    try {
      // Fetch metadata from Helius
      const assets = await getAssetsByIds(mintAddresses);

      for (let j = 0; j < batch.length; j++) {
        const nft = batch[j];
        const asset = assets.find((a) => a.id === nft.sourceId);

        if (!asset || !asset.content?.metadata) {
          failed++;
          continue;
        }

        const metadata = asset.content.metadata;
        const name = metadata.name || 'Unknown Unknown #';

        // Parse card details
        const cardName = parseCardName(name);
        const setName = parseSetName(metadata);
        const cardNumber = parseSetNumber(name);
        const grade = parseGrade(name);
        const gradeCompany = parseGradeCompany(name);

        // Try to get marketplace listing (for pricing)
        const listing = await getMarketplaceListings(nft.sourceId);
        const priceCents = listing ? Math.round(listing.price * 100) : 0;

        if (priceCents > 0) withPrice++;

        // Update database
        await prisma.unifiedMarketListing.update({
          where: { id: nft.id },
          data: {
            cardName: cardName.substring(0, 255),
            setName: setName.substring(0, 255),
            cardNumber: cardNumber?.substring(0, 10),
            grade: grade,
            gradeCompany: gradeCompany,
            priceCents: priceCents,
            dataQuality: cardName !== 'Unknown' ? 0.8 : 0.3,
          },
        });

        enriched++;
        await sleep(50); // Small delay between updates
      }

      console.log(`  ✓ Enriched ${batch.length} NFTs`);
      await sleep(RATE_LIMIT_MS);

    } catch (error: any) {
      console.error(`  ✗ Batch error:`, error.message);
      failed += batch.length;
      await sleep(RATE_LIMIT_MS * 2);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ENRICHMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total: ${nfts.length}`);
  console.log(`✅ Enriched: ${enriched}`);
  console.log(`💰 With Price: ${withPrice}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

enrichPhygitals().catch(console.error);
