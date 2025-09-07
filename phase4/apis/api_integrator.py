#!/usr/bin/env python3
"""
PokeDAO Phase 4 - API Integration Module
Integrates with traditional marketplace APIs (eBay, TCGPlayer, etc.)
Uses Phase 3 utilities for query optimization and data validation

Author: PokeDAO Builder
Version: Phase 4.0.0
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import aiohttp

logger = logging.getLogger(__name__)


@dataclass
class APICard:
    """Standard card structure for API sources"""
    source: str
    source_id: str
    title: str
    price: Optional[float] = None
    currency: str = 'USD'
    condition: Optional[str] = None
    grade: Optional[str] = None
    set_name: Optional[str] = None
    card_number: Optional[str] = None
    image_url: Optional[str] = None
    listing_url: Optional[str] = None
    seller: Optional[str] = None
    listing_type: Optional[str] = None  # auction, buy_it_now, etc.
    end_time: Optional[str] = None
    watchers: Optional[int] = None
    shipping_cost: Optional[float] = None
    
    # PokeDAO integration
    phase2_card_key: Optional[str] = None
    quality_score: Optional[float] = None
    extracted_at: str = None
    
    def __post_init__(self):
        if self.extracted_at is None:
            self.extracted_at = datetime.now().isoformat()


class EbayAPIIntegrator:
    """eBay Browse API integration with Phase 3 query optimization"""
    
    def __init__(self, app_id: str = None, cert_id: str = None):
        self.app_id = app_id or os.getenv('EBAY_APP_ID')
        self.cert_id = cert_id or os.getenv('EBAY_CERT_ID')
        
        if not self.app_id:
            logger.warning("⚠️ eBay API credentials not found. Set EBAY_APP_ID environment variable.")
        
        self.base_url = "https://api.ebay.com/buy/browse/v1"
        self.oauth_url = "https://api.ebay.com/identity/v1/oauth2/token"
        self.session = None
        self.access_token = None
        
        # Rate limiting
        self.rate_limit = 5000  # requests per day
        self.requests_made = 0
        self.last_reset = datetime.now()
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        if self.app_id:
            await self._get_access_token()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def _get_access_token(self):
        """Get OAuth token for eBay API"""
        if not self.app_id or not self.cert_id:
            return
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': f'Basic {self.app_id}:{self.cert_id}'
        }
        
        data = {
            'grant_type': 'client_credentials',
            'scope': 'https://api.ebay.com/oauth/api_scope'
        }
        
        try:
            async with self.session.post(
                self.oauth_url, 
                headers=headers, 
                data=urlencode(data)
            ) as response:
                if response.status == 200:
                    token_data = await response.json()
                    self.access_token = token_data.get('access_token')
                    logger.info("✅ eBay API token obtained")
                else:
                    logger.error(f"❌ Failed to get eBay token: {response.status}")
        except Exception as e:
            logger.error(f"❌ eBay token error: {e}")
    
    def _generate_pokemon_queries(self) -> List[str]:
        """Generate optimized Pokemon card search queries using Phase 3 patterns"""
        # This would integrate with Phase 3 EbayQueryBuilder
        base_queries = [
            "pokemon cards psa graded",
            "charizard base set holo",
            "pikachu first edition",
            "pokemon tcg vintage",
            "neo genesis pokemon",
            "jungle set pokemon",
            "fossil set pokemon",
            "pokemon cards bgs graded",
            "shadowless pokemon cards",
            "pokemon promo cards"
        ]
        
        return base_queries
    
    async def search_pokemon_cards(self, limit: int = 100) -> List[APICard]:
        """Search for Pokemon cards on eBay"""
        if not self.access_token:
            logger.warning("❌ No eBay access token available")
            return []
        
        logger.info(f"🔍 Searching eBay for Pokemon cards (limit: {limit})")
        
        queries = self._generate_pokemon_queries()
        all_cards = []
        
        for query in queries:
            if len(all_cards) >= limit:
                break
            
            try:
                cards = await self._search_query(query, limit - len(all_cards))
                all_cards.extend(cards)
                
                # Rate limiting
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"❌ Error searching eBay for '{query}': {e}")
                continue
        
        logger.info(f"✅ Found {len(all_cards)} Pokemon cards on eBay")
        return all_cards
    
    async def _search_query(self, query: str, limit: int) -> List[APICard]:
        """Execute single eBay search query"""
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
        
        params = {
            'q': query,
            'limit': min(limit, 200),  # eBay's max per request
            'sort': 'newlyListed',
            'filter': 'conditionIds:{3000|4000|5000}',  # New, Used, Not Specified
            'category_ids': '2536'  # Trading Cards category
        }
        
        url = f"{self.base_url}/item_summary/search"
        
        async with self.session.get(url, headers=headers, params=params) as response:
            if response.status == 200:
                data = await response.json()
                items = data.get('itemSummaries', [])
                
                cards = []
                for item in items:
                    if self._is_pokemon_card(item):
                        card = self._parse_ebay_item(item)
                        if card:
                            cards.append(card)
                
                return cards
            else:
                logger.warning(f"eBay API error: {response.status}")
                return []
    
    def _is_pokemon_card(self, item: Dict[str, Any]) -> bool:
        """Check if eBay item is a Pokemon card"""
        title = item.get('title', '').lower()
        
        pokemon_keywords = [
            'pokemon', 'pokémon', 'charizard', 'pikachu', 'base set',
            'neo', 'jungle', 'fossil', 'tcg', 'trading card'
        ]
        
        return any(keyword in title for keyword in pokemon_keywords)
    
    def _parse_ebay_item(self, item: Dict[str, Any]) -> Optional[APICard]:
        """Parse eBay item into APICard format"""
        try:
            title = item.get('title', '')
            price_info = item.get('price', {})
            price_value = None
            
            if price_info:
                price_value = float(price_info.get('value', 0))
            
            # Extract condition from title or item specifics
            condition = self._extract_condition(title)
            grade = self._extract_grade(title)
            
            return APICard(
                source='ebay',
                source_id=item.get('itemId', ''),
                title=title,
                price=price_value,
                currency=price_info.get('currency', 'USD') if price_info else 'USD',
                condition=condition,
                grade=grade,
                image_url=item.get('image', {}).get('imageUrl'),
                listing_url=item.get('itemWebUrl'),
                seller=item.get('seller', {}).get('username'),
                listing_type=item.get('buyingOptions', [None])[0] if item.get('buyingOptions') else None,
                end_time=item.get('itemEndDate'),
                phase2_card_key=self._generate_card_key(title)
            )
        except Exception as e:
            logger.debug(f"Error parsing eBay item: {e}")
            return None
    
    def _extract_condition(self, title: str) -> Optional[str]:
        """Extract condition from title"""
        title_lower = title.lower()
        
        conditions = {
            'mint': 'Mint',
            'near mint': 'Near Mint',
            'nm': 'Near Mint',
            'excellent': 'Excellent',
            'very good': 'Very Good',
            'good': 'Good',
            'fair': 'Fair',
            'poor': 'Poor',
            'damaged': 'Damaged'
        }
        
        for key, value in conditions.items():
            if key in title_lower:
                return value
        
        return None
    
    def _extract_grade(self, title: str) -> Optional[str]:
        """Extract grade from title"""
        import re
        
        # PSA grades
        psa_match = re.search(r'psa\s*(\d+(?:\.\d+)?)', title.lower())
        if psa_match:
            return f"PSA {psa_match.group(1)}"
        
        # BGS grades
        bgs_match = re.search(r'bgs\s*(\d+(?:\.\d+)?)', title.lower())
        if bgs_match:
            return f"BGS {bgs_match.group(1)}"
        
        # Generic grades
        grade_match = re.search(r'grade\s*(\d+(?:\.\d+)?)', title.lower())
        if grade_match:
            return f"Grade {grade_match.group(1)}"
        
        return None
    
    def _generate_card_key(self, title: str) -> str:
        """Generate Phase 2 compatible card key"""
        # Simplified card key generation
        # In production, this would use the actual Phase 2 normalization engine
        
        title_lower = title.lower()
        
        # Extract set
        if 'base set' in title_lower:
            set_code = 'base1'
        elif 'jungle' in title_lower:
            set_code = 'jungle'
        elif 'fossil' in title_lower:
            set_code = 'fossil'
        else:
            set_code = 'unknown'
        
        # Extract card number (simplified)
        import re
        num_match = re.search(r'(\d+)/\d+', title)
        card_num = num_match.group(1).zfill(3) if num_match else '000'
        
        # Extract variant
        variant = 'holo' if 'holo' in title_lower else 'normal'
        
        return f"{set_code}-{card_num}-{variant}"


class TCGPlayerAPIIntegrator:
    """TCGPlayer API integration (placeholder for future implementation)"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('TCGPLAYER_API_KEY')
        self.base_url = "https://api.tcgplayer.com/v1"
        
    async def search_pokemon_cards(self, limit: int = 100) -> List[APICard]:
        """Placeholder for TCGPlayer integration"""
        logger.info("🔮 TCGPlayer integration coming in future update")
        return []


class APIAggregator:
    """Aggregates data from multiple API sources"""
    
    def __init__(self):
        self.sources = {}
        self.stats = {
            'total_cards': 0,
            'by_source': {},
            'errors': 0
        }
    
    async def add_ebay_source(self, app_id: str = None, cert_id: str = None):
        """Add eBay as a data source"""
        self.sources['ebay'] = EbayAPIIntegrator(app_id, cert_id)
    
    async def add_tcgplayer_source(self, api_key: str = None):
        """Add TCGPlayer as a data source"""
        self.sources['tcgplayer'] = TCGPlayerAPIIntegrator(api_key)
    
    async def extract_all_cards(self, limit_per_source: int = 200) -> List[APICard]:
        """Extract cards from all configured API sources"""
        logger.info(f"🔄 Starting API extraction from {len(self.sources)} sources...")
        
        all_cards = []
        
        for source_name, integrator in self.sources.items():
            logger.info(f"📡 Processing {source_name}...")
            
            try:
                async with integrator:
                    cards = await integrator.search_pokemon_cards(limit_per_source)
                    all_cards.extend(cards)
                    
                    self.stats['by_source'][source_name] = len(cards)
                    logger.info(f"✅ {source_name}: {len(cards)} cards")
                    
            except Exception as e:
                logger.error(f"❌ Error with {source_name}: {e}")
                self.stats['errors'] += 1
        
        self.stats['total_cards'] = len(all_cards)
        logger.info(f"🏁 API extraction complete: {len(all_cards)} total cards")
        
        return all_cards
    
    def save_api_data(self, cards: List[APICard], output_dir: str = "phase4_data") -> Dict[str, str]:
        """Save API data in PokeDAO format"""
        if not cards:
            return {}
        
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save full API data
        api_file = f"{output_dir}/api_pokemon_cards_{timestamp}.json"
        with open(api_file, 'w', encoding='utf-8') as f:
            json.dump([asdict(card) for card in cards], f, indent=2, ensure_ascii=False)
        
        # Save PokeDAO integration format
        integration_file = f"{output_dir}/api_integration_{timestamp}.json"
        integration_data = {
            "metadata": {
                "extraction_timestamp": timestamp,
                "total_cards": len(cards),
                "data_sources": list(self.stats['by_source'].keys()),
                "statistics": self.stats
            },
            "cards": [
                {
                    "api_source": card.source,
                    "source_id": card.source_id,
                    "phase2_card_key": card.phase2_card_key,
                    "title": card.title,
                    "price_usd": card.price,
                    "condition": card.condition,
                    "grade": card.grade,
                    "listing_url": card.listing_url,
                    "image_url": card.image_url,
                    "quality_score": card.quality_score,
                    "extracted_at": card.extracted_at
                }
                for card in cards
            ]
        }
        
        with open(integration_file, 'w', encoding='utf-8') as f:
            json.dump(integration_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"💾 Saved API data:")
        logger.info(f"   📄 Full data: {api_file}")
        logger.info(f"   🎯 Integration: {integration_file}")
        
        return {
            'api_file': api_file,
            'integration_file': integration_file,
            'total_cards': len(cards)
        }


async def main():
    """Test API integrations"""
    print("🌐 PokeDAO Phase 4 - API Integration Test")
    print("=" * 45)
    
    # Initialize aggregator
    aggregator = APIAggregator()
    
    # Add data sources
    await aggregator.add_ebay_source()
    await aggregator.add_tcgplayer_source()
    
    print(f"📡 Configured sources: {list(aggregator.sources.keys())}")
    
    # Extract cards (small test run)
    cards = await aggregator.extract_all_cards(limit_per_source=50)
    
    if cards:
        print(f"\n✅ API extraction successful!")
        print(f"📊 Total cards found: {len(cards)}")
        print(f"📈 Statistics: {aggregator.stats}")
        
        # Show sample data
        print(f"\n👀 Sample API data:")
        for i, card in enumerate(cards[:3], 1):
            print(f"{i}. {card.title}")
            print(f"   💰 Price: ${card.price or 'N/A'}")
            print(f"   🏷️ Condition: {card.condition or 'N/A'}")
            print(f"   ⭐ Grade: {card.grade or 'N/A'}")
            print(f"   🔗 Source: {card.source}")
            print(f"   🔑 Card Key: {card.phase2_card_key}")
            print()
        
        # Save data
        results = aggregator.save_api_data(cards)
        print(f"💾 Data saved: {results}")
        
    else:
        print("❌ No cards found from API sources")
        print("💡 Check API credentials and connectivity")


if __name__ == "__main__":
    asyncio.run(main())
