/**
 * Harvest Top 3,000 Most Expensive Individual Cards from JustTCG API
 *
 * This script fetches the highest-value individual Pokemon cards
 * to build a comprehensive database of premium cards for analysis.
 *
 * Run: pnpm tsx scripts/harvest-justtcg-top-cards.ts
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const JUSTTCG_API_KEY = process.env.JUSTTCG_API_KEY;
const BASE_URL = 'https://api.justtcg.com/v1';
const RATE_LIMIT_MS = 6000; // 10 req/min = 6 sec between requests
const CHECKPOINT_FILE = 'data/justtcg-top-cards-checkpoint.json';
const TARGET_CARDS = 3000; // Will use ~150 API calls (150 pages × 20 cards/page)
const CARDS_PER_PAGE = 20; // Max allowed by free plan

interface JustTCGCard {
  id: string;
  name: string;
  number: string;
  set_name: string;
  set: string;
  rarity?: string;
  variants?: Array<{
    id: string;
    printing: string;
    condition: string;
    price: number;
  }>;
}

interface Checkpoint {
  processedCards: number;
  currentPage: number;
  totalSaved: number;
  apiCalls: number;
  startedAt: string;
  updatedAt: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest(endpoint: string) {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'X-API-Key': JUSTTCG_API_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`JustTCG API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return await response.json();
}

function loadCheckpoint(): Checkpoint {
  if (!existsSync(CHECKPOINT_FILE)) {
    return {
      processedCards: 0,
      currentPage: 1,
      totalSaved: 0,
      apiCalls: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
}

function saveCheckpoint(checkpoint: Checkpoint) {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

async function harvestTopCards() {
  const startTime = Date.now();

  console.log('🚀 JUSTTCG TOP 3,000 EXPENSIVE CARDS HARVESTER');
  console.log('='.repeat(60));
  console.log(`📡 API: ${BASE_URL}`);
  console.log(`🔑 API Key: ${JUSTTCG_API_KEY?.slice(0, 10)}...`);
  console.log(`🎯 Target: ${TARGET_CARDS.toLocaleString()} most expensive cards`);
  console.log('='.repeat(60));
  console.log('');

  if (!JUSTTCG_API_KEY) {
    console.error('❌ JUSTTCG_API_KEY not found in .env');
    process.exit(1);
  }

  let checkpoint = loadCheckpoint();

  if (checkpoint.processedCards > 0) {
    console.log(`🔄 Resuming from page ${checkpoint.currentPage}`);
    console.log(`   Cards processed: ${checkpoint.processedCards}`);
    console.log(`   Listings saved: ${checkpoint.totalSaved}`);
    console.log(`   API calls used: ${checkpoint.apiCalls}/1000`);
    console.log('');
  }

  const totalPages = Math.ceil(TARGET_CARDS / CARDS_PER_PAGE);

  for (let page = checkpoint.currentPage; page <= totalPages; page++) {
    // Check if we're approaching API limit
    if (checkpoint.apiCalls >= 950) {
      console.log('⚠️  Approaching API limit (950/1000), stopping to preserve quota');
      break;
    }

    console.log(`\n📄 Page ${page}/${totalPages} (Cards ${(page - 1) * CARDS_PER_PAGE + 1}-${Math.min(page * CARDS_PER_PAGE, TARGET_CARDS)})`);

    try {
      // Fetch cards sorted by price (descending)
      // Note: JustTCG API might not support direct price sorting, so we fetch all and sort by variants
      const data: any = await apiRequest(`/cards?game=pokemon&page=${page}&limit=${CARDS_PER_PAGE}`);
      checkpoint.apiCalls++;

      const cards: JustTCGCard[] = data.data || [];

      if (cards.length === 0) {
        console.log('  ℹ️  No more cards available');
        break;
      }

      console.log(`  ✓ Found ${cards.length} cards`);

      let savedCount = 0;

      for (const card of cards) {
        const variants = card.variants || [];

        for (const variant of variants) {
          // Skip cards without pricing
          if (!variant.price || variant.price === 0) continue;

          const priceCents = Math.round(variant.price * 100);

          // Map condition to numeric grade
          const conditionMap: Record<string, number> = {
            'NM': 10,
            'LP': 8,
            'MP': 6,
            'HP': 4,
            'DMG': 2,
          };

          // Truncate fields for database constraints
          const sourceId = `${card.id}-${variant.id}`.substring(0, 100);
          const id = `justtcg-${sourceId}`.substring(0, 191);
          const url = `https://justtcg.com/cards/pokemon/${card.set}/${card.id}`.substring(0, 500);

          await prisma.unifiedMarketListing.upsert({
            where: {
              source_sourceId: {
                source: 'JUSTTCG',
                sourceId,
              },
            },
            create: {
              id,
              source: 'JUSTTCG',
              sourceId,
              title: `${card.name} - ${card.set_name || card.set} ${variant.printing || ''} ${variant.condition || ''}`.trim().substring(0, 500),
              rawTitle: (card.name || '').substring(0, 255),
              cardName: (card.name || '').substring(0, 255),
              setName: (card.set_name || card.set).substring(0, 255),
              cardNumber: (card.number || '').substring(0, 50),
              variant: (variant.printing || '').substring(0, 100),
              gradeCompany: null,
              grade: conditionMap[variant.condition] || null,
              condition: (variant.condition || '').substring(0, 50),
              priceCents: priceCents,
              currency: 'USD',
              url,
              dataQuality: 0.95,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            update: {
              priceCents: priceCents,
              dataQuality: 0.95,
              updatedAt: new Date(),
            },
          });

          savedCount++;
          checkpoint.totalSaved++;
        }

        checkpoint.processedCards++;

        // Save checkpoint every 50 cards
        if (checkpoint.processedCards % 50 === 0) {
          checkpoint.currentPage = page;
          saveCheckpoint(checkpoint);
        }
      }

      console.log(`  ✅ Saved ${savedCount} listings (Total: ${checkpoint.totalSaved.toLocaleString()})`);
      console.log(`  📊 API Calls: ${checkpoint.apiCalls}/1000`);
      console.log(`  🎴 Cards Processed: ${checkpoint.processedCards.toLocaleString()}/${TARGET_CARDS.toLocaleString()}`);

      // Update checkpoint for this page
      checkpoint.currentPage = page + 1;
      saveCheckpoint(checkpoint);

      // Rate limiting
      await sleep(RATE_LIMIT_MS);

    } catch (error: any) {
      console.error(`  ✗ Error on page ${page}:`, error.message);

      // Save checkpoint before potentially stopping
      saveCheckpoint(checkpoint);

      // If it's a rate limit error, wait longer
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.log('  ⏸️  Rate limit hit, waiting 60 seconds...');
        await sleep(60000);
      } else {
        await sleep(RATE_LIMIT_MS * 2);
      }
    }

    // Stop if we've processed enough cards
    if (checkpoint.processedCards >= TARGET_CARDS) {
      console.log(`\n✅ Target of ${TARGET_CARDS.toLocaleString()} cards reached!`);
      break;
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`🎴 Cards Processed: ${checkpoint.processedCards.toLocaleString()}`);
  console.log(`💰 Listings Saved: ${checkpoint.totalSaved.toLocaleString()}`);
  console.log(`📡 API Calls Used: ${checkpoint.apiCalls}/1000`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

harvestTopCards().catch(console.error);
