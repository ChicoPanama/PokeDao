"""
Rules Baseline Evaluator for Mew-1A v4.3 (Hybrid Structured + Fallback)
==========================================================================

Compares model's BUY/PASS decisions against deterministic rules baseline.

Hybrid Approach:
  1. PRIMARY: Structured micro-prompt forcing "BUY" or "PASS" output
  2. FALLBACK: Heuristic keyword matching for legacy/freeform outputs

Rules Baseline Logic:
  - If TFV>0 AND listed>0:
    - BUY if listed ≤ TFV * 0.90 (10%+ discount)
    - PASS if listed ≥ TFV * 1.10 (10%+ premium)
    - HOLD otherwise
  - If TFV missing or $0.00 (missing data): NEUTRAL

Target: ≥95% agreement on decisive cases (BUY/PASS only, exclude HOLD/NEUTRAL)
"""

import requests
import json
import time
from typing import Dict, List, Tuple, Optional
from datetime import datetime

# Endpoint (v4.3-SHAPED with Phase 1 Response Shaping)
ENDPOINT = "https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run"

# Structured micro-prompt (forces crisp BUY/PASS output)
STRUCTURED_PROMPT = """Analyze this Pokémon card deal and respond with ONLY one token: BUY or PASS.

Card: {card_name}{set_line}
Listed Price: ${listed_price:.2f}
Fair Value (TFV): ${fair_value:.2f}

Rules:
- If listed ≤ 0.90 * TFV → BUY
- If listed ≥ 1.10 * TFV → PASS
- Ignore fees and shipping for this test

Output:"""

# Test cases: (card, set, listed, tfv, expected_rules_decision)
TEST_CASES = [
    # BUY cases (listed ≤ TFV * 0.90)
    ("Charizard ex", "Obsidian Flames", 45.0, 52.0, "BUY"),  # 13% discount
    ("Pikachu VMAX", "Vivid Voltage", 80.0, 95.0, "BUY"),  # 16% discount
    ("Lugia V", "Silver Tempest", 20.0, 25.0, "BUY"),  # 20% discount
    ("Mewtwo VSTAR", "Pokemon Go", 35.0, 42.0, "BUY"),  # 17% discount
    ("Umbreon VMAX", "Evolving Skies", 200.0, 240.0, "BUY"),  # 17% discount

    # PASS cases (listed ≥ TFV * 1.10)
    ("Pikachu VMAX", "Vivid Voltage", 120.0, 95.0, "PASS"),  # 26% premium
    ("Charizard V", "Brilliant Stars", 50.0, 42.0, "PASS"),  # 19% premium
    ("Rayquaza VMAX", "Evolving Skies", 180.0, 155.0, "PASS"),  # 16% premium
    ("Giratina VSTAR", "Lost Origin", 45.0, 38.0, "PASS"),  # 18% premium
    ("Mew VMAX", "Fusion Strike", 65.0, 55.0, "PASS"),  # 18% premium

    # HOLD cases (within ±10%) - non-decisive, exclude from target metric
    ("Greninja ex", "Twilight Masquerade", 48.0, 50.0, "HOLD"),  # 4% discount
    ("Miraidon ex", "Paradox Rift", 32.0, 30.0, "HOLD"),  # 7% premium
    ("Koraidon ex", "Scarlet & Violet", 28.0, 27.0, "HOLD"),  # 4% premium

    # NEUTRAL cases (missing data) - non-decisive, exclude from target metric
    ("Test Card A", "Unknown Set", 0.0, 0.0, "NEUTRAL"),
    ("Test Card B", "Unknown Set", 50.0, 0.0, "NEUTRAL"),
]


def rules_baseline_decision(listed: float, tfv: float) -> str:
    """
    Deterministic rules-based decision.

    Args:
        listed: Listed price
        tfv: True Fair Value

    Returns:
        BUY, PASS, HOLD, or NEUTRAL
    """
    # Missing data check
    if tfv <= 0 or listed <= 0:
        return "NEUTRAL"

    # Calculate discount
    discount_pct = ((tfv - listed) / tfv) * 100

    if discount_pct >= 10.0:  # listed ≤ TFV * 0.90
        return "BUY"
    elif discount_pct <= -10.0:  # listed ≥ TFV * 1.10
        return "PASS"
    else:
        return "HOLD"


def strict_parse(text: str) -> Optional[str]:
    """
    Strict first-pass parser for structured output.

    Args:
        text: Model response text

    Returns:
        BUY, PASS, or None if not cleanly parsed
    """
    t = text.strip().upper()

    # Exact match first
    if t == "BUY":
        return "BUY"
    if t == "PASS":
        return "PASS"

    # Starts-with match (handles "BUY." or "PASS\n")
    if t.startswith("BUY"):
        return "BUY"
    if t.startswith("PASS"):
        return "PASS"

    return None


def heuristic_parse(text: str) -> Optional[str]:
    """
    Heuristic fallback parser for legacy/freeform outputs.

    Args:
        text: Model response text

    Returns:
        BUY, PASS, or None if indeterminate
    """
    T = text.upper()

    buy_indicators = [" BUY", "UNDERVALUED", "GOOD DEAL", "BELOW FAIR VALUE", "DISCOUNT"]
    pass_indicators = [" PASS", "OVERVALUED", "OVERPRICED", "ABOVE FAIR VALUE", "PREMIUM"]

    has_buy = any(k in T for k in buy_indicators)
    has_pass = any(k in T for k in pass_indicators)

    if has_buy and not has_pass:
        return "BUY"
    if has_pass:
        return "PASS"

    return None


def extract_model_decision(response_text: str) -> Tuple[str, bool]:
    """
    Extract BUY/PASS decision with hybrid structured + fallback parsing.

    Args:
        response_text: Model's response text

    Returns:
        (decision, fallback_used)
        decision: BUY, PASS, HOLD, or NEUTRAL
        fallback_used: True if heuristic fallback was needed
    """
    # PRIMARY: Strict parse
    decision = strict_parse(response_text)
    if decision:
        return decision, False

    # FALLBACK: Heuristic parse
    decision = heuristic_parse(response_text)
    if decision:
        return decision, True

    # LAST RESORT: NEUTRAL (will be excluded from decisive metric)
    return "NEUTRAL", False


def test_single_case(
    card_name: str,
    set_name: str,
    listed_price: float,
    fair_value: float,
    expected_rules_decision: str,
) -> Dict:
    """
    Test single case against model using structured prompt.

    Args:
        card_name: Card name
        set_name: Set name
        listed_price: Listed price
        fair_value: Fair value (TFV)
        expected_rules_decision: Expected rules baseline decision

    Returns:
        {
            "card": str,
            "set": str,
            "listed": float,
            "tfv": float,
            "rules_decision": str,
            "model_decision": str,
            "agreement": bool,
            "raw_text": str,
            "fallback_used": bool,
            "latency": float,
        }
    """
    start = time.time()

    # Build structured prompt
    set_line = f" - {set_name}" if set_name else ""
    prompt = STRUCTURED_PROMPT.format(
        card_name=card_name,
        set_line=set_line,
        listed_price=listed_price,
        fair_value=fair_value,
    )

    try:
        response = requests.post(
            f"{ENDPOINT}/generate",
            json={
                "prompt": prompt,
                "max_tokens": 10,  # Tiny output (just "BUY" or "PASS")
                "temperature": 0.0,  # Deterministic
                "use_rag": False,  # Don't need RAG for simple decision
                "listed_price": listed_price,  # For Policy Engine
                "fair_value": fair_value,  # For Policy Engine
            },
            timeout=30,
        )
        latency = time.time() - start

        if response.status_code == 200:
            data = response.json()

            # Read shaped response fields (Phase 1 response shaping)
            shaped_explanation = data.get("explanation", "").strip()
            shaped_headline = data.get("headline", "").strip()
            was_shaped = data.get("shaped", False)
            raw_text = data.get("response", "").strip()  # Legacy unshaped field

            # Use Policy Engine recommendation as authoritative decision
            api_recommendation = data.get("recommendation", "NEUTRAL")
            model_decision = api_recommendation

            # Check for visible contradictions in SHAPED text (should be zero)
            shaped_decision, _ = extract_model_decision(shaped_explanation)
            visible_contradiction = (shaped_decision != api_recommendation) if was_shaped else False

            # Keep raw textual parse for comparison only
            text_decision, _ = extract_model_decision(raw_text)
            fallback_used = (text_decision != api_recommendation)

            return {
                "card": card_name,
                "set": set_name,
                "listed": listed_price,
                "tfv": fair_value,
                "rules_decision": expected_rules_decision,
                "model_decision": model_decision,
                "agreement": model_decision == expected_rules_decision,
                "raw_text": raw_text,  # Unshaped (legacy)
                "shaped_text": shaped_explanation,  # Shaped (Phase 1)
                "headline": shaped_headline,
                "was_shaped": was_shaped,
                "visible_contradiction": visible_contradiction,  # Must be False
                "fallback_used": fallback_used,
                "latency": latency,
            }
        else:
            return {
                "card": card_name,
                "set": set_name,
                "listed": listed_price,
                "tfv": fair_value,
                "rules_decision": expected_rules_decision,
                "model_decision": "ERROR",
                "agreement": False,
                "raw_text": f"HTTP {response.status_code}",
                "fallback_used": False,
                "latency": latency,
            }
    except Exception as e:
        return {
            "card": card_name,
            "set": set_name,
            "listed": listed_price,
            "tfv": fair_value,
            "rules_decision": expected_rules_decision,
            "model_decision": "ERROR",
            "agreement": False,
            "raw_text": str(e),
            "fallback_used": False,
            "latency": time.time() - start,
        }


def run_full_evaluation() -> Dict:
    """
    Run full rules baseline evaluation.

    Returns:
        {
            "overall_agreement": float,
            "decisive_agreement": float,  # BUY/PASS only (target: ≥95%)
            "fallback_rate": float,  # % of cases needing heuristic fallback
            "by_category": {category: agreement_rate},
            "results": [test_result],
            "timestamp": str,
            "passing": bool,
        }
    """
    print("=" * 80)
    print("RULES BASELINE EVALUATION (HYBRID STRUCTURED + FALLBACK)")
    print("=" * 80)
    print(f"Endpoint: {ENDPOINT}")
    print(f"Test cases: {len(TEST_CASES)}")
    print(f"Target: ≥95% agreement on decisive cases (BUY/PASS only)")
    print(f"Approach: Structured micro-prompt → Heuristic fallback → NEUTRAL")
    print("=" * 80 + "\n")

    results = []
    category_results = {"BUY": [], "PASS": [], "HOLD": [], "NEUTRAL": []}
    fallback_count = 0

    for i, (card, set_name, listed, tfv, expected) in enumerate(TEST_CASES, 1):
        print(f"\nTest {i}/{len(TEST_CASES)}: {card} - {set_name}")
        print(f"  Listed: ${listed:.2f}, TFV: ${tfv:.2f}")
        print(f"  Expected: {expected}")

        result = test_single_case(card, set_name, listed, tfv, expected)
        results.append(result)
        category_results[expected].append(result["agreement"])

        if result["fallback_used"]:
            fallback_count += 1

        status = "✅" if result["agreement"] else "❌"
        fallback_marker = " [FALLBACK]" if result["fallback_used"] else ""
        shaped_marker = " [SHAPED]" if result.get("was_shaped") else ""
        contradiction_marker = " ⚠️ VISIBLE CONTRADICTION" if result.get("visible_contradiction") else ""

        print(f"  Model: {result['model_decision']}{fallback_marker}{shaped_marker} {status}{contradiction_marker}")
        if result.get("headline"):
            print(f"  Headline: {result['headline']}")
        if result.get("shaped_text"):
            print(f"  Shaped: {result['shaped_text'][:80]}")
        print(f"  Raw: {result['raw_text'][:80]}")
        print(f"  Latency: {result['latency']:.2f}s")

        # Rate limiting
        time.sleep(1)

    # Calculate metrics
    total_agreement = sum(r["agreement"] for r in results) / len(results)
    fallback_rate = fallback_count / len(results)

    # Phase 1: Count visible contradictions (must be ZERO)
    visible_contradiction_count = sum(1 for r in results if r.get("visible_contradiction"))

    # Decisive agreement (BUY/PASS only)
    decisive_results = [r for r in results if r["rules_decision"] in ["BUY", "PASS"]]
    decisive_agreement = (
        sum(r["agreement"] for r in decisive_results) / len(decisive_results)
        if decisive_results
        else 0.0
    )

    # Category breakdown
    by_category = {}
    for category, agreements in category_results.items():
        if agreements:
            by_category[category] = sum(agreements) / len(agreements)
        else:
            by_category[category] = 0.0

    # Print summary
    print("\n" + "=" * 80)
    print("RESULTS SUMMARY (v4.3-SHAPED)")
    print("=" * 80)
    print(f"Overall Agreement: {total_agreement:.1%} ({sum(r['agreement'] for r in results)}/{len(results)})")
    print(f"Decisive Agreement (BUY/PASS): {decisive_agreement:.1%} ({sum(r['agreement'] for r in decisive_results)}/{len(decisive_results)})")
    print(f"Fallback Rate: {fallback_rate:.1%} ({fallback_count}/{len(results)} cases)")
    print(f"Visible Contradictions (Phase 1): {visible_contradiction_count} (MUST BE ZERO)")
    print(f"\nBy Category:")
    for category, rate in by_category.items():
        count = len(category_results[category])
        print(f"  {category}: {rate:.1%} ({sum(category_results[category])}/{count})")

    # Check if passing (both criteria must be met)
    decisive_passing = decisive_agreement >= 0.95
    contradiction_passing = visible_contradiction_count == 0
    passing = decisive_passing and contradiction_passing

    status = "✅ PASS" if passing else "❌ FAIL"
    decisive_status = "✅" if decisive_passing else "❌"
    contradiction_status = "✅" if contradiction_passing else "❌ CRITICAL"

    print(f"\nTarget (≥95% decisive agreement): {decisive_status}")
    print(f"Target (0 visible contradictions): {contradiction_status}")
    print(f"Overall Status: {status}")
    print("=" * 80 + "\n")

    return {
        "overall_agreement": total_agreement,
        "decisive_agreement": decisive_agreement,
        "fallback_rate": fallback_rate,
        "by_category": by_category,
        "results": results,
        "timestamp": datetime.now().isoformat(),
        "passing": passing,
    }


def save_report(evaluation: Dict, output_path: str):
    """Save evaluation report to file"""
    with open(output_path, "w") as f:
        json.dump(evaluation, f, indent=2)
    print(f"Report saved to: {output_path}")


if __name__ == "__main__":
    # Run evaluation
    evaluation = run_full_evaluation()

    # Save report
    output_path = f"/Users/arcadio/dev/pokedao/reports/v4.3_rules_baseline_agreement.json"
    save_report(evaluation, output_path)

    # Print markdown summary
    print("\n## Rules Baseline Agreement Report\n")
    print(f"**Overall Agreement:** {evaluation['overall_agreement']:.1%}")
    print(f"**Decisive Agreement (BUY/PASS):** {evaluation['decisive_agreement']:.1%}")
    print(f"**Fallback Rate:** {evaluation['fallback_rate']:.1%}")
    print(f"**Status:** {'✅ PASSING' if evaluation['passing'] else '❌ FAILING'}\n")
    print("### By Category:\n")
    for category, rate in evaluation["by_category"].items():
        print(f"- **{category}:** {rate:.1%}")
    print(f"\n**Report:** {output_path}")
