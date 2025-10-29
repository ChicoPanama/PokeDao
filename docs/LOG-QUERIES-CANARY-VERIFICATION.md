# Log Queries for Canary Traffic Split Verification

## Quick 10% Split Verification (5-line query)

```bash
# Count requests by variant in last 5 minutes
grep "X-Mew1A-Variant" /path/to/app.log | \
  tail -1000 | \
  grep -oE "(stable|canary)" | \
  sort | uniq -c | \
  awk '{total+=$1; variant[$2]=$1} END {for(v in variant) printf "%s: %d (%.1f%%)\n", v, variant[v], (variant[v]/total)*100}'
```

**Expected Output (10% canary):**
```
canary: 100 (10.0%)
stable: 900 (90.0%)
```

---

## Detailed Monitoring Queries

### 1. Real-Time Variant Distribution
```bash
# Live tail showing variant split
tail -f /path/to/app.log | grep --line-buffered "X-Mew1A-Variant" | \
  awk '{print $0; system("")}' | \
  grep -oE "(stable|canary)" | \
  uniq -c
```

---

### 2. Hourly Traffic Split Report
```bash
# Aggregate by hour for Hour-1 monitoring
grep "X-Mew1A-Variant" /path/to/app.log | \
  awk '{print strftime("%Y-%m-%d %H:00", systime()), $0}' | \
  grep -oE "([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:00).*(stable|canary)" | \
  awk '{hr=$1" "$2; variant=$3; count[hr,variant]++; total[hr]++}
       END {for(key in count) {
         split(key, k, SUBSEP);
         printf "%s %s: %d (%.1f%%)\n", k[1], k[2], count[key], (count[key]/total[k[1]])*100
       }}' | sort
```

---

### 3. Check for Contradictions in Logs (Critical SLO)
```bash
# Search for contradiction indicators in canary responses
grep "X-Mew1A-Variant: canary" /path/to/app.log -A 10 | \
  grep -E "(recommendation.*BUY.*PASS|recommendation.*PASS.*BUY)" | \
  wc -l
```

**Expected:** 0 (zero contradictions)

---

### 4. Latency Distribution by Variant
```bash
# Extract latency for each variant
grep "X-Mew1A-Variant" /path/to/app.log | \
  grep -oE "(stable|canary).*latency: ([0-9.]+)s" | \
  awk '{variant=$1; latency=$3; sum[variant]+=latency; count[variant]++}
       END {for(v in sum) printf "%s: avg %.2fs, count %d\n", v, sum[v]/count[v], count[v]}'
```

**Expected (both should be <10s):**
```
canary: avg 6.5s, count 100
stable: avg 3.2s, count 900
```

---

### 5. Error Rate by Variant
```bash
# Count 5xx errors per variant
grep "X-Mew1A-Variant" /path/to/app.log | \
  grep -E "(stable|canary).*HTTP (5[0-9]{2})" | \
  grep -oE "stable|canary" | \
  sort | uniq -c
```

**Expected:** Minimal or zero 5xx errors for both variants

---

## Modal Labs Log Queries

### 6. Modal Logs for Canary Endpoint
```bash
# View canary endpoint logs
modal app logs mew1a-vllm-v4-3-shaped --follow

# Filter for errors
modal app logs mew1a-vllm-v4-3-shaped | grep -i "error\|exception\|fail"

# Check for contradictions in responses
modal app logs mew1a-vllm-v4-3-shaped | grep -E "(BUY.*PASS|PASS.*BUY)"
```

---

### 7. Modal Metrics Export
```bash
# Export metrics from canary endpoint
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/metrics \
  > canary-metrics-$(date +%Y%m%d-%H%M%S).txt

# Parse visible contradictions metric
grep "mew1a_visible_contradictions_total" canary-metrics-*.txt
```

**Expected:** `mew1a_visible_contradictions_total 0`

---

## Prometheus Queries (If Available)

### 8. Canary Traffic Volume (Last 5 Minutes)
```promql
sum(rate(mew1a_requests_total{service="mew1a-v4.3-shaped"}[5m])) * 300
```

**Expected:** ~10% of total traffic (e.g., if total=1000/5min, canary=100/5min)

---

### 9. Canary p95 Latency
```promql
histogram_quantile(0.95,
  sum by (le) (rate(mew1a_latency_seconds_bucket{
    service="mew1a-v4.3-shaped",
    route!="/health"
  }[5m]))
)
```

**Expected:** <10 seconds (SLO compliance)

---

### 10. Visible Contradictions (Critical SLO)
```promql
sum(increase(mew1a_visible_contradictions_total{service="mew1a-v4.3-shaped"}[5m]))
```

**Expected:** 0 (must be zero)

---

## Quick Decision Matrix

| Metric | Expected | Action if Outside Range |
|--------|----------|------------------------|
| **Canary traffic %** | 9-11% | Check env vars + restart |
| **Visible contradictions** | 0 | IMMEDIATE ROLLBACK |
| **p95 latency** | <10s | Investigate or rollback |
| **5xx rate** | <1% | Investigate or rollback |
| **HOLD fallback rate** | <10% | Monitor (acceptable) |

---

## Rollback Decision Tree

```
Are contradictions > 0?
├─ YES → IMMEDIATE ROLLBACK (set weight=0.0)
└─ NO → Continue

Is p95 latency > 10s for 15+ minutes?
├─ YES → Investigate → If not resolved in 5min → ROLLBACK
└─ NO → Continue

Is 5xx rate > 1% for 10+ minutes?
├─ YES → Investigate → If not resolved in 5min → ROLLBACK
└─ NO → Continue

All metrics green for 60 minutes?
└─ YES → Proceed to 50% phase
```

---

## Log File Paths (Update for Your System)

Typical locations:
- PM2 logs: `~/.pm2/logs/app-out.log` or `~/.pm2/logs/app-error.log`
- Docker logs: `docker logs <container-id>`
- Systemd logs: `journalctl -u your-app.service -f`
- Custom logs: Update paths in queries above

---

**Usage:** Copy the relevant query for your monitoring setup (grep, Modal, or Prometheus) and run during Hour-1 monitoring (every 5 minutes).
