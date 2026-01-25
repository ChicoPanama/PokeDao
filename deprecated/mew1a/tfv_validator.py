"""
TFV Post-Response Validator
============================

Detects and repairs incorrect TFV terminology in model responses.

This is ChatGPT's recommended approach:
- Post-processing safety layer (outside model inference)
- Deterministic regex-based detection
- Auto-repair footer if TFV mentioned incorrectly
- Session-aware: Shows footer once per session (improved UX)
"""

import re
import time
from typing import Tuple, Optional
from collections import defaultdict

# =============================================================================
# VALIDATION PATTERNS
# =============================================================================

# INCORRECT patterns (trigger repair)
TFV_BAD_PATTERNS = [
    r"TFV.*?(?:stands for|means|is).*?Tournament\s+Favorite",
    r"TFV.*?grading\s+(?:scale|system)",
    r"TFV.*?(?:EXC|MINT|MOD|POOR|DAM)",  # Hallucinated grading scale
    r"TFV.*?(?:card\s+condition|card\s+quality)",
    r"Tournament\s+Favorite.*?Value",
]

# CORRECT patterns (no repair needed)
TFV_OK_PATTERNS = [
    r"TFV.*?(?:True|Total)\s+Fair\s+Value",
    r"True\s+Fair\s+Value.*?\(TFV\)",
    r"TFV.*?market.*?(?:price|value|estimate)",
    r"TFV.*?estimated.*?fair.*?(?:price|value)",
]

# Repair footer (visible to user)
TFV_CLARIFICATION_FOOTER = """

[TFV CLARIFICATION] TFV means **True Fair Value**, an estimated market-clearing price based on recent, normalized sales data. It is NOT a grading scale. Grading uses PSA/BGS/CGC ratings (e.g., PSA 10, BGS 9.5)."""

# Concise one-liner footer (for once-per-session mode)
TFV_CLARIFICATION_ONELINER = "\n\n💡 TFV = True Fair Value (price estimate), not a grading scale."

# =============================================================================
# SESSION TRACKING (Once-per-session footer)
# =============================================================================

class SessionTracker:
    """
    Tracks which sessions have already seen the TFV clarification footer.

    Improves UX by showing footer once per session instead of on every response.
    Sessions expire after 1 hour of inactivity.
    """
    def __init__(self, ttl_seconds: int = 3600):
        self._sessions = {}  # {session_id: last_footer_timestamp}
        self._ttl = ttl_seconds

    def has_seen_footer(self, session_id: Optional[str]) -> bool:
        """Check if session has already seen the footer"""
        if not session_id:
            return False  # No session ID = always show footer

        # Clean up expired sessions
        now = time.time()
        self._sessions = {
            sid: ts for sid, ts in self._sessions.items()
            if now - ts < self._ttl
        }

        return session_id in self._sessions

    def mark_footer_shown(self, session_id: Optional[str]):
        """Mark that this session has seen the footer"""
        if session_id:
            self._sessions[session_id] = time.time()

    def clear_session(self, session_id: str):
        """Clear a specific session (useful for logout)"""
        self._sessions.pop(session_id, None)

# Global session tracker (shared across all requests)
_session_tracker = SessionTracker()


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def tfv_is_consistent(text: str) -> bool:
    """
    Check if TFV terminology is used correctly in response.

    Args:
        text: Model response text

    Returns:
        True if TFV terminology is correct or not mentioned, False if incorrect
    """
    # If no TFV mention, consider it consistent (no issue)
    if not re.search(r"\bTFV\b", text, re.IGNORECASE):
        return True

    # If bad patterns found, it's inconsistent
    if any(re.search(pattern, text, re.IGNORECASE) for pattern in TFV_BAD_PATTERNS):
        return False

    # If TFV mentioned AND good pattern found, it's consistent
    if any(re.search(pattern, text, re.IGNORECASE) for pattern in TFV_OK_PATTERNS):
        return True

    # TFV mentioned but no clear good/bad pattern → assume inconsistent (conservative)
    return False


def repair_tfv_if_needed(text: str) -> Tuple[str, bool]:
    """
    Repair TFV terminology if inconsistent.

    Args:
        text: Model response text

    Returns:
        (repaired_text, was_repaired)
    """
    if tfv_is_consistent(text):
        return text, False

    # Append corrective footer
    repaired = text + TFV_CLARIFICATION_FOOTER
    return repaired, True


def sanitize_zero_prices(text: str) -> Tuple[str, bool]:
    """
    Detect and flag $0.00 prices as missing/placeholder data.

    Args:
        text: Model response text

    Returns:
        (sanitized_text, was_sanitized)
    """
    # Pattern: "$0.00" appears as actual price claim
    zero_price_pattern = r"(?:price|value|worth).*?\$0\.00"

    if not re.search(zero_price_pattern, text, re.IGNORECASE):
        return text, False

    # Replace "$0.00" statements with clarification
    sanitized = re.sub(
        r"\$0\.00",
        "$0.00 (missing data)",
        text
    )

    return sanitized, True


def apply_all_guardrails(
    text: str,
    session_id: Optional[str] = None,
    use_session_awareness: bool = True
) -> dict:
    """
    Apply all post-response guardrails with session-aware footer.

    Args:
        text: Model response text
        session_id: Optional session ID for once-per-session footer
        use_session_awareness: If True, show footer only once per session

    Returns:
        {
            "text": repaired text,
            "tfv_repaired": bool,
            "zero_price_sanitized": bool,
            "footer_shown": bool (was footer added this time?),
            "footer_type": "full" | "oneliner" | "none"
        }
    """
    # Step 1: Check if TFV terminology is correct
    is_consistent = tfv_is_consistent(text)

    # Step 2: Determine if we need to show footer
    tfv_repaired = False
    footer_shown = False
    footer_type = "none"

    if not is_consistent:
        # TFV is incorrect, need to repair
        tfv_repaired = True

        if use_session_awareness and session_id:
            # Session-aware mode: check if session has already seen footer
            if _session_tracker.has_seen_footer(session_id):
                # Session has seen full footer before, show concise one-liner
                text = text + TFV_CLARIFICATION_ONELINER
                footer_shown = True
                footer_type = "oneliner"
            else:
                # First time in session, show full footer
                text = text + TFV_CLARIFICATION_FOOTER
                footer_shown = True
                footer_type = "full"
                _session_tracker.mark_footer_shown(session_id)
        else:
            # No session tracking, always show full footer
            text = text + TFV_CLARIFICATION_FOOTER
            footer_shown = True
            footer_type = "full"

    # Step 3: Zero price sanitization
    text, zero_sanitized = sanitize_zero_prices(text)

    return {
        "text": text,
        "tfv_repaired": tfv_repaired,
        "zero_price_sanitized": zero_sanitized,
        "footer_shown": footer_shown,
        "footer_type": footer_type,
    }


# =============================================================================
# TEST FUNCTION
# =============================================================================

def test_tfv_validator():
    """Test TFV validator with known good/bad responses"""
    test_cases = [
        # BAD: Tournament Favorite
        {
            "input": "TFV stands for 'Tournament Favorite' which is a grading scale with EXC, MINT, MOD ratings.",
            "should_repair": True,
        },
        # GOOD: True Fair Value
        {
            "input": "TFV stands for True Fair Value, an estimated market price based on recent sales.",
            "should_repair": False,
        },
        # BAD: Grading scale association
        {
            "input": "TFV is a grading system used for card quality assessment.",
            "should_repair": True,
        },
        # GOOD: Market pricing context
        {
            "input": "TFV (True Fair Value) is $52, which is higher than the listed price of $45.",
            "should_repair": False,
        },
        # NO TFV: Should pass through
        {
            "input": "Charizard cards are expensive due to high demand and limited supply.",
            "should_repair": False,
        },
        # ZERO PRICE: Should sanitize
        {
            "input": "Based on database, this card's price is $0.00.",
            "should_sanitize_zero": True,
        },
    ]

    print("=" * 80)
    print("TFV VALIDATOR TEST")
    print("=" * 80)

    passed = 0
    failed = 0

    for i, case in enumerate(test_cases, 1):
        result = apply_all_guardrails(case["input"])

        expected_repair = case.get("should_repair", False)
        actual_repair = result["tfv_repaired"]

        expected_sanitize = case.get("should_sanitize_zero", False)
        actual_sanitize = result["zero_price_sanitized"]

        status = "✅ PASS" if (actual_repair == expected_repair and actual_sanitize == expected_sanitize) else "❌ FAIL"

        if status == "✅ PASS":
            passed += 1
        else:
            failed += 1

        print(f"\nTest {i}: {status}")
        print(f"Input: {case['input'][:80]}...")
        print(f"Expected repair: {expected_repair}, Actual: {actual_repair}")
        print(f"Expected sanitize: {expected_sanitize}, Actual: {actual_sanitize}")

        if result["tfv_repaired"] or result["zero_price_sanitized"]:
            print(f"Output: {result['text'][:100]}...")

    print("\n" + "=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 80)


if __name__ == "__main__":
    test_tfv_validator()
