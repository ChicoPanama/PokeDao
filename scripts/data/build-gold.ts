#!/usr/bin/env tsx
/**
 * Gold Layer Builder
 *
 * Reads silver parquet files and produces feature-ready analytics tables:
 * - gold/tfv_inputs.parquet - True Fair Value calculation inputs
 * - gold/liquidity.parquet - Liquidity metrics per variant/venue
 * - gold/variant_agg.parquet - Variant-level aggregations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as parquet from 'parquetjs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SILVER_DIR = path.join(process.cwd(), 'data_lake/silver');
const GOLD_DIR = path.join(process.cwd(), 'data_lake/gold');
const MANIFEST_DIR = path.join(process.cwd(), 'data_lake/manifests');

// Time windows for rolling stats (days)
const TIME_WINDOWS = [7, 14, 30, 60, 90];

// Venue trust scores (0-1)
const VENUE_TRUST: Record<string, number> = {
  ebay: 0.85,
  tcgplayer: 0.95,
  collectorcrypt: 0.80,
  fanatics: 0.75,
  cardmarket: 0.80,
  unknown: 0.50,
};

// ============================================================================
// TYPES
// ============================================================================

interface SilverComp {
  canonicalId: string;
  source: string;
  sourceId: string;
  variantKey: string | null;
  title: string;
  soldPriceCents: number;
  soldPriceOrigCents: number;
  currency: string;
  soldAt: string;
  venue: string | null;
  condition: string | null;
  grader: string | null;
  grade: string | null;
  isDuplicate: boolean;
  bronzeRef: string;
}

interface SilverListing {
  canonicalId: string;
  source: string;
  sourceId: string;
  variantKey: string | null;
  title: string;
  priceCents: number;
  seenAt: string;
  venue: string | null;
  condition: string | null;
  grader: string | null;
  grade: string | null;
  isActive: boolean;
  isDuplicate: boolean;
}

interface TfvInput {
  variantKey: string;
  windowDays: number;
  medianCents: number;
  p05Cents: number;
  p25Cents: number;
  p75Cents: number;
  p95Cents: number;
  volume: number;
  volatilityBp: number;
  venueTrust: number;
  timeDecayWeight: number;
  lastSoldAt: string;
}

interface LiquidityMetric {
  variantKey: string;
  venue: string;
  salesPerWeek: number;
  avgDaysToClear: number;
  activeListings: number;
  lastSeenAt: string;
}

interface VariantAgg {
  variantKey: string;
  totalComps: number;
  totalListings: number;
  minPriceCents: number;
  maxPriceCents: number;
  avgPriceCents: number;
  medianPriceCents: number;
  lastSoldAt: string | null;
  lastSeenAt: string | null;
  sources: string;
}

// ============================================================================
// SILVER READERS
// ============================================================================

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

// ============================================================================
// GOLD BUILDERS
// ============================================================================

function buildTfvInputs(comps: SilverComp[]): TfvInput[] {
  const tfvInputs: TfvInput[] = [];

  // Filter out duplicates and missing variantKeys
  const validComps = comps.filter(c => !c.isDuplicate && c.variantKey);

  // Group by variantKey
  const byVariant = new Map<string, SilverComp[]>();
  for (const comp of validComps) {
    const key = comp.variantKey!;
    if (!byVariant.has(key)) {
      byVariant.set(key, []);
    }
    byVariant.get(key)!.push(comp);
  }

  console.log(`   Found ${byVariant.size} unique variants`);

  // Compute rolling windows
  const now = new Date();

  for (const [variantKey, variantComps] of byVariant) {
    // Sort by soldAt
    variantComps.sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());

    for (const windowDays of TIME_WINDOWS) {
      const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
      const windowComps = variantComps.filter(c => new Date(c.soldAt) >= cutoff);

      if (windowComps.length === 0) continue;

      // Compute stats
      const prices = windowComps.map(c => c.soldPriceCents).sort((a, b) => a - b);
      const median = percentile(prices, 0.5);
      const p05 = percentile(prices, 0.05);
      const p25 = percentile(prices, 0.25);
      const p75 = percentile(prices, 0.75);
      const p95 = percentile(prices, 0.95);

      const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      const volatilityBp = mean > 0 ? Math.round((stdDev / mean) * 10000) : 0;

      // Venue trust (weighted average)
      const venueTrust = windowComps.reduce((sum, c) => {
        const trust = VENUE_TRUST[c.venue?.toLowerCase() || 'unknown'] || 0.5;
        return sum + trust;
      }, 0) / windowComps.length;

      // Time decay weight (more recent = higher weight)
      const daysSinceLastSale = Math.floor(
        (now.getTime() - new Date(windowComps[0].soldAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const timeDecayWeight = Math.exp(-daysSinceLastSale / 30); // 30-day half-life

      tfvInputs.push({
        variantKey,
        windowDays,
        medianCents: Math.round(median),
        p05Cents: Math.round(p05),
        p25Cents: Math.round(p25),
        p75Cents: Math.round(p75),
        p95Cents: Math.round(p95),
        volume: windowComps.length,
        volatilityBp,
        venueTrust: Math.round(venueTrust * 1000) / 1000,
        timeDecayWeight: Math.round(timeDecayWeight * 1000) / 1000,
        lastSoldAt: windowComps[0].soldAt,
      });
    }
  }

  return tfvInputs;
}

function buildLiquidityMetrics(
  comps: SilverComp[],
  listings: SilverListing[]
): LiquidityMetric[] {
  const metrics: LiquidityMetric[] = [];

  // Filter valid comps and listings
  const validComps = comps.filter(c => !c.isDuplicate && c.variantKey);
  const validListings = listings.filter(l => !l.isDuplicate && l.variantKey && l.isActive);

  // Group by (variantKey, venue)
  const compsByVenue = new Map<string, SilverComp[]>();
  const listingsByVenue = new Map<string, SilverListing[]>();

  for (const comp of validComps) {
    const key = `${comp.variantKey}::${comp.venue || 'unknown'}`;
    if (!compsByVenue.has(key)) {
      compsByVenue.set(key, []);
    }
    compsByVenue.get(key)!.push(comp);
  }

  for (const listing of validListings) {
    const key = `${listing.variantKey}::${listing.venue || 'unknown'}`;
    if (!listingsByVenue.has(key)) {
      listingsByVenue.set(key, []);
    }
    listingsByVenue.get(key)!.push(listing);
  }

  // Compute metrics
  const allKeys = new Set([...compsByVenue.keys(), ...listingsByVenue.keys()]);

  for (const key of allKeys) {
    const [variantKey, venue] = key.split('::');
    const venueComps = compsByVenue.get(key) || [];
    const venueListings = listingsByVenue.get(key) || [];

    // Sales per week (last 90 days)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentSales = venueComps.filter(c => new Date(c.soldAt) >= cutoff);
    const salesPerWeek = (recentSales.length / 90) * 7;

    // Avg days to clear (estimate: use median time between sales)
    let avgDaysToClear = 0;
    if (venueComps.length > 1) {
      const sortedSales = venueComps
        .map(c => new Date(c.soldAt).getTime())
        .sort((a, b) => a - b);

      const intervals = [];
      for (let i = 1; i < sortedSales.length; i++) {
        intervals.push((sortedSales[i] - sortedSales[i - 1]) / (1000 * 60 * 60 * 24));
      }

      avgDaysToClear = intervals.length > 0
        ? intervals.reduce((sum, d) => sum + d, 0) / intervals.length
        : 0;
    }

    const lastSeenAt = venueListings.length > 0
      ? venueListings.map(l => l.seenAt).sort().reverse()[0]
      : new Date().toISOString();

    metrics.push({
      variantKey,
      venue,
      salesPerWeek: Math.round(salesPerWeek * 100) / 100,
      avgDaysToClear: Math.round(avgDaysToClear * 10) / 10,
      activeListings: venueListings.length,
      lastSeenAt,
    });
  }

  return metrics;
}

function buildVariantAggs(comps: SilverComp[], listings: SilverListing[]): VariantAgg[] {
  const aggs: VariantAgg[] = [];

  // Filter valid records
  const validComps = comps.filter(c => !c.isDuplicate && c.variantKey);
  const validListings = listings.filter(l => !l.isDuplicate && l.variantKey);

  // Group by variantKey
  const compsByVariant = new Map<string, SilverComp[]>();
  const listingsByVariant = new Map<string, SilverListing[]>();

  for (const comp of validComps) {
    const key = comp.variantKey!;
    if (!compsByVariant.has(key)) {
      compsByVariant.set(key, []);
    }
    compsByVariant.get(key)!.push(comp);
  }

  for (const listing of validListings) {
    const key = listing.variantKey!;
    if (!listingsByVariant.has(key)) {
      listingsByVariant.set(key, []);
    }
    listingsByVariant.get(key)!.push(listing);
  }

  // Combine all variantKeys
  const allVariantKeys = new Set([...compsByVariant.keys(), ...listingsByVariant.keys()]);

  for (const variantKey of allVariantKeys) {
    const variantComps = compsByVariant.get(variantKey) || [];
    const variantListings = listingsByVariant.get(variantKey) || [];

    // Combine all prices
    const allPrices = [
      ...variantComps.map(c => c.soldPriceCents),
      ...variantListings.map(l => l.priceCents),
    ].filter(p => p > 0);

    if (allPrices.length === 0) continue;

    allPrices.sort((a, b) => a - b);

    const sources = new Set([
      ...variantComps.map(c => c.source),
      ...variantListings.map(l => l.source),
    ]);

    const lastSoldAt = variantComps.length > 0
      ? variantComps.map(c => c.soldAt).sort().reverse()[0]
      : null;

    const lastSeenAt = variantListings.length > 0
      ? variantListings.map(l => l.seenAt).sort().reverse()[0]
      : null;

    aggs.push({
      variantKey,
      totalComps: variantComps.length,
      totalListings: variantListings.length,
      minPriceCents: allPrices[0],
      maxPriceCents: allPrices[allPrices.length - 1],
      avgPriceCents: Math.round(allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length),
      medianPriceCents: Math.round(percentile(allPrices, 0.5)),
      lastSoldAt,
      lastSeenAt,
      sources: Array.from(sources).join(','),
    });
  }

  return aggs;
}

// ============================================================================
// UTILITIES
// ============================================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function writeParquet<T extends Record<string, any>>(
  data: T[],
  outputPath: string,
  schema: parquet.ParquetSchema
): Promise<void> {
  if (data.length === 0) {
    console.warn(`⚠️  No data to write to ${outputPath}`);
    return;
  }

  const writer = await parquet.ParquetWriter.openFile(schema, outputPath);

  for (const row of data) {
    await writer.appendRow(row);
  }

  await writer.close();
  console.log(`✅ Wrote ${data.length} rows to ${path.basename(outputPath)}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Starting Gold Layer Build\n');

  // Step 1: Read silver files
  console.log('📖 Reading silver/comps...');
  const comps = await readSilverComps();
  console.log(`   Loaded ${comps.length.toLocaleString()} comps\n`);

  console.log('📖 Reading silver/listings...');
  const listings = await readSilverListings();
  console.log(`   Loaded ${listings.length.toLocaleString()} listings\n`);

  // Step 2: Build TFV inputs
  console.log('🏗️  Building gold/tfv_inputs...');
  const tfvInputs = buildTfvInputs(comps);

  // Step 3: Build liquidity metrics
  console.log('🏗️  Building gold/liquidity...');
  const liquidityMetrics = buildLiquidityMetrics(comps, listings);

  // Step 4: Build variant aggregations
  console.log('🏗️  Building gold/variant_agg...');
  const variantAggs = buildVariantAggs(comps, listings);

  // Step 5: Write parquet files
  fs.mkdirSync(GOLD_DIR, { recursive: true });

  const tfvSchema = new parquet.ParquetSchema({
    variantKey: { type: 'UTF8' },
    windowDays: { type: 'INT32' },
    medianCents: { type: 'INT64' },
    p05Cents: { type: 'INT64' },
    p25Cents: { type: 'INT64' },
    p75Cents: { type: 'INT64' },
    p95Cents: { type: 'INT64' },
    volume: { type: 'INT32' },
    volatilityBp: { type: 'INT32' },
    venueTrust: { type: 'DOUBLE' },
    timeDecayWeight: { type: 'DOUBLE' },
    lastSoldAt: { type: 'UTF8' },
  });

  const liquiditySchema = new parquet.ParquetSchema({
    variantKey: { type: 'UTF8' },
    venue: { type: 'UTF8' },
    salesPerWeek: { type: 'DOUBLE' },
    avgDaysToClear: { type: 'DOUBLE' },
    activeListings: { type: 'INT32' },
    lastSeenAt: { type: 'UTF8' },
  });

  const variantAggSchema = new parquet.ParquetSchema({
    variantKey: { type: 'UTF8' },
    totalComps: { type: 'INT32' },
    totalListings: { type: 'INT32' },
    minPriceCents: { type: 'INT64' },
    maxPriceCents: { type: 'INT64' },
    avgPriceCents: { type: 'INT64' },
    medianPriceCents: { type: 'INT64' },
    lastSoldAt: { type: 'UTF8', optional: true },
    lastSeenAt: { type: 'UTF8', optional: true },
    sources: { type: 'UTF8' },
  });

  await writeParquet(tfvInputs, path.join(GOLD_DIR, 'tfv_inputs.parquet'), tfvSchema);
  await writeParquet(liquidityMetrics, path.join(GOLD_DIR, 'liquidity.parquet'), liquiditySchema);
  await writeParquet(variantAggs, path.join(GOLD_DIR, 'variant_agg.parquet'), variantAggSchema);

  // Step 6: Write manifest
  const manifestPath = path.join(
    MANIFEST_DIR,
    `gold-manifest-${new Date().toISOString().split('T')[0]}.json`
  );

  const manifest = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    inputComps: comps.length,
    inputListings: listings.length,
    tfvInputs: tfvInputs.length,
    liquidityMetrics: liquidityMetrics.length,
    variantAggs: variantAggs.length,
    timeWindows: TIME_WINDOWS,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('✅ Gold Layer Build Complete');
  console.log('='.repeat(80));
  console.log(`📊 TFV Inputs: ${tfvInputs.length.toLocaleString()}`);
  console.log(`📊 Liquidity Metrics: ${liquidityMetrics.length.toLocaleString()}`);
  console.log(`📊 Variant Aggregations: ${variantAggs.length.toLocaleString()}`);
  console.log(`📄 Manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log('='.repeat(80));
}

main().catch(console.error);
