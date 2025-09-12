#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
echo ">> Waiting for API health at ${BASE_URL}/health ..."
for i in {1..60}; do
  if curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
    echo "OK"; break
  fi
  sleep 1
  if [[ $i -eq 60 ]]; then
    echo "Health check timed out" >&2; exit 1
  fi
done

echo ">> Checking seeded data ..."
cards_json="$(curl -fsS "${BASE_URL}/api/cards?limit=1")"
echo "${cards_json}" | jq -e 'length >= 1' >/dev/null
echo "Smoke test passed."
