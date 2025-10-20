#!/bin/bash

# Test Mew-1A v4.2 Quality Improvements
# Tests multiple prompts to validate the quality fixes

API_URL="https://chicopanama--mew1a-vllm-v4-2-streaming-fastapi-app.modal.run/stream"

echo "================================================================================"
echo "Mew-1A v4.2 Quality Improvement Tests"
echo "================================================================================"
echo ""
echo "Testing with improved prompt formatting and sampling parameters:"
echo "  - Llama 3.2 chat template wrapper"
echo "  - repetition_penalty: 1.15"
echo "  - frequency_penalty: 0.7"
echo "  - temperature: 0.6 (up from 0.3)"
echo "  - max_tokens: 150 (down from 200)"
echo "  - stop sequences: [\"<|eot_id|>\", \"\\n\\n\\n\"]"
echo ""
echo "================================================================================"
echo ""

# Test 1: Charizard pricing analysis
echo "TEST 1: Charizard ex Pricing Analysis"
echo "--------------------------------------------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze: Charizard ex - Obsidian Flames. Listed $45, fair value $52, discount 13%", "max_tokens": 150}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')"
    fi
  done
echo ""
echo ""

# Test 2: Umbreon market trend
echo "TEST 2: Umbreon VMAX Market Trend"
echo "--------------------------------------------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the market trend for Umbreon VMAX cards?", "max_tokens": 150}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')"
    fi
  done
echo ""
echo ""

# Test 3: Pikachu VMAX buy/pass
echo "TEST 3: Pikachu VMAX Buy/Pass Decision"
echo "--------------------------------------------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "BUY or PASS? Pikachu VMAX - Listed $120, Fair Value $95, trending down 12%", "max_tokens": 150}' \
  --no-buffer -s 2>&1 | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "$line" | sed 's/^data: //' | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''), end='')"
    fi
  done
echo ""
echo ""

echo "================================================================================"
echo "Tests Complete"
echo "================================================================================"
