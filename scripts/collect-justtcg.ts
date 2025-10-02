#!/usr/bin/env tsx
/**
 * Collect Pokemon card data from JustTCG API
 *
 * Usage:
 *   JUSTTCG_API_KEY=your_key tsx scripts/collect-justtcg.ts
 *
 * Options:
 *   --output-dir <path>  - Where to save JSON files (default: data/justtcg)
 *   --batch-size <n>     - Cards per batch (default: 100)
 */

import { createJustTCGClient, ingestJustTCGData } from '../packages/adapters/src/justtcg/index.js';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  // Parse args
  const outputDir = args.includes('--output-dir')
    ? args[args.indexOf('--output-dir') + 1]
    : path.join(process.cwd(), 'data/justtcg');

  const batchSize = args.includes('--batch-size')
    ? parseInt(args[args.indexOf('--batch-size') + 1], 10)
    : 100;

  console.log('🚀 JustTCG Data Collection');
  console.log('='.repeat(80));
  console.log(`Output directory: ${outputDir}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('='.repeat(80));
  console.log();

  // Create client
  const client = createJustTCGClient();

  // Run ingestion
  const result = await ingestJustTCGData(client, {
    outputDir,
    batchSize,
    onProgress: (current, total) => {
      const pct = ((current / total) * 100).toFixed(1);
      console.log(`📊 Progress: ${current}/${total} sets (${pct}%)`);
    },
  });

  console.log();
  console.log('='.repeat(80));
  console.log('✅ JustTCG Collection Complete');
  console.log('='.repeat(80));
  console.log(`📦 Total cards: ${result.totalCards.toLocaleString()}`);
  console.log(`📈 Total comps: ${result.totalComps.toLocaleString()}`);
  console.log(`🏷️  Total listings: ${result.totalListings.toLocaleString()}`);
  console.log(`📁 Files created: ${result.files.length}`);
  console.log('='.repeat(80));
  console.log();
  console.log('Next steps:');
  console.log('1. Run bronze ingestion: pnpm data:ingest:bronze');
  console.log('2. Rebuild silver layer: pnpm data:build:silver');
  console.log('3. Rebuild gold layer: pnpm data:build:gold');
}

main().catch(error => {
  console.error('❌ Collection failed:', error);
  process.exit(1);
});
