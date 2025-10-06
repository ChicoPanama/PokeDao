/**
 * Harvest Pokemon card metadata from Pokemon TCG API
 *
 * NOTE: This API provides card metadata (names, sets, images) but NO PRICING
 * It's useful for enriching existing data with standardized card information
 *
 * API: https://pokemontcg.io
 * Free tier: 1000 requests/day without key, 5000/day with key
 * Rate limit: 20 requests/minute
 *
 * Run: pnpm tsx scripts/harvest-pokemon-tcg-api.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const API_KEY = process.env.POKEMON_TCG_API_KEY;
const BASE_URL = 'https://api.pokemontcg.io/v2';
const RATE_LIMIT_MS = 3000; // 20 req/min = 3 sec between requests

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCards(page: number = 1): Promise<any> {
  const url = `${BASE_URL}/cards?page=${page}&pageSize=250`;

  await sleep(RATE_LIMIT_MS);

  const headers: any = {
    'Accept': 'application/json',
  };

  if (API_KEY) {
    headers['X-Api-Key'] = API_KEY;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Pokemon TCG API error: ${response.status}`);
  }

  return await response.json();
}

async function harvestPokemonTCG() {
  console.log('🎴 POKEMON TCG API METADATA HARVESTER');
  console.log('='.repeat(60));
  console.log('⚠️  NOTE: This API provides metadata only, NO PRICING');
  console.log('📡 API: https://pokemontcg.io');
  console.log('='.repeat(60));
  console.log('');

  let page = 1;
  let totalCards = 0;

  while (page <= 5) { // Limit to 5 pages for now (1,250 cards)
    console.log(`📥 Fetching page ${page}...`);

    try {
      const data = await fetchCards(page);
      const cards = data.data || [];

      if (cards.length === 0) {
        console.log('  ✓ No more cards');
        break;
      }

      console.log(`  ✓ Found ${cards.length} cards (metadata only, no pricing)`);
      totalCards += cards.length;

      console.log(`  📊 Total cards fetched: ${totalCards}`);
      console.log('');

      page++;

    } catch (error: any) {
      console.error(`  ✗ Error: ${error.message}`);
      break;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ METADATA HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total Cards: ${totalCards}`);
  console.log('⚠️  No pricing data available from this API');
  console.log('💡 Use TCGPlayer API for pricing data');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

harvestPokemonTCG().catch(console.error);
