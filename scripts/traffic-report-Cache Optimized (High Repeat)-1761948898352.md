# Synthetic Traffic Test Report

**Scenario:** Cache Optimized (High Repeat)
**Duration:** 30.5 minutes
**Concurrent Users:** 5

---

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | 202 | N/A | ℹ️ |
| Success Rate | 100.0% | >99% | ✅ |
| Error Rate (5xx) | 0.0% | <1% | ✅ |
| Cache Hit Rate (Client) | 86.1% | >50% | ✅ |
| Cache Hit Rate (Server) | 64.9% | >50% | ✅ |
| Avg Latency | 847ms | <5000ms | ✅ |
| P95 Latency | 5591ms | <10000ms | ✅ |
| Rate Limit Hits (429) | 0 | <10 (5%) | ✅ |

---

## Breakdown by User Tier

| Tier | Requests | Success Rate | Cache Hit Rate | 429 Hits |
|------|----------|--------------|----------------|----------|
| Anonymous | 5 | 100.0% | 60.0% | 0 |
| API Key | 148 | 100.0% | 86.5% | 0 |
| Power User | 49 | 100.0% | 87.8% | 0 |

---

## Breakdown by Grade

| Grade | Requests | Cache Hit Rate |
|-------|----------|----------------|
| RAW | 160 | 86.9% |
| PSA 10 | 7 | 42.9% |
| PSA 9 | 29 | 93.1% |
| PSA 8 | 6 | 83.3% |
| BGS 9.5 | 0 | NaN% |

---

## Breakdown by Language

| Language | Requests | Cache Hit Rate |
|----------|----------|----------------|
| EN | 166 | 85.5% |
| JA | 36 | 88.9% |

---

## Server Metrics (from /metrics endpoint)

| Metric | Value |
|--------|-------|
| Total Requests | 342 |
| Cache Hits | 222 |
| Cache Misses | 120 |
| Cache Hit Rate | 64.9% |

---

## Recommendations






---

**Report Generated:** 2025-10-31T22:14:58.342Z