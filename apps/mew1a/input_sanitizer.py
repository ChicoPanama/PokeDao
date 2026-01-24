"""
Input sanitization for Mew-1A prompts

Prevents prompt injection attacks by sanitizing user-provided input
before it's interpolated into LLM prompts.
"""

import re
from typing import Any, Union

# Patterns that could be used for prompt injection
DANGEROUS_PATTERNS = [
    r'###',              # Instruction markers
    r'\bInstruction\b',  # Instruction keyword
    r'\bResponse\b',     # Response keyword
    r'\bSystem\b',       # System keyword
    r'<\|.*?\|>',        # Special tokens like <|endoftext|>
    r'\n{2,}',           # Multiple newlines (section breaks)
    r'\[INST\]',         # Llama instruction markers
    r'\[/INST\]',
    r'<<SYS>>',          # Llama system markers
    r'<</SYS>>',
]

# Compile patterns for efficiency
COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in DANGEROUS_PATTERNS]

# Length limits
MAX_CARD_NAME_LENGTH = 200
MAX_SET_NAME_LENGTH = 100
MAX_SENTIMENT_LENGTH = 500

# Price limits
MIN_PRICE = 0.0
MAX_PRICE = 10_000_000.0  # $10M max

# Token limits
MIN_TOKENS = 50
MAX_TOKENS = 500
DEFAULT_TOKENS = 200


def sanitize_text(text: str, max_length: int) -> str:
    """
    Generic text sanitization.

    - Truncates to max length
    - Removes dangerous patterns
    - Removes control characters
    - Strips whitespace
    """
    if not text or not isinstance(text, str):
        return ""

    # Truncate to max length
    text = text[:max_length]

    # Remove dangerous patterns
    for pattern in COMPILED_PATTERNS:
        text = pattern.sub('', text)

    # Remove control characters (keep printable and space)
    text = ''.join(c for c in text if c.isprintable() or c == ' ')

    # Normalize whitespace
    text = ' '.join(text.split())

    return text.strip()


def sanitize_card_name(name: Any) -> str:
    """
    Sanitize card name for safe prompt inclusion.

    Args:
        name: Card name (should be string, handles other types gracefully)

    Returns:
        Sanitized card name string
    """
    if name is None:
        return ""
    return sanitize_text(str(name), MAX_CARD_NAME_LENGTH)


def sanitize_set_name(name: Any) -> str:
    """
    Sanitize set name for safe prompt inclusion.

    Args:
        name: Set name (should be string, handles other types gracefully)

    Returns:
        Sanitized set name string
    """
    if name is None:
        return ""
    return sanitize_text(str(name), MAX_SET_NAME_LENGTH)


def sanitize_sentiment(sentiment: Any) -> str:
    """
    Sanitize Reddit sentiment text for safe prompt inclusion.

    Args:
        sentiment: Sentiment text (should be string)

    Returns:
        Sanitized sentiment string
    """
    if sentiment is None:
        return ""
    return sanitize_text(str(sentiment), MAX_SENTIMENT_LENGTH)


def validate_price(value: Any) -> float:
    """
    Safely convert and validate price values.

    Args:
        value: Price value (any type)

    Returns:
        Valid float price, or 0.0 if invalid
    """
    try:
        price = float(value)
        # Check for NaN and infinity
        if price != price or price == float('inf') or price == float('-inf'):
            return 0.0
        # Clamp to valid range
        if price < MIN_PRICE or price > MAX_PRICE:
            return 0.0
        return price
    except (ValueError, TypeError):
        return 0.0


def validate_max_tokens(value: Any, default: int = DEFAULT_TOKENS) -> int:
    """
    Validate max_tokens to prevent resource abuse.

    Args:
        value: Token limit value (any type)
        default: Default value if invalid

    Returns:
        Valid token limit clamped to MIN_TOKENS-MAX_TOKENS range
    """
    try:
        tokens = int(value)
        return max(MIN_TOKENS, min(tokens, MAX_TOKENS))
    except (ValueError, TypeError):
        return default


def validate_top_k(value: Any, default: int = 5, max_k: int = 20) -> int:
    """
    Validate top_k parameter for RAG queries.

    Args:
        value: top_k value (any type)
        default: Default value if invalid
        max_k: Maximum allowed value

    Returns:
        Valid top_k clamped to 1-max_k range
    """
    try:
        k = int(value)
        return max(1, min(k, max_k))
    except (ValueError, TypeError):
        return default


def validate_boolean(value: Any, default: bool = True) -> bool:
    """
    Safely convert value to boolean.

    Args:
        value: Value to convert
        default: Default if conversion fails

    Returns:
        Boolean value
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on')
    try:
        return bool(value)
    except (ValueError, TypeError):
        return default
