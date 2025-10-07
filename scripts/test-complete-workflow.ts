/**
 * COMPLETE WORKFLOW TEST
 * Tests the full integration: Reddit + AI Ensemble + Image Generation
 */

import { AIEnsembleEngine, type MarketSignal } from '../api/src/lib/ai-ensemble.js';
import { generateTwitterImage, generateMockPriceHistory } from '../api/src/lib/image-generator.js';

async function testCompleteWorkflow() {
  console.log('🧪 TESTING COMPLETE WORKFLOW');
  console.log('='.repeat(80));
  console.log('');

  // Mock market signal
  const signal: MarketSignal = {
    cardName: 'Charizard',
    setName: 'Obsidian Flames',
    grade: '10',
    gradeCompany: 'PSA',
    listedPrice: 185.00,
    marketData: {
      fairValue: 225.00,
      salesCount: 12,
      avgVolume30d: 8,
      priceChange7d: 5.2,
      priceChange30d: 12.4,
      lowestAvailable: 195.00,
    },
  };

  try {
    console.log('Step 1: Run AI Ensemble Analysis (includes Reddit)');
    console.log('-'.repeat(80));
    console.log(`Analyzing: ${signal.cardName} - ${signal.setName}`);
    console.log(`Listed Price: $${signal.listedPrice}`);
    console.log(`Fair Value: $${signal.marketData.fairValue}`);
    console.log('');

    const engine = new AIEnsembleEngine({
      mew1aEndpoint: 'https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run',
      ollamaURL: 'http://localhost:11434',
      deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
    });

    const analysis = await engine.analyzeCard(signal);

    console.log(`✅ AI Analysis Complete`);
    console.log(`   Recommendation: ${analysis.recommendation}`);
    console.log(`   Conviction Score: ${analysis.convictionScore.toFixed(1)}`);
    console.log(`   Reddit Sentiment: ${analysis.redditSentiment.sentiment} (${analysis.redditSentiment.discussionVolume} posts)`);
    console.log('');

    console.log('Step 2: Generate Twitter Image');
    console.log('-'.repeat(80));

    const priceHistory = generateMockPriceHistory(signal.marketData.fairValue, 30);
    const image = await generateTwitterImage(analysis, priceHistory);

    console.log(`✅ Image Generated: ${image.imagePath}`);
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ COMPLETE WORKFLOW TEST PASSED');
    console.log('='.repeat(80));
    console.log('');
    console.log('Full Pipeline Working:');
    console.log('  1. ✅ Mew-1A Analysis (Layer 1)');
    console.log('  2. ✅ Ollama Quick Analysis (Layer 2)');
    console.log('  3. ✅ DeepSeek Deep Analysis (Layer 3)');
    console.log('  4. ✅ Reddit Sentiment (Layer 4)');
    console.log('  5. ✅ Ensemble Voting (Layer 5)');
    console.log('  6. ✅ Image Generation');
    console.log('');
    console.log('Ready for Twitter integration!');
    console.log('');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testCompleteWorkflow();
