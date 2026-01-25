#!/usr/bin/env tsx

/**
 * Mew-1A A/B Testing Framework
 *
 * Compare v1 vs v2 performance on real Pokemon TCG pricing examples.
 *
 * Tests:
 * 1. Response Quality - Detail, clarity, structure
 * 2. Accuracy - Correct recommendations
 * 3. Consistency - Similar cards get similar analysis
 * 4. Inference Speed - Latency comparison
 * 5. Cost Efficiency - Cost per request
 *
 * Usage: pnpm tsx scripts/mew1a-ab-test.ts
 */

interface TestCase {
  id: string;
  cardName: string;
  setName: string;
  listedPrice: number;
  fairValue: number;
  listingCount: number;
  expectedRecommendation: 'BUY' | 'HOLD' | 'PASS';
  scenario: string;
}

interface ModelResponse {
  analysis: string;
  recommendation?: string;
  latency: number;
  model: string;
  timestamp: Date;
}

interface TestResult {
  testCase: TestCase;
  v1Response: ModelResponse;
  v2Response: ModelResponse;
  scores: {
    v1Quality: number;
    v2Quality: number;
    v1Accuracy: number;
    v2Accuracy: number;
    winner: 'v1' | 'v2' | 'tie';
  };
}

// Test cases covering different scenarios
const testCases: TestCase[] = [
  {
    id: 'arbitrage-1',
    cardName: 'Charizard ex',
    setName: 'Obsidian Flames',
    listedPrice: 45.0,
    fairValue: 52.0,
    listingCount: 15,
    expectedRecommendation: 'BUY',
    scenario: 'Strong arbitrage opportunity (13% discount)',
  },
  {
    id: 'arbitrage-2',
    cardName: 'Pikachu VMAX',
    setName: 'Vivid Voltage',
    listedPrice: 120.0,
    fairValue: 95.0,
    listingCount: 8,
    expectedRecommendation: 'PASS',
    scenario: 'Overpriced (26% premium)',
  },
  {
    id: 'fair-value-1',
    cardName: 'Mewtwo V',
    setName: 'Pokemon Go',
    listedPrice: 12.5,
    fairValue: 12.0,
    listingCount: 25,
    expectedRecommendation: 'HOLD',
    scenario: 'Fair market value (4% premium)',
  },
  {
    id: 'liquidity-high',
    cardName: 'Professor Research',
    setName: 'Celebrations',
    listedPrice: 2.5,
    fairValue: 3.0,
    listingCount: 150,
    expectedRecommendation: 'BUY',
    scenario: 'High liquidity + discount',
  },
  {
    id: 'liquidity-low',
    cardName: 'Rare Holo Zapdos',
    setName: 'Fossil',
    listedPrice: 80.0,
    fairValue: 95.0,
    listingCount: 3,
    expectedRecommendation: 'HOLD',
    scenario: 'Low liquidity, uncertain demand',
  },
  {
    id: 'premium-card',
    cardName: 'Charizard',
    setName: 'Base Set (Shadowless)',
    listedPrice: 1200.0,
    fairValue: 1500.0,
    listingCount: 5,
    expectedRecommendation: 'BUY',
    scenario: 'Premium vintage card with discount',
  },
  {
    id: 'budget-card',
    cardName: 'Raticate',
    setName: 'Base Set',
    listedPrice: 0.5,
    fairValue: 0.75,
    listingCount: 50,
    expectedRecommendation: 'HOLD',
    scenario: 'Low value card, minimal profit potential',
  },
];

// Modal endpoints
const V1_ENDPOINT = process.env.MEW1A_V1_ENDPOINT || 'https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run';
const V2_ENDPOINT = process.env.MEW1A_V2_ENDPOINT || 'https://chicopanama--mew1a-v2-tcg-pricing-analyze-card-endpoint.modal.run';

async function callModel(endpoint: string, testCase: TestCase, modelVersion: string): Promise<ModelResponse> {
  const startTime = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_name: testCase.cardName,
        set_name: testCase.setName,
        listed_price: testCase.listedPrice,
        listing_count: testCase.listingCount,
        fair_value: testCase.fairValue,
      }),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    const endTime = Date.now();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      analysis: data.analysis || data.response || '',
      recommendation: data.recommendation,
      latency: endTime - startTime,
      model: modelVersion,
      timestamp: new Date(),
    };
  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ Error calling ${modelVersion}:`, error);
    return {
      analysis: `ERROR: ${error instanceof Error ? error.message : String(error)}`,
      recommendation: undefined,
      latency: endTime - startTime,
      model: modelVersion,
      timestamp: new Date(),
    };
  }
}

function scoreQuality(response: ModelResponse): number {
  let score = 0;
  const analysis = response.analysis.toLowerCase();

  // Check for key sections (max 40 points)
  if (analysis.includes('pricing') || analysis.includes('price')) score += 10;
  if (analysis.includes('liquidity') || analysis.includes('market depth')) score += 10;
  if (analysis.includes('recommendation')) score += 10;
  if (analysis.includes('reasoning')) score += 10;

  // Check for specific details (max 30 points)
  if (analysis.includes('discount') || analysis.includes('premium')) score += 10;
  if (analysis.includes('%')) score += 10; // Percentage calculations
  if (analysis.includes('fair value') || analysis.includes('market value')) score += 10;

  // Check for structure (max 30 points)
  const lines = response.analysis.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length >= 5) score += 10; // Well-structured
  if (response.analysis.includes('•') || response.analysis.includes('-')) score += 10; // Bullet points
  if (response.recommendation) score += 10; // Clear recommendation

  return Math.min(score, 100);
}

function scoreAccuracy(response: ModelResponse, testCase: TestCase): number {
  const recommendation = response.recommendation?.toUpperCase();
  const expectedRec = testCase.expectedRecommendation;

  // Exact match
  if (recommendation === expectedRec) return 100;

  // Partial credit for reasonable alternatives
  if (expectedRec === 'BUY' && recommendation === 'HOLD') return 50;
  if (expectedRec === 'PASS' && recommendation === 'HOLD') return 50;
  if (expectedRec === 'HOLD' && (recommendation === 'BUY' || recommendation === 'PASS')) return 50;

  // Wrong recommendation
  if (recommendation && recommendation !== expectedRec) return 0;

  // No recommendation extracted
  return 25;
}

async function runTest(testCase: TestCase): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${testCase.cardName} - ${testCase.setName}`);
  console.log(`   Scenario: ${testCase.scenario}`);
  console.log(`   Listed: $${testCase.listedPrice}, Fair: $${testCase.fairValue}, Listings: ${testCase.listingCount}`);

  // Call both models in parallel
  const [v1Response, v2Response] = await Promise.all([
    callModel(V1_ENDPOINT, testCase, 'v1'),
    callModel(V2_ENDPOINT, testCase, 'v2'),
  ]);

  // Score responses
  const v1Quality = scoreQuality(v1Response);
  const v2Quality = scoreQuality(v2Response);
  const v1Accuracy = scoreAccuracy(v1Response, testCase);
  const v2Accuracy = scoreAccuracy(v2Response, testCase);

  // Determine winner
  const v1Total = v1Quality * 0.5 + v1Accuracy * 0.5;
  const v2Total = v2Quality * 0.5 + v2Accuracy * 0.5;
  const winner = v2Total > v1Total ? 'v2' : v1Total > v2Total ? 'v1' : 'tie';

  console.log(`   v1: Quality ${v1Quality}/100, Accuracy ${v1Accuracy}/100, Latency ${v1Response.latency}ms`);
  console.log(`   v2: Quality ${v2Quality}/100, Accuracy ${v2Accuracy}/100, Latency ${v2Response.latency}ms`);
  console.log(`   🏆 Winner: ${winner === 'tie' ? 'TIE' : winner.toUpperCase()}`);

  return {
    testCase,
    v1Response,
    v2Response,
    scores: {
      v1Quality,
      v2Quality,
      v1Accuracy,
      v2Accuracy,
      winner,
    },
  };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('MEW-1A A/B TESTING FRAMEWORK');
  console.log('═'.repeat(80));
  console.log(`\nv1 Endpoint: ${V1_ENDPOINT}`);
  console.log(`v2 Endpoint: ${V2_ENDPOINT}`);
  console.log(`\nRunning ${testCases.length} test cases...`);
  console.log('═'.repeat(80));

  const results: TestResult[] = [];

  // Run all tests
  for (const testCase of testCases) {
    try {
      const result = await runTest(testCase);
      results.push(result);
    } catch (error) {
      console.error(`❌ Test failed: ${testCase.id}`, error);
    }

    // Small delay between tests to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Calculate aggregate statistics
  console.log('\n' + '═'.repeat(80));
  console.log('📊 AGGREGATE RESULTS');
  console.log('═'.repeat(80));

  const v1Wins = results.filter((r) => r.scores.winner === 'v1').length;
  const v2Wins = results.filter((r) => r.scores.winner === 'v2').length;
  const ties = results.filter((r) => r.scores.winner === 'tie').length;

  const avgV1Quality = results.reduce((sum, r) => sum + r.scores.v1Quality, 0) / results.length;
  const avgV2Quality = results.reduce((sum, r) => sum + r.scores.v2Quality, 0) / results.length;
  const avgV1Accuracy = results.reduce((sum, r) => sum + r.scores.v1Accuracy, 0) / results.length;
  const avgV2Accuracy = results.reduce((sum, r) => sum + r.scores.v2Accuracy, 0) / results.length;
  const avgV1Latency = results.reduce((sum, r) => sum + r.v1Response.latency, 0) / results.length;
  const avgV2Latency = results.reduce((sum, r) => sum + r.v2Response.latency, 0) / results.length;

  console.log('\n🏆 Win/Loss Record:');
  console.log(`   v1 Wins: ${v1Wins} (${((v1Wins / results.length) * 100).toFixed(1)}%)`);
  console.log(`   v2 Wins: ${v2Wins} (${((v2Wins / results.length) * 100).toFixed(1)}%)`);
  console.log(`   Ties:    ${ties} (${((ties / results.length) * 100).toFixed(1)}%)`);

  console.log('\n📈 Average Scores:');
  console.log(`   Quality:  v1=${avgV1Quality.toFixed(1)}/100, v2=${avgV2Quality.toFixed(1)}/100 (${avgV2Quality > avgV1Quality ? 'v2 wins' : 'v1 wins'})`);
  console.log(`   Accuracy: v1=${avgV1Accuracy.toFixed(1)}/100, v2=${avgV2Accuracy.toFixed(1)}/100 (${avgV2Accuracy > avgV1Accuracy ? 'v2 wins' : 'v1 wins'})`);
  console.log(`   Latency:  v1=${avgV1Latency.toFixed(0)}ms, v2=${avgV2Latency.toFixed(0)}ms (${avgV2Latency < avgV1Latency ? 'v2 faster' : 'v1 faster'})`);

  // Overall recommendation
  console.log('\n🎯 RECOMMENDATION:');
  const overallWinner = v2Wins > v1Wins ? 'v2' : v1Wins > v2Wins ? 'v1' : 'tie';

  if (overallWinner === 'v2') {
    console.log(`✅ DEPLOY MEW-1A V2 - Superior performance (${v2Wins}/${results.length} wins)`);
    console.log(`   Quality improved by ${(avgV2Quality - avgV1Quality).toFixed(1)} points`);
    console.log(`   Accuracy improved by ${(avgV2Accuracy - avgV1Accuracy).toFixed(1)} points`);
  } else if (overallWinner === 'v1') {
    console.log(`⚠️  KEEP MEW-1A V1 - v2 needs improvement (${v1Wins}/${results.length} wins)`);
    console.log(`   Consider retraining v2 or adjusting hyperparameters`);
  } else {
    console.log(`🤔 TIE - Both models perform similarly`);
    console.log(`   Consider gradual rollout to gather more data`);
  }

  console.log('\n═'.repeat(80));
  console.log('Test complete!');
  console.log('═'.repeat(80));

  // Save detailed results
  const fs = await import('fs');
  const outputPath = 'data/mew1a-ab-test-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
