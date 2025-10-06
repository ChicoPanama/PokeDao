/**
 * Harvest Pokemon card pricing from PokePrice Tracker API
 *
 * API: https://www.pokemonpricetracker.com/api-docs
 * Features: 23,000+ cards with TCGPlayer, eBay, CardMarket pricing
 * Rate Limit: 20,000 calls/day, 60 requests/minute
 *
 * Run: pnpm tsx scripts/harvest-pokeprice-tracker.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const prisma = new PrismaClient();

const API_KEY = process.env.POKEPRICE_TRACKER_API_KEY;
const BASE_URL = 'https://api.pokemonpricetracker.com/v1';
const RATE_LIMIT_MS = 1000; // 60 req/min = 1 req/sec
const CHECKPOINT_FILE = 'data/pokeprice-checkpoint.json';

interface Checkpoint {
  lastPage: number;
  totalCards: number;
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

async function fetchCards(page: number = 1): Promise<any> {
  const url = `${BASE_URL}/cards?page=${page}&per_page=100`;

  await sleep(RATE_LIMIT_MS);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PokePrice API error: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function harvestPokePrice() {
  const startTime = Date.now();

  console.log('💰 POKEPRICE TRACKER HARVESTER');
  console.log('='.repeat(60));
  console.log(`📡 API: ${BASE_URL}`);
  console.log(`🔑 API Key: ${API_KEY?.slice(0, 20)}...`);
  console.log('='.repeat(60));
  console.log('');

  if (!API_KEY) {
    console.error('❌ POKEPRICE_TRACKER_API_KEY not found in .env');
    process.exit(1);
  }

  let checkpoint = loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      lastPage: 0,
      totalCards: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`📍 Checkpoint: Page ${checkpoint.lastPage}, ${checkpoint.totalCards} cards saved`);
  console.log('');

  let page = checkpoint.lastPage + 1;
  let savedCount = 0;

  while (true) {
    console.log(`📥 Fetching page ${page}...`);

    try {
      const data = await fetchCards(page);
      const cards = data.data || data.cards || [];

      if (cards.length === 0) {
        console.log('  ✓ No more cards found');
        break;
      }

      console.log(`  ✓ Found ${cards.length} cards`);

      for (const card of cards) {
        try {
          // Extract pricing from various sources
          const tcgPrice = card.prices?.tcgplayer?.market || card.tcgplayer_price;
          const ebayPrice = card.prices?.ebay?.avg || card.ebay_price;
          const cardmarketPrice = card.prices?.cardmarket?.avg || card.cardmarket_price;

          // Use TCGPlayer as primary, fall back to others
          let priceCents = 0;
          if (tcgPrice) priceCents = Math.round(tcgPrice * 100);
          else if (ebayPrice) priceCents = Math.round(ebayPrice * 100);
          else if (cardmarketPrice) priceCents = Math.round(cardmarketPrice * 100);

          if (priceCents === 0) continue; // Skip cards without pricing

          // Extract card metadata
          const cardName = card.name || 'Unknown';
          const setName = card.set?.name || card.set_name || 'Unknown';
          const cardNumber = card.number || card.card_number || null;
          const rarity = card.rarity || null;

          // Save to database
          await prisma.unifiedMarketListing.upsert({
            where: {
              source_sourceId: {
                source: 'POKEPRICE_TRACKER',
                sourceId: card.id || card.card_id || `${setName}-${cardNumber}`.substring(0, 100),
              },
            },
            create: {
              id: `pokeprice-${card.id || `${setName}-${cardNumber}`}`.substring(0, 191),
              source: 'POKEPRICE_TRACKER',
              sourceId: (card.id || card.card_id || `${setName}-${cardNumber}`).substring(0, 100),
              title: `${cardName} ${setName} #${cardNumber || ''}`.substring(0, 500),
              rawTitle: cardName.substring(0, 255),
              cardName: cardName.substring(0, 255),
              setName: setName.substring(0, 255),
              cardNumber: cardNumber ? cardNumber.substring(0, 10) : null,
              variant: rarity ? rarity.substring(0, 100) : null,
              gradeCompany: null,
              grade: null,
              condition: null,
              priceCents,
              currency: 'USD',
              url: card.url || `https://www.pokemonpricetracker.com/card/${card.id}`,
              dataQuality: 0.95, // High quality aggregated data
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            update: {
              priceCents,
              cardName: cardName.substring(0, 255),
              setName: setName.substring(0, 255),
              dataQuality: 0.95,
              updatedAt: new Date(),
            },
          });

          savedCount++;

        } catch (error: any) {
          console.error(`  ✗ Error processing card: ${error.message}`);
        }
      }

      console.log(`  💾 Saved ${savedCount} cards from this page`);
      console.log('');

      checkpoint.lastPage = page;
      checkpoint.totalCards += savedCount;
      saveCheckpoint(checkpoint);

      page++;
      savedCount = 0;

    } catch (error: any) {
      console.error(`  ✗ Error fetching page ${page}: ${error.message}`);
      break;
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Pages Processed: ${page - 1}`);
  console.log(`💰 Total Cards Saved: ${checkpoint.totalCards}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

harvestPokePrice().catch(console.error);
