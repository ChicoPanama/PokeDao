/**
 * Harvest Courtyard.io Pokemon Cards via Algolia Search
 *
 * Courtyard uses Algolia for their marketplace search.
 * The marketplace shows 78,000+ Pokemon cards.
 *
 * Run: pnpm tsx scripts/harvest-courtyard-algolia.ts
 */

import axios from 'axios';
import { writeFileSync } from 'fs';

// ============================================================================
// TYPES
// ============================================================================

interface CourtyardCard {
  objectID: string;
  name: string;
  grade?: {
    company?: string;
    value?: number | string;
  };
  metadata: {
    Category?: string;
    Set?: string;
    'Card Number'?: string;
    Year?: string;
  };
  price?: {
    amount: number;
    currency: string;
  };
  images?: string[];
  tokenId?: string;
}

interface AlgoliaResponse {
  hits: CourtyardCard[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

// ============================================================================
// HARVESTER
// ============================================================================

const ALGOLIA_APP_ID = 'HWRWJ8DPSM'; // Found from marketplace page
const ALGOLIA_API_KEY = '6c02c0dfeafe9f0e6032a1f77b126555'; // Public search key
const INDEX_NAME = 'marketplace_prod_recently_listed';
const BASE_URL = `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/${INDEX_NAME}/query`;

const BATCH_SIZE = 1000; // Algolia max
const RATE_LIMIT_MS = 100; // Conservative delay
const POKEMON_FILTER = 'metadata.Category:Pokémon';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchAlgolia(page: number): Promise<AlgoliaResponse> {
  const response = await axios.post(
    BASE_URL,
    {
      params: `query=&hitsPerPage=${BATCH_SIZE}&page=${page}&filters=${POKEMON_FILTER}`,
    },
    {
      headers: {
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'X-Algolia-API-Key': ALGOLIA_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data;
}

async function main() {
  console.log('🚀 COURTYARD.IO ALGOLIA HARVESTER');
  console.log('============================================================');
  console.log(`📡 Algolia: ${ALGOLIA_APP_ID}`);
  console.log(`🔍 Index: ${INDEX_NAME}`);
  console.log(`🎯 Filter: ${POKEMON_FILTER}`);
  console.log('============================================================\n');

  const startTime = Date.now();
  const allCards: CourtyardCard[] = [];

  try {
    // First request to get total count
    console.log('📊 Fetching first page to determine total...');
    const firstPage = await searchAlgolia(0);

    console.log(`\n📊 Algolia Reports:`);
    console.log(`  Total Pokemon cards: ${firstPage.nbHits.toLocaleString()}`);
    console.log(`  Total pages: ${firstPage.nbPages}`);
    console.log(`  Hits per page: ${firstPage.hitsPerPage}`);
    console.log();

    // Add first page results
    allCards.push(...firstPage.hits);

    if (firstPage.hits.length > 0) {
      const sample = firstPage.hits[0];
      console.log('📋 Sample card:');
      console.log(`  Name: ${sample.name}`);
      console.log(`  Grade: ${sample.grade?.company} ${sample.grade?.value}`);
      console.log(`  Set: ${sample.metadata.Set}`);
      console.log(`  Card#: ${sample.metadata['Card Number']}`);
      if (sample.price) {
        console.log(`  Price: $${sample.price.amount} ${sample.price.currency}`);
      }
      console.log();
    }

    // Harvest remaining pages
    for (let page = 1; page < firstPage.nbPages; page++) {
      console.log(`📥 Fetching page ${page + 1}/${firstPage.nbPages}...`);

      try {
        const pageData = await searchAlgolia(page);
        allCards.push(...pageData.hits);

        if ((page + 1) % 10 === 0) {
          console.log(`  Progress: ${allCards.length.toLocaleString()}/${firstPage.nbHits.toLocaleString()} cards`);
        }

        // Rate limiting
        await sleep(RATE_LIMIT_MS);

      } catch (error: any) {
        console.error(`  ✗ Error on page ${page}:`, error.message);

        // Retry once
        console.log('  ⏳ Retrying after 3 seconds...');
        await sleep(3000);

        try {
          const pageData = await searchAlgolia(page);
          allCards.push(...pageData.hits);
        } catch (retryError) {
          console.error('  ✗ Retry failed, continuing...');
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('✅ HARVEST COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Total Cards: ${allCards.length.toLocaleString()}`);
    console.log(`📄 Pages Fetched: ${firstPage.nbPages}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('='.repeat(60));

    // Analyze grading companies
    const graders: Record<string, number> = {};
    const grades: Record<string, number> = {};
    let withPrices = 0;

    for (const card of allCards) {
      if (card.grade?.company) {
        graders[card.grade.company] = (graders[card.grade.company] || 0) + 1;
      }
      if (card.grade?.value) {
        const gradeStr = String(card.grade.value);
        grades[gradeStr] = (grades[gradeStr] || 0) + 1;
      }
      if (card.price) {
        withPrices++;
      }
    }

    console.log('\n📊 Statistics:');
    console.log(`  Cards with prices: ${withPrices.toLocaleString()}`);

    console.log('\n  Grading Companies:');
    Object.entries(graders)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([grader, count]) => {
        console.log(`    ${grader}: ${count.toLocaleString()}`);
      });

    console.log('\n  Top Grades:');
    Object.entries(grades)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([grade, count]) => {
        console.log(`    ${grade}: ${count.toLocaleString()}`);
      });

    // Save to file
    const output = {
      metadata: {
        harvestedAt: new Date().toISOString(),
        duration: `${duration}s`,
        source: 'Courtyard.io (Algolia)',
        totalCards: allCards.length,
        withPrices,
      },
      cards: allCards,
    };

    const outputPath = 'data/courtyard/algolia-harvest.json';
    writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`\n💾 Saved to: ${outputPath}`);
    console.log(`📦 File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
