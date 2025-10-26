#!/usr/bin/env python3
"""
Stage 1: Modal Endpoint Health Test for Mew-1A v4.3
Tests endpoint with 3 required scenarios per PEV plan.
"""

import requests
import json
import time
from datetime import datetime

ENDPOINT = "https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run"

# Test scenarios per PEV requirements
test_cases = [
    {
        "name": "TFV Estimation",
        "description": "Query for fair value of a known card",
        "payload": {
            "card_name": "Charizard ex",
            "set_name": "151",
            "listed_price": 45.0,
            "fair_value": 52.0,
            "max_tokens": 150
        },
        "expected": "Should provide TFV estimate and BUY/PASS decision"
    },
    {
        "name": "Card Metadata Query",
        "description": "Query for card attributes (rarity, HP, type)",
        "payload": {
            "prompt": "What rarity and HP does Pikachu ex from Scarlet & Violet have?",
            "max_tokens": 100
        },
        "expected": "Should provide rarity and HP information"
    },
    {
        "name": "Unknown Card Fallback",
        "description": "Query for non-existent or ambiguous card",
        "payload": {
            "prompt": "What's the TFV of Ancient Mew Gold edition?",
            "max_tokens": 100
        },
        "expected": "Should gracefully handle unknown card with refusal or clarification"
    }
]

print("="*70)
print("🧪 STAGE 1: MODAL ENDPOINT HEALTH TEST")
print("="*70)
print(f"Endpoint: {ENDPOINT}")
print(f"Timestamp: {datetime.now().isoformat()}")
print()

results = []

for i, test in enumerate(test_cases, 1):
    print(f"\n{'─'*70}")
    print(f"Test {i}/{len(test_cases)}: {test['name']}")
    print(f"Description: {test['description']}")
    print(f"Expected: {test['expected']}")
    print(f"{'─'*70}")

    # Determine endpoint path based on payload
    if "card_name" in test["payload"]:
        endpoint_path = f"{ENDPOINT}/analyze"
    else:
        endpoint_path = f"{ENDPOINT}/generate"

    print(f"\n📤 Sending request to {endpoint_path}...")
    print(f"Payload: {json.dumps(test['payload'], indent=2)}")

    start_time = time.time()

    try:
        response = requests.post(
            endpoint_path,
            json=test["payload"],
            headers={"Content-Type": "application/json"},
            timeout=180  # Allow 3 minutes for cold start
        )

        elapsed_time = time.time() - start_time

        print(f"\n✅ Response received in {elapsed_time:.2f}s")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            try:
                response_data = response.json()
                print(f"\n📥 Response:")
                print(json.dumps(response_data, indent=2))

                results.append({
                    "test_name": test["name"],
                    "status": "PASS",
                    "latency_seconds": elapsed_time,
                    "response": response_data,
                    "timestamp": datetime.now().isoformat()
                })
            except json.JSONDecodeError:
                print(f"\n⚠️  Response is not valid JSON:")
                print(response.text[:500])
                results.append({
                    "test_name": test["name"],
                    "status": "FAIL",
                    "error": "Invalid JSON response",
                    "latency_seconds": elapsed_time,
                    "timestamp": datetime.now().isoformat()
                })
        else:
            print(f"\n❌ Request failed with status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            results.append({
                "test_name": test["name"],
                "status": "FAIL",
                "error": f"HTTP {response.status_code}: {response.text[:200]}",
                "latency_seconds": elapsed_time,
                "timestamp": datetime.now().isoformat()
            })

    except requests.exceptions.Timeout:
        print(f"\n❌ Request timed out after 180 seconds")
        results.append({
            "test_name": test["name"],
            "status": "FAIL",
            "error": "Timeout (>180s)",
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        print(f"\n❌ Error: {e}")
        results.append({
            "test_name": test["name"],
            "status": "FAIL",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })

    # Wait between tests to avoid overwhelming endpoint
    if i < len(test_cases):
        print(f"\n⏳ Waiting 5 seconds before next test...")
        time.sleep(5)

print("\n" + "="*70)
print("📊 STAGE 1 TEST RESULTS SUMMARY")
print("="*70)

passed = sum(1 for r in results if r["status"] == "PASS")
failed = sum(1 for r in results if r["status"] == "FAIL")

print(f"\nTotal Tests: {len(results)}")
print(f"✅ Passed: {passed}")
print(f"❌ Failed: {failed}")

if results:
    avg_latency = sum(r.get("latency_seconds", 0) for r in results if "latency_seconds" in r) / len([r for r in results if "latency_seconds" in r])
    print(f"⏱️  Average Latency: {avg_latency:.2f}s")

print(f"\n{'─'*70}")
for i, result in enumerate(results, 1):
    status_emoji = "✅" if result["status"] == "PASS" else "❌"
    print(f"{status_emoji} Test {i}: {result['test_name']} - {result['status']}")
    if "latency_seconds" in result:
        print(f"   Latency: {result['latency_seconds']:.2f}s")
    if "error" in result:
        print(f"   Error: {result['error']}")

# Save results to file
output_file = "/Users/arcadio/dev/pokedao/reports/stage1_endpoint_health.json"
with open(output_file, "w") as f:
    json.dump({
        "test_suite": "Stage 1: Modal Endpoint Health Test",
        "endpoint": ENDPOINT,
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_tests": len(results),
            "passed": passed,
            "failed": failed,
            "average_latency_seconds": avg_latency if results else 0
        },
        "test_results": results
    }, f, indent=2)

print(f"\n📁 Results saved to: {output_file}")

# Final verdict
print("\n" + "="*70)
if passed == len(results):
    print("🎉 STAGE 1: PASS - Endpoint is healthy and responsive!")
elif passed >= len(results) * 0.66:
    print("⚠️  STAGE 1: PARTIAL PASS - Most tests passed, but some issues detected")
else:
    print("❌ STAGE 1: FAIL - Endpoint has significant issues")
print("="*70)
