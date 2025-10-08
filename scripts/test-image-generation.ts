/**
 * TEST IMAGE GENERATION
 * Tests card image fetching, overlay, and chart generation
 */

import { fetchCardImage, createCardOverlay, generatePriceChart, generateTwitterImage, generateMockPriceHistory, combineImages } from '../api/src/lib/image-generator.js';
import type { AIAnalysisResult } from '../api/src/lib/ai-ensemble.js';

async function testImageGeneration() {
  console.log('🧪 TESTING IMAGE GENERATION');
  console.log('='.repeat(80));
  console.log('');

  // Create mock analysis result
  const mockAnalysis: AIAnalysisResult = {
    card: {
      name: 'Charizard ex',
      setName: 'Obsidian Flames',
      rarity: 'Special Illustration Rare',
      cardType: 'Full Art',
      setNumber: '201/197',
      releaseYear: 2023,
      grade: '10',
      gradeCompany: 'PSA',
      isFirstEdition: false,
      isShadowless: false,
      isReverseHolo: false,
    },
    pricing: {
      listed: 185.00,
      fairValue: 225.00,
      discount: -17.8,
      lowestAvailable: 195.00,
      venue: 'eBay',
      listingUrl: 'https://www.ebay.com/itm/example',
    },
    market: {
      salesCount: 12,
      avgVolume30d: 8,
      priceChange7d: 5.2,
      priceChange30d: 12.4,
    },
    recommendation: 'STRONG_BUY',
    convictionScore: 85,
    alphaSignalStrength: 15,
    mew1aAnalysis: {} as any,
    quickAnalysis: {} as any,
    deepAnalysis: {} as any,
    redditSentiment: {} as any,
    ensemble: {} as any,
    liquidityAdjustedFV: 200,
    sellProbability: 0.85,
    daysToSell: 4,
    whaleActivity: false,
  };

  try {
    // Step 1: Fetch card image
    console.log('Step 1: Fetch card image from Pokemon TCG API');
    console.log('-'.repeat(80));
    console.log(`Searching for: ${mockAnalysis.card.name} - ${mockAnalysis.card.setName}`);

    let cardImage = await fetchCardImage(mockAnalysis.card.name, mockAnalysis.card.setName);

    if (!cardImage) {
      console.error('❌ Failed to fetch card image');
      console.log('');
      console.log('Note: This may be due to:');
      console.log('  - Pokemon TCG API rate limits');
      console.log('  - Card name/set mismatch');
      console.log('  - Network issues');
      console.log('');
      console.log('Trying with a different card...');

      // Try Pikachu as fallback
      cardImage = await fetchCardImage('Pikachu', 'Base Set');
      if (!cardImage) {
        console.error('❌ Fallback also failed. Skipping image tests.');
        process.exit(1);
      }
      console.log('✅ Fetched fallback card image (Pikachu - Base Set)');
      // Update mock analysis to match fallback
      mockAnalysis.card.name = 'Pikachu';
      mockAnalysis.card.setName = 'Base Set';
    } else {
      console.log(`✅ Fetched card image (${(cardImage.length / 1024).toFixed(2)} KB)`);
    }
    console.log('');

    // Step 2: Create overlay
    console.log('Step 2: Create price overlay');
    console.log('-'.repeat(80));

    const imageWithOverlay = await createCardOverlay(cardImage, mockAnalysis);
    console.log(`✅ Created overlay (${(imageWithOverlay.length / 1024).toFixed(2)} KB)`);
    console.log('');

    // Step 3: Generate price chart
    console.log('Step 3: Generate 30-day price chart');
    console.log('-'.repeat(80));

    const priceHistory = generateMockPriceHistory(mockAnalysis.pricing.fairValue, 30);
    console.log(`Generated ${priceHistory.length} days of price history`);
    console.log(`Price range: $${Math.min(...priceHistory.map(p => p.price)).toFixed(2)} - $${Math.max(...priceHistory.map(p => p.price)).toFixed(2)}`);

    const chart = await generatePriceChart(mockAnalysis.card.name, priceHistory);
    console.log(`✅ Generated price chart (${(chart.length / 1024).toFixed(2)} KB)`);
    console.log('');

    // Step 4: Combine images
    console.log('Step 4: Combine card + chart for Twitter');
    console.log('-'.repeat(80));

    const combined = await combineImages(imageWithOverlay, chart);
    console.log(`✅ Combined image (${(combined.length / 1024).toFixed(2)} KB)`);
    console.log('   Dimensions: 1200x675 (Twitter optimized)');
    console.log('');

    // Step 5: Generate complete Twitter image
    console.log('Step 5: Generate complete Twitter image');
    console.log('-'.repeat(80));

    const result = await generateTwitterImage(mockAnalysis, priceHistory);
    console.log(`✅ Saved to: ${result.imagePath}`);
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ IMAGE GENERATION TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Generated files:');
    console.log(`  📁 ${result.imagePath}`);
    console.log('');
    console.log('You can view the image to verify:');
    console.log(`  open "${result.imagePath}"`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testImageGeneration();
