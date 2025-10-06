/**
 * Harvest Pokemon TCG card data from TCGdex API
 *
 * TCGdex: https://api.tcgdex.net
 * - 130,000+ Pokemon TCG cards across all languages
 * - Free API with no key required
 * - Comprehensive card metadata (names, sets, numbers, rarities)
 * - NOTE: NO PRICING DATA - metadata only
 *
 * Useful for: Card catalog, standardized naming, set information
 *
 * Run: pnpm tsx scripts/harvest-tcgdex-api.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const prisma = new PrismaClient();

const BASE_URL = 'https://api.tcgdex.net/v2/en';
const RATE_LIMIT_MS = 100; // Be respectful to free API
const CHECKPOINT_FILE = 'data/tcgdex-checkpoint.json';

interface Checkpoint {
  lastSet: string;
  totalCards: number;
  processedSets: number;
  startedAt: string;
  updatedAt: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCheckpoint(): Checkpoint | null {
  if (existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint) {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

async function fetchSets(): Promise<any[]> {
  await sleep(RATE_LIMIT_MS);

  const response = await fetch(`${BASE_URL}/sets`);

  if (!response.ok) {
    throw new Error(`TCGdex API error: ${response.status}`);
  }

  return await response.json();
}

async function fetchSetCards(setId: string): Promise<any[]> {
  await sleep(RATE_LIMIT_MS);

  const response = await fetch(`${BASE_URL}/sets/${setId}`);

  if (!response.ok) {
    throw new Error(`TCGdex API error: ${response.status}`);
  }

  const data: any = await response.json();
  return data.cards || [];
}

async function harvestTCGdex() {
  const startTime = Date.now();

  console.log('📚 TCGDEX POKEMON CARD DATABASE HARVESTER');
  console.log('='.repeat(60));
  console.log(`📡 API: ${BASE_URL}`);
  console.log('🆓 Free API - No key required');
  console.log('⚠️  Metadata only (NO pricing data)');
  console.log('='.repeat(60));
  console.log('');

  let checkpoint = loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      lastSet: '',
      totalCards: 0,
      processedSets: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`📍 Checkpoint: ${checkpoint.processedSets} sets, ${checkpoint.totalCards} cards`);
  console.log('');

  // Fetch all sets
  console.log('📥 Fetching all Pokemon TCG sets...');
  const sets = await fetchSets();
  console.log(`  ✓ Found ${sets.length} sets`);
  console.log('');

  const setsToProcess = checkpoint.lastSet
    ? sets.filter(s => s.id > checkpoint!.lastSet)
    : sets;

  console.log(`📦 Processing ${setsToProcess.length} sets...`);
  console.log('');

  for (const set of setsToProcess) {
    console.log(`🎴 Set: ${set.name} (${set.id}) - ${set.cardCount?.total || '?'} cards`);

    try {
      const cards = await fetchSetCards(set.id);
      console.log(`  ✓ Fetched ${cards.length} cards`);

      let savedCount = 0;

      for (const card of cards) {
        try {
          // TCGdex provides metadata only - useful for standardization
          // We'll save it without pricing for now, can be used to enrich existing data later

          const cardName = card.name || 'Unknown';
          const cardNumber = card.localId || card.id || '';
          const rarity = card.rarity || null;
          const illustrator = card.illustrator || null;

          // Skip for now - this is metadata only, not useful for pricing training
          // But log it so we know what we're getting
          savedCount++;

        } catch (error: any) {
          console.error(`    ✗ Error processing card ${card.id}: ${error.message}`);
        }
      }

      console.log(`  📊 ${savedCount} cards available (metadata only)`);
      console.log('');

      checkpoint!.lastSet = set.id;
      checkpoint!.processedSets++;
      checkpoint!.totalCards += savedCount;
      saveCheckpoint(checkpoint!);

      // Limit to first 10 sets for demo
      if (checkpoint!.processedSets >= 10) {
        console.log('⏸️  Stopping after 10 sets (demo mode)');
        break;
      }

    } catch (error: any) {
      console.error(`  ✗ Error fetching set ${set.id}: ${error.message}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ TCGDEX HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📦 Sets Processed: ${checkpoint!.processedSets}`);
  console.log(`📊 Total Cards: ${checkpoint!.totalCards}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('');
  console.log('⚠️  NOTE: TCGdex provides metadata only (names, sets, rarities)');
  console.log('💡 For pricing data, use eBay, TCGPlayer, or marketplace APIs');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

harvestTCGdex().catch(console.error);
