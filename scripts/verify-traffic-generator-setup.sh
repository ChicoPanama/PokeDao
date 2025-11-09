#!/usr/bin/env bash
set -euo pipefail

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Verifying Synthetic Traffic Generator Setup ===${NC}"

API_URL=${API_BASE_URL:-"http://localhost:3000"}
echo -e "API_BASE_URL: ${API_URL}"

missing=()
for var in DATABASE_URL DEEPSEEK_API_KEY; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo -e "${RED}❌ Missing required env vars: ${missing[*]}${NC}"
  echo "Export them before proceeding. Example:"
  echo "  export DATABASE_URL=postgresql://pokedao:pokedao@localhost:5432/pokedao"
  echo "  export DEEPSEEK_API_KEY=sk-test"
  exit 1
else
  echo -e "${GREEN}✓ Required env vars present (DATABASE_URL, DEEPSEEK_API_KEY)${NC}"
fi

if [[ -z "${API_KEYS:-}" ]]; then
  echo -e "${YELLOW}⚠️  API_KEYS not set — tests will run with anonymous users only (10/hr/IP).${NC}"
else
  echo -e "${GREEN}✓ API_KEYS set${NC}"
fi

echo -e "\n${YELLOW}Checking Redis...${NC}"
if command -v redis-cli >/dev/null 2>&1; then
  if redis-cli ping >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis reachable (PONG)${NC}"
  else
    echo -e "${RED}❌ Redis not reachable. Start it with: brew services start redis${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  redis-cli not found. Skipping Redis ping. Make sure Redis is running on ${REDIS_URL:-redis://localhost:6379}.${NC}"
fi

echo -e "\n${YELLOW}Checking API health...${NC}"
health=$(curl -sS "${API_URL}/health" || true)
if [[ -z "$health" ]]; then
  echo -e "${RED}❌ API not reachable at ${API_URL}. Start with: pnpm api:dev${NC}"
  exit 1
fi
echo "$health" | grep -qi '"status"\s*:\s*"ok"' && \
  echo -e "${GREEN}✓ API health OK${NC}" || \
  echo -e "${YELLOW}⚠️  API health degraded (check DB/Redis).${NC}"

echo -e "\n${YELLOW}Checking search-variants route...${NC}"
searchResp=$(curl -sS "${API_URL}/api/cards/search-variants?q=Charizard%20ex&set=Obsidian%20Flames&limit=5" || true)
if echo "$searchResp" | grep -qi '"ok"\s*:\s*true'; then
  count=$(echo "$searchResp" | grep -o '"canonicalCardId"' | wc -l | tr -d ' ')
  echo -e "${GREEN}✓ search-variants responding (${count} matches)${NC}"
else
  echo -e "${YELLOW}⚠️  search-variants did not return ok:true. Verify DB seed and routes.${NC}"
fi

echo -e "\n${YELLOW}Checking /metrics endpoint...${NC}"
metrics=$(curl -sS "${API_URL}/metrics" || true)
if [[ -n "$metrics" ]]; then
  echo "$metrics" | grep -q '^api_requests_total' && echo -e "${GREEN}✓ API request metrics present${NC}" || echo -e "${YELLOW}⚠️  api_requests_total not yet emitted (no requests yet).${NC}"
  echo "$metrics" | grep -q '^api_cache_hits_total' && echo -e "${GREEN}✓ API cache hit metrics present${NC}" || echo -e "${YELLOW}⚠️  api_cache_hits_total not present yet.${NC}"
else
  echo -e "${YELLOW}⚠️  /metrics empty or disabled. Proceeding without server-side cache validation.${NC}"
fi

echo -e "\n${GREEN}✅ Verification complete. You are ready to run the 5-minute test.${NC}"
echo -e "Run: pnpm tsx scripts/generate-synthetic-traffic.ts --scenario=normal --duration=5m"

