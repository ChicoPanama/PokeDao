Subject: [ACTION REQUIRED] Mew-1A v4.3-shaped Canary Rollout (10% Today)

To: SRE, On-Call, Engineering Leadership
From: mew-core
When: Today @ 23:00 UTC (10% canary)

Hello team,

We’re starting the Mew-1A v4.3-shaped canary rollout today.

What it is
- Phase 1: Response shaping to eliminate visible contradictions while preserving Policy Engine accuracy.
- Target: 10% → 50% → 100% (24h), with strict go/no-go gates.

Monitoring (Prometheus/Grafana)
- Dashboard: “Mew-1A v4.3-shaped - Canary Rollout”
- Critical gates:
  - Visible contradictions: sum(increase(mew1a_visible_contradictions_total[5m])) == 0
  - p95 latency: histogram_quantile(0.95, sum by (le) (rate(mew1a_latency_seconds_bucket{route!="/health"}[5m]))) < 10
  - 5xx rate: sum(rate(mew1a_requests_total{status=~"5.."}[5m])) / sum(rate(mew1a_requests_total[5m])) < 0.01
  - HOLD fallback (1h): sum(rate(mew1a_hold_fallback_total[1h])) / sum(rate(mew1a_requests_total[1h])) <= 0.10

Rollout timeline
- 10% for 1h: monitor every 5 minutes
- 50% for 4h: sustained monitoring
- 100% for 24h validation

Rollback procedure (copy/paste)
1) modal app stop mew1a-vllm-v4-3-shaped
2) curl https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/metrics \
   > rollback-$(date +%Y%m%d-%H%M%S)-metrics.txt
3) pkill -f keep-v4.3-shaped-warm
4) Notify @mew-core immediately (include metrics snapshot)

Client impact
- New fields: recommendation (authoritative), headline, explanation
- Deprecated: response, analysis
- Docs: docs/API-DOCUMENTATION-V4.3-SHAPED.md

Next steps
- SRE: Load alert rules, confirm dashboard panels are wired
- On-call: Stay on-point during the 10% hour; follow gates
- Eng Leads: Confirm client migration readiness

Thanks,
mew-core

