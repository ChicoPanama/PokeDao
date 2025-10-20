#!/bin/bash

# Test Mew-1A v4.2 PHASE 1 Quality Improvements
# Tests the same prompts that showed hallucinations before

API_URL="https://chicopanama--mew1a-vllm-v4-2-streaming-fastapi-app.modal.run/stream"

echo "================================================================================"
echo "Mew-1A v4.2 PHASE 1 Quality Improvements - Testing"
echo "================================================================================"
echo ""
echo "PHASE 1 Changes:"
echo "  - Added 'I don't know' fallback to system prompt"
echo "  - repetition_penalty: 1.15 → 1.25 (stronger hallucination prevention)"
echo "  - presence_penalty: 0.3 (NEW - penalize new fabricated details)"
echo "  - max_tokens: 150 → 250 (allow complete responses)"
echo ""
echo "Expected improvements:"
echo "  - Fewer fabricated bid counts, grades, and conditions"
echo "  - Complete responses without cut-offs"
echo "  - Honest 'I don't have that information' when appropriate"
echo ""
echo "================================================================================"
echo ""

# Wait for cold start
echo "Warming up model (cold start ~60s)..."
sleep 10

# Test 1: 1999 Base Set Charizard PSA 9
echo "TEST 1: 1999 Pokemon Base Set Shadowless 1st Edition Holo Charizard #4 PSA 9 MINT"
echo "--------------------------------------------------------------------------------"
echo "BEFORE: Hallucinated BGS 10 grade, fabricated bid count (7 bids)"
echo "TESTING NOW:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "1999 Pokemon Base Set Shadowless 1st Edition Holo Charizard #4 PSA 9 MINT", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

# Test 2: 1999 Charizard BGS 8
echo "TEST 2: 1999 #4 Charizard-Holo 1st Edition BGS 8 Game Pokemon"
echo "--------------------------------------------------------------------------------"
echo "BEFORE: Changed set to 'XY Black Star Promos', hallucinated prices"
echo "TESTING NOW:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "1999 #4 Charizard-Holo 1st Edition BGS 8 Game Pokemon", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

# Test 3: 2023 Charizard EX
echo "TEST 3: 2023 #185 Charizard EX PSA 9 Japanese Sv2a- 151 Pokemon"
echo "--------------------------------------------------------------------------------"
echo "BEFORE: Claimed BGS 10, fabricated 18 bids, hallucinated price changes"
echo "TESTING NOW:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "2023 #185 Charizard EX PSA 9 Japanese Sv2a- 151 Pokemon", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

# Test 4: Most expensive card (factual query)
echo "TEST 4: What are the most expensive Pokemon card sold on eBay historically"
echo "--------------------------------------------------------------------------------"
echo "BEFORE: Claimed Mewtwo-GX at $69.41 was most expensive (WRONG!)"
echo "TESTING NOW:"
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

# Test 5: Simple card analysis
echo "TEST 5: Analyze: Charizard ex - Obsidian Flames. Listed \$45, fair value \$52"
echo "--------------------------------------------------------------------------------"
echo "BEFORE: Fabricated 15 bids, CGC 9 grade not mentioned in prompt"
echo "TESTING NOW:"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze: Charizard ex - Obsidian Flames. Listed $45, fair value $52, discount 13%", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo ""
echo ""

echo "================================================================================"
echo "Tests Complete - Review for Hallucination Reduction"
echo "================================================================================"
echo ""
echo "Check results for:"
echo "  ✓ No fabricated bid counts"
echo "  ✓ No incorrect grading companies/scores"
echo "  ✓ No cut-off responses"
echo "  ✓ 'I don't know' when lacking data"
echo "  ✓ Accurate factual responses (Test 4)"
