/**
 * PROJECT MEW-1A: Training Data Extraction Pipeline
 *
 * Extracts high-quality TCG market analysis examples from 400k+ listings
 * for fine-tuning a custom TCG pricing AI model.
 *
 * Strategy:
 * 1. Select cards with 5+ comparable sales (high confidence)
 * 2. Calculate market metrics (fair value, trends, liquidity)
 * 3. Generate training examples in instruction format
 * 4. Export to JSONL for HuggingFace fine-tuning
 */

import prisma from '../api/src/lib/prisma.js';
import { writeFileSync } from 'fs';

// Training example format for instruction-tuned models
interface TrainingExample {
  instruction: string;
  input: string;
  output: string;
}

interface CardAnalysis {
  cardName: string;
  setName?: string;
  grade?: string;
  gradeCompany?: string;
  listedPrice: number;
  fairValue: number;
  discount: number;
  salesCount: number;
  avgVolume30d: number;
  priceChange7d: number;
  priceChange30d: number;
  lowestAvailable: number;
  sources: string[];
  recommendation: string;
  conviction: number;
}

async function extractTrainingData() {
  console.log('🧬 PROJECT MEW-1A: Training Data Extraction');
  console.log('=' .repeat(60));
  console.log('');

  // Step 1: Find cards with sufficient comparable sales
  console.log('📊 Step 1: Identifying high-quality training candidates...');

  const cardGroups = await prisma.$queryRaw<Array<{
    cardName: string;
    setName: string | null;
    gradeCompany: string | null;
    grade: string | null;
    count: bigint;
  }>>`
    SELECT
      "cardName",
      "setName",
      "gradeCompany",
      "grade",
      COUNT(*) as count
    FROM "UnifiedMarketListing"
    WHERE "cardName" IS NOT NULL
      AND "priceCents" > 0
      AND "createdAt" > NOW() - INTERVAL '90 days'
    GROUP BY "cardName", "setName", "gradeCompany", "grade"
    HAVING COUNT(*) >= 5
    ORDER BY count DESC
    LIMIT 10000
  `;

  console.log(`   Found ${cardGroups.length} card variants with 5+ comps`);
  console.log('');

  // Step 2: Extract training examples
  console.log('🏗️  Step 2: Generating training examples...');
  const trainingExamples: TrainingExample[] = [];
  let processed = 0;

  for (const group of cardGroups.slice(0, 1000)) { // Process top 1000 for now
    const listings = await prisma.unifiedMarketListing.findMany({
      where: {
        cardName: group.cardName,
        setName: group.setName || undefined,
        gradeCompany: group.gradeCompany || undefined,
        grade: group.grade || undefined,
        priceCents: { gt: 0 },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (listings.length < 5) continue;

    // Calculate market metrics
    const prices = listings.map(l => l.priceCents / 100).sort((a, b) => a - b);
    const trimCount = Math.floor(prices.length * 0.1);
    const trimmedPrices = prices.slice(trimCount, prices.length - trimCount);
    const fairValue = trimmedPrices.reduce((sum, p) => sum + p, 0) / trimmedPrices.length;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recent30d = listings.filter(l => l.createdAt >= thirtyDaysAgo);
    const recent7d = listings.filter(l => l.createdAt >= sevenDaysAgo);
    const older = listings.filter(l => l.createdAt < sevenDaysAgo);

    const avg7d = recent7d.length > 0
      ? recent7d.reduce((sum, l) => sum + (l.priceCents / 100), 0) / recent7d.length
      : fairValue;
    const avgOlder = older.length > 0
      ? older.reduce((sum, l) => sum + (l.priceCents / 100), 0) / older.length
      : fairValue;

    const priceChange7d = avgOlder > 0 ? ((avg7d - avgOlder) / avgOlder) * 100 : 0;
    const priceChange30d = fairValue > 0 ? ((avg7d - fairValue) / fairValue) * 100 : 0;

    const sources = [...new Set(listings.map(l => l.source))];
    const lowestAvailable = Math.min(...prices);

    // Pick a representative listing for this example
    const sampleListing = listings[Math.floor(listings.length / 2)];
    const listedPrice = sampleListing.priceCents / 100;
    const discount = ((listedPrice - fairValue) / fairValue) * 100;

    // Generate recommendation
    let recommendation = 'HOLD';
    let conviction = 50;

    if (discount < -15 && recent30d.length >= 5) {
      recommendation = 'STRONG_BUY';
      conviction = 85;
    } else if (discount < -10 && recent30d.length >= 3) {
      recommendation = 'BUY';
      conviction = 70;
    } else if (discount > 20) {
      recommendation = 'PASS';
      conviction = 60;
    }

    // Create training example
    const cardDesc = `${group.cardName}${group.setName ? ` - ${group.setName}` : ''}${group.gradeCompany ? ` ${group.gradeCompany}` : ''}${group.grade ? ` ${group.grade}` : ''}`;

    const instruction = "You are a TCG market analyst. Analyze this Pokemon card listing and provide a recommendation.";

    const input = `Card: ${cardDesc}
Listed Price: $${listedPrice.toFixed(2)}
Fair Value: $${fairValue.toFixed(2)} (based on ${listings.length} comps)
Discount: ${discount.toFixed(1)}%
30-Day Volume: ${recent30d.length} sales
7-Day Trend: ${priceChange7d >= 0 ? '+' : ''}${priceChange7d.toFixed(1)}%
30-Day Trend: ${priceChange30d >= 0 ? '+' : ''}${priceChange30d.toFixed(1)}%
Lowest Available: $${lowestAvailable.toFixed(2)}
Sources: ${sources.join(', ')}`;

    const output = `RECOMMENDATION: ${recommendation}
CONVICTION: ${conviction}%
ANALYSIS: ${
  recommendation === 'STRONG_BUY'
    ? `Strong buy opportunity with ${Math.abs(discount).toFixed(1)}% discount to fair value. Good liquidity with ${recent30d.length} sales in 30 days. Price momentum is ${priceChange7d > 0 ? 'positive' : 'negative'} at ${priceChange7d.toFixed(1)}% over 7 days.`
    : recommendation === 'BUY'
    ? `Buy opportunity with ${Math.abs(discount).toFixed(1)}% discount to fair value. Moderate liquidity with ${recent30d.length} sales in 30 days.`
    : recommendation === 'PASS'
    ? `Overpriced by ${discount.toFixed(1)}% relative to fair value of $${fairValue.toFixed(2)}. Better opportunities available.`
    : `Fairly priced near market value. Monitor for price movements. Current 7-day trend: ${priceChange7d >= 0 ? '+' : ''}${priceChange7d.toFixed(1)}%.`
}
FAIR_VALUE: $${fairValue.toFixed(2)}
DISCOUNT: ${discount.toFixed(1)}%
LIQUIDITY_SCORE: ${Math.min(100, (recent30d.length / 10) * 100).toFixed(0)}%`;

    trainingExamples.push({
      instruction,
      input,
      output,
    });

    processed++;
    if (processed % 100 === 0) {
      console.log(`   Processed ${processed} examples...`);
    }
  }

  console.log(`✅ Generated ${trainingExamples.length} training examples`);
  console.log('');

  // Step 3: Export to JSONL
  console.log('💾 Step 3: Exporting to JSONL format...');

  const jsonl = trainingExamples.map(ex => JSON.stringify(ex)).join('\n');
  const outputPath = '/Users/arcadio/dev/pokedao/data/mew1a-training-data.jsonl';

  writeFileSync(outputPath, jsonl);
  console.log(`   Saved to: ${outputPath}`);
  console.log(`   File size: ${(jsonl.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Step 4: Statistics
  console.log('📈 Training Data Statistics:');
  console.log(`   Total Examples: ${trainingExamples.length}`);

  const recommendations = trainingExamples.reduce((acc, ex) => {
    const rec = ex.output.match(/RECOMMENDATION: (\w+)/)?.[1] || 'UNKNOWN';
    acc[rec] = (acc[rec] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(recommendations).forEach(([rec, count]) => {
    console.log(`   ${rec}: ${count} (${((count / trainingExamples.length) * 100).toFixed(1)}%)`);
  });

  console.log('');
  console.log('🎯 Next Steps:');
  console.log('   1. Review training data quality');
  console.log('   2. Upload to HuggingFace Dataset Hub');
  console.log('   3. Fine-tune Llama-3.2-3B model');
  console.log('   4. Deploy as Project Mew-1A');

  await prisma.$disconnect();
}

extractTrainingData().catch(console.error);
