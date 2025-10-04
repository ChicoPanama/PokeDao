/**
 * JustTCG API Harvester
 *
 * Harvests Pokemon TCG pricing data from JustTCG API
 *
 * API: https://api.justtcg.com/v1
 * Docs: https://justtcg.com/docs
 *
 * Rate Limits (from .env):
 * - JUSTTCG_RATE_LIMIT=2 (requests per second)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const JUSTTCG_API_KEY = process.env.JUSTTCG_API_KEY!;
const JUSTTCG_RATE_LIMIT = parseInt(process.env.JUSTTCG_RATE_LIMIT || '2');
const BASE_URL = 'https://api.justtcg.com/v1';
const CHECKPOINT_FILE = 'data/justtcg-api-checkpoint.json';
const DELAY_MS = 1000 / JUSTTCG_RATE_LIMIT; // Convert req/sec to ms delay

// ============================================================================
// TYPES
// ============================================================================

interface JustTCGCard {
  id: string;
  name: string;
  game: string;
  set: {
    id: string;
    name: string;
  };
  variants: Array<{
    id: string;
    condition: string;
    printing: string;
    marketPrice: number;
    lowPrice: number;
    highPrice: number;
    url?: string;
  }>;
}

interface Checkpoint {
  lastSetId: string;
  processedSets: number;
  totalCards: number;
  startedAt: string;
  updatedAt: string;
}

// ============================================================================
// JUSTTCG API CLIENT
// ============================================================================

class JustTCGAPI {
  constructor(private apiKey: string) {}

  async getSets(): Promise<any[]> {
    await this.sleep(DELAY_MS);

    const response = await fetch(`${BASE_URL}/sets?game=pokemon`, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`JustTCG API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.data || [];
  }

  async getCardsBySet(setId: string): Promise<JustTCGCard[]> {
    await this.sleep(DELAY_MS);

    const response = await fetch(`${BASE_URL}/cards?game=pokemon&set=${setId}`, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`JustTCG API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.data || [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CHECKPOINT
// ============================================================================

function loadCheckpoint(): Checkpoint | null {
  if (existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  if (!JUSTTCG_API_KEY) {
    console.error('❌ JUSTTCG_API_KEY not configured');
    process.exit(1);
  }

  console.log('🔄 JUSTTCG API HARVESTER');
  console.log('='.repeat(60));
  console.log(`🔑 API Key: ${JUSTTCG_API_KEY.substring(0, 15)}...`);
  console.log(`⏱️  Rate Limit: ${JUSTTCG_RATE_LIMIT} req/sec (${DELAY_MS}ms delay)`);
  console.log('='.repeat(60));

  const prisma = new PrismaClient();
  const api = new JustTCGAPI(JUSTTCG_API_KEY);

  let checkpoint = loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      lastSetId: '',
      processedSets: 0,
      totalCards: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`\n📍 Checkpoint: ${checkpoint.processedSets} sets, ${checkpoint.totalCards} cards\n`);

  // Get all Pokemon sets
  console.log('📦 Fetching Pokemon TCG sets...');
  const sets = await api.getSets();
  console.log(`   Found ${sets.length} sets\n`);

  // Process each set
  for (const set of sets) {
    // Skip already processed sets
    if (checkpoint.lastSetId && set.id <= checkpoint.lastSetId) {
      continue;
    }

    console.log(`\n🎴 Processing: ${set.name} (${set.id})`);

    try {
      const cards = await api.getCardsBySet(set.id);
      console.log(`   Found ${cards.length} cards`);

      let savedCount = 0;

      for (const card of cards) {
        // Process each variant (condition + printing)
        for (const variant of card.variants || []) {
          if (!variant.marketPrice || variant.marketPrice <= 0) continue;

          const priceCents = Math.round(variant.marketPrice * 100);

          // Create unique sourceId from card ID + variant ID
          const sourceId = `${card.id}_${variant.id}`;

          await prisma.unifiedMarketListing.upsert({
            where: {
              source_sourceId: {
                source: 'JUSTTCG',
                sourceId,
              },
            },
            create: {
              source: 'JUSTTCG',
              sourceId,
              title: `${card.name} - ${variant.condition} ${variant.printing}`.substring(0, 500),
              rawTitle: card.name.substring(0, 500),
              cardName: card.name.substring(0, 255),
              setName: set.name.substring(0, 255),
              condition: variant.condition.substring(0, 50),
              priceCents,
              currency: 'USD',
              url: variant.url?.substring(0, 500),
              dataQuality: 0.95, // JustTCG data is very high quality
            },
            update: {
              priceCents,
              condition: variant.condition.substring(0, 50),
              updatedAt: new Date(),
            },
          });

          savedCount++;
        }
      }

      console.log(`   ✅ Saved ${savedCount} variants`);

      checkpoint.lastSetId = set.id;
      checkpoint.processedSets++;
      checkpoint.totalCards += savedCount;
      saveCheckpoint(checkpoint);

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📦 Sets Processed: ${checkpoint.processedSets}`);
  console.log(`🎴 Cards Saved: ${checkpoint.totalCards}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
