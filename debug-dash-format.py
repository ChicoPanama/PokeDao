#!/usr/bin/env python3
"""
Debug specific failing Pokemon dash format titles
"""

import sys
import os
import re
from pathlib import Path

# Add the ml directory to path
sys.path.append(str(Path(__file__).parent / 'ml'))

try:
    from normalize import CardNormalizer
    
    def debug_dash_format():
        print("🔍 DEBUGGING POKEMON DASH FORMAT TITLES")
        print("=" * 50)
        
        # The specific failing titles
        failing_titles = [
            "Pokemon - Pikachu - 58/102 - Base Set - Common",
            "Pokemon - Venusaur - 15/102 - Base Set - Holo Rare",
            "Pokemon - Mewtwo - 10/102 - Base Set - Holo Rare"
        ]
        
        # Test the regex patterns directly
        patterns = [
            r"Pokemon\s*-\s*(?P<name>[\w\s\-'é.δ]+?)\s*-\s*(?P<number>\d{1,3})/(?P<total>\d{1,3})\s*-\s*(?P<set>[^-]+?)\s*-\s*(?P<variant>.*?)$",
            r"Pokemon\s*-\s*(?P<name>[\w\s\-'é.δ]+?)\s*-\s*(?P<number>\d{1,3})/(?P<total>\d{1,3})\s*-\s*(?P<set>[^-]+?)\s*-\s*(?P<variant>holo\s*rare|common|uncommon|rare|holo|holographic)(?:\s+(?P<grade>PSA\s*\d+(?:\.5)?|BGS\s*\d+(?:\.5)?|CGC\s*\d+(?:\.5)?))?",
            r"Pokemon\s*-\s*(?P<name>[\w\s\-'é.δ]+?)\s*-\s*(?P<number>\d{1,3})/(?P<total>\d{1,3})\s*-\s*(?P<set>[^-]+?)\s*-\s*(?P<variant>.*)",
        ]
        
        print("🧪 Testing regex patterns directly:\n")
        
        for title in failing_titles:
            print(f"Title: {title}")
            
            for i, pattern in enumerate(patterns, 1):
                match = re.search(pattern, title, re.IGNORECASE)
                if match:
                    print(f"  ✅ Pattern {i} MATCHES:")
                    for key, value in match.groupdict().items():
                        if value:
                            print(f"     {key}: '{value}'")
                else:
                    print(f"  ❌ Pattern {i} NO MATCH")
            
            print()
        
        print("\n🔧 Testing with normalization engine:\n")
        
        normalizer = CardNormalizer()
        
        for title in failing_titles:
            print(f"Title: {title}")
            try:
                result = normalizer.normalize_card_title(title)
                print(f"  ✅ SUCCESS: {result.card_key} (confidence: {result.confidence:.2f})")
            except Exception as e:
                print(f"  ❌ FAILED: {e}")
            print()
            
    if __name__ == "__main__":
        debug_dash_format()
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
