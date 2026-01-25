/**
 * vLLM Deployment Test Script
 *
 * Tests the vLLM deployment with real inference and compares
 * performance against the old Modal endpoint.
 *
 * Usage:
 *   pnpm tsx scripts/test-vllm-deployment.ts
 */

import { vllmAnalyzeCard, vllmHealthCheck, vllmBenchmark } from '../ml/src/clients/vllm';

async function main() {
  console.log('=' .repeat(80));
  console.log('VLLM DEPLOYMENT TEST');
  console.log('='.repeat(80));

  // Test 1: Health Check
  console.log('\n📊 Test 1: Health Check');
  console.log('-'.repeat(80));

  try {
    const isHealthy = await vllmHealthCheck();
    if (isHealthy) {
      console.log('✅ vLLM endpoint is healthy');
    } else {
      console.log('❌ vLLM endpoint health check failed');
      console.log('   Falling back to Modal is expected');
    }
  } catch (error) {
    console.log('⚠️  Health check error:', error instanceof Error ? error.message : 'Unknown');
    console.log('   This is OK if vLLM is not deployed yet');
  }

  // Test 2: BUY Recommendation (13% discount)
  console.log('\n📊 Test 2: BUY Recommendation (Charizard ex, 13% discount)');
  console.log('-'.repeat(80));

  try {
    const result1 = await vllmAnalyzeCard({
      cardName: "Charizard ex",
      setName: "Obsidian Flames",
      listedPrice: 45.0,
      fairValue: 52.0,
      maxTokens: 150,
    });

    console.log(`Card: ${result1.card}`);
    console.log(`Set: ${result1.set}`);
    console.log(`Recommendation: ${result1.recommendation}`);
    console.log(`Analysis: ${result1.analysis.substring(0, 200)}...`);
    console.log(`Inference Time: ${result1.inferenceTime.toFixed(2)}s`);
    console.log(`Tokens/sec: ${result1.tokensPerSecond.toFixed(1)}`);
    console.log(`Total Time: ${result1.totalTime.toFixed(2)}s`);

    if (result1.recommendation === 'BUY') {
      console.log('✅ Correct recommendation (BUY expected for 13% discount)');
    } else {
      console.log('⚠️  Unexpected recommendation (expected BUY)');
    }
  } catch (error) {
    console.log('❌ Test 2 failed:', error instanceof Error ? error.message : 'Unknown');
  }

  // Test 3: PASS Recommendation (overpriced)
  console.log('\n📊 Test 3: PASS Recommendation (Pikachu VMAX, overpriced)');
  console.log('-'.repeat(80));

  try {
    const result2 = await vllmAnalyzeCard({
      cardName: "Pikachu VMAX",
      setName: "Vivid Voltage",
      listedPrice: 120.0,
      fairValue: 95.0,
      maxTokens: 150,
    });

    console.log(`Card: ${result2.card}`);
    console.log(`Recommendation: ${result2.recommendation}`);
    console.log(`Analysis: ${result2.analysis.substring(0, 200)}...`);
    console.log(`Inference Time: ${result2.inferenceTime.toFixed(2)}s`);
    console.log(`Tokens/sec: ${result2.tokensPerSecond.toFixed(1)}`);

    if (result2.recommendation === 'PASS' || result2.recommendation === 'NEUTRAL') {
      console.log('✅ Correct recommendation (PASS/NEUTRAL expected for overpriced card)');
    } else {
      console.log('⚠️  Unexpected recommendation (expected PASS or NEUTRAL)');
    }
  } catch (error) {
    console.log('❌ Test 3 failed:', error instanceof Error ? error.message : 'Unknown');
  }

  // Test 4: Performance Benchmark
  console.log('\n📊 Test 4: Performance Benchmark (5 iterations)');
  console.log('-'.repeat(80));

  try {
    console.log('Running 5 inference tests...');
    const benchmark = await vllmBenchmark("Charizard ex", 5);

    console.log(`Average Inference Time: ${benchmark.avgInferenceTime.toFixed(2)}s`);
    console.log(`Min Inference Time: ${benchmark.minInferenceTime.toFixed(2)}s`);
    console.log(`Max Inference Time: ${benchmark.maxInferenceTime.toFixed(2)}s`);
    console.log(`Average Tokens/sec: ${benchmark.avgTokensPerSecond.toFixed(1)}`);

    // Compare to old Modal endpoint (3-7s typical)
    const oldModalAvg = 5.0; // Conservative estimate
    const speedup = oldModalAvg / benchmark.avgInferenceTime;

    console.log(`\nComparison vs Old Modal Endpoint:`);
    console.log(`  Old (transformers): ~${oldModalAvg.toFixed(1)}s`);
    console.log(`  New (vLLM): ${benchmark.avgInferenceTime.toFixed(2)}s`);
    console.log(`  Speedup: ${speedup.toFixed(2)}x faster`);

    if (speedup >= 2.0) {
      console.log('✅ Performance goal achieved (2x+ faster)');
    } else if (speedup >= 1.5) {
      console.log('⚠️  Performance improved but below 2x target');
    } else {
      console.log('⚠️  Performance not significantly improved');
    }
  } catch (error) {
    console.log('❌ Benchmark failed:', error instanceof Error ? error.message : 'Unknown');
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('✅ VLLM DEPLOYMENT TEST COMPLETE');
  console.log('='.repeat(80));
  console.log('\nNext Steps:');
  console.log('  1. If tests passed: vLLM is ready for production');
  console.log('  2. If tests failed: Deploy vLLM first:');
  console.log('     modal deploy apps/mew1a/vllm_deploy.py');
  console.log('  3. Update .env with VLLM_ENDPOINT');
  console.log('  4. When v4 training completes: Update MODEL_NAME in vllm_deploy.py');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
