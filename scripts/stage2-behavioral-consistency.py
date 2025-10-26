#!/usr/bin/env python3
"""
Stage 2: Model Behavior Consistency Test for Mew-1A v4.3
Tests 10-15 diverse prompts to verify consistent, accurate, and graceful behavior.
"""

import requests
import json
import time
from datetime import datetime

ENDPOINT = "https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/generate"

# 15 diverse test scenarios covering factual accuracy, reasoning, and edge cases
test_scenarios = [
    {
        "id": 1,
        "category": "TFV Estimation",
        "prompt": "What is the fair value of Charizard ex from the 151 set?",
        "expected": "Should provide TFV estimate or acknowledge need for market data",
        "checks": ["reasoning", "price_mention", "no_hallucination"]
    },
    {
        "id": 2,
        "category": "Card Metadata",
        "prompt": "What rarity is Pikachu VMAX from Vivid Voltage?",
        "expected": "Should provide rarity or state if unknown",
        "checks": ["factual", "graceful_degradation"]
    },
    {
        "id": 3,
        "category": "BUY/PASS Decision",
        "prompt": "A Mewtwo GX is listed at $15 with fair value $22. Should I buy or pass?",
        "expected": "Should recommend BUY with discount reasoning",
        "checks": ["decision_clarity", "discount_calculation", "recommendation"]
    },
    {
        "id": 4,
        "category": "BUY/PASS Decision",
        "prompt": "Gengar VMAX is listed at $50 but fair value is $35. Buy or pass?",
        "expected": "Should recommend PASS due to overpricing",
        "checks": ["decision_clarity", "overpriced_detection", "recommendation"]
    },
    {
        "id": 5,
        "category": "Market Trend",
        "prompt": "Is Umbreon VMAX trending up or down in price?",
        "expected": "Should acknowledge need for temporal data or provide insight",
        "checks": ["reasoning", "no_fabrication"]
    },
    {
        "id": 6,
        "category": "Set Information",
        "prompt": "What sets contain Charizard cards with high market value?",
        "expected": "Should mention known high-value sets or acknowledge limited data",
        "checks": ["factual", "set_knowledge"]
    },
    {
        "id": 7,
        "category": "Unknown Card Fallback",
        "prompt": "What's the value of Ancient Mew Gold Deluxe Edition?",
        "expected": "Should gracefully state card not found or ambiguous",
        "checks": ["graceful_degradation", "no_hallucination"]
    },
    {
        "id": 8,
        "category": "Ambiguous Query",
        "prompt": "Tell me about Pikachu.",
        "expected": "Should ask for clarification or mention multiple Pikachu cards exist",
        "checks": ["clarification", "no_hallucination"]
    },
    {
        "id": 9,
        "category": "Price Comparison",
        "prompt": "Compare prices: Eevee V at $8 vs Jolteon VMAX at $12. Which is better value?",
        "expected": "Should reason about relative value or acknowledge need for TFV data",
        "checks": ["reasoning", "comparative_analysis"]
    },
    {
        "id": 10,
        "category": "Grading Impact",
        "prompt": "How does PSA 10 grading affect the value of a Charizard card?",
        "expected": "Should explain grading premium or acknowledge grading significance",
        "checks": ["reasoning", "grading_knowledge"]
    },
    {
        "id": 11,
        "category": "Investment Advice",
        "prompt": "Should I invest $100 in modern sets or vintage cards?",
        "expected": "Should provide balanced reasoning or acknowledge speculation",
        "checks": ["reasoning", "risk_awareness"]
    },
    {
        "id": 12,
        "category": "Edge Case - Missing Context",
        "prompt": "Is this card a good buy?",
        "expected": "Should ask for card name and price details",
        "checks": ["clarification", "no_hallucination"]
    },
    {
        "id": 13,
        "category": "Factual - HP Value",
        "prompt": "What is the HP of Mewtwo ex from 151 set?",
        "expected": "Should provide HP if known or state need to verify",
        "checks": ["factual", "graceful_degradation"]
    },
    {
        "id": 14,
        "category": "Market Insight",
        "prompt": "Why are Eeveelution cards popular among collectors?",
        "expected": "Should provide reasoning about collectibility",
        "checks": ["reasoning", "collector_knowledge"]
    },
    {
        "id": 15,
        "category": "TFV Language Consistency",
        "prompt": "What does TFV mean in Pokemon card pricing?",
        "expected": "Should define TFV as fair value or market value",
        "checks": ["terminology", "consistency"]
    }
]

print("="*70)
print("🧪 STAGE 2: MODEL BEHAVIOR CONSISTENCY TEST")
print("="*70)
print(f"Endpoint: {ENDPOINT}")
print(f"Timestamp: {datetime.now().isoformat()}")
print(f"Total Scenarios: {len(test_scenarios)}")
print()

results = []

for scenario in test_scenarios:
    print(f"\n{'─'*70}")
    print(f"Test {scenario['id']}/{len(test_scenarios)}: {scenario['category']}")
    print(f"Prompt: {scenario['prompt']}")
    print(f"Expected: {scenario['expected']}")
    print(f"{'─'*70}")

    payload = {
        "prompt": scenario["prompt"],
        "max_tokens": 200,
        "temperature": 0.3,
        "use_rag": True
    }

    start_time = time.time()

    try:
        response = requests.post(
            ENDPOINT,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        elapsed_time = time.time() - start_time

        if response.status_code == 200:
            response_data = response.json()
            response_text = response_data.get("response", "")

            print(f"\n✅ Response ({elapsed_time:.2f}s):")
            print(f"   {response_text[:500]}{'...' if len(response_text) > 500 else ''}")

            # Manual assessment placeholders (to be filled during review)
            assessment = {
                "test_id": scenario["id"],
                "category": scenario["category"],
                "prompt": scenario["prompt"],
                "response": response_text,
                "latency_seconds": elapsed_time,
                "tokens": response_data.get("tokens", 0),
                "tokens_per_second": response_data.get("tokens_per_second", 0),
                "rag_augmented": response_data.get("rag_augmented", False),
                "rag_cards_count": response_data.get("rag_cards_count", 0),
                "checks": scenario["checks"],
                "status": "PENDING_REVIEW",  # To be manually assessed
                "timestamp": datetime.now().isoformat()
            }

            results.append(assessment)

        else:
            print(f"\n❌ Request failed with status {response.status_code}")
            print(f"   Response: {response.text[:300]}")

            results.append({
                "test_id": scenario["id"],
                "category": scenario["category"],
                "prompt": scenario["prompt"],
                "status": "FAIL",
                "error": f"HTTP {response.status_code}: {response.text[:200]}",
                "latency_seconds": elapsed_time,
                "timestamp": datetime.now().isoformat()
            })

    except Exception as e:
        print(f"\n❌ Error: {e}")
        results.append({
            "test_id": scenario["id"],
            "category": scenario["category"],
            "prompt": scenario["prompt"],
            "status": "FAIL",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })

    # Small delay between tests
    time.sleep(2)

# Save raw results
output_json = "/Users/arcadio/dev/pokedao/reports/stage2_raw_results.json"
with open(output_json, "w") as f:
    json.dump({
        "test_suite": "Stage 2: Model Behavior Consistency",
        "endpoint": ENDPOINT,
        "timestamp": datetime.now().isoformat(),
        "total_tests": len(test_scenarios),
        "results": results
    }, f, indent=2)

print(f"\n{'═'*70}")
print(f"📊 STAGE 2 RAW RESULTS COLLECTED")
print(f"{'═'*70}")
print(f"\nTotal Tests: {len(results)}")
print(f"✅ Completed: {sum(1 for r in results if r['status'] != 'FAIL')}")
print(f"❌ Failed: {sum(1 for r in results if r['status'] == 'FAIL')}")
print(f"\n📁 Raw results saved to: {output_json}")
print()
print("⚠️  NEXT STEP: Manual review required to assess each response.")
print("    Run: python3 scripts/stage2-assess-consistency.py")
print("    This will analyze responses and generate the final report.")
print("="*70)
