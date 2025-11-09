# Synthetic Traffic Test Report

**Scenario:** Cache Optimized (High Repeat)
**Duration:** 5.5 minutes
**Concurrent Users:** 5

---

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | 41 | N/A | ℹ️ |
| Success Rate | 100.0% | >99% | ✅ |
| Error Rate (5xx) | 0.0% | <1% | ✅ |
| Cache Hit Rate (Client) | 70.7% | >50% | ✅ |
| Cache Hit Rate (Server) | 37.0% | >50% | ⚠️ |
| Avg Latency | 1784ms | <5000ms | ✅ |
| P95 Latency | 6355ms | <10000ms | ✅ |
| Rate Limit Hits (429) | 0 | <2 (5%) | ✅ |

---

## Breakdown by User Tier

| Tier | Requests | Success Rate | Cache Hit Rate | 429 Hits |
|------|----------|--------------|----------------|----------|
| Anonymous | 0 | NaN% | NaN% | 0 |
| API Key | 41 | 100.0% | 70.7% | 0 |
| Power User | 0 | NaN% | NaN% | 0 |

---

## Breakdown by Grade

| Grade | Requests | Cache Hit Rate |
|-------|----------|----------------|
| RAW | 12 | 66.7% |
| PSA 10 | 16 | 75.0% |
| PSA 9 | 3 | 33.3% |
| PSA 8 | 10 | 80.0% |
| BGS 9.5 | 0 | NaN% |

---

## Breakdown by Language

| Language | Requests | Cache Hit Rate |
|----------|----------|----------------|
| EN | 25 | 64.0% |
| JA | 16 | 81.3% |

---

## Server Metrics (from /metrics endpoint)

| Metric | Value |
|--------|-------|
| Total Requests | 184 |
| Cache Hits | 68 |
| Cache Misses | 116 |
| Cache Hit Rate | 37.0% |

---

## Recommendations






---

**Report Generated:** 2025-11-01T17:52:43.016Z