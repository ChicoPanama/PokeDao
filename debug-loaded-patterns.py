#!/usr/bin/env python3
"""
Debug what patterns are actually loaded by the engine
"""

import sys
import os
from pathlib import Path

# Add the ml directory to path
sys.path.append(str(Path(__file__).parent / 'ml'))

try:
    from normalize import CardNormalizer
    
    def debug_loaded_patterns():
        print("🔍 DEBUGGING LOADED PATTERNS")
        print("=" * 40)
        
        normalizer = CardNormalizer()
        
        print(f"Data directory: {normalizer.data_dir}")
        print(f"Patterns loaded: {len(normalizer.patterns_data.get('title_patterns', []))}")
        
        print("\n📋 First 5 patterns loaded:")
        for i, pattern in enumerate(normalizer.patterns_data.get('title_patterns', [])[:5], 1):
            print(f"{i}. {pattern['name']} (confidence: {pattern['confidence']})")
            
        # Look specifically for our Pokemon pattern
        pokemon_patterns = [p for p in normalizer.patterns_data.get('title_patterns', []) 
                           if 'pokemon_dash' in p['name']]
        
        print(f"\n🎯 Pokemon dash patterns found: {len(pokemon_patterns)}")
        for pattern in pokemon_patterns:
            print(f"   - {pattern['name']} (confidence: {pattern['confidence']})")
            
        # Test the specific pattern lookup
        test_title = "Pokemon - Pikachu - 58/102 - Base Set - Common"
        print(f"\n🧪 Testing pattern matching for: {test_title}")
        
        for pattern in normalizer.patterns_data.get('title_patterns', [])[:10]:  # First 10 patterns
            try:
                result = normalizer._try_pattern(test_title, pattern)
                if result:
                    print(f"✅ {pattern['name']}: SUCCESS (confidence: {result.confidence})")
                    break
                else:
                    print(f"❌ {pattern['name']}: No match")
            except Exception as e:
                print(f"💥 {pattern['name']}: Error - {e}")
            
    if __name__ == "__main__":
        debug_loaded_patterns()
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    import traceback
    traceback.print_exc()
