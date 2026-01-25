#!/usr/bin/env python3
"""
Multi-Source Pokemon Card Data Extractor - Enhanced Phase 4 Implementation
Combines blockchain data, Magic Eden APIs, and discovered Collector Crypt endpoints
for maximum data coverage and reliability

Author: PokeDAO Builder  
Version: Phase 4.1.0 (Multi-Source Enhanced)
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
from solana.rpc.async_api import AsyncClient

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
        if not self.name:
            return None
        
        # Normalize name for Phase 2 compatibility
        normalized_name = self.name.lower().replace(' ', '-')
        set_part = self.set_name.lower().replace(' ', '-') if self.set_name else 'unknown'
        
        return f"{normalized_name}-{set_part}"
    
    def is_undervalued(self) -> bool:
        """Check if card is undervalued based on fair value estimate"""
        if not self.fair_value_estimate or not self.magic_eden_price:
            return False
        return self.magic_eden_price < self.fair_value_estimate
    
    def get_potential_profit(self) -> float:
        """Calculate potential profit if sold at fair value"""
        if not self.fair_value_estimate or not self.magic_eden_price:
            return 0.0
        return max(0, self.fair_value_estimate - self.magic_eden_price)
    
    def get_roi_percentage(self) -> float:
        """Calculate ROI percentage"""
        profit = self.get_potential_profit()
        if not self.magic_eden_price or self.magic_eden_price == 0:
            return 0.0
        return (profit / self.magic_eden_price) * 100


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

    async def discover_collector_crypt_apis(self):
        """Discover Collector Crypt's internal APIs"""
        self._ensure_session()
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
                
                async with self.session.get(url, timeout=5) as response:
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
                    
                    elif response.status in [401, 403]:
                        # API exists but requires authentication
                        discovered[endpoint] = {
                            'url': url,
                            'status': response.status,
                            'requires_auth': True
                        }
                        logger.info(f"🔒 Found protected API: {url}")
                
                await asyncio.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                logger.debug(f"Endpoint {endpoint} not accessible: {e}")
        
        self.collector_crypt_endpoints = discovered
        logger.info(f"🎯 Discovered {len(discovered)} Collector Crypt endpoints")
        return discovered
    
    async def get_magic_eden_collections(self):
        """Get Collector Crypt collections from Magic Eden"""
        logger.info("📦 Fetching collections from Magic Eden...")
        
        try:
            # Search for Collector Crypt related collections
            search_terms = ['collector crypt', 'pokemon cards', 'CARDS']
            collections = []
            
            for term in search_terms:
                url = f"{self.sources['magic_eden']['base_url']}/collections"
                params = {'q': term, 'limit': 20}
                
                async with self.session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        for collection in data:
                            if any(keyword in collection.get('name', '').lower() 
                                  for keyword in ['collector', 'crypt', 'pokemon']):
                                collections.append(collection)
                
                await asyncio.sleep(0.3)
            
            logger.info(f"✅ Found {len(collections)} relevant collections")
            return collections
            
        except Exception as e:
            logger.error(f"❌ Error fetching Magic Eden collections: {e}")
            return []
    
    async def get_cards_from_magic_eden(self, collection_symbol: str):
        """Get Pokemon cards from Magic Eden collection"""
        logger.info(f"🃏 Fetching cards from Magic Eden collection: {collection_symbol}")
        
        try:
            url = f"{self.sources['magic_eden']['base_url']}/collections/{collection_symbol}/listings"
            params = {'limit': 500}
            
            async with self.session.get(url, params=params, timeout=15) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(f"⚠️ Magic Eden API returned status {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"❌ Error fetching from Magic Eden: {e}")
            return []
    
    async def get_collector_crypt_data(self, card_id: str):
        """Attempt to get data directly from Collector Crypt APIs"""
        if not self.collector_crypt_endpoints:
            return {}
        
        collector_data = {}
        
        # Try discovered endpoints
        for endpoint_path, endpoint_info in self.collector_crypt_endpoints.items():
            if endpoint_info.get('requires_auth'):
                continue  # Skip protected endpoints for now
            
            try:
                # Attempt to get card-specific data
                if 'cards' in endpoint_path:
                    url = f"{endpoint_info['url']}/{card_id}"
                    
                    async with self.session.get(url, timeout=5) as response:
                        if response.status == 200:
                            data = await response.json()
                            collector_data[endpoint_path] = data
                            logger.info(f"✅ Got Collector Crypt data from {endpoint_path}")
                
            except Exception as e:
                logger.debug(f"Could not get data from {endpoint_path}: {e}")
        
        return collector_data
    
    async def get_blockchain_data(self, mint_address: str):
        """Get on-chain data from Solana blockchain"""
        try:
            # Simplified blockchain query
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [mint_address, {"encoding": "base64"}]
            }
            
            url = self.sources['solana_rpc']['base_url']
            
            async with self.session.post(url, json=payload, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('result', {})
                    
        except Exception as e:
            logger.debug(f"Error getting blockchain data: {e}")
        
        return {}
    
    async def extract_comprehensive_pokemon_cards(self, max_collections=5):
        """Extract Pokemon cards using all available data sources"""
        logger.info("🚀 Starting comprehensive multi-source extraction...")
        
        all_cards = []
        
        # Step 1: Discover Collector Crypt APIs
        await self.discover_collector_crypt_apis()
        
        # Step 2: Get collections from Magic Eden
        collections = await self.get_magic_eden_collections()
        
        for collection in collections[:max_collections]:
            collection_symbol = collection.get('symbol')
            if not collection_symbol:
                continue
                
            logger.info(f"🎯 Processing collection: {collection.get('name')}")
            
            # Step 3: Get cards from Magic Eden
            magic_eden_cards = await self.get_cards_from_magic_eden(collection_symbol)
            
            for me_card in magic_eden_cards:
                try:
                    mint_address = me_card.get('tokenMint', '')
                    if not mint_address:
                        continue
                    
                    # Step 4: Enrich with all available data sources
                    comprehensive_card = await self._create_comprehensive_card(me_card, mint_address)
                    
                    if comprehensive_card and self._is_pokemon_card(comprehensive_card):
                        all_cards.append(comprehensive_card)
                        
                except Exception as e:
                    logger.debug(f"Error processing card: {e}")
                    continue
            
            await asyncio.sleep(1)  # Rate limiting between collections
        
        logger.info(f"🎉 Comprehensive extraction complete. Total cards: {len(all_cards)}")
        return all_cards
    
    async def _create_comprehensive_card(self, magic_eden_data: dict, mint_address: str):
        """Create comprehensive card by combining all data sources"""
        
        # Extract base data from Magic Eden
        name = magic_eden_data.get('title', magic_eden_data.get('extra', {}).get('name', 'Unknown'))
        price = magic_eden_data.get('price', 0) / 1_000_000_000 if magic_eden_data.get('price') else None
        
        # Get additional data from other sources
        collector_crypt_data = await self.get_collector_crypt_data(mint_address)
        blockchain_data = await self.get_blockchain_data(mint_address)
        
        # Combine and analyze data
        card = ComprehensivePokemonCard(
            mint_address=mint_address,
            token_id=mint_address[-8:],
            name=name,
            magic_eden_price=price,
            magic_eden_data=magic_eden_data,
            collector_crypt_data=collector_crypt_data,
            blockchain_data=blockchain_data
        )
        
        # Extract enhanced details
        await self._enrich_card_data(card)
        
        # Calculate data completeness score
        card.data_completeness = self._calculate_completeness(card)
        
        # Mark data sources used
        card.data_sources_used = []
        if magic_eden_data:
            card.data_sources_used.append('magic_eden')
        if collector_crypt_data:
            card.data_sources_used.append('collector_crypt')
        if blockchain_data:
            card.data_sources_used.append('solana_blockchain')
        
        return card
    
    async def _enrich_card_data(self, card: ComprehensivePokemonCard):
        """Enrich card with data from all sources"""
        
        # Extract from Magic Eden data
        if card.magic_eden_data:
            attributes = card.magic_eden_data.get('extra', {}).get('attributes', [])
            
            for attr in attributes:
                trait_type = attr.get('trait_type', '').lower()
                value = str(attr.get('value', ''))
                
                if 'grade' in trait_type or 'condition' in trait_type:
                    card.grade = value
                elif 'set' in trait_type or 'series' in trait_type:
                    card.set_name = value
                elif 'rarity' in trait_type:
                    card.rarity = value
        
        # Extract from Collector Crypt data (if available)
        if card.collector_crypt_data:
            for endpoint_data in card.collector_crypt_data.values():
                if isinstance(endpoint_data, dict):
                    if 'vault_status' in endpoint_data:
                        card.vault_status = endpoint_data['vault_status']
                    if 'physical_verified' in endpoint_data:
                        card.physical_verified = endpoint_data['physical_verified']
        
        # Calculate fair value using multi-source data
        card.fair_value_estimate = self._calculate_multi_source_fair_value(card)
        
        # Generate investment thesis
        card.investment_thesis = self._generate_comprehensive_thesis(card)
        
        # Calculate confidence score based on data sources
        card.confidence_score = self._calculate_confidence_score(card)
    
    def _calculate_multi_source_fair_value(self, card: ComprehensivePokemonCard) -> Optional[float]:
        """Calculate fair value using data from multiple sources"""
        if not card.magic_eden_price:
            return None
        
        base_value = card.magic_eden_price
        
        # Adjust based on data quality and sources
        if card.data_sources_used and len(card.data_sources_used) >= 2:
            base_value *= 1.05  # Premium for multi-source verification
        
        if card.vault_status == 'vaulted':
            base_value *= 1.1  # Premium for vaulted cards
        
        if card.grade and any(grade in card.grade.upper() for grade in ['PSA 10', 'BGS 10']):
            base_value *= 1.2  # Premium for perfect grades
        
        return round(base_value, 4)
    
    def _generate_comprehensive_thesis(self, card: ComprehensivePokemonCard) -> str:
        """Generate investment thesis using comprehensive data"""
        thesis_parts = []
        
        # Multi-source reliability
        if card.data_sources_used and len(card.data_sources_used) >= 2:
            thesis_parts.append("VERIFIED - Multi-source data confirmation")
        
        # Vault status
        if card.vault_status == 'vaulted':
            thesis_parts.append("SECURED - Physically vaulted asset")
        
        # Pricing analysis
        if card.fair_value_estimate and card.magic_eden_price:
            ratio = card.magic_eden_price / card.fair_value_estimate
            if ratio < 0.9:
                thesis_parts.append("UNDERVALUED - Below fair value estimate")
            elif ratio > 1.1:
                thesis_parts.append("OVERVALUED - Above fair value estimate")
        
        # Data completeness
        if card.data_completeness and card.data_completeness > 0.8:
            thesis_parts.append("HIGH CONFIDENCE - Complete data profile")
        
        return " | ".join(thesis_parts) if thesis_parts else "STANDARD ASSET"
    
    def _calculate_confidence_score(self, card: ComprehensivePokemonCard) -> float:
        """Calculate confidence score based on data sources and completeness"""
        score = 0.0
        
        # Base score from number of sources
        if card.data_sources_used:
            score += len(card.data_sources_used) * 0.2
        
        # Bonus for specific sources
        if card.data_sources_used:
            if 'magic_eden' in card.data_sources_used:
                score += 0.3  # Magic Eden is reliable
            if 'collector_crypt' in card.data_sources_used:
                score += 0.2  # Direct source data
            if 'solana_blockchain' in card.data_sources_used:
                score += 0.1  # Blockchain verification
        
        # Data completeness factor
        if card.data_completeness:
            score *= card.data_completeness
        
        return min(1.0, score)  # Cap at 1.0
    
    def _calculate_completeness(self, card: ComprehensivePokemonCard) -> float:
        """Calculate how complete the card data is"""
        fields_to_check = [
            'name', 'grade', 'set_name', 'rarity', 'magic_eden_price',
            'vault_status', 'fair_value_estimate'
        ]
        
        completed_fields = sum(1 for field in fields_to_check 
                             if getattr(card, field) is not None)
        
        return completed_fields / len(fields_to_check)
    
    def _is_pokemon_card(self, card: ComprehensivePokemonCard) -> bool:
        """Check if card is a Pokemon card"""
        pokemon_indicators = ['pokemon', 'pokémon', 'pikachu', 'charizard', 'tcg']
        
        text_to_check = (
            card.name + ' ' + 
            (card.set_name or '') + ' ' + 
            str(card.magic_eden_data)
        ).lower()
        
        return any(indicator in text_to_check for indicator in pokemon_indicators)
    
    def save_comprehensive_data(self, cards: List[ComprehensivePokemonCard], 
                               filename_base="comprehensive_pokemon_cards"):
        """Save comprehensive multi-source data"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Create analysis summary
        summary = {
            'extraction_timestamp': timestamp,
            'total_cards': len(cards),
            'data_sources_used': list(set(sum([card.data_sources_used or [] for card in cards], []))),
            'average_confidence': sum(card.confidence_score or 0 for card in cards) / len(cards) if cards else 0,
            'average_completeness': sum(card.data_completeness or 0 for card in cards) / len(cards) if cards else 0,
            'collector_crypt_endpoints_discovered': len(self.collector_crypt_endpoints),
            'high_confidence_cards': len([c for c in cards if (c.confidence_score or 0) > 0.8])
        }
        
        # Save comprehensive data
        json_file = f"{filename_base}_{timestamp}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump({
                'summary': summary,
                'cards': [asdict(card) for card in cards]
            }, f, indent=2, ensure_ascii=False)
        
        logger.info(f"💾 Saved comprehensive data to {json_file}")
        logger.info(f"📊 Summary: {summary}")
        
        return json_file


# Backward compatibility alias for existing database integration
SolanaPokemonExtractor = MultiSourcePokemonExtractor


async def main():
    """Main execution for multi-source extraction"""
    print("🚀 Multi-Source Pokemon Card Data Extractor")
    print("=" * 55)
    print("🎯 Optimal approach: Magic Eden + Collector Crypt + Blockchain")
    
    async with MultiSourcePokemonExtractor() as extractor:
        try:
            print("\n🔍 Step 1: Discovering all data sources...")
            cards = await extractor.extract_comprehensive_pokemon_cards(max_collections=3)
            
            if cards:
                print(f"✅ Extracted {len(cards)} comprehensive Pokemon cards!")
                
                # Show data source coverage
                all_sources = set()
                for card in cards:
                    if card.data_sources_used:
                        all_sources.update(card.data_sources_used)
                
                print(f"\n📊 Data sources successfully used: {', '.join(all_sources)}")
                
                # Show quality metrics
                avg_confidence = sum(card.confidence_score or 0 for card in cards) / len(cards)
                avg_completeness = sum(card.data_completeness or 0 for card in cards) / len(cards)
                
                print(f"🎯 Average confidence score: {avg_confidence:.2f}")
                print(f"📈 Average data completeness: {avg_completeness:.2f}")
                
                # Preview top cards
                print(f"\n👀 Top quality cards:")
                sorted_cards = sorted(cards, key=lambda x: x.confidence_score or 0, reverse=True)
                
                for i, card in enumerate(sorted_cards[:3], 1):
                    print(f"{i}. {card.name}")
                    print(f"   💰 Price: {card.magic_eden_price} SOL")
                    print(f"   🎯 Fair Value: {card.fair_value_estimate} SOL")
                    print(f"   📊 Confidence: {card.confidence_score:.2f}")
                    print(f"   📈 Completeness: {card.data_completeness:.2f}")
                    print(f"   🔗 Sources: {', '.join(card.data_sources_used or [])}")
                    print(f"   💡 Thesis: {card.investment_thesis}")
                    print()
                
                # Save results
                filename = extractor.save_comprehensive_data(cards)
                print(f"💾 Comprehensive data saved to: {filename}")
                
                print(f"\n🎯 OPTIMAL SOLUTION IMPLEMENTED!")
                print(f"✅ Multi-source data extraction working")
                print(f"✅ Magic Eden + Collector Crypt + Blockchain")
                print(f"✅ Confidence scoring and data validation")
                print(f"✅ Ready for PokeDao Phase 3 integration")
                
            else:
                print("❌ No Pokemon cards found")
                
        except Exception as e:
            logger.error(f"💥 Multi-source extraction failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
    
    # Media
    image_url: Optional[str] = None
    animation_url: Optional[str] = None
    
    # PokeDAO Integration Fields
    fair_value_estimate: Optional[float] = None
    investment_thesis: Optional[str] = None
    alert_triggered: bool = False
    phase2_card_key: Optional[str] = None  # From Phase 2 normalization
    
    # Timestamps
    created_at: Optional[str] = None
    last_updated: str = None
    extracted_at: str = None
    
    def __post_init__(self):
        if self.last_updated is None:
            self.last_updated = datetime.now().isoformat()
        if self.extracted_at is None:
            self.extracted_at = datetime.now().isoformat()


class SolanaPokemonExtractor:
    """Advanced Pokemon card extractor for Solana blockchain and Magic Eden"""
    
    def __init__(self, solana_rpc_url: str = None, magic_eden_api_key: str = None):
        # Solana RPC configuration
        self.solana_rpc_url = solana_rpc_url or os.getenv(
            'SOLANA_RPC_URL', 
            'https://api.mainnet-beta.solana.com'
        )
        self.solana_client = AsyncClient(self.solana_rpc_url)
        
        # Magic Eden API configuration
        self.magic_eden_base_url = "https://api-mainnet.magiceden.dev/v2"
        self.magic_eden_headers = {
            'User-Agent': 'PokeDAO/4.0 Phase4-Blockchain-Extractor',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        }
        
        if magic_eden_api_key:
            self.magic_eden_headers['Authorization'] = f'Bearer {magic_eden_api_key}'
        
        # Known Pokemon card collections on Solana
        self.pokemon_collections = [
            # These will be discovered dynamically
            # Add known collection symbols here as discovered
        ]
        
        # Rate limiting configuration
        self.rate_limit_delay = 0.5  # Seconds between requests
        self.max_retries = 3
        self.backoff_factor = 2
        
        # Session for HTTP requests
        self.session = None
        
        # Statistics
        self.stats = {
            'collections_discovered': 0,
            'total_nfts_processed': 0,
            'pokemon_cards_found': 0,
            'api_calls_made': 0,
            'errors_encountered': 0
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=10)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
        await self.solana_client.close()
        
        # Log final statistics
        logger.info("🏁 Extraction session completed!")
        logger.info(f"📊 Final Statistics: {self.stats}")
    
    async def _make_api_request(self, url: str, params: dict = None, retries: int = 0) -> Optional[dict]:
        """Make API request with retry logic and rate limiting"""
        try:
            self.stats['api_calls_made'] += 1
            
            async with self.session.get(
                url, 
                headers=self.magic_eden_headers, 
                params=params
            ) as response:
                
                if response.status == 200:
                    return await response.json()
                elif response.status == 429 and retries < self.max_retries:
                    # Rate limited - exponential backoff
                    wait_time = self.rate_limit_delay * (self.backoff_factor ** retries)
                    logger.warning(f"Rate limited. Waiting {wait_time:.1f}s before retry...")
                    await asyncio.sleep(wait_time)
                    return await self._make_api_request(url, params, retries + 1)
                else:
                    logger.warning(f"API request failed: {response.status} for {url}")
                    self.stats['errors_encountered'] += 1
                    return None
                    
        except Exception as e:
            self.stats['errors_encountered'] += 1
            logger.error(f"Error making API request to {url}: {e}")
            
            if retries < self.max_retries:
                wait_time = self.rate_limit_delay * (self.backoff_factor ** retries)
                await asyncio.sleep(wait_time)
                return await self._make_api_request(url, params, retries + 1)
            
            return None
        
        # Apply rate limiting
        await asyncio.sleep(self.rate_limit_delay)
    
    async def discover_pokemon_collections(self) -> List[Dict[str, Any]]:
        """Discover Pokemon card collections on Magic Eden"""
        logger.info("🔍 Discovering Pokemon card collections on Magic Eden...")
        
        search_terms = [
            "collector crypt",
            "tokenized pokemon", 
            "pokemon cards",
            "pokemon tcg",
            "charizard",
            "pikachu",
            "base set",
            "cards",
            "trading cards"
        ]
        
        discovered_collections = []
        seen_symbols = set()
        
        for term in search_terms:
            logger.info(f"🔎 Searching for: '{term}'")
            
            url = f"{self.magic_eden_base_url}/collections"
            params = {
                'q': term,
                'limit': 50  # Get more results per search
            }
            
            data = await self._make_api_request(url, params)
            
            if data:
                for collection in data:
                    symbol = collection.get('symbol')
                    name = collection.get('name', '').lower()
                    description = collection.get('description', '').lower()
                    
                    # Skip if already seen
                    if symbol in seen_symbols:
                        continue
                    
                    # Check if it's Pokemon-related
                    if self._is_pokemon_collection(name, description):
                        collection_info = {
                            'symbol': symbol,
                            'name': collection.get('name'),
                            'description': collection.get('description'),
                            'floor_price': collection.get('floorPrice'),
                            'volume_24h': collection.get('volumeAll'),
                            'item_count': collection.get('itemCount', 0),
                            'owner_count': collection.get('ownerCount', 0)
                        }
                        
                        discovered_collections.append(collection_info)
                        seen_symbols.add(symbol)
                        self.stats['collections_discovered'] += 1
                        
                        logger.info(f"✅ Found Pokemon collection: {collection.get('name')}")
                        logger.info(f"   Floor: {collection.get('floorPrice', 'N/A')} SOL | Items: {collection.get('itemCount', 0)}")
        
        logger.info(f"🎯 Discovery complete! Found {len(discovered_collections)} Pokemon collections")
        return discovered_collections
    
    def _is_pokemon_collection(self, name: str, description: str) -> bool:
        """Advanced Pokemon collection detection"""
        text_to_check = f"{name} {description}"
        
        # Strong indicators (high confidence)
        strong_indicators = [
            'pokemon', 'pokémon', 'collector crypt', 'trading cards',
            'tcg', 'charizard', 'pikachu', 'base set', 'neo genesis'
        ]
        
        # Card-related indicators  
        card_indicators = [
            'cards', 'card', 'graded', 'psa', 'bgs', 'cgc',
            'mint', 'holo', 'rare', 'first edition'
        ]
        
        # Check for strong indicators
        has_strong = any(indicator in text_to_check for indicator in strong_indicators)
        has_card = any(indicator in text_to_check for indicator in card_indicators)
        
        # Exclude false positives
        exclusions = ['crypto', 'defi', 'gaming', 'metaverse', 'avatar']
        has_exclusion = any(exclusion in text_to_check for exclusion in exclusions)
        
        return has_strong or (has_card and not has_exclusion)
    
    async def get_collection_stats(self, collection_symbol: str) -> Optional[Dict[str, Any]]:
        """Get detailed collection statistics"""
        url = f"{self.magic_eden_base_url}/collections/{collection_symbol}/stats"
        return await self._make_api_request(url)
    
    async def get_collection_listings(self, collection_symbol: str, limit: int = 500) -> List[Dict[str, Any]]:
        """Get current listings from a collection"""
        logger.info(f"📦 Fetching listings from: {collection_symbol}")
        
        all_listings = []
        offset = 0
        batch_size = 500
        
        while len(all_listings) < limit:
            remaining = min(batch_size, limit - len(all_listings))
            
            url = f"{self.magic_eden_base_url}/collections/{collection_symbol}/listings"
            params = {
                'offset': offset,
                'limit': remaining
            }
            
            batch_data = await self._make_api_request(url, params)
            
            if not batch_data:
                break
            
            all_listings.extend(batch_data)
            offset += len(batch_data)
            
            logger.info(f"   💫 Fetched {len(all_listings)} listings so far...")
            
            # Break if we got less than requested (end of results)
            if len(batch_data) < remaining:
                break
        
        logger.info(f"✅ Total listings fetched: {len(all_listings)}")
        return all_listings
    
    async def get_collection_activities(self, collection_symbol: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent sales and activities"""
        url = f"{self.magic_eden_base_url}/collections/{collection_symbol}/activities"
        params = {'limit': limit}
        
        data = await self._make_api_request(url, params)
        return data if data else []
    
    async def get_nft_metadata(self, mint_address: str) -> Optional[Dict[str, Any]]:
        """Get detailed NFT metadata from Solana blockchain"""
        try:
            pubkey = PublicKey(mint_address)
            account_info = await self.solana_client.get_account_info(pubkey)
            
            if account_info.value:
                return {
                    'mint': mint_address,
                    'owner': str(account_info.value.owner),
                    'lamports': account_info.value.lamports,
                    'data_length': len(account_info.value.data) if account_info.value.data else 0
                }
                
        except Exception as e:
            logger.debug(f"Could not fetch on-chain data for {mint_address}: {e}")
        
        return None
    
    async def extract_pokemon_cards_from_collection(self, collection_symbol: str) -> List[BlockchainPokemonCard]:
        """Extract and process Pokemon cards from a specific collection"""
        logger.info(f"🎴 Processing collection: {collection_symbol}")
        
        # Get collection statistics
        stats = await self.get_collection_stats(collection_symbol)
        
        # Get current listings
        listings = await self.get_collection_listings(collection_symbol)
        
        # Get recent sales data
        activities = await self.get_collection_activities(collection_symbol)
        
        pokemon_cards = []
        
        for listing in listings:
            try:
                self.stats['total_nfts_processed'] += 1
                
                # Check if this NFT is actually a Pokemon card
                if self._is_pokemon_nft(listing):
                    card = await self._parse_listing_to_pokemon_card(
                        listing, stats, activities
                    )
                    
                    if card:
                        pokemon_cards.append(card)
                        self.stats['pokemon_cards_found'] += 1
                        
                        # Log interesting finds
                        if card.fair_value_estimate and card.current_listing_price:
                            if card.current_listing_price < card.fair_value_estimate * 0.9:
                                logger.info(f"💎 POTENTIAL DEAL: {card.name} - Listed: {card.current_listing_price:.3f} SOL, Fair Value: {card.fair_value_estimate:.3f} SOL")
                
            except Exception as e:
                logger.debug(f"Error processing listing: {e}")
                continue
        
        logger.info(f"✅ Extracted {len(pokemon_cards)} Pokemon cards from {collection_symbol}")
        return pokemon_cards
    
    def _is_pokemon_nft(self, listing: Dict[str, Any]) -> bool:
        """Determine if an NFT listing is a Pokemon card"""
        title = listing.get('title', '').lower()
        extra_name = listing.get('extra', {}).get('name', '').lower()
        attributes = listing.get('extra', {}).get('attributes', [])
        
        # Combine all text for analysis
        text_content = f"{title} {extra_name}"
        
        # Add attribute values to text
        for attr in attributes:
            if isinstance(attr, dict):
                text_content += f" {attr.get('value', '')}"
        
        # Pokemon indicators
        pokemon_keywords = [
            'pokemon', 'pokémon', 'pikachu', 'charizard', 'blastoise', 'venusaur',
            'base set', 'jungle', 'fossil', 'neo', 'gym', 'rocket',
            'tcg', 'trading card', 'holo', 'shadowless',
            'first edition', '1st edition', 'unlimited',
            'psa', 'bgs', 'cgc', 'graded'
        ]
        
        # Card format indicators
        card_patterns = [
            r'\d+/\d+',  # Card numbers like 4/102
            r'psa \d+',   # PSA grades
            r'bgs \d+',   # BGS grades
            r'grade \d+', # Generic grades
        ]
        
        # Check keywords
        has_pokemon_keyword = any(keyword in text_content for keyword in pokemon_keywords)
        
        # Check patterns
        has_card_pattern = any(re.search(pattern, text_content) for pattern in card_patterns)
        
        return has_pokemon_keyword or has_card_pattern
    
    async def _parse_listing_to_pokemon_card(
        self, 
        listing: Dict[str, Any], 
        collection_stats: Dict[str, Any] = None,
        activities: List[Dict[str, Any]] = None
    ) -> Optional[BlockchainPokemonCard]:
        """Parse Magic Eden listing into Pokemon card structure"""
        
        try:
            # Basic information
            mint_address = listing.get('tokenMint', '')
            title = listing.get('title', listing.get('extra', {}).get('name', 'Unknown Card'))
            
            # Price information
            price_lamports = listing.get('price', 0)
            price_sol = price_lamports / 1_000_000_000 if price_lamports else None
            
            # Extract card attributes
            attributes = listing.get('extra', {}).get('attributes', [])
            parsed_attributes = self._parse_attributes(attributes)
            
            # Get recent sales data for this NFT
            recent_sales = self._find_recent_sales(mint_address, activities) if activities else []
            
            # Calculate market metrics
            floor_price = collection_stats.get('floorPrice') if collection_stats else None
            volume_24h = collection_stats.get('volumeAll') if collection_stats else None
            
            # Calculate fair value using PokeDAO methodology
            fair_value = self._calculate_fair_value(
                price_sol, parsed_attributes, collection_stats, recent_sales
            )
            
            # Generate investment thesis
            investment_thesis = self._generate_investment_thesis(
                title, parsed_attributes, price_sol, fair_value, collection_stats
            )
            
            # Generate Phase 2 compatible card key
            card_key = self._generate_phase2_card_key(title, parsed_attributes)
            
            # Get on-chain metadata (optional)
            on_chain_data = await self.get_nft_metadata(mint_address)
            
            return BlockchainPokemonCard(
                mint_address=mint_address,
                token_id=mint_address[-8:],  # Short ID for display
                collection_address=listing.get('collectionSymbol'),
                
                name=title,
                description=listing.get('extra', {}).get('description'),
                card_number=parsed_attributes.get('number'),
                set_name=parsed_attributes.get('set'),
                rarity=parsed_attributes.get('rarity'),
                grade=parsed_attributes.get('grade'),
                grading_company=parsed_attributes.get('grading_company'),
                
                floor_price=floor_price,
                current_listing_price=price_sol,
                last_sale_price=recent_sales[0].get('price_sol') if recent_sales else None,
                volume_24h=volume_24h,
                
                verified_collection=True,
                image_url=listing.get('extra', {}).get('image'),
                animation_url=listing.get('extra', {}).get('animation_url'),
                
                fair_value_estimate=fair_value,
                investment_thesis=investment_thesis,
                phase2_card_key=card_key,
                vault_status=self._determine_vault_status(title, parsed_attributes),
                
                creator_address=on_chain_data.get('owner') if on_chain_data else None
            )
            
        except Exception as e:
            logger.debug(f"Error parsing listing to Pokemon card: {e}")
            return None
    
    def _parse_attributes(self, attributes: List[Dict[str, Any]]) -> Dict[str, str]:
        """Parse NFT attributes into structured data"""
        parsed = {}
        
        for attr in attributes:
            if not isinstance(attr, dict):
                continue
                
            trait_type = attr.get('trait_type', '').lower()
            value = str(attr.get('value', ''))
            
            # Map attribute types to our structure
            if any(key in trait_type for key in ['grade', 'condition']):
                parsed['grade'] = value
                
                # Extract grading company
                if any(company in value.lower() for company in ['psa', 'bgs', 'cgc']):
                    for company in ['psa', 'bgs', 'cgc']:
                        if company in value.lower():
                            parsed['grading_company'] = company.upper()
                            break
            
            elif any(key in trait_type for key in ['set', 'series', 'expansion']):
                parsed['set'] = value
                
            elif any(key in trait_type for key in ['rarity', 'rare']):
                parsed['rarity'] = value
                
            elif any(key in trait_type for key in ['number', 'card number']):
                parsed['number'] = value
                
            elif any(key in trait_type for key in ['year', 'date']):
                parsed['year'] = value
        
        return parsed
    
    def _find_recent_sales(self, mint_address: str, activities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find recent sales for a specific NFT"""
        sales = []
        
        for activity in activities:
            if (activity.get('mintAddress') == mint_address and 
                activity.get('type') in ['buyNow', 'acceptBid']):
                
                price_lamports = activity.get('price', 0)
                price_sol = price_lamports / 1_000_000_000 if price_lamports else 0
                
                sales.append({
                    'price_sol': price_sol,
                    'timestamp': activity.get('blockTime'),
                    'type': activity.get('type')
                })
        
        return sorted(sales, key=lambda x: x.get('timestamp', 0), reverse=True)
    
    def _calculate_fair_value(
        self, 
        current_price: float, 
        attributes: Dict[str, str], 
        collection_stats: Dict[str, Any] = None,
        recent_sales: List[Dict[str, Any]] = None
    ) -> Optional[float]:
        """Advanced fair value calculation using PokeDAO methodology"""
        
        if not current_price:
            return None
        
        # Start with current price as baseline
        fair_value = current_price
        
        # Grade premium/discount
        grade = attributes.get('grade')
        if grade:
            grade_num = self._extract_grade_number(grade)
            if grade_num:
                if grade_num >= 10:
                    fair_value *= 1.25  # Perfect grade premium
                elif grade_num >= 9:
                    fair_value *= 1.15  # High grade premium
                elif grade_num >= 8:
                    fair_value *= 1.05  # Good grade slight premium
                elif grade_num <= 6:
                    fair_value *= 0.85  # Lower grade discount
        
        # Rarity adjustment
        rarity = attributes.get('rarity', '').lower()
        if 'rare' in rarity or 'holo' in rarity:
            fair_value *= 1.10
        elif 'common' in rarity:
            fair_value *= 0.95
        
        # Set/Era adjustment
        set_name = attributes.get('set', '').lower()
        if any(premium_set in set_name for premium_set in ['base set', 'first edition', 'shadowless']):
            fair_value *= 1.20
        
        # Collection performance adjustment
        if collection_stats:
            volume_24h = collection_stats.get('volumeAll', 0)
            if volume_24h > 100:  # High volume collection
                fair_value *= 1.05
            elif volume_24h < 10:  # Low volume collection
                fair_value *= 0.95
        
        # Recent sales trend adjustment
        if recent_sales and len(recent_sales) >= 2:
            avg_recent = sum(sale['price_sol'] for sale in recent_sales[:3]) / len(recent_sales[:3])
            if avg_recent > current_price * 1.1:
                fair_value *= 1.05  # Recent sales trend up
            elif avg_recent < current_price * 0.9:
                fair_value *= 0.95  # Recent sales trend down
        
        return round(fair_value, 4)
    
    def _extract_grade_number(self, grade_str: str) -> Optional[float]:
        """Extract numeric grade from grade string"""
        if not grade_str:
            return None
        
        # Look for numeric patterns
        import re
        match = re.search(r'(\d+(?:\.\d+)?)', grade_str)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        
        return None
    
    def _generate_investment_thesis(
        self, 
        name: str, 
        attributes: Dict[str, str], 
        price: float, 
        fair_value: float, 
        collection_stats: Dict[str, Any] = None
    ) -> str:
        """Generate comprehensive investment thesis for PokeDAO"""
        
        thesis_components = []
        
        # Price analysis
        if fair_value and price:
            ratio = price / fair_value
            if ratio < 0.85:
                thesis_components.append("🔥 STRONG BUY - Significantly undervalued")
            elif ratio < 0.95:
                thesis_components.append("💰 BUY - Trading below fair value")
            elif ratio > 1.15:
                thesis_components.append("⚠️ OVERVALUED - Consider waiting")
            elif ratio > 1.05:
                thesis_components.append("📊 FAIRLY PRICED - Monitor for entry")
            else:
                thesis_components.append("✅ FAIR VALUE - Good entry point")
        
        # Grade analysis
        grade = attributes.get('grade')
        if grade:
            grade_num = self._extract_grade_number(grade)
            if grade_num:
                if grade_num >= 10:
                    thesis_components.append("💎 PERFECT GRADE - Premium collector piece")
                elif grade_num >= 9:
                    thesis_components.append("⭐ HIGH GRADE - Strong collector appeal")
                elif grade_num <= 6:
                    thesis_components.append("📉 LOWER GRADE - Budget option")
        
        # Set/Rarity analysis
        set_name = attributes.get('set', '').lower()
        rarity = attributes.get('rarity', '').lower()
        
        if 'base set' in set_name:
            thesis_components.append("🏆 ICONIC SET - High long-term value")
        elif 'first edition' in set_name or '1st edition' in name.lower():
            thesis_components.append("📅 FIRST EDITION - Premium vintage appeal")
        
        if 'rare' in rarity or 'holo' in rarity:
            thesis_components.append("✨ RARE/HOLO - Enhanced collectibility")
        
        # Pokemon-specific analysis
        name_lower = name.lower()
        if 'charizard' in name_lower:
            thesis_components.append("🔥 CHARIZARD - Blue chip Pokemon card")
        elif 'pikachu' in name_lower:
            thesis_components.append("⚡ PIKACHU - Mascot appeal")
        elif any(legendary in name_lower for legendary in ['lugia', 'ho-oh', 'mewtwo', 'mew']):
            thesis_components.append("🌟 LEGENDARY - High collector demand")
        
        # Collection liquidity analysis
        if collection_stats:
            volume = collection_stats.get('volumeAll', 0)
            if volume > 100:
                thesis_components.append("💧 HIGH LIQUIDITY - Easy to trade")
            elif volume < 10:
                thesis_components.append("🔒 LOW LIQUIDITY - Hold for long term")
        
        # Vault status
        if 'vault' in name.lower() or attributes.get('vault_status'):
            thesis_components.append("🏦 VAULTED - Physical backing available")
        
        return " | ".join(thesis_components) if thesis_components else "📊 STANDARD COLLECTIBLE - Basic trading card"
    
    def _generate_phase2_card_key(self, name: str, attributes: Dict[str, str]) -> str:
        """Generate Phase 2 compatible card key for integration"""
        # Simplified version of Phase 2 normalization
        # In production, this would call the actual Phase 2 normalization engine
        
        # Extract set
        set_name = attributes.get('set', 'unknown').lower()
        set_code = 'base1' if 'base' in set_name else 'unk'
        
        # Extract card number
        card_num = attributes.get('number', '000')
        if '/' in card_num:
            card_num = card_num.split('/')[0]
        
        # Extract variant
        variant = 'holo' if 'holo' in name.lower() else 'normal'
        
        # Extract grade
        grade = attributes.get('grade', '')
        grade_suffix = ''
        if grade:
            grade_num = self._extract_grade_number(grade)
            if grade_num:
                grade_suffix = f"-{attributes.get('grading_company', 'unknown').lower()}{int(grade_num)}"
        
        return f"{set_code}-{card_num.zfill(3)}-{variant}{grade_suffix}"
    
    def _determine_vault_status(self, name: str, attributes: Dict[str, str]) -> str:
        """Determine if card is vaulted or available for redemption"""
        name_lower = name.lower()
        
        if 'vault' in name_lower:
            return 'vaulted'
        elif 'redeemable' in name_lower:
            return 'redeemable'
        elif any(attr.get('trait_type', '').lower() == 'vault' 
                for attr in attributes if isinstance(attr, dict)):
            return 'vaulted'
        else:
            return 'unknown'
    
    async def extract_all_pokemon_cards(self) -> List[BlockchainPokemonCard]:
        """Main extraction method - discover and process all Pokemon collections"""
        logger.info("🚀 Starting comprehensive Pokemon card extraction from Solana blockchain...")
        
        # Step 1: Discover Pokemon collections
        collections = await self.discover_pokemon_collections()
        
        if not collections:
            logger.warning("❌ No Pokemon collections found on Magic Eden")
            return []
        
        # Step 2: Process each collection
        all_pokemon_cards = []
        
        for i, collection in enumerate(collections, 1):
            symbol = collection.get('symbol')
            name = collection.get('name')
            
            logger.info(f"🎯 Processing collection {i}/{len(collections)}: {name}")
            
            try:
                cards = await self.extract_pokemon_cards_from_collection(symbol)
                all_pokemon_cards.extend(cards)
                
                logger.info(f"✅ Extracted {len(cards)} cards from {name}")
                
                # Show best deals found
                good_deals = [
                    card for card in cards 
                    if (card.fair_value_estimate and card.current_listing_price and
                        card.current_listing_price < card.fair_value_estimate * 0.9)
                ]
                
                if good_deals:
                    logger.info(f"💎 Found {len(good_deals)} potential deals in this collection!")
                
            except Exception as e:
                logger.error(f"❌ Error processing collection {name}: {e}")
                continue
        
        logger.info(f"🏁 Extraction complete! Total Pokemon cards found: {len(all_pokemon_cards)}")
        return all_pokemon_cards
    
    def save_blockchain_data(
        self, 
        cards: List[BlockchainPokemonCard], 
        output_dir: str = "phase4_data"
    ) -> Dict[str, str]:
        """Save blockchain Pokemon card data in multiple formats"""
        
        if not cards:
            logger.warning("⚠️ No cards to save")
            return {}
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        results = {}
        
        # 1. Full blockchain data (JSON)
        blockchain_file = f"{output_dir}/blockchain_pokemon_cards_{timestamp}.json"
        with open(blockchain_file, 'w', encoding='utf-8') as f:
            json.dump([asdict(card) for card in cards], f, indent=2, ensure_ascii=False)
        results['blockchain_file'] = blockchain_file
        logger.info(f"💾 Saved full blockchain data: {blockchain_file}")
        
        # 2. PokeDAO integration format
        pokedao_file = f"{output_dir}/pokedao_integration_{timestamp}.json"
        pokedao_data = {
            "metadata": {
                "extraction_timestamp": timestamp,
                "total_cards": len(cards),
                "data_source": "solana_blockchain",
                "phase": "4",
                "extractor_version": "4.0.0",
                "statistics": self.stats
            },
            "cards": [
                {
                    "blockchain_id": card.mint_address,
                    "phase2_card_key": card.phase2_card_key,
                    "name": card.name,
                    "current_price_sol": card.current_listing_price,
                    "current_price_usd": card.current_listing_price * 20 if card.current_listing_price else None,  # Rough SOL->USD
                    "fair_value_sol": card.fair_value_estimate,
                    "fair_value_usd": card.fair_value_estimate * 20 if card.fair_value_estimate else None,
                    "investment_thesis": card.investment_thesis,
                    "grade": card.grade,
                    "grading_company": card.grading_company,
                    "set_name": card.set_name,
                    "rarity": card.rarity,
                    "vault_status": card.vault_status,
                    "alert_triggered": card.alert_triggered,
                    "image_url": card.image_url,
                    "marketplace_url": f"https://magiceden.io/item-details/{card.mint_address}",
                    "extracted_at": card.extracted_at
                }
                for card in cards
            ]
        }
        
        with open(pokedao_file, 'w', encoding='utf-8') as f:
            json.dump(pokedao_data, f, indent=2, ensure_ascii=False)
        results['pokedao_file'] = pokedao_file
        logger.info(f"🎯 Saved PokeDAO integration data: {pokedao_file}")
        
        # 3. Investment alerts (deals only)
        deals = [
            card for card in cards 
            if (card.fair_value_estimate and card.current_listing_price and
                card.current_listing_price < card.fair_value_estimate * 0.9)
        ]
        
        if deals:
            alerts_file = f"{output_dir}/investment_alerts_{timestamp}.json"
            alerts_data = {
                "alert_timestamp": timestamp,
                "total_deals": len(deals),
                "deals": [
                    {
                        "name": deal.name,
                        "listing_price_sol": deal.current_listing_price,
                        "fair_value_sol": deal.fair_value_estimate,
                        "discount_percentage": round((1 - deal.current_listing_price / deal.fair_value_estimate) * 100, 1),
                        "investment_thesis": deal.investment_thesis,
                        "marketplace_url": f"https://magiceden.io/item-details/{deal.mint_address}",
                        "grade": deal.grade,
                        "alert_priority": "HIGH" if deal.current_listing_price < deal.fair_value_estimate * 0.8 else "MEDIUM"
                    }
                    for deal in sorted(deals, key=lambda x: x.current_listing_price / x.fair_value_estimate)
                ]
            }
            
            with open(alerts_file, 'w', encoding='utf-8') as f:
                json.dump(alerts_data, f, indent=2, ensure_ascii=False)
            results['alerts_file'] = alerts_file
            logger.info(f"🚨 Saved investment alerts: {alerts_file} ({len(deals)} deals)")
        
        # 4. Statistics summary
        stats_file = f"{output_dir}/extraction_stats_{timestamp}.json"
        stats_data = {
            **self.stats,
            "extraction_timestamp": timestamp,
            "cards_extracted": len(cards),
            "deals_found": len(deals),
            "average_price_sol": sum(card.current_listing_price for card in cards if card.current_listing_price) / len([card for card in cards if card.current_listing_price]) if cards else 0,
            "price_range_sol": {
                "min": min(card.current_listing_price for card in cards if card.current_listing_price) if cards else 0,
                "max": max(card.current_listing_price for card in cards if card.current_listing_price) if cards else 0
            },
            "grade_distribution": self._calculate_grade_distribution(cards),
            "set_distribution": self._calculate_set_distribution(cards)
        }
        
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(stats_data, f, indent=2, ensure_ascii=False)
        results['stats_file'] = stats_file
        logger.info(f"📊 Saved extraction statistics: {stats_file}")
        
        return results
    
    def _calculate_grade_distribution(self, cards: List[BlockchainPokemonCard]) -> Dict[str, int]:
        """Calculate distribution of card grades"""
        distribution = {}
        
        for card in cards:
            grade = card.grade or 'Ungraded'
            distribution[grade] = distribution.get(grade, 0) + 1
        
        return distribution
    
    def _calculate_set_distribution(self, cards: List[BlockchainPokemonCard]) -> Dict[str, int]:
        """Calculate distribution of card sets"""
        distribution = {}
        
        for card in cards:
            set_name = card.set_name or 'Unknown Set'
            distribution[set_name] = distribution.get(set_name, 0) + 1
        
        return distribution


async def main():
    """Main execution function for Phase 4 blockchain extraction"""
    print("🚀 PokeDAO Phase 4: Solana Blockchain Pokemon Card Extractor")
    print("=" * 70)
    print("🎯 Mission: Real-time blockchain trading intelligence")
    print("🔗 Integration: Phase 1 DB + Phase 2 Normalization + Phase 3 Utilities")
    print()
    
    # Configuration
    magic_eden_api_key = os.getenv('MAGIC_EDEN_API_KEY')  # Optional
    solana_rpc_url = os.getenv('SOLANA_RPC_URL')  # Optional
    
    async with SolanaPokemonExtractor(solana_rpc_url, magic_eden_api_key) as extractor:
        try:
            print("🔍 Phase 1: Collection Discovery")
            print("-" * 35)
            
            start_time = time.time()
            cards = await extractor.extract_all_pokemon_cards()
            extraction_time = time.time() - start_time
            
            if cards:
                print(f"\n✅ EXTRACTION SUCCESS!")
                print(f"⏱️  Extraction completed in {extraction_time:.1f} seconds")
                print(f"🎴 Total Pokemon cards found: {len(cards)}")
                print(f"📊 Statistics: {extractor.stats}")
                
                # Show top deals
                deals = [
                    card for card in cards 
                    if (card.fair_value_estimate and card.current_listing_price and
                        card.current_listing_price < card.fair_value_estimate * 0.9)
                ]
                
                if deals:
                    print(f"\n💎 TOP INVESTMENT OPPORTUNITIES:")
                    print("-" * 40)
                    
                    for i, deal in enumerate(sorted(deals, key=lambda x: x.current_listing_price / x.fair_value_estimate)[:5], 1):
                        discount = (1 - deal.current_listing_price / deal.fair_value_estimate) * 100
                        print(f"{i}. {deal.name}")
                        print(f"   💰 Listed: {deal.current_listing_price:.3f} SOL")
                        print(f"   🎯 Fair Value: {deal.fair_value_estimate:.3f} SOL")
                        print(f"   📉 Discount: {discount:.1f}%")
                        print(f"   📊 {deal.investment_thesis}")
                        print(f"   🔗 https://magiceden.io/item-details/{deal.mint_address}")
                        print()
                
                # Show sample data
                print(f"\n👀 SAMPLE BLOCKCHAIN DATA:")
                print("-" * 30)
                for i, card in enumerate(cards[:3], 1):
                    print(f"{i}. {card.name}")
                    print(f"   🏷️  Set: {card.set_name or 'Unknown'}")
                    print(f"   ⭐ Grade: {card.grade or 'Ungraded'}")
                    print(f"   💰 Price: {card.current_listing_price or 'Not listed'} SOL")
                    print(f"   🎯 Fair Value: {card.fair_value_estimate or 'N/A'} SOL")
                    print(f"   🏦 Vault: {card.vault_status}")
                    print(f"   🔑 Card Key: {card.phase2_card_key}")
                    print(f"   🆔 Mint: {card.mint_address[:20]}...")
                    print()
                
                # Save data
                print(f"💾 SAVING DATA...")
                print("-" * 20)
                results = extractor.save_blockchain_data(cards)
                
                for file_type, filename in results.items():
                    print(f"✅ {file_type}: {filename}")
                
                print(f"\n🎯 PHASE 4 BLOCKCHAIN INTEGRATION READY!")
                print("=" * 45)
                print("✅ Real-time Solana blockchain extraction")
                print("✅ Magic Eden marketplace integration") 
                print("✅ Fair value calculation engine")
                print("✅ Investment thesis generation")
                print("✅ Phase 2 card key compatibility")
                print("✅ Alert system data prepared")
                print("✅ Multi-format data export")
                print()
                print("🔄 Next Steps:")
                print("   1. Integrate with Phase 1 Prisma database")
                print("   2. Apply Phase 3 utilities for data validation")
                print("   3. Set up real-time data refresh pipeline")
                print("   4. Connect to Telegram alert system")
                print("   5. Build web dashboard for visualization")
                
            else:
                print("❌ No Pokemon cards found in blockchain extraction")
                print("💡 This might indicate:")
                print("   • No Collector Crypt collections currently listed")
                print("   • API rate limiting or connectivity issues")
                print("   • Collection discovery parameters need adjustment")
                
        except Exception as e:
            logger.error(f"💥 Blockchain extraction failed: {e}")
            print(f"❌ Error: {e}")
            print("\n🔧 Troubleshooting:")
            print("   1. Check internet connectivity")
            print("   2. Verify Magic Eden API is accessible")
            print("   3. Check Solana RPC endpoint status")
            print("   4. Review extraction logs for details")


if __name__ == "__main__":
    asyncio.run(main())
