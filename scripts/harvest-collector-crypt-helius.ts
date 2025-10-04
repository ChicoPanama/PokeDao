/**
 * Harvest Collector Crypt NFTs from Solana blockchain using Helius API
 *
 * Similar to Phygitals harvest, but for Collector Crypt collection
 *
 * Run: pnpm tsx scripts/harvest-collector-crypt-helius.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_API_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Collector Crypt creator addresses (discovered via find-collector-crypt-creators.ts)
const COLLECTOR_CRYPT_CREATORS = [
  '4qsQtppxMVv3KAQGN7hzMNEw81znyKKhZw3BcFYb3XXA', // Verified creator
  'DFEstpYN3fsz93AC9v2ujzPPngPgodqH2xxopuyfSsAE', // 100% share
];

const CONFIG = {
  BATCH_SIZE: 1000,
  RATE_LIMIT_MS: 100, // 10 requests per second
};

interface CollectorCryptNFT {
  mint: string;
  name: string;
  uri: string;
  owner: string;
  creators: any[];
  attributes: any[];
  metadata: any;
}

class CollectorCryptHeliusHarvester {
  private nfts: Map<string, CollectorCryptNFT> = new Map();
  private lastRequestTime = 0;

  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < CONFIG.RATE_LIMIT_MS) {
      await new Promise(resolve =>
        setTimeout(resolve, CONFIG.RATE_LIMIT_MS - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async heliusRequest(method: string, params: any): Promise<any> {
    await this.rateLimit();

    const response = await fetch(HELIUS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'collector-crypt-harvest',
        method,
        params,
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
    }
    return data.result;
  }

  private async harvestByCreator(creatorAddress: string) {
    console.log(`\n📦 Harvesting NFTs from creator: ${creatorAddress}`);

    let page = 1;
    let hasMore = true;
    let before: string | undefined = undefined;

    while (hasMore) {
      console.log(`  Page ${page}...`);

      const params: any = {
        creatorAddress,
        limit: CONFIG.BATCH_SIZE,
      };
      if (before) params.before = before;

      const response = await this.heliusRequest('getAssetsByCreator', params);

      // Filter for Pokemon/trading cards (Collector Crypt focuses on Pokemon)
      const cards = response.items.filter((item: any) => {
        const name = item.content?.metadata?.name || '';
        // Collector Crypt uses different naming convention
        return (
          name.toLowerCase().includes('collector crypt') ||
          name.toLowerCase().includes('pokemon') ||
          name.toLowerCase().includes('pack')
        );
      });

      console.log(`    Found ${cards.length} cards (${response.items.length} total NFTs)`);

      for (const item of cards) {
        const nft: CollectorCryptNFT = {
          mint: item.id,
          name: item.content?.metadata?.name || 'Unknown',
          uri: item.content?.json_uri || '',
          owner: item.ownership?.owner || '',
          creators: item.creators || [],
          attributes: item.content?.metadata?.attributes || [],
          metadata: item,
        };
        this.nfts.set(nft.mint, nft);
      }

      before = response.items[response.items.length - 1]?.id;
      page++;
      hasMore = response.items.length === CONFIG.BATCH_SIZE;
    }

    console.log(`  ✓ Total collected from this creator: ${this.nfts.size}`);
  }

  async harvest() {
    const startTime = Date.now();

    console.log('🚀 COLLECTOR CRYPT HELIUS HARVESTER');
    console.log('=' .repeat(60));
    console.log(`📡 Using Helius API on Solana`);
    console.log(`🎯 Target: ${COLLECTOR_CRYPT_CREATORS.length} creator addresses`);
    console.log('=' .repeat(60));

    for (const creator of COLLECTOR_CRYPT_CREATORS) {
      await this.harvestByCreator(creator);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('✅ HARVEST COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Total Unique NFTs: ${this.nfts.size}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('='.repeat(60));

    // Show samples
    if (this.nfts.size > 0) {
      console.log('\n📋 Sample NFTs:');
      const samples = Array.from(this.nfts.values()).slice(0, 5);
      samples.forEach((nft, i) => {
        console.log(`${i + 1}. ${nft.name}`);
        console.log(`   Mint: ${nft.mint}`);
        console.log(`   Attributes: ${nft.attributes.length}`);
      });
    }

    // Save to file
    const output = {
      metadata: {
        harvestedAt: new Date().toISOString(),
        duration: `${duration}s`,
        source: 'Helius API (Solana Blockchain)',
        totalNFTs: this.nfts.size,
        creators: COLLECTOR_CRYPT_CREATORS,
      },
      nfts: Array.from(this.nfts.values()),
    };

    const outputPath = 'data/collector-crypt/helius-complete-harvest.json';
    writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`\n💾 Saved to: ${outputPath}`);
    console.log(`📦 File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
  }
}

// Run harvester
const harvester = new CollectorCryptHeliusHarvester();
harvester.harvest().catch(console.error);
