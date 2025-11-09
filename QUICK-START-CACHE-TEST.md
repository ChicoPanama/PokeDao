# Quick Start - Run Cache-Optimized Test

**Time:** 35 minutes total (5 min setup + 30 min test)

---

## Simple 4-Step Command Sequence

```bash
# Step 1: Kill old API processes
kill -9 $(lsof -ti:3000) || true

# Step 2: Export cache optimization env vars
export CACHE_TTL_SEARCH=900 CACHE_TTL_ANALYSIS=900 CACHE_TTL_AI=900

# Step 3: Start API your normal way
pnpm --filter @pokedao/api dev   # or pm2/docker/systemd

# Step 4: Run the automated test
chmod +x scripts/run-cache-test-now.sh
API_BASE_URL="http://localhost:3000" \
API_KEYS="test-key-1,test-key-2,test-key-3" \
scripts/run-cache-test-now.sh
```

**That's it!** The script handles:
- Health check (waits up to 5 minutes)
- Cache header verification
- Pre-warming cache
- 30-minute cache-optimized test
- Report generation

---

## What The Script Does

**[scripts/run-cache-test-now.sh](scripts/run-cache-test-now.sh):**
1. Checks `/health` endpoint (retries up to 60 times, 5 sec apart)
2. Runs [scripts/pre-warm-api.ts](scripts/pre-warm-api.ts) (primes cache with top 20 cards)
3. Runs [scripts/generate-synthetic-traffic.ts](scripts/generate-synthetic-traffic.ts) with `--scenario=cache-optimized --duration=30m`
4. Saves results to `/tmp/prewarm.now.log` and `/tmp/traffic-cache-optimized.now.log`
5. Generates report in `scripts/traffic-report-*.md`

---

## Expected Results

### Baseline (From Your 1-Hour Test)
```
✅ Warmup: 60/60 (100%)
✅ Success Rate: 100% (API key users)
❌ Cache Hit Rate: 7.7% (too low)
❌ Client Cache Hits: 0% (broken header)
❌ P95 Latency: 15.2s (too high)
   Avg Latency: 19.8s
   Error Rate: 0%
```

### Target (After Optimizations)
```
✅ Warmup: 60/60 (100%)
✅ Success Rate: 100% (API key users)
✅ Cache Hit Rate: 55-65% (7-8x improvement)
✅ Client Cache Hits: 55-65% (header fixed)
✅ P95 Latency: <10s (33% improvement)
✅ Cached P95: <100ms (new capability)
   Avg Latency: 3-5s (75% improvement)
   Error Rate: <1%
   Response Size: -40-60% (compression)
```

---

## Optional: Verify Cache Headers Work

Before running full test, quickly verify optimizations are deployed:

```bash
# First request (should be MISS)
curl -s "http://localhost:3000/api/cards/search-variants?q=Charizard%20ex&set=Obsidian%20Flames&language=EN" \
  -H "x-api-key: test-key-1" -D- | grep -i "x-cache-status"
# Expected: x-cache-status: MISS

# Second request (should be HIT)
curl -s "http://localhost:3000/api/cards/search-variants?q=Charizard%20ex&set=Obsidian%20Flames&language=EN" \
  -H "x-api-key: test-key-1" -D- | grep -i "x-cache-status"
# Expected: x-cache-status: HIT
```

If you see `x-cache-status: HIT` on the second request, cache optimizations are working! ✅

---

## Optional: Seed Database (If Warmup <90%)

If test warmup fails (<90% success), seed market listings:

```bash
pnpm tsx scripts/seed-market-listings-for-test-cards.ts --debug --limit=5000
```

Expected: 500-3000 rows with ≥90% linkage to canonical_cards.

---

## Optional: Verify Database State

```bash
pnpm tsx scripts/verify-market-state.ts
```

Shows:
- canonical_cards count (should be 60)
- market_listings count (should be ≥40)
- Coverage of curated test cards

---

## Troubleshooting

### API Won't Start

**Check what's on port 3000:**
```bash
lsof -ti:3000
# If something is there, kill it: kill -9 <PID>
```

**Check database/Redis:**
```bash
pg_isready -h localhost -p 5432  # PostgreSQL
redis-cli PING                    # Redis
```

### Warmup Fails (<90% success)

**Check API logs for schema errors:**
```bash
tail -50 /tmp/api-server.log
# Look for "UnifiedMarketListing" errors
```

**If you see `canonicalCardId` errors:**
Edit [api/src/routes/card-comprehensive.ts:187](api/src/routes/card-comprehensive.ts#L187):
- Change: `prisma.unifiedMarketListing.findMany`
- To: `prisma.marketListing.findMany` + add `isActive: true`

Then restart API (go back to Step 1).

### Cache Hit Rate Still Low

**Check Redis has keys:**
```bash
redis-cli KEYS "search:*" | wc -l
# Should show multiple cache keys
```

**Check cache TTL env vars are set:**
```bash
# In your API terminal/logs, look for:
# CACHE_TTL_SEARCH=900
# CACHE_TTL_ANALYSIS=900
# CACHE_TTL_AI=900
```

---

## After Test Completes

**Find your report:**
```bash
ls -lt scripts/traffic-report-*.md | head -1
```

**Compare to baseline:**
- Baseline: `scripts/traffic-report-Normal Baseline-1761871386140.md`
- New test: `scripts/traffic-report-Cache Optimized-<timestamp>.md`

**Key metrics to check:**
- ✅ Cache hit rate: 7.7% → >50%
- ✅ P95 latency: 15.2s → <10s
- ✅ Success rate: 100% maintained
- ✅ Client cache hits: 0% → >50% (header working)

---

## All Documentation

1. **[QUICK-START-CACHE-TEST.md](QUICK-START-CACHE-TEST.md)** - This file (simple 4-step guide)
2. **[RUN-CACHE-TEST-NOW.md](RUN-CACHE-TEST-NOW.md)** - Detailed instructions + troubleshooting
3. **[CACHE-OPTIMIZATION-FINAL-STATUS.md](CACHE-OPTIMIZATION-FINAL-STATUS.md)** - Complete documentation
4. **[CACHE-OPTIMIZATION-IMMEDIATE-ACTION.md](CACHE-OPTIMIZATION-IMMEDIATE-ACTION.md)** - Schema fix details
5. **[CACHE-OPTIMIZATION-TEST-RESULTS.md](CACHE-OPTIMIZATION-TEST-RESULTS.md)** - Analysis of first attempt

**Baseline report:**
- `scripts/traffic-report-Normal Baseline-1761871386140.md`

---

## Summary

✅ All cache optimization code is deployed and ready
✅ Test runner script exists: [scripts/run-cache-test-now.sh](scripts/run-cache-test-now.sh)
✅ Cloudflare tunnel available: `https://terrorists-articles-beginner-diet.trycloudflare.com`

**Next:** Run the 4 commands above, wait 35 minutes, share the report!

**Expected:** 7-8x cache hit improvement, 33% latency improvement, 100% success rate maintained.
