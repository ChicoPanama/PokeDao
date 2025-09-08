#!/usr/bin/env python3
"""
Direct test of the Pokemon dash pattern in the normalization engine
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
    
    def test_pattern_directly():
        print("🔍 DIRECT PATTERN TESTING")
        print("=" * 40)
        
        # Load the patterns directly
        patterns_file = Path(__file__).parent / 'ml' / 'data' / 'patterns.json'
        with open(patterns_file, 'rb') as f:
            patterns_data = orjson.loads(f.read())
        
        # Find our Pokemon dash pattern
        pokemon_pattern = None
        for pattern in patterns_data['title_patterns']:
            if pattern['name'] == 'pokemon_dash_format_exact':
                pokemon_pattern = pattern
                break
        
        if not pokemon_pattern:
            print("❌ Pokemon dash pattern not found!")
            return
            
        print(f"✅ Found pattern: {pokemon_pattern['name']}")
        print(f"   Confidence: {pokemon_pattern['confidence']}")
        print(f"   Regex: {pokemon_pattern['pattern']}")
        
        # Test the pattern directly
        test_title = "Pokemon - Pikachu - 58/102 - Base Set - Common"
        print(f"\n🧪 Testing: {test_title}")
        
        pattern = pokemon_pattern['pattern']
        match = re.search(pattern, test_title, re.IGNORECASE)
        
        if match:
            print("✅ Pattern matches!")
            groups = match.groupdict()
            for key, value in groups.items():
                if value:
                    print(f"   {key}: '{value}'")
                    
            # Now test with the normalizer's _try_pattern method
            print("\n🔧 Testing with normalizer...")
            normalizer = CardNormalizer()
            
            try:
                # Call the internal method directly
                result = normalizer._try_pattern(test_title, pokemon_pattern)
                if result:
                    print(f"✅ _try_pattern succeeded!")
                    print(f"   Card key: {result.card_key}")
                    print(f"   Confidence: {result.confidence}")
                    print(f"   Pokemon: {result.name}")
                    print(f"   Set: {result.set_code}")
                    print(f"   Number: {result.number}")
                    print(f"   Variant: {result.variant}")
                else:
                    print("❌ _try_pattern returned None")
            except Exception as e:
                print(f"❌ _try_pattern failed: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("❌ Pattern does not match!")
            
    if __name__ == "__main__":
        test_pattern_directly()
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    import traceback
    traceback.print_exc()
