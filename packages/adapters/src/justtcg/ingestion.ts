/**
 * JustTCG data ingestion utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { JustTCGClient } from './client.js';
import { extractCardData } from './mapper.js';
import type { JustTCGCard } from './client.js';

export interface IngestionOptions {
  outputDir?: string; // Where to save JSON files
  batchSize?: number; // Cards per batch
  onProgress?: (current: number, total: number) => void;
  onBatch?: (cards: JustTCGCard[], batchNum: number) => void | Promise<void>;
}

/**
 * Ingest all Pokemon cards from JustTCG
 *
 * Saves to JSON files for Bronze layer ingestion
 */
export async function ingestJustTCGData(
  client: JustTCGClient,
  options: IngestionOptions = {}
): Promise<{
  totalCards: number;
  totalComps: number;
  totalListings: number;
  files: string[];
}> {
  const outputDir = options.outputDir || path.join(process.cwd(), 'data/justtcg');
  const batchSize = options.batchSize || 100;

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Get all sets
  console.log('[JustTCG] Fetching Pokemon sets...');
  const sets = await client.getSets();
  console.log(`[JustTCG] Found ${sets.length} sets`);

  let totalCards = 0;
  let totalComps = 0;
  let totalListings = 0;
  const files: string[] = [];

  // Process each set
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    console.log(`[JustTCG] Processing set ${i + 1}/${sets.length}: ${set.name}`);

    try {
      const cards = await client.getCardsBySet(set.id);
      console.log(`  → ${cards.length} cards`);

      if (cards.length === 0) continue;

      // Extract data
      const allComps: any[] = [];
      const allListings: any[] = [];

      for (const card of cards) {
        const { comps, listings } = extractCardData(card);
        allComps.push(...comps);
        allListings.push(...listings);
      }

      // Save to files
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const setSlug = set.id.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Save raw cards
      const cardsFile = path.join(outputDir, `justtcg-cards-${setSlug}-${timestamp}.json`);
      fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2));
      files.push(cardsFile);

      // Save comps
      if (allComps.length > 0) {
        const compsFile = path.join(outputDir, `justtcg-comps-${setSlug}-${timestamp}.json`);
        fs.writeFileSync(compsFile, JSON.stringify(allComps, null, 2));
        files.push(compsFile);
      }

      // Save listings
      if (allListings.length > 0) {
        const listingsFile = path.join(outputDir, `justtcg-listings-${setSlug}-${timestamp}.json`);
        fs.writeFileSync(listingsFile, JSON.stringify(allListings, null, 2));
        files.push(listingsFile);
      }

      totalCards += cards.length;
      totalComps += allComps.length;
      totalListings += allListings.length;

      console.log(`  → ${allComps.length} comps, ${allListings.length} listings`);

      if (options.onProgress) {
        options.onProgress(i + 1, sets.length);
      }

      if (options.onBatch) {
        await options.onBatch(cards, i);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to process set ${set.name}:`, error.message);
    }
  }

  return {
    totalCards,
    totalComps,
    totalListings,
    files,
  };
}
