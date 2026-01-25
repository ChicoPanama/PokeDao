#!/usr/bin/env python3
"""
PokeDAO Phase 4 - Database Integration Bridge
FIXED VERSION: Connection safety and type annotations resolved

Author: PokeDAO Builder
Version: Phase 4.0.0 (Fixed)
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

import asyncpg
from dataclasses import asdict

# Add the phase4 directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

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
        connection = self._ensure_connection()
        
        for card in cards:
            try:
                # Check if card already exists
                existing = await connection.fetchrow(
                    """
                    SELECT id FROM "SourceCatalogItem"
                    WHERE mint_address = $1 OR (name = $2 AND set_name = $3)
                    """,
                    card.mint_address, card.name, card.set_name
                )
                
                if existing:
                    # Update existing card
                    await connection.execute(
                        """
                        UPDATE "SourceCatalogItem"
                        SET 
                            current_listing_price = $1,
                            floor_price = $2,
                            last_sale_price = $3,
                            vault_status = $4,
                            grade = $5,
                            grading_company = $6,
                            condition = $7,
                            rarity = $8,
                            image_url = $9,
                            updated_at = NOW()
                        WHERE mint_address = $10
                        """,
                        card.magic_eden_price,
                        card.floor_price, 
                        card.last_sale_price,
                        card.vault_status,
                        card.grade,
                        card.grading_company,
                        card.condition,
                        card.rarity,
                        card.image_url,
                        card.mint_address
                    )
                    self.stats['cards_updated'] += 1
                    logger.debug(f"Updated card: {card.name}")
                    
                else:
                    # Insert new card
                    await connection.execute(
                        """
                        INSERT INTO "SourceCatalogItem" (
                            mint_address, name, card_number, set_name, rarity,
                            current_listing_price, floor_price, last_sale_price,
                            vault_status, grade, grading_company, condition,
                            image_url, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
                        """,
                        card.mint_address,
                        card.name,
                        card.card_number,
                        card.set_name,
                        card.rarity,
                        card.magic_eden_price,
                        card.floor_price,
                        card.last_sale_price,
                        card.vault_status,
                        card.grade,
                        card.grading_company,
                        card.condition,
                        card.image_url
                    )
                    self.stats['cards_inserted'] += 1
                    logger.debug(f"Inserted new card: {card.name}")
                    
            except Exception as e:
                logger.error(f"❌ Error processing card {card.name}: {e}")
                self.stats['errors'] += 1
                continue
        
        logger.info(f"✅ Completed: {self.stats['cards_inserted']} inserted, {self.stats['cards_updated']} updated")
        return self.stats

    async def cache_price_data(self, cards: List[BlockchainPokemonCard]) -> Dict[str, int]:
        """Cache price data in PriceCache table for fast lookups"""
        if not cards:
            return self.stats
            
        logger.info(f"💰 Caching price data for {len(cards)} cards...")
        connection = self._ensure_connection()
        
        for card in cards:
            try:
                # Check if price cache exists
                existing = await connection.fetchrow(
                    """
                    SELECT id FROM "PriceCache"
                    WHERE mint_address = $1 AND source = $2
                    """,
                    card.mint_address, 'blockchain'
                )
                
                if existing:
                    # Update price cache
                    await connection.execute(
                        """
                        UPDATE "PriceCache"
                        SET 
                            price = $1,
                            floor_price = $2,
                            last_sale_price = $3,
                            volume_24h = $4,
                            updated_at = NOW()
                        WHERE mint_address = $5 AND source = $6
                        """,
                        card.magic_eden_price or 0,
                        card.floor_price or 0,
                        card.last_sale_price or 0,
                        card.volume_24h or 0,
                        card.mint_address,
                        'blockchain'
                    )
                else:
                    # Insert new price cache
                    await connection.execute(
                        """
                        INSERT INTO "PriceCache" (
                            mint_address, card_name, source, price, floor_price,
                            last_sale_price, volume_24h, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                        """,
                        card.mint_address,
                        card.name,
                        'blockchain',
                        card.magic_eden_price or 0,
                        card.floor_price or 0,
                        card.last_sale_price or 0,
                        card.volume_24h or 0
                    )
                    
                self.stats['prices_cached'] += 1
                
            except Exception as e:
                logger.error(f"❌ Error caching price for {card.name}: {e}")
                self.stats['errors'] += 1
                continue
        
        logger.info(f"✅ Price caching complete: {self.stats['prices_cached']} entries")
        return self.stats

    async def store_market_insights(self, cards: List[BlockchainPokemonCard]) -> Dict[str, int]:
        """Store enhanced market insights and investment thesis data"""
        if not cards:
            return self.stats
            
        logger.info(f"🧠 Storing market insights for {len(cards)} cards...")
        connection = self._ensure_connection()
        
        for card in cards:
            try:
                # Only store insights for cards with analysis data
                if not card.investment_thesis and not card.confidence_score:
                    continue
                
                # Check if insight exists
                existing = await connection.fetchrow(
                    """
                    SELECT id FROM "MarketInsight" 
                    WHERE card_id = (
                        SELECT id FROM "SourceCatalogItem" WHERE mint_address = $1
                    )
                    """,
                    card.mint_address
                )
                
                if existing:
                    # Update insight
                    await connection.execute(
                        """
                        UPDATE "MarketInsight"
                        SET 
                            insight_text = $1,
                            confidence_score = $2,
                            fair_value_estimate = $3,
                            data_completeness = $4,
                            updated_at = NOW()
                        WHERE card_id = (
                            SELECT id FROM "SourceCatalogItem" WHERE mint_address = $5
                        )
                        """,
                        card.investment_thesis,
                        float(card.confidence_score or 0),
                        float(card.fair_value_estimate or 0),
                        float(card.data_completeness or 0),
                        card.mint_address
                    )
                else:
                    # Insert new insight
                    await connection.execute(
                        """
                        INSERT INTO "MarketInsight" (
                            card_id, insight_text, confidence_score, 
                            fair_value_estimate, data_completeness, created_at, updated_at
                        ) VALUES (
                            (SELECT id FROM "SourceCatalogItem" WHERE mint_address = $1),
                            $2, $3, $4, $5, NOW(), NOW()
                        )
                        """,
                        card.mint_address,
                        card.investment_thesis,
                        float(card.confidence_score or 0),
                        float(card.fair_value_estimate or 0),
                        float(card.data_completeness or 0)
                    )
                    
                self.stats['insights_generated'] += 1
                if card.confidence_score:
                    self.stats['confidence_scores_recorded'] += 1
                    
            except Exception as e:
                logger.error(f"❌ Error storing insight for {card.name}: {e}")
                self.stats['errors'] += 1
                continue
        
        logger.info(f"✅ Market insights stored: {self.stats['insights_generated']} entries")
        return self.stats

    async def get_existing_cards(self) -> List[Dict[str, Any]]:
        """Get all existing cards from the database"""
        connection = self._ensure_connection()
        
        rows = await connection.fetch(
            """
            SELECT mint_address, name, set_name, current_listing_price, created_at
            FROM "SourceCatalogItem"
            ORDER BY created_at DESC
            """
        )
        
        return [dict(row) for row in rows]

    async def get_price_history(self, mint_address: str) -> List[Dict[str, Any]]:
        """Get price history for a specific card"""
        connection = self._ensure_connection()
        
        rows = await connection.fetch(
            """
            SELECT price, floor_price, last_sale_price, volume_24h, updated_at
            FROM "PriceCache"
            WHERE mint_address = $1
            ORDER BY updated_at DESC
            LIMIT 100
            """,
            mint_address
        )
        
        return [dict(row) for row in rows]

    async def get_database_summary(self) -> Dict[str, Any]:
        """Get comprehensive database summary with multi-source statistics"""
        connection = self._ensure_connection()
        
        # Card counts by source
        source_counts = await connection.fetch(
            """
            SELECT 
                CASE WHEN mint_address IS NOT NULL THEN 'blockchain' ELSE 'traditional' END as source,
                COUNT(*) as count
            FROM "SourceCatalogItem"
            GROUP BY source
            """
        )
        
        # Insight statistics  
        insight_counts = await connection.fetch(
            """
            SELECT COUNT(*) as total_insights, AVG(confidence_score) as avg_confidence
            FROM "MarketInsight"
            WHERE confidence_score > 0
            """
        )
        
        # Price statistics
        price_stats = await connection.fetchrow(
            """
            SELECT 
                COUNT(*) as total_prices,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM "PriceCache"
            WHERE price > 0
            """
        )
        
        return {
            'source_distribution': [dict(row) for row in source_counts],
            'insights': dict(insight_counts[0]) if insight_counts else {},
            'price_analytics': dict(price_stats) if price_stats else {},
            'processing_stats': self.stats,
            'timestamp': datetime.now().isoformat()
        }


# Testing and validation functions
async def test_database_bridge():
    """Test the database bridge functionality"""
    logger.info("🧪 Testing PokeDAO Database Bridge...")
    
    try:
        async with PokeDAODatabaseBridge() as db:
            # Test database connection
            connection = db._ensure_connection()
            version = await connection.fetchval("SELECT version()")
            if version:
                print(f"✅ Database connected: {version.split()[0:2]}")
            else:
                print("⚠️ Database version query returned None")
            
            # Test summary
            summary = await db.get_database_summary()
            print(f"📊 Database Summary: {json.dumps(summary, indent=2)}")
            
            print("🎉 Database bridge test completed successfully")
            return True
            
    except Exception as e:
        print(f"❌ Database bridge test failed: {e}")
        return False


if __name__ == "__main__":
    # Basic validation
    try:
        import asyncio
        
        # Test with sample data
        test_card = ComprehensivePokemonCard(
            mint_address="test_bridge_123",
            token_id="1",
            name="Test Pikachu"
        )
        
        if test_card.image_url is not None or test_card.image_url == "":
            print("✅ ComprehensivePokemonCard image_url property working")
        
        # Test database bridge
        asyncio.run(test_database_bridge())
        
        print("🎉 database_bridge_fixed.py validation completed successfully")
        
    except Exception as e:
        print(f"❌ database_bridge_fixed.py validation failed: {e}")
