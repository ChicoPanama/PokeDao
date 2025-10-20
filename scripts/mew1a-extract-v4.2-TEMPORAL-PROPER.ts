#!/usr/bin/env tsx
/**
 * MEW-1A v4.2 - TEMPORAL-AWARE EXTRACTION
 *
 * Properly extracts eBay data with temporal awareness:
 * - Each sale is a UNIQUE data point (card + price + date)
 * - Preserves price trends over time
 * - Deduplication includes DATE in hash to avoid losing temporal data
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Mew1AExample {
  instruction: string;
  input: string;
  output: string;
  category: string;
  metadata: Record<string, any>;
}

const examples: Mew1AExample[] = [];

async function extractTemporalEbay() {
  console.log('🚀 TEMPORAL-AWARE EBAY EXTRACTION\n');
  console.log('Preserving price trends with date-aware deduplication\n');

  const dbPath = path.join(
    process.cwd(),
    'research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db'
  );

  console.log('📊 Extracting ebay_sold_listings with full temporal data...\n');

  const batchSize = 50000;
  let offset = 0;
  let totalProcessed = 0;
  const limit = 250000;

  const seenHashes = new Set<string>();
  let duplicates = 0;

  while (totalProcessed < limit) {
    console.log(`  Batch ${Math.floor(totalProcessed / batchSize) + 1}: Offset ${offset}...`);

    const query = `SELECT * FROM ebay_sold_listings LIMIT ${batchSize} OFFSET ${offset}`;
    const output = execSync(
      `sqlite3 "${dbPath}" "${query}" -json`,
      { encoding: 'utf-8', maxBuffer: 200 * 1024 * 1024 }
    );

    const rows = JSON.parse(output);
    if (rows.length === 0) break;

    console.log(`  Found ${rows.length} records`);

    for (const row of rows) {
      const cardName = row.pokemon_name || row.title || 'Unknown Card';
      const soldPrice = row.sold_price;
      const soldDate = row.sold_date;

      if (!soldPrice || !soldDate) continue;

      // TEMPORAL-AWARE DEDUPLICATION
      // Hash includes: card + price + date (to preserve different sales over time)
      const hash = `${cardName.toLowerCase()}|${soldPrice}|${soldDate}`;

      if (seenHashes.has(hash)) {
        duplicates++;
        continue;
      }
      seenHashes.add(hash);

      // Price trend example
      examples.push({
        instruction: `What did ${cardName} sell for on ${soldDate}?`,
        input: `Show me ${cardName} sale on ${soldDate}.`,
        output: `On ${soldDate}, ${cardName} sold for $${soldPrice.toFixed(2)}${row.condition_description ? ` in ${row.condition_description} condition` : ''}${row.grading_company && row.grade_number ? ` (${row.grading_company} ${row.grade_number})` : ''}.`,
        category: 'price_trends',
        metadata: {
          source: 'ebay_temporal_sales',
          card_name: cardName,
          pokemon_name: row.pokemon_name,
          sold_price: soldPrice,
          sold_date: soldDate,
          condition: row.condition_description,
          grading_company: row.grading_company,
          grade: row.grade_number,
          set_name: row.set_name,
        },
      });

      // Market analysis with temporal context
      examples.push({
        instruction: `Analyze this ${cardName} sale from ${soldDate}.`,
        input: `${cardName} sold for $${soldPrice} on ${soldDate}${row.condition_description ? ` in ${row.condition_description} condition` : ''}`,
        output: `This ${cardName} sale on ${soldDate} at $${soldPrice.toFixed(2)} represents ${soldPrice > 100 ? 'a premium' : soldPrice > 50 ? 'a moderate' : 'an affordable'} price point${row.grading_company && row.grade_number ? ` for a ${row.grading_company} ${row.grade_number} graded card` : ''}. ${row.bid_count > 5 ? `Strong demand with ${row.bid_count} bids.` : ''}`,
        category: 'market_analysis',
        metadata: {
          source: 'ebay_temporal_sales',
          card_name: cardName,
          sold_price: soldPrice,
          sold_date: soldDate,
          bid_count: row.bid_count,
        },
      });

      // Comparable sales with date
      if (row.condition_description || row.grading_company) {
        examples.push({
          instruction: `Find comparable sales for ${cardName}.`,
          input: `What are recent sales of ${cardName}?`,
          output: `${cardName} sold for $${soldPrice.toFixed(2)} on ${soldDate}${row.condition_description ? ` (${row.condition_description})` : ''}${row.grading_company && row.grade_number ? ` graded ${row.grading_company} ${row.grade_number}` : ''}. This provides a reliable price point for this specific condition.`,
          category: 'comparable_sales',
          metadata: {
            source: 'ebay_temporal_sales',
            sold_price: soldPrice,
            sold_date: soldDate,
            condition: row.condition_description,
          },
        });
      }

      // Investment trends (for high-value cards)
      if (soldPrice > 200) {
        examples.push({
          instruction: `Track ${cardName} price history.`,
          input: `What is the price trend for ${cardName}?`,
          output: `${cardName} sold for $${soldPrice.toFixed(2)} on ${soldDate}, indicating ${soldPrice > 500 ? 'very strong' : 'solid'} market value${row.grading_company && row.grade_number ? ` for ${row.grading_company} ${row.grade_number} condition` : ''}. Monitor recent sales to identify pricing patterns.`,
          category: 'price_trends',
          metadata: {
            source: 'ebay_temporal_sales',
            sold_price: soldPrice,
            sold_date: soldDate,
          },
        });
      }
    }

    totalProcessed += rows.length;
    offset += batchSize;

    console.log(`  Processed: ${totalProcessed.toLocaleString()} / ${limit.toLocaleString()}`);
    console.log(`  Examples created: ${examples.length.toLocaleString()} (${duplicates.toLocaleString()} duplicates)`);
  }

  console.log('\n\n📊 TEMPORAL EXTRACTION SUMMARY\n');
  console.log('='.repeat(60));
  console.log(`Records processed:     ${totalProcessed.toLocaleString()}`);
  console.log(`Unique temporal sales: ${seenHashes.size.toLocaleString()}`);
  console.log(`Training examples:     ${examples.length.toLocaleString()}`);
  console.log(`Duplicates removed:    ${duplicates.toLocaleString()}`);
  console.log('='.repeat(60));

  // Save
  const outputPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-ebay-temporal-proper.jsonl');
  const jsonl = examples.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(outputPath, jsonl, 'utf-8');

  const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Saved to: ${outputPath}`);
  console.log(`📦 Size: ${sizeMB} MB\n`);

  console.log('💡 Each sale is now a unique data point with date preserved!\n');
}

extractTemporalEbay().catch(console.error);
