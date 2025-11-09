# Run Cache-Optimized Test Now

This is a one‑page, cut‑and‑run guide to validate the cache optimization changes end‑to‑end.

Prereqs
- API/DB/Redis are running on your machine
- Port 3000 is used by the API (or set `API_BASE_URL` to your host)
- You have 2–3 API keys for authenticated traffic

Step 0 — Fix schema in running API (if not yet deployed)
- Ensure your running API uses `marketListing` (not `unifiedMarketListing`) in `api/src/routes/card-comprehensive.ts` for listings by `canonicalCardId`.
- The repository already has the correct code. Restart the API with this build.

Step 1 — Restart API with cache TTLs
```bash
export CACHE_TTL_SEARCH=900
export CACHE_TTL_ANALYSIS=900
export CACHE_TTL_AI=900
# Then restart API the way you normally do (pm2/systemd/docker/pnpm dev)
```

Step 2 — (Optional) Flush Redis for a clean slate
```bash
redis-cli FLUSHALL
```

Step 3 — Pre‑warm caches
```bash
export API_BASE_URL="http://localhost:3000"   # or your reachable URL
export API_KEYS="key1,key2,key3"
pnpm tsx scripts/pre-warm-api.ts | tee /tmp/prewarm.log
```

Step 4 — Run 30‑minute cache‑optimized scenario
```bash
export API_BASE_URL="http://localhost:3000"
export API_KEYS="key1,key2,key3"
pnpm tsx scripts/generate-synthetic-traffic.ts \
  --scenario=cache-optimized \
  --duration=30m | tee /tmp/traffic-cache-optimized-30m.log
```

Step 5 — Review results
- A report is written to `scripts/traffic-report-*.md`
- Check key metrics:
  - Server cache hit rate > 50%
  - Client cache hit rate > 50% (now accurate via `x-cache-status`)
  - Steady‑state p95 < 10s; cached p95 < 100ms
  - API‑key success 100%, 0% 5xx

One‑command runner (optional)
```bash
chmod +x scripts/run-cache-test-now.sh
API_BASE_URL="http://localhost:3000" API_KEYS="key1,key2,key3" \
  scripts/run-cache-test-now.sh
```

Tunnel testing
- If using Cloudflare Tunnel, make sure it forwards to the API (e.g., `cloudflared tunnel --url http://localhost:3000`).
- Verify `/health` over the tunnel returns HTTP 200 before starting.

Expected outcomes
- Cache hit rate: 7.7% → 55–65%
- P95 latency: 15.2s → < 10s
- Compression reduces payload size 40–60%
- Success rate for API‑key tier stays at 100%

