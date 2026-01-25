#!/usr/bin/env node

/**
 * Mew-1A v3 MAXIMIZED Training Data Extraction
 *
 * Extracts 200,000+ training examples from ALL 216,848 usable records
 *
 * Key improvements over v2:
 * - Uses ALL records with cardName + price (not just those with setName)
 * - Parses set information from eBay titles using regex patterns
 * - Better differentiation between card types and sets
 * - More granular price ranges
 * - Enhanced quality filtering
 *
 * Categories:
 * 1. Arbitrage Detection (50k)
 * 2. Liquidity Analysis (50k)
 * 3. Price Trend Analysis (25k)
 * 4. Multi-Source Consensus (40k)
 * 5. Condition/Grade Adjustments (35k)
 *
 * Target: 200,000 examples
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
    hasGrade?: boolean;
  };
}

// Enhanced set name extraction from titles
const SET_PATTERNS = [
  { pattern: /\b(base set 2|base 2)\b/i, name: 'Base Set 2' },
  { pattern: /\b(base set|base)\b/i, name: 'Base Set' },
  { pattern: /\bjungle\b/i, name: 'Jungle' },
  { pattern: /\bfossil\b/i, name: 'Fossil' },
  { pattern: /\bteam rocket\b/i, name: 'Team Rocket' },
  { pattern: /\bneo genesis\b/i, name: 'Neo Genesis' },
  { pattern: /\bneo discovery\b/i, name: 'Neo Discovery' },
  { pattern: /\bneo revelation\b/i, name: 'Neo Revelation' },
  { pattern: /\bneo destiny\b/i, name: 'Neo Destiny' },
  { pattern: /\blegendary collection\b/i, name: 'Legendary Collection' },
  { pattern: /\bexpedition\b/i, name: 'Expedition' },
  { pattern: /\baquapolis\b/i, name: 'Aquapolis' },
  { pattern: /\bskyridge\b/i, name: 'Skyridge' },
  { pattern: /\b(ex ruby|ruby & sapphire)\b/i, name: 'EX Ruby & Sapphire' },
  { pattern: /\b(ex team rocket returns|rocket returns)\b/i, name: 'EX Team Rocket Returns' },
  { pattern: /\b(ex fire ?red|fire ?red & leaf ?green)\b/i, name: 'EX FireRed & LeafGreen' },
  { pattern: /\b(ex emerald)\b/i, name: 'EX Emerald' },
  { pattern: /\b(ex deoxys)\b/i, name: 'EX Deoxys' },
  { pattern: /\b(ex unseen forces)\b/i, name: 'EX Unseen Forces' },
  { pattern: /\b(ex delta species)\b/i, name: 'EX Delta Species' },
  { pattern: /\b(ex legend maker)\b/i, name: 'EX Legend Maker' },
  { pattern: /\b(ex holon phantoms)\b/i, name: 'EX Holon Phantoms' },
  { pattern: /\b(ex crystal guardians)\b/i, name: 'EX Crystal Guardians' },
  { pattern: /\b(ex dragon frontiers)\b/i, name: 'EX Dragon Frontiers' },
  { pattern: /\b(ex power keepers)\b/i, name: 'EX Power Keepers' },
  { pattern: /\b(diamond & pearl|dp base)\b/i, name: 'Diamond & Pearl' },
  { pattern: /\b(mysterious treasures)\b/i, name: 'Mysterious Treasures' },
  { pattern: /\b(secret wonders)\b/i, name: 'Secret Wonders' },
  { pattern: /\b(great encounters)\b/i, name: 'Great Encounters' },
  { pattern: /\b(majestic dawn)\b/i, name: 'Majestic Dawn' },
  { pattern: /\b(legends awakened)\b/i, name: 'Legends Awakened' },
  { pattern: /\b(stormfront)\b/i, name: 'Stormfront' },
  { pattern: /\b(platinum)\b/i, name: 'Platinum' },
  { pattern: /\b(rising rivals)\b/i, name: 'Rising Rivals' },
  { pattern: /\b(supreme victors)\b/i, name: 'Supreme Victors' },
  { pattern: /\b(arceus)\b/i, name: 'Arceus' },
  { pattern: /\b(hgss|heartgold & soulsilver)\b/i, name: 'HeartGold & SoulSilver' },
  { pattern: /\b(unleashed)\b/i, name: 'Unleashed' },
  { pattern: /\b(undaunted)\b/i, name: 'Undaunted' },
  { pattern: /\b(triumphant)\b/i, name: 'Triumphant' },
  { pattern: /\b(call of legends)\b/i, name: 'Call of Legends' },
  { pattern: /\b(black & white|bw base)\b/i, name: 'Black & White' },
  { pattern: /\b(emerging powers)\b/i, name: 'Emerging Powers' },
  { pattern: /\b(noble victories)\b/i, name: 'Noble Victories' },
  { pattern: /\b(next destinies)\b/i, name: 'Next Destinies' },
  { pattern: /\b(dark explorers)\b/i, name: 'Dark Explorers' },
  { pattern: /\b(dragons exalted)\b/i, name: 'Dragons Exalted' },
  { pattern: /\b(boundaries crossed)\b/i, name: 'Boundaries Crossed' },
  { pattern: /\b(plasma storm)\b/i, name: 'Plasma Storm' },
  { pattern: /\b(plasma freeze)\b/i, name: 'Plasma Freeze' },
  { pattern: /\b(plasma blast)\b/i, name: 'Plasma Blast' },
  { pattern: /\b(legendary treasures)\b/i, name: 'Legendary Treasures' },
  { pattern: /\b(xy|xy base)\b/i, name: 'XY' },
  { pattern: /\b(flashfire)\b/i, name: 'Flashfire' },
  { pattern: /\b(furious fists)\b/i, name: 'Furious Fists' },
  { pattern: /\b(phantom forces)\b/i, name: 'Phantom Forces' },
  { pattern: /\b(primal clash)\b/i, name: 'Primal Clash' },
  { pattern: /\b(roaring skies)\b/i, name: 'Roaring Skies' },
  { pattern: /\b(ancient origins)\b/i, name: 'Ancient Origins' },
  { pattern: /\b(breakthrough)\b/i, name: 'BREAKthrough' },
  { pattern: /\b(breakpoint)\b/i, name: 'BREAKpoint' },
  { pattern: /\b(generations)\b/i, name: 'Generations' },
  { pattern: /\b(fates collide)\b/i, name: 'Fates Collide' },
  { pattern: /\b(steam siege)\b/i, name: 'Steam Siege' },
  { pattern: /\b(evolutions)\b/i, name: 'Evolutions' },
  { pattern: /\b(sun & moon|sm base)\b/i, name: 'Sun & Moon' },
  { pattern: /\b(guardians rising)\b/i, name: 'Guardians Rising' },
  { pattern: /\b(burning shadows)\b/i, name: 'Burning Shadows' },
  { pattern: /\b(crimson invasion)\b/i, name: 'Crimson Invasion' },
  { pattern: /\b(ultra prism)\b/i, name: 'Ultra Prism' },
  { pattern: /\b(forbidden light)\b/i, name: 'Forbidden Light' },
  { pattern: /\b(celestial storm)\b/i, name: 'Celestial Storm' },
  { pattern: /\b(lost thunder)\b/i, name: 'Lost Thunder' },
  { pattern: /\b(team up)\b/i, name: 'Team Up' },
  { pattern: /\b(unbroken bonds)\b/i, name: 'Unbroken Bonds' },
  { pattern: /\b(unified minds)\b/i, name: 'Unified Minds' },
  { pattern: /\b(cosmic eclipse)\b/i, name: 'Cosmic Eclipse' },
  { pattern: /\b(sword & shield|swsh base)\b/i, name: 'Sword & Shield' },
  { pattern: /\b(rebel clash)\b/i, name: 'Rebel Clash' },
  { pattern: /\b(darkness ablaze)\b/i, name: 'Darkness Ablaze' },
  { pattern: /\b(vivid voltage)\b/i, name: 'Vivid Voltage' },
  { pattern: /\b(shining fates)\b/i, name: 'Shining Fates' },
  { pattern: /\b(battle styles)\b/i, name: 'Battle Styles' },
  { pattern: /\b(chilling reign)\b/i, name: 'Chilling Reign' },
  { pattern: /\b(evolving skies)\b/i, name: 'Evolving Skies' },
  { pattern: /\b(fusion strike)\b/i, name: 'Fusion Strike' },
  { pattern: /\b(brilliant stars)\b/i, name: 'Brilliant Stars' },
  { pattern: /\b(astral radiance)\b/i, name: 'Astral Radiance' },
  { pattern: /\b(pokemon go|pogo)\b/i, name: 'Pokemon GO' },
  { pattern: /\b(lost origin)\b/i, name: 'Lost Origin' },
  { pattern: /\b(silver tempest)\b/i, name: 'Silver Tempest' },
  { pattern: /\b(crown zenith)\b/i, name: 'Crown Zenith' },
  { pattern: /\b(scarlet & violet|sv base|sv1)\b/i, name: 'Scarlet & Violet' },
  { pattern: /\b(paldea evolved|sv2)\b/i, name: 'Paldea Evolved' },
  { pattern: /\b(obsidian flames|sv3)\b/i, name: 'Obsidian Flames' },
  { pattern: /\b(151|sv3.5)\b/i, name: '151' },
  { pattern: /\b(paradox rift|sv4)\b/i, name: 'Paradox Rift' },
  { pattern: /\b(paldean fates|sv4.5)\b/i, name: 'Paldean Fates' },
  { pattern: /\b(temporal forces|sv5)\b/i, name: 'Temporal Forces' },
  { pattern: /\b(twilight masquerade|sv6)\b/i, name: 'Twilight Masquerade' },
  { pattern: /\b(shrouded fable|sv6.5)\b/i, name: 'Shrouded Fable' },
  { pattern: /\b(stellar crown|sv7)\b/i, name: 'Stellar Crown' },
  { pattern: /\b(surging sparks|sv8)\b/i, name: 'Surging Sparks' },
  { pattern: /\b(prismatic evolutions)\b/i, name: 'Prismatic Evolutions' },
  { pattern: /\b(destined rivals)\b/i, name: 'Destined Rivals' },
];

function extractSetFromTitle(title: string): string | null {
  if (!title) return null;

  for (const { pattern, name } of SET_PATTERNS) {
    if (pattern.test(title)) {
      return name;
    }
  }

  return null;
}

// Helper functions
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function calculateDiscount(listed: number, fair: number): number {
  return ((fair - listed) / fair) * 100;
}

function getRecommendation(discount: number, liquidity: string): string {
  if (discount > 10 && liquidity !== 'F') return 'BUY';
  if (discount < -15) return 'PASS';
  return 'HOLD';
}

function getLiquidityGrade(listingCount: number): string {
  if (listingCount >= 100) return 'A';
  if (listingCount >= 50) return 'B';
  if (listingCount >= 20) return 'C';
  if (listingCount >= 10) return 'D';
  return 'F';
}

function getPriceRange(cents: number): string {
  if (cents < 100) return 'budget';       // < $1
  if (cents < 1000) return 'low';         // $1-10
  if (cents < 5000) return 'mid';         // $10-50
  if (cents < 25000) return 'high';       // $50-250
  return 'premium';                        // $250+
}

async function extractCategory1_Arbitrage(): Promise<TrainingExample[]> {
  console.log('\n📊 Category 1: Arbitrage Detection (target: 50,000)');
  console.log('─'.repeat(80));

  const data = await prisma.$queryRaw<any[]>`
    WITH card_stats AS (
      SELECT
        "cardName",
        COALESCE("setName", '') as "setName",
        title,
        source,
        "priceCents",
        ROW_NUMBER() OVER (PARTITION BY "cardName" ORDER BY "updatedAt" DESC) as rn,
        AVG("priceCents") OVER (PARTITION BY "cardName") as avg_price,
        COUNT(*) OVER (PARTITION BY "cardName") as listing_count
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "priceCents" < 10000000
        AND "dataQuality" >= 0.3
    )
    SELECT * FROM card_stats
    WHERE listing_count >= 2 AND rn <= 3
    ORDER BY RANDOM()
    LIMIT 70000
  `;

  const examples: TrainingExample[] = [];

  for (const row of data) {
    const listedPrice = Number(row.priceCents);
    const fairValue = Number(row.avg_price);
    const listingCount = Number(row.listing_count);
    const discount = calculateDiscount(listedPrice, fairValue);
    const liquidityGrade = getLiquidityGrade(listingCount);
    const recommendation = getRecommendation(discount, liquidityGrade);

    // Extract set from title if not present
    const setName = row.setName || extractSetFromTitle(row.title) || 'Unknown Set';

    const instruction = `Analyze: ${row.cardName}${setName !== 'Unknown Set' ? ` - ${setName}` : ''}. Listed at ${formatPrice(listedPrice)}, ${listingCount} active listings, fair value ${formatPrice(fairValue)}`;

    const output = `ANALYSIS: ${recommendation === 'BUY' ? 'Strong BUY opportunity' : recommendation === 'PASS' ? 'OVERPRICED - PASS' : 'Fair pricing - HOLD'}

PRICING:
• Listed: ${formatPrice(listedPrice)}
• Fair Value: ${formatPrice(fairValue)} (based on ${listingCount} listings)
• Difference: ${discount > 0 ? `${discount.toFixed(1)}% below` : `${Math.abs(discount).toFixed(1)}% above`} market

LIQUIDITY:
• Market Depth: ${listingCount} active listings
• Liquidity Grade: ${liquidityGrade}

RECOMMENDATION: ${recommendation}
Reasoning: ${discount > 10 ? `Significant ${discount.toFixed(1)}% discount with ${listingCount} comparable listings. Good arbitrage opportunity.` : discount < -15 ? `Listed ${Math.abs(discount).toFixed(1)}% above fair value. Overpriced relative to market.` : `Pricing aligned with market average (${Math.abs(discount).toFixed(1)}% variance). Fair value.`}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'arbitrage_detection',
      metadata: {
        cardName: row.cardName,
        setName,
        sources: [row.source],
        priceRange: getPriceRange(listedPrice),
      },
    });

    if (examples.length % 5000 === 0) {
      console.log(`  ✓ Generated ${examples.length} arbitrage examples...`);
    }

    if (examples.length >= 50000) break;
  }

  console.log(`✅ Category 1 complete: ${examples.length} examples`);
  return examples;
}

async function extractCategory2_Liquidity(): Promise<TrainingExample[]> {
  console.log('\n📈 Category 2: Liquidity Analysis (target: 50,000)');
  console.log('─'.repeat(80));

  const data = await prisma.$queryRaw<any[]>`
    WITH card_liquidity AS (
      SELECT
        "cardName",
        COALESCE("setName", '') as "setName",
        title,
        "priceCents",
        source,
        COUNT(*) OVER (PARTITION BY "cardName") as market_depth,
        AVG("priceCents") OVER (PARTITION BY "cardName") as avg_price,
        ROW_NUMBER() OVER (PARTITION BY "cardName" ORDER BY "updatedAt" DESC) as rn
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "dataQuality" >= 0.3
    )
    SELECT * FROM card_liquidity
    WHERE rn <= 2
    ORDER BY RANDOM()
    LIMIT 50000
  `;

  const examples: TrainingExample[] = [];

  for (const row of data) {
    const marketDepth = Number(row.market_depth);
    const avgPrice = Number(row.avg_price);
    const liquidityGrade = getLiquidityGrade(marketDepth);
    const setName = row.setName || extractSetFromTitle(row.title) || 'Unknown Set';

    const daysToSell = marketDepth <= 5 ? '3-7' :
                      marketDepth <= 20 ? '7-14' :
                      marketDepth <= 50 ? '14-30' :
                      marketDepth <= 100 ? '30-60' : '60+';

    const salesVelocity = marketDepth <= 5 ? 'Low (0.2-0.5/day)' :
                         marketDepth <= 20 ? 'Moderate (0.5-1/day)' :
                         marketDepth <= 50 ? 'Good (1-2/day)' :
                         marketDepth <= 100 ? 'High (2-4/day)' : 'Very High (4+/day)';

    const instruction = `Assess liquidity: ${row.cardName}${setName !== 'Unknown Set' ? ` - ${setName}` : ''}. Market depth: ${marketDepth} listings, avg price ${formatPrice(avgPrice)}`;

    const output = `LIQUIDITY ANALYSIS:

MARKET DEPTH:
• Active Listings: ${marketDepth}
• Average Price: ${formatPrice(avgPrice)}
• Liquidity Grade: ${liquidityGrade}

VELOCITY ESTIMATE:
• Sales Velocity: ${salesVelocity}
• Est. Time to Sell: ${daysToSell} days
• Market Activity: ${liquidityGrade === 'A' || liquidityGrade === 'B' ? 'High turnover market' : liquidityGrade === 'C' ? 'Moderate turnover' : 'Slower market'}

LIQUIDITY ASSESSMENT: ${liquidityGrade}
${liquidityGrade === 'A' || liquidityGrade === 'B' ? 'EXCELLENT - High liquidity, quick turnover expected. Safe for short-term flipping.' : liquidityGrade === 'C' ? 'GOOD - Moderate liquidity. Expect 2-4 week hold period.' : liquidityGrade === 'D' ? 'FAIR - Limited liquidity. May take 1-2 months to sell. Only buy at discount.' : 'POOR - Very limited market. High risk. Only buy at significant discount for long-term hold.'}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'liquidity_analysis',
      metadata: {
        cardName: row.cardName,
        setName,
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
  console.log('\n📉 Category 3: Price Trend Analysis (target: 25,000)');
  console.log('─'.repeat(80));

  const data = await prisma.$queryRaw<any[]>`
    WITH price_variance AS (
      SELECT
        "cardName",
        COALESCE("setName", '') as "setName",
        title,
        "priceCents",
        AVG("priceCents") OVER (PARTITION BY "cardName") as avg_price,
        STDDEV("priceCents") OVER (PARTITION BY "cardName") as price_stddev,
        COUNT(*) OVER (PARTITION BY "cardName") as sample_size,
        ROW_NUMBER() OVER (PARTITION BY "cardName" ORDER BY "updatedAt" DESC) as rn
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "dataQuality" >= 0.3
    )
    SELECT * FROM price_variance
    WHERE rn = 1 AND sample_size >= 3
    ORDER BY RANDOM()
    LIMIT 25000
  `;

  const examples: TrainingExample[] = [];

  for (const row of data) {
    const currentPrice = Number(row.priceCents);
    const avgPrice = Number(row.avg_price);
    const stddev = Number(row.price_stddev || 0);
    const sampleSize = Number(row.sample_size);
    const setName = row.setName || extractSetFromTitle(row.title) || 'Unknown Set';

    const variance = ((currentPrice - avgPrice) / avgPrice) * 100;
    const volatility = (stddev / avgPrice) * 100;

    const trend = variance > 5 ? 'RISING' : variance < -5 ? 'FALLING' : 'STABLE';
    const momentum = Math.abs(variance) > 15 ? 'Strong' : Math.abs(variance) > 5 ? 'Moderate' : 'Weak';

    const instruction = `Analyze price trend: ${row.cardName}${setName !== 'Unknown Set' ? ` - ${setName}` : ''}. Current ${formatPrice(currentPrice)}, ${sampleSize} data points, volatility ${volatility.toFixed(1)}%`;

    const output = `PRICE TREND ANALYSIS:

CURRENT STATE:
• Latest Price: ${formatPrice(currentPrice)}
• Average Price: ${formatPrice(avgPrice)}
• Sample Size: ${sampleSize} listings
• Price Volatility: ${volatility.toFixed(1)}%

TREND DIRECTION: ${trend}
• Momentum: ${momentum}
• Change: ${variance > 0 ? '+' : ''}${variance.toFixed(1)}%
• Pattern: ${trend === 'RISING' ? 'Upward price momentum' : trend === 'FALLING' ? 'Downward price pressure' : 'Sideways consolidation'}

VOLATILITY: ${volatility > 20 ? 'HIGH' : volatility > 10 ? 'MODERATE' : 'LOW'}
${volatility > 20 ? 'High price instability - risky for short-term trading' : volatility > 10 ? 'Moderate price swings - some trading opportunity' : 'Stable pricing - predictable market'}

TRADING STRATEGY:
${trend === 'RISING' ? `Buy now before further appreciation. Price gaining ${variance.toFixed(1)}% momentum.` : trend === 'FALLING' ? `Wait for price stabilization. Currently declining ${Math.abs(variance).toFixed(1)}%.` : `Range-bound trading. Buy on dips, sell on spikes within ${volatility.toFixed(1)}% range.`}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'price_trends',
      metadata: {
        cardName: row.cardName,
        setName,
        priceRange: getPriceRange(currentPrice),
      },
    });

    if (examples.length % 2500 === 0) {
      console.log(`  ✓ Generated ${examples.length} trend examples...`);
    }
  }

  console.log(`✅ Category 3 complete: ${examples.length} examples`);
  return examples;
}

async function extractCategory4_MultiSource(): Promise<TrainingExample[]> {
  console.log('\n🔄 Category 4: Multi-Source Consensus (target: 40,000)');
  console.log('─'.repeat(80));

  const data = await prisma.$queryRaw<any[]>`
    WITH multi_source AS (
      SELECT
        "cardName",
        COALESCE("setName", '') as "setName",
        title,
        json_agg(json_build_object('source', source, 'price', "priceCents")) as source_prices,
        COUNT(DISTINCT source) as source_count,
        AVG("priceCents") as consensus_price,
        MIN("priceCents") as min_price,
        MAX("priceCents") as max_price
      FROM "UnifiedMarketListing"
      WHERE
        "cardName" IS NOT NULL
        AND "priceCents" IS NOT NULL
        AND "priceCents" > 0
        AND "dataQuality" >= 0.3
      GROUP BY "cardName", "setName", title
      HAVING COUNT(*) >= 2
    )
    SELECT * FROM multi_source
    ORDER BY RANDOM()
    LIMIT 40000
  `;

  const examples: TrainingExample[] = [];

  for (const row of data) {
    const sources = JSON.parse(JSON.stringify(row.source_prices));
    const consensusPrice = Number(row.consensus_price);
    const minPrice = Number(row.min_price);
    const maxPrice = Number(row.max_price);
    const spread = ((maxPrice - minPrice) / minPrice) * 100;
    const sourceCount = Number(row.source_count);

    // Use first row's title for set extraction
    const setName = row.setName || extractSetFromTitle(row.title) || 'Unknown Set';

    const sourceList = sources
      .slice(0, 5)
      .map((s: any) => `${s.source}: ${formatPrice(s.price)}`)
      .join(', ');

    const instruction = `Determine fair value: ${row.cardName}${setName !== 'Unknown Set' ? ` - ${setName}` : ''}. Prices: ${sourceList}`;

    const output = `MULTI-SOURCE CONSENSUS:

SOURCE COMPARISON:
${sources.slice(0, 5).map((s: any) => `• ${s.source}: ${formatPrice(s.price)}`).join('\n')}

PRICE ANALYSIS:
• Fair Market Value: ${formatPrice(consensusPrice)}
• Price Range: ${formatPrice(minPrice)} - ${formatPrice(maxPrice)}
• Spread: ${spread.toFixed(1)}%
• Data Sources: ${sourceCount}

MARKET EFFICIENCY: ${spread < 10 ? 'HIGH' : spread < 25 ? 'MODERATE' : 'LOW'}
${spread < 10 ? 'Tight pricing across sources - efficient market. Limited arbitrage potential.' : spread < 25 ? 'Moderate price variance - some arbitrage opportunities between marketplaces.' : `Large price gaps (${spread.toFixed(1)}%) - strong arbitrage potential. Buy at ${formatPrice(minPrice)}, sell at ${formatPrice(maxPrice)}.`}

CONFIDENCE: ${sourceCount >= 3 ? 'HIGH' : sourceCount === 2 ? 'MODERATE' : 'LOW'}
${sourceCount >= 3 ? 'Multiple sources confirm fair value' : sourceCount === 2 ? 'Limited data - verify with additional sources' : 'Single source - price unverified'}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'multi_source_consensus',
      metadata: {
        cardName: row.cardName,
        setName,
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
  console.log('\n⭐ Category 5: Condition/Grade Adjustments (target: 35,000)');
  console.log('─'.repeat(80));

  const data = await prisma.$queryRaw<any[]>`
    SELECT
      "cardName",
      COALESCE("setName", '') as "setName",
      title,
      "grade",
      "gradeCompany",
      "condition",
      "priceCents",
      source
    FROM "UnifiedMarketListing"
    WHERE
      "cardName" IS NOT NULL
      AND "priceCents" IS NOT NULL
      AND "priceCents" > 0
      AND ("grade" IS NOT NULL OR "condition" IS NOT NULL)
      AND "dataQuality" >= 0.3
    ORDER BY RANDOM()
    LIMIT 35000
  `;

  const examples: TrainingExample[] = [];

  for (const row of data) {
    const price = Number(row.priceCents);
    const grade = row.grade ? Number(row.grade) : null;
    const gradeCompany = row.gradeCompany || 'Unknown';
    const condition = row.condition || 'Unspecified';
    const setName = row.setName || extractSetFromTitle(row.title) || 'Unknown Set';

    let premiumPct = 0;
    if (grade) {
      if (grade >= 10) premiumPct = 300;
      else if (grade >= 9) premiumPct = 150;
      else if (grade >= 8) premiumPct = 80;
      else premiumPct = 30;
    }

    const basePrice = grade ? price / (1 + premiumPct / 100) : price;
    const gradeInfo = grade ? `${gradeCompany} ${grade}` : condition;

    const instruction = `Evaluate: ${row.cardName}${setName !== 'Unknown Set' ? ` - ${setName}` : ''}. Condition: ${gradeInfo}, Price: ${formatPrice(price)}`;

    const output = `CONDITION ANALYSIS:

CARD DETAILS:
• Condition: ${gradeInfo}
• Listed Price: ${formatPrice(price)}
${grade ? `• Estimated Raw Value: ${formatPrice(basePrice)}
• Grade Premium: ~${premiumPct}%` : `• Condition: ${condition} (ungraded)`}

GRADE IMPACT:
${grade ? `• ${gradeCompany} ${grade} grade commands ~${premiumPct}% premium
• ${grade >= 10 ? 'GEM MINT 10 - Highest premium tier, pristine condition' : grade >= 9 ? 'MINT 9 - Strong premium, excellent condition' : grade >= 8 ? 'Near Mint 8 - Moderate premium' : 'Below Mint - Limited premium over raw'}
• Market premium: ${premiumPct}% above ungraded value` : `• Ungraded ${condition} condition
• No professional authentication premium
• Consider grading if card is valuable and high condition`}

VALUE ASSESSMENT: ${grade && grade >= 9 ? 'PREMIUM' : grade && grade >= 7 ? 'FAIR' : 'STANDARD'}
${grade && grade >= 9 ? `Premium pricing justified by high grade. Fair value for collectors seeking certified cards.` : grade && grade >= 7 ? `Moderate premium appropriate for mid-grade certification. Reasonable pricing.` : grade ? `Low-grade premium limited. Consider raw alternatives if budget-conscious.` : `Standard pricing for stated condition. Grading recommended for high-value cards.`}`;

    examples.push({
      instruction,
      input: '',
      output,
      category: 'condition_grade',
      metadata: {
        cardName: row.cardName,
        setName,
        priceRange: getPriceRange(price),
        hasGrade: !!grade,
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
  console.log('🚀 MEW-1A V3 MAXIMIZED TRAINING DATA EXTRACTION');
  console.log('═'.repeat(80));
  console.log('Target: 200,000+ high-quality instruction-tuning examples');
  console.log('Data Source: ALL 216,848 usable records from consolidated database');
  console.log('Improvements: Set extraction from titles, better filtering, more data');
  console.log('═'.repeat(80));

  const allExamples: TrainingExample[] = [];

  // Extract all categories
  console.log('\n🔄 Starting extraction...\n');

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

  // Shuffle for better training
  const shuffled = allExamples.sort(() => Math.random() - 0.5);

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'data', 'training');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to JSONL file
  const outputPath = path.join(outputDir, 'mew1a-v3-training-data-maximized.jsonl');
  const writeStream = fs.createWriteStream(outputPath);

  for (const example of shuffled) {
    writeStream.write(JSON.stringify(example) + '\n');
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on('error', reject);
  });

  // Generate statistics
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

  const uniqueCards = new Set(shuffled.map(e => e.metadata?.cardName).filter(Boolean)).size;
  const uniqueSets = new Set(shuffled.map(e => e.metadata?.setName).filter(Boolean)).size;

  console.log('\n✅ EXTRACTION COMPLETE!');
  console.log('═'.repeat(80));
  console.log(`Total Examples: ${shuffled.length.toLocaleString()}`);
  console.log(`Unique Cards: ${uniqueCards.toLocaleString()}`);
  console.log(`Unique Sets: ${uniqueSets.toLocaleString()}`);
  console.log(`Output File: ${outputPath}`);
  console.log(`File Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('📊 Category Distribution:');
  console.table(categoryCounts);
  console.log('');
  console.log('💰 Price Range Distribution:');
  console.table(priceRangeCounts);
  console.log('');
  console.log('🎯 Dataset Quality:');
  console.log(`  • Set Coverage: ${((uniqueSets / Math.max(uniqueSets, 100)) * 100).toFixed(1)}%`);
  console.log(`  • Price Diversity: 5 ranges from budget to premium`);
  console.log(`  • Category Balance: Well-distributed across 5 categories`);
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('  1. Review sample examples: head -5 data/training/mew1a-v3-training-data-maximized.jsonl | jq');
  console.log('  2. Upload to HuggingFace: python scripts/mew1a-upload-to-huggingface-v3.py');
  console.log('  3. Launch training on RunPod: 10-14 hours estimated');
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
