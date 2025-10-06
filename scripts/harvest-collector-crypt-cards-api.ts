/**
 * Harvest Collector Crypt CARDS (not packs) using their API
 *
 * This gets the actual revealed graded Pokemon cards with full metadata
 *
 * Run: pnpm tsx scripts/harvest-collector-crypt-cards-api.ts
 */

import axios from 'axios';
import { writeFileSync } from 'fs';

const API_URL = 'https://api.collectorcrypt.com/marketplace';
const BATCH_SIZE = 50;
const RATE_LIMIT_MS = 1000; // 1 second between requests

interface CollectorCryptCard {
  nftAddress: string;
  itemName: string;
  listing?: {
    price: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
  };
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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function harvestCards() {
  const startTime = Date.now();
  const allCards: CollectorCryptCard[] = [];
  let page = 1;
  let hasMore = true;

  console.log('🚀 COLLECTOR CRYPT CARDS API HARVESTER');
  console.log('=' .repeat(60));
  console.log(`📡 API: ${API_URL}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log('='.repeat(60));

  while (hasMore) {
    try {
      console.log(`\n📥 Fetching page ${page}...`);

      const response = await axios.get(API_URL, {
        params: {
          page,
          step: BATCH_SIZE,
          cardType: 'Card', // Important: Only cards, not packs
          categories: 'Pokemon', // Filter to Pokemon only
          // REMOVED: orderBy: 'listedDateDesc' - this filters to only listed cards
        },
        headers: {
          'User-Agent': 'PokeDAO-Harvester/1.0.0'
        },
        timeout: 10000,
      });

      const responseData = response.data as any;
      const cards = responseData.filterNFtCard as CollectorCryptCard[];

      // Show total on first page
      if (page === 1) {
        console.log(`\n📊 API Reports:`);
        console.log(`  Total Pokemon cards: ${responseData.cardsQtyByCategory?.Pokemon || 0}`);
        console.log(`  Total all cards: ${responseData.findTotal || 0}`);
        console.log(`  Total pages: ${responseData.totalPages || 0}`);
      }

      if (!cards || cards.length === 0) {
        console.log(`  ✓ No more cards found`);
        hasMore = false;
        break;
      }

      console.log(`  ✓ Found ${cards.length} cards`);
      allCards.push(...cards);

      // Show sample from first page
      if (page === 1 && cards.length > 0) {
        const sample = cards[0];
        console.log('\n📋 Sample card:');
        console.log(`  Name: ${sample.itemName}`);
        console.log(`  Grade: ${sample.gradingCompany} ${sample.grade}`);
        console.log(`  NFT Address: ${sample.nftAddress}`);
        console.log(`  Status: ${sample.status}`);
        if (sample.listing) {
          console.log(`  Price: ${sample.listing.price} ${sample.listing.currency}`);
        }
      }

      // Check if we got fewer cards than requested (last page)
      if (cards.length < BATCH_SIZE) {
        hasMore = false;
      }

      page++;

      // Rate limiting
      if (hasMore) {
        await sleep(RATE_LIMIT_MS);
      }

    } catch (error: any) {
      console.error(`\n❌ Error fetching page ${page}:`, error.message);

      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Data:`, error.response.data);
      }

      // Retry once after longer delay
      console.log('  ⏳ Retrying after 3 seconds...');
      await sleep(3000);

      try {
        const response = await axios.get(API_URL, {
          params: {
            page,
            step: BATCH_SIZE,
            cardType: 'Card',
            categories: 'Pokemon',
          },
          timeout: 10000,
        });

        const cards = response.data as CollectorCryptCard[];
        allCards.push(...cards);

        if (cards.length < BATCH_SIZE) {
          hasMore = false;
        }

        page++;
      } catch (retryError) {
        console.error('  ❌ Retry failed, stopping harvest');
        hasMore = false;
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total Cards: ${allCards.length}`);
  console.log(`📄 Pages Fetched: ${page - 1}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('='.repeat(60));

  // Analyze grading companies
  const graders: Record<string, number> = {};
  const grades: Record<string, number> = {};
  let withListings = 0;

  for (const card of allCards) {
    if (card.gradingCompany) {
      graders[card.gradingCompany] = (graders[card.gradingCompany] || 0) + 1;
    }
    if (card.grade) {
      grades[card.grade] = (grades[card.grade] || 0) + 1;
    }
    if (card.listing) {
      withListings++;
    }
  }

  console.log('\n📊 Statistics:');
  console.log(`  Cards with active listings: ${withListings}`);
  console.log('\n  Grading Companies:');
  Object.entries(graders)
    .sort((a, b) => b[1] - a[1])
    .forEach(([grader, count]) => {
      console.log(`    ${grader}: ${count}`);
    });

  console.log('\n  Top Grades:');
  Object.entries(grades)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([grade, count]) => {
      console.log(`    ${grade}: ${count}`);
    });

  // Save to file
  const output = {
    metadata: {
      harvestedAt: new Date().toISOString(),
      duration: `${duration}s`,
      source: 'Collector Crypt API',
      totalCards: allCards.length,
      withListings,
    },
    cards: allCards,
  };

  const outputPath = 'data/collector-crypt/api-cards-harvest.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n💾 Saved to: ${outputPath}`);
  console.log(`📦 File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
}

harvestCards().catch(console.error);
