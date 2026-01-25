# Mew-1A v4.3 Operational Runbook

**Version:** v4.3 (Policy Engine)
**Commit:** `af816e7`
**Status:** ✅ PRODUCTION READY
**CTO Certification Date:** 2025-10-24

---

## Quick Reference

| Resource | URL/Path |
|----------|----------|
| **Production Endpoint** | https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run |
| **Health Check** | `/health` |
| **Metrics** | `/metrics` (Prometheus) |
| **Modal Dashboard** | https://modal.com/apps/chicopanama/main/deployed/mew1a-vllm-v4.3-vector-rag |
| **Reports Directory** | `/Users/arcadio/dev/pokedao/reports/` |

---

## 1. Monitoring - Immediate (24h Baseline)

### Key Metrics to Track

#### Contradiction Rate (Primary KPI)
```bash
curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics | \
  grep "mew1a_reco_contradictions_total"
```

**Current Baseline:** 37.5% (3/8 requests)
**Alert Threshold:** ≥50% for >1 hour
**Expected Post-v4.3.1:** <5%

#### Error Rate
```bash
curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics | \
  grep "mew1a_requests_total" | grep "status=\"5"
```

**Target:** <1% 5xx errors
**Alert Threshold:** ≥1% for >15 minutes

#### Latency (p50, p95, p99)
```bash
curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics | \
  grep "mew1a_latency_seconds"
```

**Current Baseline:**
- p50: 0.72s
- p95: 0.83s
- p99: 0.83s

**Alert Threshold:** p95 >10s

#### Guardrails Activity
```bash
curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics | \
  grep -E "(tfv_repaired|zero_price_sanitized)"
```

**Expected:** ~100% repair rate on $0.00 TFV inputs

---

## 2. Hourly Metrics Collection

Run this script hourly (via cron) to capture metrics snapshots:

```bash
#!/bin/bash
# Save as: scripts/collect-hourly-metrics.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="/Users/arcadio/dev/pokedao/reports"

# Fetch raw metrics
curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics \
  > "${REPORT_DIR}/v4.3_metrics_${TIMESTAMP}.txt"

# Extract key metrics
REQUESTS_TOTAL=$(curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics | \
  grep 'mew1a_requests_total{route="/generate",status="200"}' | awk '{print $2}')

CONTRADICTIONS=$(curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics | \
  grep 'mew1a_reco_contradictions_total{route="/generate"}' | awk '{print $2}')

# Calculate contradiction rate
if [ -n "$REQUESTS_TOTAL" ] && [ -n "$CONTRADICTIONS" ]; then
  CONTRADICTION_RATE=$(echo "scale=2; ($CONTRADICTIONS / $REQUESTS_TOTAL) * 100" | bc)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) - Requests: $REQUESTS_TOTAL, Contradictions: $CONTRADICTIONS, Rate: ${CONTRADICTION_RATE}%" \
    >> "${REPORT_DIR}/v4.3_contradiction_rate_log.txt"
fi

echo "✅ Metrics collected: ${TIMESTAMP}"
```

**Cron Schedule (hourly):**
```cron
0 * * * * /Users/arcadio/dev/pokedao/scripts/collect-hourly-metrics.sh
```

---

## 3. Health Check Procedures

### Daily Health Check (Morning Routine)
```bash
#!/bin/bash
# Morning health check

echo "=== Mew-1A v4.3 Health Check ==="
echo ""

# 1. Health endpoint
echo "1. Health Endpoint:"
curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/health | jq .
echo ""

# 2. Test /generate endpoint
echo "2. Test /generate (BUY case):"
curl -s -X POST https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze: Charizard ex - Listed $45, Fair Value $52",
    "max_tokens": 50,
    "listed_price": 45.0,
    "fair_value": 52.0
  }' | jq '{recommendation, discount_pct, policy_engine, contradiction: .consistency.model_text_contradiction}'
echo ""

# 3. Test /generate endpoint (PASS case)
echo "3. Test /generate (PASS case):"
curl -s -X POST https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze: Pikachu VMAX - Listed $120, Fair Value $95",
    "max_tokens": 50,
    "listed_price": 120.0,
    "fair_value": 95.0
  }' | jq '{recommendation, discount_pct, policy_engine, contradiction: .consistency.model_text_contradiction}'
echo ""

# 4. Metrics summary
echo "4. Metrics Summary:"
curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/metrics | \
  grep -E "(requests_total|contradictions_total|latency)" | head -10
echo ""

echo "✅ Health check complete"
```

---

## 4. Incident Response

### Scenario 1: High Contradiction Rate (≥50%)

**Symptoms:** `mew1a_reco_contradictions_total` rate ≥50% for >1 hour

**Diagnosis:**
1. Check if Policy Engine is enabled:
   ```bash
   curl -s https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/health | jq .
   ```
2. Verify model deployment version
3. Check for recent config changes

**Mitigation:**
- If Policy Engine disabled: Re-deploy with `POLICY_ENGINE_ENABLED=true`
- If model version incorrect: Redeploy correct version
- Otherwise: This is expected behavior pre-v4.3.1 LoRA patch

**Escalation:** If contradiction rate >80%, consider deploying v4.3.1 LoRA patch immediately

---

### Scenario 2: High Latency (p95 >10s)

**Symptoms:** `mew1a_latency_seconds` p95 >10s

**Diagnosis:**
1. Check Modal Labs GPU availability
2. Check for cold start issues (90s typical)
3. Check for RAG query performance

**Mitigation:**
1. Restart Modal app:
   ```bash
   cd /Users/arcadio/dev/pokedao/apps/mew1a
   modal deploy vllm_deploy_vector_rag.py
   ```
2. Monitor logs:
   ```bash
   modal app logs mew1a-vllm-v4.3-vector-rag
   ```

---

### Scenario 3: High Error Rate (5xx ≥1%)

**Symptoms:** `mew1a_requests_total{status="5xx"}` ≥1%

**Diagnosis:**
1. Check Modal logs for exceptions
2. Check for Policy Engine errors
3. Check for model inference failures

**Mitigation:**
1. Review logs:
   ```bash
   modal app logs mew1a-vllm-v4.3-vector-rag 2>&1 | grep -i error
   ```
2. Restart if needed
3. If persistent, rollback to v4.2

---

### Scenario 4: Rules Baseline Failure (<95%)

**Symptoms:** Rules Baseline evaluator reports <95% decisive agreement

**Diagnosis:**
1. Run evaluator:
   ```bash
   cd /Users/arcadio/dev/pokedao
   python3 scripts/rules-baseline-evaluator.py
   ```
2. Check if Policy Engine is returning correct recommendations
3. Verify Policy Engine thresholds (BUY: 10%, PASS: 10%)

**Mitigation:**
- If Policy Engine disabled: Enable and redeploy
- If thresholds incorrect: Update config and redeploy
- If persistent: Critical bug - rollback and investigate

---

## 5. Deployment Procedures

### Standard Deployment
```bash
cd /Users/arcadio/dev/pokedao/apps/mew1a
modal deploy vllm_deploy_vector_rag.py
```

**Expected Output:**
```
✓ Created objects.
├── 🔨 Created mount policy_engine.py
├── 🔨 Created mount prometheus_metrics.py
└── 🔨 Created web function fastapi_app =>
    https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run
✓ App deployed in ~2s! 🎉
```

**Post-Deployment:**
1. Wait 90s for cold start
2. Run health check
3. Run Rules Baseline evaluator
4. Monitor metrics for 1 hour

---

### Emergency Rollback
```bash
# Rollback to v4.2 (if v4.3 fails)
cd /Users/arcadio/dev/pokedao/apps/mew1a
git checkout 9fdee1b  # v4.2 commit
modal deploy vllm_deploy_vector_rag.py
git checkout main
```

---

## 6. Configuration Variables

### Policy Engine Config
```python
POLICY_ENGINE_ENABLED = "true"  # Enable Policy Engine
BUY_THRESHOLD_PCT = "10"        # Buy if discount ≥10%
PASS_THRESHOLD_PCT = "10"       # Pass if premium ≥10%
POLICY_HEADER_INLINE = "false"  # Inline policy in prompt (future)
```

**To Change:**
1. Edit `apps/mew1a/vllm_deploy_vector_rag.py` lines 51-55
2. Redeploy
3. Verify with health check

---

## 7. Testing Procedures

### Quick Smoke Test
```bash
cd /Users/arcadio/dev/pokedao
python3 scripts/rules-baseline-evaluator.py
```

**Expected:** ≥95% decisive agreement (10/10 BUY/PASS cases)

### Comprehensive Test Suite
```bash
# Run all tests
cd /Users/arcadio/dev/pokedao

# 1. Rules Baseline (15 cases)
python3 scripts/rules-baseline-evaluator.py

# 2. TFV Guardrails (smoke tests)
bash scripts/tfv-smoke-tests.sh

# 3. Endpoint Health
python3 scripts/stage1-endpoint-health-test.py

# 4. Behavioral Consistency
python3 scripts/stage2-behavioral-consistency.py
```

---

## 8. Security Hardening

### Restrict /metrics Endpoint (TODO)
```python
# Add to vllm_deploy_vector_rag.py
@web_app.get("/metrics")
async def metrics(request: Request):
    # Verify Prometheus collector IP or token
    client_ip = request.client.host
    allowed_ips = ["1.2.3.4"]  # Prometheus collector IP

    if client_ip not in allowed_ips:
        return JSONResponse(
            status_code=403,
            content={"error": "Forbidden"}
        )

    from prometheus_metrics import get_metrics_text, CONTENT_TYPE_LATEST
    return Response(content=get_metrics_text(), media_type=CONTENT_TYPE_LATEST)
```

---

## 9. Contact Information

| Role | Contact | Escalation |
|------|---------|------------|
| **On-Call Engineer** | Claude Code | User notification |
| **CTO** | PokeDAO CTO | Critical incidents |
| **Platform Support** | Modal Labs Support | Platform issues |

---

## 10. Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| v4.3 | 2025-10-24 | Policy Engine integration | ✅ Production |
| v4.2 | 2025-10-17 | Vector RAG + NanoChat | Deprecated |
| v4.1 | 2025-10-10 | Initial deployment | Deprecated |

---

## Appendix A: Policy Engine Decision Logic

```python
def compute_recommendation(tfv: float, listed: float) -> str:
    """
    Authoritative BUY/PASS/HOLD/NEUTRAL recommendation

    Args:
        tfv: True Fair Value (market consensus)
        listed: Listed price on marketplace

    Returns:
        BUY: discount ≥10% (listed ≤ TFV * 0.90)
        PASS: premium ≥10% (listed ≥ TFV * 1.10)
        HOLD: within ±10% band
        NEUTRAL: missing/invalid data
    """
    if tfv <= 0 or listed <= 0:
        return "NEUTRAL"

    discount_pct = ((tfv - listed) / tfv) * 100

    if discount_pct >= 10.0:
        return "BUY"
    elif discount_pct <= -10.0:
        return "PASS"
    else:
        return "HOLD"
```

---

## Appendix B: Alert Definitions

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Contradiction Rate | ≥50% for >1h | Warning | Monitor |
| Critical Contradiction Rate | ≥80% for >1h | Critical | Deploy v4.3.1 |
| High Latency | p95 >10s | Warning | Investigate |
| Critical Latency | p95 >30s | Critical | Restart |
| High Error Rate | 5xx ≥1% | Warning | Check logs |
| Critical Error Rate | 5xx ≥5% | Critical | Rollback |
| Rules Baseline Failure | <95% agreement | Critical | Immediate investigation |

---

**Last Updated:** 2025-10-24
**Next Review:** 2025-10-31 (after v4.3.1 deployment)
