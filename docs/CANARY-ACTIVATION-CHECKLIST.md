# Mew-1A v4.3-shaped Canary Activation Checklist

## Pre-flight (10 min)
- [ ] Prometheus rules loaded (config/prometheus-alerts-v4.3-shaped.yml)
- [ ] Grafana dashboard present: "Mew-1A v4.3-shaped - Canary Rollout"
- [ ] Panels show live data for: p95 latency, 5xx rate, visible contradictions, HOLD fallback
- [ ] Synthetic checks pass: `python3 scripts/pre-flight-health-check.py`
- [ ] Verify Modal keep_warm=1: `modal app show mew1a-vllm-v4-3-shaped | grep -i "keep_warm"`

## Activate 10% Canary (start 60m watch)

### Set Environment Variables
```bash
export MEW1A_STABLE_ENDPOINT="https://chicopanama--mew1a-vllm-fastapi-app.modal.run/analyze"
export MEW1A_CANARY_ENDPOINT="https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/analyze"
export MEW1A_CANARY_WEIGHT="0.10"  # 10% traffic to canary
```

### Restart Application
```bash
# Restart your Node.js application to pick up new env vars
pm2 restart all  # Or your restart method
```

### Verify Traffic Split
- [ ] Check logs for `X-Mew1A-Variant: canary` headers (~10% of requests)
- [ ] Verify both stable and canary endpoints receiving traffic
- [ ] Monitor every 5 minutes; alerts quiet

## Go/No-Go Gates (pass all 4):
- [ ] **Zero contradictions:** `sum(increase(mew1a_visible_contradictions_total[5m])) == 0`
- [ ] **Latency SLO:** `histogram_quantile(0.95, sum by (le) (rate(mew1a_latency_seconds_bucket{route!="/health"}[5m]))) < 10`
- [ ] **Error rate SLO:** `sum(rate(mew1a_requests_total{status=~"5.."}[5m])) / sum(rate(mew1a_requests_total[5m])) < 0.01`
- [ ] **HOLD fallback rate:** `sum(rate(mew1a_hold_fallback_total[1h])) / sum(rate(mew1a_requests_total[1h])) <= 0.10`

## Ramp to 50% (Hour 6, after successful Hour 1)
```bash
export MEW1A_CANARY_WEIGHT="0.50"  # 50% traffic
pm2 restart all
```

- [ ] Increase to 50%; continue monitoring every 15 minutes
- [ ] Capture hourly summary: p95, 5xx, contradictions, HOLD fallback
- [ ] Side-by-side comparison: canary vs stable metrics

## Cut-over to 100% (Hour 24, after successful Hour 6)
```bash
export MEW1A_CANARY_WEIGHT="1.00"  # 100% traffic (full cutover)
pm2 restart all
```

- [ ] Increase to 100%; maintain alerts/dashboards
- [ ] Produce validation report in reports/ with four key metrics and outcomes
- [ ] Monitor for 24 hours before decommissioning stable endpoint

## Rollback Procedure (< 5 min SLA)
```bash
# INSTANT ROLLBACK: Set weight to 0
export MEW1A_CANARY_WEIGHT="0.0"  # 0% traffic (all to stable)
pm2 restart all

# Capture metrics before stopping canary
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/metrics \
  > rollback-$(date +%Y%m%d-%H%M%S)-metrics.txt

# Stop canary app (optional - can leave running for investigation)
modal app stop mew1a-vllm-v4-3-shaped
```

