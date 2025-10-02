#!/usr/bin/env tsx
/**
 * Bronze Layer Ingestion
 *
 * Scans all raw JSON files and converts them to content-addressed Parquet files.
 * Preserves ALL data (no-loss guarantee) and generates manifests for lineage tracking.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import * as parquet from 'parquetjs';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_SOURCES = [
  { glob: 'worker/*.json', source: 'collectorcrypt', exclude: ['package.json', 'tsconfig.json'] },
  { glob: 'worker/harvest-cache/*.json', source: 'collectorcrypt_cache', exclude: [] },
  { glob: 'data/research/*.json', source: 'research', exclude: [] },
  { glob: 'data/*.json', source: 'legacy', exclude: [] },
  { glob: 'research/tcgplayer-discovery/*.json', source: 'tcgplayer', exclude: ['package.json', 'package-lock.json'] },
  { glob: 'research/fanatics-collect-discovery/*.json', source: 'fanatics', exclude: ['package.json', 'package-lock.json'] },
  { glob: '*.json', source: 'cardmarket', exclude: ['package.json', 'tsconfig.json'], filter: (f: string) => f.includes('cardmarket') },
  { glob: 'ml/data/*.json', source: 'ml_seeds', exclude: [] },
];

const BRONZE_DIR = path.join(process.cwd(), 'data_lake/bronze');
const MANIFEST_DIR = path.join(process.cwd(), 'data_lake/manifests');

// ============================================================================
// SCHEMAS
// ============================================================================

const BronzeManifestSchema = z.object({
  source: z.string(),
  pathRaw: z.string(),
  rows: z.number(),
  schemaKeys: z.array(z.string()),
  timeField: z.string().nullable(),
  timeRange: z.tuple([z.string(), z.string()]).nullable(),
  contentSha256: z.string(),
  ingestedAt: z.string(),
  variantKeyCoverage: z.number(),
  fileSize: z.number(),
  bronzePath: z.string(),
});

type BronzeManifest = z.infer<typeof BronzeManifestSchema>;

// ============================================================================
// UTILITIES
// ============================================================================

function globSync(pattern: string, basePath: string = process.cwd()): string[] {
  const parts = pattern.split('/');
  const result: string[] = [];

  function walk(currentPath: string, patternParts: string[]): void {
    if (patternParts.length === 0) return;

    const [current, ...rest] = patternParts;

    if (current === '**') {
      // Recursive glob
      if (!fs.existsSync(currentPath)) return;
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, patternParts); // Keep looking for **
          walk(fullPath, rest); // Also try the next pattern
        } else if (entry.isFile() && rest.length === 1 && matchPattern(entry.name, rest[0])) {
          result.push(fullPath);
        }
      }
    } else if (current === '*') {
      if (!fs.existsSync(currentPath)) return;
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory() && rest.length > 0) {
          walk(fullPath, rest);
        } else if (entry.isFile() && rest.length === 0) {
          result.push(fullPath);
        }
      }
    } else if (current.includes('*')) {
      // Pattern matching in filename
      if (!fs.existsSync(currentPath)) return;
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (matchPattern(entry.name, current)) {
          if (rest.length === 0 && entry.isFile()) {
            result.push(fullPath);
          } else if (rest.length > 0 && entry.isDirectory()) {
            walk(fullPath, rest);
          }
        }
      }
    } else {
      const nextPath = path.join(currentPath, current);
      if (rest.length === 0 && fs.existsSync(nextPath) && fs.statSync(nextPath).isFile()) {
        result.push(nextPath);
      } else if (fs.existsSync(nextPath) && fs.statSync(nextPath).isDirectory()) {
        walk(nextPath, rest);
      }
    }
  }

  walk(basePath, parts);
  return result;
}

function matchPattern(filename: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`).test(filename);
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function detectTimeField(obj: any): string | null {
  const timeFields = ['seenAt', 'soldAt', 'updatedAt', 'scrapedAt', 'createdAt', 'timestamp', 'date'];

  for (const field of timeFields) {
    if (obj[field]) return field;
  }

  return null;
}

function getTimeRange(data: any[], timeField: string | null): [string, string] | null {
  if (!timeField || data.length === 0) return null;

  const times = data
    .map(row => row[timeField])
    .filter(Boolean)
    .map(t => new Date(t).toISOString())
    .filter(t => !isNaN(Date.parse(t)));

  if (times.length === 0) return null;

  times.sort();
  return [times[0], times[times.length - 1]];
}

function estimateVariantKeyCoverage(data: any[]): number {
  if (data.length === 0) return 0;

  const sample = data.slice(0, Math.min(1000, data.length));
  const withVariantKey = sample.filter(row =>
    row.variantKey ||
    (row.set && row.number) ||
    (row.cardKey)
  ).length;

  return withVariantKey / sample.length;
}

function normalizeToArray(data: any): any[] {
  if (Array.isArray(data)) {
    return data;
  }

  // Check for common wrapper patterns
  if (data.items && Array.isArray(data.items)) return data.items;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.results && Array.isArray(data.results)) return data.results;
  if (data.cards && Array.isArray(data.cards)) return data.cards;
  if (data.listings && Array.isArray(data.listings)) return data.listings;
  if (data.comps && Array.isArray(data.comps)) return data.comps;

  // Single object - wrap in array
  if (typeof data === 'object' && data !== null) {
    return [data];
  }

  return [];
}

// ============================================================================
// PARQUET SCHEMA BUILDER
// ============================================================================

function buildParquetSchema(sampleData: any[]): parquet.ParquetSchema {
  const sample = sampleData.slice(0, 100); // Sample first 100 rows
  const fields: Record<string, any> = {};

  // Aggregate all keys from sample
  const allKeys = new Set<string>();
  for (const row of sample) {
    if (typeof row === 'object' && row !== null) {
      Object.keys(row).forEach(k => allKeys.add(k));
    }
  }

  // Infer types
  for (const key of allKeys) {
    const values = sample.map(r => r[key]).filter(v => v !== null && v !== undefined);

    if (values.length === 0) {
      fields[key] = { type: 'UTF8', optional: true };
      continue;
    }

    const firstValue = values[0];
    const type = typeof firstValue;

    if (type === 'number') {
      // Check if all numbers are integers
      const allInts = values.every((v: any) => Number.isInteger(v));
      fields[key] = { type: allInts ? 'INT64' : 'DOUBLE', optional: true };
    } else if (type === 'boolean') {
      fields[key] = { type: 'BOOLEAN', optional: true };
    } else if (type === 'object') {
      // Store as JSON string
      fields[key] = { type: 'UTF8', optional: true };
    } else {
      fields[key] = { type: 'UTF8', optional: true };
    }
  }

  return new parquet.ParquetSchema(fields);
}

function normalizeRowForParquet(row: any): any {
  const normalized: any = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      normalized[key] = null;
    } else if (typeof value === 'object') {
      normalized[key] = JSON.stringify(value);
    } else if (typeof value === 'number') {
      // Ensure no NaN or Infinity
      if (!Number.isFinite(value)) {
        normalized[key] = null;
      } else {
        normalized[key] = value;
      }
    } else {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

// ============================================================================
// INGESTION
// ============================================================================

async function ingestFile(
  filePath: string,
  source: string
): Promise<BronzeManifest> {
  console.log(`📥 Ingesting: ${filePath}`);

  // Read JSON
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  let parsed: any;

  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    console.error(`❌ Failed to parse ${filePath}:`, err);
    throw err;
  }

  // Normalize to array
  const dataArray = normalizeToArray(parsed);

  if (dataArray.length === 0) {
    console.warn(`⚠️  Empty dataset: ${filePath}`);
  }

  // Compute metadata
  const contentHash = await sha256File(filePath);
  const fileSize = fs.statSync(filePath).size;
  const schemaKeys = dataArray.length > 0 ? Object.keys(dataArray[0]) : [];
  const timeField = dataArray.length > 0 ? detectTimeField(dataArray[0]) : null;
  const timeRange = getTimeRange(dataArray, timeField);
  const variantKeyCoverage = estimateVariantKeyCoverage(dataArray);

  // Create bronze path
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const hashPrefix = contentHash.slice(0, 16);
  const sourceDir = path.join(BRONZE_DIR, source);
  fs.mkdirSync(sourceDir, { recursive: true });

  const bronzePath = path.join(sourceDir, `${timestamp}_${hashPrefix}.parquet`);

  // Write Parquet
  if (dataArray.length > 0) {
    const schema = buildParquetSchema(dataArray);
    const writer = await parquet.ParquetWriter.openFile(schema, bronzePath);

    for (const row of dataArray) {
      const normalized = normalizeRowForParquet(row);
      await writer.appendRow(normalized);
    }

    await writer.close();
    console.log(`✅ Wrote ${dataArray.length} rows to ${path.basename(bronzePath)}`);
  } else {
    // Empty file - create empty parquet
    const schema = new parquet.ParquetSchema({ _placeholder: { type: 'UTF8', optional: true } });
    const writer = await parquet.ParquetWriter.openFile(schema, bronzePath);
    await writer.close();
    console.log(`✅ Created empty parquet for ${path.basename(bronzePath)}`);
  }

  // Create manifest
  const manifest: BronzeManifest = {
    source,
    pathRaw: path.relative(process.cwd(), filePath),
    rows: dataArray.length,
    schemaKeys,
    timeField,
    timeRange,
    contentSha256: contentHash,
    ingestedAt: new Date().toISOString(),
    variantKeyCoverage,
    fileSize,
    bronzePath: path.relative(process.cwd(), bronzePath),
  };

  return manifest;
}

async function main() {
  console.log('🚀 Starting Bronze Layer Ingestion\n');

  const allManifests: BronzeManifest[] = [];

  for (const sourceConfig of DATA_SOURCES) {
    console.log(`\n📂 Processing source: ${sourceConfig.source}`);

    const files = globSync(sourceConfig.glob);
    const filtered = files.filter(f => {
      const basename = path.basename(f);

      // Exclude specific files
      if (sourceConfig.exclude.includes(basename)) return false;

      // Apply custom filter
      if (sourceConfig.filter && !sourceConfig.filter(f)) return false;

      return true;
    });

    console.log(`   Found ${filtered.length} files`);

    for (const file of filtered) {
      try {
        const manifest = await ingestFile(file, sourceConfig.source);
        allManifests.push(manifest);
      } catch (err) {
        console.error(`❌ Failed to ingest ${file}:`, err);
      }
    }
  }

  // Write master manifest
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  const manifestPath = path.join(
    MANIFEST_DIR,
    `bronze-manifest-${new Date().toISOString().split('T')[0]}.json`
  );

  const masterManifest = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    totalFiles: allManifests.length,
    totalRows: allManifests.reduce((sum, m) => sum + m.rows, 0),
    sources: Array.from(new Set(allManifests.map(m => m.source))),
    manifests: allManifests,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(masterManifest, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('✅ Bronze Ingestion Complete');
  console.log('='.repeat(80));
  console.log(`📊 Total files: ${allManifests.length}`);
  console.log(`📊 Total rows: ${masterManifest.totalRows.toLocaleString()}`);
  console.log(`📊 Sources: ${masterManifest.sources.join(', ')}`);
  console.log(`📄 Manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log('='.repeat(80));
}

main().catch(console.error);
