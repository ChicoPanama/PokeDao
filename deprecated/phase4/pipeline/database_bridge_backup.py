#!/usr/bin/env python3
"""
PokeDAO Phase 4 - Database Integration Bridge
Connects blockchain data with Phase 1 Prisma database schema

Author: PokeDAO Builder
Version: Phase 4.0.0
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

import asyncpg
from dataclasses import asdict

from blockchain.solana_extractor import ComprehensivePokemonCard

# Backward compatibility
BlockchainPokemonCard = ComprehensivePokemonCard

logger = logging.getLogger(__name__)


class PokeDAODatabaseBridge:
    """Enhanced bridge for multi-source Pokemon card data to PokeDAO Phase 1 database schema"""
    
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or os.getenv(
            'DATABASE_URL',
            'postgresql://postgres:password@localhost:5432/pokedao'
        )
        self.connection: Optional[asyncpg.Connection] = None
        
        # Enhanced statistics for multi-source tracking
        self.stats = {
            'cards_inserted': 0,
            'cards_updated': 0,
            'prices_cached': 0,
            'insights_generated': 0,
            'multi_source_cards': 0,
            'confidence_scores_recorded': 0,
            'errors': 0
        }
    
    async def connect(self):
        """Connect to the database"""
        try:
            self.connection = await asyncpg.connect(self.database_url)
            logger.info("✅ Connected to PokeDAO database")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from database"""
        if self.connection:
            await self.connection.close()
            logger.info("🔌 Disconnected from database")

    def _ensure_connection(self):
        """Ensure database connection is available"""
        if self.connection is None:
            raise RuntimeError("Database not connected. Use 'async with' context manager or call connect() first.")
        return self.connection
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()
    
    async def insert_blockchain_cards(self, cards: List[BlockchainPokemonCard]) -> Dict[str, int]:
        """Insert blockchain cards into SourceCatalogItem table"""
        if not cards:
            return self.stats
        
        logger.info(f"📥 Inserting {len(cards)} blockchain cards into database...")
        
        for card in cards:
            try:
                await self._insert_source_catalog_item(card)
                await self._cache_price_data(card)
                await self._generate_model_insight(card)
                
                self.stats['cards_inserted'] += 1
                
            except Exception as e:
                logger.error(f"❌ Error inserting card {card.name}: {e}")
                self.stats['errors'] += 1
                continue
        
        logger.info(f"✅ Database insertion complete: {self.stats}")
        return self.stats
    
    async def _insert_source_catalog_item(self, card: BlockchainPokemonCard):
        """Insert card as SourceCatalogItem"""
        
        # Check if item already exists
        existing = await self.connection.fetchrow(
            """
            SELECT id FROM "SourceCatalogItem" 
            WHERE source = $1 AND "sourceItemId" = $2
            """,
            'solana_blockchain',
            card.mint_address
        )
        
        if existing:
            # Update existing record
            await self.connection.execute(
                """
                UPDATE "SourceCatalogItem" 
                SET 
                    title = $3,
                    "cardKey" = $4,
                    "imageUrl" = $5,
                    "updatedAt" = $6
                WHERE source = $1 AND "sourceItemId" = $2
                """,
                'solana_blockchain',
                card.mint_address,
                card.name,
                card.phase2_card_key,
                card.image_url,
                datetime.now()
            )
            self.stats['cards_updated'] += 1
        else:
            # Insert new record
            await self.connection.execute(
                """
                INSERT INTO "SourceCatalogItem" 
                (id, source, "sourceItemId", title, "cardKey", "imageUrl", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                f"blockchain_{card.mint_address[:16]}",  # Unique ID
                'solana_blockchain',
                card.mint_address,
                card.name,
                card.phase2_card_key,
                card.image_url,
                datetime.now(),
                datetime.now()
            )
    
    async def _cache_price_data(self, card: BlockchainPokemonCard):
        """Cache price data in PriceCache table"""
        if not card.current_listing_price or not card.phase2_card_key:
            return
        
        # Convert SOL to USD (rough estimate)
        price_usd = card.current_listing_price * 20  # ~20 USD per SOL
        
        # Check if price cache entry exists for this card and window
        existing = await self.connection.fetchrow(
            """
            SELECT id FROM "PriceCache"
            WHERE "cardKey" = $1 AND "windowDays" = $2
            """,
            card.phase2_card_key,
            1  # 1-day window for real-time data
        )
        
        if existing:
            # Update existing cache
            await self.connection.execute(
                """
                UPDATE "PriceCache"
                SET 
                    median = $3,
                    "updatedAt" = $4
                WHERE "cardKey" = $1 AND "windowDays" = $2
                """,
                card.phase2_card_key,
                1,
                Decimal(str(price_usd)),
                datetime.now()
            )
        else:
            # Insert new cache entry
            await self.connection.execute(
                """
                INSERT INTO "PriceCache"
                (id, "cardKey", "windowDays", median, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                f"cache_{card.phase2_card_key}_1d",
                card.phase2_card_key,
                1,
                Decimal(str(price_usd)),
                datetime.now(),
                datetime.now()
            )
        
        self.stats['prices_cached'] += 1
    
    async def _generate_model_insight(self, card: BlockchainPokemonCard):
        """Generate ModelInsight based on investment thesis"""
        if not card.phase2_card_key or not card.investment_thesis:
            return
        
        # Parse investment thesis to determine verdict
        thesis_lower = card.investment_thesis.lower()
        
        if 'strong buy' in thesis_lower or 'undervalued' in thesis_lower:
            verdict = 'BUY'
            confidence = 0.9
        elif 'buy' in thesis_lower:
            verdict = 'BUY'
            confidence = 0.7
        elif 'overvalued' in thesis_lower:
            verdict = 'AVOID'
            confidence = 0.8
        elif 'fairly priced' in thesis_lower or 'fair value' in thesis_lower:
            verdict = 'WATCH'
            confidence = 0.6
        else:
            verdict = 'WATCH'
            confidence = 0.5
        
        # Fair value in USD
        fair_value_usd = None
        if card.fair_value_estimate:
            fair_value_usd = Decimal(str(card.fair_value_estimate * 20))
        
        # Check if insight already exists
        existing = await self.connection.fetchrow(
            """
            SELECT id FROM "ModelInsight"
            WHERE "cardKey" = $1 AND source = $2
            """,
            card.phase2_card_key,
            'blockchain_analysis'
        )
        
        if existing:
            # Update existing insight
            await self.connection.execute(
                """
                UPDATE "ModelInsight"
                SET 
                    verdict = $3,
                    "fairValue" = $4,
                    confidence = $5,
                    reasoning = $6,
                    "updatedAt" = $7
                WHERE "cardKey" = $1 AND source = $2
                """,
                card.phase2_card_key,
                'blockchain_analysis',
                verdict,
                fair_value_usd,
                confidence,
                card.investment_thesis,
                datetime.now()
            )
        else:
            # Insert new insight
            await self.connection.execute(
                """
                INSERT INTO "ModelInsight"
                (id, "cardKey", source, verdict, "fairValue", confidence, reasoning, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                f"insight_{card.phase2_card_key}_blockchain",
                card.phase2_card_key,
                'blockchain_analysis',
                verdict,
                fair_value_usd,
                confidence,
                card.investment_thesis,
                datetime.now(),
                datetime.now()
            )
        
        self.stats['insights_generated'] += 1
    
    async def get_existing_cards(self, source: str = 'solana_blockchain') -> List[Dict[str, Any]]:
        """Get existing cards from database"""
        rows = await self.connection.fetch(
            """
            SELECT "sourceItemId", title, "cardKey", "updatedAt"
            FROM "SourceCatalogItem"
            WHERE source = $1
            ORDER BY "updatedAt" DESC
            """,
            source
        )
        
        return [dict(row) for row in rows]
    
    async def get_investment_opportunities(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top investment opportunities from database"""
        rows = await self.connection.fetch(
            """
            SELECT 
                sci.title,
                sci."cardKey",
                mi.verdict,
                mi."fairValue",
                mi.confidence,
                mi.reasoning,
                pc.median as current_price,
                sci."imageUrl",
                sci."sourceItemId"
            FROM "ModelInsight" mi
            JOIN "SourceCatalogItem" sci ON mi."cardKey" = sci."cardKey"
            LEFT JOIN "PriceCache" pc ON mi."cardKey" = pc."cardKey" AND pc."windowDays" = 1
            WHERE mi.verdict = 'BUY' AND mi.source = 'blockchain_analysis'
            ORDER BY mi.confidence DESC, mi."updatedAt" DESC
            LIMIT $1
            """,
            limit
        )
        
        return [dict(row) for row in rows]
    
    async def create_phase4_summary(self) -> Dict[str, Any]:
        """Create Phase 4 integration summary"""
        
        # Count records by source
        source_counts = await self.connection.fetch(
            """
            SELECT source, COUNT(*) as count
            FROM "SourceCatalogItem"
            GROUP BY source
            """
        )
        
        # Count insights by verdict
        insight_counts = await self.connection.fetch(
            """
            SELECT verdict, COUNT(*) as count
            FROM "ModelInsight"
            WHERE source = 'blockchain_analysis'
            GROUP BY verdict
            """
        )
        
        # Get price range
        price_stats = await self.connection.fetchrow(
            """
            SELECT 
                MIN(median) as min_price,
                MAX(median) as max_price,
                AVG(median) as avg_price,
                COUNT(*) as price_count
            FROM "PriceCache"
            WHERE "windowDays" = 1
            """
        )
        
        return {
            'extraction_stats': self.stats,
            'source_distribution': [dict(row) for row in source_counts],
            'insight_distribution': [dict(row) for row in insight_counts],
            'price_statistics': dict(price_stats) if price_stats else {},
            'timestamp': datetime.now().isoformat()
        }


async def main():
    """Test the database integration"""
    print("🗄️ PokeDAO Phase 4 - Database Integration Test")
    print("=" * 50)
    
    async with PokeDAODatabaseBridge() as db:
        try:
            # Test database connection
            version = await db.connection.fetchval("SELECT version()")
            print(f"✅ Database connected: {version.split()[0:2]}")
            
            # Get existing data
            existing_cards = await db.get_existing_cards()
            print(f"📊 Existing blockchain cards: {len(existing_cards)}")
            
            # Get investment opportunities
            opportunities = await db.get_investment_opportunities(5)
            print(f"💎 Current investment opportunities: {len(opportunities)}")
            
            for i, opp in enumerate(opportunities, 1):
                print(f"{i}. {opp['title']}")
                print(f"   Verdict: {opp['verdict']} (confidence: {opp['confidence']:.1%})")
                print(f"   Fair Value: ${opp['fairValue'] or 'N/A'}")
                print(f"   Current Price: ${opp['current_price'] or 'N/A'}")
                print()
            
            # Create summary
            summary = await db.create_phase4_summary()
            print(f"📈 Phase 4 Integration Summary:")
            print(json.dumps(summary, indent=2, default=str))
            
        except Exception as e:
            print(f"❌ Database test failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
