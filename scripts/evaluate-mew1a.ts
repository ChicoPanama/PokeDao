#!/usr/bin/env tsx
/**
 * MEW-1A EVALUATION FRAMEWORK
 *
 * Automated testing and benchmarking for Mew-1A models.
 * Compare v1 vs v4.2, test accuracy, measure performance.
 *
 * Usage:
 *   pnpm tsx scripts/evaluate-mew1a.ts --model v4.2
 *   pnpm tsx scripts/evaluate-mew1a.ts --compare v1 v4.2
 *   pnpm tsx scripts/evaluate-mew1a.ts --benchmark
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Model endpoints
const ENDPOINTS = {
  "v1-modal": "https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run",
  "v4.2-vllm": "https://chicopanama--mew1a-vllm-v4-2-fastapi-app.modal.run/analyze",
  "local-ollama": "http://localhost:11434/api/generate",
};

// Test cases with expected recommendations
const TEST_CASES = [
  {
    name: "Strong BUY - Charizard ex (13% discount)",
    card_name: "Charizard ex",
    set_name: "Obsidian Flames",
    listed_price: 45.0,
    fair_value: 52.0,
    expected: "BUY",
    confidence: "high",
  },
  {
    name: "Clear PASS - Pikachu VMAX (overpriced 26%)",
    card_name: "Pikachu VMAX",
    set_name: "Vivid Voltage",
    listed_price: 120.0,
    fair_value: 95.0,
    expected: "PASS",
    confidence: "high",
  },
  {
    name: "Marginal BUY - Umbreon VMAX (small 5% discount)",
    card_name: "Umbreon VMAX",
    set_name: "Evolving Skies",
    listed_price: 95.0,
    fair_value: 100.0,
    expected: "BUY",
    confidence: "medium",
  },
  {
    name: "Fair Price - Mewtwo V (at market value)",
    card_name: "Mewtwo V",
    set_name: "Pokemon GO",
    listed_price: 15.0,
    fair_value: 15.0,
    expected: "PASS",
    confidence: "medium",
  },
  {
    name: "Extreme BUY - Rayquaza VMAX (40% discount)",
    card_name: "Rayquaza VMAX",
    set_name: "Evolving Skies",
    listed_price: 60.0,
    fair_value: 100.0,
    expected: "BUY",
    confidence: "high",
  },
];

interface EvaluationResult {
  test_name: string;
  model: string;
  response: string;
  recommendation: string;
  expected: string;
  correct: boolean;
  inference_time: number;
  tokens?: number;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function printHeader(text: string) {
  console.log("\n" + "=".repeat(80));
  console.log(text);
  console.log("=".repeat(80) + "\n");
}

function printSuccess(text: string) {
  console.log(`${colors.green}✓${colors.reset} ${text}`);
}

function printError(text: string) {
  console.log(`${colors.red}✗${colors.reset} ${text}`);
}

function printInfo(text: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${text}`);
}

async function callModel(
  endpoint: string,
  model: string,
  testCase: typeof TEST_CASES[0]
): Promise<{ response: string; recommendation: string; time: number; tokens?: number }> {
  const startTime = Date.now();

  try {
    if (model === "local-ollama") {
      // Ollama local inference
      const prompt = `Analyze: ${testCase.card_name} from ${testCase.set_name}. Listed at $${testCase.listed_price}, fair value $${testCase.fair_value}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mew1a:v42-q4_k_m",
          prompt,
          stream: false,
        }),
      });

      const data = await response.json();
      const time = (Date.now() - startTime) / 1000;

      // Extract recommendation from response
      const responseText = data.response;
      let recommendation = "NEUTRAL";
      if (responseText.toUpperCase().includes("BUY") && !responseText.toUpperCase().includes("PASS")) {
        recommendation = "BUY";
      } else if (responseText.toUpperCase().includes("PASS")) {
        recommendation = "PASS";
      } else if (responseText.toUpperCase().includes("HOLD")) {
        recommendation = "HOLD";
      }

      return {
        response: responseText,
        recommendation,
        time,
      };
    } else {
      // Modal cloud inference
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_name: testCase.card_name,
          set_name: testCase.set_name,
          listed_price: testCase.listed_price,
          fair_value: testCase.fair_value,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
      const time = data.inference_time || (Date.now() - startTime) / 1000;

      return {
        response: data.analysis || data.response,
        recommendation: data.recommendation || "NEUTRAL",
        time,
        tokens: data.tokens,
      };
    }
  } catch (error: any) {
    throw new Error(`Model call failed: ${error.message}`);
  }
}

async function evaluateModel(model: string, endpoint: string): Promise<EvaluationResult[]> {
  printHeader(`EVALUATING ${model.toUpperCase()}`);

  const results: EvaluationResult[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`\n${colors.cyan}Test:${colors.reset} ${testCase.name}`);

    try {
      const result = await callModel(endpoint, model, testCase);

      const correct = result.recommendation === testCase.expected;

      if (correct) {
        printSuccess(`Recommendation: ${result.recommendation} (${result.time.toFixed(2)}s)`);
      } else {
        printError(
          `Recommendation: ${result.recommendation} (expected ${testCase.expected}) (${result.time.toFixed(2)}s)`
        );
      }

      console.log(`${colors.gray}Response: ${result.response.slice(0, 100)}...${colors.reset}`);

      results.push({
        test_name: testCase.name,
        model,
        response: result.response,
        recommendation: result.recommendation,
        expected: testCase.expected,
        correct,
        inference_time: result.time,
        tokens: result.tokens,
      });
    } catch (error: any) {
      printError(`Test failed: ${error.message}`);

      results.push({
        test_name: testCase.name,
        model,
        response: error.message,
        recommendation: "ERROR",
        expected: testCase.expected,
        correct: false,
        inference_time: 0,
      });
    }
  }

  return results;
}

function printSummary(results: EvaluationResult[]) {
  printHeader("EVALUATION SUMMARY");

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.model]) acc[r.model] = [];
    acc[r.model].push(r);
    return acc;
  }, {} as Record<string, EvaluationResult[]>);

  for (const [model, modelResults] of Object.entries(grouped)) {
    console.log(`\n${colors.blue}${model.toUpperCase()}${colors.reset}`);

    const correct = modelResults.filter((r) => r.correct).length;
    const total = modelResults.length;
    const accuracy = (correct / total) * 100;

    const avgTime =
      modelResults.reduce((sum, r) => sum + r.inference_time, 0) / modelResults.filter((r) => r.inference_time > 0).length;

    const totalTokens = modelResults.reduce((sum, r) => sum + (r.tokens || 0), 0);

    console.log(`  Accuracy: ${correct}/${total} (${accuracy.toFixed(1)}%)`);
    console.log(`  Avg Inference Time: ${avgTime.toFixed(2)}s`);
    if (totalTokens > 0) {
      console.log(`  Total Tokens: ${totalTokens}`);
      console.log(`  Tokens/sec: ${(totalTokens / modelResults.reduce((sum, r) => sum + r.inference_time, 0)).toFixed(1)}`);
    }

    // Show failures
    const failures = modelResults.filter((r) => !r.correct);
    if (failures.length > 0) {
      console.log(`\n  ${colors.red}Failures:${colors.reset}`);
      failures.forEach((f) => {
        console.log(`    • ${f.test_name}`);
        console.log(`      Expected: ${f.expected}, Got: ${f.recommendation}`);
      });
    }
  }
}

function compareModels(results: EvaluationResult[]) {
  printHeader("MODEL COMPARISON");

  const models = [...new Set(results.map((r) => r.model))];

  if (models.length < 2) {
    console.log("Need at least 2 models to compare.");
    return;
  }

  console.log("\n| Metric | " + models.join(" | ") + " |");
  console.log("|--------|" + models.map(() => "---").join("|") + "|");

  // Accuracy
  const accuracies = models.map((m) => {
    const modelResults = results.filter((r) => r.model === m);
    const correct = modelResults.filter((r) => r.correct).length;
    return `${((correct / modelResults.length) * 100).toFixed(1)}%`;
  });
  console.log("| Accuracy | " + accuracies.join(" | ") + " |");

  // Avg inference time
  const avgTimes = models.map((m) => {
    const modelResults = results.filter((r) => r.model === m && r.inference_time > 0);
    const avg = modelResults.reduce((sum, r) => sum + r.inference_time, 0) / modelResults.length;
    return `${avg.toFixed(2)}s`;
  });
  console.log("| Avg Time | " + avgTimes.join(" | ") + " |");

  // Tokens/sec
  const tokensPerSec = models.map((m) => {
    const modelResults = results.filter((r) => r.model === m && r.tokens);
    if (modelResults.length === 0) return "N/A";
    const totalTokens = modelResults.reduce((sum, r) => sum + (r.tokens || 0), 0);
    const totalTime = modelResults.reduce((sum, r) => sum + r.inference_time, 0);
    return `${(totalTokens / totalTime).toFixed(1)}`;
  });
  console.log("| Tokens/sec | " + tokensPerSec.join(" | ") + " |");

  console.log();
}

async function benchmark(endpoint: string, model: string, iterations: number = 10) {
  printHeader(`BENCHMARKING ${model.toUpperCase()} (${iterations} iterations)`);

  const testCase = TEST_CASES[0]; // Use first test case
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    process.stdout.write(`\rIteration ${i + 1}/${iterations}...`);

    try {
      const result = await callModel(endpoint, model, testCase);
      times.push(result.time);
    } catch (error: any) {
      printError(`Iteration ${i + 1} failed: ${error.message}`);
    }
  }

  console.log("\n");

  if (times.length === 0) {
    printError("All benchmark iterations failed");
    return;
  }

  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

  console.log(`Results (${times.length} successful iterations):`);
  console.log(`  Average: ${avg.toFixed(2)}s`);
  console.log(`  Median:  ${median.toFixed(2)}s`);
  console.log(`  Min:     ${min.toFixed(2)}s`);
  console.log(`  Max:     ${max.toFixed(2)}s`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--benchmark")) {
    const modelIndex = args.indexOf("--model");
    const model = modelIndex !== -1 ? args[modelIndex + 1] : "v4.2-vllm";
    const endpoint = ENDPOINTS[model as keyof typeof ENDPOINTS];

    if (!endpoint) {
      console.error(`Unknown model: ${model}`);
      console.error(`Available models: ${Object.keys(ENDPOINTS).join(", ")}`);
      process.exit(1);
    }

    await benchmark(endpoint, model);
    return;
  }

  if (args.includes("--compare")) {
    const compareIndex = args.indexOf("--compare");
    const model1 = args[compareIndex + 1];
    const model2 = args[compareIndex + 2];

    if (!model1 || !model2) {
      console.error("Usage: --compare <model1> <model2>");
      process.exit(1);
    }

    const endpoint1 = ENDPOINTS[model1 as keyof typeof ENDPOINTS];
    const endpoint2 = ENDPOINTS[model2 as keyof typeof ENDPOINTS];

    if (!endpoint1 || !endpoint2) {
      console.error(`Unknown model. Available: ${Object.keys(ENDPOINTS).join(", ")}`);
      process.exit(1);
    }

    const results1 = await evaluateModel(model1, endpoint1);
    const results2 = await evaluateModel(model2, endpoint2);

    const allResults = [...results1, ...results2];

    printSummary(allResults);
    compareModels(allResults);

    return;
  }

  // Default: evaluate single model
  const modelIndex = args.indexOf("--model");
  const model = modelIndex !== -1 ? args[modelIndex + 1] : "v4.2-vllm";
  const endpoint = ENDPOINTS[model as keyof typeof ENDPOINTS];

  if (!endpoint) {
    console.error(`Unknown model: ${model}`);
    console.error(`Available models: ${Object.keys(ENDPOINTS).join(", ")}`);
    process.exit(1);
  }

  const results = await evaluateModel(model, endpoint);
  printSummary(results);
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
