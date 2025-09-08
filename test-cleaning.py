#!/usr/bin/env python3
"""
Test with cleaned title to match the main method
"""

import sys
import os
from pathlib import Path

# Add the ml directory to path
sys.path.append(str(Path(__file__).parent / 'ml'))

try:
    from normalize import CardNormalizer
    
    def test_with_cleaning():
        print("🧽 TESTING WITH TITLE CLEANING")
        print("=" * 40)
        
        normalizer = CardNormalizer()
        
        test_title = "Pokemon - Pikachu - 58/102 - Base Set - Common"
        cleaned_title = normalizer._clean_title(test_title)
        
        print(f"Original: {test_title}")
        print(f"Cleaned:  {cleaned_title}")
        print()
        
        # Test the pokemon pattern with cleaned title
        pokemon_pattern = None
        for pattern in normalizer.patterns_data.get('title_patterns', []):
            if pattern['name'] == 'pokemon_dash_format_exact':
                pokemon_pattern = pattern
                break
                
        if pokemon_pattern:
            print("🧪 Testing with cleaned title:")
            try:
                result = normalizer._try_pattern(cleaned_title, pokemon_pattern)
                if result:
                    print(f"✅ SUCCESS: {result.card_key} (confidence: {result.confidence})")
                else:
                    print("❌ Pattern returned None")
            except Exception as e:
                print(f"❌ Pattern failed: {e}")
                
        print("\n🔄 Full normalization test:")
        try:
            result = normalizer.normalize_card_title(test_title)
            print(f"✅ SUCCESS: {result.card_key}")
        except Exception as e:
            print(f"❌ FAILED: {e}")
            
    if __name__ == "__main__":
        test_with_cleaning()
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    import traceback
    traceback.print_exc()
