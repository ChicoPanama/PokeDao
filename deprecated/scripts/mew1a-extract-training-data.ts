#!/usr/bin/env node

/**
 * Mew-1A v2 Training Data Extraction Script
 *
 * Extracts 250,000 high-quality instruction-tuning examples from consolidated data:
 * - Category 1: Arbitrage Detection (50k)
 * - Category 2: Liquidity Analysis (50k)
 * - Category 3: Price Trend Analysis (50k)
 * - Category 4: Multi-Source Consensus (50k)
 * - Category 5: Condition/Grade Adjustments (50k)
 *
 * Output: JSONL format for HuggingFace Datasets
 */

import prisma from '../api/src/lib/prisma.js';
import fs from 'fs';
import path from 'path';

interface TrainingExample {
  instruction: string;
  input: string;
  output: string;
  category: string;
  metadata?: {
    cardName?: string;
    setName?: string;
    sources?: string[];
    priceRange?: string;
  };
}

// Helper function to format currency
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Helper function to calculate discount/premium percentage
function calculateDiscount(listed: number, fair: number): string {
  const diff = ((listed - fair) / fair) * 100;
  if (diff > 0) return `${diff.toFixed(1)}% above`;
  return `${Math.abs(diff).toFixed(1)}% below`;
}

// Helper function to determine recommendation
function getRecommendation(discount: number, liquidity: string): string {
  if (discount < -10 && liquidity !== 'F') return 'BUY';
  if (discount > 15) return 'PASS';
  return 'HOLD';
}

// Helper function to get liquidity grade
function getLiquidityGrade(listingCount: number): string {
  if (listingCount >= 100) return 'A';
  if (listingCount >= 50) return 'B';
  if (listingCount >= 20) return 'C';
  if (listingCount >= 10) return 'D';
  return 'F';
}

// Helper function to get price range category
function getPriceRange(cents: number): string {
  if (cents < 100) return 'budget';
  if (cents < 1000) return 'low';
  if (cents < 5000) return 'mid';
  if (cents < 25000) return 'high';
  return 'premium';
}

async function extractCategory1_Arbitrage(): Promise<TrainingExample[]> {
  console.log('\n📊 Extracting Category 1: Arbitrage Detection (target: 50,000)');
  console.log('─'.repeat(80));

  // Get cards with multiple listings to calculate fair value
  const arbitrageData = await prisma.$queryRaw<any[]>`
    WITH card_stats AS (
      SELECT
        "cardName",
        "setName",
        source,
        "priceCents",
        title,
        url,
        ROW_NUMBER() OVER (PARTITION BY "cardName", "setName" ORDER BY "updatedAt" DESC) as rn,
        AVG("priceCents") OVER (PARTITION BY "cardName", "setName") as avg_price,
        COUNT(*) OVER (PARTITION BY "cardName", "setName") as listing_count
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "setName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "priceCents" < 10000000
        AND "dataQuality" >= 0.5
    )
    SELECT * FROM card_stats
    WHERE listing_count >= 2 AND rn <= 5
    ORDER BY RANDOM()
    LIMIT 60000
  `;

  const examples: TrainingExample[] = [];
  let processed = 0;

  for (const row of arbitrageData) {
    const listedPrice = Number(row.priceCents);
    const fairValue = Number(row.avg_price);
    const listingCount = Number(row.listing_count);
    const discount = ((fairValue - listedPrice) / fairValue) * 100;
    const liquidityGrade = getLiquidityGrade(listingCount);
    const recommendation = getRecommendation(discount, liquidityGrade);

    const instruction = `Analyze: ${row.cardName} - ${row.setName}. Listed at ${formatPrice(listedPrice)}, ${listingCount} active listings, fair value ${formatPrice(fairValue)}`;

    const output = `ANALYSIS: ${recommendation === 'BUY' ? 'Strong BUY opportunity' : recommendation === 'PASS' ? 'OVERPRICED - PASS' : 'Fair pricing - HOLD'}

PRICING:
• Listed: ${formatPrice(listedPrice)}
• Fair Value: ${formatPrice(fairValue)} (based on ${listingCount} listings)
• ${discount > 0 ? 'Discount' : 'Premium'}: ${calculateDiscount(listedPrice, fairValue)} market

LIQUIDITY:
• Market Depth: ${listingCount} active listings
• Liquidity Grade: ${liquidityGrade}

RECOMMENDATION: ${recommendation}
Reasoning: ${discount > 10 ? `Significant ${Math.abs(discount).toFixed(1)}% discount with proven market depth. Good arbitrage opportunity.` : discount < -15 ? `Listed ${Math.abs(discount).toFixed(1)}% above fair value. Overpriced.` : 'Pricing aligned with market average. Hold or pass.'}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'arbitrage_detection',
      metadata: {
        cardName: row.cardName,
        setName: row.setName,
        sources: [row.source],
        priceRange: getPriceRange(listedPrice),
      },
    });

    processed++;
    if (processed % 5000 === 0) {
      console.log(`  ✓ Generated ${processed} arbitrage examples...`);
    }

    if (examples.length >= 50000) break;
  }

  console.log(`✅ Category 1 complete: ${examples.length} examples`);
  return examples;
}

async function extractCategory2_Liquidity(): Promise<TrainingExample[]> {
  console.log('\n📈 Extracting Category 2: Liquidity Analysis (target: 50,000)');
  console.log('─'.repeat(80));

  // Get cards with varying market depths
  const liquidityData = await prisma.$queryRaw<any[]>`
    WITH card_liquidity AS (
      SELECT
        "cardName",
        "setName",
        "priceCents",
        source,
        COUNT(*) OVER (PARTITION BY "cardName", "setName") as market_depth,
        AVG("priceCents") OVER (PARTITION BY "cardName", "setName") as avg_price,
        ROW_NUMBER() OVER (PARTITION BY "cardName", "setName" ORDER BY "updatedAt" DESC) as rn
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "setName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "dataQuality" >= 0.5
    )
    SELECT * FROM card_liquidity
    WHERE rn <= 2
    ORDER BY RANDOM()
    LIMIT 50000
  `;

  const examples: TrainingExample[] = [];

  for (const row of liquidityData) {
    const marketDepth = Number(row.market_depth);
    const avgPrice = Number(row.avg_price);
    const liquidityGrade = getLiquidityGrade(marketDepth);

    // Estimate days to clear based on market depth
    const daysToCllear = marketDepth <= 5 ? '3-7' :
                        marketDepth <= 20 ? '7-14' :
                        marketDepth <= 50 ? '14-30' :
                        marketDepth <= 100 ? '30-60' : '60+';

    const salesVelocity = marketDepth <= 5 ? '0.2-0.5/day' :
                         marketDepth <= 20 ? '0.5-1/day' :
                         marketDepth <= 50 ? '1-2/day' :
                         marketDepth <= 100 ? '2-4/day' : '4+/day';

    const instruction = `Assess liquidity: ${row.cardName} - ${row.setName}. Market depth: ${marketDepth} listings, avg price ${formatPrice(avgPrice)}`;

    const output = `LIQUIDITY ANALYSIS:

MARKET DEPTH:
• Active Listings: ${marketDepth}
• Average Price: ${formatPrice(avgPrice)}
• Liquidity Grade: ${liquidityGrade}

VELOCITY ESTIMATE:
• Expected Sales: ${salesVelocity}
• Time to Clear: ${daysToCllear} days
• Market Activity: ${liquidityGrade === 'A' || liquidityGrade === 'B' ? 'High' : liquidityGrade === 'C' ? 'Moderate' : 'Low'}

LIQUIDITY ASSESSMENT: ${liquidityGrade === 'A' || liquidityGrade === 'B' ? 'EXCELLENT - High turnover expected' : liquidityGrade === 'C' ? 'GOOD - Moderate turnover' : liquidityGrade === 'D' ? 'FAIR - Slower movement' : 'POOR - May be difficult to sell'}
Trading Recommendation: ${liquidityGrade === 'A' || liquidityGrade === 'B' ? 'Safe to buy if priced well' : liquidityGrade === 'C' ? 'Acceptable for short-term holds' : 'Only buy at significant discount'}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'liquidity_analysis',
      metadata: {
        cardName: row.cardName,
        setName: row.setName,
        priceRange: getPriceRange(avgPrice),
      },
    });

    if (examples.length % 5000 === 0) {
      console.log(`  ✓ Generated ${examples.length} liquidity examples...`);
    }
  }

  console.log(`✅ Category 2 complete: ${examples.length} examples`);
  return examples;
}

async function extractCategory3_PriceTrends(): Promise<TrainingExample[]> {
  console.log('\n📉 Extracting Category 3: Price Trend Analysis (target: 50,000)');
  console.log('─'.repeat(80));
  console.log('⚠️  Note: Limited data available without sold history');

  // Use creation date as proxy for time-series (limited without sold data)
  const trendData = await prisma.$queryRaw<any[]>`
    WITH card_trends AS (
      SELECT
        "cardName",
        "setName",
        "priceCents",
        "createdAt",
        "updatedAt",
        ROW_NUMBER() OVER (PARTITION BY "cardName", "setName" ORDER BY "updatedAt" DESC) as rn,
        COUNT(*) OVER (PARTITION BY "cardName", "setName") as sample_size,
        AVG("priceCents") OVER (PARTITION BY "cardName", "setName") as avg_price
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "setName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "dataQuality" >= 0.5
    )
    SELECT * FROM card_trends
    WHERE rn = 1 AND sample_size >= 2
    ORDER BY RANDOM()
    LIMIT 50000
  `;

  const examples: TrainingExample[] = [];

  for (const row of trendData) {
    const currentPrice = Number(row.priceCents);
    const avgPrice = Number(row.avg_price);
    const sampleSize = Number(row.sample_size);

    // Simulate trend based on price variance
    const variance = ((currentPrice - avgPrice) / avgPrice) * 100;
    const trend = variance > 5 ? 'RISING' : variance < -5 ? 'FALLING' : 'STABLE';
    const momentum = Math.abs(variance) > 15 ? 'Strong' : Math.abs(variance) > 5 ? 'Moderate' : 'Weak';

    const instruction = `Analyze price trend: ${row.cardName} - ${row.setName}. Current ${formatPrice(currentPrice)}, ${sampleSize} data points`;

    const output = `PRICE TREND ANALYSIS:

CURRENT STATE:
• Latest Price: ${formatPrice(currentPrice)}
• 30-Day Average: ${formatPrice(avgPrice)}
• Sample Size: ${sampleSize} listings

TREND DIRECTION: ${trend}
• Momentum: ${momentum}
• Change: ${variance > 0 ? '+' : ''}${variance.toFixed(1)}%
• Pattern: ${trend === 'RISING' ? 'Upward trajectory' : trend === 'FALLING' ? 'Downward trajectory' : 'Sideways movement'}

FORECAST:
• Short-term (7-14 days): ${trend === 'RISING' ? 'Continued growth likely' : trend === 'FALLING' ? 'Further decline possible' : 'Range-bound trading expected'}
• Trading Strategy: ${trend === 'RISING' ? 'Consider buying before further appreciation' : trend === 'FALLING' ? 'Wait for stabilization before buying' : 'Buy on dips, sell on spikes'}
• Risk Level: ${Math.abs(variance) > 15 ? 'HIGH' : Math.abs(variance) > 5 ? 'MODERATE' : 'LOW'}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'price_trends',
      metadata: {
        cardName: row.cardName,
        setName: row.setName,
        priceRange: getPriceRange(currentPrice),
      },
    });

    if (examples.length % 5000 === 0) {
      console.log(`  ✓ Generated ${examples.length} trend examples...`);
    }
  }

  console.log(`✅ Category 3 complete: ${examples.length} examples`);
  return examples;
}

async function extractCategory4_MultiSource(): Promise<TrainingExample[]> {
  console.log('\n🔄 Extracting Category 4: Multi-Source Consensus (target: 50,000)');
  console.log('─'.repeat(80));

  // Get cards available on multiple sources
  const multiSourceData = await prisma.$queryRaw<any[]>`
    WITH multi_source_cards AS (
      SELECT
        "cardName",
        "setName",
        json_agg(json_build_object('source', source, 'price', "priceCents")) as source_prices,
        COUNT(DISTINCT source) as source_count,
        AVG("priceCents") as consensus_price,
        MIN("priceCents") as min_price,
        MAX("priceCents") as max_price
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "setName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "dataQuality" >= 0.5
      GROUP BY "cardName", "setName"
      HAVING COUNT(DISTINCT source) >= 1
    )
    SELECT * FROM multi_source_cards
    ORDER BY RANDOM()
    LIMIT 50000
  `;

  const examples: TrainingExample[] = [];

  for (const row of multiSourceData) {
    const sources = JSON.parse(JSON.stringify(row.source_prices));
    const consensusPrice = Number(row.consensus_price);
    const minPrice = Number(row.min_price);
    const maxPrice = Number(row.max_price);
    const spread = ((maxPrice - minPrice) / minPrice) * 100;
    const sourceCount = Number(row.source_count);

    const sourceList = sources
      .map((s: any) => `${s.source}: ${formatPrice(s.price)}`)
      .join(', ');

    const instruction = `Determine fair value: ${row.cardName} - ${row.setName}. Prices: ${sourceList}`;

    const output = `MULTI-SOURCE CONSENSUS:

SOURCE COMPARISON:
${sources.map((s: any) => `• ${s.source}: ${formatPrice(s.price)}`).join('\n')}

PRICE ANALYSIS:
• Fair Market Value: ${formatPrice(consensusPrice)}
• Price Range: ${formatPrice(minPrice)} - ${formatPrice(maxPrice)}
• Spread: ${spread.toFixed(1)}%
• Source Agreement: ${sourceCount} source${sourceCount > 1 ? 's' : ''}

CONSENSUS ASSESSMENT:
• Market Efficiency: ${spread < 10 ? 'HIGH - Tight pricing across sources' : spread < 25 ? 'MODERATE - Some arbitrage potential' : 'LOW - Significant price gaps'}
• Best Buy: ${sources.reduce((min: any, s: any) => s.price < min.price ? s : min).source} at ${formatPrice(minPrice)}
• Arbitrage Potential: ${spread > 20 ? 'STRONG - Consider buying low, selling high' : spread > 10 ? 'MODERATE - Small profit opportunity' : 'WEAK - Prices well aligned'}
• Confidence Level: ${sourceCount >= 3 ? 'HIGH' : sourceCount === 2 ? 'MODERATE' : 'LOW'}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'multi_source_consensus',
      metadata: {
        cardName: row.cardName,
        setName: row.setName,
        sources: sources.map((s: any) => s.source),
        priceRange: getPriceRange(consensusPrice),
      },
    });

    if (examples.length % 5000 === 0) {
      console.log(`  ✓ Generated ${examples.length} multi-source examples...`);
    }
  }

  console.log(`✅ Category 4 complete: ${examples.length} examples`);
  return examples;
}

async function extractCategory5_Condition(): Promise<TrainingExample[]> {
  console.log('\n⭐ Extracting Category 5: Condition/Grade Adjustments (target: 50,000)');
  console.log('─'.repeat(80));

  // Get cards with grade/condition information
  const conditionData = await prisma.$queryRaw<any[]>`
    SELECT
      "cardName",
      "setName",
      "grade",
      "gradeCompany",
      "condition",
      "priceCents",
      source
    FROM "UnifiedMarketListing"
    WHERE
      "cardName" IS NOT NULL
      AND "setName" IS NOT NULL
      AND "priceCents" IS NOT NULL
      AND "priceCents" > 0
      AND ("grade" IS NOT NULL OR "condition" IS NOT NULL)
      AND "dataQuality" >= 0.5
    ORDER BY RANDOM()
    LIMIT 50000
  `;

  const examples: TrainingExample[] = [];

  for (const row of conditionData) {
    const price = Number(row.priceCents);
    const grade = row.grade ? Number(row.grade) : null;
    const gradeCompany = row.gradeCompany || 'Unknown';
    const condition = row.condition || 'Unspecified';

    // Estimate premium based on grade
    let premium = 'N/A';
    let premiumPct = 0;
    if (grade) {
      if (grade >= 10) premiumPct = 300; // PSA 10: 3x premium
      else if (grade >= 9) premiumPct = 150; // PSA 9: 1.5x premium
      else if (grade >= 8) premiumPct = 80; // PSA 8: 80% premium
      else premiumPct = 30; // Lower grades: 30% premium
      premium = `${premiumPct}%`;
    }

    const basePrice = grade ? price / (1 + premiumPct / 100) : price;
    const gradeInfo = grade ? `${gradeCompany} ${grade}` : condition;

    const instruction = `Evaluate: ${row.cardName} - ${row.setName}. Condition: ${gradeInfo}, Price: ${formatPrice(price)}`;

    const output = `CONDITION ANALYSIS:

CARD DETAILS:
• Condition: ${gradeInfo}
• Listed Price: ${formatPrice(price)}
${grade ? `• Estimated Base Price: ${formatPrice(basePrice)}\n• Grade Premium: ~${premium}` : `• Condition: ${condition}`}

GRADE IMPACT:
${grade ? `• ${gradeCompany} ${grade} grade carries ~${premium} premium over raw
• ${grade >= 10 ? 'GEM MINT - Highest premium tier' : grade >= 9 ? 'MINT - Strong premium' : grade >= 8 ? 'Near Mint - Moderate premium' : 'Below Mint - Limited premium'}
• Market typically values ${gradeCompany} ${grade} at ${premiumPct}% above ungraded` : `• Ungraded card in ${condition} condition
• Limited premium over base pricing
• Consider grading if card is valuable and in excellent condition`}

RECOMMENDATION:
${grade && grade >= 9 ? 'Premium pricing justified by high grade. Fair value for serious collectors.' : grade && grade >= 7 ? 'Moderate premium appropriate. Good option for graded collection.' : 'Standard pricing for condition. Consider raw alternatives if budget-conscious.'}
Value Assessment: ${grade && grade >= 9 ? 'PREMIUM' : grade ? 'FAIR' : 'STANDARD'}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'condition_grade',
      metadata: {
        cardName: row.cardName,
        setName: row.setName,
        priceRange: getPriceRange(price),
      },
    });

    if (examples.length % 5000 === 0) {
      console.log(`  ✓ Generated ${examples.length} condition examples...`);
    }
  }

  console.log(`✅ Category 5 complete: ${examples.length} examples`);
  return examples;
}

async function main() {
  console.log('🚀 MEW-1A V2 TRAINING DATA EXTRACTION');
  console.log('═'.repeat(80));
  console.log('Target: 250,000 high-quality instruction-tuning examples');
  console.log('Format: JSONL for HuggingFace Datasets');
  console.log('═'.repeat(80));

  const allExamples: TrainingExample[] = [];

  // Extract all categories
  const cat1 = await extractCategory1_Arbitrage();
  allExamples.push(...cat1);

  const cat2 = await extractCategory2_Liquidity();
  allExamples.push(...cat2);

  const cat3 = await extractCategory3_PriceTrends();
  allExamples.push(...cat3);

  const cat4 = await extractCategory4_MultiSource();
  allExamples.push(...cat4);

  const cat5 = await extractCategory5_Condition();
  allExamples.push(...cat5);

  console.log('\n📦 Preparing final dataset...');
  console.log('─'.repeat(80));

  // Shuffle examples for better training
  const shuffled = allExamples.sort(() => Math.random() - 0.5);

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'data', 'training');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to JSONL file
  const outputPath = path.join(outputDir, 'mew1a-v2-training-data.jsonl');
  const writeStream = fs.createWriteStream(outputPath);

  for (const example of shuffled) {
    writeStream.write(JSON.stringify(example) + '\n');
  }

  // Wait for write stream to finish
  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on('error', reject);
  });

  // Generate summary statistics
  const categoryCounts = {
    arbitrage_detection: shuffled.filter(e => e.category === 'arbitrage_detection').length,
    liquidity_analysis: shuffled.filter(e => e.category === 'liquidity_analysis').length,
    price_trends: shuffled.filter(e => e.category === 'price_trends').length,
    multi_source_consensus: shuffled.filter(e => e.category === 'multi_source_consensus').length,
    condition_grade: shuffled.filter(e => e.category === 'condition_grade').length,
  };

  const priceRangeCounts = {
    budget: shuffled.filter(e => e.metadata?.priceRange === 'budget').length,
    low: shuffled.filter(e => e.metadata?.priceRange === 'low').length,
    mid: shuffled.filter(e => e.metadata?.priceRange === 'mid').length,
    high: shuffled.filter(e => e.metadata?.priceRange === 'high').length,
    premium: shuffled.filter(e => e.metadata?.priceRange === 'premium').length,
  };

  console.log('\n✅ EXTRACTION COMPLETE!');
  console.log('═'.repeat(80));
  console.log(`Total Examples: ${shuffled.length.toLocaleString()}`);
  console.log(`Output File: ${outputPath}`);
  console.log(`File Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('📊 Category Distribution:');
  console.table(categoryCounts);
  console.log('');
  console.log('💰 Price Range Distribution:');
  console.table(priceRangeCounts);
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('  1. Review sample examples for quality');
  console.log('  2. Upload to HuggingFace: python scripts/mew1a-upload-dataset-v2.py');
  console.log('  3. Launch training: bash scripts/mew1a-retrain-v2.sh');
  console.log('');
  console.log('═'.repeat(80));
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
