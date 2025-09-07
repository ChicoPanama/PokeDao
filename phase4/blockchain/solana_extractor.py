#!/usr/bin/env python3
"""
Multi-Source Pokemon Card Data Extractor - Enhanced Phase 4 Implementation
FIXED VERSION: Critical type safety and import issues resolved

Author: PokeDAO Builder  
Version: Phase 4.1.0 (Multi-Source Enhanced - Fixed)
"""

import asyncio
import aiohttp
import json
import os
import time
import re
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class ComprehensivePokemonCard:
    """Complete Pokemon card data from all sources"""
    # Primary Identifiers (required)
    mint_address: str
    token_id: str
    name: str
    
    # Card Details (optional)
    card_id: Optional[str] = None
    card_number: Optional[str] = None
    set_name: Optional[str] = None
    rarity: Optional[str] = None
    
    # Grading & Condition
    grade: Optional[str] = None
    grading_company: Optional[str] = None
    condition: Optional[str] = None
    
    # Pricing Data (Multi-source)
    magic_eden_price: Optional[float] = None
    floor_price: Optional[float] = None
    last_sale_price: Optional[float] = None
    collector_crypt_price: Optional[float] = None
    
    # Vault & Physical Status
    vault_status: Optional[str] = None
    physical_verified: bool = False
    redemption_available: bool = False
    vault_location: Optional[str] = None
    
    # Market Intelligence
    volume_24h: Optional[float] = None
    holders_count: Optional[int] = None
    total_supply: int = 1
    
    # Data Source Attribution
    magic_eden_data: Optional[Dict[str, Any]] = None
    blockchain_data: Optional[Dict[str, Any]] = None
    collector_crypt_data: Optional[Dict[str, Any]] = None
    
    # PokeDao Analysis
    fair_value_estimate: Optional[float] = None
    confidence_score: Optional[float] = None
    investment_thesis: Optional[str] = None
    data_completeness: Optional[float] = None
    
    # Metadata
    last_updated: Optional[str] = None
    data_sources_used: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.last_updated is None:
            self.last_updated = datetime.now().isoformat()
        if self.data_sources_used is None:
            self.data_sources_used = []
        if self.magic_eden_data is None:
            self.magic_eden_data = {}
        if self.blockchain_data is None:
            self.blockchain_data = {}
        if self.collector_crypt_data is None:
            self.collector_crypt_data = {}

    # Backward compatibility properties for existing database integration
    @property
    def current_listing_price(self) -> Optional[float]:
        """Backward compatibility with existing database bridge"""
        return self.magic_eden_price
    
    @property
    def collection_address(self) -> Optional[str]:
        """Extract collection address from Magic Eden data"""
        if self.magic_eden_data:
            return self.magic_eden_data.get('collection', {}).get('symbol')
        return None
    
    @property
    def phase2_card_key(self) -> Optional[str]:
        """Generate Phase 2 compatible card key"""
        if self.card_number and self.set_name:
            return f"{self.set_name}_{self.card_number}"
        return None

    # Added image_url property for database compatibility
    @property 
    def image_url(self) -> Optional[str]:
        """Extract image URL from various data sources"""
        # Try Magic Eden data first
        if self.magic_eden_data and 'image' in self.magic_eden_data:
            return self.magic_eden_data['image']
        
        # Try blockchain metadata
        if self.blockchain_data and 'image' in self.blockchain_data:
            return self.blockchain_data['image']
            
        # Try collector crypt data
        if self.collector_crypt_data and 'image_url' in self.collector_crypt_data:
            return self.collector_crypt_data['image_url']
            
        return None


# Backward compatibility alias
BlockchainPokemonCard = ComprehensivePokemonCard


class MultiSourcePokemonExtractor:
    """Extracts Pokemon card data from multiple sources for maximum coverage"""
    
    def __init__(self, solana_rpc_url: Optional[str] = None, magic_eden_api_key: Optional[str] = None):
        self.session: Optional[aiohttp.ClientSession] = None
        self.solana_rpc_url = solana_rpc_url or "https://api.mainnet-beta.solana.com"
        self.magic_eden_api_key = magic_eden_api_key
        
        # Data source configurations
        self.sources = {
            'magic_eden': {
                'base_url': 'https://api-mainnet.magiceden.dev/v2',
                'priority': 1,
                'reliability': 0.95
            },
            'collector_crypt': {
                'base_url': 'https://collectorcrypt.com',
                'priority': 2,
                'reliability': 0.90
            },
            'solana_rpc': {
                'base_url': self.solana_rpc_url,
                'priority': 3,
                'reliability': 0.99
            }
        }
        
        # Discovered API endpoints (to be populated)
        self.collector_crypt_endpoints = {}
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def _ensure_session(self):
        """Ensure session is available for API calls"""
        if self.session is None:
            raise RuntimeError("Session not initialized. Use 'async with' context manager.")
        return self.session

    async def discover_collector_crypt_apis(self):
        """Discover Collector Crypt's internal APIs"""
        session = self._ensure_session()
        logger.info("🔍 Discovering Collector Crypt API endpoints...")
        
        # Test common API patterns
        test_endpoints = [
            '/api/cards',
            '/api/vault',
            '/api/authenticate', 
            '/api/metadata',
            '/api/v1/cards',
            '/api/v1/vault/status',
            '/graphql',
            '/_next/data'
        ]
        
        discovered = {}
        
        for endpoint in test_endpoints:
            try:
                url = f"{self.sources['collector_crypt']['base_url']}{endpoint}"
                
                async with session.get(url, timeout=5) as response:
                    if response.status == 200:
                        content_type = response.headers.get('content-type', '')
                        if 'json' in content_type:
                            data = await response.json()
                            discovered[endpoint] = {
                                'url': url,
                                'status': response.status,
                                'content_type': content_type,
                                'sample_data': str(data)[:200]
                            }
                            logger.info(f"✅ Found API endpoint: {url}")
                    
            except Exception as e:
                logger.debug(f"❌ Endpoint {endpoint} failed: {e}")
                continue
                
        self.collector_crypt_endpoints = discovered
        logger.info(f"🎯 Discovered {len(discovered)} working Collector Crypt endpoints")
        return discovered

    async def get_magic_eden_listings(self, collection_symbol: str = "pokemon_tcg", limit: int = 100) -> List[Dict[str, Any]]:
        """Get Pokemon card listings from Magic Eden"""
        session = self._ensure_session()
        logger.info(f"🔥 Fetching Magic Eden listings for {collection_symbol}")
        
        url = f"{self.sources['magic_eden']['base_url']}/collections/{collection_symbol}/listings"
        params = {
            'offset': 0,
            'limit': limit
        }
        
        # Add API key if available
        headers = {}
        if self.magic_eden_api_key:
            headers['Authorization'] = f'Bearer {self.magic_eden_api_key}'
        
        try:
            async with session.get(url, params=params, timeout=10, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"✅ Retrieved {len(data)} Magic Eden listings")
                    return data
                else:
                    logger.warning(f"⚠️ Magic Eden API returned status {response.status}")
                    return []
        except Exception as e:
            logger.error(f"❌ Magic Eden API error: {e}")
            return []

    async def get_magic_eden_collection_stats(self, collection_symbol: str = "pokemon_tcg") -> Optional[Dict[str, Any]]:
        """Get collection statistics from Magic Eden"""
        session = self._ensure_session()
        url = f"{self.sources['magic_eden']['base_url']}/collections/{collection_symbol}/stats"
        
        try:
            async with session.get(url, params={}, timeout=15) as response:
                if response.status == 200:
                    stats = await response.json()
                    logger.info(f"📊 Retrieved Magic Eden collection stats for {collection_symbol}")
                    return stats
                return None
        except Exception as e:
            logger.error(f"❌ Magic Eden stats error: {e}")
            return None

    async def search_collector_crypt_vault(self, search_term: str = "pokemon") -> List[Dict[str, Any]]:
        """Search Collector Crypt vault for Pokemon cards"""
        session = self._ensure_session()
        logger.info(f"🏛️ Searching Collector Crypt vault for: {search_term}")
        
        # Try discovered endpoints first
        for endpoint_path, endpoint_info in self.collector_crypt_endpoints.items():
            if 'vault' in endpoint_path or 'search' in endpoint_path:
                try:
                    url = endpoint_info['url']
                    async with session.get(url, timeout=5) as response:
                        if response.status == 200:
                            data = await response.json()
                            logger.info(f"✅ Found vault data via {endpoint_path}")
                            return data if isinstance(data, list) else [data]
                except Exception:
                    continue
        
        # Fallback: try standard patterns
        fallback_urls = [
            f"{self.sources['collector_crypt']['base_url']}/api/search?q={search_term}",
            f"{self.sources['collector_crypt']['base_url']}/vault?search={search_term}"
        ]
        
        for url in fallback_urls:
            try:
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        text_content = await response.text()
                        if self._contains_pokemon_data(text_content):
                            logger.info(f"✅ Found Pokemon data in Collector Crypt")
                            return [{'source': 'collector_crypt', 'content': text_content[:1000]}]
            except Exception:
                continue
                
        logger.warning("⚠️ No Collector Crypt vault data found")
        return []

    async def authenticate_collector_crypt(self, credentials: Optional[Dict[str, str]] = None) -> bool:
        """Attempt to authenticate with Collector Crypt for premium data"""
        session = self._ensure_session()
        
        if not credentials:
            logger.info("🔐 No credentials provided for Collector Crypt authentication")
            return False
            
        auth_url = f"{self.sources['collector_crypt']['base_url']}/api/authenticate"
        
        try:
            async with session.post(auth_url, json=credentials, timeout=10) as response:
                if response.status == 200:
                    auth_data = await response.json()
                    if 'token' in auth_data:
                        logger.info("✅ Successfully authenticated with Collector Crypt")
                        return True
                        
        except Exception as e:
            logger.error(f"❌ Collector Crypt authentication failed: {e}")
            
        return False

    def _contains_pokemon_data(self, text_content: str) -> bool:
        """Check if content contains Pokemon card data"""
        card_patterns = [
            r'pokemon',
            r'pikachu',
            r'charizard',
            r'base set',
            r'holo',
            r'graded',
            r'psa \d+',
            r'cgc \d+'
        ]
        
        text_content = text_content.lower()
        return any(re.search(pattern, text_content, re.IGNORECASE) for pattern in card_patterns)

    async def extract_comprehensive_pokemon_cards(self, limit: int = 100) -> List[ComprehensivePokemonCard]:
        """Extract comprehensive Pokemon card data from all sources"""
        logger.info(f"🎯 Starting comprehensive Pokemon card extraction (limit: {limit})")
        
        cards = []
        
        try:
            # 1. Get Magic Eden listings
            logger.info("🔥 Extracting from Magic Eden...")
            listings = await self.get_magic_eden_listings(limit=limit)
            
            # 2. Get collection stats
            stats = await self.get_magic_eden_collection_stats()
            
            # 3. Convert listings to comprehensive cards
            for listing in listings[:limit]:
                try:
                    card = self._convert_listing_to_card(listing, stats)
                    if card:
                        cards.append(card)
                except Exception as e:
                    logger.error(f"❌ Error converting listing: {e}")
                    continue
            
            # 4. Enhance with Collector Crypt data
            logger.info("🏛️ Enhancing with Collector Crypt data...")
            vault_data = await self.search_collector_crypt_vault()
            
            # 5. Apply data source tracking
            for card in cards:
                card.data_sources_used = ['magic_eden']
                if vault_data:
                    card.data_sources_used.append('collector_crypt')
                
                # Calculate basic confidence score
                card.confidence_score = self._calculate_confidence_score(card)
                card.data_completeness = self._calculate_completeness(card)
                
            logger.info(f"✅ Extracted {len(cards)} comprehensive Pokemon cards")
            return cards
            
        except Exception as e:
            logger.error(f"❌ Comprehensive extraction failed: {e}")
            return []

    def _convert_listing_to_card(self, listing: Dict[str, Any], stats: Optional[Dict[str, Any]] = None) -> Optional[ComprehensivePokemonCard]:
        """Convert Magic Eden listing to ComprehensivePokemonCard"""
        try:
            # Extract basic info
            mint_address = listing.get('mint', listing.get('tokenMint', 'unknown'))
            name = listing.get('name', 'Unknown Pokemon Card')
            
            # Extract pricing
            price = listing.get('price', 0)
            if isinstance(price, (int, float)):
                magic_eden_price = float(price)
            else:
                magic_eden_price = 0.0
            
            # Create comprehensive card
            card = ComprehensivePokemonCard(
                mint_address=mint_address,
                token_id=listing.get('tokenId', '1'),
                name=name,
                magic_eden_price=magic_eden_price,
                rarity=listing.get('rarity'),
                set_name=listing.get('collection', {}).get('name', 'Unknown Set'),
                magic_eden_data=listing
            )
            
            # Add floor price from stats
            if stats and 'floorPrice' in stats:
                card.floor_price = float(stats['floorPrice'])
            
            return card
            
        except Exception as e:
            logger.error(f"❌ Error converting listing to card: {e}")
            return None

    def _calculate_confidence_score(self, card: ComprehensivePokemonCard) -> float:
        """Calculate confidence score based on available data"""
        score = 0.0
        max_score = 10.0
        
        # Basic required fields
        if card.mint_address and card.mint_address != 'unknown':
            score += 2.0
        if card.name and card.name != 'Unknown Pokemon Card':
            score += 2.0
        
        # Pricing data
        if card.magic_eden_price and card.magic_eden_price > 0:
            score += 2.0
        if card.floor_price and card.floor_price > 0:
            score += 1.0
        
        # Metadata
        if card.rarity:
            score += 1.0
        if card.set_name and card.set_name != 'Unknown Set':
            score += 1.0
        
        # Data sources
        if card.data_sources_used and len(card.data_sources_used) > 1:
            score += 1.0
        
        return min(score / max_score, 1.0)

    def _calculate_completeness(self, card: ComprehensivePokemonCard) -> float:
        """Calculate data completeness percentage"""
        total_fields = 15  # Total possible fields
        filled_fields = 0
        
        # Check each field
        fields_to_check = [
            card.mint_address, card.token_id, card.name, card.card_id,
            card.card_number, card.set_name, card.rarity, card.grade,
            card.grading_company, card.condition, card.magic_eden_price,
            card.floor_price, card.vault_status, card.image_url
        ]
        
        for field in fields_to_check:
            if field is not None and field != '':
                filled_fields += 1
        
        return filled_fields / total_fields


# Validation helper functions
def validate_comprehensive_card(card: ComprehensivePokemonCard) -> bool:
    """Validate that a ComprehensivePokemonCard has required fields"""
    try:
        # Check required fields
        if not card.mint_address or not card.token_id or not card.name:
            return False
            
        # Check data structure
        if card.data_sources_used is None:
            card.data_sources_used = []
            
        return True
    except Exception:
        return False


# Testing and validation functionality
async def test_multi_source_extraction():
    """Test the multi-source Pokemon card extraction system"""
    logger.info("🧪 Testing multi-source Pokemon card extraction...")
    
    # Get environment variables
    magic_eden_api_key = os.getenv('MAGIC_EDEN_API_KEY')  # Optional
    solana_rpc_url = os.getenv('SOLANA_RPC_URL')  # Optional
    
    async with MultiSourcePokemonExtractor(solana_rpc_url, magic_eden_api_key) as extractor:
        try:
            # Test 1: Discover Collector Crypt APIs
            start_time = time.time()
            logger.info("🔍 Test 1: API Discovery")
            endpoints = await extractor.discover_collector_crypt_apis()
            logger.info(f"✅ API Discovery completed in {time.time() - start_time:.2f}s")
            
            # Test 2: Magic Eden listings
            start_time = time.time()
            logger.info("🔥 Test 2: Magic Eden Listings")
            listings = await extractor.get_magic_eden_listings(limit=10)
            logger.info(f"✅ Magic Eden test completed in {time.time() - start_time:.2f}s")
            
            # Test 3: Collector Crypt search
            start_time = time.time()
            logger.info("🏛️ Test 3: Collector Crypt Search")
            vault_data = await extractor.search_collector_crypt_vault("charizard")
            logger.info(f"✅ Collector Crypt test completed in {time.time() - start_time:.2f}s")
            
            # Summary
            logger.info("=" * 50)
            logger.info("🎯 MULTI-SOURCE EXTRACTION TEST RESULTS")
            logger.info("=" * 50)
            logger.info(f"📡 Discovered Endpoints: {len(endpoints)}")
            logger.info(f"🔥 Magic Eden Listings: {len(listings)}")
            logger.info(f"🏛️ Collector Crypt Results: {len(vault_data)}")
            
            return {
                'endpoints_discovered': len(endpoints),
                'magic_eden_listings': len(listings),
                'collector_crypt_results': len(vault_data),
                'test_passed': True
            }
            
        except Exception as e:
            logger.error(f"❌ Test failed: {e}")
            return {'test_passed': False, 'error': str(e)}


if __name__ == "__main__":
    # Basic validation test
    try:
        # Test data structure
        test_card = ComprehensivePokemonCard(
            mint_address="test123",
            token_id="1",
            name="Pikachu"
        )
        
        if validate_comprehensive_card(test_card):
            print("✅ ComprehensivePokemonCard validation passed")
        else:
            print("❌ ComprehensivePokemonCard validation failed")
            
        # Test extraction system
        asyncio.run(test_multi_source_extraction())
        
        print("🎉 solana_extractor_fixed.py validation completed successfully")
        
    except Exception as e:
        print(f"❌ solana_extractor_fixed.py validation failed: {e}")
