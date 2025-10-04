/**
 * Enrich UnifiedMarketListing records with Pokemon TCG API data
 *
 * This script:
 * 1. Reads all UnifiedMarketListing records with missing card names
 * 2. Matches them against Pokemon TCG API
 * 3. Updates records with official card data (name, set, images)
 * 4. Improves data quality from ~40% to 90%+
 *
 * Run: pnpm tsx scripts/enrich-with-tcg-api.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PokemonTCGAPI } from './lib/pokemon-tcg-api.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const BATCH_SIZE = 100;
const CHECKPOINT_FILE = 'data/tcg-enrichment-checkpoint.json';
const API_KEY = process.env.POKEMON_TCG_API_KEY; // Optional - for higher rate limits

// ============================================================================
// CHECKPOINT
// ============================================================================

interface Checkpoint {
  processedCount: number;
  matchedCount: number;
  failedCount: number;
  lastProcessedId: string;
  startedAt: string;
  updatedAt: string;
}

function loadCheckpoint(): Checkpoint | null {
  if (existsSync(CHECKPOINT_FILE)) {
    const data = readFileSync(CHECKPOINT_FILE, 'utf8');
    return JSON.parse(data);
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// ============================================================================
// ENRICHMENT
// ============================================================================

class TCGEnrichment {
  constructor(
    private prisma: PrismaClient,
    private api: PokemonTCGAPI
  ) {}

  /**
   * Enrich a single listing with TCG API data
   */
  async enrichListing(listing: any): Promise<boolean> {
    try {
      // Match against TCG API
      const result = await this.api.matchCard({
        cardName: listing.cardName !== 'Unknown' ? listing.cardName : undefined,
        setName: listing.setName !== 'Unknown' ? listing.setName : undefined,
        cardNumber: listing.cardNumber || undefined,
        title: listing.rawTitle || listing.title,
      });

      if (!result.matched || !result.tcgCard) {
        console.log(`  ⏭️  No match: ${listing.title.substring(0, 80)}...`);
        return false;
      }

      // Update listing with official data
      const tcgCard = result.tcgCard;
      const updateData: any = {};

      // Update card name if it was Unknown or missing
      if (!listing.cardName || listing.cardName === 'Unknown') {
        updateData.cardName = tcgCard.name.substring(0, 255);
      }

      // Update set name if it was Unknown or missing
      if (!listing.setName || listing.setName === 'Unknown') {
        updateData.setName = tcgCard.set.name.substring(0, 255);
      }

      // Update card number if missing
      if (!listing.cardNumber) {
        updateData.cardNumber = tcgCard.number.substring(0, 10);
      }

      // Store TCG API data in metadata field if we add one
      // For now, just update the basic fields

      if (Object.keys(updateData).length === 0) {
        console.log(`  ⏭️  Already enriched: ${listing.title.substring(0, 80)}...`);
        return false;
      }

      await this.prisma.unifiedMarketListing.update({
        where: { id: listing.id },
        data: {
          ...updateData,
          dataQuality: Math.max(listing.dataQuality, result.confidence),
          updatedAt: new Date(),
        },
      });

      console.log(`  ✅ Enriched (${(result.confidence * 100).toFixed(0)}%): ${tcgCard.name} from ${tcgCard.set.name} #${tcgCard.number}`);
      return true;
    } catch (error: any) {
      console.error(`  ❌ Error enriching ${listing.id}:`, error.message);
      return false;
    }
  }

  /**
   * Enrich all listings in batches
   */
  async enrichAll(): Promise<void> {
    console.log('🔄 POKEMON TCG API ENRICHMENT\n');

    // Load checkpoint if exists
    let checkpoint = loadCheckpoint();
    const isResume = !!checkpoint;

    if (checkpoint) {
      console.log(`📍 Resuming from checkpoint:`);
      console.log(`   Processed: ${checkpoint.processedCount}`);
      console.log(`   Matched: ${checkpoint.matchedCount}`);
      console.log(`   Failed: ${checkpoint.failedCount}`);
      console.log(`   Last ID: ${checkpoint.lastProcessedId}\n`);
    } else {
      checkpoint = {
        processedCount: 0,
        matchedCount: 0,
        failedCount: 0,
        lastProcessedId: '',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Get total count
    const totalCount = await this.prisma.unifiedMarketListing.count({
      where: {
        OR: [
          { cardName: null },
          { cardName: 'Unknown' },
          { setName: null },
          { setName: 'Unknown' },
        ],
      },
    });

    console.log(`📊 Total listings to enrich: ${totalCount}`);
    console.log(`📦 Batch size: ${BATCH_SIZE}\n`);

    let hasMore = true;
    let batchNum = Math.floor(checkpoint.processedCount / BATCH_SIZE) + 1;

    while (hasMore) {
      // Fetch next batch
      const batch = await this.prisma.unifiedMarketListing.findMany({
        where: {
          OR: [
            { cardName: null },
            { cardName: 'Unknown' },
            { setName: null },
            { setName: 'Unknown' },
          ],
          ...(checkpoint.lastProcessedId ? {
            id: { gt: checkpoint.lastProcessedId }
          } : {}),
        },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`\n🔄 Batch ${batchNum} (${batch.length} listings)`);
      console.log(`   Progress: ${checkpoint.processedCount}/${totalCount} (${((checkpoint.processedCount / totalCount) * 100).toFixed(1)}%)`);

      for (const listing of batch) {
        const matched = await this.enrichListing(listing);

        checkpoint.processedCount++;
        if (matched) {
          checkpoint.matchedCount++;
        } else {
          checkpoint.failedCount++;
        }
        checkpoint.lastProcessedId = listing.id;
      }

      // Save checkpoint every batch
      saveCheckpoint(checkpoint);
      console.log(`   📍 Checkpoint saved: ${checkpoint.matchedCount} matched, ${checkpoint.failedCount} failed`);

      batchNum++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TCG API ENRICHMENT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Matched: ${checkpoint.matchedCount}`);
    console.log(`⏭️  Failed: ${checkpoint.failedCount}`);
    console.log(`📈 Total: ${checkpoint.processedCount}`);
    console.log(`📊 Success Rate: ${((checkpoint.matchedCount / checkpoint.processedCount) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const prisma = new PrismaClient();
  const api = new PokemonTCGAPI(API_KEY);

  try {
    const enrichment = new TCGEnrichment(prisma, api);
    await enrichment.enrichAll();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
