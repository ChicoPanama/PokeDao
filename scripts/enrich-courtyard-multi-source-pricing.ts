/**
 * MULTI-SOURCE PRICING ENRICHMENT for Courtyard Pokemon Cards
 *
 * Strategy: For each Courtyard Pokemon card, query multiple pricing sources:
 * 1. OpenSea (NFT marketplace - direct listing prices)
 * 2. eBay (traditional market - graded cards)
 * 3. TCGPlayer (TCG market - card pricing)
 * 4. Collector Crypt (NFT marketplace - comparable graded cards)
 * 5. Magic Eden (alternative NFT marketplace)
 *
 * This creates a comprehensive pricing layer over Courtyard blockchain data
 */

import 'dotenv/config';
import prisma from '../api/src/lib/prisma.js';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const CHECKPOINT_FILE = 'data/courtyard/multi-source-pricing-checkpoint.json';

interface PricingSource {
  source: string;
  priceCents: number;
  url?: string;
  confidence: number;
}

interface EnrichmentCheckpoint {
  processedCount: number;
  enrichedCount: number;
  multiSourceCount: number; // Cards with 2+ pricing sources
  lastProcessedId?: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Query OpenSea for this card's listing price
 */
async function getOpenSeaPrice(tokenId: string, cardName: string): Promise<PricingSource | null> {
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
    const usdValue = (value / Math.pow(10, decimals)) * 4500; // Approximate ETH/MATIC conversion

    return {
      source: 'OPENSEA',
      priceCents: Math.round(usdValue * 100),
      url: `https://opensea.io/assets/polygon/0x251be3a17af4892035c37ebf5890f4a4d889dcad/${tokenId}`,
      confidence: 0.95, // Direct listing = high confidence
    };
  } catch (error) {
    return null;
  }
}

/**
 * Query eBay for comparable graded cards
 */
async function getEbayComparablePrice(
  cardName: string,
  setName: string,
  gradeCompany: string | null,
  grade: number | null
): Promise<PricingSource | null> {
  try {
    // Build search query
    let query = `${cardName} ${setName}`;
    if (gradeCompany && grade) {
      query += ` ${gradeCompany} ${grade}`;
    }
    query += ' Pokemon';

    // Query our existing eBay data
    const comparable = await prisma.unifiedMarketListing.findFirst({
      where: {
        source: 'EBAY',
        cardName: { contains: cardName },
        setName: setName !== 'Unknown' ? { contains: setName } : undefined,
        gradeCompany: gradeCompany || undefined,
        grade: grade || undefined,
        priceCents: { gt: 0 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!comparable) return null;

    return {
      source: 'EBAY',
      priceCents: comparable.priceCents,
      url: comparable.url || undefined,
      confidence: 0.85, // Comparable card = good confidence
    };
  } catch (error) {
    return null;
  }
}

/**
 * Query Collector Crypt for comparable graded cards
 */
async function getCollectorCryptComparablePrice(
  cardName: string,
  setName: string,
  gradeCompany: string | null,
  grade: number | null
): Promise<PricingSource | null> {
  try {
    const comparable = await prisma.unifiedMarketListing.findFirst({
      where: {
        source: 'COLLECTOR_CRYPT',
        cardName: { contains: cardName },
        setName: setName !== 'Unknown' ? { contains: setName } : undefined,
        gradeCompany: gradeCompany || undefined,
        grade: grade || undefined,
        priceCents: { gt: 0 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!comparable) return null;

    return {
      source: 'COLLECTOR_CRYPT',
      priceCents: comparable.priceCents,
      url: comparable.url || undefined,
      confidence: 0.90, // NFT marketplace + graded = high confidence
    };
  } catch (error) {
    return null;
  }
}

/**
 * Query JustTCG for comparable cards
 */
async function getJustTCGComparablePrice(
  cardName: string,
  setName: string
): Promise<PricingSource | null> {
  try {
    const comparable = await prisma.unifiedMarketListing.findFirst({
      where: {
        source: 'JUSTTCG',
        cardName: { contains: cardName },
        setName: setName !== 'Unknown' ? { contains: setName } : undefined,
        priceCents: { gt: 0 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!comparable) return null;

    return {
      source: 'JUSTTCG',
      priceCents: comparable.priceCents,
      url: comparable.url || undefined,
      confidence: 0.75, // TCG market = moderate confidence
    };
  } catch (error) {
    return null;
  }
}

/**
 * Calculate consensus price from multiple sources
 */
function calculateConsensusPrice(sources: PricingSource[]): {
  priceCents: number;
  confidence: number;
  sourceCount: number;
} {
  if (sources.length === 0) {
    return { priceCents: 0, confidence: 0, sourceCount: 0 };
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

  return {
    priceCents: avgPrice,
    confidence: Math.min(avgConfidence * (1 + sources.length * 0.1), 1.0), // Bonus for multiple sources
    sourceCount: sources.length,
  };
}

async function enrichCourtyardPricing() {
  const startTime = Date.now();

  console.log('🚀 COURTYARD MULTI-SOURCE PRICING ENRICHMENT');
  console.log('='.repeat(70));
  console.log('📊 Pricing Sources:');
  console.log('   1. OpenSea (direct NFT listings)');
  console.log('   2. eBay (graded card comparables)');
  console.log('   3. Collector Crypt (NFT marketplace comparables)');
  console.log('   4. JustTCG (TCG market comparables)');
  console.log('='.repeat(70));

  // Load checkpoint
  let checkpoint: EnrichmentCheckpoint = {
    processedCount: 0,
    enrichedCount: 0,
    multiSourceCount: 0,
  };

  if (existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log(`\n🔄 Resuming from checkpoint:`);
    console.log(`   Processed: ${checkpoint.processedCount}`);
    console.log(`   Enriched: ${checkpoint.enrichedCount}`);
    console.log(`   Multi-source: ${checkpoint.multiSourceCount}`);
  }

  console.log('\n🔍 Fetching Courtyard Pokemon cards...\n');

  // Get all Courtyard cards without pricing or with low confidence
  const courtyardCards = await prisma.unifiedMarketListing.findMany({
    where: {
      source: 'COURTYARD',
      cardName: { not: 'Unknown' },
      id: checkpoint.lastProcessedId ? { gt: checkpoint.lastProcessedId } : undefined,
    },
    orderBy: { id: 'asc' },
    take: 1000, // Process in batches
  });

  console.log(`📦 Found ${courtyardCards.length} Courtyard cards to enrich\n`);

  for (const card of courtyardCards) {
    checkpoint.processedCount++;

    const pricingSources: PricingSource[] = [];

    // 1. OpenSea (if we have tokenId in sourceId)
    if (card.sourceId) {
      const openSeaPrice = await getOpenSeaPrice(card.sourceId, card.cardName);
      if (openSeaPrice) pricingSources.push(openSeaPrice);
      await sleep(1000); // Rate limit OpenSea
    }

    // 2. eBay comparables
    const ebayPrice = await getEbayComparablePrice(
      card.cardName,
      card.setName,
      card.gradeCompany,
      card.grade
    );
    if (ebayPrice) pricingSources.push(ebayPrice);

    // 3. Collector Crypt comparables
    const ccPrice = await getCollectorCryptComparablePrice(
      card.cardName,
      card.setName,
      card.gradeCompany,
      card.grade
    );
    if (ccPrice) pricingSources.push(ccPrice);

    // 4. JustTCG comparables
    const jtcgPrice = await getJustTCGComparablePrice(
      card.cardName,
      card.setName
    );
    if (jtcgPrice) pricingSources.push(jtcgPrice);

    // Calculate consensus
    if (pricingSources.length > 0) {
      const consensus = calculateConsensusPrice(pricingSources);

      // Update card with enriched pricing
      await prisma.unifiedMarketListing.update({
        where: { id: card.id },
        data: {
          priceCents: consensus.priceCents,
          dataQuality: consensus.confidence,
          updatedAt: new Date(),
        },
      });

      checkpoint.enrichedCount++;
      if (pricingSources.length >= 2) {
        checkpoint.multiSourceCount++;
      }

      console.log(`✅ ${card.cardName} (${card.setName})`);
      console.log(`   Sources: ${pricingSources.map(s => s.source).join(', ')}`);
      console.log(`   Price: $${(consensus.priceCents / 100).toFixed(2)} (${pricingSources.length} sources, ${(consensus.confidence * 100).toFixed(0)}% confidence)`);
    } else {
      console.log(`⚠️  ${card.cardName} - No pricing sources found`);
    }

    // Save checkpoint every 10 cards
    if (checkpoint.processedCount % 10 === 0) {
      checkpoint.lastProcessedId = card.id;
      writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('✅ ENRICHMENT COMPLETE');
  console.log('='.repeat(70));
  console.log(`📊 Cards Processed: ${checkpoint.processedCount}`);
  console.log(`💰 Cards Enriched: ${checkpoint.enrichedCount}`);
  console.log(`🎯 Multi-source Pricing: ${checkpoint.multiSourceCount}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

enrichCourtyardPricing().catch(console.error);
