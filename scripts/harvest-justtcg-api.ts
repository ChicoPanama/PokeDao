/**
 * Harvest Pokemon card pricing from JustTCG API
 *
 * Focus on most expensive/valuable sets first to maximize training data quality
 * with limited API requests (1,000/month free tier)
 *
 * Run: pnpm tsx scripts/harvest-justtcg-api.ts
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const JUSTTCG_API_KEY = process.env.JUSTTCG_API_KEY;
const BASE_URL = 'https://api.justtcg.com/v1';
const RATE_LIMIT_MS = 6000; // 10 req/min = 6 sec between requests
const CHECKPOINT_FILE = 'data/justtcg-api-checkpoint.json';

// High-value Pokemon sets (ordered by card value/importance)
const PRIORITY_SETS = [
  'base-set-pokemon',
  'base-set-shadowless-pokemon',
  'base-set-2-pokemon',
  'jungle-pokemon',
  'fossil-pokemon',
  'team-rocket-pokemon',
  'gym-heroes-pokemon',
  'gym-challenge-pokemon',
  'neo-genesis-pokemon',
  'neo-discovery-pokemon',
  'neo-revelation-pokemon',
  'neo-destiny-pokemon',
  'legendary-collection-pokemon',
  'expedition-pokemon',
  'aquapolis-pokemon',
  'skyridge-pokemon',
  'crown-zenith-pokemon',
  'swsh12-silver-tempest-pokemon',
  'swsh09-brilliant-stars-pokemon',
  'swsh07-evolving-skies-pokemon',
  'swsh08-fusion-strike-pokemon',
  'celebrations-pokemon',
];

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

async function harvestJustTCG() {
  const startTime = Date.now();

  console.log('🚀 JUSTTCG API HARVESTER (High-Value Sets)');
  console.log('='.repeat(60));
  console.log(`📡 API: ${BASE_URL}`);
  console.log(`🔑 API Key: ${JUSTTCG_API_KEY?.slice(0, 10)}...`);
  console.log(`🎯 Priority Sets: ${PRIORITY_SETS.length} sets`);
  console.log('='.repeat(60));
  console.log('');

  if (!JUSTTCG_API_KEY) {
    console.error('❌ JUSTTCG_API_KEY not found in .env');
    process.exit(1);
  }

  // Load checkpoint
  let checkpoint: { processedSets: string[]; totalCards: number; apiCalls: number } = {
    processedSets: [],
    totalCards: 0,
    apiCalls: 0,
  };

  if (existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log(`🔄 Resuming: ${checkpoint.processedSets.length} sets done, ${checkpoint.apiCalls} API calls used`);
    console.log('');
  }

  let totalCardsHarvested = checkpoint.totalCards;
  let totalWithPricing = 0;
  let apiCalls = checkpoint.apiCalls;

  for (const setId of PRIORITY_SETS) {
    // Skip if already processed
    if (checkpoint.processedSets.includes(setId)) {
      console.log(`⏭️  Skipping ${setId} (already processed)`);
      continue;
    }

    console.log(`📦 Processing: ${setId}`);

    try {
      const data: any = await apiRequest(`/cards?game=pokemon&set=${setId}`);
      apiCalls++;

      const cards = data.data || [];
      console.log(`  ✓ Found ${cards.length} cards`);

      let savedCount = 0;

      for (const card of cards) {
        const variants = card.variants || [];

        for (const variant of variants) {
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

          // Truncate fields for database constraints: id(191), sourceId(100), title(500), url(500)
          const sourceId = `${card.id}-${variant.id}`.substring(0, 100);
          const id = `justtcg-${sourceId}`.substring(0, 191);
          const url = `https://justtcg.com/cards/pokemon/${setId}/${card.id}`.substring(0, 500);

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
              title: `${card.name} - ${card.set_name || setId} ${variant.printing || ''} ${variant.condition || ''}`.trim().substring(0, 500),
              rawTitle: (card.name || '').substring(0, 255),
              cardName: (card.name || '').substring(0, 255),
              setName: (card.set_name || setId).substring(0, 255),
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
          totalWithPricing++;
        }
      }

      totalCardsHarvested += cards.length;

      // Update checkpoint
      checkpoint.processedSets.push(setId);
      checkpoint.totalCards = totalCardsHarvested;
      checkpoint.apiCalls = apiCalls;
      writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));

      console.log(`  ✅ Saved ${savedCount} listings (Total: ${totalWithPricing} with pricing)`);
      console.log(`  📊 API Calls Used: ${apiCalls}/1000`);
      console.log('');

      await sleep(RATE_LIMIT_MS);

    } catch (error: any) {
      console.error(`  ✗ Error processing ${setId}:`, error.message);
      await sleep(RATE_LIMIT_MS * 2);
    }

    // Stop if we're approaching limit
    if (apiCalls >= 950) {
      console.log('⚠️  Approaching API limit (950/1000), stopping to preserve quota');
      break;
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Sets Processed: ${checkpoint.processedSets.length}/${PRIORITY_SETS.length}`);
  console.log(`📊 Total Cards: ${totalCardsHarvested.toLocaleString()}`);
  console.log(`💰 Listings with Pricing: ${totalWithPricing.toLocaleString()}`);
  console.log(`📡 API Calls Used: ${apiCalls}/1000`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

harvestJustTCG().catch(console.error);
