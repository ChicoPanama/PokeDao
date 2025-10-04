/**
 * Harvest Courtyard.io NFTs from Polygon using Alchemy NFT API
 *
 * Contract: 0x251be3a17af4892035c37ebf5890f4a4d889dcad (Courtyard on Polygon)
 * Total Supply: ~288,270 NFTs
 *
 * Strategy: Use Alchemy's getNFTsForContract API for fast bulk fetching
 *
 * Run: pnpm tsx scripts/harvest-courtyard-polygon.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// Extract Alchemy API key from POLYGON_RPC_URL
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || '';
const ALCHEMY_KEY = POLYGON_RPC_URL.match(/\/v2\/([^/]+)$/)?.[1] || '';

if (!ALCHEMY_KEY) {
  console.error('❌ Error: POLYGON_RPC_URL not found in .env');
  console.error('   Expected format: https://polygon-mainnet.g.alchemy.com/v2/YOUR-KEY');
  process.exit(1);
}

const ALCHEMY_BASE_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;
const COURTYARD_CONTRACT = '0x251be3a17af4892035c37ebf5890f4a4d889dcad';
const MAX_RETRIES = 5;

interface AlchemyNFT {
  tokenId: string;
  name?: string;
  description?: string;
  image?: { cachedUrl?: string };
  raw?: {
    metadata?: any;
  };
}

interface CourtyardNFT {
  tokenId: string;
  name?: string;
  description?: string;
  image?: string;
  metadata?: any;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchNFTsPage(pageKey?: string, retries = 0): Promise<{ nfts: AlchemyNFT[]; pageKey?: string }> {
  const url = new URL(`${ALCHEMY_BASE_URL}/getNFTsForContract`);
  url.searchParams.set('contractAddress', COURTYARD_CONTRACT);
  url.searchParams.set('withMetadata', 'true');
  if (pageKey) {
    url.searchParams.set('pageKey', pageKey);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      // If 502 Bad Gateway or 503 Service Unavailable, retry with exponential backoff
      if ((response.status === 502 || response.status === 503) && retries < MAX_RETRIES) {
        const backoffMs = Math.min(1000 * Math.pow(2, retries), 30000); // Max 30s
        console.log(`  ⚠️  ${response.statusText} - Retrying in ${(backoffMs / 1000).toFixed(1)}s... (${retries + 1}/${MAX_RETRIES})`);
        await sleep(backoffMs);
        return fetchNFTsPage(pageKey, retries + 1);
      }
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      nfts: data.nfts || [],
      pageKey: data.pageKey,
    };
  } catch (error: any) {
    // Network errors - retry
    if (retries < MAX_RETRIES && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
      const backoffMs = Math.min(1000 * Math.pow(2, retries), 30000);
      console.log(`  ⚠️  Network error - Retrying in ${(backoffMs / 1000).toFixed(1)}s... (${retries + 1}/${MAX_RETRIES})`);
      await sleep(backoffMs);
      return fetchNFTsPage(pageKey, retries + 1);
    }
    throw error;
  }
}

async function harvestCourtyard() {
  const startTime = Date.now();
  const outputPath = 'data/courtyard/polygon-harvest.json';
  const checkpointPath = 'data/courtyard/polygon-checkpoint.json';

  console.log('🚀 COURTYARD.IO POLYGON HARVESTER (Alchemy NFT API)');
  console.log('=' .repeat(60));
  console.log(`📡 API: Alchemy NFT API`);
  console.log(`📜 Contract: ${COURTYARD_CONTRACT}`);
  console.log('='.repeat(60));

  let allNFTs: CourtyardNFT[] = [];
  let pageKey: string | undefined;
  let pageCount = 0;

  // Check for existing checkpoint
  if (existsSync(checkpointPath)) {
    try {
      const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
      allNFTs = checkpoint.nfts || [];
      pageKey = checkpoint.nextPageKey;
      pageCount = checkpoint.pageCount || 0;
      console.log(`\n🔄 Resuming from checkpoint: ${allNFTs.length.toLocaleString()} NFTs, Page ${pageCount + 1}`);
    } catch (error) {
      console.log('\n⚠️  Checkpoint file corrupted, starting fresh');
    }
  }

  console.log('\n🔄 Fetching NFTs...\n');

  do {
    pageCount++;
    const { nfts, pageKey: nextPageKey } = await fetchNFTsPage(pageKey);

    const mappedNFTs = nfts.map(nft => ({
      tokenId: nft.tokenId,
      name: nft.name,
      description: nft.description,
      image: nft.image?.cachedUrl,
      metadata: nft.raw?.metadata,
    }));

    allNFTs.push(...mappedNFTs);
    console.log(`📦 Page ${pageCount}: +${nfts.length} NFTs (Total: ${allNFTs.length.toLocaleString()})`);

    pageKey = nextPageKey;

    // Save checkpoint every 100 pages
    if (pageCount % 100 === 0) {
      writeFileSync(checkpointPath, JSON.stringify({
        nfts: allNFTs,
        nextPageKey: pageKey,
        pageCount,
        timestamp: new Date().toISOString(),
      }));
      console.log('  💾 Checkpoint saved');
    }

    // Rate limit: ~330 requests/second for Alchemy, but be conservative
    if (pageKey) {
      await sleep(100);
    }
  } while (pageKey);

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total NFTs: ${allNFTs.length.toLocaleString()}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));

  // Save final output
  const output = {
    metadata: {
      harvestedAt: new Date().toISOString(),
      duration: `${duration}m`,
      source: 'Alchemy NFT API (Polygon)',
      contract: COURTYARD_CONTRACT,
      totalNFTs: allNFTs.length,
    },
    nfts: allNFTs,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);

  // Clean up checkpoint
  if (existsSync(checkpointPath)) {
    writeFileSync(checkpointPath, JSON.stringify({ completed: true }));
  }
}

harvestCourtyard().catch(console.error);
