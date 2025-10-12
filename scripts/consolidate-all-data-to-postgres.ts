/**
 * COMPREHENSIVE DATA CONSOLIDATION SCRIPT
 *
 * Migrates ALL Pokemon card data from SQLite databases to PostgreSQL
 *
 * Sources:
 * - eBay listings (198,045 current + 284,253 sold)
 * - Collector Crypt (22,937 cards)
 * - Pokemon TCG Official (19,500 cards)
 * - TCGPlayer (15,201 cards)
 * - Phygitals (1,195 cards)
 *
 * Target: PostgreSQL UnifiedMarketListing table
 *
 * Run: pnpm tsx scripts/consolidate-all-data-to-postgres.ts
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import prisma from '../api/src/lib/prisma.js';
import { createHash } from 'crypto';

const SQLITE_BASE_PATH = 'research-backup-20250911-172521/databases/tcgplayer-discovery';

interface MigrationStats {
  source: string;
  attempted: number;
  imported: number;
  skipped: number;
  errors: number;
}

const stats: MigrationStats[] = [];

function generateId(source: string, sourceId: string): string {
  const hash = createHash('sha256').update(`${source}-${sourceId}`).digest('hex');
  return `${source.toLowerCase()}-${hash.substring(0, 16)}`;
}

function cleanText(text: any): string | null {
  if (!text) return null;
  return String(text).trim().substring(0, 500);
}

function parsePriceCents(price: any): number | null {
  if (!price) return null;
  const num = parseFloat(String(price));
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100); // Convert to cents
}

async function migrateEBayCurrentListings() {
  console.log('\n📦 Migrating eBay Current Listings...');
  console.log('Source: collector_crypt_ebay_complete.db');

  const db = new Database(`${SQLITE_BASE_PATH}/collector_crypt_ebay_complete.db`, { readonly: true });

  const rows = db.prepare('SELECT * FROM ebay_current_listings').all();
  console.log(`Found ${rows.length} records`);

  const migrationStat: MigrationStats = {
    source: 'EBAY_CURRENT',
    attempted: rows.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  for (const row of rows) {
    try {
      const sourceId = row.ebay_item_id || row.id;
      const id = generateId('EBAY', sourceId);

      await prisma.unifiedMarketListing.upsert({
        where: {
          source_sourceId: {
            source: 'EBAY',
            sourceId: String(sourceId),
          },
        },
        create: {
          id,
          source: 'EBAY',
          sourceId: String(sourceId),
          title: cleanText(row.title) || 'Unknown',
          rawTitle: cleanText(row.title),
          cardName: cleanText(row.pokemon_name),
          setName: cleanText(row.set_name),
          cardNumber: cleanText(row.card_number),
          variant: cleanText(row.rarity),
          grade: row.grade_number ? parseFloat(row.grade_number) : null,
          gradeCompany: cleanText(row.grading_company),
          condition: cleanText(row.condition_description),
          priceCents: parsePriceCents(row.current_price || row.buy_it_now_price),
          currency: 'USD',
          url: cleanText(row.ebay_url),
          dataQuality: 0.7, // Historical data
        },
        update: {
          priceCents: parsePriceCents(row.current_price || row.buy_it_now_price),
          updatedAt: new Date(),
        },
      });

      migrationStat.imported++;

      if (migrationStat.imported % 1000 === 0) {
        console.log(`  ✓ Imported ${migrationStat.imported}/${rows.length}...`);
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        migrationStat.skipped++;
      } else {
        migrationStat.errors++;
        console.error(`  ✗ Error on ${row.id}: ${error.message}`);
      }
    }
  }

  db.close();
  stats.push(migrationStat);
  console.log(`✅ eBay Current: ${migrationStat.imported} imported, ${migrationStat.skipped} skipped, ${migrationStat.errors} errors`);
}

async function migrateEBaySoldListings() {
  console.log('\n📦 Migrating eBay Sold Listings...');
  console.log('Source: collector_crypt_ebay_complete.db');

  const db = new Database(`${SQLITE_BASE_PATH}/collector_crypt_ebay_complete.db`, { readonly: true });

  const rows = db.prepare('SELECT * FROM ebay_sold_listings LIMIT 50000').all(); // Limit for performance
  console.log(`Found ${rows.length} records (limited to 50,000 for initial import)`);

  const migrationStat: MigrationStats = {
    source: 'EBAY_SOLD',
    attempted: rows.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  for (const row of rows) {
    try {
      const sourceId = row.ebay_item_id || row.id;
      const id = generateId('EBAY_SOLD', sourceId);

      // Import to CompSale table instead for sold listings
      await prisma.compSale.create({
        data: {
          id,
          source: 'EBAY',
          priceCents: parsePriceCents(row.sold_price) || 0,
          currency: 'USD',
          soldAt: row.sold_date ? new Date(row.sold_date) : new Date(),
          condition: cleanText(row.condition_description),
          grade: cleanText(row.grading_company) && row.grade_number ? `${row.grading_company} ${row.grade_number}` : null,
          isVerified: true,
        },
      });

      migrationStat.imported++;

      if (migrationStat.imported % 1000 === 0) {
        console.log(`  ✓ Imported ${migrationStat.imported}/${rows.length}...`);
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        migrationStat.skipped++;
      } else {
        migrationStat.errors++;
      }
    }
  }

  db.close();
  stats.push(migrationStat);
  console.log(`✅ eBay Sold: ${migrationStat.imported} imported, ${migrationStat.skipped} skipped, ${migrationStat.errors} errors`);
}

async function migrateCollectorCrypt() {
  console.log('\n📦 Migrating Collector Crypt Data...');
  console.log('Source: collector_crypt_comprehensive_pricing.db');

  const db = new Database(`${SQLITE_BASE_PATH}/collector_crypt_all_cards_fixed.db`, { readonly: true });

  const rows = db.prepare('SELECT * FROM collector_crypt_comprehensive_pricing').all();
  console.log(`Found ${rows.length} records`);

  const migrationStat: MigrationStats = {
    source: 'COLLECTOR_CRYPT',
    attempted: rows.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  for (const row of rows) {
    try {
      const sourceId = row.id || row.card_id;
      const id = generateId('COLLECTOR_CRYPT', sourceId);

      await prisma.unifiedMarketListing.upsert({
        where: {
          source_sourceId: {
            source: 'COLLECTOR_CRYPT',
            sourceId: String(sourceId),
          },
        },
        create: {
          id,
          source: 'COLLECTOR_CRYPT',
          sourceId: String(sourceId),
          title: cleanText(row.card_name || row.title) || 'Unknown',
          cardName: cleanText(row.card_name || row.pokemon_name),
          setName: cleanText(row.set_name),
          cardNumber: cleanText(row.card_number),
          variant: cleanText(row.variant),
          grade: row.grade ? parseFloat(row.grade) : null,
          gradeCompany: cleanText(row.grading_company),
          condition: cleanText(row.condition),
          priceCents: parsePriceCents(row.price || row.market_price),
          currency: 'USD',
          url: cleanText(row.url),
          dataQuality: 0.75,
        },
        update: {
          priceCents: parsePriceCents(row.price || row.market_price),
          updatedAt: new Date(),
        },
      });

      migrationStat.imported++;

      if (migrationStat.imported % 1000 === 0) {
        console.log(`  ✓ Imported ${migrationStat.imported}/${rows.length}...`);
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        migrationStat.skipped++;
      } else {
        migrationStat.errors++;
      }
    }
  }

  db.close();
  stats.push(migrationStat);
  console.log(`✅ Collector Crypt: ${migrationStat.imported} imported, ${migrationStat.skipped} skipped, ${migrationStat.errors} errors`);
}

async function migratePokemonTCGOfficial() {
  console.log('\n📦 Migrating Pokemon TCG Official Data...');
  console.log('Source: pokemon_tcg_complete.db');

  const db = new Database(`${SQLITE_BASE_PATH}/pokemon_tcg_complete.db`, { readonly: true });

  const rows = db.prepare('SELECT * FROM pokemon_cards').all();
  console.log(`Found ${rows.length} records`);

  const migrationStat: MigrationStats = {
    source: 'POKEMON_OFFICIAL',
    attempted: rows.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  for (const row of rows) {
    try {
      const sourceId = row.id;
      const id = generateId('OFFICIAL', sourceId);

      await prisma.unifiedMarketListing.upsert({
        where: {
          source_sourceId: {
            source: 'OFFICIAL',
            sourceId: String(sourceId),
          },
        },
        create: {
          id,
          source: 'OFFICIAL',
          sourceId: String(sourceId),
          title: cleanText(row.name) || 'Unknown',
          cardName: cleanText(row.name),
          setName: cleanText(row.set_name),
          cardNumber: cleanText(row.number),
          variant: cleanText(row.rarity),
          priceCents: parsePriceCents(row.price),
          currency: 'USD',
          dataQuality: 0.9, // Official data has high quality
        },
        update: {
          updatedAt: new Date(),
        },
      });

      migrationStat.imported++;

      if (migrationStat.imported % 1000 === 0) {
        console.log(`  ✓ Imported ${migrationStat.imported}/${rows.length}...`);
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        migrationStat.skipped++;
      } else {
        migrationStat.errors++;
      }
    }
  }

  db.close();
  stats.push(migrationStat);
  console.log(`✅ Pokemon Official: ${migrationStat.imported} imported, ${migrationStat.skipped} skipped, ${migrationStat.errors} errors`);
}

async function migrateTCGPlayer() {
  console.log('\n📦 Migrating TCGPlayer Data...');
  console.log('Source: tcgplayer_enhanced.db');

  const db = new Database(`${SQLITE_BASE_PATH}/tcgplayer_enhanced.db`, { readonly: true });

  const rows = db.prepare('SELECT * FROM tcgplayer_cards_enhanced').all();
  console.log(`Found ${rows.length} records`);

  const migrationStat: MigrationStats = {
    source: 'TCGPLAYER',
    attempted: rows.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  for (const row of rows) {
    try {
      const sourceId = row.id || row.product_id;
      const id = generateId('TCGPLAYER', sourceId);

      await prisma.unifiedMarketListing.upsert({
        where: {
          source_sourceId: {
            source: 'TCGPLAYER',
            sourceId: String(sourceId),
          },
        },
        create: {
          id,
          source: 'TCGPLAYER',
          sourceId: String(sourceId),
          title: cleanText(row.name || row.card_name) || 'Unknown',
          cardName: cleanText(row.name || row.card_name),
          setName: cleanText(row.set_name),
          cardNumber: cleanText(row.number),
          variant: cleanText(row.rarity),
          priceCents: parsePriceCents(row.market_price || row.price),
          currency: 'USD',
          url: cleanText(row.url),
          dataQuality: 0.8,
        },
        update: {
          priceCents: parsePriceCents(row.market_price || row.price),
          updatedAt: new Date(),
        },
      });

      migrationStat.imported++;

      if (migrationStat.imported % 1000 === 0) {
        console.log(`  ✓ Imported ${migrationStat.imported}/${rows.length}...`);
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        migrationStat.skipped++;
      } else {
        migrationStat.errors++;
      }
    }
  }

  db.close();
  stats.push(migrationStat);
  console.log(`✅ TCGPlayer: ${migrationStat.imported} imported, ${migrationStat.skipped} skipped, ${migrationStat.errors} errors`);
}

async function printFinalSummary() {
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 FINAL CONSOLIDATION SUMMARY');
  console.log('═'.repeat(80));
  console.log('');

  const totalAttempted = stats.reduce((sum, s) => sum + s.attempted, 0);
  const totalImported = stats.reduce((sum, s) => sum + s.imported, 0);
  const totalSkipped = stats.reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);

  console.log('BY SOURCE:');
  console.log('-'.repeat(80));
  stats.forEach(s => {
    console.log(`${s.source.padEnd(20)} | ${s.attempted.toLocaleString().padStart(8)} attempted | ${s.imported.toLocaleString().padStart(8)} imported | ${s.skipped.toLocaleString().padStart(7)} skipped | ${s.errors.toLocaleString().padStart(6)} errors`);
  });

  console.log('');
  console.log('TOTALS:');
  console.log('-'.repeat(80));
  console.log(`Total Attempted:  ${totalAttempted.toLocaleString()}`);
  console.log(`Total Imported:   ${totalImported.toLocaleString()} ✅`);
  console.log(`Total Skipped:    ${totalSkipped.toLocaleString()} (duplicates)`);
  console.log(`Total Errors:     ${totalErrors.toLocaleString()}`);
  console.log('');

  // Query final database state
  const finalCount = await prisma.unifiedMarketListing.count();
  const uniqueCards = await prisma.unifiedMarketListing.groupBy({
    by: ['cardName'],
    where: { cardName: { not: null } },
  });

  const soldCount = await prisma.compSale.count();

  console.log('FINAL DATABASE STATE:');
  console.log('-'.repeat(80));
  console.log(`UnifiedMarketListing: ${finalCount.toLocaleString()} total records`);
  console.log(`Unique Card Names:    ${uniqueCards.length.toLocaleString()}`);
  console.log(`CompSale (Sold):      ${soldCount.toLocaleString()} records`);
  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ CONSOLIDATION COMPLETE!');
  console.log('═'.repeat(80));
}

async function main() {
  console.log('🚀 COMPREHENSIVE DATA CONSOLIDATION');
  console.log('═'.repeat(80));
  console.log('');
  console.log('This script will migrate ALL Pokemon card data to PostgreSQL:');
  console.log('  • eBay Current Listings (198,045 records)');
  console.log('  • eBay Sold Listings (50,000 records - limited for performance)');
  console.log('  • Collector Crypt (22,937 records)');
  console.log('  • Pokemon TCG Official (19,500 records)');
  console.log('  • TCGPlayer Enhanced (15,201 records)');
  console.log('');
  console.log('Target: PostgreSQL UnifiedMarketListing & CompSale tables');
  console.log('═'.repeat(80));
  console.log('');

  try {
    await migrateEBayCurrentListings();
    await migrateEBaySoldListings();
    await migrateCollectorCrypt();
    await migratePokemonTCGOfficial();
    await migrateTCGPlayer();

    await printFinalSummary();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
