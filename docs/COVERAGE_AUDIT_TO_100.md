# Coverage Audit: Path to 100%

**Current Status:**
- Statement Coverage: **96.15%**
- Branch Coverage: **80.44%**
- Function Coverage: **100%** ✅

**Goal:** Achieve 100% statement and branch coverage

---

## Detailed Analysis of Uncovered Code

### 1. ai-ensemble.ts (91.13% coverage, 65.62% branch coverage)

**Uncovered Lines:** 547-551, 568, 584

#### Line 547-551: extractList() method
```typescript
return match[1]
  .split(/[,\n]/)        // Line 548
  .map(item => item.trim())  // Line 549
  .filter(item => item.length > 0)  // Line 550
  .slice(0, 3);  // Line 551
```

**Issue:** This code only executes when `match` exists. The `if (!match) return []` on line 545 causes early return in tests.

**Root Cause:** DeepSeek responses in tests don't contain properly formatted list sections matching the regex pattern `${section}:\\s*\\[(.*?)\\]`

**Solution:** Create test with properly formatted DeepSeek response containing lists.

#### Line 568: extractMew1ARecommendation() NEUTRAL fallback
```typescript
return 'NEUTRAL';  // Line 568
```

**Issue:** Tests always hit BUY or PASS branches, never the NEUTRAL fallback.

**Root Cause:** Mew-1A always returns text containing "buy" or "pass" in real responses.

**Solution:** Mock a response that contains neither "buy" nor "pass".

#### Line 584: extractMew1AConfidence() default fallback
```typescript
return 60; // Neutral  // Line 584
```

**Issue:** All test paths hit the other conditional branches (hasBuy, hasPass).

**Root Cause:** Mew-1A responses always contain "buy" or "pass" keywords.

**Solution:** Mock a response with no confidence score and no buy/pass keywords.

#### Branch Coverage Issues (65.62%)

Missing branch coverage in:
- Line 545: `if (!match) return []` - both true/false branches
- Line 550: `.filter(item => item.length > 0)` - both conditions
- Line 580-583: Multiple if statements with untested branches

---

### 2. image-generator.ts (98.99% coverage, 97.67% branch coverage)

**Uncovered Lines:** 15-16

```typescript
if (!fs.existsSync(IMAGES_DIR)) {  // Line 14
  fs.mkdirSync(IMAGES_DIR, { recursive: true });  // Lines 15-16
}
```

**Issue:** The `data/images` directory already exists when tests run, so lines 15-16 never execute.

**Root Cause:** Directory is created once and persists across test runs.

**Solution:**
1. Delete the directory before running a specific test
2. Verify mkdir is called
3. Restore directory after test

#### Branch Coverage (97.67%)

Missing: The false branch of `if (!fs.existsSync(IMAGES_DIR))`

---

### 3. redis.ts (100% statement, 85.71% branch coverage)

**Uncovered Line:** None (100% statement coverage)

**Branch Issue:** Line 3

```typescript
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
```

**Missing Branch:** The `|| 'redis://localhost:6379'` fallback is not tested.

**Root Cause:** Tests always have `REDIS_URL` set in environment.

**Solution:** Create test that unsets `REDIS_URL` and verifies fallback.

#### Additional Branch Issues (85.71%)

Line 10: `socket: isTLS ? { ... } : undefined`
- Both branches need testing (TLS and non-TLS)

---

## Action Plan to Reach 100%

### Phase 1: Fix ai-ensemble.ts (Priority: HIGH)

**Test 1: extractList() with matched lists**
```typescript
it('should extract and process lists from DeepSeek response', () => {
  const mockResponse = `
THESIS: Good investment
RISKS: [Risk 1, Risk 2, Risk 3, Risk 4, Risk 5]
CATALYSTS: [Cat 1
Cat 2
Cat 3]
TARGET: $100
CONFIDENCE: 80
  `;
  // This will hit lines 547-551
});
```

**Test 2: Mew-1A NEUTRAL recommendation**
```typescript
it('should return NEUTRAL when no buy/pass keywords', () => {
  const response = 'This is interesting. Market is uncertain.';
  // This will hit line 568
});
```

**Test 3: Mew-1A confidence fallback**
```typescript
it('should return 60 when no confidence and no keywords', () => {
  const response = 'Market analysis shows mixed signals.';
  const discount = 5; // Not extreme
  // This will hit line 584
});
```

### Phase 2: Fix image-generator.ts (Priority: MEDIUM)

**Test: Directory creation**
```typescript
it('should create images directory if not exists', () => {
  const imagesDir = path.join(process.cwd(), 'data', 'images');

  // Delete directory before test
  if (fs.existsSync(imagesDir)) {
    fs.rmSync(imagesDir, { recursive: true });
  }

  // Re-import module to trigger directory creation
  delete require.cache[require.resolve('../image-generator.js')];
  require('../image-generator.js');

  expect(fs.existsSync(imagesDir)).toBe(true);
});
```

### Phase 3: Fix redis.ts (Priority: LOW)

**Test 1: REDIS_URL fallback**
```typescript
it('should use default URL when REDIS_URL not set', () => {
  const originalUrl = process.env.REDIS_URL;
  delete process.env.REDIS_URL;

  // Re-import redis module
  vi.resetModules();
  const { getRedis } = await import('../redis.js');

  // Verify default URL is used
  const client = getRedis();
  expect(client).toBeDefined();

  process.env.REDIS_URL = originalUrl;
});
```

**Test 2: Non-TLS configuration**
```typescript
it('should configure without TLS for standard redis://', () => {
  process.env.REDIS_URL = 'redis://localhost:6379';

  vi.resetModules();
  const { getRedis } = await import('../redis.js');

  const client = getRedis();
  expect(client).toBeDefined();
  // Verify no TLS socket configuration
});
```

---

## Branch Coverage Deep Dive

### Current: 80.44% → Target: 100%

**Missing Branches by File:**

#### ai-ensemble.ts (65.62% → 100%)
- Line 545: `if (!match)` - Need false branch (match exists)
- Line 550: `.filter(item => item.length > 0)` - Need items with length > 0
- Line 566: `if (lower.includes('buy') || lower.includes('strong buy'))` - Both conditions
- Line 567: `if (lower.includes('pass') || lower.includes('avoid'))` - Both conditions
- Line 574: `if (match)` - Need false branch
- Line 580: `if (hasBuy && discount < -15)` - Both true
- Line 581: `if (hasBuy && discount < -10)` - Both true
- Line 582: `if (hasPass && discount > 10)` - Both true
- Line 583: `if (hasBuy || hasPass)` - Both conditions

#### image-generator.ts (97.67% → 100%)
- Line 14: `if (!fs.existsSync(IMAGES_DIR))` - Need true branch

#### redis.ts (85.71% → 100%)
- Line 3: `process.env.REDIS_URL || 'redis://localhost:6379'` - Need fallback
- Line 6: `redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io')` - Both conditions
- Line 10: `isTLS ? { ... } : undefined` - Both branches

---

## Estimated Effort

| Task | Time | Priority |
|------|------|----------|
| ai-ensemble.ts edge cases | 2 hours | HIGH |
| image-generator.ts directory test | 15 min | MEDIUM |
| redis.ts env fallback tests | 30 min | LOW |
| **Total** | **2h 45min** | |

---

## Success Criteria

✅ **Statement Coverage: 100%**
- ai-ensemble.ts: 91.13% → 100%
- image-generator.ts: 98.99% → 100%
- redis.ts: 100% (maintained)

✅ **Branch Coverage: 100%**
- ai-ensemble.ts: 65.62% → 100%
- image-generator.ts: 97.67% → 100%
- redis.ts: 85.71% → 100%

✅ **Function Coverage: 100%** (already achieved)

---

## Next Steps

1. ✅ Create comprehensive test file for ai-ensemble edge cases
2. ✅ Add directory creation test for image-generator
3. ✅ Add environment fallback tests for redis
4. ✅ Run coverage and verify 100%
5. ✅ Document final results
