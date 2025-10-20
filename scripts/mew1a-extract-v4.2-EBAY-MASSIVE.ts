#!/usr/bin/env tsx
/**
 * MEW-1A v4.2 - EXTRACT MASSIVE EBAY DATABASE
 *
 * Extracts the 505,335 records from collector_crypt_ebay_complete.db
 * This is the single largest unconverted data source!
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

async function extractEbayDatabase() {
  console.log('🚀 EXTRACTING MASSIVE EBAY DATABASE (505K+ RECORDS)\n');

  const dbPath = path.join(
    process.cwd(),
    'research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db'
  );

  const tables = [
    { name: 'ebay_sold_listings', limit: 250000, type: 'sold' },
    { name: 'ebay_current_listings', limit: 250000, type: 'active' },
    { name: 'ebay_price_analytics', limit: 10000, type: 'analytics' },
  ];

  for (const table of tables) {
    console.log(`\n📊 Processing ${table.name}...\n`);

    try {
      // Extract in batches to avoid memory issues
      const batchSize = 50000;
      let offset = 0;
      let totalProcessed = 0;

      while (totalProcessed < table.limit) {
        console.log(`  Batch ${Math.floor(totalProcessed / batchSize) + 1}: Offset ${offset}...`);

        const query = `SELECT * FROM ${table.name} LIMIT ${batchSize} OFFSET ${offset}`;
        const output = execSync(
          `sqlite3 "${dbPath}" "${query}" -json`,
          { encoding: 'utf-8', maxBuffer: 200 * 1024 * 1024 }
        );

        const rows = JSON.parse(output);
        if (rows.length === 0) break;

        console.log(`  Found ${rows.length} records`);

        for (const row of rows) {
          // SOLD LISTINGS - High value training data
          if (table.type === 'sold') {
            // Comp sale example
            examples.push({
              instruction: `Analyze this eBay sold listing for ${row.title || row.card_name || 'Pokemon card'}.`,
              input: `Title: ${row.title || row.card_name || 'Unknown'}
Sold Price: $${row.sold_price || row.price || '0'}
Date: ${row.sold_date || row.date || 'Recent'}
Condition: ${row.condition || 'N/A'}
Shipping: $${row.shipping || '0'}`,
              output: `This ${row.title || row.card_name} sold for $${row.sold_price || row.price} on eBay in ${row.condition || 'ungraded'} condition${row.shipping ? ` with $${row.shipping} shipping` : ''}. This is a verified market price point from an actual transaction.`,
              category: 'comparable_sales',
              metadata: {
                source: 'ebay_sold_listings_db',
                sold_price: row.sold_price || row.price,
                sold_date: row.sold_date || row.date,
                condition: row.condition,
                ebay_id: row.ebay_id || row.id,
              },
            });

            // Price trend example
            if (row.sold_price && row.title) {
              examples.push({
                instruction: `What is the market value of ${row.title}?`,
                input: `How much does ${row.title} sell for on average?`,
                output: `Based on eBay sold listings, ${row.title} recently sold for $${row.sold_price}${row.condition ? ` in ${row.condition} condition` : ''}. This represents an actual market transaction.`,
                category: 'pricing_advice',
                metadata: {
                  source: 'ebay_sold_listings_db',
                  sold_price: row.sold_price,
                },
              });
            }

            // Investment analysis
            if (row.sold_price && parseFloat(row.sold_price) > 50) {
              examples.push({
                instruction: `Is ${row.title || 'this card'} a good investment?`,
                input: `Should I invest in ${row.title}?`,
                output: `${row.title} has sold for $${row.sold_price} on eBay, indicating ${parseFloat(row.sold_price) > 200 ? 'strong' : 'moderate'} market demand. ${parseFloat(row.sold_price) > 200 ? 'This high-value card could be a solid investment.' : 'Research recent trends before investing.'}`,
                category: 'investment_advice',
                metadata: {
                  source: 'ebay_sold_listings_db',
                  sold_price: row.sold_price,
                },
              });
            }
          }

          // ACTIVE LISTINGS
          if (table.type === 'active') {
            examples.push({
              instruction: `Evaluate this active eBay listing.`,
              input: `${row.title || row.card_name} - Listed at $${row.price || '0'}`,
              output: `This listing for ${row.title || row.card_name} is priced at $${row.price}${row.condition ? ` in ${row.condition} condition` : ''}. ${row.watchers && row.watchers > 5 ? `It has ${row.watchers} watchers, indicating strong interest.` : 'Monitor similar sold listings to assess if this is a fair price.'}`,
              category: 'market_analysis',
              metadata: {
                source: 'ebay_current_listings_db',
                price: row.price,
                watchers: row.watchers,
              },
            });

            // Buying opportunity
            if (row.price && row.title) {
              examples.push({
                instruction: `Should I buy ${row.title} at this price?`,
                input: `Is $${row.price} a good price for ${row.title}?`,
                output: `${row.title} is currently listed at $${row.price}. Compare this with recent sold listings to determine if it's a fair deal. ${row.best_offer ? 'This listing accepts best offers, so you may be able to negotiate.' : ''}`,
                category: 'buying_advice',
                metadata: {
                  source: 'ebay_current_listings_db',
                  price: row.price,
                },
              });
            }
          }

          // PRICE ANALYTICS
          if (table.type === 'analytics') {
            examples.push({
              instruction: `Analyze price trends for ${row.card_name || 'this card'}.`,
              input: `What are the price trends for ${row.card_name}?`,
              output: `${row.card_name} shows ${row.trend || 'stable'} price trends${row.avg_price ? ` with an average price of $${row.avg_price}` : ''}. ${row.price_volatility && row.price_volatility > 20 ? 'High volatility indicates fluctuating demand.' : 'Price stability suggests consistent market value.'}`,
              category: 'market_analysis',
              metadata: {
                source: 'ebay_price_analytics_db',
                avg_price: row.avg_price,
                volatility: row.price_volatility,
              },
            });
          }
        }

        totalProcessed += rows.length;
        offset += batchSize;

        console.log(`  Processed: ${totalProcessed.toLocaleString()} / ${table.limit.toLocaleString()}`);
        console.log(`  Examples created: ${examples.length.toLocaleString()}`);
      }

      console.log(`\n  ✓ Completed ${table.name}: ${totalProcessed.toLocaleString()} records`);
    } catch (error) {
      console.error(`  ✗ Error processing ${table.name}: ${error}`);
    }
  }

  console.log('\n\n📊 EXTRACTION SUMMARY\n');
  console.log('='.repeat(60));
  console.log(`Total examples extracted: ${examples.length.toLocaleString()}`);
  console.log('='.repeat(60));

  // Save to JSONL
  const outputPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-ebay-massive-505k.jsonl');
  const jsonl = examples.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(outputPath, jsonl, 'utf-8');

  const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Saved to: ${outputPath}`);
  console.log(`📦 Size: ${sizeMB} MB\n`);
}

extractEbayDatabase().catch(console.error);
