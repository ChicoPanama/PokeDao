/**
 * Enrich Courtyard NFTs with on-chain sales data from Polygon
 *
 * Uses Alchemy/Polygon RPC to query ERC-721 transfer events
 * and extract marketplace sale prices.
 *
 * Run: pnpm tsx scripts/enrich-courtyard-onchain-sales.ts
 */

import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';

const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const COURTYARD_CONTRACT = '0xd4ac3CE8e1E14CD60666D49AC34Ff2d2937cF6FA';
const BATCH_SIZE = 10;
const RATE_LIMIT_MS = 500;

// Known Polygon marketplace contracts
const MARKETPLACES = {
  OPENSEA_SEAPORT: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC',
  COURTYARD_MARKETPLACE: '0x...', // Unknown - need to find
};

interface Transfer {
  blockNumber: string;
  from: string;
  to: string;
  tokenId: string;
  transactionHash: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function polygonRpcCall(method: string, params: any[]): Promise<any> {
  const response = await fetch(POLYGON_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  const data: any = await response.json();
  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }
  return data.result;
}

async function getTransferEvents(tokenId: string): Promise<Transfer[]> {
  try {
    // ERC-721 Transfer event signature
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    // Get logs for this specific token
    const tokenIdHex = '0x' + BigInt(tokenId).toString(16).padStart(64, '0');

    const logs = await polygonRpcCall('eth_getLogs', [
      {
        address: COURTYARD_CONTRACT,
        topics: [
          transferTopic,
          null, // from (any)
          null, // to (any)
          tokenIdHex, // tokenId
        ],
        fromBlock: '0x' + (53000000).toString(16), // Start from recent block ~3 months ago
        toBlock: 'latest',
      },
    ]);

    return logs.map((log: any) => ({
      blockNumber: log.blockNumber,
      from: '0x' + log.topics[1].slice(-40),
      to: '0x' + log.topics[2].slice(-40),
      tokenId: BigInt(log.topics[3]).toString(),
      transactionHash: log.transactionHash,
    }));
  } catch (error: any) {
    console.error(`  ✗ Error getting transfers for token ${tokenId}:`, error.message);
    return [];
  }
}

async function getTransactionValue(txHash: string): Promise<number> {
  try {
    const tx = await polygonRpcCall('eth_getTransactionByHash', [txHash]);

    if (!tx || !tx.value) return 0;

    // Convert wei to MATIC, then to USD cents
    const maticAmount = parseInt(tx.value, 16) / 1e18;
    // Using approximate MATIC price of $0.50
    const usdCents = Math.round(maticAmount * 0.5 * 100);

    return usdCents;
  } catch (error) {
    return 0;
  }
}

async function extractLastSalePrice(tokenId: string): Promise<number | null> {
  const transfers = await getTransferEvents(tokenId);

  if (transfers.length === 0) return null;

  // Get the most recent transfer (likely the sale)
  const lastTransfer = transfers[transfers.length - 1];

  // Check if it was a sale (non-zero transaction value)
  const salePrice = await getTransactionValue(lastTransfer.transactionHash);

  return salePrice > 0 ? salePrice : null;
}

async function enrichCourtyardSales() {
  console.log('🔗 COURTYARD ON-CHAIN SALES ENRICHMENT');
  console.log('='.repeat(60));
  console.log(`📡 Polygon RPC: ${POLYGON_RPC}`);
  console.log(`📜 Contract: ${COURTYARD_CONTRACT}`);
  console.log('='.repeat(60));
  console.log('');

  // Get Courtyard NFTs without prices (that have enriched metadata)
  const nfts = await prisma.unifiedMarketListing.findMany({
    where: {
      source: 'COURTYARD',
      priceCents: 0,
      cardName: { not: 'Unknown' },
    },
    take: 500, // Process 500 for now (RPC intensive)
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${nfts.length.toLocaleString()} NFTs to check for sales`);
  console.log('   (Note: This is slow - querying Polygon for each NFT)');
  console.log('');

  let withSales = 0;
  let noSales = 0;
  let errors = 0;

  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];

    if ((i + 1) % 10 === 0) {
      console.log(`📈 Progress: ${i + 1}/${nfts.length} (${withSales} with sales, ${noSales} no sales)`);
    }

    try {
      // Get last sale price from on-chain data
      const salePrice = await extractLastSalePrice(nft.sourceId);

      if (salePrice && salePrice > 0) {
        // Update database with sale price
        await prisma.unifiedMarketListing.update({
          where: { id: nft.id },
          data: {
            priceCents: salePrice,
            dataQuality: 0.9, // High quality - from on-chain data
          },
        });
        withSales++;
      } else {
        noSales++;
      }

      await sleep(RATE_LIMIT_MS);

    } catch (error: any) {
      console.error(`  ✗ Error processing NFT ${nft.sourceId}:`, error.message);
      errors++;
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ENRICHMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total NFTs checked: ${nfts.length.toLocaleString()}`);
  console.log(`✅ With on-chain sales: ${withSales.toLocaleString()}`);
  console.log(`⏭️  No sales found: ${noSales.toLocaleString()}`);
  console.log(`❌ Errors: ${errors.toLocaleString()}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

enrichCourtyardSales().catch(console.error);
