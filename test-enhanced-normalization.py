#!/usr/bin/env python3
"""
Test enhanced normalization patterns with previously failed titles
"""

import sys
import os
from pathlib import Path

# Add the ml directory to path
sys.path.append(str(Path(__file__).parent / 'ml'))

try:
    from normalize import CardNormalizer
    
    def test_enhanced_patterns():
        print("🧪 TESTING ENHANCED NORMALIZATION PATTERNS")
        print("=" * 50)
        
        # The titles that previously failed
        failed_titles = [
            "Charizard (4/102) [Base Set] Holo Rare",
            "Pokemon - Pikachu - 58/102 - Base Set - Common", 
            "Dark Charizard Holo #4 Team Rocket PSA 10",
            "Lugia Neo Genesis 9/111 Holo First Edition"  # This one worked before
        ]
        
        # Additional test cases to ensure broad compatibility
        additional_titles = [
            "Blastoise (2/102) [Base Set] Holo Rare",
            "Pokemon - Venusaur - 15/102 - Base Set - Holo Rare",
            "Dark Blastoise Holo #3 Team Rocket BGS 9.5",
            "Scyther Jungle 10/64 Holo First Edition",
            "Alakazam (1/102) [Base Set] Holo Rare PSA 10",
            "Pokemon - Mewtwo - 10/102 - Base Set - Holo Rare"
        ]
        
        all_titles = failed_titles + additional_titles
        
        normalizer = CardNormalizer()
        
        successful = 0
        failed = 0
        results = []
        
        print(f"\n🔄 Testing {len(all_titles)} titles...\n")
        
        for i, title in enumerate(all_titles, 1):
            print(f"{i:2d}. {title}")
            
            try:
                result = normalizer.normalize_card_title(title)
                successful += 1
                
                results.append({
                    'title': title,
                    'success': True,
                    'card_key': result.card_key,
                    'pokemon': result.name,
                    'set': result.set_code,
                    'number': result.number,
                    'variant': result.variant,
                    'grade': result.grade,
                    'confidence': result.confidence
                })
                
                print(f"     ✅ SUCCESS:")
                print(f"        Card Key: {result.card_key}")
                print(f"        Pokemon: {result.name}")
                print(f"        Set: {result.set_code}")
                print(f"        Number: #{result.number}")
                print(f"        Variant: {result.variant or 'base'}")
                print(f"        Grade: {result.grade or 'raw'}")
                print(f"        Confidence: {result.confidence:.2f}")
                
            except Exception as e:
                failed += 1
                results.append({
                    'title': title,
                    'success': False,
                    'error': str(e)
                })
                print(f"     ❌ FAILED: {e}")
            
            print()  # Blank line
        
        # Results summary
        success_rate = (successful / len(all_titles)) * 100
        previous_failed_success = sum(1 for r in results[:4] if r['success'])
        
        print("=" * 50)
        print("📊 ENHANCED NORMALIZATION RESULTS:")
        print(f"   Total titles tested: {len(all_titles)}")
        print(f"   Successfully normalized: {successful}")
        print(f"   Failed normalizations: {failed}")
        print(f"   Overall success rate: {success_rate:.1f}%")
        print(f"   Previously failed titles fixed: {previous_failed_success}/4")
        
        # Improvement assessment
        print("\n🎯 IMPROVEMENT ASSESSMENT:")
        
        if success_rate >= 90:
            print("   🎉 EXCELLENT! Dramatic improvement achieved")
            print("   ✅ Ready for API integration")
            
        elif success_rate >= 75:
            print("   ✅ VERY GOOD! Significant improvement")
            print("   🚀 Ready for Phase 2 API installation")
            
        elif success_rate >= 50:
            print("   ⚠️ MODERATE improvement - needs more patterns")
            print("   🔧 Consider additional pattern enhancements")
            
        else:
            print("   ❌ POOR improvement - major pattern issues")
            print("   🔬 Deep analysis needed")
        
        # Specific improvements for failed titles
        if previous_failed_success == 4:
            print(f"\n🎉 ALL PREVIOUSLY FAILED TITLES NOW WORKING!")
            print(f"   ✅ 'Charizard (4/102) [Base Set] Holo Rare'")
            print(f"   ✅ 'Pokemon - Pikachu - 58/102 - Base Set - Common'")
            print(f"   ✅ 'Dark Charizard Holo #4 Team Rocket PSA 10'")
            print(f"   ✅ 'Lugia Neo Genesis 9/111 Holo First Edition'")
            
        elif previous_failed_success >= 2:
            print(f"\n✅ GOOD: {previous_failed_success}/4 previously failed titles fixed")
            
        else:
            print(f"\n⚠️ LIMITED: Only {previous_failed_success}/4 previously failed titles fixed")
        
        print(f"\n🚀 NEXT STEPS:")
        if success_rate >= 75:
            print(f"   1. ✅ Patterns enhanced successfully")
            print(f"   2. 📦 Proceed with Pokemon TCG API installation")
            print(f"   3. 🔗 Integrate enhanced normalization with API data")
            print(f"   4. 🎯 Add to Phase 4 multi-source pipeline")
        else:
            print(f"   1. 🔧 Add more specific patterns for failed cases")
            print(f"   2. 🧪 Test with broader title dataset")
            print(f"   3. 📈 Target 80%+ success rate before API integration")
        
        return results
        
    if __name__ == "__main__":
        test_enhanced_patterns()
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("Make sure the normalization engine is properly installed")
except Exception as e:
    print(f"❌ Unexpected Error: {e}")
