# Synthetic Traffic Test Report

**Scenario:** Normal Baseline
**Duration:** 6.3 minutes
**Concurrent Users:** 5

---

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | 11 | N/A | ℹ️ |
| Success Rate | 100.0% | >99% | ✅ |
| Error Rate (5xx) | 0.0% | <1% | ✅ |
| Cache Hit Rate (Client) | 0.0% | >50% | ⚠️ |
| Cache Hit Rate (Server) | 2.4% | >50% | ⚠️ |
| Avg Latency | 10071ms | <5000ms | ⚠️ |
| P95 Latency | 15217ms | <10000ms | ❌ |
| Rate Limit Hits (429) | 0 | <1 (5%) | ✅ |

---

## Breakdown by User Tier

| Tier | Requests | Success Rate | Cache Hit Rate | 429 Hits |
|------|----------|--------------|----------------|----------|
| Anonymous | 2 | 100.0% | 0.0% | 0 |
| API Key | 9 | 100.0% | 0.0% | 0 |
| Power User | 0 | NaN% | NaN% | 0 |

---

## Breakdown by Grade

| Grade | Requests | Cache Hit Rate |
|-------|----------|----------------|
| RAW | 5 | 0.0% |
| PSA 10 | 2 | 0.0% |
| PSA 9 | 3 | 0.0% |
| PSA 8 | 1 | 0.0% |
| BGS 9.5 | 0 | NaN% |

---

## Breakdown by Language

| Language | Requests | Cache Hit Rate |
|----------|----------|----------------|
| EN | 9 | 0.0% |
| JA | 2 | 0.0% |

---

## Server Metrics (from /metrics endpoint)

| Metric | Value |
|--------|-------|
| Total Requests | 42 |
| Cache Hits | 1 |
| Cache Misses | 41 |
| Cache Hit Rate | 2.4% |

---

## Recommendations

⚠️ **Cache hit rate is below target.** Consider increasing Redis TTL or adjusting repeat probability.

❌ **P95 latency exceeds 10s.** Check Mew-1A endpoint performance and vLLM configuration.


---

**Report Generated:** 2025-10-30T23:07:20.794Z