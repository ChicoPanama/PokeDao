"""
PokeDAO Card Title Normalization Engine
Phase 2: Convert raw marketplace titles to structured card data

This module provides robust parsing of Pokemon card titles from various
marketplace sources into standardized, canonical card identifiers.
"""

import re
import orjson
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from fuzzywuzzy import fuzz, process
import regex
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NormalizationError(Exception):
    """Raised when a title cannot be parsed with sufficient confidence."""
    pass


@dataclass
class ParsedCard:
    """Structured representation of a parsed Pokemon card."""
    name: str
    set_code: str
    number: str
    variant: Optional[str] = None
    grade: Optional[str] = None
    card_key: Optional[str] = None
    confidence: float = 0.0
    raw_title: Optional[str] = None
    
    def __post_init__(self):
        """Generate card_key after initialization."""
        if not self.card_key:
            self.card_key = self.generate_card_key()
    
    def generate_card_key(self) -> str:
        """Generate stable card key for grouping and aggregation."""
        # Normalize components
        set_part = self.set_code.lower().replace(' ', '').replace('-', '')
        number_part = self.number.zfill(3)  # Pad to 3 digits
        variant_part = (self.variant or 'base').lower().replace(' ', '')
        grade_part = (self.grade or 'raw').lower().replace(' ', '').replace('.', '')
        
        return f"{set_part}-{number_part}-{variant_part}-{grade_part}"
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


class CardNormalizer:
    """Main normalization engine for Pokemon card titles."""
    
    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize normalizer with pattern and set data."""
        self.data_dir = data_dir or Path(__file__).parent / 'data'
        self.sets_data = self._load_sets_data()
        self.patterns_data = self._load_patterns_data()
        self.set_index = self._build_set_index()
        
    def _load_sets_data(self) -> Dict:
        """Load Pokemon set mappings and metadata."""
        sets_file = self.data_dir / 'sets.json'
        try:
            with open(sets_file, 'rb') as f:
                return orjson.loads(f.read())
        except FileNotFoundError:
            logger.warning(f"Sets data not found at {sets_file}")
            return {}
    
    def _load_patterns_data(self) -> Dict:
        """Load regex patterns for parsing."""
        patterns_file = self.data_dir / 'patterns.json'
        try:
            with open(patterns_file, 'rb') as f:
                return orjson.loads(f.read())
        except FileNotFoundError:
            logger.warning(f"Patterns data not found at {patterns_file}")
            return {"title_patterns": [], "grade_patterns": [], "variant_patterns": []}
    
    def _build_set_index(self) -> Dict[str, str]:
        """Build fuzzy matching index for set names."""
        index = {}
        for set_key, set_info in self.sets_data.items():
            # Add primary set name
            index[set_info['code']] = set_info['code']
            # Add all aliases
            for alias in set_info.get('aliases', []):
                index[alias.lower()] = set_info['code']
        return index
    
    def normalize_card_title(self, title: str) -> ParsedCard:
        """
        Main normalization function.
        
        Args:
            title: Raw marketplace title
            
        Returns:
            ParsedCard with structured data
            
        Raises:
            NormalizationError: If parsing fails with sufficient confidence
        """
        if not title or not title.strip():
            raise NormalizationError("Empty or null title")
        
        original_title = title
        logger.debug(f"Parsing title: {title}")
        
        # Step 1: Pre-process title
        cleaned_title = self._clean_title(title)
        logger.debug(f"Cleaned title: {cleaned_title}")
        
        # Step 2: Try multiple parsing patterns
        best_match = None
        best_confidence = 0.0
        
        for pattern_config in self.patterns_data.get('title_patterns', []):
            try:
                match = self._try_pattern(cleaned_title, pattern_config)
                if match and match.confidence > best_confidence:
                    best_match = match
                    best_confidence = match.confidence
                    logger.debug(f"Pattern '{pattern_config['name']}' scored {match.confidence}")
            except Exception as e:
                logger.debug(f"Pattern '{pattern_config['name']}' failed: {e}")
                continue
        
        if not best_match or best_confidence < 0.5:
            raise NormalizationError(f"Could not parse title with sufficient confidence: {title}")
        
        # Step 3: Post-process and validate
        best_match.raw_title = original_title
        self._validate_parsed_card(best_match)
        
        logger.info(f"Successfully parsed: {original_title} -> {best_match.card_key}")
        return best_match
    
    def _clean_title(self, title: str) -> str:
        """Apply cleaning patterns to normalize input."""
        cleaned = title.lower().strip()
        
        # Apply cleaning patterns
        for pattern_config in self.patterns_data.get('cleaning_patterns', []):
            pattern = pattern_config['pattern']
            replacement = pattern_config['replacement']
            cleaned = regex.sub(pattern, replacement, cleaned, flags=regex.IGNORECASE)
        
        return cleaned.strip()
    
    def _try_pattern(self, title: str, pattern_config: Dict) -> Optional[ParsedCard]:
        """Try to parse title with specific pattern."""
        pattern = pattern_config['pattern']
        base_confidence = pattern_config.get('confidence', 0.5)
        
        match = regex.search(pattern, title, regex.IGNORECASE)
        if not match:
            logger.debug(f"Pattern '{pattern_config['name']}' no match for: {title}")
            return None
        
        groups = match.groupdict()
        logger.debug(f"Pattern '{pattern_config['name']}' matched groups: {groups}")
        
        # Extract core components
        name = self._normalize_name(groups.get('name', '').strip())
        if not name:
            logger.debug(f"Pattern '{pattern_config['name']}' - no valid name extracted")
            return None
        
        # Resolve set code
        raw_set = groups.get('set', '').strip()
        set_code = self._resolve_set_code(raw_set)
        if not set_code:
            logger.debug(f"Pattern '{pattern_config['name']}' - could not resolve set: {raw_set}")
            return None
        
        # Extract and validate number
        number = groups.get('number', '').strip()
        if not number or not number.isdigit():
            logger.debug(f"Pattern '{pattern_config['name']}' - invalid number: {number}")
            return None
        
        # Pad number to 3 digits for consistency
        number = number.zfill(3)
        
        # Parse variant
        variant = self._normalize_variant(groups.get('variant', ''))
        
        # Parse grade - check for condition field first, then fall back to full title
        condition = groups.get('condition', '')
        if condition:
            grade = 'raw'  # Condition fields indicate raw/ungraded cards
        else:
            grade = self._normalize_grade(title)  # Use full title for grade context
        
        # Calculate confidence score
        confidence = self._calculate_confidence(base_confidence, groups, title)
        
        logger.debug(f"Pattern '{pattern_config['name']}' - successful parse with confidence {confidence}")
        
        return ParsedCard(
            name=name,
            set_code=set_code,
            number=number,
            variant=variant,
            grade=grade,
            confidence=confidence
        )
    
    def _normalize_name(self, name: str) -> str:
        """Normalize Pokemon name."""
        if not name:
            return ""
        
        # Remove common suffixes/prefixes
        name = regex.sub(r'\\b(pokemon|card)\\b', '', name, flags=regex.IGNORECASE).strip()
        
        # Handle special characters
        name = name.replace('δ', ' Delta')  # Delta species
        
        # Title case
        return ' '.join(word.capitalize() for word in name.split())
    
    def _resolve_set_code(self, raw_set: str) -> Optional[str]:
        """Resolve set name to standardized code using fuzzy matching."""
        if not raw_set:
            return None
        
        raw_set = raw_set.lower().strip()
        
        # Exact match first
        if raw_set in self.set_index:
            return self.set_index[raw_set]
        
        # Fuzzy matching
        set_names = list(self.set_index.keys())
        match = process.extractOne(raw_set, set_names, scorer=fuzz.token_sort_ratio)
        
        if match and match[1] >= 80:  # 80% similarity threshold
            return self.set_index[match[0]]
        
        logger.debug(f"No good match for set: {raw_set}")
        return None
    
    def _normalize_variant(self, raw_variant: str) -> Optional[str]:
        """Normalize card variant using pattern matching."""
        if not raw_variant:
            return None
        
        raw_variant = raw_variant.lower().strip()
        
        for variant_config in self.patterns_data.get('variant_patterns', []):
            pattern = variant_config['pattern']
            if regex.search(pattern, raw_variant, regex.IGNORECASE):
                return variant_config['normalized']
        
        return raw_variant if raw_variant else None
    
    def _normalize_grade(self, title: str) -> Optional[str]:
        """Extract and normalize grading information."""
        for grade_config in self.patterns_data.get('grade_patterns', []):
            pattern = grade_config['pattern']
            match = regex.search(pattern, title, regex.IGNORECASE)
            if match:
                if grade_config['company'] == 'raw':
                    return 'raw'
                else:
                    score = match.group(1) if match.groups() else ''
                    return grade_config['format'].format(score=score)
        
        return 'raw'  # Default to raw if no grade found
    
    def _calculate_confidence(self, base_confidence: float, groups: Dict, title: str) -> float:
        """Calculate parsing confidence score."""
        confidence = base_confidence
        
        # Boost confidence for complete matches
        if groups.get('name') and groups.get('set') and groups.get('number'):
            confidence += 0.1
        
        # Boost for recognized grade
        if groups.get('grade') or 'psa' in title.lower() or 'bgs' in title.lower():
            confidence += 0.05
        
        # Boost for recognized variant
        if groups.get('variant'):
            confidence += 0.05
        
        # Penalty for very short names
        name = groups.get('name', '')
        if len(name) < 3:
            confidence -= 0.2
        
        return min(confidence, 1.0)
    
    def _validate_parsed_card(self, card: ParsedCard) -> None:
        """Validate parsed card data."""
        if not card.name or len(card.name) < 2:
            raise NormalizationError(f"Invalid card name: {card.name}")
        
        if not card.set_code:
            raise NormalizationError("Missing set code")
        
        if not card.number or not card.number.isdigit():
            raise NormalizationError(f"Invalid card number: {card.number}")
        
        # Validate number is reasonable (1-999)
        num = int(card.number)
        if num < 1 or num > 999:
            raise NormalizationError(f"Card number out of range: {num}")


# Convenience functions
def normalize_card_title(title: str) -> Dict:
    """
    Convenience function for single title normalization.
    
    Returns dictionary representation of ParsedCard.
    """
    normalizer = CardNormalizer()
    result = normalizer.normalize_card_title(title)
    return result.to_dict()


def batch_normalize(titles: List[str]) -> List[Dict]:
    """
    Normalize multiple titles efficiently.
    
    Returns list of results, with None for failed parses.
    """
    normalizer = CardNormalizer()
    results = []
    
    for title in titles:
        try:
            result = normalizer.normalize_card_title(title)
            results.append(result.to_dict())
        except NormalizationError as e:
            logger.warning(f"Failed to parse '{title}': {e}")
            results.append(None)
    
    return results


# CLI interface for testing
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--test":
            # Run with test titles
            test_titles = [
                "Charizard Base Set #4 PSA 10",
                "Pokemon Charizard 1998 Base Set Unlimited #004 BGS 9.5",
                "Charizard (4/102) - Base Set - Holo Rare - PSA 9",
                "Pikachu Jungle #60 PSA 8",
                "Blastoise Base Set Holo #2 BGS 9",
                "Team Rocket's Mewtwo Team Rocket #14 PSA 10"
            ]
            
            normalizer = CardNormalizer()
            print("\\n🧪 Testing normalization engine...")
            
            for title in test_titles:
                try:
                    result = normalizer.normalize_card_title(title)
                    print(f"✅ {title}")
                    print(f"   -> {result.card_key} (confidence: {result.confidence:.2f})")
                except NormalizationError as e:
                    print(f"❌ {title}")
                    print(f"   -> {e}")
                print()
        else:
            # Parse single title from command line
            title = sys.argv[1]
            try:
                result = normalize_card_title(title)
                print(orjson.dumps(result, option=orjson.OPT_INDENT_2).decode())
            except NormalizationError as e:
                print(f"Error: {e}")
                sys.exit(1)
    else:
        print("Usage: python normalize.py \"Title to parse\" or python normalize.py --test")
