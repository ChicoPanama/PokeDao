/**
 * Test Mew-1A v4.2 Streaming Client
 *
 * Demonstrates the SSE streaming client with various use cases:
 * 1. Health check
 * 2. Streaming with token-by-token output
 * 3. Simple generation (no streaming callback)
 * 4. Multiple concurrent requests
 * 5. Error handling
 */

import { createMew1AClient, generateMew1A, streamMew1A } from '../ml/src/clients/mew1a-streaming';

// ============================================================================
// Terminal Colors
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function printHeader(text: string) {
  console.log('\n' + colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + text + colors.reset);
  console.log(colors.bright + colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

function printSuccess(text: string) {
  console.log(colors.green + '✓ ' + text + colors.reset);
}

function printError(text: string) {
  console.log(colors.red + '✗ ' + text + colors.reset);
}

function printInfo(text: string) {
  console.log(colors.blue + 'ℹ ' + text + colors.reset);
}

function printMetrics(metrics: any) {
  console.log(colors.dim + `\n[${metrics.totalTokens} tokens | ${metrics.elapsedTime.toFixed(2)}s | ${metrics.tokensPerSecond.toFixed(1)} tok/s]` + colors.reset);
}

// ============================================================================
// Test Cases
// ============================================================================

const TEST_PROMPTS = [
  {
    name: 'Price Analysis',
    prompt: 'Analyze: Charizard ex - Obsidian Flames. Listed $45, fair value $52, discount 13%',
  },
  {
    name: 'Buy/Pass Decision',
    prompt: 'BUY or PASS? Pikachu VMAX - Listed $120, Fair Value $95, trending down 12%',
  },
  {
    name: 'Market Trends',
    prompt: 'What is the current market trend for Umbreon VMAX cards?',
  },
  {
    name: 'Investment Comparison',
    prompt: 'Compare: Mewtwo V-UNION vs Lugia VSTAR - which is a better investment?',
  },
];

// ============================================================================
// Test 1: Health Check
// ============================================================================

async function testHealthCheck() {
  printHeader('TEST 1: Health Check');

  const client = createMew1AClient();

  try {
    printInfo('Checking server health...');
    const health = await client.checkHealth();

    printSuccess('Server is healthy!');
    console.log(`  Status: ${health.status}`);
    console.log(`  Model: ${health.modelName}`);
    console.log(`  Model Loaded: ${health.modelLoaded}`);
    console.log(`  Uptime: ${health.uptime.toFixed(0)}s`);
    console.log(`  Startup Time: ${health.startupTime.toFixed(2)}s`);

    return true;
  } catch (error) {
    printError(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ============================================================================
// Test 2: Streaming with Token-by-Token Output
// ============================================================================

async function testStreaming() {
  printHeader('TEST 2: Streaming with Token-by-Token Output');

  const testCase = TEST_PROMPTS[0];
  printInfo(`Prompt: "${testCase.prompt}"`);
  console.log();

  try {
    const metrics = await streamMew1A(
      testCase.prompt,
      (token, done, metrics) => {
        if (done) {
          printMetrics(metrics);
          printSuccess('Streaming complete!');
        } else {
          // Print token in real-time (ChatGPT-style)
          process.stdout.write(colors.bright + token + colors.reset);
        }
      },
      (error) => {
        printError(`Streaming error: ${error.message}`);
      }
    );

    return true;
  } catch (error) {
    printError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ============================================================================
// Test 3: Simple Generation (No Streaming Callback)
// ============================================================================

async function testSimpleGeneration() {
  printHeader('TEST 3: Simple Generation (No Streaming)');

  const testCase = TEST_PROMPTS[1];
  printInfo(`Prompt: "${testCase.prompt}"`);

  try {
    const startTime = Date.now();
    const response = await generateMew1A(testCase.prompt);
    const elapsed = (Date.now() - startTime) / 1000;

    console.log();
    console.log(colors.bright + response + colors.reset);
    console.log(colors.dim + `\n[Generated in ${elapsed.toFixed(2)}s]` + colors.reset);

    printSuccess('Generation complete!');
    return true;
  } catch (error) {
    printError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ============================================================================
// Test 4: Multiple Concurrent Requests
// ============================================================================

async function testConcurrentRequests() {
  printHeader('TEST 4: Multiple Concurrent Requests');

  printInfo('Sending 3 requests concurrently...');

  try {
    const startTime = Date.now();

    const promises = TEST_PROMPTS.slice(0, 3).map(async (testCase, index) => {
      console.log(`\n${colors.yellow}[Request ${index + 1}]${colors.reset} ${testCase.name}`);

      return streamMew1A(
        testCase.prompt,
        (token, done, metrics) => {
          if (done) {
            console.log(
              colors.dim +
              `  → Complete: ${metrics?.totalTokens} tokens in ${metrics?.elapsedTime.toFixed(2)}s` +
              colors.reset
            );
          }
        }
      );
    });

    const results = await Promise.all(promises);
    const totalElapsed = (Date.now() - startTime) / 1000;

    console.log();
    printSuccess(`All ${results.length} requests completed in ${totalElapsed.toFixed(2)}s`);

    // Show per-request metrics
    results.forEach((metrics, index) => {
      console.log(
        `  Request ${index + 1}: ${metrics.totalTokens} tokens @ ${metrics.tokensPerSecond.toFixed(1)} tok/s`
      );
    });

    return true;
  } catch (error) {
    printError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ============================================================================
// Test 5: Error Handling
// ============================================================================

async function testErrorHandling() {
  printHeader('TEST 5: Error Handling');

  printInfo('Testing with invalid endpoint...');

  const client = createMew1AClient({
    streamUrl: 'https://invalid-endpoint.modal.run',
    healthUrl: 'https://invalid-endpoint.modal.run',
    timeout: 5000, // 5 second timeout
  });

  try {
    await client.stream(
      'Test prompt',
      () => {},
      (error) => {
        printInfo(`Error callback triggered: ${error.message}`);
      }
    );

    printError('Expected error was not thrown!');
    return false;
  } catch (error) {
    printSuccess(`Error correctly caught: ${error instanceof Error ? error.message : String(error)}`);
    return true;
  }
}

// ============================================================================
// Test 6: Custom Parameters
// ============================================================================

async function testCustomParameters() {
  printHeader('TEST 6: Custom Parameters');

  const client = createMew1AClient({
    maxTokens: 100,      // Shorter responses
    temperature: 0.7,    // More creative
    topP: 0.95,
  });

  printInfo('Testing with custom parameters (temp=0.7, max_tokens=100)');
  console.log(`Prompt: "${TEST_PROMPTS[2].prompt}"`);
  console.log();

  try {
    const metrics = await client.stream(
      TEST_PROMPTS[2].prompt,
      (token, done, metrics) => {
        if (!done) {
          process.stdout.write(colors.bright + token + colors.reset);
        } else {
          printMetrics(metrics);
        }
      }
    );

    printSuccess('Custom parameters test complete!');
    return true;
  } catch (error) {
    printError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log(colors.bright + colors.magenta);
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   Mew-1A v4.2 Streaming Client Test Suite                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Streaming Output', fn: testStreaming },
    { name: 'Simple Generation', fn: testSimpleGeneration },
    { name: 'Concurrent Requests', fn: testConcurrentRequests },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Custom Parameters', fn: testCustomParameters },
  ];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      results.push({ name: test.name, passed: false });
      printError(`Test "${test.name}" threw exception: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Add spacing between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Print summary
  printHeader('TEST SUMMARY');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    if (result.passed) {
      printSuccess(result.name);
    } else {
      printError(result.name);
    }
  });

  console.log();
  if (passed === total) {
    console.log(colors.bright + colors.green + `✓ All ${total} tests passed!` + colors.reset);
  } else {
    console.log(colors.bright + colors.yellow + `⚠ ${passed}/${total} tests passed` + colors.reset);
  }
  console.log();
}

// Run tests
main().catch((error) => {
  printError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
