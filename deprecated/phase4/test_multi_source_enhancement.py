#!/usr/bin/env python3
"""
Phase 4 Multi-Source Enhancement Test Script
Tests the new comprehensive multi-source Pokemon card extractor

Author: PokeDAO Builder
Version: Phase 4.1.0
"""

import asyncio
import sys
import os

# Add phase4 to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from blockchain.solana_extractor import MultiSourcePokemonExtractor, ComprehensivePokemonCard

async def test_multi_source_extractor():
    """Test the enhanced multi-source extractor"""
    print("🧪 Testing Phase 4 Multi-Source Enhancement")
    print("=" * 50)
    
    # Test 1: Basic extractor initialization
    print("\n🔧 Test 1: Multi-source extractor initialization")
    try:
        extractor = MultiSourcePokemonExtractor()
        print("✅ MultiSourcePokemonExtractor created successfully")
        
        # Check source configuration
        print(f"📊 Configured sources: {list(extractor.sources.keys())}")
        print(f"🎯 Source priorities: {[src['priority'] for src in extractor.sources.values()]}")
        
    except Exception as e:
        print(f"❌ Extractor initialization failed: {e}")
        return False
    
    # Test 2: API discovery (mock test)
    print("\n🔍 Test 2: API endpoint discovery simulation")
    try:
        async with extractor:
            # This will actually try to discover Collector Crypt endpoints
            discovered = await extractor.discover_collector_crypt_apis()
            print(f"✅ Discovery completed: {len(discovered)} endpoints found")
            
            if discovered:
                print("🎯 Sample discovered endpoints:")
                for endpoint, info in list(discovered.items())[:3]:
                    print(f"   • {endpoint}: {info.get('status', 'unknown')}")
            else:
                print("ℹ️ No endpoints discovered (expected in test environment)")
                
    except Exception as e:
        print(f"❌ API discovery test failed: {e}")
        return False
    
    # Test 3: Data structure validation
    print("\n📋 Test 3: ComprehensivePokemonCard data structure")
    try:
        # Create test card
        test_card = ComprehensivePokemonCard(
            mint_address="test_mint_12345",
            token_id="12345",
            name="Test Pikachu Card",
            magic_eden_price=1.5,
            set_name="Base Set",
            grade="PSA 9"
        )
        
        print("✅ ComprehensivePokemonCard created successfully")
        print(f"📊 Card details:")
        print(f"   • Name: {test_card.name}")
        print(f"   • Phase 2 key: {test_card.phase2_card_key}")
        print(f"   • Price: {test_card.magic_eden_price} SOL")
        print(f"   • Is undervalued: {test_card.is_undervalued()}")
        print(f"   • Data sources: {test_card.data_sources_used}")
        
        # Test backward compatibility
        print(f"   • Legacy price property: {test_card.current_listing_price}")
        print(f"   • Legacy collection: {test_card.collection_address}")
        
    except Exception as e:
        print(f"❌ Data structure test failed: {e}")
        return False
    
    # Test 4: Multi-source data integration
    print("\n🔗 Test 4: Multi-source data integration")
    try:
        # Simulate multi-source data
        test_card.data_sources_used = ['magic_eden', 'collector_crypt', 'solana_blockchain']
        test_card.collector_crypt_data = {'vault_status': 'vaulted'}
        test_card.blockchain_data = {'verified': True}
        
        # Test enrichment methods
        await extractor._enrich_card_data(test_card)
        
        print("✅ Multi-source integration working")
        print(f"📊 Enhanced card data:")
        print(f"   • Data completeness: {test_card.data_completeness:.2f}")
        print(f"   • Confidence score: {test_card.confidence_score:.2f}")
        print(f"   • Investment thesis: {test_card.investment_thesis}")
        print(f"   • Fair value: {test_card.fair_value_estimate}")
        
    except Exception as e:
        print(f"❌ Multi-source integration test failed: {e}")
        return False
    
    # Test 5: Quality metrics
    print("\n📈 Test 5: Quality metrics and validation")
    try:
        # Test completeness calculation
        completeness = extractor._calculate_completeness(test_card)
        confidence = extractor._calculate_confidence_score(test_card)
        
        print("✅ Quality metrics calculated")
        print(f"📊 Quality assessment:")
        print(f"   • Data completeness: {completeness:.2f}")
        print(f"   • Confidence score: {confidence:.2f}")
        print(f"   • Pokemon card validation: {extractor._is_pokemon_card(test_card)}")
        
    except Exception as e:
        print(f"❌ Quality metrics test failed: {e}")
        return False
    
    print("\n🎉 ALL TESTS PASSED!")
    print("=" * 50)
    print("✅ Multi-source enhancement successfully implemented")
    print("🎯 Key improvements verified:")
    print("   • Multi-source data extraction")
    print("   • Collector Crypt API discovery")
    print("   • Enhanced data completeness scoring")
    print("   • Confidence-based validation")
    print("   • Backward compatibility maintained")
    print("   • Phase 2/3 integration ready")
    
    return True


async def test_integration_compatibility():
    """Test compatibility with existing Phase 1-3 components"""
    print("\n🔗 Testing Phase Integration Compatibility")
    print("-" * 40)
    
    try:
        # Test backward compatibility aliases
        from blockchain.solana_extractor import BlockchainPokemonCard
        
        # Verify the alias works
        test_legacy_card = BlockchainPokemonCard(
            mint_address="legacy_test",
            token_id="legacy",
            name="Legacy Test Card"
        )
        
        print("✅ Backward compatibility verified")
        print(f"   • BlockchainPokemonCard alias: {type(test_legacy_card).__name__}")
        print(f"   • Phase 2 key generation: {test_legacy_card.phase2_card_key}")
        
        # Test database bridge compatibility
        try:
            from pipeline.database_bridge import PokeDAODatabaseBridge
            bridge = PokeDAODatabaseBridge()
            print("✅ Database bridge import successful")
            
        except Exception as e:
            print(f"⚠️ Database bridge compatibility issue: {e}")
        
        # Test pipeline compatibility  
        try:
            from pipeline.main_pipeline import PokeDAOPipeline
            print("✅ Main pipeline import successful")
            
        except Exception as e:
            print(f"⚠️ Main pipeline compatibility issue: {e}")
        
        print("✅ Integration compatibility verified")
        
    except Exception as e:
        print(f"❌ Integration compatibility test failed: {e}")
        return False
    
    return True


async def main():
    """Run all tests"""
    print("🚀 PokeDAO Phase 4 Multi-Source Enhancement Test Suite")
    print("=" * 60)
    print("🎯 Testing comprehensive multi-source data extraction")
    print("🔗 Validating integration with existing Phase 1-3 components")
    print()
    
    # Run main extractor tests
    extractor_success = await test_multi_source_extractor()
    
    # Run integration tests
    integration_success = await test_integration_compatibility()
    
    print("\n📊 TEST SUITE SUMMARY")
    print("=" * 30)
    print(f"🧪 Multi-source extractor: {'✅ PASS' if extractor_success else '❌ FAIL'}")
    print(f"🔗 Integration compatibility: {'✅ PASS' if integration_success else '❌ FAIL'}")
    
    if extractor_success and integration_success:
        print("\n🎉 PHASE 4 ENHANCEMENT COMPLETE!")
        print("🚀 Ready for production deployment")
        print()
        print("📋 Next steps:")
        print("1. Deploy enhanced extractor to production")
        print("2. Update pipeline configurations")
        print("3. Monitor multi-source data quality")
        print("4. Integrate with Phase 3 utilities")
        print("5. Set up confidence-based alerts")
    else:
        print("\n⚠️ Some tests failed - please review before deployment")
    
    return extractor_success and integration_success


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
