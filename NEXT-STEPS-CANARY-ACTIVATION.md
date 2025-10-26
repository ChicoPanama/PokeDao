# 🚀 NEXT STEPS - CANARY ACTIVATION

**Status:** Phase 1 Complete - Ready for Canary
**Date:** 2025-10-25
**Current State:** All technical prerequisites met, warm-start keeper active

---

## ⏭️ What's Next: 3 Operational Tasks (30 min total)

You have **3 remaining tasks** before activating the 10% canary:

### 1️⃣ Configure Prometheus Alerts (10-15 min)

**Critical Alerts (auto-rollback):**

```yaml
# Alert 1: Visible Contradictions
- alert: Mew1AVisibleContradictions
  expr: increase(mew1a_visible_contradictions_total[5m]) > 0
  for: 5m
  labels:
    severity: critical
    service: mew1a-v4.3-shaped
  annotations:
    summary: "Visible contradictions detected in shaped responses"
    description: "{{ $value }} contradictions in last 5 minutes. IMMEDIATE ROLLBACK REQUIRED."
    action: "Rollback to 0% canary immediately"

# Alert 2: High Latency
- alert: Mew1AHighLatency
  expr: histogram_quantile(0.95, rate(mew1a_latency_seconds_bucket[5m])) >= 15
  for: 5m
  labels:
    severity: critical
    service: mew1a-v4.3-shaped
  annotations:
    summary: "p95 latency above 15s threshold"
    description: "p95 latency: {{ $value }}s. Expected: <1s warm, <10s SLO."
    action: "Investigate and prepare rollback"

# Alert 3: High 5xx Rate
- alert: Mew1AHigh5xxRate
  expr: rate(mew1a_requests_total{status=~"5.."}[5m]) / rate(mew1a_requests_total[5m]) >= 0.01
  for: 5m
  labels:
    severity: critical
    service: mew1a-v4.3-shaped
  annotations:
    summary: "5xx error rate above 1% threshold"
    description: "5xx rate: {{ $value | humanizePercentage }}. Expected: 0%."
    action: "Rollback to 0% canary immediately"
```

**Warning Alerts:**

```yaml
# Alert 4: Elevated Latency
- alert: Mew1AElevatedLatency
  expr: histogram_quantile(0.95, rate(mew1a_latency_seconds_bucket[5m])) >= 10
  for: 5m
  labels:
    severity: warning
    service: mew1a-v4.3-shaped
  annotations:
    summary: "p95 latency above 10s warning threshold"
    description: "p95 latency: {{ $value }}s. Monitor closely."

# Alert 5: HOLD Fallback Rate High
- alert: Mew1AHighHoldFallback
  expr: rate(mew1a_hold_fallback_total[1h]) / rate(mew1a_requests_total[1h]) > 0.10
  for: 1h
  labels:
    severity: warning
    service: mew1a-v4.3-shaped
  annotations:
    summary: "HOLD fallback rate above 10%"
    description: "HOLD fallback rate: {{ $value | humanizePercentage }}."
```

**Where to Add:**
- Prometheus config file or Grafana alert rules
- Test alert delivery (PagerDuty/Slack)

---

### 2️⃣ Update API Documentation (10 min)

**Create/Update API Docs with:**

#### New Response Schema

**Endpoint:** `POST /analyze` and `POST /generate`

**Response Structure (v4.3-shaped):**
```json
{
  // AUTHORITATIVE FIELDS (always use these)
  "recommendation": "PASS",              // Policy Engine decision
  "headline": "**RECOMMENDATION: PASS**", // User-visible summary
  "explanation": "The listed price ($120.00) is 26.3% above...",  // Policy-aligned

  // METADATA
  "shaped": true,                        // Response shaping applied
  "policy_engine": true,                 // Policy Engine active
  "tfv": 95.0,                          // Fair value
  "listed": 120.0,                      // Listed price
  "discount_pct": -26.3,                // Discount/premium %

  // DEPRECATED (do not use)
  "response": "...",                     // ⚠️ DEPRECATED - may contradict
  "analysis": "..."                      // ⚠️ DEPRECATED - use explanation
}
```

#### Client Migration Guide

**✅ CORRECT Usage:**
```javascript
// Read authoritative fields
const decision = response.recommendation;  // "BUY", "PASS", "HOLD", "NEUTRAL"
const headline = response.headline;        // "**RECOMMENDATION: PASS**"
const explanation = response.explanation;  // Policy-aligned text

// Display to user
const userDisplay = `${headline}\n\n${explanation}`;
```

**❌ DEPRECATED Usage:**
```javascript
// DON'T use these fields - they may contradict
const oldText = response.response;   // Legacy field
const oldAnalysis = response.analysis; // Legacy field
```

#### Breaking Changes Notice

```markdown
## v4.3-shaped Migration (Phase 1)

**What Changed:**
- Added `headline` field (always present)
- Added `explanation` field (policy-aligned text)
- Added `shaped` flag (indicates shaping applied)
- `response` and `analysis` fields are now DEPRECATED

**Migration Required:**
- Update clients to read `recommendation` (authoritative)
- Display `headline` + `explanation` instead of `response`
- Remove dependencies on deprecated fields

**Rollout Timeline:**
- 2025-10-25: 10% canary (v4.3-shaped)
- 2025-10-26: 50% canary
- 2025-10-27: 100% production
```

**Where to Update:**
- API documentation (Swagger/OpenAPI)
- Client SDK docs
- Internal wiki/Confluence

---

### 3️⃣ Brief Operations Team (10 min)

**Send email/Slack message:**

```markdown
Subject: [ACTION REQUIRED] Mew-1A v4.3-shaped Canary Rollout - 2025-10-25

Team,

We're rolling out Mew-1A v4.3-shaped (Phase 1 Contradiction Elimination)
starting today with a 10% canary.

📋 ROLLOUT TIMELINE
• Today 23:00 UTC: 10% canary activation
• Tomorrow 05:00 UTC: 50% ramp (if SLOs green)
• Tomorrow 23:00 UTC: 100% cut-over (if SLOs green)

🚨 CRITICAL ALERTS (auto-rollback required)
1. visible_contradictions_total > 0 (5min)
2. p95 latency >= 15s (5min)
3. 5xx rate >= 1% (5min)

⚠️ WARNING ALERTS (monitor closely)
4. p95 latency >= 10s (5min)
5. HOLD fallback rate > 10% (1h)

🔄 ROLLBACK PROCEDURE
If critical alert fires:
1. Execute: modal app stop mew1a-vllm-v4-3-shaped
2. Capture metrics: curl .../metrics > rollback-metrics.txt
3. Kill warm-keeper: pkill -f keep-v4.3-shaped-warm
4. Notify: @mew-core immediately

📊 MONITORING
• Prometheus: https://prometheus.internal/mew1a
• Grafana: https://grafana.internal/d/mew1a-canary
• Warm-keeper logs: tail -f reports/warm-start-keeper.log

✅ EXPECTED BEHAVIOR
• All responses include headline field
• Policy Engine provides authoritative recommendation
• p95 latency ~1s (warm), <10s SLO
• Zero contradictions, zero 5xx errors

📞 ON-CALL
• Primary: Check PagerDuty rotation
• Escalation: @CTO (critical only)

Questions? Reply here or ping @mew-core in #mew1a-deploys.
```

**Send To:**
- SRE team
- On-call engineers
- Product/Engineering leadership

---

## 🚀 After Completing Those 3 Tasks

Once alerts, docs, and team brief are complete:

### Activate 10% Canary

```bash
# No code changes needed - just route 10% traffic
# (This is typically done via load balancer/service mesh config)

# Verify warm-start keeper is running
ps aux | grep keep-v4.3-shaped-warm

# Check current instance health
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/health
```

### Monitor SLOs (Every 5 Minutes for Hour 1)

**Check these metrics:**
```bash
# Visible contradictions (must be 0)
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/metrics | \
  grep mew1a_visible_contradictions_total

# Request rate
curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/metrics | \
  grep mew1a_requests_total

# Latency (check p95 via Prometheus)
# 5xx rate (check via Prometheus)
```

**Expected Results:**
- visible_contradictions_total = 0
- p95 latency < 2s
- 5xx rate = 0%
- Request rate ~10% of total production traffic

### Hour-1 Decision Point

**If all SLOs green:**
✅ Proceed to 50% canary (Hour 6)

**If any critical alert:**
❌ Rollback to 0% immediately

---

## 📊 Success Criteria Summary

### Hour 1 (10% Canary)
- [ ] All critical alerts green
- [ ] visible_contradictions_total = 0
- [ ] p95 latency < 10s (target: ~1s)
- [ ] 5xx rate < 1% (target: 0%)
- [ ] No user complaints

### Hour 6 (50% Ramp Decision)
- [ ] 5 consecutive hours SLOs green
- [ ] Side-by-side comparison shows parity
- [ ] No degradation vs control baseline

### Hour 24 (100% Cut-Over Decision)
- [ ] 18+ hours at 50% with SLOs green
- [ ] Zero user-reported contradictions
- [ ] Performance stable or better

---

## 🎯 Your Next Action

**RIGHT NOW (next 30 minutes):**

1. ✅ Configure Prometheus alerts (see Alert 1-5 above)
2. ✅ Update API documentation (response schema + migration guide)
3. ✅ Brief operations team (email template above)

**THEN:**

4. ✅ Activate 10% canary
5. ✅ Monitor for 1 hour (check metrics every 5 min)
6. ✅ Make ramp decision (50% or rollback)

---

## 📞 Questions?

**Need help with:**
- **Prometheus alerts?** See your Prometheus config docs or ping SRE
- **API docs?** Update Swagger/OpenAPI spec or internal wiki
- **Canary traffic split?** Check load balancer/service mesh config
- **Rollback procedure?** See CANARY-ACTIVATION-READY.md rollback section

---

**Status:** ✅ Phase 1 Complete
**Next:** Complete 3 operational tasks (30 min) → Activate canary
**Timeline:** Start monitoring Hour 1 today

---

This is your actionable next-steps guide. Complete the 3 tasks above, then activate the 10% canary and monitor SLOs.
