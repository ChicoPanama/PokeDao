#!/usr/bin/env tsx
/**
 * FINAL PostgreSQL + Research JSON Extraction
 * Fix: Use quoted column names for PostgreSQL case-sensitivity
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface Mew1AExample {
  instruction: string;
  input: string;
  output: string;
  category: string;
  metadata: Record<string, any>;
}

const examples: Mew1AExample[] = [];

async function extractPostgres() {
  console.log('📊 EXTRACTING POSTGRESQL (FIXED)...\n');

  try {
    const listings: any[] = await prisma.$queryRaw`
      SELECT id, source, "cardName", "setName", condition, grade, "gradeCompany",
             "priceCents", currency, "createdAt"
      FROM "UnifiedMarketListing"
      WHERE "cardName" IS NOT NULL AND "priceCents" IS NOT NULL
      LIMIT 150000
    `;

    console.log(`   Found ${listings.length.toLocaleString()} listings`);

    for (const listing of listings) {
      const priceUSD = listing.priceCents / 100;

      examples.push({
        instruction: `What is ${listing.cardName} selling for on ${listing.source}?`,
        input: `Check ${listing.cardName} prices on ${listing.source}.`,
        output: `${listing.cardName} is listed at $${priceUSD.toFixed(2)} on ${listing.source}${listing.condition ? ` in ${listing.condition} condition` : ''}${listing.grade && listing.gradeCompany ? ` (${listing.gradeCompany} ${listing.grade})` : ''}.`,
        category: 'market_analysis',
        metadata: {
          source: 'postgres_unified_market',
          card_name: listing.cardName,
          set_name: listing.setName,
          price: priceUSD,
          platform: listing.source,
          condition: listing.condition,
          timestamp: listing.createdAt,
        },
      });
    }

    console.log(`   ✓ Extracted ${examples.length.toLocaleString()} examples\n`);
  } catch (error) {
    console.error(`   ✗ Error: ${error}\n`);
  }
}

async function extractResearch() {
  console.log('📁 EXTRACTING RESEARCH JSON...\n');

  const files = [
    'data/research/comps_ebay_db.json',
    'data/research/ebay_current_extended.json',
    'data/research/listings_ebay_db.json',
    'data/research/tcgplayer_anchors.json',
  ];

  for (const file of files) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    console.log(`   ${path.basename(file)}...`);

    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    if (!Array.isArray(data)) continue;

    for (const item of data.slice(0, 10000)) {
      const cardName = item.cardName || item.name || item.title;
      const price = item.soldPrice || item.price;

      if (!cardName || !price) continue;

      examples.push({
        instruction: `Analyze ${cardName} pricing.`,
        input: `${cardName} - $${price}`,
        output: `${cardName} is priced at $${price}. ${price > 100 ? 'Premium card.' : 'Standard pricing.'}`,
        category: 'market_analysis',
        metadata: {
          source: `research_${path.basename(file)}`,
          card_name: cardName,
          price: price,
          date: item.soldDate || item.date,
        },
      });
    }

    console.log(`   ✓ Added ${Math.min(data.length, 10000)} examples`);
  }
}

async function main() {
  await extractPostgres();
  await extractResearch();

  const outputPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-postgres-research-FINAL.jsonl');
  fs.writeFileSync(outputPath, examples.map(ex => JSON.stringify(ex)).join('\n'), 'utf-8');

  console.log(`\n✅ Saved ${examples.length.toLocaleString()} examples to:`);
  console.log(`   ${outputPath}\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
