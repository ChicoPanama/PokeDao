/**
 * Harvest ALL Phygitals Pokemon cards using Helius API
 *
 * Helius is the best Solana RPC/indexer with:
 * - Free tier: 100,000 requests/day
 * - NFT-specific APIs (DAS - Digital Asset Standard)
 * - Complete NFT metadata indexing
 *
 * This will get us ALL 7,261+ cards from Solana blockchain
 *
 * Setup:
 * 1. Get free Helius API key: https://dev.helius.xyz/
 * 2. Add to .env: HELIUS_API_KEY=your_key
 * 3. Run: pnpm tsx scripts/harvest-phygitals-helius.ts
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || ''; // Get from https://dev.helius.xyz
const HELIUS_API_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Known Phygitals creator/authority addresses (from metadata_json)
const PHYGITALS_CREATORS = [
  '4E2yUkRfFPgL2SKn257CjWbMVLRZAKRQ4zerFanoSf65', // From research data
  '2CEe9G68EqWmer21DhRhxJ3coUvRspDxT9NJuc2PJYo5', // From research data
];

const CONFIG = {
  OUTPUT_FILE: 'data/phygitals/helius-complete-harvest.json',
  BATCH_SIZE: 1000, // Helius supports up to 1000 per request
  RATE_LIMIT_MS: 100, // 10 req/s for safety
};

// ============================================================================
// TYPES
// ============================================================================

interface PhygitalsNFT {
  mint: string;
  name: string;
  uri: string;
  price?: number;
  owner: string;
  creators: any[];
  attributes: any[];
  metadata: any;
}

// ============================================================================
// HARVESTER
// ============================================================================

class HeliusPhygitalsHarvester {
  private nfts: Map<string, PhygitalsNFT> = new Map();
  private lastRequestTime = 0;

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY is required. Get one at https://dev.helius.xyz/');
    }
    console.log('🔥 Helius API initialized');
  }

  /**
   * Rate limiting
   */
  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < CONFIG.RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Make Helius DAS API request
   */
  private async heliusRequest(method: string, params: any): Promise<any> {
    await this.rateLimit();

    try {
      const response = await fetch(HELIUS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'pokedao-harvest',
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
      }

      return data.result;
    } catch (error: any) {
      console.error(`   ❌ Helius request failed:`, error.message);
      throw error;
    }
  }

  /**
   * Strategy 1: Get all NFTs by creator address using DAS API
   */
  private async harvestByCreator(creatorAddress: string) {
    console.log(`\n🎨 Fetching NFTs by creator: ${creatorAddress}`);

    try {
      let page = 1;
      let hasMore = true;
      let before: string | undefined = undefined;

      while (hasMore) {
        const params: any = {
          creatorAddress,
          limit: CONFIG.BATCH_SIZE,
        };

        if (before) {
          params.before = before;
        }

        const response = await this.heliusRequest('getAssetsByCreator', params);

        if (!response || !response.items || response.items.length === 0) {
          console.log(`   ✓ Completed (no more results)`);
          hasMore = false;
          break;
        }

        // Filter for Pokemon cards
        const pokemonCards = response.items.filter((item: any) => {
          const name = item.content?.metadata?.name || '';
          const attributes = item.content?.metadata?.attributes || [];

          return (
            name.toLowerCase().includes('pokemon') ||
            attributes.some((attr: any) =>
              attr.trait_type === 'Category' && attr.value === 'Pokemon'
            )
          );
        });

        for (const item of pokemonCards) {
          const nft: PhygitalsNFT = {
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

        console.log(`   Page ${page}: +${pokemonCards.length} Pokemon cards (Total: ${this.nfts.size})`);

        // Update cursor for next page
        before = response.items[response.items.length - 1]?.id;
        page++;
        hasMore = response.items.length === CONFIG.BATCH_SIZE;
      }

    } catch (error: any) {
      console.error(`   ❌ Failed to fetch by creator:`, error.message);
    }
  }

  /**
   * Strategy 2: Search by owner (if we know Phygitals vault wallet)
   */
  private async harvestByOwner(ownerAddress: string) {
    console.log(`\n👛 Fetching NFTs by owner: ${ownerAddress}`);

    try {
      const response = await this.heliusRequest('getAssetsByOwner', {
        ownerAddress,
        page: 1,
        limit: CONFIG.BATCH_SIZE,
      });

      if (response && response.items) {
        console.log(`   Found ${response.items.length} NFTs owned by this wallet`);

        // Filter for Pokemon/Phygitals
        const phygitalsCards = response.items.filter((item: any) => {
          const name = item.content?.metadata?.name || '';
          return name.toLowerCase().includes('pokemon');
        });

        console.log(`   Pokemon cards: ${phygitalsCards.length}`);
      }

    } catch (error: any) {
      console.error(`   ❌ Failed to fetch by owner:`, error.message);
    }
  }

  /**
   * Run complete harvest
   */
  async harvest() {
    console.log('🚀 HELIUS PHYGITALS COMPLETE HARVEST');
    console.log('🎯 Target: ALL 7,261+ Pokemon cards from Solana blockchain\n');

    const startTime = Date.now();

    // Harvest from all known creator addresses
    for (const creator of PHYGITALS_CREATORS) {
      await this.harvestByCreator(creator);
    }

    // Additional strategies can be added here
    // await this.harvestByOwner(PHYGITALS_VAULT_WALLET);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('✅ HARVEST COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Total Unique NFTs: ${this.nfts.size}`);
    console.log(`🎯 Target: 7,261 cards`);
    console.log(`📈 Coverage: ${((this.nfts.size / 7261) * 100).toFixed(1)}%`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('='.repeat(60));

    // Save results
    const output = {
      metadata: {
        harvestedAt: new Date().toISOString(),
        duration: `${duration}s`,
        source: 'Helius API (Solana Blockchain)',
        totalNFTs: this.nfts.size,
        target: 7261,
        coveragePercent: ((this.nfts.size / 7261) * 100).toFixed(1) + '%',
        creators: PHYGITALS_CREATORS,
      },
      nfts: Array.from(this.nfts.values()),
    };

    writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved to: ${CONFIG.OUTPUT_FILE}`);

    // Show top samples
    const samples = Array.from(this.nfts.values()).slice(0, 5);
    if (samples.length > 0) {
      console.log('\n📋 Sample NFTs:');
      samples.forEach((nft, i) => {
        console.log(`\n${i + 1}. ${nft.name}`);
        console.log(`   Mint: ${nft.mint}`);
        console.log(`   Owner: ${nft.owner.substring(0, 20)}...`);
        console.log(`   Attributes: ${nft.attributes.length}`);
      });
    }

    // Next steps if incomplete
    if (this.nfts.size < 7261) {
      console.log('\n💡 To get remaining cards:');
      console.log('   1. Find additional Phygitals creator/authority addresses');
      console.log('   2. Query Phygitals vault wallet addresses');
      console.log('   3. Use collection-based queries (if collection address known)');
      console.log('   4. Combine with existing research data (1,195 cards)');
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  if (!HELIUS_API_KEY) {
    console.log('❌ HELIUS_API_KEY not found in environment');
    console.log('\n📝 Setup Instructions:');
    console.log('   1. Go to: https://dev.helius.xyz/');
    console.log('   2. Sign up for free account');
    console.log('   3. Create an API key');
    console.log('   4. Add to .env: HELIUS_API_KEY=your_key_here');
    console.log('   5. Re-run this script\n');
    process.exit(1);
  }

  const harvester = new HeliusPhygitalsHarvester(HELIUS_API_KEY);
  await harvester.harvest();
}

main().catch(console.error);
