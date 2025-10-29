#!/usr/bin/env python3
"""
Pre-flight validation for Mew-1A v4.3-shaped canary deployment.
Tests shaped response structure and Policy Engine alignment.

Usage:
    python3 scripts/pre-flight-health-check.py

Validates:
- Container warm-up and availability
- Shaped response fields (recommendation, headline, explanation, shaped)
- BUY/PASS/HOLD scenario correctness
- No visible contradictions between recommendation and explanation text
"""

import requests
import time
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Tuple

# =============================================================================
# CONFIGURATION
# =============================================================================

ENDPOINT = "https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run"
TIMEOUT_COLD = 120  # Allow for cold start on first request
TIMEOUT_WARM = 30   # Warm requests should be fast
REPORT_FILE = "reports/pre-flight-v4.3-shaped.json"

# =============================================================================
# TEST SCENARIOS
# =============================================================================

TEST_CASES = [
    {
        "name": "BUY scenario (15% discount)",
        "payload": {
            "card_name": "Charizard ex",
            "set_name": "Obsidian Flames",
            "listed_price": 42.50,
            "fair_value": 50.00,
        },
        "expected_recommendation": "BUY",
        "expected_discount": -15.0,  # Negative = discount
    },
    {
        "name": "PASS scenario (15% premium)",
        "payload": {
            "card_name": "Pikachu VMAX",
            "set_name": "Vivid Voltage",
            "listed_price": 57.50,
            "fair_value": 50.00,
        },
        "expected_recommendation": "PASS",
        "expected_discount": 15.0,  # Positive = premium
    },
    {
        "name": "HOLD scenario (5% discount - within band)",
        "payload": {
            "card_name": "Mewtwo V",
            "set_name": "Pokémon GO",
            "listed_price": 47.50,
            "fair_value": 50.00,
        },
        "expected_recommendation": "HOLD",
        "expected_discount": -5.0,
    },
]

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def wait_for_warm():
    """Ping /health until container is warm (<5s response)."""
    print("⏳ Warming up v4.3-shaped container...")
    print(f"   Endpoint: {ENDPOINT}")
    print()

    for attempt in range(5):
        start = time.time()
        try:
            resp = requests.get(f"{ENDPOINT}/health", timeout=TIMEOUT_COLD)
            latency = time.time() - start

            if resp.status_code == 200 and latency < 5:
                print(f"✅ Container warm ({latency:.2f}s)")
                print()
                return True
            elif resp.status_code == 200:
                print(f"⏳ Still warming... ({latency:.2f}s, attempt {attempt+1}/5)")
                time.sleep(5)
            else:
                print(f"❌ Health check failed: HTTP {resp.status_code}")
                return False

        except requests.Timeout:
            print(f"⏳ Attempt {attempt+1}/5: Timeout after {TIMEOUT_COLD}s, retrying...")
            time.sleep(10)
        except Exception as e:
            print(f"❌ Error during warm-up: {e}")
            return False

    print("❌ Failed to warm container after 5 attempts")
    return False

def check_visible_contradiction(recommendation: str, explanation: str, headline: str) -> Tuple[bool, str]:
    """
    Check if explanation text contradicts the recommendation.

    Returns:
        (has_contradiction, detail_message)
    """
    rec = recommendation.upper()
    expl = explanation.upper()
    head = headline.upper()

    # BUY should not mention PASS/OVERPRICED/PREMIUM language
    if rec == "BUY":
        if "PASS" in expl or "OVERPRICED" in expl or "PREMIUM" in expl:
            return True, "BUY recommendation contains PASS/OVERPRICED/PREMIUM language"
        if "PASS" in head:
            return True, "BUY headline contains 'PASS'"

    # PASS should not mention BUY/UNDERVALUED/DISCOUNT language
    if rec == "PASS":
        if "BUY" in expl or "UNDERVALUED" in expl:
            return True, "PASS recommendation contains BUY/UNDERVALUED language"
        if "BUY" in head:
            return True, "PASS headline contains 'BUY'"
        # PASS can mention "discount" when explaining why it's still overpriced despite a discount

    # HOLD can mention either BUY or PASS context (it's a middle ground)
    # No contradiction checks for HOLD

    return False, ""

def test_shaped_response():
    """Test shaped response fields across BUY/PASS/HOLD scenarios."""
    results = []

    for i, test in enumerate(TEST_CASES, 1):
        print(f"{'='*70}")
        print(f"Test {i}/{len(TEST_CASES)}: {test['name']}")
        print(f"{'='*70}")
        print(f"Payload: {test['payload']}")
        print()

        start = time.time()
        try:
            resp = requests.post(
                f"{ENDPOINT}/analyze",
                json=test["payload"],
                timeout=TIMEOUT_WARM
            )
            latency = time.time() - start
        except requests.Timeout:
            print(f"❌ Request timeout after {TIMEOUT_WARM}s")
            results.append({
                "test": test["name"],
                "passed": False,
                "error": f"Timeout after {TIMEOUT_WARM}s",
            })
            print()
            continue
        except Exception as e:
            print(f"❌ Request failed: {e}")
            results.append({
                "test": test["name"],
                "passed": False,
                "error": str(e),
            })
            print()
            continue

        # Check HTTP status
        if resp.status_code != 200:
            error_text = resp.text[:200] if resp.text else "No error message"
            print(f"❌ HTTP {resp.status_code}")
            print(f"   Response: {error_text}")
            results.append({
                "test": test["name"],
                "passed": False,
                "error": f"HTTP {resp.status_code}: {error_text}",
            })
            print()
            continue

        try:
            data = resp.json()
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON response: {e}")
            results.append({
                "test": test["name"],
                "passed": False,
                "error": f"Invalid JSON: {e}",
            })
            print()
            continue

        # Validate shaped response structure
        required_fields = ["recommendation", "headline", "explanation", "shaped"]
        missing = [f for f in required_fields if f not in data]

        if missing:
            print(f"❌ Missing required fields: {missing}")
            print(f"   Available fields: {list(data.keys())}")
            results.append({
                "test": test["name"],
                "passed": False,
                "error": f"Missing fields: {missing}",
                "available_fields": list(data.keys()),
            })
            print()
            continue

        # Validate recommendation value
        rec = data["recommendation"]
        expected_rec = test["expected_recommendation"]

        if rec != expected_rec:
            print(f"❌ Recommendation mismatch")
            print(f"   Expected: {expected_rec}")
            print(f"   Got: {rec}")
            results.append({
                "test": test["name"],
                "passed": False,
                "error": f"Expected {expected_rec}, got {rec}",
                "recommendation": rec,
                "expected": expected_rec,
            })
            print()
            continue

        # Check for visible contradictions
        has_contradiction, contradiction_detail = check_visible_contradiction(
            data["recommendation"],
            data["explanation"],
            data["headline"]
        )

        if has_contradiction:
            print(f"❌ VISIBLE CONTRADICTION: {contradiction_detail}")
            print(f"   Recommendation: {data['recommendation']}")
            print(f"   Headline: {data['headline'][:80]}")
            print(f"   Explanation: {data['explanation'][:150]}...")
            results.append({
                "test": test["name"],
                "passed": False,
                "error": f"Visible contradiction: {contradiction_detail}",
                "recommendation": data["recommendation"],
                "headline": data["headline"],
                "explanation": data["explanation"][:200],
            })
            print()
            continue

        # Success!
        print(f"✅ {test['name']}: {rec} ({latency:.2f}s)")
        print(f"   Shaped: {data['shaped']}")
        print(f"   Headline: {data['headline'][:70]}...")
        print(f"   Explanation preview: {data['explanation'][:100]}...")

        results.append({
            "test": test["name"],
            "passed": True,
            "recommendation": rec,
            "latency_seconds": round(latency, 2),
            "shaped": data["shaped"],
            "headline": data["headline"],
            "explanation_preview": data["explanation"][:150],
        })
        print()

    return results

def save_report(results, warm_success):
    """Save JSON report to reports/ directory."""
    # Ensure reports directory exists
    Path("reports").mkdir(exist_ok=True)

    report = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "endpoint": ENDPOINT,
        "warm_success": warm_success,
        "tests": results,
        "summary": {
            "total_tests": len(results),
            "passed_tests": sum(1 for r in results if r.get("passed", False)),
            "failed_tests": sum(1 for r in results if not r.get("passed", False)),
            "pass_rate": round(sum(1 for r in results if r.get("passed", False)) / len(results) * 100, 1) if results else 0,
        },
        "passed": all(r.get("passed", False) for r in results),
    }

    with open(REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2)

    print(f"📄 Report saved to {REPORT_FILE}")
    return report

def print_summary(report):
    """Print final summary."""
    print()
    print("=" * 70)
    if report["passed"]:
        print("✅ ALL PRE-FLIGHT CHECKS PASSED")
    else:
        print("❌ PRE-FLIGHT CHECKS FAILED")
    print("=" * 70)

    summary = report["summary"]
    print(f"Total tests: {summary['total_tests']}")
    print(f"Passed: {summary['passed_tests']}")
    print(f"Failed: {summary['failed_tests']}")
    print(f"Pass rate: {summary['pass_rate']}%")

    if not report["passed"]:
        print()
        print("Failed tests:")
        for r in report["tests"]:
            if not r.get("passed", False):
                print(f"  - {r['test']}: {r.get('error', 'Unknown error')}")

    print("=" * 70)

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 70)
    print("Mew-1A v4.3-shaped Pre-Flight Validation")
    print("=" * 70)
    print(f"Time: {datetime.utcnow().isoformat()}Z")
    print()

    # Step 1: Warm the container
    warm_success = wait_for_warm()
    if not warm_success:
        report = save_report([], warm_success)
        print_summary(report)
        sys.exit(1)

    # Step 2: Test shaped responses
    print("=" * 70)
    print("Testing Shaped Response Structure")
    print("=" * 70)
    print()

    results = test_shaped_response()

    # Step 3: Save report and print summary
    report = save_report(results, warm_success)
    print_summary(report)

    # Exit with appropriate code
    sys.exit(0 if report["passed"] else 1)

if __name__ == "__main__":
    main()
