/**
 * Extract Test Data for Mew-1A Evaluation Framework
 *
 * Generates 2,200 test examples for evaluation:
 * - 1,000 historical deals (pricing accuracy)
 * - 500 card facts (knowledge)
 * - 500 BUY/PASS scenarios (decision quality)
 * - 200 market trends (prediction accuracy)
 *
 * Usage:
 *   pnpm tsx scripts/extract_test_data.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const OUTPUT_DIR = path.join(__dirname, '../apps/mew1a/evaluation/test_data');

interface HistoricalDeal {
  card_name: string;
  sold_price: number;
  sold_date: string;
}

interface CardKnowledge {
  card_name: string;
  question_type: 'rarity' | 'type' | 'hp' | 'set' | 'card_number' | 'attack' | 'weakness';
  correct_answer: string;
  distractors: string[];
}

interface BuyPassScenario {
  card_name: string;
  listed_price: number;
  fair_value: number;
  discount_pct: number;
  trend: 'up' | 'down' | 'stable' | 'volatile';
  correct_decision: 'BUY' | 'PASS';
  reasoning: string;
}

interface MarketTrend {
  card_name: string;
  current_price: number;
  price_30d_ago: number;
  actual_price_30d_later: number;
  prediction_date: string;
  outcome_date: string;
}

/**
 * Extract 1,000 historical deals for pricing accuracy evaluation
 */
async function extractHistoricalDeals(): Promise<HistoricalDeal[]> {
  console.log('\n📊 Extracting historical deals (1,000 examples)...');

  const deals = await prisma.$queryRaw<any[]>`
    SELECT
      "cardName" as card_name,
      "soldPriceCents"::float / 100 as sold_price,
      "soldAt"::text as sold_date
    FROM sale_records
    WHERE
      "soldPriceCents" IS NOT NULL
      AND "soldPriceCents" > 0
      AND "soldAt" >= NOW() - INTERVAL '90 days'
      AND "cardName" IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 1000
  `;

  console.log(`  ✅ Extracted ${deals.length} historical deals`);

  return deals.map(deal => ({
    card_name: deal.card_name,
    sold_price: parseFloat(deal.sold_price),
    sold_date: deal.sold_date.split('T')[0], // Format as YYYY-MM-DD
  }));
}

/**
 * Extract 500 card facts for knowledge evaluation
 */
async function extractCardKnowledge(): Promise<CardKnowledge[]> {
  console.log('\n📚 Extracting card knowledge (500 examples)...');

  // Get 500 random cards with complete metadata
  const cards = await prisma.$queryRaw<any[]>`
    SELECT
      "canonicalName" as name,
      rarity,
      types[1] as type,
      hp,
      "canonicalSet" as set_name,
      "cardNumber" as card_number
    FROM canonical_cards
    WHERE
      rarity IS NOT NULL
      AND types IS NOT NULL
      AND "canonicalSet" IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 500
  `;

  console.log(`  ✅ Extracted ${cards.length} card facts`);

  // Generate questions for each card
  const knowledge: CardKnowledge[] = [];

  for (const card of cards) {
    // Randomly choose a question type
    const questionTypes: Array<'rarity' | 'type' | 'hp' | 'set' | 'card_number'> = [
      'rarity',
      'type',
      'hp',
      'set',
      'card_number',
    ];

    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

    let correctAnswer = '';
    let distractors: string[] = [];

    switch (questionType) {
      case 'rarity':
        correctAnswer = card.rarity;
        distractors = ['Common', 'Uncommon', 'Rare Holo', 'Ultra Rare', 'Secret Rare']
          .filter(r => r !== correctAnswer)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        break;

      case 'type':
        correctAnswer = card.type;
        distractors = ['Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Colorless']
          .filter(t => t !== correctAnswer)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        break;

      case 'hp':
        if (card.hp) {
          correctAnswer = card.hp.toString();
          const hp = parseInt(card.hp);
          distractors = [
            (hp - 20).toString(),
            (hp + 20).toString(),
            (hp + 40).toString(),
          ];
        } else {
          continue; // Skip if no HP
        }
        break;

      case 'set':
        correctAnswer = card.set_name;
        distractors = ['Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Neo Genesis', 'Sword & Shield']
          .filter(s => s !== correctAnswer)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        break;

      case 'card_number':
        if (card.card_number) {
          correctAnswer = card.card_number;
          // Generate plausible distractors
          const match = card.card_number.match(/(\d+)\/(\d+)/);
          if (match) {
            const num = parseInt(match[1]);
            const total = parseInt(match[2]);
            distractors = [
              `${num - 1}/${total}`,
              `${num + 1}/${total}`,
              `${num + 5}/${total}`,
            ];
          } else {
            continue; // Skip if format is unexpected
          }
        } else {
          continue; // Skip if no card number
        }
        break;
    }

    if (distractors.length === 3) {
      knowledge.push({
        card_name: card.name,
        question_type: questionType,
        correct_answer: correctAnswer,
        distractors,
      });
    }
  }

  console.log(`  ✅ Generated ${knowledge.length} knowledge questions`);

  return knowledge.slice(0, 500); // Ensure exactly 500
}

/**
 * Extract 500 BUY/PASS scenarios for decision evaluation
 */
async function extractBuyPassScenarios(): Promise<BuyPassScenario[]> {
  console.log('\n🎯 Extracting BUY/PASS scenarios (500 examples)...');

  // Get recent arbitrage opportunities and current listings
  const scenarios = await prisma.$queryRaw<any[]>`
    WITH recent_prices AS (
      SELECT
        sr."cardName",
        AVG(sr."soldPriceCents"::float / 100) as fair_value,
        STDDEV(sr."soldPriceCents"::float / 100) as price_stddev,
        COUNT(*) as sale_count
      FROM sale_records sr
      WHERE
        sr."soldAt" >= NOW() - INTERVAL '30 days'
        AND sr."soldPriceCents" IS NOT NULL
        AND sr."soldPriceCents" > 0
      GROUP BY sr."cardName"
      HAVING COUNT(*) >= 3
    ),
    price_trends AS (
      SELECT
        sr."cardName",
        CASE
          WHEN AVG(CASE WHEN sr."soldAt" >= NOW() - INTERVAL '7 days' THEN sr."soldPriceCents"::float / 100 END) >
               AVG(CASE WHEN sr."soldAt" < NOW() - INTERVAL '7 days' THEN sr."soldPriceCents"::float / 100 END) * 1.05
          THEN 'up'
          WHEN AVG(CASE WHEN sr."soldAt" >= NOW() - INTERVAL '7 days' THEN sr."soldPriceCents"::float / 100 END) <
               AVG(CASE WHEN sr."soldAt" < NOW() - INTERVAL '7 days' THEN sr."soldPriceCents"::float / 100 END) * 0.95
          THEN 'down'
          ELSE 'stable'
        END as trend
      FROM sale_records sr
      WHERE
        sr."soldAt" >= NOW() - INTERVAL '30 days'
        AND sr."soldPriceCents" IS NOT NULL
      GROUP BY sr."cardName"
    ),
    current_listings AS (
      SELECT DISTINCT ON (ml."cardName")
        ml."cardName",
        ml."priceCents"::float / 100 as listed_price
      FROM market_listings ml
      WHERE
        ml."priceCents" IS NOT NULL
        AND ml."priceCents" > 0
        AND ml."isActive" = true
      ORDER BY ml."cardName", ml."lastSeenAt" DESC
    )
    SELECT
      cl."cardName" as card_name,
      cl.listed_price,
      rp.fair_value,
      ((rp.fair_value - cl.listed_price) / rp.fair_value * 100) as discount_pct,
      COALESCE(pt.trend, 'stable') as trend
    FROM current_listings cl
    JOIN recent_prices rp ON cl."cardName" = rp."cardName"
    LEFT JOIN price_trends pt ON cl."cardName" = pt."cardName"
    WHERE
      cl.listed_price > 0
      AND rp.fair_value > 0
      AND ABS(cl.listed_price - rp.fair_value) / rp.fair_value < 0.5  -- Within 50% range
    ORDER BY RANDOM()
    LIMIT 500
  `;

  console.log(`  ✅ Extracted ${scenarios.length} BUY/PASS scenarios`);

  return scenarios.map(scenario => {
    const discountPct = parseFloat(scenario.discount_pct);
    const trend = scenario.trend as 'up' | 'down' | 'stable';

    // Decision logic (matches training data)
    let correctDecision: 'BUY' | 'PASS';
    let reasoning: string;

    if (discountPct >= 20 && trend === 'up') {
      correctDecision = 'BUY';
      reasoning = `Strong buy: ${discountPct.toFixed(1)}% discount with upward trend`;
    } else if (discountPct >= 10 && (trend === 'up' || trend === 'stable')) {
      correctDecision = 'BUY';
      reasoning = `Good buy: ${discountPct.toFixed(1)}% discount with favorable trend`;
    } else if (discountPct >= 5 && trend === 'up') {
      correctDecision = 'BUY';
      reasoning = `Marginal buy: ${discountPct.toFixed(1)}% discount with upward momentum`;
    } else if (discountPct < -10) {
      correctDecision = 'PASS';
      reasoning = `Overpriced: ${Math.abs(discountPct).toFixed(1)}% premium`;
    } else if (trend === 'down') {
      correctDecision = 'PASS';
      reasoning = `Trending down: avoid catching falling knife`;
    } else {
      correctDecision = 'PASS';
      reasoning = `Fair price but no compelling upside`;
    }

    return {
      card_name: scenario.card_name,
      listed_price: parseFloat(scenario.listed_price),
      fair_value: parseFloat(scenario.fair_value),
      discount_pct: discountPct,
      trend,
      correct_decision: correctDecision,
      reasoning,
    };
  });
}

/**
 * Extract 200 market trends for prediction evaluation
 */
async function extractMarketTrends(): Promise<MarketTrend[]> {
  console.log('\n📈 Extracting market trends (200 examples)...');

  // Get historical price data with 60-day windows
  const trends = await prisma.$queryRaw<any[]>`
    WITH price_points AS (
      SELECT
        "cardName",
        "soldPriceCents"::float / 100 as sold_price,
        "soldAt" as sold_date,
        LAG("soldPriceCents"::float / 100, 30) OVER (PARTITION BY "cardName" ORDER BY "soldAt") as price_30d_ago,
        LEAD("soldPriceCents"::float / 100, 30) OVER (PARTITION BY "cardName" ORDER BY "soldAt") as price_30d_later
      FROM sale_records
      WHERE
        "soldPriceCents" IS NOT NULL
        AND "soldPriceCents" > 0
        AND "soldAt" >= NOW() - INTERVAL '120 days'
    )
    SELECT
      "cardName" as card_name,
      sold_price as current_price,
      price_30d_ago,
      price_30d_later as actual_price_30d_later,
      sold_date::text as prediction_date,
      (sold_date + INTERVAL '30 days')::text as outcome_date
    FROM price_points
    WHERE
      price_30d_ago IS NOT NULL
      AND price_30d_later IS NOT NULL
      AND price_30d_ago > 0
      AND price_30d_later > 0
    ORDER BY RANDOM()
    LIMIT 200
  `;

  console.log(`  ✅ Extracted ${trends.length} market trends`);

  return trends.map(trend => ({
    card_name: trend.card_name,
    current_price: parseFloat(trend.current_price),
    price_30d_ago: parseFloat(trend.price_30d_ago),
    actual_price_30d_later: parseFloat(trend.actual_price_30d_later),
    prediction_date: trend.prediction_date.split('T')[0],
    outcome_date: trend.outcome_date.split('T')[0],
  }));
}

/**
 * Save data to JSON files
 */
function saveTestData(filename: string, data: any[]): void {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  💾 Saved ${data.length} examples to ${filename}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Extracting Test Data for Mew-1A Evaluation Framework');
  console.log('=' .repeat(70));

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  try {
    // Extract all datasets
    const [historicalDeals, cardKnowledge, buyPassScenarios, marketTrends] = await Promise.all([
      extractHistoricalDeals(),
      extractCardKnowledge(),
      extractBuyPassScenarios(),
      extractMarketTrends(),
    ]);

    // Save to files
    console.log('\n💾 Saving test data...');
    saveTestData('historical_deals_1000.json', historicalDeals);
    saveTestData('card_knowledge_500.json', cardKnowledge);
    saveTestData('buy_pass_scenarios_500.json', buyPassScenarios);
    saveTestData('market_trends_200.json', marketTrends);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ Test Data Extraction Complete!');
    console.log('='.repeat(70));
    console.log(`📊 Historical Deals:    ${historicalDeals.length.toString().padStart(4)} examples`);
    console.log(`📚 Card Knowledge:      ${cardKnowledge.length.toString().padStart(4)} examples`);
    console.log(`🎯 BUY/PASS Scenarios:  ${buyPassScenarios.length.toString().padStart(4)} examples`);
    console.log(`📈 Market Trends:       ${marketTrends.length.toString().padStart(4)} examples`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`📦 Total:               ${(historicalDeals.length + cardKnowledge.length + buyPassScenarios.length + marketTrends.length).toString().padStart(4)} examples`);
    console.log('='.repeat(70));
    console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
    console.log('\n🎯 Next step: Run evaluation using apps/mew1a/evaluation/');

  } catch (error) {
    console.error('\n❌ Error extracting test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
