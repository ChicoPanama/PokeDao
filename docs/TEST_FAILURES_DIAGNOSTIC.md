# Test Failures Diagnostic Report

**Generated:** 2026-01-24
**Package Manager:** pnpm
**Test Runner:** Vitest

---

## Summary

| # | Test Area | Failure Type | Severity | Fix Complexity |
|---|-----------|--------------|----------|----------------|
| 1 | `packages/reddit-sentiment` | No test files | Low | Trivial |
| 2 | Image Generator E2E | Function signature mismatch | High | Simple |
| 3 | Reddit Scraper | Test expectation vs implementation mismatch | Medium | Simple |
| 4 | AI Ensemble Real | External service timeout | Low | Configuration |

---

## Issue 1: `packages/reddit-sentiment` - No Test Files

### Exact Error
```
DEV  v0.34.6 /Users/arcadio/dev/pokedao/packages/reddit-sentiment
include: **/*.{test,spec}.?(c|m)[jt]s?(x)
exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*
watch exclude:  **/node_modules/**, **/dist/**
No test files found, exiting with code 1
```

### File Location
```
packages/reddit-sentiment/package.json:8
  "scripts": {
    "test": "vitest"  <-- This script exists but no test files do
  }
```

### Root Cause
The `@pokedao/reddit-sentiment` package has a `test` script configured in `package.json` that runs `vitest`, but the package contains **zero test files**. Vitest exits with code 1 when it finds no tests.

**Directory contents:**
```
packages/reddit-sentiment/
├── dist/
├── src/
│   ├── index.ts
│   └── ... (no *.test.ts or *.spec.ts files)
├── package.json
└── tsconfig.json
```

### Code Snippet
**packages/reddit-sentiment/package.json:7-10**
```json
"scripts": {
  "build": "tsc",
  "dev": "tsc --watch",
  "test": "vitest"   // <-- Runs vitest but no tests exist
}
```

### Recommended Fix

**Option A: Remove test script (if no tests needed)**
```json
"scripts": {
  "build": "tsc",
  "dev": "tsc --watch"
  // Remove "test" script entirely
}
```

**Option B: Add placeholder test file**
Create `packages/reddit-sentiment/src/__tests__/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RedditSentimentAnalyzer } from '../index.js';

describe('Reddit Sentiment Package', () => {
  it('should export RedditSentimentAnalyzer', () => {
    expect(RedditSentimentAnalyzer).toBeDefined();
  });
});
```

**Option C: Configure vitest to pass when no tests found**
Add to package.json or vitest.config.ts:
```json
"test": "vitest --passWithNoTests"
```

---

## Issue 2: Image Generator E2E - Function Signature Mismatch

### Exact Error
```
× Image Generator - E2E Real API Tests > generatePriceChart - Real SVG Generation > should generate real SVG chart for BULLISH signal 24ms
  → priceHistory.map is not a function

× Image Generator - E2E Real API Tests > createCardOverlay - Real Image Processing > should create real overlay on Charizard image 361ms
  → Cannot read properties of undefined (reading 'replace')
```

### File Locations
- **Test file:** `api/src/lib/__tests__/image-generator-e2e.test.ts:44-74`
- **Implementation:** `api/src/lib/image-generator.ts:121-221`

### Root Cause

**Function signature mismatch.** The test is calling `generatePriceChart` with incorrect argument order.

**Implementation signature:**
```typescript
// api/src/lib/image-generator.ts:121-124
export async function generatePriceChart(
  cardName: string,                                    // First: card name (STRING)
  priceHistory: Array<{ date: Date; price: number }>   // Second: price history (ARRAY)
): Promise<Buffer>
```

**Test invocation (WRONG):**
```typescript
// api/src/lib/__tests__/image-generator-e2e.test.ts:46
const svg = await generatePriceChart(history, 'BULLISH');
//                                   ^^^^^^^  ^^^^^^^^
//                                   ARRAY    STRING
// Passes array as first arg, string as second
```

**What happens:**
1. `cardName` receives the `history` array instead of a string
2. `priceHistory` receives `'BULLISH'` string instead of array
3. Line 133: `priceHistory.map(p => p.price)` fails because `'BULLISH'.map` is not a function

**Similar issue with `createCardOverlay`:**
The test passes a mock object that doesn't match the `AIAnalysisResult` type expected by the function. The mock is missing the `recommendation` field (line 69 expects `analysisResult.recommendation`), and the function tries to call `.replace()` on `undefined`.

### Code Snippet

**Test (INCORRECT):**
```typescript
// api/src/lib/__tests__/image-generator-e2e.test.ts:44-56
it('should generate real SVG chart for BULLISH signal', async () => {
  const history = generateMockPriceHistory(100, 30);
  const svg = await generatePriceChart(history, 'BULLISH');  // WRONG ORDER!
  //                                   ↑        ↑
  //                                   array    string
  //                                   should be: (cardName, history)
});
```

**Implementation:**
```typescript
// api/src/lib/image-generator.ts:121-133
export async function generatePriceChart(
  cardName: string,
  priceHistory: Array<{ date: Date; price: number }>
): Promise<Buffer> {
  // ...
  const prices = priceHistory.map(p => p.price);  // LINE 133 - CRASHES HERE
  //             ↑
  //             priceHistory is 'BULLISH' string, not array
```

### Recommended Fix

**Fix the test file** to match the function signature:

```typescript
// api/src/lib/__tests__/image-generator-e2e.test.ts

// BEFORE (line 46):
const svg = await generatePriceChart(history, 'BULLISH');

// AFTER:
const svg = await generatePriceChart('Charizard', history);
// Note: Signal type ('BULLISH') was never used - the function doesn't accept it
```

**For createCardOverlay tests**, ensure the mock matches `AIAnalysisResult` interface:
```typescript
const mockAnalysis = {
  signal: 'BUY' as const,
  recommendation: 'BUY',  // ADD THIS - function uses it at line 69
  // ... rest of mock
};
```

---

## Issue 3: Reddit Scraper - Test Expectation vs Implementation Mismatch

### Exact Errors
```
× Reddit Scraper - Full Coverage > fetchSubredditPosts > should throw error when Reddit API fails 3024ms
  → promise resolved "[]" instead of rejecting

× Reddit Scraper - Full Coverage > fetchSubredditPosts > should fetch with different sort options 2ms
  → expected "spy" to be called with arguments: [ StringContaining{…}, Any<Object> ]
  Number of calls: 0
```

### File Locations
- **Test file:** `api/src/lib/__tests__/reddit-scraper-full.test.ts:87-98, 100-125`
- **Implementation:** `api/src/lib/reddit-scraper.ts:151-172`

### Root Cause

**Error 1: "promise resolved '[]' instead of rejecting"**

The test expects `fetchSubredditPosts` to throw an error when Reddit API fails, but the **actual implementation catches errors and returns an empty array** for graceful degradation:

```typescript
// api/src/lib/reddit-scraper.ts:167-171
} catch (error: any) {
  console.error(`[reddit-scraper] Failed to fetch r/${subreddit}: ${error.message}`);
  // Return empty array instead of throwing to allow graceful degradation
  return [];  // <-- Implementation returns [], test expects throw
}
```

**Error 2: "expected spy to be called... Number of calls: 0"**

The mock isn't being used because:
1. First test opens the circuit breaker (after 3 failed retries)
2. Subsequent tests immediately fail due to open circuit breaker
3. `fetchWithRetry` throws before `global.fetch` is ever called

The circuit breaker state persists between tests:
```typescript
// api/src/lib/reddit-scraper.ts:21-23
let circuitOpen = false;  // Module-level state
let lastFailureTime = 0;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 minutes
```

### Code Snippet

**Test expectation (WRONG):**
```typescript
// api/src/lib/__tests__/reddit-scraper-full.test.ts:87-98
it('should throw error when Reddit API fails', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
  });

  // Test expects rejection, but function returns []
  await expect(fetchSubredditPosts('PokeInvesting'))
    .rejects.toThrow('Reddit API error: 429 Too Many Requests');
});
```

**Implementation (intentionally doesn't throw):**
```typescript
// api/src/lib/reddit-scraper.ts:151-172
export async function fetchSubredditPosts(/*...*/): Promise<RedditPost[]> {
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }
    // ...
  } catch (error: any) {
    console.error(`[reddit-scraper] Failed to fetch r/${subreddit}: ${error.message}`);
    return [];  // <-- Graceful degradation, doesn't throw
  }
}
```

### Recommended Fix

**Option A: Update tests to match implementation behavior**
```typescript
// api/src/lib/__tests__/reddit-scraper-full.test.ts

it('should return empty array when Reddit API fails (graceful degradation)', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
  });

  const result = await fetchSubredditPosts('PokeInvesting');
  expect(result).toEqual([]);  // Matches actual behavior
});
```

**Option B: Reset circuit breaker between tests**
```typescript
// Add beforeEach to reset module state
import { resetCircuitBreaker } from '../reddit-scraper.js';  // Need to export this

beforeEach(() => {
  resetCircuitBreaker();  // Reset circuit breaker state
  vi.clearAllMocks();
});
```

**Option C: Mock at fetchWithRetry level instead of global.fetch**
The tests should mock `fetchWithRetry` directly to avoid circuit breaker interference.

---

## Issue 4: AI Ensemble Real - External Service Timeout

### Exact Error
```
stderr | src/lib/__tests__/ai-ensemble-real.test.ts > AI Ensemble Engine - Real API Tests > should analyze card with Ollama and DeepSeek
vLLM inference failed, falling back to Modal: The operation was aborted due to timeout

stderr | src/lib/__tests__/ai-ensemble-fast-real.test.ts > AI Ensemble - Fast Real API Tests > should analyze card with real Ollama + DeepSeek
vLLM inference failed, falling back to Modal: The operation was aborted due to timeout
```

### File Locations
- **Test files:**
  - `api/src/lib/__tests__/ai-ensemble-real.test.ts`
  - `api/src/lib/__tests__/ai-ensemble-fast-real.test.ts`
- **Implementation:** `api/src/lib/ai-ensemble.ts` (Mew-1A vLLM endpoint)

### Root Cause

These are **not failures** - they are **expected behaviors logged to stderr**. The tests are attempting to call:

1. **Mew-1A vLLM endpoint** (`https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run`)
2. The endpoint has a **cold start** of 60+ seconds on Modal Labs serverless GPU
3. The test timeout triggers before the cold start completes
4. The system falls back to Modal (which also times out)

The tests **pass** despite these warnings because they have try/catch blocks that handle timeouts gracefully:

```typescript
// api/src/lib/__tests__/ai-ensemble-real.test.ts:75-81
} catch (error: any) {
  if (error.message.includes('ECONNREFUSED')) {
    console.warn('⚠️  Ollama not running - skipping real API test');
    expect(true).toBe(true); // Pass test if Ollama not available
  } else {
    throw error;
  }
}
```

### Code Snippet

**Test configuration:**
```typescript
// api/src/lib/__tests__/ai-ensemble-real.test.ts:7-11
const engine = new AIEnsembleEngine({
  deepseekApiKey: DEEPSEEK_API_KEY,
  ollamaURL: 'http://localhost:11434',                                    // Local Ollama
  mew1aEndpoint: 'https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run',  // Modal serverless
});
```

**Timeout configuration:**
```typescript
// api/src/lib/__tests__/ai-ensemble-real.test.ts:83
}, 120000); // 2 min timeout for real APIs
```

### Recommended Fix

These warnings are informational and **tests pass**. However, to clean up the output:

**Option A: Skip vLLM/Mew-1A in CI environments**
```typescript
const skipMew1A = process.env.CI === 'true' || !process.env.MEW1A_WARM;

const engine = new AIEnsembleEngine({
  deepseekApiKey: DEEPSEEK_API_KEY,
  ollamaURL: 'http://localhost:11434',
  mew1aEndpoint: skipMew1A ? undefined : 'https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run',
});
```

**Option B: Add conditional skip for external service tests**
```typescript
describe.skipIf(!process.env.RUN_EXTERNAL_TESTS)('AI Ensemble Engine - Real API Tests', () => {
  // Tests that require external services
});
```

**Option C: Pre-warm Mew-1A before running tests**
Add a setup script that pings the Modal endpoint before tests run:
```bash
# scripts/prewarm-mew1a.sh
curl -X POST https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run/health
sleep 5
```

---

## Priority Order for Fixes

| Priority | Issue | Reason |
|----------|-------|--------|
| 1 | Image Generator E2E (#2) | High-severity - tests are broken due to code mismatch |
| 2 | Reddit Scraper (#3) | Medium-severity - tests don't match implementation contract |
| 3 | reddit-sentiment (#1) | Low-severity - easy fix, just missing test files |
| 4 | AI Ensemble (#4) | Low-severity - tests pass, just noisy output |

---

## Commands to Verify Fixes

After applying fixes:

```bash
# Test individual packages
pnpm --filter @pokedao/api test -- --run
pnpm --filter @pokedao/reddit-sentiment test -- --run --passWithNoTests

# Run all tests with verbose output
pnpm test -- --run --reporter=verbose
```
