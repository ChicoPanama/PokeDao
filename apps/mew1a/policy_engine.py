"""
Policy Engine for Mew-1A v4.3
==============================

Single source of truth for BUY/PASS/HOLD recommendations.
Deterministic server-side logic eliminates model bias.

The LLM provides explanation; the Policy Engine provides the decision.
"""

import math
from dataclasses import dataclass
from typing import Optional, Dict


@dataclass
class PolicyConfig:
    """Configuration for recommendation thresholds"""
    buy_threshold_pct: float = 10.0   # listed <= TFV * (1 - 0.10) → BUY
    pass_threshold_pct: float = 10.0  # listed >= TFV * (1 + 0.10) → PASS


def compute_recommendation(
    tfv: Optional[float],
    listed: Optional[float],
    cfg: PolicyConfig = PolicyConfig()
) -> Dict:
    """
    Compute deterministic BUY/PASS/HOLD recommendation.

    Args:
        tfv: True Fair Value (market price estimate)
        listed: Listed price
        cfg: Policy configuration (thresholds)

    Returns:
        {
            "recommendation": "BUY" | "PASS" | "HOLD" | "NEUTRAL",
            "discount_pct": float or None,
            "policy_engine": True,
            "reason": str,
            "tfv": float or None,
            "listed": float or None,
        }
    """
    result = {
        "recommendation": "NEUTRAL",
        "discount_pct": None,
        "policy_engine": True,
        "reason": "insufficient_data",
        "tfv": tfv,
        "listed": listed,
        "fallback_used": False,  # True for HOLD/NEUTRAL cases where model text may contradict
    }

    # Missing data check
    if tfv is None or listed is None:
        return result

    # Validation check (must be positive finite numbers)
    if not (math.isfinite(tfv) and math.isfinite(listed)) or tfv <= 0 or listed <= 0:
        result["reason"] = "invalid_data"
        return result

    # Calculate discount percentage
    # discount_pct > 0 means listed < tfv (potential BUY)
    # discount_pct < 0 means listed > tfv (potential PASS)
    discount_pct = ((tfv - listed) / tfv) * 100.0
    result["discount_pct"] = round(discount_pct, 2)

    # Apply decision rules
    if discount_pct >= cfg.buy_threshold_pct:
        # Listed price is at least 10% below TFV → BUY
        result["recommendation"] = "BUY"
        result["reason"] = "discount_meets_threshold"
        result["fallback_used"] = False
    elif discount_pct <= -cfg.pass_threshold_pct:
        # Listed price is at least 10% above TFV → PASS
        result["recommendation"] = "PASS"
        result["reason"] = "premium_exceeds_threshold"
        result["fallback_used"] = False
    else:
        # Within ±10% band → HOLD (fallback - model may say BUY or PASS)
        result["recommendation"] = "HOLD"
        result["reason"] = "within_band"
        result["fallback_used"] = True  # HOLD uses fallback logic

    return result


def build_explanation_prompt(
    card_name: str,
    set_name: str,
    policy_result: Dict,
    reddit_sentiment: str = "",
) -> str:
    """
    Build prompt asking model to EXPLAIN the policy decision (not decide).

    Args:
        card_name: Card name
        set_name: Set name
        policy_result: Output from compute_recommendation()
        reddit_sentiment: Optional Reddit sentiment

    Returns:
        Structured prompt for model explanation
    """
    recommendation = policy_result["recommendation"]
    discount_pct = policy_result.get("discount_pct")
    tfv = policy_result.get("tfv")
    listed = policy_result.get("listed")

    # Build explanation prompt
    if recommendation == "NEUTRAL":
        prompt = f"""You are a Pokemon TCG market analyst. Explain why we cannot make a recommendation for this card due to insufficient data.

Card: {card_name}"""
        if set_name:
            prompt += f" - {set_name}"
        prompt += f"\nListed Price: ${listed if listed else 'N/A'}\nTFV: ${tfv if tfv else 'N/A'}"

    else:
        prompt = f"""You are a Pokemon TCG market analyst. A policy engine has computed a recommendation: {recommendation}.

Explain the reasoning succinctly using:
- TFV (True Fair Value = estimated market price)
- Listed price: ${listed:.2f}
- TFV: ${tfv:.2f}
- Discount: {discount_pct:+.1f}%

Card: {card_name}"""
        if set_name:
            prompt += f" - {set_name}"

        prompt += f"""

Do NOT contradict the {recommendation} recommendation. Focus on:
1. Why the discount/premium justifies this decision
2. Key caveats (card condition, fees, market liquidity)
3. Risks or opportunities"""

    if reddit_sentiment:
        prompt += f"\n\nReddit Sentiment: {reddit_sentiment}"

    return prompt


def check_text_contradiction(
    model_text: str,
    policy_recommendation: str
) -> bool:
    """
    Check if model text contradicts policy recommendation.

    Args:
        model_text: Model's explanation text
        policy_recommendation: Policy engine decision (BUY/PASS/HOLD/NEUTRAL)

    Returns:
        True if contradiction detected, False otherwise
    """
    text_upper = model_text.upper()

    # Only check BUY/PASS (HOLD/NEUTRAL are ambiguous)
    if policy_recommendation == "BUY":
        # If policy says BUY, text should not say PASS/overpriced
        pass_indicators = ["PASS", "OVERVALUED", "OVERPRICED", "TOO EXPENSIVE", "SKIP"]
        return any(ind in text_upper for ind in pass_indicators)

    elif policy_recommendation == "PASS":
        # If policy says PASS, text should not say BUY/undervalued (unless qualified)
        buy_indicators = ["BUY", "UNDERVALUED", "GOOD DEAL", "BARGAIN"]
        # Allow "not a buy" or "don't buy"
        qualified_negatives = ["NOT A BUY", "DON'T BUY", "AVOID BUY"]
        has_buy = any(ind in text_upper for ind in buy_indicators)
        has_negative = any(neg in text_upper for neg in qualified_negatives)
        return has_buy and not has_negative

    return False


# Test cases
if __name__ == "__main__":
    print("=" * 80)
    print("POLICY ENGINE TEST CASES")
    print("=" * 80 + "\n")

    test_cases = [
        # BUY cases (discount >= 10%)
        ("Charizard ex", 45.0, 52.0, "BUY", 13.46),
        ("Pikachu VMAX", 80.0, 95.0, "BUY", 15.79),

        # PASS cases (premium >= 10%)
        ("Pikachu VMAX", 120.0, 95.0, "PASS", -26.32),
        ("Charizard V", 50.0, 42.0, "PASS", -19.05),

        # HOLD cases (within ±10%)
        ("Greninja ex", 48.0, 50.0, "HOLD", 4.0),
        ("Miraidon ex", 32.0, 30.0, "HOLD", -6.67),

        # NEUTRAL cases (missing data)
        ("Test Card", 0.0, 0.0, "NEUTRAL", None),
        ("Test Card", 50.0, 0.0, "NEUTRAL", None),
    ]

    for card, listed, tfv, expected_rec, expected_discount in test_cases:
        result = compute_recommendation(
            tfv=tfv if tfv > 0 else None,
            listed=listed if listed > 0 else None
        )

        status = "✅" if result["recommendation"] == expected_rec else "❌"
        print(f"{status} {card}: Listed ${listed:.2f}, TFV ${tfv:.2f}")
        print(f"   Expected: {expected_rec}, Got: {result['recommendation']}")
        print(f"   Discount: {result['discount_pct']}% (expected {expected_discount})")
        print(f"   Reason: {result['reason']}\n")

    print("=" * 80)
