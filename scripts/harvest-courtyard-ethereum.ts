/**
 * Harvest Courtyard.io NFTs from Ethereum using free public RPC
 *
 * Contract: 0xd4ac3CE8e1E14CD60666D49AC34Ff2d2937cF6FA (Courtyard Registry)
 * Total Supply: ~285,090 NFTs
 *
 * Strategy: Use Alchemy's free tier or public Ethereum RPC to query NFTs
 *
 * Run: pnpm tsx scripts/harvest-courtyard-ethereum.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// Ethereum RPC - use ETHEREUM_RPC_URL from .env or fall back to Alchemy key
const ETHEREUM_RPC = process.env.ETHEREUM_RPC_URL ||
  (process.env.ALCHEMY_API_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : 'https://eth.llamarpc.com'); // Free public RPC fallback

const COURTYARD_REGISTRY = '0xd4ac3CE8e1E14CD60666D49AC34Ff2d2937cF6FA';
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 250; // 4 requests per second for free tier

interface CourtyardNFT {
  tokenId: string;
  owner: string;
  tokenURI?: string;
  metadata?: any;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ethRpcCall(method: string, params: any[]): Promise<any> {
  const response = await fetch(ETHEREUM_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }
  return data.result;
}

async function getTotalSupply(): Promise<number> {
  // ERC-721 totalSupply() selector: 0x18160ddd
  const result = await ethRpcCall('eth_call', [
    {
      to: COURTYARD_REGISTRY,
      data: '0x18160ddd',
    },
    'latest',
  ]);

  return parseInt(result, 16);
}

async function getTokenByIndex(index: number): Promise<string> {
  // ERC-721 Enumerable tokenByIndex(uint256) selector: 0x4f6ccce7
  const indexHex = index.toString(16).padStart(64, '0');
  const result = await ethRpcCall('eth_call', [
    {
      to: COURTYARD_REGISTRY,
      data: `0x4f6ccce7${indexHex}`,
    },
    'latest',
  ]);

  // Use BigInt to handle large token IDs
  return BigInt(result).toString();
}

async function getOwnerOf(tokenId: string): Promise<string> {
  // ERC-721 ownerOf(uint256) selector: 0x6352211e
  const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
  const result = await ethRpcCall('eth_call', [
    {
      to: COURTYARD_REGISTRY,
      data: `0x6352211e${tokenIdHex}`,
    },
    'latest',
  ]);

  // Extract address from result (last 40 chars)
  return '0x' + result.slice(-40);
}

async function harvestCourtyard() {
  const startTime = Date.now();
  const outputPath = 'data/courtyard/ethereum-harvest.json';
  const checkpointPath = 'data/courtyard/harvest-checkpoint.json';

  console.log('🚀 COURTYARD.IO ETHEREUM HARVESTER');
  console.log('=' .repeat(60));
  console.log(`📡 RPC: ${ETHEREUM_RPC.includes('alchemy') ? 'Alchemy' : 'Public RPC'}`);
  console.log(`📜 Contract: ${COURTYARD_REGISTRY}`);
  console.log('='.repeat(60));

  // Get total supply
  console.log('\n📊 Fetching total supply...');
  const totalSupply = await getTotalSupply();
  console.log(`✓ Total NFTs: ${totalSupply.toLocaleString()}`);

  // Load checkpoint if exists
  let startIndex = 0;
  let allNFTs: CourtyardNFT[] = [];

  if (existsSync(checkpointPath)) {
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    startIndex = checkpoint.lastIndex + 1;
    allNFTs = checkpoint.nfts || [];
    console.log(`\n🔄 Resuming from index ${startIndex} (${allNFTs.length} NFTs already harvested)`);
  }

  console.log(`\n⏳ Note: This will take ~${Math.ceil((totalSupply - startIndex) * RATE_LIMIT_MS / 1000 / 60)} minutes`);
  console.log('   (Harvesting from Ethereum is slower than Solana)\n');

  let batchCount = 0;

  for (let i = startIndex; i < totalSupply; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, totalSupply);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalSupply / BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} (tokens ${i}-${batchEnd - 1})...`);

    const batch: CourtyardNFT[] = [];

    for (let tokenIndex = i; tokenIndex < batchEnd; tokenIndex++) {
      try {
        const tokenId = await getTokenByIndex(tokenIndex);
        const owner = await getOwnerOf(tokenId);

        batch.push({
          tokenId,
          owner,
        });

        await sleep(RATE_LIMIT_MS);
      } catch (error: any) {
        console.error(`  ✗ Error at index ${tokenIndex}:`, error.message);
        // Continue anyway
      }
    }

    allNFTs.push(...batch);
    console.log(`  ✓ Collected ${batch.length} NFTs (Total: ${allNFTs.length})`);

    // Save checkpoint every 10 batches
    batchCount++;
    if (batchCount % 10 === 0) {
      const checkpoint = {
        lastIndex: batchEnd - 1,
        nfts: allNFTs,
        timestamp: new Date().toISOString(),
      };
      writeFileSync(checkpointPath, JSON.stringify(checkpoint));
      console.log(`  💾 Checkpoint saved`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total NFTs: ${allNFTs.length}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));

  // Save final output
  const output = {
    metadata: {
      harvestedAt: new Date().toISOString(),
      duration: `${duration}m`,
      source: 'Ethereum Blockchain',
      contract: COURTYARD_REGISTRY,
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
