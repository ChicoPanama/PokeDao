# Synthetic Traffic Test Report

**Scenario:** Cache Optimized (High Repeat)
**Duration:** 30.6 minutes
**Concurrent Users:** 5

---

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | 204 | N/A | ℹ️ |
| Success Rate | 99.5% | >99% | ✅ |
| Error Rate (5xx) | 0.5% | <1% | ✅ |
| Cache Hit Rate (Client) | 86.8% | >50% | ✅ |
| Cache Hit Rate (Server) | 27.9% | >50% | ⚠️ |
| Avg Latency | 734ms | <5000ms | ✅ |
| P95 Latency | 5506ms | <10000ms | ✅ |
| Rate Limit Hits (429) | 0 | <10 (5%) | ✅ |

---

## Breakdown by User Tier

| Tier | Requests | Success Rate | Cache Hit Rate | 429 Hits |
|------|----------|--------------|----------------|----------|
| Anonymous | 5 | 100.0% | 80.0% | 0 |
| API Key | 150 | 99.3% | 88.7% | 0 |
| Power User | 49 | 100.0% | 81.6% | 0 |

---

## Breakdown by Grade

| Grade | Requests | Cache Hit Rate |
|-------|----------|----------------|
| RAW | 69 | 85.5% |
| PSA 10 | 54 | 87.0% |
| PSA 9 | 29 | 82.8% |
| PSA 8 | 30 | 90.0% |
| BGS 9.5 | 22 | 90.9% |

---

## Breakdown by Language

| Language | Requests | Cache Hit Rate |
|----------|----------|----------------|
| EN | 149 | 85.9% |
| JA | 55 | 89.1% |

---

## Server Metrics (from /metrics endpoint)

| Metric | Value |
|--------|-------|
| Total Requests | 165 |
| Cache Hits | 46 |
| Cache Misses | 119 |
| Cache Hit Rate | 27.9% |

---

## Recommendations






---

**Report Generated:** 2025-10-31T21:29:23.898Z