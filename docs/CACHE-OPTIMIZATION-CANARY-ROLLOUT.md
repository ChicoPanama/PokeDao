# Cache Optimization - Production Canary Rollout Plan

**Date:** 2025-10-31
**Feature:** API Cache Optimization (TTL + Compression + Headers)
**Status:** ✅ Validated - Ready for Production Deployment

---

## Executive Summary

**Test Results:**
- Server cache hit: 7.7% → **64.9%** (8.4x improvement)
- Client cache hit: 0% → **86.1%** (measurement fixed)
- P95 latency: 15.2s → **5.6s** (63% faster)
- Avg latency: 19.8s → **847ms** (96% faster)
- Success rate: 95.6% → **100%**
- Rate limits: 9 → **0**

**Rollout Strategy:** Canary 10% → 50% → 100% over 24+ hours

---

## Pre-Activation Checklist

### 0. Port Guard (CRITICAL - Prevents Split Traffic)

**Kill any existing API processes to avoid serving stale code:**

```bash
# Kill all processes on port 3000
kill -9 $(lsof -ti:3000) || true
sleep 2

# Verify port is free
lsof -ti:3000 && echo "❌ ERROR: Port 3000 still in use - investigate" || echo "✅ Port 3000 free"
```

**Why critical:** Multiple API instances can run simultaneously, causing:
- Split traffic between old/new code
- Inconsistent cache behavior
- Difficult-to-debug issues

### 1. Code Deployment Verification

**Files Modified:**
- ✅ [api/src/routes/card-comprehensive.ts](../api/src/routes/card-comprehensive.ts) - Cache TTLs + headers
- ✅ [api/src/index.ts](../api/src/index.ts) - Compression middleware
- ✅ [scripts/pre-warm-api.ts](../scripts/pre-warm-api.ts) - Pre-warm helper (NEW)
- ✅ [scripts/traffic-generator-config.json](../scripts/traffic-generator-config.json) - Cache-optimized scenario
- ⚠️ [apps/mew1a/vllm_deploy_vector_rag.py](../apps/mew1a/vllm_deploy_vector_rag.py) - Keep-warm (optional)

**Verify Deployment:**
```bash
# Check compression middleware is registered
grep -n "compress" api/src/index.ts
# Expected: Line 1 (import) + Line 34 (register)

# Check cache headers are enabled
grep -n "x-cache-status" api/src/routes/card-comprehensive.ts
# Expected: Lines 214, 262, 402

# Check TTLs are env-driven
grep -n "CACHE_TTL" api/src/routes/card-comprehensive.ts
# Expected: Lines 236, 426, 532
```

### 2. Environment Variables (Production)

**Set in production environment:**
```bash
export CACHE_TTL_SEARCH=900      # 15 minutes (was 300)
export CACHE_TTL_ANALYSIS=900    # 15 minutes (was 300)
export CACHE_TTL_AI=900          # 15 minutes (was 300)
```

**Verification:**
```bash
# After API restart, verify env vars are loaded
curl -s http://localhost:3000/health | jq
# Should return 200 OK

# Check first request is MISS
curl -sD- "http://localhost:3000/api/cards/search-variants?q=Charizard%20ex&set=Obsidian%20Flames&language=EN" \
  -H "x-api-key: YOUR_KEY" | grep -i "x-cache-status"
# Expected: x-cache-status: MISS

# Check second request is HIT
curl -sD- "http://localhost:3000/api/cards/search-variants?q=Charizard%20ex&set=Obsidian%20Flames&language=EN" \
  -H "x-api-key: YOUR_KEY" | grep -i "x-cache-status"
# Expected: x-cache-status: HIT
```

### 3. Dependencies Installation

**Ensure `@fastify/compress` is installed:**
```bash
pnpm --filter @pokedao/api add @fastify/compress
# Or verify: pnpm list @fastify/compress
```

### 4. Pre-Flight Tests

**Test 1: Compression Active**
```bash
# Without Accept-Encoding (no compression)
curl -sD- "http://localhost:3000/health" | grep -i "content-encoding"
# Should be empty

# With Accept-Encoding (compression)
curl -sD- "http://localhost:3000/api/cards/search-variants?q=Pikachu&set=151&language=EN" \
  -H "Accept-Encoding: gzip" -H "x-api-key: YOUR_KEY" | grep -i "content-encoding"
# Expected: content-encoding: gzip
```

**Test 2: Cache Headers Present**
```bash
# Make 2 identical requests, check headers
curl -sD- "http://localhost:3000/api/cards/comprehensive-analysis?canonicalCardId=1&language=EN" \
  -H "x-api-key: YOUR_KEY" | grep -i "x-cache-status"
# First: MISS, Second: HIT
```

**Test 3: TTLs Applied with Jitter**
```bash
# Check Redis key TTL with jitter (±10%)
redis-cli --scan --pattern "search:*" | head -5 | xargs -I {} redis-cli TTL {}
# Expected: ~810-990 seconds (15 min ±10% jitter)
# Should see VARIANCE, not all exactly 900 - this prevents synchronized expirations

# Verify jitter spread
redis-cli --scan --pattern "search:*" | head -20 | xargs -I {} redis-cli TTL {} | sort -n
# Should see gradual distribution, not clustering at one value
```

---

## Phase 1: 10% Canary (Hour 0-1)

### Activation Steps

**Hour 0 (T+0min):**
1. **Deploy cache-optimized API to canary instances** (10% of fleet)
2. **Set environment variables** on canary instances:
   ```bash
   CACHE_TTL_SEARCH=900
   CACHE_TTL_ANALYSIS=900
   CACHE_TTL_AI=900
   ```
3. **Restart canary instances** with new env vars
4. **Pre-warm cache** (optional but recommended):
   ```bash
   API_BASE_URL="https://api.pokedao.com" \
   API_KEYS="canary-key-1,canary-key-2" \
   pnpm tsx scripts/pre-warm-api.ts
   ```
5. **Configure traffic routing** (sticky by user/session, 10% to canary)
6. **Enable Prometheus alerts** (see Alert Configuration below)
7. **Open Grafana dashboard** (see Dashboard Setup below)

### Monitoring (Hour 0-1)

**Key Metrics to Watch:**

| Metric | Baseline | Target | Threshold (Rollback if) |
|--------|----------|--------|-------------------------|
| Server Cache Hit Rate | 7.7% | >50% | <40% sustained >10min |
| Client Cache Hit Rate | 0% | >50% | <40% sustained >10min |
| P95 Latency | 15.2s | <10s | >12s sustained >10min |
| Avg Latency | 19.8s | <5s | >8s sustained >10min |
| Success Rate (API Key) | 100% | >99% | <98% sustained >5min |
| Error Rate (5xx) | 0% | <1% | >2% sustained >5min |
| Rate Limit Hits (429) | 4.4% | <5% | >10% sustained >10min |

**Prometheus Queries:**

```promql
# Server cache hit rate (15-minute window)
sum(rate(api_cache_hits_total{endpoint=~".*comprehensive.*"}[15m]))
/
sum(rate(api_requests_total{endpoint=~".*comprehensive.*"}[15m])) * 100

# P95 latency (5-minute window)
histogram_quantile(0.95,
  sum(rate(api_request_duration_seconds_bucket{endpoint=~".*comprehensive.*"}[5m])) by (le)
)

# Success rate (5-minute window)
sum(rate(api_requests_total{status=~"2.."}[5m]))
/
sum(rate(api_requests_total[5m])) * 100

# 5xx error rate (5-minute window)
sum(rate(api_requests_total{status=~"5.."}[5m]))
/
sum(rate(api_requests_total[5m])) * 100

# 429 rate limit rate (15-minute window)
sum(rate(api_requests_total{status="429"}[15m]))
/
sum(rate(api_requests_total[15m])) * 100
```

### Go/No-Go Decision (T+60min)

**✅ GO to Phase 2 if:**
- Server cache hit rate >50% for last 30 minutes
- P95 latency <10s for last 30 minutes
- Success rate >99% for last 30 minutes
- Error rate (5xx) <1% for last 30 minutes
- **All four alerts green for ≥30 minutes** (no consecutive fires)

**❌ NO-GO (Rollback) if:**
- **ANY alert fires twice consecutively** within Hour-1 (indicates persistent issue, not transient)
- Server cache hit rate <40% sustained >15 minutes (two 10min evals)
- P95 latency >12s sustained >10 minutes
- Success rate <98% sustained >5 minutes
- Error rate (5xx) >1% sustained >5 minutes (tighter than alert threshold)
- Rate limits >5% sustained >10 minutes

**⚠️ FREEZE (Investigate, don't ramp):**
- Single alert fires but resolves within 10 minutes
- Cache hit rate 40-50% (below target but above threshold)
- CPU >70% sustained (compression overhead check)

---

## Phase 2: 50% Ramp (Hour 2-3)

### Activation Steps

**Hour 2 (T+2h):**
1. **Increase canary traffic to 50%** (adjust load balancer weights)
2. **Monitor for 60 minutes** using same metrics as Phase 1
3. **Verify cache warming is keeping pace** with traffic increase

### Monitoring (Hour 2-3)

**Same metrics as Phase 1, but with increased traffic volume:**

| Metric | Target | Threshold (Rollback if) |
|--------|--------|-------------------------|
| Server Cache Hit Rate | >50% | <40% sustained >10min |
| P95 Latency | <10s | >12s sustained >10min |
| Success Rate (API Key) | >99% | <98% sustained >5min |
| Error Rate (5xx) | <1% | >2% sustained >5min |

**Additional Checks:**
- Redis memory usage <80% of allocated
- API instance CPU <70% average
- No sustained queue depth in load balancer

### Go/No-Go Decision (T+3h)

**✅ GO to Phase 3 if:**
- All Phase 1 success criteria maintained at 50% traffic
- No degradation in metrics compared to 10% canary
- Redis cache size stable (not growing unbounded)

**❌ NO-GO (Rollback to 10%) if:**
- Any Phase 1 rollback threshold exceeded
- Cache hit rate declining over time
- Memory/CPU showing signs of resource exhaustion

---

## Phase 3: 100% Rollout (Hour 24+)

### Activation Steps

**Hour 24 (T+24h):**
1. **Increase traffic to 100%** (all users on cache-optimized API)
2. **Monitor for 24 hours** using same metrics
3. **Schedule post-rollout review** (T+48h)

### Monitoring (Hour 24-48)

**Long-term stability checks:**

| Metric | Target | Threshold (Alert if) |
|--------|--------|----------------------|
| Server Cache Hit Rate | >50% | <45% sustained >30min |
| P95 Latency | <10s | >11s sustained >15min |
| Success Rate (API Key) | >99% | <98.5% sustained >10min |
| Error Rate (5xx) | <1% | >1.5% sustained >10min |

**Weekly health checks:**
- Cache hit rate trend (should remain >50%)
- P95 latency trend (should remain <10s)
- Redis memory growth (should plateau)

---

## Prometheus Alert Configuration

**Create alerts in Prometheus:**

```yaml
# File: prometheus-alerts-cache-optimization.yml
groups:
  - name: cache_optimization_alerts
    interval: 30s
    rules:
      - alert: CacheHitRateLow
        expr: |
          (sum(rate(api_cache_hits_total{endpoint=~".*comprehensive.*"}[15m]))
          / sum(rate(api_requests_total{endpoint=~".*comprehensive.*"}[15m]))) * 100 < 40
        for: 10m
        labels:
          severity: warning
          component: cache
        annotations:
          summary: "Server cache hit rate below 40% for 10 minutes"
          description: "Current: {{ $value | humanizePercentage }}, Target: >50%"

      - alert: P95LatencyHigh
        expr: |
          histogram_quantile(0.95,
            sum(rate(api_request_duration_seconds_bucket{endpoint=~".*comprehensive.*"}[5m])) by (le)
          ) > 12
        for: 10m
        labels:
          severity: critical
          component: api
        annotations:
          summary: "P95 latency above 12s for 10 minutes"
          description: "Current: {{ $value }}s, Target: <10s"

      - alert: ErrorRateHigh
        expr: |
          (sum(rate(api_requests_total{status=~"5.."}[5m]))
          / sum(rate(api_requests_total[5m]))) * 100 > 2
        for: 5m
        labels:
          severity: critical
          component: api
        annotations:
          summary: "5xx error rate above 2% for 5 minutes"
          description: "Current: {{ $value | humanizePercentage }}, Target: <1%"

      - alert: RateLimitHigh
        expr: |
          (sum(rate(api_requests_total{status="429"}[15m]))
          / sum(rate(api_requests_total[15m]))) * 100 > 10
        for: 10m
        labels:
          severity: warning
          component: api
        annotations:
          summary: "429 rate limit hits above 10% for 10 minutes"
          description: "Current: {{ $value | humanizePercentage }}, Target: <5%"
```

**Load alerts:**
```bash
# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload

# Verify rules loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name=="cache_optimization_alerts")'
```

---

## Grafana Dashboard Setup

**Create dashboard: "Cache Optimization - Production Canary"**

### Panel 1: Cache Hit Rates
```json
{
  "title": "Cache Hit Rates",
  "targets": [
    {
      "expr": "sum(rate(api_cache_hits_total{endpoint=~\".*comprehensive.*\"}[15m])) / sum(rate(api_requests_total{endpoint=~\".*comprehensive.*\"}[15m])) * 100",
      "legendFormat": "Server Cache Hit Rate"
    },
    {
      "expr": "sum(rate(api_requests_total{cache_status=\"HIT\"}[15m])) / sum(rate(api_requests_total{endpoint=~\".*comprehensive.*\"}[15m])) * 100",
      "legendFormat": "Client Cache Hit Rate"
    }
  ],
  "yAxis": {
    "label": "Hit Rate (%)",
    "min": 0,
    "max": 100
  },
  "thresholds": [
    {"value": 40, "color": "red"},
    {"value": 50, "color": "yellow"},
    {"value": 60, "color": "green"}
  ]
}
```

### Panel 2: Latency (P95, P50, Avg)
```json
{
  "title": "Response Latency",
  "targets": [
    {
      "expr": "histogram_quantile(0.95, sum(rate(api_request_duration_seconds_bucket{endpoint=~\".*comprehensive.*\"}[5m])) by (le))",
      "legendFormat": "P95"
    },
    {
      "expr": "histogram_quantile(0.50, sum(rate(api_request_duration_seconds_bucket{endpoint=~\".*comprehensive.*\"}[5m])) by (le))",
      "legendFormat": "P50"
    },
    {
      "expr": "sum(rate(api_request_duration_seconds_sum{endpoint=~\".*comprehensive.*\"}[5m])) / sum(rate(api_request_duration_seconds_count{endpoint=~\".*comprehensive.*\"}[5m]))",
      "legendFormat": "Average"
    }
  ],
  "yAxis": {
    "label": "Latency (seconds)",
    "format": "s"
  },
  "thresholds": [
    {"value": 10, "color": "yellow"},
    {"value": 12, "color": "red"}
  ]
}
```

### Panel 3: Success & Error Rates
```json
{
  "title": "Success & Error Rates",
  "targets": [
    {
      "expr": "sum(rate(api_requests_total{status=~\"2..\"}[5m])) / sum(rate(api_requests_total[5m])) * 100",
      "legendFormat": "Success Rate (2xx)"
    },
    {
      "expr": "sum(rate(api_requests_total{status=~\"5..\"}[5m])) / sum(rate(api_requests_total[5m])) * 100",
      "legendFormat": "Error Rate (5xx)"
    },
    {
      "expr": "sum(rate(api_requests_total{status=\"429\"}[15m])) / sum(rate(api_requests_total[15m])) * 100",
      "legendFormat": "Rate Limit Rate (429)"
    }
  ],
  "yAxis": {
    "label": "Rate (%)",
    "min": 0,
    "max": 100
  },
  "thresholds": [
    {"value": 98, "color": "red"},
    {"value": 99, "color": "yellow"},
    {"value": 99.5, "color": "green"}
  ]
}
```

### Panel 4: Traffic Volume (Canary vs Control)
```json
{
  "title": "Traffic Volume",
  "targets": [
    {
      "expr": "sum(rate(api_requests_total{deployment=\"canary\"}[1m]))",
      "legendFormat": "Canary (cache-optimized)"
    },
    {
      "expr": "sum(rate(api_requests_total{deployment=\"control\"}[1m]))",
      "legendFormat": "Control (baseline)"
    }
  ],
  "yAxis": {
    "label": "Requests/sec",
    "format": "reqps"
  }
}
```

**Dashboard URL:** Save and share link with team

---

## Rollback Procedures

### Immediate Rollback (<5 min)

**If any critical threshold exceeded:**

**Step 1: Stop canary traffic routing**
```bash
# Adjust load balancer to route 100% traffic to control group
# (Command depends on your LB: nginx, haproxy, k8s ingress, etc.)
kubectl set image deployment/api api=pokedao/api:baseline
# Or: Update env var to revert TTLs
kubectl set env deployment/api CACHE_TTL_SEARCH=300 CACHE_TTL_ANALYSIS=300 CACHE_TTL_AI=300
```

**Step 2: Verify control group is handling traffic**
```bash
# Check success rate recovers
curl -s http://api.pokedao.com/health
# Monitor Grafana for 2-3 minutes
```

**Step 3: Flush Redis (optional, if cache corruption suspected)**
```bash
# Only if necessary - will cause temporary latency spike
redis-cli FLUSHALL
```

**Step 4: Notify team**
```
Subject: [ROLLBACK] Cache Optimization Canary - Phase X

Reason: <metric> exceeded threshold (<value> vs <threshold>)
Action: Rolled back to baseline (TTL=300s, no compression)
Impact: <estimated user impact>
Next Steps: <investigation plan>
```

### Investigation Checklist

After rollback, investigate:
- [ ] Redis memory/CPU usage - was there resource exhaustion?
- [ ] Application logs - any errors or exceptions?
- [ ] Cache key patterns - any unbounded key growth?
- [ ] Traffic patterns - was there unusual load or query distribution?
- [ ] Compression issues - did some clients reject compressed responses?
- [ ] TTL tuning - was 900s too long for certain data types?

---

## Optional Enhancements (Post-Hour 24 Green)

**After 24 hours of stable 100% rollout**, consider these optimizations:

### 1. Apply Database Indexes

**Expected:** P95 drops from 5.6s to 3-4s on cache misses

```bash
export PGPASSWORD=pokedao
psql -h localhost -U pokedao -d pokedao -f scripts/sql/add_comprehensive_analysis_indexes.sql
```

**Verify:**
```sql
-- Check indexes created
\di+ idx_market_listings_*
```

### 2. Deploy Modal Keep-Warm

**Expected:** Eliminate AI cold starts (5-6s first hits)

```bash
modal deploy apps/mew1a/vllm_deploy_vector_rag.py
```

**Verify:**
```bash
# Check min_containers=1 is active
modal app show mew1a-tcg-pricing
# Should show: "min_containers: 1"
```

### 3. Automate Pre-Warm on Deploy

**Option A: Post-deploy hook**
```bash
# Add to your deployment script
pnpm tsx scripts/pre-warm-api.ts
```

**Option B: Cron job (every 10 minutes)**
```cron
*/10 * * * * cd /app && pnpm tsx scripts/pre-warm-api.ts >> /var/log/prewarm.log 2>&1
```

**Option C: On-demand (kubectl/pm2)**
```bash
# Kubernetes CronJob
kubectl create cronjob prewarm-cache \
  --image=pokedao/api:latest \
  --schedule="*/10 * * * *" \
  --command -- pnpm tsx scripts/pre-warm-api.ts
```

---

## Stage 2 Expansion (200-300 Cards)

**After Hour 24 canary is green**, validate production scale:

### Re-seed Database
```bash
pnpm tsx scripts/seed-market-listings-for-test-cards.ts --debug --limit=5000
```

### Verify Coverage
```bash
pnpm tsx scripts/verify-market-state.ts
# Expected: 200-300 cards with >90% linkage
```

### Redis Memory Check (Before Test)
```bash
# Check Redis maxmemory policy
redis-cli INFO memory | grep -E "maxmemory|maxmemory_policy"
# Expected: maxmemory_policy:allkeys-lru (or noeviction with alerts)

# Baseline memory usage
redis-cli INFO memory | grep used_memory_human
# Record baseline for comparison
```

### Run 60-Minute Validation
```bash
API_BASE_URL="http://localhost:3000" \
API_KEYS="test-key-1,test-key-2,test-key-3" \
pnpm tsx scripts/generate-synthetic-traffic.ts \
  --scenario=cache-optimized \
  --duration=60m
```

### Monitor During Test
```bash
# Watch Redis evictions (should stay at 0)
watch -n 10 'redis-cli INFO stats | grep evicted_keys'

# Watch memory growth (should plateau)
watch -n 30 'redis-cli INFO memory | grep -E "used_memory_human|mem_fragmentation_ratio"'
```

### Target Metrics (Same or Better)
- Server cache hit: >50%
- P95 latency: <10s
- Success rate: >99%
- Error rate: <1%
- Redis evictions: 0 (TTL doing its job)
- Memory growth: Plateaus after ~20min (stable cache size)

---

## Communication Plan

### Pre-Rollout (T-24h)
**Email to engineering team:**
```
Subject: [Production] Cache Optimization Canary - Starting Tomorrow

Team,

We're deploying cache optimization improvements tomorrow:
- 3x cache TTL increase (5min → 15min)
- Response compression (40-60% size reduction)
- Cache observability headers

Test results show 8.4x cache hit improvement and 96% latency reduction.

Canary rollout: 10% (Hour 1) → 50% (Hour 3) → 100% (Hour 24+)

Grafana: <dashboard-link>
Rollback SLA: <5 minutes

Questions? Reply to this thread.
```

### During Canary (T+0h)
**Slack announcement:**
```
:rocket: Cache optimization canary is LIVE (10% traffic)

Monitoring: <grafana-link>
Alerts: #alerts-api channel
Rollback: Immediate if thresholds exceeded

Will ramp to 50% at T+2h if metrics look good.
```

### Phase Transitions
**Slack updates at each phase:**
```
:chart_with_upwards_trend: Cache canary → 50% (Hour 2)
Metrics looking good:
- Cache hit: 64.9% ✅
- P95 latency: 5.6s ✅
- Success rate: 100% ✅

Continuing to monitor...
```

### Post-Rollout (T+48h)
**Email summary:**
```
Subject: [Success] Cache Optimization - 100% Rollout Complete

Team,

Cache optimization rollout is complete. Results:

Before → After:
- Cache hit: 7.7% → 64.9% (8.4x improvement)
- P95 latency: 15.2s → 5.6s (63% faster)
- Success rate: 95.6% → 100%

Next steps: Stage 2 expansion (200-300 cards) planned for next week.

Documentation: <link>
Postmortem: <date>
```

---

## Success Criteria Summary

### Phase 1 (10% Canary)
| Metric | Target | Achieved in Testing |
|--------|--------|---------------------|
| Server Cache Hit | >50% | ✅ 64.9% |
| Client Cache Hit | >50% | ✅ 86.1% |
| P95 Latency | <10s | ✅ 5.6s |
| Avg Latency | <5s | ✅ 847ms |
| Success Rate | >99% | ✅ 100% |
| Error Rate (5xx) | <1% | ✅ 0% |
| Rate Limits (429) | <5% | ✅ 0% |

### Phase 2 (50% Ramp)
- All Phase 1 targets maintained at 50% traffic
- No degradation vs 10% canary
- Redis memory stable

### Phase 3 (100% Rollout)
- All Phase 1 targets maintained at 100% traffic
- 24-hour stability confirmed
- Weekly health checks passing

---

## Files Reference

**Documentation:**
- [CACHE-OPTIMIZATION-SUCCESS-REPORT.md](../CACHE-OPTIMIZATION-SUCCESS-REPORT.md) - Complete test results
- [CACHE-OPTIMIZATION-FINAL-STATUS.md](../CACHE-OPTIMIZATION-FINAL-STATUS.md) - Technical details
- [QUICK-START-CACHE-TEST.md](../QUICK-START-CACHE-TEST.md) - 4-step test guide
- [RUN-CACHE-TEST-NOW.md](../RUN-CACHE-TEST-NOW.md) - Detailed test instructions

**Test Reports:**
- Baseline: `scripts/traffic-report-Normal Baseline-1761871386140.md`
- Test 1: `scripts/traffic-report-Cache Optimized (High Repeat)-1761946163909.md`
- Test 2: `scripts/traffic-report-Cache Optimized (High Repeat)-1761948898352.md`

**Scripts:**
- [scripts/run-cache-test-now.sh](../scripts/run-cache-test-now.sh) - Automated test runner
- [scripts/pre-warm-api.ts](../scripts/pre-warm-api.ts) - Cache pre-warming
- [scripts/verify-market-state.ts](../scripts/verify-market-state.ts) - Database coverage check
- [scripts/sql/add_comprehensive_analysis_indexes.sql](../scripts/sql/add_comprehensive_analysis_indexes.sql) - Performance indexes

---

## Quick Reference Commands

**Start Canary:**
```bash
# Set env vars
export CACHE_TTL_SEARCH=900 CACHE_TTL_ANALYSIS=900 CACHE_TTL_AI=900

# Restart API
pnpm --filter @pokedao/api dev  # or pm2/k8s restart

# Pre-warm cache (optional)
API_BASE_URL="https://api.pokedao.com" API_KEYS="key1,key2" pnpm tsx scripts/pre-warm-api.ts

# Route 10% traffic to canary
<your-load-balancer-command>
```

**Monitor:**
```bash
# Open Grafana dashboard
open https://grafana.pokedao.com/d/cache-optimization

# Watch Prometheus alerts
curl -s http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.component=="cache")'

# Check Redis cache hit rate
redis-cli --scan --pattern "search:*" | wc -l
```

**Rollback:**
```bash
# Immediate rollback (revert env vars)
kubectl set env deployment/api CACHE_TTL_SEARCH=300 CACHE_TTL_ANALYSIS=300 CACHE_TTL_AI=300

# Or: Route 100% traffic to control
<your-load-balancer-rollback-command>
```

---

**Prepared by:** Cache Optimization Team
**Last Updated:** 2025-10-31
**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT
