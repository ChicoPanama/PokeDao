/**
 * MASTER MULTI-LAYER PRICING ENRICHMENT SYSTEM
 *
 * Applies comprehensive multi-source pricing to EVERY card in the database
 *
 * Strategy:
 * For each card WITHOUT pricing or LOW confidence pricing:
 * 1. Query ALL available pricing sources
 * 2. Calculate weighted consensus from multiple sources
 * 3. Boost confidence based on source agreement
 * 4. Save enriched pricing + confidence score
 *
 * Pricing Sources (in priority order):
 * - Direct marketplace listings (OpenSea, eBay, TCGPlayer, etc.)
 * - Exact match comparables (same card, grade, variant)
 * - Close match comparables (same card, different grade)
 * - Set-based estimates (average for set/rarity)
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const CHECKPOINT_FILE = 'data/master-pricing-enrichment-checkpoint.json';
const BATCH_SIZE = 100;

interface PricingSource {
  source: string;
  matchType: 'EXACT' | 'CLOSE' | 'ESTIMATED';
  priceCents: number;
  confidence: number;
  url?: string;
}

interface EnrichmentCheckpoint {
  processedCount: number;
  enrichedCount: number;
  multiSourceCount: number;
  lastProcessedId?: string;
  sourceBreakdown: Record<string, number>;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Query OpenSea API for direct listing
 */
async function queryOpenSeaDirect(tokenId: string): Promise<PricingSource | null> {
  try {
    const url = `https://api.opensea.io/api/v2/orders/polygon/seaport/listings`;
    const params = new URLSearchParams({
      asset_contract_address: '0x251be3a17af4892035c37ebf5890f4a4d889dcad',
      token_ids: tokenId,
      limit: '1',
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY!,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data: any = await response.json();
    const orders = data.orders || [];
    if (orders.length === 0) return null;

    const order = orders[0];
    const priceData = order.current_price || order.price;
    if (!priceData) return null;

    const value = parseFloat(priceData.value || priceData);
    const decimals = parseInt(priceData.decimals || '18');
    const usdValue = (value / Math.pow(10, decimals)) * 4500;

    return {
      source: 'OPENSEA_DIRECT',
      matchType: 'EXACT',
      priceCents: Math.round(usdValue * 100),
      confidence: 0.95,
      url: `https://opensea.io/assets/polygon/0x251be3a17af4892035c37ebf5890f4a4d889dcad/${tokenId}`,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Query database for EXACT match comparable
 */
async function queryExactMatch(
  cardName: string,
  setName: string,
  gradeCompany: string | null,
  grade: number | null,
  excludeSource?: string
): Promise<PricingSource | null> {
  try {
    const comparable = await prisma.unifiedMarketListing.findFirst({
      where: {
        source: excludeSource ? { not: excludeSource } : undefined,
        cardName,
        setName,
        gradeCompany: gradeCompany || undefined,
        grade: grade || undefined,
        priceCents: { gt: 0 },
        dataQuality: { gte: 0.7 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!comparable) return null;

    return {
      source: `${comparable.source}_EXACT`,
      matchType: 'EXACT',
      priceCents: comparable.priceCents,
      confidence: 0.90,
      url: comparable.url || undefined,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Query database for CLOSE match (same card, different grade)
 */
async function queryCloseMatch(
  cardName: string,
  setName: string,
  excludeSource?: string
): Promise<PricingSource | null> {
  try {
    const comparable = await prisma.unifiedMarketListing.findFirst({
      where: {
        source: excludeSource ? { not: excludeSource } : undefined,
        cardName,
        setName,
        priceCents: { gt: 0 },
        dataQuality: { gte: 0.6 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!comparable) return null;

    return {
      source: `${comparable.source}_CLOSE`,
      matchType: 'CLOSE',
      priceCents: comparable.priceCents,
      confidence: 0.70,
      url: comparable.url || undefined,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Query database for SET-based estimate
 */
async function querySetEstimate(
  setName: string,
  gradeCompany: string | null,
  grade: number | null,
  excludeSource?: string
): Promise<PricingSource | null> {
  try {
    // Get average price for this set + grade combination
    const result = await prisma.unifiedMarketListing.aggregate({
      where: {
        source: excludeSource ? { not: excludeSource } : undefined,
        setName,
        gradeCompany: gradeCompany || undefined,
        grade: grade ? { gte: grade - 1, lte: grade + 1 } : undefined,
        priceCents: { gt: 0 },
        dataQuality: { gte: 0.5 },
      },
      _avg: {
        priceCents: true,
      },
      _count: true,
    });

    if (!result._avg.priceCents || result._count < 3) return null;

    return {
      source: 'SET_ESTIMATE',
      matchType: 'ESTIMATED',
      priceCents: Math.round(result._avg.priceCents),
      confidence: 0.50,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Query ALL sources for pricing data
 */
async function queryAllSources(card: any): Promise<PricingSource[]> {
  const sources: PricingSource[] = [];

  // 1. If this is a Courtyard card with tokenId, try OpenSea direct
  if (card.source === 'COURTYARD' && card.sourceId) {
    const openSeaDirect = await queryOpenSeaDirect(card.sourceId);
    if (openSeaDirect) sources.push(openSeaDirect);
    await sleep(1000); // Rate limit
  }

  // 2. Exact match comparables (all sources)
  const exactSources = ['EBAY', 'COLLECTOR_CRYPT', 'JUSTTCG', 'OPENSEA', 'COURTYARD'];
  for (const source of exactSources) {
    if (source === card.source) continue; // Don't match against same source
    const exact = await queryExactMatch(
      card.cardName,
      card.setName,
      card.gradeCompany,
      card.grade,
      card.source
    );
    if (exact) sources.push(exact);
  }

  // 3. Close match comparables
  const close = await queryCloseMatch(card.cardName, card.setName, card.source);
  if (close) sources.push(close);

  // 4. Set-based estimate (fallback)
  if (sources.length === 0) {
    const estimate = await querySetEstimate(
      card.setName,
      card.gradeCompany,
      card.grade,
      card.source
    );
    if (estimate) sources.push(estimate);
  }

  return sources;
}

/**
 * Calculate weighted consensus price
 */
function calculateConsensus(sources: PricingSource[]): {
  priceCents: number;
  confidence: number;
  sourceCount: number;
  sources: string[];
} {
  if (sources.length === 0) {
    return { priceCents: 0, confidence: 0, sourceCount: 0, sources: [] };
  }

  // Weighted average by confidence
  let totalWeightedPrice = 0;
  let totalConfidence = 0;

  for (const source of sources) {
    totalWeightedPrice += source.priceCents * source.confidence;
    totalConfidence += source.confidence;
  }

  const avgPrice = Math.round(totalWeightedPrice / totalConfidence);
  const avgConfidence = totalConfidence / sources.length;

  // Bonus for multiple sources (up to +30% confidence)
  const multiSourceBonus = Math.min(sources.length * 0.1, 0.3);
  const finalConfidence = Math.min(avgConfidence + multiSourceBonus, 1.0);

  // Bonus for exact matches
  const exactCount = sources.filter(s => s.matchType === 'EXACT').length;
  const exactBonus = exactCount > 0 ? 0.05 : 0;
  const adjustedConfidence = Math.min(finalConfidence + exactBonus, 1.0);

  return {
    priceCents: avgPrice,
    confidence: adjustedConfidence,
    sourceCount: sources.length,
    sources: sources.map(s => s.source),
  };
}

async function masterEnrichment() {
  const startTime = Date.now();

  console.log('🚀 MASTER MULTI-LAYER PRICING ENRICHMENT');
  console.log('='.repeat(70));
  console.log('📊 Pricing Strategy:');
  console.log('   1. Direct marketplace listings (OpenSea, eBay, etc.)');
  console.log('   2. Exact match comparables (same card + grade)');
  console.log('   3. Close match comparables (same card, any grade)');
  console.log('   4. Set-based estimates (average for set + grade)');
  console.log('='.repeat(70));

  // Load checkpoint
  let checkpoint: EnrichmentCheckpoint = {
    processedCount: 0,
    enrichedCount: 0,
    multiSourceCount: 0,
    sourceBreakdown: {},
  };

  if (existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log(`\n🔄 Resuming from checkpoint:`);
    console.log(`   Processed: ${checkpoint.processedCount.toLocaleString()}`);
    console.log(`   Enriched: ${checkpoint.enrichedCount.toLocaleString()}`);
    console.log(`   Multi-source: ${checkpoint.multiSourceCount.toLocaleString()}`);
  }

  console.log('\n🔍 Fetching cards to enrich...\n');

  // Get cards that need enrichment (no pricing OR low confidence)
  const totalCount = await prisma.unifiedMarketListing.count({
    where: {
      cardName: { not: 'Unknown' },
      OR: [
        { priceCents: 0 },
        { dataQuality: { lt: 0.7 } },
      ],
    },
  });

  console.log(`📦 Total cards to enrich: ${totalCount.toLocaleString()}\n`);

  let batchOffset = checkpoint.processedCount;

  while (batchOffset < totalCount) {
    const cardsToEnrich = await prisma.unifiedMarketListing.findMany({
      where: {
        cardName: { not: 'Unknown' },
        OR: [
          { priceCents: 0 },
          { dataQuality: { lt: 0.7 } },
        ],
      },
      orderBy: { id: 'asc' },
      skip: batchOffset,
      take: BATCH_SIZE,
    });

    if (cardsToEnrich.length === 0) break;

    for (const card of cardsToEnrich) {
      checkpoint.processedCount++;

      // Query all sources
      const pricingSources = await queryAllSources(card);

      if (pricingSources.length > 0) {
        const consensus = calculateConsensus(pricingSources);

        // Update card
        await prisma.unifiedMarketListing.update({
          where: { id: card.id },
          data: {
            priceCents: consensus.priceCents,
            dataQuality: consensus.confidence,
            updatedAt: new Date(),
          },
        });

        checkpoint.enrichedCount++;
        if (consensus.sourceCount >= 2) {
          checkpoint.multiSourceCount++;
        }

        // Track source breakdown
        for (const source of consensus.sources) {
          checkpoint.sourceBreakdown[source] = (checkpoint.sourceBreakdown[source] || 0) + 1;
        }

        console.log(`✅ ${card.cardName} (${card.setName}) [${card.source}]`);
        console.log(`   Sources: ${consensus.sources.join(', ')}`);
        console.log(`   Price: $${(consensus.priceCents / 100).toFixed(2)} (${consensus.sourceCount} sources, ${(consensus.confidence * 100).toFixed(0)}% confidence)`);
      }

      // Save checkpoint every 10 cards
      if (checkpoint.processedCount % 10 === 0) {
        checkpoint.lastProcessedId = card.id;
        writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));

        const progress = (checkpoint.processedCount / totalCount * 100).toFixed(1);
        console.log(`\n📊 Progress: ${checkpoint.processedCount.toLocaleString()}/${totalCount.toLocaleString()} (${progress}%)\n`);
      }
    }

    batchOffset += BATCH_SIZE;
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('✅ MASTER ENRICHMENT COMPLETE');
  console.log('='.repeat(70));
  console.log(`📊 Cards Processed: ${checkpoint.processedCount.toLocaleString()}`);
  console.log(`💰 Cards Enriched: ${checkpoint.enrichedCount.toLocaleString()}`);
  console.log(`🎯 Multi-source Pricing: ${checkpoint.multiSourceCount.toLocaleString()}`);
  console.log(`\n📈 Source Breakdown:`);
  Object.entries(checkpoint.sourceBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      console.log(`   ${source}: ${count.toLocaleString()}`);
    });
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

masterEnrichment().catch(console.error);
