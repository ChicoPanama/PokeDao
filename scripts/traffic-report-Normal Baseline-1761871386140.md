# Synthetic Traffic Test Report

**Scenario:** Normal Baseline
**Duration:** 67.7 minutes
**Concurrent Users:** 5

---

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | 206 | N/A | ℹ️ |
| Success Rate | 95.6% | >99% | ❌ |
| Error Rate (5xx) | 0.0% | <1% | ✅ |
| Cache Hit Rate (Client) | 0.0% | >50% | ⚠️ |
| Cache Hit Rate (Server) | 7.7% | >50% | ⚠️ |
| Avg Latency | 19808ms | <5000ms | ⚠️ |
| P95 Latency | 15228ms | <10000ms | ❌ |
| Rate Limit Hits (429) | 9 | <10 (5%) | ✅ |

---

## Breakdown by User Tier

| Tier | Requests | Success Rate | Cache Hit Rate | 429 Hits |
|------|----------|--------------|----------------|----------|
| Anonymous | 24 | 62.5% | 0.0% | 9 |
| API Key | 182 | 100.0% | 0.0% | 0 |
| Power User | 0 | NaN% | NaN% | 0 |

---

## Breakdown by Grade

| Grade | Requests | Cache Hit Rate |
|-------|----------|----------------|
| RAW | 110 | 0.0% |
| PSA 10 | 46 | 0.0% |
| PSA 9 | 36 | 0.0% |
| PSA 8 | 12 | 0.0% |
| BGS 9.5 | 2 | 0.0% |

---

## Breakdown by Language

| Language | Requests | Cache Hit Rate |
|----------|----------|----------------|
| EN | 177 | 0.0% |
| JA | 29 | 0.0% |

---

## Server Metrics (from /metrics endpoint)

| Metric | Value |
|--------|-------|
| Total Requests | 208 |
| Cache Hits | 16 |
| Cache Misses | 192 |
| Cache Hit Rate | 7.7% |

---

## Recommendations

⚠️ **Cache hit rate is below target.** Consider increasing Redis TTL or adjusting repeat probability.

❌ **P95 latency exceeds 10s.** Check Mew-1A endpoint performance and vLLM configuration.


---

**Report Generated:** 2025-10-31T00:43:06.131Z