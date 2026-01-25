/**
 * PROJECT MEW-1A: Plutus Knowledge Distillation
 *
 * Extract financial analysis expertise from Plutus (8B model) into
 * training data for our smaller, faster Mew-1A model (3B).
 *
 * Strategy:
 * 1. Feed Plutus 1000+ real TCG market scenarios
 * 2. Capture its responses (sentiment, analysis, recommendations)
 * 3. Use as training data for Mew-1A
 * 4. Result: 3B model with 8B model's knowledge!
 */

import prisma from '../api/src/lib/prisma.js';
import { writeFileSync, appendFileSync } from 'fs';

interface PlutusResponse {
  cardName: string;
  scenario: string;
  response: string;
  timestamp: string;
}

// Ollama client
async function callPlutus(prompt: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: '0xroyce/plutus',
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 400,
      },
    }),
  });

  const data: any = await response.json();
  return data.response || '';
}

async function distillPlutus() {
  console.log('🧬 PROJECT MEW-1A: Plutus Knowledge Distillation');
  console.log('=' .repeat(60));
  console.log('');
  console.log('🎯 Goal: Extract 1000+ expert analyses from Plutus');
  console.log('📊 Target: Train Mew-1A with Plutus financial expertise');
  console.log('');

  // Get diverse card scenarios
  console.log('📋 Step 1: Selecting diverse TCG scenarios...');

  const scenarios = await prisma.$queryRaw<Array<{
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
    GROUP BY "cardName", "setName", "gradeCompany", "grade"
    HAVING COUNT(*) >= 3
    ORDER BY RANDOM()
    LIMIT 200
  `;

  console.log(`   Selected ${scenarios.length} unique card scenarios`);
  console.log('');

  console.log('🤖 Step 2: Querying Plutus for expert analysis...');
  console.log('   (This will take ~30-60 minutes for 200 scenarios)');
  console.log('');

  const distillationData: any[] = [];
  const outputPath = '/Users/arcadio/dev/pokedao/data/mew1a-plutus-distillation.jsonl';

  // Clear file
  writeFileSync(outputPath, '');

  let processed = 0;

  for (const scenario of scenarios) {
    // Get listings for this card
    const listings = await prisma.unifiedMarketListing.findMany({
      where: {
        cardName: scenario.cardName,
        setName: scenario.setName || undefined,
        gradeCompany: scenario.gradeCompany || undefined,
        grade: scenario.grade || undefined,
        priceCents: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (listings.length < 3) continue;

    // Calculate metrics
    const prices = listings.map(l => l.priceCents / 100);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const recent = listings.filter(l =>
      l.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    const cardDesc = `${scenario.cardName}${scenario.setName ? ` - ${scenario.setName}` : ''}${scenario.gradeCompany ? ` ${scenario.gradeCompany}` : ''}${scenario.grade ? ` ${scenario.grade}` : ''}`;

    // Create 3 different prompts for variety
    const prompts = [
      // Prompt 1: Pricing Analysis
      `Analyze this Pokemon TCG investment:

CARD: ${cardDesc}
CURRENT LISTING: $${listings[0].priceCents / 100}
MARKET DATA:
- Average Price: $${avgPrice.toFixed(2)}
- Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}
- Recent Sales: ${recent.length} in last 30 days
- Total Comps: ${listings.length}

Provide: 1) SENTIMENT (bullish/neutral/bearish), 2) KEY INSIGHTS (3 bullets), 3) RECOMMENDATION`,

      // Prompt 2: Risk Analysis
      `As a quantitative analyst, evaluate this TCG asset:

ASSET: ${cardDesc}
ENTRY PRICE: $${listings[0].priceCents / 100}
FAIR VALUE: $${avgPrice.toFixed(2)}
LIQUIDITY: ${recent.length} sales/30d

What are the top 3 RISKS and top 2 CATALYSTS for this investment?`,

      // Prompt 3: Market Sentiment
      `Quick market sentiment check for traders:

${cardDesc} @ $${listings[0].priceCents / 100}
30-day avg: $${avgPrice.toFixed(2)}
Volume: ${recent.length} sales

Give a one-sentence trading thesis and confidence level (0-100).`,
    ];

    for (const [idx, prompt] of prompts.entries()) {
      try {
        console.log(`   [${processed + 1}/${scenarios.length * 3}] Querying Plutus: ${cardDesc} (variant ${idx + 1}/3)...`);

        const startTime = Date.now();
        const response = await callPlutus(prompt);
        const responseTime = Date.now() - startTime;

        const example = {
          instruction: "You are a TCG market analyst trained on financial analysis.",
          input: prompt,
          output: response,
          metadata: {
            cardName: scenario.cardName,
            setName: scenario.setName,
            gradeCompany: scenario.gradeCompany,
            grade: scenario.grade,
            avgPrice,
            recentSales: recent.length,
            totalComps: listings.length,
            source: 'plutus-distillation',
            responseTime,
            timestamp: new Date().toISOString(),
          },
        };

        // Append to file immediately (in case of crash)
        appendFileSync(outputPath, JSON.stringify(example) + '\n');
        distillationData.push(example);

        console.log(`      ✓ Response: ${response.slice(0, 100)}... (${responseTime}ms)`);

        processed++;

        // Rate limiting: Wait 2 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`      ✗ Error: ${error}`);
        continue;
      }
    }

    // Save checkpoint every 10 cards
    if ((processed / 3) % 10 === 0) {
      console.log('');
      console.log(`📊 Progress: ${processed}/${scenarios.length * 3} examples generated`);
      console.log(`💾 Checkpoint saved to: ${outputPath}`);
      console.log('');
    }
  }

  console.log('');
  console.log('✅ Distillation Complete!');
  console.log('=' .repeat(60));
  console.log('');
  console.log('📈 Statistics:');
  console.log(`   Total Examples: ${distillationData.length}`);
  console.log(`   Unique Cards: ${scenarios.length}`);
  console.log(`   Prompt Variants: 3 per card`);
  console.log(`   Output File: ${outputPath}`);
  console.log(`   File Size: ${(require('fs').statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('   1. Combine with real market data (mew1a-extract-training-data.ts)');
  console.log('   2. Upload combined dataset to HuggingFace');
  console.log('   3. Fine-tune Llama-3.2-3B → Project Mew-1A');
  console.log('   4. Deploy & benchmark against Plutus');
  console.log('');
  console.log('🔬 Expected Outcome:');
  console.log('   - Mew-1A (3B params): 10x faster than Plutus (8B)');
  console.log('   - Retains 90%+ of Plutus financial expertise');
  console.log('   - Specialized in TCG pricing (better than Plutus!)');

  await prisma.$disconnect();
}

distillPlutus().catch(console.error);
