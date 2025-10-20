#!/bin/bash

# Comprehensive Phase 2 RAG Test Suite
# Tests factual queries AND primary use case (card name → investment analysis)

API_URL="https://chicopanama--mew1a-vllm-v4-2-streaming-fastapi-app.modal.run/stream"

echo "================================================================================"
echo "Mew-1A v4.2 PHASE 2 - COMPREHENSIVE TEST SUITE"
echo "================================================================================"
echo ""
echo "Testing TWO scenarios:"
echo "  A) Factual Queries (RAG-enhanced with database context)"
echo "  B) Card Analysis (Primary use case - card name → investment thesis)"
echo ""
echo "================================================================================"
echo ""

# Warm up
echo "⏳ Warming up model (cold start ~60s)..."
sleep 15

echo ""
echo "================================================================================"
echo "SECTION A: FACTUAL QUERIES (RAG-Enhanced)"
echo "================================================================================"
echo ""

# A1: Most expensive card
echo "A1. Most expensive Pokemon card historically"
echo "--------------------------------------------------------------------------------"
echo "EXPECTED: \$420,000 Charizard Base Set 1st Edition PSA 10"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What are the most expensive Pokemon cards sold on eBay historically?", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# A2: Top 10 all-time
echo "A2. Show me the top 10 most valuable Pokemon cards of all time"
echo "--------------------------------------------------------------------------------"
echo "EXPECTED: List including Pikachu Illustrator (\$195K), Blastoise 1st Ed (\$55K)"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me the top 10 most valuable Pokemon cards of all time", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# A3: Price records
echo "A3. What's the highest price record for a Pokemon card?"
echo "--------------------------------------------------------------------------------"
echo "EXPECTED: \$420,000"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the highest price record for a Pokemon card?", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

echo ""
echo "================================================================================"
echo "SECTION B: CARD ANALYSIS (Primary Use Case)"
echo "================================================================================"
echo ""
echo "Testing: User inputs card name → Expects investment thesis + market insights"
echo ""

# B1: Just card name
echo "B1. Charizard VMAX"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Just the card name (most common user behavior)"
echo "EXPECTED: Market analysis, price insights, investment recommendation"
echo "SHOULD NOT: Hallucinate specific bids/grades unless mentioned"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Charizard VMAX", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# B2: Card name with set
echo "B2. Pikachu VMAX - Vivid Voltage"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Card name + set"
echo "EXPECTED: Specific set analysis, pricing trends"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Pikachu VMAX - Vivid Voltage", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# B3: Vintage card
echo "B3. 1999 Base Set Charizard"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Vintage card (high value)"
echo "EXPECTED: Investment-grade analysis, PSA grading importance"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "1999 Base Set Charizard", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# B4: Modern card
echo "B4. Umbreon VMAX Alt Art"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Modern chase card"
echo "EXPECTED: Current market sentiment, collectibility notes"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Umbreon VMAX Alt Art", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# B5: Card with price context
echo "B5. Charizard ex - Obsidian Flames. Listed at \$45"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Card name + current price"
echo "EXPECTED: Value assessment (good deal? overpriced?), buy/pass recommendation"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Charizard ex - Obsidian Flames. Listed at $45", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# B6: Graded card
echo "B6. Charizard Base Set PSA 9"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Card with grade"
echo "EXPECTED: Grade-specific pricing, PSA 9 vs PSA 10 comparison"
echo "SHOULD NOT: Change PSA 9 to BGS 10 or other grade"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Charizard Base Set PSA 9", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# B7: Buy/Pass decision
echo "B7. Should I buy this Mewtwo GX Rainbow Rare for \$80?"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Investment decision query"
echo "EXPECTED: Clear BUY or PASS with reasoning"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Should I buy this Mewtwo GX Rainbow Rare for $80?", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

# B8: Market trend question
echo "B8. What's the market trend for Eeveelution cards?"
echo "--------------------------------------------------------------------------------"
echo "INPUT: Broad market question"
echo "EXPECTED: General trend analysis, NOT database RAG injection"
echo ""
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the market trend for Eeveelution cards?", "max_tokens": 250}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')" 2>/dev/null
    fi
  done
echo -e "\n"

echo ""
echo "================================================================================"
echo "COMPREHENSIVE TEST RESULTS"
echo "================================================================================"
echo ""
echo "SECTION A - Factual Queries (RAG):"
echo "  A1-A3: Should mention \$420K Charizard, Pikachu Illustrator, etc."
echo ""
echo "SECTION B - Card Analysis (Primary Use Case):"
echo "  B1-B4: Investment thesis for card name input"
echo "  B5: Price evaluation (good deal or not)"
echo "  B6: Grade-specific analysis (MUST preserve user's PSA 9)"
echo "  B7: Clear BUY/PASS recommendation"
echo "  B8: Market trend (NO RAG injection)"
echo ""
echo "QUALITY CHECKS:"
echo "  ✓ No cut-off responses (all should complete)"
echo "  ✓ No hallucinated bid counts unless user provides them"
echo "  ✓ No grade changes (PSA 9 should stay PSA 9, not become BGS 10)"
echo "  ✓ Factual queries get accurate \$420K data (not \$69 or \$1964)"
echo "  ✓ Simple card names get investment analysis (not 'I don't have data')"
echo ""
echo "================================================================================"
