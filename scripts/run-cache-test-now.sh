#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_KEYS="${API_KEYS:-}"
SCENARIO="cache-optimized"
DURATION="30m"

if [[ -z "$API_KEYS" ]]; then
  echo "ERROR: API_KEYS env var is required (comma-separated)." >&2
  exit 1
fi

echo "[run-cache-test] API_BASE_URL=$API_BASE_URL"
echo "[run-cache-test] Scenario=$SCENARIO Duration=$DURATION"

echo "[run-cache-test] Checking /health..."
ATTEMPTS=60
OK=0
for i in $(seq 1 $ATTEMPTS); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/health" || true)
  if [[ "$code" == "200" ]]; then
    echo "[run-cache-test] Health OK (200)"
    OK=1
    break
  fi
  echo "[run-cache-test] Health not ready (got $code). Retry $i/$ATTEMPTS..."
  sleep 5
done

if [[ "$OK" -ne 1 ]]; then
  echo "ERROR: API health never returned 200. Aborting." >&2
  exit 2
fi

echo "[run-cache-test] Pre-warming..."
API_BASE_URL="$API_BASE_URL" API_KEYS="$API_KEYS" pnpm tsx scripts/pre-warm-api.ts | tee /tmp/prewarm.now.log

echo "[run-cache-test] Running 30-minute cache-optimized test..."
API_BASE_URL="$API_BASE_URL" API_KEYS="$API_KEYS" pnpm tsx scripts/generate-synthetic-traffic.ts --scenario="$SCENARIO" --duration="$DURATION" | tee /tmp/traffic-cache-optimized.now.log

echo "[run-cache-test] Done. Reports are in scripts/traffic-report-*.md and /tmp/*.now.log"

