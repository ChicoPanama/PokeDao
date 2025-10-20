#!/usr/bin/env tsx
/**
 * MEW-1A v4.2 ULTIMATE DATA EXTRACTION
 *
 * Extracts ALL unconverted data sources identified in the audit:
 * - PostgreSQL UnifiedMarketListing (239,785 records)
 * - Research JSON files (57,637 records)
 * - TCGdex metadata (21,627 cards)
 * - SQLite databases (777,891 total records)
 * - Analysis outputs (600 records)
 * - Phygital/marketplace data
 *
 * Target: 1,000,000+ training examples for Mew-1A v4.2
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

interface Mew1AExample {
  instruction: string;
  input: string;
  output: string;
  category: string;
  metadata: Record<string, any>;
}

const allExamples: Mew1AExample[] = [];
let stats = {
  postgres: 0,
  research_json: 0,
  tcgdex: 0,
  sqlite_dbs: 0,
  analysis: 0,
  phygitals: 0,
  total: 0,
};

// ============================================================================
// 1. EXTRACT POSTGRESQL UNIFIED MARKET LISTINGS
// ============================================================================

async function extractPostgreSQL() {
  console.log('\n📊 EXTRACTING POSTGRESQL DATA...\n');

  try {
    // UnifiedMarketListing - 239,785 records of market data across all platforms
    console.log('  Fetching UnifiedMarketListing...');
    const listings: any[] = await prisma.$queryRaw`
      SELECT * FROM "UnifiedMarketListing" LIMIT 50000
    `;

    console.log(`  Found ${listings.length} market listings`);

    for (const listing of listings) {
      // Market analysis example
      allExamples.push({
        instruction: `Analyze this Pokemon TCG card listing from ${listing.platform || 'marketplace'}.`,
        input: `Card: ${listing.cardName || 'Unknown'}
Platform: ${listing.platform || 'N/A'}
Price: $${listing.price || '0'}
Condition: ${listing.condition || 'N/A'}
Date: ${listing.listedAt || new Date().toISOString()}`,
        output: `This is a ${listing.condition || 'ungraded'} ${listing.cardName || 'card'} listed at $${listing.price || '0'} on ${listing.platform || 'marketplace'}. ${listing.price && listing.price > 100 ? 'This is a high-value card.' : 'This is a standard listing.'} ${listing.platform === 'ebay' ? 'eBay listings typically include shipping costs.' : ''}`,
        category: 'market_analysis',
        metadata: {
          source: 'postgres_unified_market_listing',
          platform: listing.platform,
          price: listing.price,
          card_name: listing.cardName,
          timestamp: listing.listedAt,
        },
      });

      // Price comparison example
      if (listing.price) {
        allExamples.push({
          instruction: `What is a fair price for ${listing.cardName || 'this card'}?`,
          input: `I found a listing for ${listing.cardName || 'this card'} at $${listing.price} on ${listing.platform}.`,
          output: `Based on marketplace data, $${listing.price} is ${listing.price > 50 ? 'a significant investment' : 'a reasonable price'} for ${listing.cardName || 'this card'} on ${listing.platform}. Check recent sold listings for comparison.`,
          category: 'pricing_advice',
          metadata: {
            source: 'postgres_unified_market_listing',
            price: listing.price,
            card_name: listing.cardName,
          },
        });
      }
    }

    stats.postgres = listings.length * 2; // 2 examples per listing
    console.log(`  ✓ Extracted ${stats.postgres} examples from PostgreSQL`);
  } catch (error) {
    console.error(`  ✗ PostgreSQL extraction error: ${error}`);
  }
}

// ============================================================================
// 2. EXTRACT RESEARCH JSON FILES
// ============================================================================

function extractResearchJSON() {
  console.log('\n📁 EXTRACTING RESEARCH JSON FILES...\n');

  const researchFiles = [
    'data/research/comps_collectorcrypt.json',
    'data/research/comps_ebay_db.json',
    'data/research/ebay_current_extended.json',
    'data/research/listings_ebay_db.json',
    'data/research/tcgplayer_anchors.json',
  ];

  for (const filePath of researchFiles) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) continue;

      console.log(`  Processing ${path.basename(filePath)}...`);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

      if (!Array.isArray(data)) continue;

      for (const item of data.slice(0, 10000)) { // Limit per file
        // Comp sales example
        if (item.soldPrice || item.price) {
          allExamples.push({
            instruction: `Analyze this comparable sale for ${item.cardName || item.name || 'Pokemon card'}.`,
            input: `Card: ${item.cardName || item.name || 'Unknown'}
Sold Price: $${item.soldPrice || item.price || '0'}
Date: ${item.soldDate || item.date || 'Recent'}
Condition: ${item.condition || 'N/A'}
Source: ${item.source || 'marketplace'}`,
            output: `This ${item.cardName || item.name} sold for $${item.soldPrice || item.price} in ${item.condition || 'ungraded'} condition. This sale provides a reliable price anchor for evaluating similar listings.`,
            category: 'comparable_sales',
            metadata: {
              source: `research_${path.basename(filePath)}`,
              sold_price: item.soldPrice || item.price,
              card_name: item.cardName || item.name,
            },
          });
        }

        // Listing analysis
        if (item.title || item.cardName) {
          allExamples.push({
            instruction: `Should I buy this Pokemon card?`,
            input: `${item.title || item.cardName || 'Card'} - $${item.price || item.soldPrice || '0'}`,
            output: `${item.title || item.cardName} at $${item.price || item.soldPrice} is ${(item.price || item.soldPrice || 0) < 20 ? 'an affordable option' : (item.price || item.soldPrice || 0) < 100 ? 'a moderate investment' : 'a premium card'}. Consider the condition, rarity, and recent market trends before purchasing.`,
            category: 'buying_advice',
            metadata: {
              source: `research_${path.basename(filePath)}`,
              price: item.price || item.soldPrice,
            },
          });
        }
      }

      const extracted = Math.min(data.length * 2, 20000);
      stats.research_json += extracted;
      console.log(`  ✓ Extracted ${extracted} examples from ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`  ✗ Error processing ${filePath}: ${error}`);
    }
  }
}

// ============================================================================
// 3. EXTRACT TCGDEX METADATA
// ============================================================================

function extractTCGdex() {
  console.log('\n🎴 EXTRACTING TCGDEX METADATA...\n');

  try {
    const cardsPath = path.join(process.cwd(), 'data/tcgdex/cards-metadata.json');
    const setsPath = path.join(process.cwd(), 'data/tcgdex/sets.json');

    // Cards metadata - 21,627 cards
    if (fs.existsSync(cardsPath)) {
      console.log('  Processing cards-metadata.json...');
      const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));

      for (const card of cards.slice(0, 21627)) {
        // Card knowledge example
        allExamples.push({
          instruction: `Tell me about ${card.name || 'this Pokemon card'}.`,
          input: `What can you tell me about ${card.name} from ${card.set?.name || 'this set'}?`,
          output: `${card.name} is a ${card.rarity || 'standard'} card from the ${card.set?.name || 'Pokemon TCG'} set. ${card.hp ? `It has ${card.hp} HP.` : ''} ${card.types ? `It's a ${card.types.join('/')} type.` : ''} ${card.attacks ? `It has ${card.attacks.length} attack(s).` : ''}`,
          category: 'card_knowledge',
          metadata: {
            source: 'tcgdex_cards',
            card_id: card.id,
            card_name: card.name,
            set: card.set?.name,
            rarity: card.rarity,
          },
        });

        // Rarity identification
        if (card.rarity) {
          allExamples.push({
            instruction: `How rare is ${card.name}?`,
            input: `Is ${card.name} a rare card?`,
            output: `${card.name} is a ${card.rarity} rarity card from ${card.set?.name || 'Pokemon TCG'}. ${card.rarity?.toLowerCase().includes('rare') ? 'This makes it more valuable than common cards.' : 'This is a standard rarity card.'}`,
            category: 'card_knowledge',
            metadata: {
              source: 'tcgdex_cards',
              rarity: card.rarity,
            },
          });
        }

        // Set information
        if (card.set) {
          allExamples.push({
            instruction: `What set is ${card.name} from?`,
            input: `Which set does ${card.name} belong to?`,
            output: `${card.name} is from the ${card.set.name} set${card.set.releaseDate ? `, released on ${card.set.releaseDate}` : ''}. ${card.set.total ? `This set contains ${card.set.total} cards.` : ''}`,
            category: 'card_knowledge',
            metadata: {
              source: 'tcgdex_cards',
              set: card.set.name,
            },
          });
        }
      }

      stats.tcgdex = cards.length * 3; // 3 examples per card
      console.log(`  ✓ Extracted ${stats.tcgdex} examples from TCGdex cards`);
    }

    // Sets data - 194 sets
    if (fs.existsSync(setsPath)) {
      console.log('  Processing sets.json...');
      const sets = JSON.parse(fs.readFileSync(setsPath, 'utf-8'));

      for (const set of sets) {
        allExamples.push({
          instruction: `Tell me about the ${set.name} set.`,
          input: `What can you tell me about the ${set.name} Pokemon TCG set?`,
          output: `The ${set.name} set${set.releaseDate ? ` was released on ${set.releaseDate}` : ''}${set.total ? ` and contains ${set.total} cards` : ''}. ${set.series ? `It's part of the ${set.series} series.` : ''}`,
          category: 'card_knowledge',
          metadata: {
            source: 'tcgdex_sets',
            set_id: set.id,
            set_name: set.name,
          },
        });
      }

      stats.tcgdex += sets.length;
      console.log(`  ✓ Extracted ${sets.length} examples from TCGdex sets`);
    }
  } catch (error) {
    console.error(`  ✗ TCGdex extraction error: ${error}`);
  }
}

// ============================================================================
// 4. EXTRACT SQLITE DATABASES (BIG ONE!)
// ============================================================================

function extractSQLiteDatabases() {
  console.log('\n💾 EXTRACTING SQLITE DATABASES...\n');

  const databases = [
    {
      path: 'research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db',
      table: 'collector_crypt_cards',
      limit: 100000,
      type: 'market_data',
    },
    {
      path: 'research-backup-20250911-172521/databases/tcgplayer-discovery/pokemon_tcg_complete.db',
      table: 'pokemon_cards',
      limit: 19500,
      type: 'card_data',
    },
    {
      path: 'research-backup-20250911-172521/databases/tcgplayer-discovery/tcgplayer.db',
      table: 'tcgplayer_cards',
      limit: 15044,
      type: 'pricing_data',
    },
    {
      path: 'research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_all_cards_fixed.db',
      table: 'cards',
      limit: 22937,
      type: 'card_data',
    },
  ];

  for (const db of databases) {
    try {
      const dbPath = path.join(process.cwd(), db.path);
      if (!fs.existsSync(dbPath)) continue;

      console.log(`  Processing ${path.basename(db.path)}...`);

      // Get all data from the table
      const query = `SELECT * FROM ${db.table} LIMIT ${db.limit}`;
      const output = execSync(`sqlite3 "${dbPath}" "${query}" -json`, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });

      const rows = JSON.parse(output);
      console.log(`  Found ${rows.length} records`);

      for (const row of rows) {
        // Market data examples
        if (db.type === 'market_data' && row.price) {
          allExamples.push({
            instruction: `Analyze this marketplace listing.`,
            input: `${row.card_name || row.name || 'Card'} - $${row.price}`,
            output: `This ${row.card_name || row.name} is listed at $${row.price}. ${row.condition ? `Condition: ${row.condition}.` : ''} ${row.marketplace ? `Available on ${row.marketplace}.` : ''}`,
            category: 'market_analysis',
            metadata: {
              source: `sqlite_${path.basename(db.path)}`,
              price: row.price,
              card_name: row.card_name || row.name,
            },
          });
        }

        // Card data examples
        if (db.type === 'card_data' && (row.name || row.card_name)) {
          allExamples.push({
            instruction: `What do you know about ${row.name || row.card_name}?`,
            input: `Tell me about ${row.name || row.card_name}.`,
            output: `${row.name || row.card_name} is a Pokemon TCG card${row.set_name ? ` from the ${row.set_name} set` : ''}. ${row.rarity ? `Rarity: ${row.rarity}.` : ''} ${row.type ? `Type: ${row.type}.` : ''}`,
            category: 'card_knowledge',
            metadata: {
              source: `sqlite_${path.basename(db.path)}`,
              card_name: row.name || row.card_name,
              set: row.set_name,
            },
          });
        }

        // Pricing data examples
        if (db.type === 'pricing_data' && row.market_price) {
          allExamples.push({
            instruction: `What is the current market price for ${row.card_name || row.name || 'this card'}?`,
            input: `How much is ${row.card_name || row.name} worth?`,
            output: `The current market price for ${row.card_name || row.name} is approximately $${row.market_price}. ${row.low_price && row.high_price ? `Price range: $${row.low_price} - $${row.high_price}.` : ''}`,
            category: 'pricing_advice',
            metadata: {
              source: `sqlite_${path.basename(db.path)}`,
              market_price: row.market_price,
              card_name: row.card_name || row.name,
            },
          });
        }
      }

      stats.sqlite_dbs += rows.length;
      console.log(`  ✓ Extracted ${rows.length} examples from ${path.basename(db.path)}`);
    } catch (error) {
      console.error(`  ✗ Error processing ${db.path}: ${error}`);
    }
  }
}

// ============================================================================
// 5. EXTRACT ANALYSIS OUTPUTS
// ============================================================================

function extractAnalysisOutputs() {
  console.log('\n📈 EXTRACTING ANALYSIS OUTPUTS...\n');

  const analysisFiles = [
    'data/analysis/arbitrage-opportunities-2025-10-17.json',
    'data/analysis/top-100-expensive-2025-10-17.json',
    'data/analysis/volatility-analysis-2025-10-17.json',
  ];

  for (const filePath of analysisFiles) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) continue;

      console.log(`  Processing ${path.basename(filePath)}...`);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

      if (!Array.isArray(data)) continue;

      for (const item of data) {
        // Arbitrage opportunities
        if (filePath.includes('arbitrage')) {
          allExamples.push({
            instruction: `Find arbitrage opportunities for ${item.cardName || 'Pokemon cards'}.`,
            input: `Are there any arbitrage opportunities for ${item.cardName}?`,
            output: `${item.cardName} shows a potential arbitrage opportunity${item.priceDifference ? ` with a price difference of $${item.priceDifference}` : ''}${item.platform1 && item.platform2 ? ` between ${item.platform1} and ${item.platform2}` : ''}.`,
            category: 'market_analysis',
            metadata: {
              source: 'analysis_arbitrage',
              card_name: item.cardName,
              price_difference: item.priceDifference,
            },
          });
        }

        // Expensive cards
        if (filePath.includes('expensive')) {
          allExamples.push({
            instruction: `What are the most expensive Pokemon cards?`,
            input: `List the top expensive Pokemon TCG cards.`,
            output: `${item.cardName || 'This card'} is one of the most expensive cards${item.price ? `, valued at $${item.price}` : ''}. ${item.rarity ? `It has ${item.rarity} rarity.` : ''}`,
            category: 'market_analysis',
            metadata: {
              source: 'analysis_expensive',
              card_name: item.cardName,
              price: item.price,
            },
          });
        }

        // Volatility
        if (filePath.includes('volatility')) {
          allExamples.push({
            instruction: `Analyze price volatility for ${item.cardName || 'this card'}.`,
            input: `How stable is the price of ${item.cardName}?`,
            output: `${item.cardName} shows ${item.volatility > 20 ? 'high' : 'moderate'} price volatility${item.volatility ? ` of ${item.volatility}%` : ''}. ${item.volatility > 30 ? 'This card experiences significant price swings.' : 'This card has relatively stable pricing.'}`,
            category: 'market_analysis',
            metadata: {
              source: 'analysis_volatility',
              volatility: item.volatility,
            },
          });
        }
      }

      stats.analysis += data.length;
      console.log(`  ✓ Extracted ${data.length} examples from ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`  ✗ Error processing ${filePath}: ${error}`);
    }
  }
}

// ============================================================================
// 6. EXTRACT PHYGITAL/MARKETPLACE DATA
// ============================================================================

function extractPhygitals() {
  console.log('\n🎨 EXTRACTING PHYGITAL/MARKETPLACE DATA...\n');

  try {
    const phygitalPath = path.join(process.cwd(), 'data/phygitals/research-db-export.json');
    if (fs.existsSync(phygitalPath)) {
      console.log('  Processing phygitals/research-db-export.json...');
      const phygitals = JSON.parse(fs.readFileSync(phygitalPath, 'utf-8'));

      if (Array.isArray(phygitals)) {
        for (const item of phygitals) {
          allExamples.push({
            instruction: `Explain phygital Pokemon cards.`,
            input: `What are phygital Pokemon cards?`,
            output: `Phygital Pokemon cards combine physical and digital ownership${item.blockchain ? ` on the ${item.blockchain} blockchain` : ''}. ${item.name ? `${item.name} is an example of a phygital card.` : ''} These cards often have enhanced value due to their digital certification.`,
            category: 'card_knowledge',
            metadata: {
              source: 'phygitals',
              blockchain: item.blockchain,
              name: item.name,
            },
          });
        }

        stats.phygitals = phygitals.length;
        console.log(`  ✓ Extracted ${stats.phygitals} examples from phygitals`);
      }
    }
  } catch (error) {
    console.error(`  ✗ Phygitals extraction error: ${error}`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 MEW-1A v4.2 ULTIMATE DATA EXTRACTION\n');
  console.log('Extracting ALL unconverted data sources...\n');

  await extractPostgreSQL();
  extractResearchJSON();
  extractTCGdex();
  extractSQLiteDatabases();
  extractAnalysisOutputs();
  extractPhygitals();

  stats.total = allExamples.length;

  console.log('\n\n📊 EXTRACTION SUMMARY\n');
  console.log('='.repeat(60));
  console.log(`PostgreSQL:       ${stats.postgres.toLocaleString()} examples`);
  console.log(`Research JSON:    ${stats.research_json.toLocaleString()} examples`);
  console.log(`TCGdex:           ${stats.tcgdex.toLocaleString()} examples`);
  console.log(`SQLite DBs:       ${stats.sqlite_dbs.toLocaleString()} examples`);
  console.log(`Analysis:         ${stats.analysis.toLocaleString()} examples`);
  console.log(`Phygitals:        ${stats.phygitals.toLocaleString()} examples`);
  console.log('='.repeat(60));
  console.log(`TOTAL EXTRACTED:  ${stats.total.toLocaleString()} examples\n`);

  // Save to JSONL
  const outputPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-extracted-all-sources.jsonl');
  const jsonl = allExamples.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(outputPath, jsonl, 'utf-8');

  console.log(`✅ Saved to: ${outputPath}`);
  console.log(`📦 Size: ${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
