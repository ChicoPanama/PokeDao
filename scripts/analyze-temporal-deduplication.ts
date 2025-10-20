#!/usr/bin/env tsx
/**
 * ANALYZE TEMPORAL DATA LOSS IN DEDUPLICATION
 *
 * Checks if our deduplication is incorrectly removing price trend data.
 * For example: "Charizard sold for $100 on 2024-01-01" vs "Charizard sold for $120 on 2024-06-01"
 * These should BOTH be kept as they represent different time points!
 */

import * as fs from 'fs';
import * as path from 'path';

interface Example {
  instruction: string;
  input: string;
  output: string;
  category: string;
  metadata: any;
}

async function analyzeTemporal() {
  console.log('🔍 ANALYZING TEMPORAL DATA DEDUPLICATION\n');

  // Load eBay massive dataset (the one with most temporal data)
  const ebayPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-ebay-massive-505k.jsonl');
  const finalPath = path.join(process.cwd(), 'data/training/mew1a-v4.2-ULTIMATE-FINAL.jsonl');

  console.log('📊 Loading eBay dataset...');
  const ebayContent = fs.readFileSync(ebayPath, 'utf-8');
  const ebayLines = ebayContent.trim().split('\n');
  console.log(`  Found ${ebayLines.length.toLocaleString()} examples\n`);

  // Analyze temporal patterns in eBay data
  const cardPricesByDate = new Map<string, Array<{ price: number, date: string }>>();

  for (const line of ebayLines) {
    const ex: Example = JSON.parse(line);

    if (ex.metadata?.card_name && ex.metadata?.sold_price && ex.metadata?.sold_date) {
      const cardName = ex.metadata.card_name.toLowerCase().trim();
      const price = parseFloat(ex.metadata.sold_price);
      const date = ex.metadata.sold_date;

      if (!cardPricesByDate.has(cardName)) {
        cardPricesByDate.set(cardName, []);
      }
      cardPricesByDate.get(cardName)!.push({ price, date });
    }
  }

  console.log('📈 TEMPORAL PRICE DATA ANALYSIS\n');
  console.log(`Total unique cards: ${cardPricesByDate.size.toLocaleString()}`);

  // Find cards with multiple price points over time
  let cardsWithMultiplePrices = 0;
  let totalPricePoints = 0;
  const examples: Array<{card: string, count: number, priceRange: string}> = [];

  for (const [cardName, prices] of cardPricesByDate.entries()) {
    if (prices.length > 1) {
      cardsWithMultiplePrices++;
      totalPricePoints += prices.length;

      const uniquePrices = [...new Set(prices.map(p => p.price))];
      const minPrice = Math.min(...uniquePrices);
      const maxPrice = Math.max(...uniquePrices);

      if (prices.length > 10) {
        examples.push({
          card: cardName,
          count: prices.length,
          priceRange: `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`,
        });
      }
    }
  }

  console.log(`Cards with multiple price points: ${cardsWithMultiplePrices.toLocaleString()}`);
  console.log(`Total temporal price points: ${totalPricePoints.toLocaleString()}\n`);

  console.log('🎯 TOP CARDS WITH MOST TEMPORAL DATA (>10 price points):\n');
  examples.sort((a, b) => b.count - a.count).slice(0, 20).forEach(ex => {
    console.log(`  ${ex.card.padEnd(50)} ${ex.count.toString().padStart(4)} sales  ${ex.priceRange}`);
  });

  // Check what was lost in deduplication
  console.log('\n\n⚠️  CHECKING DEDUPLICATION IMPACT...\n');

  const finalContent = fs.readFileSync(finalPath, 'utf-8');
  const finalLines = finalContent.trim().split('\n');

  const finalCardPrices = new Map<string, number>();
  for (const line of finalLines) {
    const ex: Example = JSON.parse(line);
    if (ex.metadata?.card_name) {
      const cardName = ex.metadata.card_name.toLowerCase().trim();
      finalCardPrices.set(cardName, (finalCardPrices.get(cardName) || 0) + 1);
    }
  }

  console.log(`Original eBay examples: ${ebayLines.length.toLocaleString()}`);
  console.log(`Final dataset examples: ${finalLines.length.toLocaleString()}`);
  console.log(`\nTemporal data in eBay: ${totalPricePoints.toLocaleString()} price points`);

  // Calculate loss
  const examplesWithDate = finalLines.filter(line => {
    const ex: Example = JSON.parse(line);
    return ex.metadata?.sold_date || ex.metadata?.timestamp;
  }).length;

  console.log(`Temporal data in final: ${examplesWithDate.toLocaleString()} examples with dates`);
  console.log(`\n⚠️  POTENTIAL LOSS: ${(totalPricePoints - examplesWithDate).toLocaleString()} temporal price points\n`);

  // Recommendation
  console.log('💡 RECOMMENDATION:\n');
  console.log('   The current deduplication uses "instruction + input" hash.');
  console.log('   This REMOVES valuable price trend data because:');
  console.log('   - "Charizard sold for $100 on 2024-01-01"');
  console.log('   - "Charizard sold for $120 on 2024-06-01"');
  console.log('   Both have similar instruction+input, so one gets removed!\n');
  console.log('   FIX: Include DATE in deduplication hash to preserve trends.\n');
}

analyzeTemporal().catch(console.error);
