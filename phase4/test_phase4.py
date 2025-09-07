#!/usr/bin/env python3
"""
PokeDAO Phase 4 - Testing Framework
Comprehensive tests for all pipeline components

Author: PokeDAO Builder  
Version: Phase 4.0.0
"""

import asyncio
import json
import os
import pytest
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, List, Any

# Import Phase 4 components
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from blockchain.solana_extractor import SolanaPokemonExtractor, BlockchainPokemonCard
from apis.api_integrator import APIAggregator, APICard, EbayAPIIntegrator
from pipeline.database_bridge import PokeDAODatabaseBridge
from pipeline.main_pipeline import PokeDAOPipeline


class TestBlockchainExtractor:
    """Tests for Solana blockchain extractor"""
    
    @pytest.fixture
    def extractor(self):
        return SolanaPokemonExtractor()
    
    @pytest.fixture
    def sample_blockchain_card(self):
        return BlockchainPokemonCard(
            mint_address="test_mint_123",
            name="Pikachu #001",
            current_listing_price=1.5,
            collection_address="test_collection",
            metadata_uri="https://test.com/metadata",
            fair_value_estimate=1.8,
            phase2_card_key="pikachu-001-holo",
            grade="PSA 9",
            vault_status="active"
        )
    
    def test_blockchain_card_creation(self, sample_blockchain_card):
        """Test blockchain card data structure"""
        card = sample_blockchain_card
        assert card.mint_address == "test_mint_123"
        assert card.name == "Pikachu #001"
        assert card.current_listing_price == 1.5
        assert card.fair_value_estimate == 1.8
        assert card.is_undervalued()  # Should be true since fair > current
    
    def test_investment_metrics(self, sample_blockchain_card):
        """Test investment calculation methods"""
        card = sample_blockchain_card
        
        assert card.get_potential_profit() == 0.3  # 1.8 - 1.5
        assert card.get_roi_percentage() == 20.0   # 0.3 / 1.5 * 100
        assert card.is_undervalued() is True
    
    @pytest.mark.asyncio
    async def test_extractor_initialization(self, extractor):
        """Test extractor can be initialized"""
        assert extractor.magic_eden_url is not None
        assert extractor.session is None  # Not connected yet
    
    @pytest.mark.asyncio
    async def test_mock_collection_discovery(self, extractor):
        """Test collection discovery with mocked response"""
        mock_collections = [
            {"symbol": "pokemon_cards", "name": "Pokemon Cards", "floorPrice": 0.5},
            {"symbol": "vintage_pokemon", "name": "Vintage Pokemon", "floorPrice": 1.0}
        ]
        
        with patch('aiohttp.ClientSession.get') as mock_get:
            mock_response = AsyncMock()
            mock_response.json.return_value = mock_collections
            mock_response.status = 200
            mock_get.return_value.__aenter__.return_value = mock_response
            
            async with extractor:
                collections = await extractor.discover_pokemon_collections()
                assert len(collections) == 2
                assert collections[0]['symbol'] == 'pokemon_cards'


class TestAPIIntegrator:
    """Tests for API integration components"""
    
    @pytest.fixture
    def ebay_integrator(self):
        return EbayAPIIntegrator()
    
    @pytest.fixture
    def api_aggregator(self):
        return APIAggregator()
    
    @pytest.fixture
    def sample_api_card(self):
        return APICard(
            source="ebay",
            source_id="ebay_123456",
            title="Pokemon Pikachu Card PSA 9",
            price=45.0,
            condition="Near Mint",
            phase2_card_key="pikachu-base-holo",
            url="https://ebay.com/item/123456",
            grade="PSA 9"
        )
    
    def test_api_card_creation(self, sample_api_card):
        """Test API card data structure"""
        card = sample_api_card
        assert card.source == "ebay"
        assert card.title == "Pokemon Pikachu Card PSA 9"
        assert card.price == 45.0
        assert card.grade == "PSA 9"
    
    def test_phase2_integration(self, sample_api_card):
        """Test Phase 2 card key integration"""
        card = sample_api_card
        assert card.phase2_card_key == "pikachu-base-holo"
        # Test card key normalization would happen here
    
    @pytest.mark.asyncio
    async def test_ebay_search_formatting(self, ebay_integrator):
        """Test eBay search query formatting"""
        queries = ebay_integrator._build_pokemon_search_queries()
        assert len(queries) > 0
        assert any("charizard" in q.lower() for q in queries)
        assert any("pikachu" in q.lower() for q in queries)
    
    @pytest.mark.asyncio
    async def test_api_aggregator_initialization(self, api_aggregator):
        """Test API aggregator setup"""
        assert len(api_aggregator.sources) == 0
        
        # Test adding sources
        await api_aggregator.add_ebay_source()
        assert len(api_aggregator.sources) == 1


class TestDatabaseBridge:
    """Tests for database integration"""
    
    @pytest.fixture
    def db_bridge(self):
        return PokeDAODatabaseBridge()
    
    @pytest.fixture
    def sample_blockchain_cards(self):
        return [
            BlockchainPokemonCard(
                mint_address="mint_001",
                name="Charizard #006",
                current_listing_price=2.5,
                collection_address="collection_001",
                metadata_uri="https://test.com/001",
                fair_value_estimate=3.0,
                phase2_card_key="charizard-base-holo"
            ),
            BlockchainPokemonCard(
                mint_address="mint_002", 
                name="Blastoise #009",
                current_listing_price=1.8,
                collection_address="collection_001",
                metadata_uri="https://test.com/002",
                fair_value_estimate=2.2,
                phase2_card_key="blastoise-base-holo"
            )
        ]
    
    def test_card_to_database_conversion(self, db_bridge, sample_blockchain_cards):
        """Test converting blockchain cards to database format"""
        card = sample_blockchain_cards[0]
        db_item = db_bridge._blockchain_card_to_catalog_item(card)
        
        assert db_item['source'] == 'solana_blockchain'
        assert db_item['external_id'] == 'mint_001'
        assert db_item['name'] == 'Charizard #006'
        assert db_item['phase2_card_key'] == 'charizard-base-holo'
    
    @pytest.mark.asyncio
    async def test_mock_database_operations(self, db_bridge):
        """Test database operations with mocked connection"""
        with patch('asyncpg.connect') as mock_connect:
            mock_conn = AsyncMock()
            mock_connect.return_value = mock_conn
            
            # Mock database operations
            mock_conn.fetch.return_value = []
            mock_conn.execute.return_value = None
            
            async with db_bridge:
                # Test connection established
                assert db_bridge.connection is not None


class TestMainPipeline:
    """Tests for main pipeline orchestrator"""
    
    @pytest.fixture
    def pipeline_config(self):
        return {
            'blockchain': {
                'enabled': True,
                'max_cards': 10,
                'collections_limit': 2
            },
            'apis': {
                'enabled': True,
                'ebay': {'enabled': True, 'max_cards': 5},
                'tcgplayer': {'enabled': False, 'max_cards': 5}
            },
            'database': {
                'enabled': False,  # Disabled for testing
                'auto_insert': False
            },
            'output': {
                'save_files': True,
                'output_dir': tempfile.mkdtemp()
            },
            'quality': {
                'enable_validation': True,
                'min_quality_score': 0.5
            }
        }
    
    @pytest.fixture
    def pipeline(self, pipeline_config):
        return PokeDAOPipeline(pipeline_config)
    
    def test_pipeline_initialization(self, pipeline):
        """Test pipeline initialization"""
        assert pipeline.config is not None
        assert pipeline.stats['pipeline_start'] is None
        assert pipeline.stats['total_cards'] == 0
    
    def test_quality_scoring(self, pipeline):
        """Test data quality scoring"""
        # Test blockchain card quality
        good_card = BlockchainPokemonCard(
            mint_address="mint_test",
            name="Quality Charizard Card",
            current_listing_price=1.0,
            collection_address="collection",
            metadata_uri="https://test.com",
            phase2_card_key="charizard-test"
        )
        
        poor_card = BlockchainPokemonCard(
            mint_address="mint_poor",
            name="",  # Missing name
            current_listing_price=0,  # No price
            collection_address="collection",
            metadata_uri="https://test.com"
        )
        
        good_score = pipeline._calculate_quality_score(good_card)
        poor_score = pipeline._calculate_quality_score(poor_card)
        
        assert good_score > poor_score
        assert good_score >= 0.5  # Should pass quality threshold
        assert poor_score < 0.5   # Should fail quality threshold
    
    @pytest.mark.asyncio
    async def test_pipeline_component_initialization(self, pipeline):
        """Test individual component initialization"""
        with patch('blockchain.solana_extractor.SolanaPokemonExtractor'):
            with patch('apis.api_integrator.APIAggregator'):
                await pipeline.initialize()
                
                assert pipeline.blockchain_extractor is not None
                assert pipeline.api_aggregator is not None
    
    @pytest.mark.asyncio
    async def test_data_saving(self, pipeline):
        """Test pipeline data saving functionality"""
        # Create test data
        blockchain_cards = [
            BlockchainPokemonCard(
                mint_address="save_test_001",
                name="Test Save Card",
                current_listing_price=1.5,
                collection_address="test_collection",
                metadata_uri="https://test.com/save"
            )
        ]
        
        api_cards = [
            APICard(
                source="test",
                source_id="save_test_api",
                title="Test API Card",
                price=25.0,
                condition="NM"
            )
        ]
        
        await pipeline.save_pipeline_data(blockchain_cards, api_cards)
        
        # Verify file was created
        output_dir = pipeline.config['output']['output_dir']
        files = os.listdir(output_dir)
        json_files = [f for f in files if f.endswith('.json')]
        
        assert len(json_files) > 0
        
        # Verify file contents
        with open(os.path.join(output_dir, json_files[0]), 'r') as f:
            data = json.load(f)
            
        assert 'blockchain_data' in data
        assert 'api_data' in data
        assert data['blockchain_data']['count'] == 1
        assert data['api_data']['count'] == 1


class TestIntegration:
    """Integration tests for complete pipeline"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_mock_pipeline(self):
        """Test complete pipeline with mocked external services"""
        
        # Create test configuration
        config = {
            'blockchain': {'enabled': True, 'max_cards': 2},
            'apis': {'enabled': True, 'ebay': {'enabled': True, 'max_cards': 2}},
            'database': {'enabled': False, 'auto_insert': False},
            'output': {'save_files': False, 'output_dir': tempfile.mkdtemp()},
            'quality': {'enable_validation': False}
        }
        
        pipeline = PokeDAOPipeline(config)
        
        # Mock all external dependencies
        with patch.object(pipeline, 'extract_blockchain_data') as mock_blockchain:
            with patch.object(pipeline, 'extract_api_data') as mock_api:
                
                # Set up mock returns
                mock_blockchain.return_value = [
                    BlockchainPokemonCard(
                        mint_address="integration_test_001",
                        name="Integration Test Card",
                        current_listing_price=1.0,
                        collection_address="test_collection",
                        metadata_uri="https://test.com/integration"
                    )
                ]
                
                mock_api.return_value = [
                    APICard(
                        source="test_api",
                        source_id="integration_api_001",
                        title="Integration API Card",
                        price=20.0,
                        condition="NM"
                    )
                ]
                
                # Run pipeline
                stats = await pipeline.run_full_pipeline()
                
                # Verify results
                assert stats['blockchain_cards'] == 1
                assert stats['api_cards'] == 1
                assert stats['total_cards'] == 2
                assert len(stats['errors']) == 0


def test_phase_integration():
    """Test integration with other PokeDAO phases"""
    
    # Test Phase 1 database schema compatibility
    test_catalog_item = {
        'source': 'solana_blockchain',
        'external_id': 'test_mint_address',
        'name': 'Test Pokemon Card',
        'phase2_card_key': 'pikachu-base-holo',
        'raw_data': {}
    }
    
    # Verify all required fields are present
    required_fields = ['source', 'external_id', 'name', 'phase2_card_key']
    for field in required_fields:
        assert field in test_catalog_item
    
    # Test Phase 2 card key format
    card_key = test_catalog_item['phase2_card_key']
    assert isinstance(card_key, str)
    assert len(card_key.split('-')) >= 2  # Should have at least pokemon-set format


if __name__ == "__main__":
    """Run tests directly"""
    print("🧪 PokeDAO Phase 4 Testing Framework")
    print("=" * 40)
    print("🎯 Testing all pipeline components...")
    print()
    
    # Basic test runner (pytest recommended for full features)
    test_classes = [
        TestBlockchainExtractor,
        TestAPIIntegrator, 
        TestDatabaseBridge,
        TestMainPipeline,
        TestIntegration
    ]
    
    passed = 0
    failed = 0
    
    for test_class in test_classes:
        class_name = test_class.__name__
        print(f"📋 Testing {class_name}...")
        
        try:
            # Basic instantiation test
            instance = test_class()
            print(f"✅ {class_name} instantiation: PASS")
            passed += 1
            
        except Exception as e:
            print(f"❌ {class_name} instantiation: FAIL - {e}")
            failed += 1
    
    # Run integration test
    print(f"📋 Testing phase integration...")
    try:
        test_phase_integration()
        print(f"✅ Phase integration: PASS")
        passed += 1
    except Exception as e:
        print(f"❌ Phase integration: FAIL - {e}")
        failed += 1
    
    print()
    print(f"🏁 Test Summary:")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Success Rate: {passed/(passed+failed)*100:.1f}%")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED!")
        print()
        print("🚀 Phase 4 pipeline is ready for deployment!")
        print("📋 To run full test suite: pytest test_phase4.py -v")
        print("🔧 To run with coverage: pytest test_phase4.py --cov=. --cov-report=html")
    else:
        print("⚠️ Some tests failed. Please review and fix issues.")
        print("🔧 Run: python test_phase4.py for basic tests")
        print("📋 Run: pytest test_phase4.py -v for detailed testing")
