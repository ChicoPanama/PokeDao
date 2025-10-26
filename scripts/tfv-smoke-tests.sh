#!/bin/bash
# TFV Definition Smoke Tests - Post-Fix Verification
# Must pass all 5 tests to unblock launch

ENDPOINT="https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/generate"

echo "================================================================"
echo "TFV DEFINITION SMOKE TESTS - v4.3 POST-FIX"
echo "================================================================"
echo "Endpoint: $ENDPOINT"
echo "Test Time: $(date)"
echo ""

# Test 1: What does TFV mean?
echo "────────────────────────────────────────────────────────────────"
echo "Test 1/5: What does TFV mean in Pokémon card pricing?"
echo "────────────────────────────────────────────────────────────────"
curl --max-time 120 -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What does TFV mean in Pokemon card pricing?", "max_tokens": 100, "temperature": 0.1}' \
  | python3 -m json.tool | tee /tmp/tfv_test1.json
echo ""
echo ""

# Test 2: Explain TFV in one sentence
echo "────────────────────────────────────────────────────────────────"
echo "Test 2/5: Explain TFV on Charizard ex 151 in one sentence"
echo "────────────────────────────────────────────────────────────────"
curl --max-time 120 -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain TFV on Charizard ex 151 in one sentence.", "max_tokens": 100, "temperature": 0.1}' \
  | python3 -m json.tool | tee /tmp/tfv_test2.json
echo ""
echo ""

# Test 3: TFV vs listed price logic
echo "────────────────────────────────────────────────────────────────"
echo "Test 3/5: Give TFV vs listed price logic: listed \$45, TFV \$52"
echo "────────────────────────────────────────────────────────────────"
curl --max-time 120 -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Give TFV vs listed price logic: listed $45, TFV $52.", "max_tokens": 100, "temperature": 0.1}' \
  | python3 -m json.tool | tee /tmp/tfv_test3.json
echo ""
echo ""

# Test 4: Is TFV a grading scale?
echo "────────────────────────────────────────────────────────────────"
echo "Test 4/5: Is TFV a grading scale?"
echo "────────────────────────────────────────────────────────────────"
curl --max-time 120 -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Is TFV a grading scale?", "max_tokens": 100, "temperature": 0.1}' \
  | python3 -m json.tool | tee /tmp/tfv_test4.json
echo ""
echo ""

# Test 5: How do PSA grades relate to TFV?
echo "────────────────────────────────────────────────────────────────"
echo "Test 5/5: How do PSA grades relate to TFV?"
echo "────────────────────────────────────────────────────────────────"
curl --max-time 120 -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "How do PSA grades relate to TFV?", "max_tokens": 100, "temperature": 0.1}' \
  | python3 -m json.tool | tee /tmp/tfv_test5.json
echo ""
echo ""

echo "================================================================"
echo "TFV SMOKE TESTS COMPLETE"
echo "================================================================"
echo "Review responses above. ALL must:"
echo "  ✓ State 'TFV = True Fair Value'"
echo "  ✓ Explicitly deny TFV as a grading scale"
echo "  ✓ Avoid invented grade acronyms (EXC/MOD/DAM)"
echo ""
echo "Results saved to: /tmp/tfv_test*.json"
echo "================================================================"
