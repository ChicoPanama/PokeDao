#!/usr/bin/env tsx
/**
 * Postgres Sync Script
 *
 * Reads silver parquet files and upserts into Postgres with proper indexes.
 * Uses MarketListing and CompSale tables from the Prisma schema.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as parquet from 'parquetjs';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SILVER_DIR = path.join(process.cwd(), 'data_lake/silver');
const BATCH_SIZE = 1000;

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

interface SilverListing {
  canonicalId: string;
  source: string;
  sourceId: string;
  variantKey: string | null;
  title: string;
  priceCents: number;
  currency: string;
  seller: string | null;
  venue: string | null;
  condition: string | null;
  grader: string | null;
  grade: string | null;
  seenAt: string;
  isActive: boolean;
  isDuplicate: boolean;
  rawPayload: string;
}

interface SilverComp {
  canonicalId: string;
  source: string;
  sourceId: string;
  variantKey: string | null;
  title: string;
  soldPriceCents: number;
  currency: string;
  soldAt: string;
  venue: string | null;
  condition: string | null;
  grader: string | null;
  grade: string | null;
  isDuplicate: boolean;
  rawPayload: string;
}

// ============================================================================
// READERS
// ============================================================================

async function readSilverListings(): Promise<SilverListing[]> {
  const filePath = path.join(SILVER_DIR, 'listings.parquet');

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return [];
  }

  const listings: SilverListing[] = [];
  const reader = await parquet.ParquetReader.openFile(filePath);
  const cursor = reader.getCursor();

  let record = null;
  while ((record = await cursor.next())) {
    listings.push(record as SilverListing);
  }

  await reader.close();
  return listings;
}

async function readSilverComps(): Promise<SilverComp[]> {
  const filePath = path.join(SILVER_DIR, 'comps.parquet');

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return [];
  }

  const comps: SilverComp[] = [];
  const reader = await parquet.ParquetReader.openFile(filePath);
  const cursor = reader.getCursor();

  let record = null;
  while ((record = await cursor.next())) {
    comps.push(record as SilverComp);
  }

  await reader.close();
  return comps;
}

// ============================================================================
// CARD RESOLUTION
// ============================================================================

async function findOrCreateCard(variantKey: string | null, title: string): Promise<string> {
  if (!variantKey) {
    // Create a minimal card entry with just title
    const card = await prisma.card.create({
      data: {
        name: title.slice(0, 100), // Truncate to fit schema
        set: 'UNKNOWN',
        number: '0',
      },
    });
    return card.id;
  }

  // Parse variantKey: SET|NUMBER|VARIANT|LANG|GRADER|GRADE
  const parts = variantKey.split('|');
  const [set, number, variant, , grader, grade] = parts;

  // Try to find existing card
  let card = await prisma.card.findFirst({
    where: {
      set: set || 'UNKNOWN',
      number: number || '0',
      variant: variant === 'BASE' ? null : variant,
      grade: grade === 'UNGRADED' ? null : grade,
    },
  });

  if (!card) {
    // Create new card
    card = await prisma.card.create({
      data: {
        name: title.slice(0, 100),
        set: set || 'UNKNOWN',
        number: number || '0',
        variant: variant === 'BASE' ? null : variant,
        grade: grade === 'UNGRADED' ? null : grade,
        variantKey,
      },
    });
  }

  return card.id;
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

async function syncListings(listings: SilverListing[]): Promise<void> {
  console.log(`📥 Syncing ${listings.length.toLocaleString()} listings...`);

  // Filter out duplicates (keep only canonical)
  const canonical = listings.filter(l => !l.isDuplicate);
  console.log(`   ${canonical.length.toLocaleString()} canonical listings`);

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < canonical.length; i += BATCH_SIZE) {
    const batch = canonical.slice(i, i + BATCH_SIZE);

    for (const listing of batch) {
      try {
        // Find or create card
        const cardId = await findOrCreateCard(listing.variantKey, listing.title);

        // Upsert MarketListing (unique on [source, sourceId])
        await prisma.marketListing.upsert({
          where: {
            source_sourceId: {
              source: listing.source,
              sourceId: listing.sourceId,
            },
          },
          create: {
            cardId,
            source: listing.source,
            sourceId: listing.sourceId,
            priceCents: Math.round(listing.priceCents),
            priceCentsUsd: Math.round(listing.priceCents),
            currency: listing.currency,
            condition: listing.condition || 'Unknown',
            grade: listing.grade,
            url: `https://${listing.venue || 'unknown.com'}/${listing.sourceId}`,
            seenAt: new Date(listing.seenAt),
            isActive: listing.isActive,
          },
          update: {
            priceCents: Math.round(listing.priceCents),
            priceCentsUsd: Math.round(listing.priceCents),
            seenAt: new Date(listing.seenAt),
            isActive: listing.isActive,
          },
        });

        synced++;
      } catch (err) {
        console.error(`❌ Failed to sync listing ${listing.sourceId}:`, err);
        errors++;
      }
    }

    console.log(`   Progress: ${Math.min(i + BATCH_SIZE, canonical.length)}/${canonical.length}`);
  }

  console.log(`✅ Synced ${synced} listings (${errors} errors)`);
}

async function syncComps(comps: SilverComp[]): Promise<void> {
  console.log(`📥 Syncing ${comps.length.toLocaleString()} comps...`);

  // Filter out duplicates
  const canonical = comps.filter(c => !c.isDuplicate);
  console.log(`   ${canonical.length.toLocaleString()} canonical comps`);

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < canonical.length; i += BATCH_SIZE) {
    const batch = canonical.slice(i, i + BATCH_SIZE);

    for (const comp of batch) {
      try {
        // Find or create card
        const cardId = await findOrCreateCard(comp.variantKey, comp.title);

        // Upsert CompSale (unique on [source, externalId])
        await prisma.compSale.upsert({
          where: {
            source_externalId: {
              source: comp.source,
              externalId: comp.sourceId,
            },
          },
          create: {
            cardId,
            source: comp.source,
            externalId: comp.sourceId,
            priceCents: Math.round(comp.soldPriceCents),
            priceCentsUsd: Math.round(comp.soldPriceCents),
            currency: comp.currency,
            soldAt: new Date(comp.soldAt),
            raw: JSON.parse(comp.rawPayload),
          },
          update: {
            priceCents: Math.round(comp.soldPriceCents),
            priceCentsUsd: Math.round(comp.soldPriceCents),
            soldAt: new Date(comp.soldAt),
          },
        });

        synced++;
      } catch (err) {
        console.error(`❌ Failed to sync comp ${comp.sourceId}:`, err);
        errors++;
      }
    }

    console.log(`   Progress: ${Math.min(i + BATCH_SIZE, canonical.length)}/${canonical.length}`);
  }

  console.log(`✅ Synced ${synced} comps (${errors} errors)`);
}

// ============================================================================
// INDEX CREATION
// ============================================================================

async function ensureIndexes(): Promise<void> {
  console.log('🔧 Ensuring database indexes...');

  const indexes = [
    // Card indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_variant_key ON "Card"("variantKey")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_set_number ON "Card"("set", "number")',

    // MarketListing indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_listing_card_seen ON "MarketListing"("cardId", "seenAt")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_listing_seen ON "MarketListing"("seenAt")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_listing_source ON "MarketListing"("source")',

    // CompSale indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comp_sale_card_sold ON "CompSale"("cardId", "soldAt")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comp_sale_sold ON "CompSale"("soldAt")',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comp_sale_source ON "CompSale"("source")',
  ];

  for (const sql of indexes) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`   ✅ ${sql.match(/idx_\w+/)?.[0]}`);
    } catch (err: any) {
      // Ignore "already exists" errors
      if (err.code === '42P07' || err.message.includes('already exists')) {
        console.log(`   ⏭️  Index already exists`);
      } else {
        console.error(`   ❌ Failed to create index:`, err.message);
      }
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Starting Postgres Sync\n');

  try {
    // Step 1: Read silver data
    console.log('📖 Reading silver data...');
    const listings = await readSilverListings();
    const comps = await readSilverComps();
    console.log(`   Listings: ${listings.length.toLocaleString()}`);
    console.log(`   Comps: ${comps.length.toLocaleString()}\n`);

    // Step 2: Ensure indexes (do this first to avoid constraint errors)
    await ensureIndexes();
    console.log();

    // Step 3: Sync listings
    await syncListings(listings);
    console.log();

    // Step 4: Sync comps
    await syncComps(comps);
    console.log();

    // Step 5: Summary stats
    const stats = await prisma.$transaction([
      prisma.card.count(),
      prisma.marketListing.count(),
      prisma.compSale.count(),
    ]);

    console.log('='.repeat(80));
    console.log('✅ Postgres Sync Complete');
    console.log('='.repeat(80));
    console.log(`📊 Total Cards: ${stats[0].toLocaleString()}`);
    console.log(`📊 Total Market Listings: ${stats[1].toLocaleString()}`);
    console.log(`📊 Total Comp Sales: ${stats[2].toLocaleString()}`);
    console.log('='.repeat(80));
  } catch (err) {
    console.error('❌ Sync failed:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
