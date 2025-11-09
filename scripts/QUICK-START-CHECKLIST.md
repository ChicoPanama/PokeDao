# Traffic Generator Quick Start Checklist

**Goal:** Run your first 5-minute traffic test in under 10 minutes

---

## ☑️ Pre-Flight Checklist

Copy-paste these commands in order:

### 1. Set Environment Variables (30 seconds)

```bash
export DATABASE_URL="postgresql://pokedao:pokedao@localhost:5432/pokedao"
export DEEPSEEK_API_KEY="sk-test"
export REDIS_URL="redis://localhost:6379"
export API_KEYS="test-key-1,test-key-2,test-key-3"
export API_BASE_URL="http://localhost:3000"
```

### 2. Start Redis (15 seconds)

```bash
brew services start redis
redis-cli ping  # Should return PONG
```

### 3. Initialize Database (2 minutes)

```bash
cd /Users/arcadio/dev/pokedao
pnpm install
pnpm run setup
```

### 4. Start API Server (30 seconds)

**In a separate terminal:**

```bash
cd /Users/arcadio/dev/pokedao
pnpm api:dev
```

**Wait for:** `Server listening on http://localhost:3000`

### 5. Verify Setup (30 seconds)

**In original terminal:**

```bash
bash scripts/verify-traffic-generator-setup.sh
```

**Expected:** `✓ All checks passed! Ready to run traffic generator.`

If errors, fix them before proceeding.

---

## 🚀 Run First Test (5 minutes)

```bash
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=5m
```

**What you'll see:**

```
🚀 Synthetic Traffic Generator for Card Comprehensive Analysis API
Scenario: normal
Duration: 5m
API Base URL: http://localhost:3000
API Keys available: 3

=== Warmup Phase: Resolving Canonical IDs ===
✓ Charizard ex (223/197) → abc123-def456
✓ Pikachu VMAX (188/185) → xyz789-uvw456
...
Warmup complete: 58/60 resolved (96.7%)

=== Traffic Generation Started ===

[User 001] ✓ 💾 Charizard ex (223/197) PSA10 EN - 200 (450ms)
[User 002] ✓ 🔍 Pikachu VMAX (188/185) RAW EN - 200 (3245ms)
[User 003] ⏱️ 💾 Umbreon VMAX (215/203) PSA9 EN - 429 (120ms)
...

=== Traffic Generation Complete ===

📊 Report saved: scripts/traffic-report-Normal Baseline-1698765432000.md
```

**Status Emojis:**
- ✓ = Success (200 OK)
- ⏱️ = Rate limited (429)
- ✗ = Error (5xx)

**Cache Emojis:**
- 💾 = Cache HIT (fast, Redis served)
- 🔍 = Cache MISS (slow, AI called)

---

## ✅ Success Criteria

After test completes, check the report:

```bash
cat scripts/traffic-report-Normal*.md
```

**Look for:**

| Metric | Good ✅ | Bad ❌ |
|--------|---------|--------|
| Success Rate | >99% | <95% |
| Cache Hit Rate | >50% | <30% |
| Error Rate (5xx) | <1% | >5% |
| P95 Latency | <10s | >20s |
| Rate Limit Hits | <5% | >20% |

---

## 🐛 Common Issues

### "fetch failed" during warmup

**Fix:** API server not running
```bash
# In separate terminal:
pnpm api:dev
```

### "DEEPSEEK_API_KEY not set"

**Fix:** Set environment variable
```bash
export DEEPSEEK_API_KEY="sk-test"
pnpm api:dev
```

### "Cannot connect to PostgreSQL"

**Fix:** Check DATABASE_URL
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

### "Redis is not responding"

**Fix:** Start Redis
```bash
brew services start redis
redis-cli ping
```

### "CanonicalCard table is empty"

**Fix:** Run database setup
```bash
pnpm run setup
```

---

## 📊 Next Steps

After successful 5-minute test:

### 1-Hour Baseline Test
```bash
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=1h
```

### 24-Hour Production Test
```bash
screen -S traffic-24h
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=24h
# Ctrl+A, then D to detach
# screen -r traffic-24h to reattach
```

### Other Scenarios
```bash
# Peak traffic (15 users, 30m)
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=peak --duration=30m

# Traffic spike (30 users, 15m)
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=spike --duration=15m

# Cache buster (worst case, 10m)
pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=cache-buster --duration=10m
```

---

## 📖 Full Documentation

For detailed troubleshooting and advanced configuration:

- **[docs/TRAFFIC-GENERATOR-USAGE.md](../docs/TRAFFIC-GENERATOR-USAGE.md)** - Complete usage guide
- **[TRAFFIC-GENERATOR-IMPLEMENTATION-COMPLETE.md](../TRAFFIC-GENERATOR-IMPLEMENTATION-COMPLETE.md)** - Implementation details

---

**Total Time to First Test:** ~10 minutes
**Test Duration:** 5 minutes
**Report Generation:** Automatic

**Status:** ✅ Ready to run
