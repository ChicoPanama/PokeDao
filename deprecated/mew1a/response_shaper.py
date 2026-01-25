"""
RESPONSE SHAPING LAYER - Phase 1: Eliminate Visible Contradictions
====================================================================

This module provides runtime response shaping to ensure model explanations
always align with Policy Engine recommendations, eliminating visible contradictions.

Key Features:
- Generates policy-aligned headlines ("RECOMMENDATION: BUY/PASS/HOLD/NEUTRAL")
- Sanitizes contradictory text (removes BUY/PASS terms that conflict with policy)
- Rebuilds explanations for fallback cases using Policy Engine templates
- Tracks visible contradictions via Prometheus metrics

Target: 0% visible contradictions, <5% fallback rate, 100% Rules Baseline agreement
"""

import re
from typing import Dict, Tuple


def generate_headline(recommendation: str) -> str:
    """
    Generate top-line policy headline for UX consistency.

    Args:
        recommendation: Policy Engine decision (BUY/PASS/HOLD/NEUTRAL)

    Returns:
        Formatted headline string (e.g., "RECOMMENDATION: BUY")
    """
    return f"**RECOMMENDATION: {recommendation}**"


def sanitize_contradictory_text(text: str, recommendation: str) -> Tuple[str, bool]:
    """
    Remove contradictory BUY/PASS/HOLD terms from model text.

    Args:
        text: Model-generated explanation text
        recommendation: Authoritative Policy Engine decision

    Returns:
        Tuple of (sanitized_text, was_sanitized_flag)

    Examples:
        - If recommendation=PASS but text contains "BUY", replace with neutral phrase
        - If recommendation=BUY but text contains "PASS", replace with neutral phrase
        - If recommendation=HOLD but text contains "BUY" or "PASS", replace
    """
    original_text = text
    was_sanitized = False

    # Define neutral replacement phrases
    NEUTRAL_PHRASES = {
        "BUY": "consider this opportunity",
        "PASS": "evaluate this carefully",
        "undervalued deal": "market-aligned pricing",
        "overpriced": "priced in line with market",
        "worth purchasing": "worth considering",
        "recommend passing": "recommend evaluating further",
    }

    # Check for contradictions based on recommendation
    if recommendation == "BUY":
        # Replace any PASS-related terms
        if re.search(r'\bPASS\b', text, re.IGNORECASE):
            text = re.sub(r'\bPASS\b', 'consider this opportunity', text, flags=re.IGNORECASE)
            was_sanitized = True
        if "overpriced" in text.lower():
            text = text.replace("overpriced", "priced in line with market")
            text = text.replace("Overpriced", "Priced in line with market")
            was_sanitized = True
        if "recommend passing" in text.lower():
            text = text.replace("recommend passing", "recommend evaluating further")
            was_sanitized = True

    elif recommendation == "PASS":
        # Replace any BUY-related terms
        if re.search(r'\bBUY\b', text, re.IGNORECASE):
            text = re.sub(r'\bBUY\b', 'evaluate this carefully', text, flags=re.IGNORECASE)
            was_sanitized = True
        if "undervalued" in text.lower():
            text = text.replace("undervalued", "market-aligned")
            text = text.replace("Undervalued", "Market-aligned")
            was_sanitized = True
        if "worth purchasing" in text.lower():
            text = text.replace("worth purchasing", "worth considering")
            was_sanitized = True

    elif recommendation == "HOLD":
        # Replace any BUY or PASS terms with neutral phrasing
        if re.search(r'\bBUY\b', text, re.IGNORECASE):
            text = re.sub(r'\bBUY\b', 'priced fairly', text, flags=re.IGNORECASE)
            was_sanitized = True
        if re.search(r'\bPASS\b', text, re.IGNORECASE):
            text = re.sub(r'\bPASS\b', 'within expected range', text, flags=re.IGNORECASE)
            was_sanitized = True
        if "undervalued" in text.lower():
            text = text.replace("undervalued", "fairly valued")
            text = text.replace("Undervalued", "Fairly valued")
            was_sanitized = True
        if "overpriced" in text.lower():
            text = text.replace("overpriced", "fairly valued")
            text = text.replace("Overpriced", "Fairly valued")
            was_sanitized = True

    elif recommendation == "NEUTRAL":
        # Replace any decisive terms with neutral phrasing
        if re.search(r'\b(BUY|PASS)\b', text, re.IGNORECASE):
            text = re.sub(r'\bBUY\b', 'insufficient data to evaluate', text, flags=re.IGNORECASE)
            text = re.sub(r'\bPASS\b', 'insufficient data to evaluate', text, flags=re.IGNORECASE)
            was_sanitized = True

    return text, was_sanitized


def rebuild_explanation_from_policy(
    recommendation: str,
    listed_price: float,
    fair_value: float,
    discount_pct: float
) -> str:
    """
    Rebuild explanation text using Policy Engine's template logic.

    This is used when fallback_used=True or when model text is completely contradictory.

    Args:
        recommendation: Policy Engine decision
        listed_price: Listed price
        fair_value: TCGPlayer fair value
        discount_pct: Percentage discount (negative = premium)

    Returns:
        Policy-aligned explanation text
    """
    if recommendation == "BUY":
        return (
            f"The listed price (${listed_price:.2f}) is {discount_pct:.1f}% below "
            f"the Fair Value of ${fair_value:.2f}. This represents a discount of "
            f"${fair_value - listed_price:.2f}, making it an undervalued opportunity "
            f"worth purchasing."
        )
    elif recommendation == "PASS":
        premium_pct = abs(discount_pct)
        return (
            f"The listed price (${listed_price:.2f}) is {premium_pct:.1f}% above "
            f"the Fair Value of ${fair_value:.2f}. This represents a premium of "
            f"${listed_price - fair_value:.2f}, making it overpriced. I recommend "
            f"passing on this deal."
        )
    elif recommendation == "HOLD":
        return (
            f"The listed price (${listed_price:.2f}) is within {abs(discount_pct):.1f}% "
            f"of the Fair Value (${fair_value:.2f}). This is priced fairly and within "
            f"the expected market range."
        )
    else:  # NEUTRAL
        if fair_value == 0 or listed_price == 0:
            return (
                "Insufficient pricing data available to make a recommendation. "
                "Please verify the card details and fair value estimate."
            )
        else:
            return (
                "Unable to determine a clear recommendation based on available data. "
                "Additional market research is recommended."
            )


def shape_response(
    model_text: str,
    recommendation: str,
    listed_price: float,
    fair_value: float,
    discount_pct: float,
    fallback_used: bool,
    force_policy_headline: bool = True
) -> Dict[str, any]:
    """
    Main response shaping function - eliminates visible contradictions.

    This is the entry point for Phase 1 contradiction elimination.

    Args:
        model_text: Raw model-generated explanation
        recommendation: Policy Engine decision
        listed_price: Listed price
        fair_value: Fair value estimate
        discount_pct: Discount percentage
        fallback_used: Whether Policy Engine used fallback logic
        force_policy_headline: Whether to force headline generation (default: True)

    Returns:
        Dict with shaped response:
        {
            "headline": "RECOMMENDATION: BUY",
            "explanation": "Sanitized and policy-aligned explanation...",
            "was_sanitized": bool,
            "was_rebuilt": bool,
            "visible_contradiction": bool  # Should always be False after shaping
        }
    """
    headline = generate_headline(recommendation) if force_policy_headline else ""

    # Check if model text contradicts the recommendation BEFORE sanitization
    pre_check_contradiction = check_final_contradiction(model_text, recommendation)

    # Strategy: If contradiction detected OR fallback used, ALWAYS rebuild from policy template
    # This ensures 100% alignment with zero risk of visible contradictions
    if fallback_used or pre_check_contradiction:
        explanation = rebuild_explanation_from_policy(
            recommendation, listed_price, fair_value, discount_pct
        )
        return {
            "headline": headline,
            "explanation": explanation,
            "was_sanitized": False,
            "was_rebuilt": True,
            "visible_contradiction": False  # Rebuilt from policy, guaranteed aligned
        }

    # No contradiction detected - return model text as-is (it already aligns)
    # Final contradiction check - should always be False here
    visible_contradiction = check_final_contradiction(model_text, recommendation)

    return {
        "headline": headline,
        "explanation": model_text,
        "was_sanitized": False,
        "was_rebuilt": False,
        "visible_contradiction": visible_contradiction  # Should always be False
    }


def check_final_contradiction(text: str, recommendation: str) -> bool:
    """
    Final check for visible contradictions after sanitization.

    Returns True if contradiction still exists (this should NEVER happen after sanitization).
    This is used for the mew1a_visible_contradictions_total metric.

    Args:
        text: Sanitized explanation text
        recommendation: Policy Engine decision

    Returns:
        True if contradiction detected, False otherwise
    """
    text_upper = text.upper()

    if recommendation == "BUY":
        # Check if text contains PASS
        if re.search(r'\bPASS\b', text_upper):
            return True
        if "OVERPRICED" in text_upper:
            return True

    elif recommendation == "PASS":
        # Check if text contains BUY
        if re.search(r'\bBUY\b', text_upper):
            return True
        if "UNDERVALUED" in text_upper:
            return True

    elif recommendation == "HOLD":
        # Check if text contains BUY or PASS (should use neutral language)
        if re.search(r'\b(BUY|PASS)\b', text_upper):
            return True

    return False


def get_claude_system_prompt(recommendation: str, listed_price: float, fair_value: float, discount_pct: float) -> str:
    """
    Generate Claude system prompt for policy-aligned explanation generation.

    This prompt ensures the model generates explanations that match the Policy Engine
    recommendation from the start, reducing the need for sanitization.

    Args:
        recommendation: Policy Engine decision
        listed_price: Listed price
        fair_value: Fair value
        discount_pct: Discount percentage

    Returns:
        System prompt string for Claude orchestration
    """
    return f"""You are Mew-1A v4.3 — an intelligent Pokémon TCG pricing analyst.
Your role is to generate concise, factual explanations that match the authoritative BUY/PASS/HOLD/NEUTRAL decision computed by the Policy Engine.

**Policy Engine Context**
• The field `recommendation` is final and authoritative: **{recommendation}**
• Listed Price: ${listed_price:.2f}
• Fair Value: ${fair_value:.2f}
• Discount: {discount_pct:.1f}%
• Your explanation text MUST reinforce the {recommendation} decision.
• Never output statements that contradict it.

**Decision Alignment Rules**
• BUY → explain why the card is undervalued / below fair value.
• PASS → explain why the card is overpriced / above fair value.
• HOLD → state prices are balanced / within fair range using neutral tone.
• NEUTRAL → indicate insufficient data or missing TFV.

**When Generating Explanations**
1. Begin your explanation directly (headline will be added automatically)
2. Add one to two sentences explaining WHY the {recommendation} decision is correct
3. Do NOT use BUY or PASS inside the text unless it matches the Policy Engine's decision
4. If your reasoning suggests a different decision, discard it and follow the Policy Engine
5. Keep total length under 80 words

**Contradiction Safety Rules**
• Never say "BUY" when recommendation = PASS / HOLD / NEUTRAL
• Never say "PASS" when recommendation = BUY / HOLD / NEUTRAL
• Use "priced fairly," "market-aligned," or "within expected range" instead of conflicting phrases
• Default to neutral language aligned with HOLD if unsure

**Output Format**
Return only the explanation text. Do not include the recommendation label (it will be added as a headline).
If uncertain, follow the Policy Engine's {recommendation} decision exactly."""
