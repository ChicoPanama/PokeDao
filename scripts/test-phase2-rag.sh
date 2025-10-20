#!/bin/bash

# Test Mew-1A v4.2 PHASE 2 (RAG Integration)
# Focus on factual query improvements

API_URL="https://chicopanama--mew1a-vllm-v4-2-streaming-fastapi-app.modal.run/stream"

echo "================================================================================"
echo "Mew-1A v4.2 PHASE 2 (RAG) - Factual Query Testing"
echo "================================================================================"
echo ""
echo "PHASE 2 Changes:"
echo "  - RAG middleware detects factual queries ('most expensive', 'historically')"
echo "  - Injects database context with top 10 most expensive cards"
echo "  - Forces model to answer ONLY from provided data"
echo ""
echo "Expected improvements:"
echo "  - Accurate prices for 'most expensive card' queries"
echo "  - No hallucinated Mewtwo-GX at \$69"
echo "  - Real historical data: Charizard PSA 10 \$420K, Pikachu Illustrator \$195K"
echo ""
echo "================================================================================"
echo ""

# Wait for cold start
echo "Warming up model..."
sleep 10

# Test 1: Most expensive card (THE KEY TEST from Phase 1 failure)
echo "TEST 1: What are the most expensive Pokemon card sold on eBay historically"
echo "--------------------------------------------------------------------------------"
echo "PHASE 1 RESULT: Charizard G LV.X for \$1964 (WRONG!)"
echo "EXPECTED NOW: Charizard Base Set 1st PSA 10 \$420,000"
echo ""
echo "TESTING:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What are the most expensive Pokemon card sold on eBay historically", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

# Test 2: Top 5 all-time sales
echo "TEST 2: Show me top 5 biggest Pokemon card sales all-time"
echo "--------------------------------------------------------------------------------"
echo "EXPECTED: List should include Pikachu Illustrator, Charizard 1st Ed, etc."
echo ""
echo "TESTING:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me top 5 biggest Pokemon card sales all-time", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

# Test 3: Price records
echo "TEST 3: What's the highest price ever paid for a Pokemon card?"
echo "--------------------------------------------------------------------------------"
echo "EXPECTED: \$420,000 for 1999 Charizard Base Set 1st Edition PSA 10"
echo ""
echo "TESTING:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the highest price ever paid for a Pokemon card?", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

# Test 4: Non-factual query (should pass through without RAG)
echo "TEST 4: Analyze: Charizard ex - Obsidian Flames. Listed \$45"
echo "--------------------------------------------------------------------------------"
echo "EXPECTED: Normal analysis WITHOUT database context injection"
echo ""
echo "TESTING:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze: Charizard ex - Obsidian Flames. Listed $45, fair value $52", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

echo "================================================================================"
echo "Phase 2 Testing Complete"
echo "================================================================================"
echo ""
echo "Success Criteria:"
echo "  ✓ TEST 1: Mentions \$420,000 Charizard (not \$69 Mewtwo or \$1964 Charizard G)"
echo "  ✓ TEST 2: Lists real top 5 cards from database"
echo "  ✓ TEST 3: States \$420,000 as highest price"
echo "  ✓ TEST 4: Normal analysis without '[DATABASE CONTEXT]' in response"
