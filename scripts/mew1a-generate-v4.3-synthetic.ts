#!/usr/bin/env tsx
/**
 * MEW-1A v4.3 - SYNTHETIC EXAMPLES GENERATOR
 *
 * Generates high-quality synthetic examples for:
 * 1. "Unknown data" responses (teach honesty)
 * 2. Primary use case: Card name → Investment analysis
 * 3. BUY/PASS decisions
 * 4. Market trend queries
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

const examples: Mew1AExample[] = [];

// Popular Pokemon cards for realistic examples
const POPULAR_CARDS = [
  // Vintage chase cards
  { name: 'Charizard Base Set 1st Edition', set: 'Base Set', rarity: 'Holo Rare', value_tier: 'ultra-high' },
  { name: 'Blastoise Base Set 1st Edition', set: 'Base Set', rarity: 'Holo Rare', value_tier: 'very-high' },
  { name: 'Venusaur Base Set 1st Edition', set: 'Base Set', rarity: 'Holo Rare', value_tier: 'high' },
  { name: 'Pikachu Illustrator', set: 'Promo', rarity: 'Promo', value_tier: 'ultra-high' },

  // Modern chase cards
  { name: 'Charizard VMAX', set: "Champion's Path", rarity: 'Rainbow Rare', value_tier: 'high' },
  { name: 'Umbreon VMAX Alt Art', set: 'Evolving Skies', rarity: 'Alt Art', value_tier: 'very-high' },
  { name: 'Pikachu VMAX', set: 'Vivid Voltage', rarity: 'Rainbow Rare', value_tier: 'medium' },
  { name: 'Rayquaza VMAX Alt Art', set: 'Evolving Skies', rarity: 'Alt Art', value_tier: 'high' },
  { name: 'Moonbreon', set: 'Evolving Skies', rarity: 'Alt Art', value_tier: 'very-high' },
  { name: 'Leafeon VMAX Alt Art', set: 'Evolving Skies', rarity: 'Alt Art', value_tier: 'medium' },

  // Recent popular cards
  { name: 'Charizard ex', set: 'Obsidian Flames', rarity: 'Special Illustration Rare', value_tier: 'medium' },
  { name: 'Mew ex', set: 'Paldea Evolved', rarity: 'Special Illustration Rare', value_tier: 'medium' },
  { name: 'Giratina VSTAR', set: 'Lost Origin', rarity: 'Alt Art', value_tier: 'high' },
];

const GRADES = ['PSA 10', 'PSA 9', 'BGS 9.5', 'CGC 9.5', 'PSA 8'];
const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played'];

// =============================================================================
// 1. UNKNOWN DATA EXAMPLES (Teach honesty!)
// =============================================================================

function generateUnknownDataExamples() {
  console.log('Generating "Unknown Data" examples...');

  const unknownQueries = [
    // Bid count questions
    {
      q: (card: string) => `How many bids did this ${card} get?`,
      a: () => `I don't have bid count information for this specific listing. Bid counts vary by auction and aren't always publicly available after sale completion. If you're evaluating demand, look for recent sold listings with visible bid history.`,
    },
    {
      q: (card: string) => `Was there a bidding war on this ${card}?`,
      a: () => `I don't have bidding history for this listing. Bidding activity is only visible during active auctions and is rarely preserved in historical data.`,
    },

    // Grade questions (when not provided)
    {
      q: (card: string) => `What grade is this ${card}?`,
      a: () => `No grading information was provided. This card could be raw (ungraded) or professionally graded by PSA, BGS, or CGC. Graded cards typically command premium prices, especially PSA 10 or BGS 9.5+.`,
    },
    {
      q: (card: string) => `Is this ${card} graded?`,
      a: () => `I don't have grading information for this card. To determine if a card is graded, check the listing for mentions of PSA, BGS, CGC, or SGC along with a numerical grade.`,
    },

    // Condition questions
    {
      q: (card: string) => `What condition is this ${card} in?`,
      a: () => `No condition information was provided. Pokemon TCG card conditions range from Near Mint to Heavily Played, significantly affecting value. Request photos of edges, corners, surface, and centering for accurate assessment.`,
    },

    // Specific sale details
    {
      q: (card: string) => `When did this ${card} last sell?`,
      a: () => `I don't have sale date information for this specific card. Check eBay sold listings, TCGPlayer sales history, or PriceCharting for recent transaction data.`,
    },
    {
      q: (card: string) => `Who sold this ${card}?`,
      a: () => `I don't have seller information. eBay listings show seller usernames during active sales, but this data isn't typically preserved in historical records.`,
    },
  ];

  // Generate 2,000 unknown data examples
  for (let i = 0; i < 2000; i++) {
    const card = POPULAR_CARDS[i % POPULAR_CARDS.length];
    const query = unknownQueries[i % unknownQueries.length];

    examples.push({
      instruction: query.q(card.name),
      input: '',
      output: query.a(),
      category: 'unknown_data',
      metadata: {
        source: 'synthetic_v4.3',
        teaches_honesty: true,
      },
    });
  }

  console.log(`  ✓ Generated ${2000} unknown data examples`);
}

// =============================================================================
// 2. PRIMARY USE CASE: Card Name → Investment Analysis
// =============================================================================

function generateCardAnalysisExamples() {
  console.log('Generating Card Analysis examples (primary use case)...');

  const analysisTemplates = [
    // Ultra-high value cards
    (card: any) => card.value_tier === 'ultra-high' && {
      instruction: card.name,
      input: '',
      output: `${card.name} is one of the most valuable Pokemon cards in existence. ${card.name === 'Pikachu Illustrator' ? 'Only 39 copies were ever produced, making this the holy grail of Pokemon collecting.' : 'PSA 10 graded copies have sold for $300K-$400K+ at auction.'} Extreme rarity and iconic status drive sustained demand. Investment recommendation: Only acquire PSA/BGS graded copies with provenance documentation. Expect limited liquidity due to ultra-high price point. Long-term appreciation likely but requires significant capital.`,
      category: 'card_analysis',
    },

    // Very high value cards
    (card: any) => card.value_tier === 'very-high' && {
      instruction: card.name,
      input: '',
      output: `${card.name} from ${card.set} is a highly sought-after ${card.rarity}. Market value for raw copies ranges $200-$400, with PSA 10 graded cards reaching $800-$1,500. ${card.name.includes('Umbreon') ? 'Umbreon\'s popularity as the "Moonbreon" makes this one of the most iconic modern cards.' : 'Strong collector demand due to excellent artwork and limited print run.'} Investment thesis: BUY PSA 9+ graded copies for long-term hold. Monitor for print defects and centering issues before grading raw copies.`,
      category: 'card_analysis',
    },

    // High value cards
    (card: any) => card.value_tier === 'high' && {
      instruction: card.name,
      input: '',
      output: `${card.name} is a popular ${card.rarity} from ${card.set}. Typical market range: $80-$200 for raw Near Mint copies, $250-$400 for PSA 10. ${card.name.includes('Charizard') ? 'Charizard cards maintain strong demand across all eras.' : 'Solid investment with good liquidity.'} Recommendation: Acquire well-centered raw copies for grading submission, or buy PSA 9 graded for immediate collection value. Watch for market dips during new set releases.`,
      category: 'card_analysis',
    },

    // Medium value cards
    (card: any) => card.value_tier === 'medium' && {
      instruction: card.name,
      input: '',
      output: `${card.name} from ${card.set} is a ${card.rarity} with moderate collector interest. Market value: $30-$80 raw, $100-$180 PSA 10. Good entry point for budget collectors. Liquidity is decent with active secondary market. Investment potential depends on ${card.name.includes('ex') ? 'the longevity of the Scarlet & Violet era' : 'continued demand for this specific artwork'}. Buy recommendation: Acquire raw copies under $40 or PSA 10 under $120 for best value.`,
      category: 'card_analysis',
    },
  ];

  // Generate 3,000 card analysis examples
  for (let i = 0; i < 3000; i++) {
    const card = POPULAR_CARDS[i % POPULAR_CARDS.length];
    const template = analysisTemplates.find(t => t(card));

    if (template) {
      const result = template(card);
      if (result) examples.push({
        ...result,
        metadata: { source: 'synthetic_v4.3', card_tier: card.value_tier },
      });
    }
  }

  console.log(`  ✓ Generated ${3000} card analysis examples`);
}

// =============================================================================
// 3. BUY/PASS DECISIONS
// =============================================================================

function generateBuyPassExamples() {
  console.log('Generating BUY/PASS decision examples...');

  const decisions = [
    // Strong BUY
    {
      instruction: (card: string, price: number, fair: number) => `Should I buy this ${card} for $${price}?`,
      condition: (price: number, fair: number) => price < fair * 0.8,
      output: (card: string, price: number, fair: number) => `BUY - $${price} is an excellent price for ${card}. Fair market value is around $${fair}, making this a ${Math.round((1 - price/fair) * 100)}% discount. ${price > 200 ? 'Verify authenticity and grading accuracy before purchase.' : 'Strong value opportunity.'} ${price < 50 ? 'Low risk entry point.' : 'Consider grading for added value protection.'}`,
    },

    // Moderate BUY
    {
      instruction: (card: string, price: number, fair: number) => `Should I buy this ${card} for $${price}?`,
      condition: (price: number, fair: number) => price >= fair * 0.8 && price <= fair * 1.1,
      output: (card: string, price: number, fair: number) => `BUY - $${price} is fair market value for ${card} (typical range $${Math.round(fair * 0.9)}-$${Math.round(fair * 1.1)}). ${price > 100 ? 'Check condition carefully and compare recent sold listings.' : 'Reasonable price for collection purposes.'} Not a significant discount, but solid acquisition if you want this card.`,
    },

    // PASS
    {
      instruction: (card: string, price: number, fair: number) => `Should I buy this ${card} for $${price}?`,
      condition: (price: number, fair: number) => price > fair * 1.1,
      output: (card: string, price: number, fair: number) => `PASS - $${price} is overpriced for ${card}. Fair market value is closer to $${fair}, making this a ${Math.round((price/fair - 1) * 100)}% premium. ${price > fair * 1.3 ? 'Significantly overpriced.' : 'Slightly high.'} Wait for better pricing or negotiate down to $${Math.round(fair)} or below. Monitor eBay sold listings for comparable sales.`,
    },
  ];

  // Generate 2,000 BUY/PASS examples
  for (let i = 0; i < 2000; i++) {
    const card = POPULAR_CARDS[i % POPULAR_CARDS.length];
    const fairValue = Math.round((Math.random() * 300 + 50) / 5) * 5; // $50-$350 in $5 increments
    const priceMultiplier = Math.random() < 0.3 ? 0.6 + Math.random() * 0.3 :  // 30% cheap (0.6-0.9x)
                           Math.random() < 0.5 ? 0.9 + Math.random() * 0.3 :  // 50% fair (0.9-1.2x)
                           1.2 + Math.random() * 0.4;                          // 20% expensive (1.2-1.6x)
    const listPrice = Math.round(fairValue * priceMultiplier);

    const decision = decisions.find(d => d.condition(listPrice, fairValue));
    if (decision) {
      const grade = i % 3 === 0 ? ` ${GRADES[i % GRADES.length]}` : '';
      examples.push({
        instruction: decision.instruction(`${card.name}${grade}`, listPrice, fairValue),
        input: `Fair value: $${fairValue}`,
        output: decision.output(`${card.name}${grade}`, listPrice, fairValue),
        category: 'investment_decision',
        metadata: {
          source: 'synthetic_v4.3',
          list_price: listPrice,
          fair_value: fairValue,
          discount_pct: Math.round((1 - listPrice/fairValue) * 100),
        },
      });
    }
  }

  console.log(`  ✓ Generated ${2000} BUY/PASS examples`);
}

// =============================================================================
// 4. MARKET TREND QUERIES
// =============================================================================

function generateMarketTrendExamples() {
  console.log('Generating Market Trend examples...');

  const trendCategories = [
    'Eeveelutions', 'Charizard cards', 'Alt Art cards', 'Rainbow Rare VMAX',
    'Vintage WOTC cards', 'Japanese Promos', 'Graded PSA 10 cards',
  ];

  const trendResponses = [
    (cat: string) => `${cat} are experiencing strong market demand with sustained price appreciation. Recent trends show 15-25% year-over-year growth for premium examples. Key factors: collector nostalgia, limited supply of graded copies, and strong artwork appeal. Investment outlook: POSITIVE for PSA 9+ graded examples. Monitor new set releases which may temporarily affect demand.`,

    (cat: string) => `${cat} market is showing stable pricing with moderate liquidity. Prices have held steady over the past 6 months with 5-10% fluctuations during new set drops. Good entry points during Pokemon TCG Live app updates or major tournament events. Investment strategy: Buy during market dips, hold PSA 10 graded copies for long-term appreciation.`,

    (cat: string) => `${cat} are currently in a correction phase after peak prices 6-12 months ago. Recent sales show 10-20% decline from highs. This presents value opportunities for patient investors. Historical data suggests ${cat} recover strongly after corrections. Recommendation: Dollar-cost average into high-grade examples over 3-6 months rather than lump sum purchasing.`,
  ];

  // Generate 1,000 market trend examples
  for (let i = 0; i < 1000; i++) {
    const category = trendCategories[i % trendCategories.length];
    const response = trendResponses[i % trendResponses.length];

    examples.push({
      instruction: `What is the market trend for ${category}?`,
      input: '',
      output: response(category),
      category: 'market_trends',
      metadata: { source: 'synthetic_v4.3', trend_category: category },
    });
  }

  console.log(`  ✓ Generated ${1000} market trend examples`);
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function generateAll() {
  console.log('🎨 MEW-1A v4.3 SYNTHETIC EXAMPLES GENERATION\n');
  console.log('='.repeat(60));

  generateUnknownDataExamples();
  generateCardAnalysisExamples();
  generateBuyPassExamples();
  generateMarketTrendExamples();

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 TOTAL SYNTHETIC EXAMPLES: ${examples.length.toLocaleString()}\n`);
  console.log('Breakdown:');
  const categories = examples.reduce((acc, ex) => {
    acc[ex.category] = (acc[ex.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count.toLocaleString()}`);
  });

  // Save to file
  const outputPath = path.join(process.cwd(), 'data/training/mew1a-v4.3-synthetic.jsonl');
  const jsonl = examples.map((ex) => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(outputPath, jsonl);

  console.log(`\n✅ Saved ${examples.length.toLocaleString()} synthetic examples to ${outputPath}\n`);
}

generateAll().catch(console.error);
