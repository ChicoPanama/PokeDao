#!/usr/bin/env python3
"""
Fresh test with new engine instance
"""

import sys
import os
from pathlib import Path

# Add the ml directory to path
sys.path.append(str(Path(__file__).parent / 'ml'))

# Force reload of the module
if 'normalize' in sys.modules:
    del sys.modules['normalize']

try:
    from normalize import CardNormalizer
    
    def fresh_test():
        print("🔄 FRESH NORMALIZATION ENGINE TEST")
        print("=" * 45)
        
        # Create a completely new instance
        normalizer = CardNormalizer()
        
        failing_titles = [
            "Pokemon - Pikachu - 58/102 - Base Set - Common",
            "Pokemon - Venusaur - 15/102 - Base Set - Holo Rare", 
            "Pokemon - Mewtwo - 10/102 - Base Set - Holo Rare"
        ]
        
        print(f"Testing {len(failing_titles)} Pokemon dash format titles:\n")
        
        for i, title in enumerate(failing_titles, 1):
            print(f"{i}. {title}")
            try:
                result = normalizer.normalize_card_title(title)
                print(f"   ✅ SUCCESS: {result.card_key} (confidence: {result.confidence:.2f})")
                print(f"      Pokemon: {result.name}")
                print(f"      Set: {result.set_code}")
                print(f"      Number: #{result.number}")
                print(f"      Variant: {result.variant}")
                print(f"      Grade: {result.grade}")
            except Exception as e:
                print(f"   ❌ FAILED: {e}")
            print()
            
    if __name__ == "__main__":
        fresh_test()
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
    import traceback
    traceback.print_exc()
