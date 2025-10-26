# Mew-1A v4.3-shaped Canary Rollout - Operations Brief

**To:** SRE, On-Call Engineers, Engineering Leadership
**From:** @mew-core
**Date:** 2025-10-25
**Subject:** [ACTION REQUIRED] Mew-1A v4.3-shaped Canary Rollout Starting Today

---

## 🎯 Executive Summary

We're rolling out **Mew-1A v4.3-shaped** (Phase 1: Contradiction Elimination) starting today with a **10% canary**.

**What it does:** Eliminates visible contradictions in model responses while maintaining 100% Policy Engine accuracy.

**Rollout plan:** 10% → 50% → 100% over 24 hours

**Your role:** Monitor SLOs, respond to alerts, execute rollback if needed

---

## 📋 Rollout Timeline

| Time (UTC) | Traffic % | Duration | Action |
|------------|-----------|----------|--------|
| **Today 23:00** | 10% canary | 1 hour | Monitor every 5min |
| **Tomorrow 05:00** | 50% ramp | 4 hours | Side-by-side comparison |
| **Tomorrow 23:00** | 100% cut-over | Ongoing | 24h validation |

---

## 🚨 Critical Alerts (Auto-Rollback Required)

### Alert 1: Visible Contradictions Detected
**Trigger:** `mew1a_visible_contradictions_total > 0` for 5min
**Severity:** CRITICAL
**Action:** IMMEDIATE ROLLBACK TO 0%

**What it means:** Response shaping is failing. Model text contradicts Policy Engine recommendation.

**Rollback procedure:**
```bash
# 1. Stop canary immediately
modal app stop mew1a-vllm-v4-3-shaped

# 2. Capture metrics
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/metrics \
  > rollback-$(date +%Y%m%d-%H%M%S)-metrics.txt

# 3. Kill warm-start keeper
pkill -f keep-v4.3-shaped-warm

# 4. Notify @mew-core immediately
```

### Alert 2: High Latency (p95 >= 15s)
**Trigger:** `p95 latency >= 15s` for 5min
**Severity:** CRITICAL
**Action:** Investigate → Rollback if not resolved in 5min

**What it means:** System severely degraded. Expected: <1s warm, <10s SLO.

**Debug steps:**
```bash
# 1. Check warm-start keeper status
ps aux | grep keep-v4.3-shaped-warm

# 2. Check keeper logs
tail -50 reports/warm-start-keeper.log

# 3. Check Modal Labs container health
modal app logs mew1a-vllm-v4-3-shaped | tail -50

# 4. If cold starts detected → Restart keeper
# 5. If not resolved in 5min → ROLLBACK
```

### Alert 3: High 5xx Rate (>= 1%)
**Trigger:** `5xx rate >= 1%` for 5min
**Severity:** CRITICAL
**Action:** ROLLBACK IMMEDIATELY

**What it means:** Service is failing. Expected: 0% errors.

**Debug steps:**
```bash
# 1. Check Modal Labs logs for errors
modal app logs mew1a-vllm-v4-3-shaped | grep -i error

# 2. Verify warm-start keeper running
ps aux | grep keep-v4.3-shaped-warm

# 3. ROLLBACK (don't wait - service is broken)
modal app stop mew1a-vllm-v4-3-shaped
```

---

## ⚠️ Warning Alerts (Monitor Closely)

### Alert 4: Elevated Latency (p95 >= 10s)
**Trigger:** `p95 latency >= 10s` for 5min
**Severity:** WARNING
**Action:** Monitor closely, prepare rollback if crosses 15s

**Expected:** ~1s warm latency. 10s is warning threshold.

### Alert 5: HOLD Fallback Rate High (> 10%)
**Trigger:** `HOLD fallback rate > 10%` for 1h
**Severity:** WARNING
**Action:** Review HOLD template effectiveness (non-blocking)

**Expected:** <10% of HOLD cases use fallback logic.

---

## ✅ Expected Behavior (Normal Operation)

### Response Format
All responses include new fields:
- `headline`: `"**RECOMMENDATION: BUY**"` (always present)
- `explanation`: Policy-aligned text (no contradictions)
- `shaped`: `true` (shaping applied)
- `recommendation`: `"BUY"` | `"PASS"` | `"HOLD"` | `"NEUTRAL"` (authoritative)

### Performance SLOs
- **p95 latency:** ~1s (warm), <10s SLO
- **5xx rate:** 0%
- **Visible contradictions:** 0
- **HOLD fallback rate:** <10%

### Warm-Start Keeper
- **Process:** Should be running (PID check)
- **Behavior:** Pings /health every 4 minutes
- **Logs:** `reports/warm-start-keeper.log`
- **Expected:** Keeps instance warm, prevents cold starts

---

## 📊 Monitoring

### Prometheus Metrics (Every 5 Minutes)

**Critical Metrics:**
```bash
# Visible contradictions (MUST BE ZERO)
curl https://...-shaped.../metrics | grep mew1a_visible_contradictions_total

# p95 latency (should be ~1s)
# Check via Prometheus: histogram_quantile(0.95, mew1a_latency_seconds_bucket)

# 5xx rate (should be 0%)
# Check via Prometheus: rate(mew1a_requests_total{status=~"5.."}[5m])
```

**Health Check:**
```bash
# Quick health verification
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/health
```

### Dashboards
- **Prometheus:** http://localhost:9090/alerts
- **Grafana:** https://grafana.internal/d/mew1a-canary
- **Modal Labs:** https://modal.com/apps/chicopanama/main/deployed/mew1a-vllm-v4-3-shaped

---

## 🔄 Rollback Procedure (Detailed)

**When to rollback:**
- Any critical alert fires
- SLOs breached for >5 minutes
- User complaints about contradictions

**Steps:**
```bash
# 1. Immediate traffic cutoff
modal app stop mew1a-vllm-v4-3-shaped

# 2. Verify traffic stopped
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/health
# (should fail or show very low request rate)

# 3. Capture post-mortem data
mkdir -p /Users/arcadio/dev/pokedao/rollback-$(date +%Y%m%d-%H%M%S)
cd /Users/arcadio/dev/pokedao/rollback-$(date +%Y%m%d-%H%M%S)

curl https://...-shaped.../metrics > metrics.txt
tail -200 ../reports/warm-start-keeper.log > warmstart.log
modal app logs mew1a-vllm-v4-3-shaped | tail -500 > modal-logs.txt

# 4. Kill warm-start keeper
pkill -f keep-v4.3-shaped-warm

# 5. Notify team
# Post in #mew1a-deploys Slack:
# "@mew-core Rolled back v4.3-shaped canary due to [REASON].
#  Post-mortem data in rollback-YYYYMMDD-HHMMSS/"

# 6. Page @mew-core if off-hours
```

**Rollback SLA:** <5 minutes from alert to 0% traffic

---

## 🎯 Hour-1 Checklist (10% Canary)

**First Hour Actions:**
- [ ] Confirm canary activated (10% traffic routing)
- [ ] Check `mew1a_visible_contradictions_total` = 0
- [ ] Verify p95 latency < 2s
- [ ] Confirm 5xx rate = 0%
- [ ] Check warm-start keeper running: `ps aux | grep keep-v4.3-shaped-warm`
- [ ] Spot check 5 responses (verify headline field present)
- [ ] Monitor alerts dashboard (no fires)

**Every 5 Minutes:**
- [ ] Check Prometheus metrics
- [ ] Review alert status
- [ ] Watch for user complaints

**After 1 Hour:**
- [ ] If all SLOs green → Approve ramp to 50%
- [ ] If any critical alert → Rollback to 0%

---

## 📞 Contacts & Escalation

**Primary:** @mew-core
**On-Call:** Check PagerDuty rotation
**Escalation:** @CTO (critical alerts only)

**Channels:**
- **Slack:** #mew1a-deploys
- **PagerDuty:** Mew-1A Service
- **Email:** mew-core@company.com

---

## 📖 Technical Background

### What Changed in v4.3-shaped

**Problem Solved:** v4.3 had visible contradictions (model text said "BUY" when Policy Engine said "PASS")

**Solution:** Phase 1 response shaping
- Detects contradictions in model text
- Rebuilds explanation from policy template
- Guarantees headline + explanation align with Policy Engine

**Result:**
- 0 visible contradictions (tested in pre-production)
- 100% Policy Engine accuracy (maintained)
- Headlines generated for all responses
- Performance: 0.84s avg latency (9x faster than SLO)

### Architecture
- **Model:** ChicoPanama/mew1a-v4.3 (509K training examples)
- **Platform:** Modal Labs (serverless T4 GPU)
- **Policy Engine:** Deterministic BUY/PASS/HOLD logic (server-side)
- **Response Shaping:** Template rebuilds for contradiction cases

---

## ❓ FAQ

**Q: What if I see a visible contradiction in production?**
A: This should NEVER happen (it's a critical alert). If you see one:
1. Verify it's real (check the shaped `explanation` field, not deprecated `response`)
2. If confirmed → ROLLBACK IMMEDIATELY
3. Notify @mew-core with screenshot

**Q: What's the difference between v4.3 and v4.3-shaped?**
A: v4.3-shaped adds response shaping layer to eliminate contradictions. Same model, enhanced output processing.

**Q: Why 24 hours for rollout?**
A: Conservative rollout ensures we catch any issues at each stage (10% → 50% → 100%).

**Q: What if warm-start keeper dies?**
A: Restart it:
```bash
cd /Users/arcadio/dev/pokedao
nohup bash scripts/keep-v4.3-shaped-warm.sh > /dev/null 2>&1 &
```

**Q: Can I test the canary endpoint directly?**
A: Yes:
```bash
curl -X POST https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/analyze \
  -H "Content-Type: application/json" \
  -d '{"card_name":"Charizard ex","set_name":"Obsidian Flames","listed_price":45.0,"fair_value":52.0}'
```

---

## 🔗 Additional Resources

- **Canary Activation Doc:** CANARY-ACTIVATION-READY.md
- **API Documentation:** docs/API-DOCUMENTATION-V4.3-SHAPED.md
- **Prometheus Alerts:** config/prometheus-alerts-v4.3-shaped.yml
- **Phase 1 Report:** PHASE1-CONTRADICTION-ELIMINATION-COMPLETE.md

---

**Questions?** Reply to this brief or ping @mew-core in #mew1a-deploys

---

**Status:** Ready for Canary Activation
**Next Review:** Hour-1 (after 10% canary active)
**Expected Completion:** 2025-10-27 (100% production)
