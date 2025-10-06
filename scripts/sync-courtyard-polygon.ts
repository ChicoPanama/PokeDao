/**
 * Sync Courtyard.io NFTs from Polygon harvest to PostgreSQL
 *
 * This script:
 * 1. Reads ~288K Pokemon cards from polygon-harvest.json or polygon-checkpoint.json
 * 2. Parses card metadata from Alchemy NFT API format
 * 3. Extracts grading, set, year, and card info from attributes
 * 4. Creates UnifiedMarketListing records in database
 *
 * Run: pnpm tsx scripts/sync-courtyard-polygon.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface CourtyardNFT {
  tokenId: string;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  metadata?: {
    attributes?: Array<{
      trait_type?: string;
      value?: string;
    }>;
    item_info?: {
      asset_pictures?: string[];
    };
    external_url?: string;
  };
}

interface CourtyardHarvest {
  metadata: {
    harvestedAt: string;
    duration: string;
    source: string;
    totalNFTs: number;
  };
  nfts: CourtyardNFT[];
}

interface CourtyardCheckpoint {
  nfts: CourtyardNFT[];
  nextPageKey?: string;
  pageCount: number;
  timestamp: string;
}

interface ParsedCard {
  tokenId: string;
  title: string;
  pokemonName: string;
  setName: string;
  cardNumber: string;
  grader: string;
  grade: string;
  year?: number;
  imageUrl?: string;
  externalUrl?: string;
}

// ============================================================================
// PARSER
// ============================================================================

class CourtyardParser {
  /**
   * Extract attribute value by trait_type
   */
  private getAttribute(nft: CourtyardNFT, traitType: string): string | undefined {
    return nft.metadata?.attributes?.find(
      (attr) => attr.trait_type === traitType
    )?.value;
  }

  /**
   * Parse a single NFT into structured card data
   */
  parseCard(nft: CourtyardNFT): ParsedCard | null {
    try {
      // Skip NFTs without metadata (null metadata = not revealed/invalid)
      if (!nft.name || !nft.metadata) {
        return null;
      }

      // Skip non-Pokemon cards (Football, etc)
      const category = this.getAttribute(nft, 'Category');
      if (category && !category.includes('Pokémon') && !category.includes('Pokemon')) {
        return null;
      }

      // Skip sealed packs
      if (nft.name.includes('Sealed Pack')) {
        return null;
      }

      const title = nft.name;
      const setName = this.getAttribute(nft, 'Set') || 'Unknown';
      const cardNumber = this.getAttribute(nft, 'Card Number') || '';
      const grader = this.getAttribute(nft, 'Grader') || 'Unknown';
      const grade = this.getAttribute(nft, 'Grade') || 'Unknown';
      const yearStr = this.getAttribute(nft, 'Year');
      const year = yearStr ? parseInt(yearStr) : undefined;

      // Pokemon name from "Title/Subject" or "Title/PKMN" attribute
      const pokemonName =
        this.getAttribute(nft, 'Title/PKMN') ||
        this.getAttribute(nft, 'Title/Subject') ||
        'Unknown';

      const imageUrl = nft.image || undefined;
      const externalUrl = nft.metadata?.external_url || undefined;

      return {
        tokenId: nft.tokenId,
        title,
        pokemonName,
        setName,
        cardNumber,
        grader,
        grade,
        year,
        imageUrl,
        externalUrl,
      };
    } catch (error: any) {
      console.error(`Failed to parse NFT ${nft.tokenId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse all NFTs
   */
  parseAll(nfts: CourtyardNFT[]): ParsedCard[] {
    const parsed: ParsedCard[] = [];

    for (const nft of nfts) {
      const parsedCard = this.parseCard(nft);
      if (parsedCard) {
        parsed.push(parsedCard);
      }
    }

    return parsed;
  }
}

// ============================================================================
// DATABASE SYNC
// ============================================================================

class CourtyardDBSync {
  constructor(private prisma: PrismaClient) {}

  /**
   * Normalize grader company
   */
  private normalizeGrader(grader: string): string {
    const upperGrader = grader.toUpperCase().trim();
    const graderMap: Record<string, string> = {
      'PSA': 'PSA',
      'BGS': 'BGS',
      'BECKETT': 'BGS',
      'CGC': 'CGC',
      'SGC': 'SGC',
      'ACE': 'ACE',
    };
    return graderMap[upperGrader] || 'OTHER';
  }

  /**
   * Parse grade value from string (e.g., "MINT 9" -> 9.0, "10 GEM MINT" -> 10.0)
   */
  private parseGradeValue(grade: string): number {
    const match = grade.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Sync a single parsed card to database
   */
  async syncCard(card: ParsedCard): Promise<void> {
    try {
      // Check if listing already exists
      const existing = await this.prisma.unifiedMarketListing.findUnique({
        where: {
          source_sourceId: {
            source: 'COURTYARD',
            sourceId: card.tokenId,
          },
        },
      });

      const now = new Date();

      if (existing) {
        // Skip existing cards (Courtyard doesn't have price data in harvest)
        return;
      }

      // Create new unified market listing
      const id = randomBytes(12).toString('base64url');

      // Truncate fields to match database column constraints
      const title = card.title.substring(0, 500);
      const cardName = (card.pokemonName || '').substring(0, 255);
      const setName = (card.setName || '').substring(0, 255);
      let cardNumber = (card.cardNumber || '').substring(0, 10); // VARCHAR(10)
      const url = (card.externalUrl || '').substring(0, 500);
      const sourceId = card.tokenId.substring(0, 100); // VARCHAR(100)

      // Remove leading zeros from card number
      if (cardNumber) {
        cardNumber = parseInt(cardNumber, 10).toString();
      }

      await this.prisma.unifiedMarketListing.create({
        data: {
          id,
          source: 'COURTYARD',
          sourceId,
          title,
          rawTitle: title,
          cardName,
          setName,
          cardNumber,
          variant: null,
          gradeCompany: this.normalizeGrader(card.grader) as any,
          grade: this.parseGradeValue(card.grade),
          priceCents: 0, // No price data from Alchemy NFT API
          currency: 'USD',
          url,
          dataQuality: 0.95, // Very high quality - from Courtyard official metadata
          createdAt: now,
          updatedAt: now,
        },
      });

      console.log(`  ✓ Synced: ${card.pokemonName} ${card.setName} #${cardNumber} ${card.grader} ${card.grade}`);
    } catch (error: any) {
      console.error(`  ✗ Failed to sync card ${card.tokenId}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync all cards in batches
   */
  async syncAll(cards: ParsedCard[], batchSize = 100): Promise<void> {
    console.log(`\n🔄 Starting database sync of ${cards.length.toLocaleString()} cards...`);

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(cards.length / batchSize);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (cards ${i + 1}-${Math.min(i + batchSize, cards.length)})`);

      for (const card of batch) {
        try {
          await this.syncCard(card);
          synced++;
        } catch (error) {
          failed++;
        }
      }

      console.log(`  Progress: ${synced + skipped + failed}/${cards.length} (${synced} synced, ${skipped} skipped, ${failed} failed)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Synced: ${synced.toLocaleString()}`);
    console.log(`⏭️  Skipped: ${skipped.toLocaleString()}`);
    console.log(`❌ Failed: ${failed.toLocaleString()}`);
    console.log(`📈 Total: ${cards.length.toLocaleString()}`);
    console.log('='.repeat(60));
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 COURTYARD.IO POLYGON DATA SYNC');
  console.log('📦 Source: Courtyard Polygon Harvest (~288K NFTs)');
  console.log('🎯 Target: PostgreSQL via Prisma (UnifiedMarketListing)\n');

  // Check for harvest files (prefer final harvest, fall back to checkpoint)
  const harvestPath = 'data/courtyard/polygon-harvest.json';
  const checkpointPath = 'data/courtyard/polygon-checkpoint.json';

  let nfts: CourtyardNFT[] = [];
  let source = '';

  if (existsSync(harvestPath)) {
    console.log('📂 Loading final harvest data...');
    const harvestData: CourtyardHarvest = JSON.parse(readFileSync(harvestPath, 'utf8'));
    nfts = harvestData.nfts;
    source = `Final harvest (${harvestData.metadata.harvestedAt})`;
  } else if (existsSync(checkpointPath)) {
    console.log('📂 Loading checkpoint data (harvest still in progress)...');
    const checkpointData: CourtyardCheckpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    nfts = checkpointData.nfts;
    source = `Checkpoint (${checkpointData.timestamp}, page ${checkpointData.pageCount})`;
  } else {
    console.error(`❌ No harvest data found!`);
    console.error(`   Expected: ${harvestPath} or ${checkpointPath}`);
    console.error('   Run the harvest first: pnpm tsx scripts/harvest-courtyard-polygon.ts');
    process.exit(1);
  }

  if (nfts.length === 0) {
    console.error(`❌ No NFTs found in harvest data!`);
    console.error('   The harvest may have just started. Wait for it to collect some data.');
    process.exit(1);
  }

  console.log(`✓ Loaded ${nfts.length.toLocaleString()} NFTs from ${source}`);

  // Parse NFTs
  console.log('\n🔍 Parsing NFT metadata...');
  const parser = new CourtyardParser();
  const parsedCards = parser.parseAll(nfts);

  console.log(`✓ Parsed ${parsedCards.length.toLocaleString()} Pokemon cards (filtered out non-Pokemon and sealed packs)`);

  // Show sample
  if (parsedCards.length > 0) {
    const sample = parsedCards[0];
    console.log('\n📋 Sample parsed card:');
    console.log(`  Pokemon: ${sample.pokemonName}`);
    console.log(`  Set: ${sample.setName} (${sample.year || 'N/A'})`);
    console.log(`  Number: #${sample.cardNumber}`);
    console.log(`  Grade: ${sample.grader} ${sample.grade}`);
    console.log(`  Token ID: ${sample.tokenId.substring(0, 20)}...`);
    console.log(`  URL: ${sample.externalUrl?.substring(0, 50) || 'N/A'}...`);
  }

  // Sync to database
  const prisma = new PrismaClient();

  try {
    const sync = new CourtyardDBSync(prisma);
    await sync.syncAll(parsedCards);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
