#!/usr/bin/env tsx
/**
 * MEW-1A v4.2 ULTIMATE FINAL MERGE
 *
 * Merges ALL data sources:
 * - v4.1 FINAL ULTIMATE (113,354 examples) - Base + Reddit
 * - v4.2 extracted sources (170,952 examples) - PostgreSQL, JSON, TCGdex, SQLite, Analysis
 * - v4.2 eBay massive (925,332 examples) - Massive eBay database
 *
 * Target: 1,200,000+ examples
 */

import * as fs from 'fs';
import * as path from 'path';

interface Mew1AExample {
  instruction: string;
  input: string;
  output: string;
  category: string;
  metadata: Record<string, any>;
}

async function mergeAllDatasets() {
  console.log('🚀 MEW-1A v4.2 ULTIMATE FINAL MERGE\n');
  console.log('Merging ALL data sources into single dataset...\n');

  const allExamples: Mew1AExample[] = [];
  const seenHashes = new Set<string>();
  let duplicates = 0;

  const datasets = [
    {
      name: 'v4.1 FINAL ULTIMATE (Base + Reddit)',
      path: 'data/training/mew1a-v4.1-FINAL-ULTIMATE.jsonl',
      priority: 1,
    },
    {
      name: 'v4.2 Extracted Sources (PostgreSQL, JSON, TCGdex, SQLite, Analysis)',
      path: 'data/training/mew1a-v4.2-extracted-all-sources.jsonl',
      priority: 2,
    },
    {
      name: 'v4.2 eBay Massive Database (505K records)',
      path: 'data/training/mew1a-v4.2-ebay-massive-505k.jsonl',
      priority: 3,
    },
  ];

  // Merge in priority order
  for (const dataset of datasets) {
    console.log(`📦 Loading ${dataset.name}...`);

    const fullPath = path.join(process.cwd(), dataset.path);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ⚠️  File not found: ${dataset.path}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    console.log(`  Found ${lines.length.toLocaleString()} examples`);

    let added = 0;
    for (const line of lines) {
      try {
        const example: Mew1AExample = JSON.parse(line);

        // Create hash for deduplication (instruction + input)
        const hash = `${example.instruction}|${example.input}`.toLowerCase();

        if (seenHashes.has(hash)) {
          duplicates++;
          continue;
        }

        seenHashes.add(hash);
        allExamples.push(example);
        added++;
      } catch (error) {
        console.error(`  Parse error: ${error}`);
      }
    }

    console.log(`  ✓ Added ${added.toLocaleString()} unique examples (${duplicates.toLocaleString()} duplicates skipped)\n`);
  }

  console.log('📊 MERGE SUMMARY\n');
  console.log('='.repeat(80));
  console.log(`Total unique examples: ${allExamples.length.toLocaleString()}`);
  console.log(`Duplicates removed:    ${duplicates.toLocaleString()}`);
  console.log('='.repeat(80));

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const example of allExamples) {
    categoryCounts[example.category] = (categoryCounts[example.category] || 0) + 1;
  }

  console.log('\n📈 CATEGORY BREAKDOWN\n');
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedCategories) {
    const percentage = ((count / allExamples.length) * 100).toFixed(1);
    console.log(`  ${category.padEnd(30)} ${count.toLocaleString().padStart(10)} (${percentage}%)`);
  }

  // Save final dataset
  const outputPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-ULTIMATE-FINAL.jsonl');
  console.log(`\n💾 Saving final dataset to: ${outputPath}\n`);

  const jsonl = allExamples.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(outputPath, jsonl, 'utf-8');

  const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Successfully saved ${allExamples.length.toLocaleString()} examples`);
  console.log(`📦 File size: ${sizeMB} MB\n`);

  // Create train/val split (95%/5%)
  console.log('🔀 Creating train/validation split...\n');

  const shuffled = allExamples.sort(() => Math.random() - 0.5);
  const splitIndex = Math.floor(allExamples.length * 0.95);

  const trainSet = shuffled.slice(0, splitIndex);
  const valSet = shuffled.slice(splitIndex);

  const trainPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-train.jsonl');
  const valPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-val.jsonl');

  fs.writeFileSync(trainPath, trainSet.map(ex => JSON.stringify(ex)).join('\n'), 'utf-8');
  fs.writeFileSync(valPath, valSet.map(ex => JSON.stringify(ex)).join('\n'), 'utf-8');

  console.log(`  Train: ${trainSet.length.toLocaleString()} examples → ${trainPath}`);
  console.log(`  Val:   ${valSet.length.toLocaleString()} examples → ${valPath}\n`);

  console.log('🎉 MEW-1A v4.2 ULTIMATE FINAL DATASET READY!\n');
  console.log('Next step: Upload to HuggingFace for training\n');
}

mergeAllDatasets().catch(console.error);
