/**
 * TEST SIGNAL GENERATION
 * Pull real data from database and generate market signals
 */

import { generateSignalsFromDatabase, getTopSignals } from '../api/src/lib/signal-generator-v2.js';

async function testSignalGeneration() {
  console.log('🔍 Testing Signal Generation from Database\n');
  console.log('='.repeat(80));

  try {
    // Generate signals from database
    console.log('\n📊 Generating signals...\n');

    // Relaxed filters to find any opportunities
    const signals = await generateSignalsFromDatabase({
      minDiscount: -5,  // 5% discount minimum
      minComps: 2,      // Just 2 comps
      minVolume: 1,     // 1 sale/month
      onlyGraded: false, // Include raw cards
    });

    // Take top 5 by discount
    const topSignals = signals.slice(0, 5);

    if (signals.length === 0) {
      console.log('❌ No signals found matching criteria');
      console.log('\nTip: Adjust filters in signal-generator.ts:');
      console.log('  - Lower minDiscount (e.g., -5 instead of -10)');
      console.log('  - Lower minComps (e.g., 3 instead of 5)');
      console.log('  - Set onlyGraded to false');
      return;
    }

    console.log(`✅ Found ${signals.length} qualified signals\n`);
    console.log('='.repeat(80));

    topSignals.forEach((signal, i) => {
      const discount = ((signal.listedPrice - signal.marketData.fairValue) / signal.marketData.fairValue) * 100;

      console.log(`\n🎯 SIGNAL #${i + 1}`);
      console.log('─'.repeat(80));

      // Card Info
      console.log('\n📋 CARD:');
      console.log(`  Name: ${signal.cardName}`);
      console.log(`  Set: ${signal.setName || 'Unknown'} ${signal.setNumber ? `(${signal.setNumber})` : ''}`);
      if (signal.rarity) console.log(`  Rarity: ${signal.rarity}`);
      if (signal.cardType) console.log(`  Type: ${signal.cardType}`);
      if (signal.releaseYear) console.log(`  Year: ${signal.releaseYear}`);
      if (signal.grade && signal.gradeCompany) {
        console.log(`  Grade: ${signal.gradeCompany} ${signal.grade}`);
      }

      // Pricing
      console.log('\n💰 PRICING:');
      console.log(`  Listed: $${signal.listedPrice.toFixed(2)} (${signal.venue})`);
      console.log(`  Fair Value: $${signal.marketData.fairValue.toFixed(2)}`);
      console.log(`  Discount: ${discount.toFixed(1)}% ${discount < -15 ? '🔥 HOT' : discount < -10 ? '✨ GOOD' : ''}`);
      console.log(`  Floor: $${signal.marketData.lowestAvailable.toFixed(2)}`);

      // Market
      console.log('\n📊 MARKET:');
      console.log(`  Comps: ${signal.marketData.salesCount} recent sales`);
      console.log(`  Volume: ${signal.marketData.avgVolume30d} sales/month`);
      console.log(`  7d Trend: ${signal.marketData.priceChange7d > 0 ? '+' : ''}${signal.marketData.priceChange7d.toFixed(1)}%`);
      console.log(`  30d Trend: ${signal.marketData.priceChange30d > 0 ? '+' : ''}${signal.marketData.priceChange30d.toFixed(1)}%`);

      // Venue Breakdown
      if (signal.marketData.venueBreakdown && signal.marketData.venueBreakdown.length > 0) {
        console.log('\n📍 COMP BREAKDOWN:');
        signal.marketData.venueBreakdown.forEach(v => {
          console.log(`  ${v.venue.padEnd(15)} | ${v.count} sales @ $${v.avgPrice.toFixed(2).padStart(7)} | ${(v.weight * 100).toFixed(0).padStart(2)}%`);
        });
      }

      // URL
      if (signal.listingUrl) {
        console.log(`\n🔗 URL: ${signal.listingUrl}`);
      }

      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\n✅ Signal generation test complete!\n');
    console.log('Next steps:');
    console.log('  1. Run AI ensemble analysis on these signals');
    console.log('  2. Format for Twitter/X posts');
    console.log('  3. Post to X automatically\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testSignalGeneration();
