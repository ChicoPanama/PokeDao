/**
 * Sync Collector Crypt Cards from API harvest to PostgreSQL
 *
 * This script:
 * 1. Reads the ~22,442 Pokemon cards from api-cards-harvest.json
 * 2. Parses card metadata (grader, grade, set, card number, price)
 * 3. Creates UnifiedMarketListing records in database
 * 4. Stores Solana NFT address and pricing data
 *
 * Run: pnpm tsx scripts/sync-collector-crypt-api.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface CollectorCryptCard {
  nftAddress: string;
  itemName: string;
  listing?: {
    price: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
  };
  insuredValue?: string; // USD insured value - ALL cards have this!
  suggestPrice?: string | null;
  id: string;
  category: string;
  grade?: string;
  gradingCompany?: string;
  year?: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  owner?: {
    id: string;
    wallet: string;
  };
  images?: {
    front: string;
    back?: string;
  };
}

interface CollectorCryptHarvest {
  metadata: {
    harvestedAt: string;
    duration: string;
    source: string;
    totalCards: number;
    withListings: number;
  };
  cards: CollectorCryptCard[];
}

interface ParsedCard {
  nftAddress: string;
  title: string;
  pokemonName: string;
  setName: string;
  cardNumber: string;
  grader: string;
  grade: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  year?: number;
}

// ============================================================================
// PARSER
// ============================================================================

class CollectorCryptParser {
  /**
   * Parse Pokemon card name from Collector Crypt format
   * Examples:
   *   "2025 #151 Palafin EX PSA 9 Pre EN-Prismatic Evolutions Pokemon"
   *   "2016 #122 Kadabra PSA 10 EN-Evolutions Pokemon"
   *   "2023 #193 Chien-Pao ex PSA 10 EN-Paldea Evolved Pokemon"
   */
  parseCardName(itemName: string): Partial<ParsedCard> {
    const result: Partial<ParsedCard> = {
      pokemonName: 'Unknown',
      setName: 'Unknown',
      cardNumber: '',
      year: undefined,
    };

    // Extract year if present (first 4 digits)
    const yearMatch = itemName.match(/^(\d{4})/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1]);
    }

    // Extract card number (#123 format)
    const numberMatch = itemName.match(/#(\d+)/);
    if (numberMatch) {
      result.cardNumber = numberMatch[1];
    }

    // Extract set name (after "EN-" or "Pre EN-")
    const setMatch = itemName.match(/(?:Pre )?EN-([^P]+?)(?:\s+Pokemon)?$/i);
    if (setMatch) {
      result.setName = setMatch[1].trim();
    }

    // Extract Pokemon name (between #number and grading company or "PSA"/"BGS"/etc)
    // Find position after card number
    const afterNumber = itemName.substring(itemName.indexOf(result.cardNumber) + result.cardNumber.length);
    // Pokemon name is between card number and grading info
    const pokemonMatch = afterNumber.match(/^\s+([^P]+?)\s+(?:PSA|BGS|CGC|SGC|ACE)/i);
    if (pokemonMatch) {
      result.pokemonName = pokemonMatch[1].trim();
    }

    return result;
  }

  /**
   * Parse a single card into structured data
   */
  parseCard(card: CollectorCryptCard): ParsedCard | null {
    try {
      const parsed = this.parseCardName(card.itemName);

      // Price priority:
      // 1. Active listing price (SOL/USDC)
      // 2. Insured value (USD) - fallback for all cards
      let priceCents = 0;
      let currency = 'USD';

      if (card.listing?.price) {
        // Active listing - convert SOL to USD or use USDC
        if (card.listing.currency === 'SOL') {
          // Convert SOL to USD (approximate rate: 1 SOL = $140)
          priceCents = Math.round(card.listing.price * 140 * 100);
        } else {
          priceCents = Math.round(card.listing.price * 100);
        }
        currency = card.listing.currency;
      } else if (card.insuredValue) {
        // Use insured value as fallback (already in USD)
        const insuredUSD = parseFloat(card.insuredValue);
        if (!isNaN(insuredUSD) && insuredUSD > 0) {
          priceCents = Math.round(insuredUSD * 100);
        }
      }

      return {
        nftAddress: card.nftAddress,
        title: card.itemName,
        pokemonName: parsed.pokemonName || 'Unknown',
        setName: parsed.setName || 'Unknown',
        cardNumber: parsed.cardNumber || '',
        grader: card.gradingCompany || 'Unknown',
        grade: card.grade || 'Unknown',
        priceCents,
        currency,
        imageUrl: card.images?.front,
        year: parsed.year || card.year,
      };
    } catch (error: any) {
      console.error(`Failed to parse card ${card.nftAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Parse all cards (uses listing price OR insured value)
   */
  parseAll(cards: CollectorCryptCard[]): ParsedCard[] {
    const parsed: ParsedCard[] = [];
    let skipped = 0;

    for (const card of cards) {
      const parsedCard = this.parseCard(card);

      // Only skip if card has NO pricing at all (no listing AND no insured value)
      if (parsedCard && parsedCard.priceCents > 0) {
        parsed.push(parsedCard);
      } else {
        skipped++;
      }
    }

    console.log(`\n  ✓ Parsed ${parsed.length} cards with pricing (${skipped} skipped - no listing or insured value)`);

    return parsed;
  }
}

// ============================================================================
// DATABASE SYNC
// ============================================================================

class CollectorCryptDBSync {
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
   * Generate URL for Collector Crypt card
   */
  private generateUrl(nftAddress: string): string {
    return `https://collectorcrypt.com/card/${nftAddress}`;
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
      // Check if listing already exists
      const existing = await this.prisma.unifiedMarketListing.findUnique({
        where: {
          source_sourceId: {
            source: 'COLLECTOR_CRYPT',
            sourceId: card.nftAddress,
          },
        },
      });

      const now = new Date();

      if (existing) {
        // Update existing listing (price might have changed)
        await this.prisma.unifiedMarketListing.update({
          where: { id: existing.id },
          data: {
            priceCents: card.priceCents,
            updatedAt: now,
          },
        });
        return;
      }

      // Extract card number (remove leading zeros for matching)
      let cardNumber = card.cardNumber ? parseInt(card.cardNumber, 10).toString() : '';

      // Create new unified market listing
      const id = randomBytes(12).toString('base64url');

      // Truncate fields to match database column constraints
      const title = card.title.substring(0, 500);
      const cardName = (card.pokemonName || '').substring(0, 255);
      const setName = (card.setName || '').substring(0, 255);
      const variant = (card.certNumber || '').substring(0, 100) || null;
      cardNumber = cardNumber.substring(0, 10); // VARCHAR(10)
      const url = this.generateUrl(card.nftAddress).substring(0, 500);
      const sourceId = card.nftAddress.substring(0, 100); // VARCHAR(100)

      await this.prisma.unifiedMarketListing.create({
        data: {
          id,
          source: 'COLLECTOR_CRYPT',
          sourceId,
          title,
          rawTitle: title,
          cardName,
          setName,
          cardNumber,
          variant,
          gradeCompany: this.normalizeGrader(card.grader) as any,
          grade: this.parseGradeValue(card.grade),
          priceCents: card.priceCents,
          currency: 'USD', // Convert USDC to USD for 3-char limit
          url,
          dataQuality: 0.9, // High quality - from blockchain NFT data
          createdAt: now,
          updatedAt: now,
        },
      });

      console.log(`  ✓ Synced: ${card.pokemonName} ${card.setName} #${cardNumber} ${card.grader} ${card.grade} ($${(card.priceCents / 100).toFixed(2)})`);
    } catch (error: any) {
      console.error(`  ✗ Failed to sync card ${card.nftAddress}:`, error.message);
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
    console.log(`✅ Synced: ${synced}`);
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
  console.log('🚀 COLLECTOR CRYPT API DATA SYNC');
  console.log('📦 Source: Collector Crypt API Harvest (~22,442 cards)');
  console.log('🎯 Target: PostgreSQL via Prisma (UnifiedMarketListing)\n');

  // Check if harvest file exists
  const harvestPath = 'data/collector-crypt/api-cards-harvest.json';

  if (!existsSync(harvestPath)) {
    console.error(`❌ Harvest file not found: ${harvestPath}`);
    console.error('   Run the harvest first: pnpm tsx scripts/harvest-collector-crypt-cards-api.ts');
    process.exit(1);
  }

  // Load harvest data
  console.log('📂 Loading harvest data...');
  const harvestData: CollectorCryptHarvest = JSON.parse(readFileSync(harvestPath, 'utf8'));

  if (harvestData.cards.length === 0) {
    console.error(`❌ Harvest file contains no cards!`);
    console.error('   The harvest may still be running. Wait for it to complete.');
    process.exit(1);
  }

  console.log(`✓ Loaded ${harvestData.cards.length} cards from ${harvestData.metadata.source}`);
  console.log(`  Harvested at: ${harvestData.metadata.harvestedAt}`);
  console.log(`  Cards with listings: ${harvestData.metadata.withListings}`);

  // Parse cards
  console.log('\n🔍 Parsing card metadata...');
  const parser = new CollectorCryptParser();
  const parsedCards = parser.parseAll(harvestData.cards);

  console.log(`✓ Parsed ${parsedCards.length} cards`);

  // Show sample
  if (parsedCards.length > 0) {
    const sample = parsedCards[0];
    console.log('\n📋 Sample parsed card:');
    console.log(`  Pokemon: ${sample.pokemonName}`);
    console.log(`  Set: ${sample.setName} (${sample.year || 'N/A'})`);
    console.log(`  Number: #${sample.cardNumber}`);
    console.log(`  Grade: ${sample.grader} ${sample.grade}`);
    console.log(`  Price: $${(sample.priceCents / 100).toFixed(2)} ${sample.currency}`);
    console.log(`  NFT: ${sample.nftAddress}`);
  }

  // Sync to database
  const prisma = new PrismaClient();

  try {
    const sync = new CollectorCryptDBSync(prisma);
    await sync.syncAll(parsedCards);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
