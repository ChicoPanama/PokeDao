# Synthetic Traffic Generator Usage Guide

**Purpose:** Test Card Comprehensive Analysis API with realistic traffic patterns

**Files:**
- [scripts/generate-synthetic-traffic.ts](../scripts/generate-synthetic-traffic.ts) - Main script (600 lines)
- [scripts/traffic-generator-cards.json](../scripts/traffic-generator-cards.json) - 60 curated cards
- [scripts/traffic-generator-config.json](../scripts/traffic-generator-config.json) - 4 scenario configs

---

## Common Pitfalls to Avoid

⚠️ **Read this before running tests to save time:**

1. **Missing DEEPSEEK_API_KEY** - API won't start without it. Set to any non-empty string (e.g., `"sk-test"`) for local development.

2. **Missing Redis** - `/health` will show "degraded" and rate limiting + caching won't work. Start with `brew services start redis`.

3. **Empty Database** - If seeds didn't run, `search-variants` returns no matches and warmup fails. Run `pnpm run setup` to reset and seed.

4. **No API_KEYS for high-load scenarios** - Peak/spike/cache-buster scenarios need API keys; otherwise you'll be overwhelmed by 429s (rate limits).

5. **API not running** - Traffic generator expects API at `http://localhost:3000`. Start with `pnpm api:dev` and verify with `curl http://localhost:3000/health`.

6. **Wrong DATABASE_URL** - Ensure it points to a valid Postgres instance with the PokeDAO schema.

---

## Prerequisites

### 1. Start Dependencies

**PostgreSQL:**
```bash
# Verify Postgres is running
psql postgresql://pokedao:pokedao@localhost:5432/pokedao -c "SELECT 1;"
```

**Redis:**
```bash
# Start Redis
brew services start redis

# Verify Redis is running
redis-cli ping
# Expected: PONG
```

### 2. Set Environment Variables

**Required:**
```bash
export DATABASE_URL="postgresql://pokedao:pokedao@localhost:5432/pokedao"
export DEEPSEEK_API_KEY="sk-test"  # Any non-empty string for startup validation
```

**Recommended:**
```bash
export REDIS_URL="redis://localhost:6379"
export MEW1A_CANARY_ENDPOINT="https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/analyze"
export API_KEYS="test-key-1,test-key-2,test-key-3"  # For higher throughput
export TRUST_PROXY="true"  # If behind proxy/CDN
export API_BASE_URL="http://localhost:3000"  # For traffic generator
```

**Add to your shell profile for persistence:**
```bash
echo 'export DATABASE_URL="postgresql://pokedao:pokedao@localhost:5432/pokedao"' >> ~/.zshrc
echo 'export DEEPSEEK_API_KEY="sk-test"' >> ~/.zshrc
echo 'export REDIS_URL="redis://localhost:6379"' >> ~/.zshrc
source ~/.zshrc
```

### 3. Initialize Database

```bash
# Install dependencies
pnpm install

# Run setup (Prisma generate, reset DB, seeds)
pnpm run setup
```

**Verify seeds loaded:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"CanonicalCard\";"
# Expected: >100 rows
```

### 4. Start API Server

```bash
pnpm api:dev
```

**Verify server is ready:**
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok"} or {"status":"degraded"} (if Redis/DB not ready)

# Test search-variants endpoint
curl "http://localhost:3000/api/cards/search-variants?q=Charizard%20ex&set=Obsidian%20Flames"
# Expected: {"ok":true,"matches":[...]}
```

### 5. Verify Metrics Endpoint

```bash
curl http://localhost:3000/metrics | grep api_requests_total
# Expected: Prometheus metrics output
```

### 6. Run Verification Script (Recommended)

Before running any traffic tests, use the verification script to check all prerequisites:

```bash
bash scripts/verify-traffic-generator-setup.sh
```

**This will check:**
- ✅ All required environment variables are set
- ✅ PostgreSQL is running and has seeded data
- ✅ Redis is running and responding
- ✅ API server is healthy
- ✅ All traffic generator files are present

**Expected output:**
```
✓ All checks passed! Ready to run traffic generator.

Quick start:
  pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=5m
```

---

## Quick Start

### Scenario 1: Normal Baseline (1 hour)

Simulates typical traffic with 5 concurrent users.

```bash
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=1h
```

**Expected:**
- Cache hit rate: 60-70%
- Error rate (5xx): <1%
- Rate limit hits (429): <5%
- P95 latency: <10s

### Scenario 2: Peak Traffic (30 minutes)

Simulates evening rush with 15 concurrent users.

```bash
export API_KEYS="key1,key2,key3"
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=peak --duration=30m
```

**Expected:**
- Cache hit rate: 70-80%
- More API key users (45%)
- Higher new tuple budget (50/min)

### Scenario 3: Traffic Spike (15 minutes)

Simulates Product Hunt launch with 30 concurrent users.

```bash
export API_KEYS="key1,key2,key3"
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=spike --duration=15m
```

**Expected:**
- Cache hit rate: 75-85%
- 60% anonymous users
- High new tuple budget (100/min)

### Scenario 4: Cache Buster (10 minutes)

Worst-case scenario with low repeat rate.

```bash
export API_KEYS="key1,key2,key3"
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=cache-buster --duration=10m
```

**Expected:**
- Cache hit rate: 20-30% (intentionally low)
- High long-tail card traffic (40%)
- Low repeat probability (20%)

---

## 5-Minute Sanity Test

Before running long tests, validate implementation:

```bash
# Start API server in separate terminal
pnpm --filter @pokedao/api dev

# Run 5-minute test
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=5m
```

**What to verify:**
- ✅ Warmup phase resolves >90% of cards
- ✅ No HTTP errors during first 10 requests
- ✅ Cache hits appear after 2nd request for same card
- ✅ Rate limit handler triggers correctly for anonymous users
- ✅ Real-time console shows request status

---

## Output Interpretation

### Real-Time Console Output

```
[User 001] ✓ 💾 Charizard ex (223/197) PSA10 EN - 200 (3245ms)
[User 002] ✓ 🔍 Pikachu VMAX (188/185) RAW EN - 200 (4120ms)
[User 003] ⏱️ 💾 Umbreon VMAX (215/203) PSA9 EN - 429 (850ms)
```

**Status Emojis:**
- ✓ = Success (2xx)
- ⏱️ = Rate limited (429)
- ✗ = Error (5xx)

**Cache Emojis:**
- 💾 = Cache HIT (Redis served)
- 🔍 = Cache MISS (AI called)

**Fields:**
- `[User 001]` = Simulated user ID
- `Charizard ex (223/197)` = Card name + number
- `PSA10` = Grade (RAW if no grade)
- `EN` = Language
- `200` = HTTP status code
- `3245ms` = Latency

### Final Report

After completion, a markdown report is generated:

```
scripts/traffic-report-normal-1698765432000.md
```

**Key Metrics:**

| Metric | Good | Warning | Bad |
|--------|------|---------|-----|
| Success Rate | >99% | 95-99% | <95% |
| Error Rate (5xx) | <1% | 1-5% | >5% |
| Cache Hit Rate | >50% | 30-50% | <30% |
| P95 Latency | <5s | 5-10s | >10s |
| Rate Limit Hits | <5% | 5-10% | >10% |

---

## Monitoring Server Metrics

The script automatically scrapes `/metrics` endpoint for ground truth validation.

**Manual check:**
```bash
curl http://localhost:3000/metrics | grep api_cache_hits_total
curl http://localhost:3000/metrics | grep api_requests_total
```

**Server metrics validation:**
- `api_cache_hits_total{endpoint}` = Total cache hits
- `api_requests_total{route,status}` = Total requests
- Cache misses = `totalRequests - cacheHits` (inferred)

---

## Troubleshooting

### Warmup Phase Fails (0% success rate)

**Problem:** All cards fail to resolve during warmup with "fetch failed" errors

**Root Cause:** API server is not running or not accessible

**Solutions:**

1. **Verify API is running:**
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok"}
   ```
   If connection refused: start API with `pnpm api:dev`

2. **Check required environment variables:**
   ```bash
   echo $DATABASE_URL        # Must be set
   echo $DEEPSEEK_API_KEY    # Must be non-empty (use "sk-test" for local dev)
   ```
   If missing: export them and restart API

3. **Verify database has seeds:**
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"CanonicalCard\";"
   ```
   If 0 rows: run `pnpm run setup` to reset and seed

4. **Test search-variants endpoint directly:**
   ```bash
   curl "http://localhost:3000/api/cards/search-variants?q=Charizard%20ex&set=Obsidian%20Flames"
   ```
   Expected: `{"ok":true,"matches":[...]}`

5. **Check API logs for startup errors:**
   - Missing DEEPSEEK_API_KEY: API won't start
   - Missing DATABASE_URL: Prisma client fails
   - Port 3000 already in use: kill existing process with `lsof -ti:3000 | xargs kill`

### API Shows "degraded" Status

**Problem:** `/health` returns `{"status":"degraded"}`

**Solutions:**
1. **Start Redis:**
   ```bash
   brew services start redis
   redis-cli ping  # Should return PONG
   ```

2. **Verify Postgres connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Check API logs** for specific error messages about DB/Redis connectivity

### High Error Rate (>1%)

**Problem:** Many 5xx errors during traffic generation

**Solutions:**
1. Check Mew-1A endpoint is accessible: `curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/health`
2. Check Modal logs for GPU errors: `modal app logs mew1a-vllm-v4-3-shaped`
3. Verify Redis is running: `redis-cli ping`
4. Check PostgreSQL connection pool limits

### Low Cache Hit Rate (<50%)

**Problem:** Cache hit rate below target

**Solutions:**
1. Increase repeat probability in config: `repeatProbability: 0.80`
2. Reduce new tuple budget: `newTuplesBudgetPerMin: 5`
3. Increase Redis TTL in API: `EX: 600` (10 minutes)
4. Focus on mega-popular cards: `mega_popular: 0.60`

### Rate Limits Too High (>10%)

**Problem:** Too many 429s

**Solutions:**
1. Increase `minDelayBetweenRequestsMs` in user profiles
2. Reduce `concurrentUsers` in scenario config
3. Use more API keys: `export API_KEYS="key1,key2,key3,key4,key5"`
4. Reduce traffic duration for testing

### Script Crashes After 1 Hour

**Problem:** Script terminates unexpectedly

**Solutions:**
1. Check Node.js memory: increase with `--max-old-space-size=4096`
2. Monitor Redis memory usage: `redis-cli INFO memory`
3. Check API server logs for errors
4. Run in screen/tmux for long tests: `screen -S traffic pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=24h`

---

## Advanced Configuration

### Custom Scenario

Create a new scenario in `scripts/traffic-generator-config.json`:

```json
{
  "custom": {
    "name": "Custom Scenario",
    "durationMs": 7200000,
    "concurrentUsers": 8,
    "userDistribution": {
      "anonymous": 0.60,
      "api_key": 0.30,
      "power_user": 0.10
    },
    "cardDistribution": {
      "mega_popular": 0.50,
      "popular": 0.30,
      "moderate": 0.15,
      "long_tail": 0.05
    },
    "newTuplesBudgetPerMin": 20,
    "repeatProbability": 0.75
  }
}
```

**Run:**
```bash
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=custom --duration=2h
```

### Add More Cards

Edit `scripts/traffic-generator-cards.json` to add cards:

```json
{
  "name": "Pikachu ex",
  "set": "Scarlet & Violet",
  "cardNumber": "123/198",
  "rarity": "Double Rare",
  "avgPriceRaw": 45,
  "tier": "mega-popular"
}
```

**Tiers:**
- `mega-popular` - Top 20 cards (40% of traffic)
- `popular` - Next 20 cards (35% of traffic)
- `moderate` - Next 15 cards (20% of traffic)
- `long-tail` - Bottom 5 cards (5% of traffic)

### Change API Endpoint

Override default endpoint:

```bash
export API_BASE_URL="https://production-api.example.com"
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=1h
```

---

## 24-Hour Production Test

For full production validation:

```bash
# Set API keys
export API_KEYS="prod-key-1,prod-key-2,prod-key-3,prod-key-4,prod-key-5"

# Run in screen/tmux
screen -S traffic-24h

# Start test
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=24h

# Detach: Ctrl+A, then D
# Reattach: screen -r traffic-24h
```

**Monitor during run:**
```bash
# Check real-time metrics
tail -f scripts/traffic-report-*.md

# Check Redis memory
redis-cli INFO memory | grep used_memory_human

# Check server cache hit rate
curl http://localhost:3000/metrics | grep api_cache_hits_total
```

**After 24 hours:**
- ✅ Success rate >99%
- ✅ Cache hit rate >60%
- ✅ P95 latency <10s
- ✅ Error rate <0.5%
- ✅ Redis memory <500MB

---

## Bug Fixes Implemented

### Fix #1: API Key Pool
❌ **Before:** Generated unique keys (not accepted by API)
✅ **After:** Rotates among `API_KEYS` env var

### Fix #2: HTTP Status Propagation
❌ **Before:** `fetch()` only throws on network errors
✅ **After:** `HttpError` class propagates status codes

### Fix #3: Request Rate Alignment
❌ **Before:** `requestsPerMinPerUser` could exceed tier limits
✅ **After:** `minDelayBetweenRequestsMs` enforces limits (360s anon, 36s API key)

### Fix #4: Unresolved Card Handling
❌ **Before:** Crash if cards not found in warmup
✅ **After:** Track unresolved cards, exclude from traffic

### Fix #5: Server Metrics Parser
❌ **Before:** Expected `api_cache_misses_total` (doesn't exist)
✅ **After:** Infer misses as `totalRequests - cacheHits`

### Fix #6: Anonymous-Only Mode
❌ **Before:** Required API keys for all scenarios
✅ **After:** Allow anonymous-only for smoke tests

---

## Next Steps

1. **Run 5-minute sanity test** to verify implementation
2. **Run 1-hour baseline** to validate cache behavior
3. **Run 24-hour production test** to validate stability
4. **Monitor Redis memory** during long tests
5. **Analyze reports** for performance bottlenecks

---

**Last Updated:** 2025-10-29
**Status:** Implementation complete, ready for testing
