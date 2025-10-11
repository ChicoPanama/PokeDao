/**
 * eBay Browse API Harvester - OAuth Based
 *
 * Uses OAuth access tokens to fetch Pokemon TCG data from eBay's Browse API.
 * This is the modern replacement for the deprecated Finding API.
 *
 * Run: pnpm tsx scripts/harvest-ebay-browse-oauth.ts
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';

const EBAY_ACCESS_TOKEN = process.env.EBAY_ACCESS_TOKEN;
const BASE_URL = 'https://api.ebay.com/buy/browse/v1';
const CATEGORY_ID = '183454'; // Pokemon TCG Singles

interface EbayItem {
  itemId: string;
  title: string;
  price?: {
    value: string;
    currency: string;
  };
  image?: {
    imageUrl: string;
  };
  itemWebUrl?: string;
  condition?: string;
  seller?: {
    username: string;
    feedbackPercentage: string;
  };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchItems(query: string, limit: number = 50, offset: number = 0): Promise<EbayItem[]> {
  const params = new URLSearchParams({
    q: query,
    category_ids: CATEGORY_ID,
    limit: limit.toString(),
    offset: offset.toString(),
    filter: 'conditionIds:{1000|1500|2000|2500|3000}', // New to Acceptable
  });

  const url = `${BASE_URL}/item_summary/search?${params}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${EBAY_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay Browse API error: ${response.status} - ${text}`);
  }

  const data: any = await response.json();
  return data.itemSummaries || [];
}

async function harvestEbayBrowse() {
  console.log('🚀 EBAY BROWSE API HARVESTER (OAuth)');
  console.log('='.repeat(60));
  console.log(`📡 API: ${BASE_URL}`);
  console.log(`🔑 OAuth Token: ${EBAY_ACCESS_TOKEN?.slice(0, 20)}...`);
  console.log(`🎯 Category: Pokemon TCG (${CATEGORY_ID})`);
  console.log('='.repeat(60));
  console.log('');

  if (!EBAY_ACCESS_TOKEN) {
    console.error('❌ EBAY_ACCESS_TOKEN not found in .env');
    process.exit(1);
  }

  // Test queries for popular Pokemon cards
  const queries = [
    'pokemon charizard',
    'pokemon pikachu vmax',
    'pokemon base set',
    'pokemon booster box',
    'pokemon shadowless',
    'pokemon 1st edition',
    'pokemon psa 10',
    'pokemon graded',
    'pokemon umbreon',
    'pokemon lugia',
  ];

  let totalSaved = 0;
  let totalProcessed = 0;

  for (const query of queries) {
    console.log(`\n🔍 Searching: "${query}"`);

    try {
      // Fetch up to 200 items (4 pages of 50)
      for (let page = 0; page < 4; page++) {
        const offset = page * 50;
        const items = await searchItems(query, 50, offset);

        if (items.length === 0) {
          console.log(`  ℹ️  No more items found at page ${page + 1}`);
          break;
        }

        console.log(`  📄 Page ${page + 1}: Found ${items.length} items`);

        let savedCount = 0;

        for (const item of items) {
          totalProcessed++;

          // Skip items without price
          if (!item.price) continue;

          const priceCents = Math.round(parseFloat(item.price.value) * 100);

          // Create unique ID
          const sourceId = item.itemId;
          const id = `ebay-browse-${sourceId}`.substring(0, 191);

          try {
            await prisma.unifiedMarketListing.upsert({
              where: {
                source_sourceId: {
                  source: 'EBAY',
                  sourceId,
                },
              },
              create: {
                id,
                source: 'EBAY',
                sourceId,
                title: item.title.substring(0, 500),
                rawTitle: item.title.substring(0, 255),
                cardName: extractCardName(item.title).substring(0, 255),
                setName: extractSetName(item.title)?.substring(0, 255),
                cardNumber: null,
                variant: null,
                gradeCompany: extractGradeCompany(item.title),
                grade: extractGrade(item.title),
                condition: item.condition?.substring(0, 50),
                priceCents,
                currency: item.price.currency || 'USD',
                url: item.itemWebUrl?.substring(0, 500),
                dataQuality: 0.85,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              update: {
                priceCents,
                condition: item.condition?.substring(0, 50),
                dataQuality: 0.85,
                updatedAt: new Date(),
              },
            });

            savedCount++;
            totalSaved++;
          } catch (error: any) {
            // Skip duplicates or errors
            continue;
          }
        }

        console.log(`  ✅ Saved ${savedCount}/${items.length} listings`);

        // Rate limiting - eBay allows 5,000 calls/day
        await sleep(1000);

        // Stop if we got less than 50 items (last page)
        if (items.length < 50) break;
      }

      console.log(`  📊 Total for "${query}": ${totalSaved} saved so far`);

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      await sleep(2000);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total Items Processed: ${totalProcessed.toLocaleString()}`);
  console.log(`💾 Total Listings Saved: ${totalSaved.toLocaleString()}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

// Helper functions to extract card info from title
function extractCardName(title: string): string {
  // Remove common keywords
  const cleaned = title
    .replace(/\b(Pokemon|TCG|Card|Holo|Reverse|PSA|BGS|CGC|Graded|1st Edition|Shadowless)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Take first 3-4 words as card name
  const words = cleaned.split(' ').filter(w => w.length > 2);
  return words.slice(0, 3).join(' ') || 'Unknown';
}

function extractSetName(title: string): string | null {
  const sets = [
    'Base Set', 'Jungle', 'Fossil', 'Team Rocket',
    'Gym Heroes', 'Gym Challenge',
    'Neo Genesis', 'Neo Discovery', 'Neo Revelation', 'Neo Destiny',
    'Legendary Collection', 'Expedition', 'Aquapolis', 'Skyridge',
    'Evolving Skies', 'Brilliant Stars', 'Fusion Strike',
    'Celebrations', 'Scarlet', 'Violet', 'Crown Zenith',
  ];

  for (const set of sets) {
    if (title.toLowerCase().includes(set.toLowerCase())) {
      return set;
    }
  }

  return null;
}

function extractGradeCompany(title: string): string | null {
  const upperTitle = title.toUpperCase();
  if (upperTitle.includes('PSA')) return 'PSA';
  if (upperTitle.includes('BGS') || upperTitle.includes('BECKETT')) return 'BGS';
  if (upperTitle.includes('CGC')) return 'CGC';
  return null;
}

function extractGrade(title: string): number | null {
  const gradeCompany = extractGradeCompany(title);
  if (!gradeCompany) return null;

  // Look for grade number after company name
  const regex = new RegExp(`${gradeCompany}\\s*(\\d+(?:\\.\\d+)?)`, 'i');
  const match = title.match(regex);

  if (match) {
    return parseFloat(match[1]);
  }

  // Try to find standalone grade (PSA 10, etc)
  const standaloneMatch = title.match(/\b(10|9\.5|9|8\.5|8|7\.5|7)\b/);
  if (standaloneMatch) {
    return parseFloat(standaloneMatch[1]);
  }

  return null;
}

harvestEbayBrowse().catch(console.error);
