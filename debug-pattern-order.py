#!/usr/bin/env python3
"""
Debug which pattern is being tried first for Pokemon dash titles
"""

import sys
import os
import re
from pathlib import Path

# Add the ml directory to path
sys.path.append(str(Path(__file__).parent / 'ml'))

try:
    from normalize import CardNormalizer
    import orjson
    
    def debug_pattern_order():
        print("🔍 DEBUGGING PATTERN ORDER FOR POKEMON DASH TITLES")
        print("=" * 60)
        
        # Test title
        test_title = "Pokemon - Pikachu - 58/102 - Base Set - Common"
        print(f"Testing: {test_title}\n")
        
        # Load patterns
        patterns_file = Path(__file__).parent / 'ml' / 'data' / 'patterns.json'
        with open(patterns_file, 'rb') as f:
            patterns_data = orjson.loads(f.read())
        
        normalizer = CardNormalizer()
        
        print("🔄 Testing each pattern in order:\n")
        
        for i, pattern_config in enumerate(patterns_data['title_patterns'], 1):
            pattern_name = pattern_config['name']
            pattern_regex = pattern_config['pattern']
            pattern_confidence = pattern_config['confidence']
            
            print(f"{i:2d}. {pattern_name} (confidence: {pattern_confidence})")
            
            # Test regex match
            match = re.search(pattern_regex, test_title, re.IGNORECASE)
            if match:
                print(f"    ✅ REGEX MATCHES")
                groups = match.groupdict()
                for key, value in groups.items():
                    if value:
                        print(f"       {key}: '{value}'")
                
                # Test with normalizer
                try:
                    result = normalizer._try_pattern(test_title, pattern_config)
                    if result:
                        print(f"    ✅ NORMALIZER SUCCESS: {result.card_key} (confidence: {result.confidence})")
                        print(f"    🎯 THIS PATTERN WOULD BE USED!")
                        break  # This is what would happen in the real method
                    else:
                        print(f"    ❌ NORMALIZER RETURNED None")
                except Exception as e:
                    print(f"    ❌ NORMALIZER FAILED: {e}")
            else:
                print(f"    ❌ No regex match")
            print()
        
    if __name__ == "__main__":
        debug_pattern_order()
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    import traceback
    traceback.print_exc()
