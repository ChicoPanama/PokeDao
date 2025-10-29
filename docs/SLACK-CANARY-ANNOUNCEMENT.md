Channel: #mew1a-deploys

🚀 Starting canary: Mew-1A v4.3-shaped (10%)

What: Phase 1 response shaping — eliminates visible contradictions, preserves Policy Engine accuracy.
When: Now → 1 hour watch window
Gates:
- Visible contradictions = 0 (5m)
- p95 latency < 10s (target <1s warm)
- 5xx rate < 1%
- HOLD fallback (1h) ≤ 10%

Dash: Grafana → “Mew-1A v4.3-shaped - Canary Rollout”
Alerts: Loaded to Prometheus (critical + warnings)

Rollback (if any gate trips):
modal app stop mew1a-vllm-v4-3-shaped
curl $ENDPOINT/metrics > rollback-$(date +%Y%m%d-%H%M%S)-metrics.txt
pkill -f keep-v4.3-shaped-warm

We’ll post a status update at +60m with go/no-go for 50%.

