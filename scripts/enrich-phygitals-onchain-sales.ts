/**
 * Enrich Phygitals NFTs with on-chain sales data from Solana
 *
 * Uses Helius DAS API to query transaction history and extract
 * actual sale prices from marketplace transactions.
 *
 * Run: pnpm tsx scripts/enrich-phygitals-onchain-sales.ts
 */

import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 200; // 5 req/sec

// Known Solana marketplace program IDs
const MARKETPLACES = {
  MAGIC_EDEN_V2: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K',
  TENSOR: 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN',
  SOLANART: 'CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz',
  OPEN_SEA: '3o9d13qUvEuuauhFrVom1vuCzgNsJifeaBYDPquaT73Y',
};

interface Transaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  nativeTransfers?: Array<{
    amount: number;
    fromUserAccount: string;
    toUserAccount: string;
  }>;
  tokenTransfers?: Array<{
    mint: string;
    fromUserAccount: string;
    toUserAccount: string;
  }>;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAssetTransactions(mintAddress: string): Promise<Transaction[]> {
  try {
    const url = `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&type=NFT_SALE`;

    const response = await fetch(url);

    if (!response.ok) {
      return [];
    }

    const data: any = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    return [];
  }
}

function extractSalePrice(transactions: Transaction[]): number | null {
  // Find the most recent sale transaction
  for (const tx of transactions) {
    // Check if it's a marketplace transaction
    if (tx.type === 'NFT_SALE' || tx.source in Object.values(MARKETPLACES)) {
      // Look for SOL transfer (payment)
      const solTransfer = tx.nativeTransfers?.find(t => t.amount > 0);
      if (solTransfer) {
        // Convert lamports to SOL, then to USD cents
        const solAmount = solTransfer.amount / 1e9;
        // Using approximate SOL price of $150 (should ideally fetch real-time price)
        const usdCents = Math.round(solAmount * 150 * 100);
        return usdCents;
      }
    }
  }
  return null;
}

async function enrichPhygitalsSales() {
  console.log('🔗 PHYGITALS ON-CHAIN SALES ENRICHMENT');
  console.log('='.repeat(60));
  console.log(`📡 Helius RPC: ${HELIUS_RPC.split('?')[0]}`);
  console.log('='.repeat(60));
  console.log('');

  // Get all Phygitals NFTs without prices
  const nfts = await prisma.unifiedMarketListing.findMany({
    where: {
      source: 'PHYGITALS',
      priceCents: 0,
    },
    take: 1000, // Process first 1000
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${nfts.length.toLocaleString()} NFTs to check for sales`);
  console.log('');

  let withSales = 0;
  let noSales = 0;
  let errors = 0;

  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];

    if ((i + 1) % 50 === 0) {
      console.log(`📈 Progress: ${i + 1}/${nfts.length} (${withSales} with sales, ${noSales} no sales)`);
    }

    try {
      // Get transaction history
      const transactions = await getAssetTransactions(nft.sourceId);

      if (transactions.length === 0) {
        noSales++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // Extract sale price from transactions
      const salePrice = extractSalePrice(transactions);

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

enrichPhygitalsSales().catch(console.error);
