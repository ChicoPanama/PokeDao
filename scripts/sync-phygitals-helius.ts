/**
 * Sync Phygitals NFT data from Helius harvest to PostgreSQL
 *
 * This script:
 * 1. Reads the 20,487 NFTs from helius-complete-harvest.json
 * 2. Parses NFT metadata (grader, grade, cert, pokemon name, set)
 * 3. Creates Card and SourceCatalogItem records in database
 * 4. Stores Solana metadata (mint address, owner) in raw field
 *
 * Run: pnpm tsx scripts/sync-phygitals-helius.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { createHash, randomBytes } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface HeliusNFT {
  mint: string;
  name: string;
  uri: string;
  owner: string;
  creators: any[];
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  metadata: any;
}

interface HeliusHarvest {
  metadata: {
    harvestedAt: string;
    totalNFTs: number;
    source: string;
  };
  nfts: HeliusNFT[];
}

interface ParsedCard {
  mint: string;
  pokemonName: string;
  setName: string;
  setId: string;
  cardNumber: string;
  year: string;
  language: string;
  grader: string;
  grade: string;
  certNumber: string;
  rarity?: string;
  artist?: string;
  cardType?: string;
  energyType?: string;
  foilType?: string;
  imageUrl?: string;
  metadataUri: string;
  owner: string;
}

// ============================================================================
// PARSER
// ============================================================================

class PhygitalsNFTParser {
  /**
   * Extract attribute value by trait_type
   */
  private getAttribute(nft: HeliusNFT, traitType: string): string | undefined {
    const attr = nft.attributes.find(a => a.trait_type === traitType);
    return attr?.value;
  }

  /**
   * Parse grader and grade from "CGC 10" format
   */
  private parseGrade(gradeStr: string): { grader: string; grade: string } {
    const match = gradeStr.match(/^(\w+)\s+(.+)$/);
    if (match) {
      return {
        grader: match[1], // e.g., "CGC"
        grade: match[2],  // e.g., "10"
      };
    }
    return {
      grader: gradeStr,
      grade: 'Unknown',
    };
  }

  /**
   * Parse a single NFT into structured card data
   */
  parseNFT(nft: HeliusNFT): ParsedCard | null {
    try {
      const gradeAttr = this.getAttribute(nft, 'Grade');
      const { grader, grade } = gradeAttr ? this.parseGrade(gradeAttr) : { grader: 'Unknown', grade: 'Unknown' };

      // Get image URL from metadata
      const imageUrl = nft.metadata?.content?.links?.image ||
                      nft.metadata?.content?.files?.[0]?.uri;

      const parsed: ParsedCard = {
        mint: nft.mint,
        pokemonName: this.getAttribute(nft, 'Name') || 'Unknown',
        setName: this.getAttribute(nft, 'Set') || 'Unknown',
        setId: this.getAttribute(nft, 'Set ID') || '',
        cardNumber: this.getAttribute(nft, 'Number') || '',
        year: this.getAttribute(nft, 'Set Release Date') || '',
        language: this.getAttribute(nft, 'Language') || 'English',
        grader,
        grade,
        certNumber: this.getAttribute(nft, 'Cert Number') || '',
        rarity: this.getAttribute(nft, 'Rarity'),
        artist: this.getAttribute(nft, 'Artist'),
        cardType: this.getAttribute(nft, 'Card Type'),
        energyType: this.getAttribute(nft, 'Energy Type'),
        foilType: this.getAttribute(nft, 'Foil Type'),
        imageUrl,
        metadataUri: nft.uri,
        owner: nft.owner,
      };

      return parsed;
    } catch (error: any) {
      console.error(`Failed to parse NFT ${nft.mint}:`, error.message);
      return null;
    }
  }

  /**
   * Parse all NFTs in harvest
   */
  parseAll(nfts: HeliusNFT[]): ParsedCard[] {
    const parsed: ParsedCard[] = [];

    for (const nft of nfts) {
      const card = this.parseNFT(nft);
      if (card) {
        parsed.push(card);
      }
    }

    return parsed;
  }
}

// ============================================================================
// DATABASE SYNC
// ============================================================================

class PhygitalsDBSync {
  constructor(private prisma: PrismaClient) {}

  /**
   * Normalize grader company to enum value
   */
  private normalizeGrader(grader: string): string {
    const upperGrader = grader.toUpperCase();
    const graderMap: Record<string, string> = {
      'PSA': 'PSA',
      'BGS': 'BGS',
      'CGC': 'CGC',
      'SGC': 'SGC',
      'ACE': 'ACE',
    };
    return graderMap[upperGrader] || 'OTHER';
  }

  /**
   * Generate URL for Phygitals NFT
   */
  private generateUrl(mint: string): string {
    return `https://phygitals.com/nft/${mint}`;
  }

  /**
   * Parse grade value from string (e.g., "MINT 9" -> 9.0, "10" -> 10.0)
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
      const gradeCompany = this.normalizeGrader(card.grader);
      const gradeValue = this.parseGradeValue(card.grade);
      const title = `${card.pokemonName} ${card.setName} #${card.cardNumber} ${card.grader} ${card.grade}`;

      // Check if listing already exists
      const existing = await this.prisma.unifiedMarketListing.findUnique({
        where: {
          source_sourceId: {
            source: 'PHYGITALS',
            sourceId: card.mint.substring(0, 100), // VARCHAR(100) limit
          },
        },
      });

      if (existing) {
        // Update existing listing
        await this.prisma.unifiedMarketListing.update({
          where: { id: existing.id },
          data: {
            updatedAt: new Date(),
          },
        });
        return;
      }

      // Create new unified market listing - truncate all fields
      const id = randomBytes(12).toString('base64url');
      const now = new Date();

      // Remove leading zeros from card number
      let cardNumber = card.cardNumber || '';
      if (cardNumber) {
        cardNumber = parseInt(cardNumber, 10).toString();
      }
      cardNumber = cardNumber.substring(0, 10); // VARCHAR(10)

      await this.prisma.unifiedMarketListing.create({
        data: {
          id,
          source: 'PHYGITALS',
          sourceId: card.mint.substring(0, 100), // VARCHAR(100)
          title: title.substring(0, 500), // VARCHAR(500)
          rawTitle: title.substring(0, 500),
          cardName: card.pokemonName.substring(0, 255), // VARCHAR(255)
          setName: card.setName.substring(0, 255), // VARCHAR(255)
          cardNumber,
          variant: card.certNumber ? card.certNumber.substring(0, 100) : null, // VARCHAR(100)
          gradeCompany: gradeCompany as any,
          grade: gradeValue,
          priceCents: 0, // No pricing data from blockchain harvest
          currency: 'USD',
          url: this.generateUrl(card.mint).substring(0, 500), // VARCHAR(500)
          dataQuality: 0.8, // High quality - from blockchain
          createdAt: now,
          updatedAt: now,
        },
      });

      console.log(`  ✓ Synced: ${card.pokemonName} ${card.setName} #${cardNumber} ${card.grader} ${card.grade}`);
    } catch (error: any) {
      console.error(`  ✗ Failed to sync card ${card.certNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync all cards in batches
   */
  async syncAll(cards: ParsedCard[], batchSize = 100): Promise<void> {
    console.log(`\n🔄 Starting database sync of ${cards.length} cards...`);

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      console.log(`\nBatch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cards.length / batchSize)}`);

      for (const card of batch) {
        try {
          await this.syncCard(card);
          synced++;
        } catch (error) {
          failed++;
        }
      }

      console.log(`  Progress: ${synced + failed}/${cards.length} (${synced} synced, ${failed} failed)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Synced: ${synced}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total: ${cards.length}`);
    console.log('='.repeat(60));
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 PHYGITALS HELIUS DATA SYNC');
  console.log('📦 Source: Helius Blockchain Harvest (20,487 NFTs)');
  console.log('🎯 Target: PostgreSQL via Prisma\n');

  // Load harvest data
  console.log('📂 Loading harvest data...');
  const harvestPath = 'data/phygitals/helius-complete-harvest.json';
  const harvestData: HeliusHarvest = JSON.parse(readFileSync(harvestPath, 'utf8'));

  console.log(`✓ Loaded ${harvestData.nfts.length} NFTs from ${harvestData.metadata.source}`);
  console.log(`  Harvested at: ${harvestData.metadata.harvestedAt}`);

  // Parse NFTs
  console.log('\n🔍 Parsing NFT metadata...');
  const parser = new PhygitalsNFTParser();
  const parsedCards = parser.parseAll(harvestData.nfts);

  console.log(`✓ Parsed ${parsedCards.length} cards`);

  // Show sample
  if (parsedCards.length > 0) {
    const sample = parsedCards[0];
    console.log('\n📋 Sample parsed card:');
    console.log(`  Pokemon: ${sample.pokemonName}`);
    console.log(`  Set: ${sample.setName} (${sample.setId})`);
    console.log(`  Number: ${sample.cardNumber}`);
    console.log(`  Grade: ${sample.grader} ${sample.grade}`);
    console.log(`  Cert: ${sample.certNumber}`);
    console.log(`  Mint: ${sample.mint}`);
    console.log(`  Owner: ${sample.owner.substring(0, 20)}...`);
  }

  // Sync to database
  const prisma = new PrismaClient();

  try {
    const sync = new PhygitalsDBSync(prisma);
    await sync.syncAll(parsedCards);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
