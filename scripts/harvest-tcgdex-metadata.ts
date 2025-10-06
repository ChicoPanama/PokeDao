/**
 * Download complete Pokemon TCG metadata from TCGdex API
 *
 * This metadata is CRITICAL for Mew-1A model training:
 * - Rarity (Ultra Rare, Secret Rare, etc.) - Strong price predictor
 * - HP, Attack, Retreat Cost - Competitive playability affects value
 * - Illustrator - Certain artists command premium prices
 * - Set information - Vintage vs modern pricing patterns
 * - Card type - Trainer cards vs Pokemon vs Energy
 *
 * Run: pnpm tsx scripts/harvest-tcgdex-metadata.ts
 */

import fetch from 'node-fetch';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const BASE_URL = 'https://api.tcgdex.net/v2/en';
const RATE_LIMIT_MS = 200;
const OUTPUT_DIR = 'data/tcgdex';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadTCGdexMetadata() {
  console.log('📚 TCGDEX METADATA DOWNLOADER');
  console.log('='.repeat(60));
  console.log('🎯 Purpose: Enrich Mew-1A training with card metadata');
  console.log('📊 Features: Rarity, HP, Illustrator, Set info, Card type');
  console.log('='.repeat(60));
  console.log('');

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Fetch all sets
  console.log('📥 Step 1: Downloading all Pokemon TCG sets...');
  await sleep(RATE_LIMIT_MS);

  const setsResponse = await fetch(`${BASE_URL}/sets`);
  const sets: any[] = await setsResponse.json();

  console.log(`  ✓ Found ${sets.length} sets`);

  // Save sets metadata
  writeFileSync(
    `${OUTPUT_DIR}/sets.json`,
    JSON.stringify(sets, null, 2)
  );
  console.log(`  💾 Saved to ${OUTPUT_DIR}/sets.json`);
  console.log('');

  // Download detailed card data for each set
  console.log('📥 Step 2: Downloading detailed card data...');

  const allCards: any[] = [];
  let totalCards = 0;

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];

    console.log(`  [${i + 1}/${sets.length}] ${set.name} (${set.id})...`);

    try {
      await sleep(RATE_LIMIT_MS);

      const setResponse = await fetch(`${BASE_URL}/sets/${set.id}`);
      const setData: any = await setResponse.json();

      const cards = setData.cards || [];

      // Fetch full card details for each card
      for (const card of cards) {
        try {
          await sleep(RATE_LIMIT_MS);

          const cardResponse = await fetch(`${BASE_URL}/cards/${card.id}`);
          const fullCard: any = await cardResponse.json();

          // Extract key metadata for Mew-1A training
          const metadata = {
            id: fullCard.id,
            localId: fullCard.localId,
            name: fullCard.name,
            set: {
              id: set.id,
              name: set.name,
              releaseDate: set.releaseDate,
              serie: set.serie,
            },
            rarity: fullCard.rarity, // CRITICAL: Strong price predictor
            category: fullCard.category, // Pokemon vs Trainer vs Energy
            illustrator: fullCard.illustrator, // Some artists = premium
            hp: fullCard.hp, // Competitive value
            types: fullCard.types, // Card type
            stage: fullCard.stage, // Basic, Stage 1, Stage 2, etc.
            retreat: fullCard.retreat, // Playability
            regulationMark: fullCard.regulationMark, // Tournament legality
            variants: fullCard.variants, // Reverse holo, etc.
          };

          allCards.push(metadata);
          totalCards++;

        } catch (error: any) {
          console.error(`    ✗ Error fetching card ${card.id}: ${error.message}`);
        }
      }

      console.log(`    ✓ ${cards.length} cards processed (Total: ${totalCards})`);

    } catch (error: any) {
      console.error(`  ✗ Error fetching set ${set.id}: ${error.message}`);
    }
  }

  // Save all card metadata
  console.log('');
  console.log('💾 Step 3: Saving complete metadata database...');

  writeFileSync(
    `${OUTPUT_DIR}/cards-metadata.json`,
    JSON.stringify(allCards, null, 2)
  );

  console.log(`  ✓ Saved ${totalCards} cards to ${OUTPUT_DIR}/cards-metadata.json`);
  console.log('');

  // Create a lookup index by card name for easy matching
  const nameIndex: Record<string, any[]> = {};
  for (const card of allCards) {
    const key = card.name.toLowerCase().trim();
    if (!nameIndex[key]) nameIndex[key] = [];
    nameIndex[key].push(card);
  }

  writeFileSync(
    `${OUTPUT_DIR}/name-index.json`,
    JSON.stringify(nameIndex, null, 2)
  );

  console.log(`  ✓ Created name index with ${Object.keys(nameIndex).length} unique card names`);
  console.log('');

  console.log('='.repeat(60));
  console.log('✅ TCGDEX METADATA DOWNLOAD COMPLETE');
  console.log('='.repeat(60));
  console.log(`📦 Sets: ${sets.length}`);
  console.log(`📊 Cards: ${totalCards}`);
  console.log(`📁 Output: ${OUTPUT_DIR}/`);
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('  1. Use this metadata to enrich your 20,000+ priced listings');
  console.log('  2. Add rarity, HP, illustrator features to training data');
  console.log('  3. Train Mew-1A with enhanced features for better predictions');
  console.log('='.repeat(60));
}

downloadTCGdexMetadata().catch(console.error);
