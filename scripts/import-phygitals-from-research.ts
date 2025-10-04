/**
 * Import Phygitals data from research SQLite database
 *
 * Source: research-backup-20250911-172521/databases/tcgplayer-discovery/phygitals_pokemon_complete.db
 * Contains: 1,195 Pokemon cards (790 with pricing)
 * Note: This is 16.5% of the 7,261 target, but still valuable for arbitrage detection
 *
 * Run: pnpm tsx scripts/import-phygitals-from-research.ts
 */

import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { mapPhygitalsListingToActiveListing } from '../packages/adapters/src/phygitals/mapper.js';
import type { ActiveListing } from '../packages/core/src/types.js';

const DB_PATH = '/Users/arcadio/dev/pokedao/research-backup-20250911-172521/databases/tcgplayer-discovery/phygitals_pokemon_complete.db';
const OUTPUT_JSON = 'data/phygitals/research-import.json';

interface PhygitalsDBCard {
  id: string;
  name: string;
  set_name: string | null;
  image_url: string | null;
  price: number | null; // Lamports (Solana)
  fmv: number | null;
  grader: string | null;
  grade: string | null;
  grade_type: string | null;
  rarity: string | null;
  card_type: string | null;
  language: string | null;
  category: string | null;
  owner_address: string | null;
  owner_username: string | null;
  listing_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata_json: string | null;
  source_url: string | null;
}

async function main() {
  console.log('🗄️  Importing Phygitals data from research database...\n');

  // Open SQLite database
  console.log(`📂 Opening: ${DB_PATH}`);
  const db = Database(DB_PATH, { readonly: true });

  // Get total counts
  const totalCards = db.prepare('SELECT COUNT(*) as count FROM phygitals_cards').get() as { count: number };
  const withPricing = db.prepare('SELECT COUNT(*) as count FROM phygitals_cards WHERE price IS NOT NULL AND price > 0').get() as { count: number };

  console.log(`📊 Database contains:`);
  console.log(`   - Total cards: ${totalCards.count}`);
  console.log(`   - With pricing: ${withPricing.count}`);
  console.log();

  // Fetch all cards
  const cards = db.prepare(`
    SELECT *
    FROM phygitals_cards
    ORDER BY price DESC NULLS LAST
  `).all() as PhygitalsDBCard[];

  console.log(`✅ Loaded ${cards.length} cards from database\n`);

  // Convert to unified schema
  const LAMPORTS_PER_SOL = 1_000_000_000;
  const SOL_PRICE_USD = 140; // Approximate SOL price at time of research

  const listings: ActiveListing[] = [];
  const stats = {
    total: 0,
    withPrice: 0,
    graded: 0,
    byGrader: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  };

  for (const card of cards) {
    // Convert lamports to USD cents
    let priceCents = 0;
    if (card.price !== null && card.price > 0) {
      const solAmount = card.price / LAMPORTS_PER_SOL;
      const usdAmount = solAmount * SOL_PRICE_USD;
      priceCents = Math.round(usdAmount * 100);
      stats.withPrice++;
    }

    // Parse metadata if available
    let metadata: any = {};
    if (card.metadata_json) {
      try {
        metadata = JSON.parse(card.metadata_json);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Create ActiveListing
    const listing: ActiveListing = {
      priceCents,
      currency: 'USD',
      currencyOrig: 'SOL',
      fxRate: SOL_PRICE_USD,
      timestamp: new Date(card.updated_at || card.created_at || new Date()),
      source: 'phygitals',
      sourceId: card.id,
      seenAt: new Date(card.updated_at || card.created_at || new Date()),
      venue: 'phygitals',
      seller: card.owner_username || card.owner_address || undefined,
      condition: undefined, // Graded cards don't have condition
      grader: card.grader?.toUpperCase() || 'RAW',
      grade: card.grade ? String(card.grade) : 'UNGRADED',
      isActive: card.listing_status === 'active' || card.listing_status === 'listed',
    };

    listings.push(listing);
    stats.total++;

    // Track graders
    const grader = listing.grader || 'RAW';
    stats.byGrader[grader] = (stats.byGrader[grader] || 0) + 1;

    // Track statuses
    const status = card.listing_status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    if (listing.grader !== 'RAW') {
      stats.graded++;
    }
  }

  console.log('📈 Conversion Stats:');
  console.log(`   - Total listings: ${stats.total}`);
  console.log(`   - With pricing: ${stats.withPrice}`);
  console.log(`   - Graded: ${stats.graded}`);
  console.log();

  console.log('🏆 By Grader:');
  Object.entries(stats.byGrader)
    .sort((a, b) => b[1] - a[1])
    .forEach(([grader, count]) => {
      console.log(`   - ${grader}: ${count}`);
    });
  console.log();

  console.log('📊 By Status:');
  Object.entries(stats.byStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
  console.log();

  // Show top value cards
  const topCards = listings
    .filter(l => l.priceCents > 0)
    .sort((a, b) => b.priceCents - a.priceCents)
    .slice(0, 10);

  console.log('💎 Top 10 Most Expensive Cards:');
  topCards.forEach((listing, i) => {
    const card = cards.find(c => c.id === listing.sourceId);
    console.log(`${i + 1}. $${(listing.priceCents / 100).toFixed(2)} - ${card?.name || 'Unknown'} (${listing.grader} ${listing.grade})`);
  });
  console.log();

  // Save to JSON
  const output = {
    metadata: {
      source: 'research-backup-20250911-172521/databases/tcgplayer-discovery/phygitals_pokemon_complete.db',
      importedAt: new Date().toISOString(),
      stats,
      notes: [
        'This is 16.5% of the 7,261 target cards',
        'Phygitals API was down during comprehensive harvest',
        'Solana prices converted to USD using ~$140/SOL rate',
        'Ready for arbitrage detection vs traditional markets',
      ],
    },
    listings,
    rawCards: cards,
  };

  writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
  console.log(`✅ Saved to: ${OUTPUT_JSON}`);
  console.log(`📦 Total listings exported: ${listings.length}`);

  db.close();
}

main().catch(console.error);
