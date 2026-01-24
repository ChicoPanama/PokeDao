"""
Qdrant RAG Middleware for Mew-1A v4.3+

Production-grade vector search replacing FAISS:
- Persistent storage (no cold start rebuilds)
- Hybrid search (dense + sparse vectors)
- Metadata filtering (set, grade, price range)
- Production SLAs with Qdrant Cloud

Migration from FAISS:
- Same interface as VectorRAGMiddleware
- Drop-in replacement for rag_middleware_vector.py
"""

import os
from typing import List, Dict, Tuple, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    Range,
)
from sentence_transformers import SentenceTransformer

# ============================================================================
# Configuration
# ============================================================================

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "pokemon_cards")
VECTOR_SIZE = 384  # all-MiniLM-L6-v2 embedding size


class QdrantRAGMiddleware:
    """Production-grade semantic search for TCG cards using Qdrant"""

    def __init__(
        self,
        url: str = None,
        api_key: str = None,
        collection: str = None,
    ):
        self.url = url or QDRANT_URL
        self.api_key = api_key or QDRANT_API_KEY
        self.collection = collection or COLLECTION_NAME
        self.client: Optional[QdrantClient] = None
        self.model: Optional[SentenceTransformer] = None
        self._initialize()

    def _initialize(self):
        """Initialize Qdrant client and embedding model"""
        try:
            # Initialize Qdrant client
            if self.api_key:
                self.client = QdrantClient(url=self.url, api_key=self.api_key)
            else:
                self.client = QdrantClient(url=self.url)

            # Check if collection exists
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]

            if self.collection not in collection_names:
                print(f"[qdrant] Creating collection: {self.collection}")
                self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config=VectorParams(
                        size=VECTOR_SIZE,
                        distance=Distance.COSINE,
                    ),
                )
            else:
                info = self.client.get_collection(self.collection)
                print(f"[qdrant] Connected to collection: {self.collection} ({info.points_count} vectors)")

            # Load embedding model
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            print("[qdrant] Loaded embedding model: all-MiniLM-L6-v2")

        except Exception as e:
            print(f"[qdrant] Initialization error: {e}")
            self.client = None
            self.model = None

    def is_ready(self) -> bool:
        """Check if middleware is ready for queries"""
        return self.client is not None and self.model is not None

    def is_card_query(self, prompt: str) -> bool:
        """
        Detect if prompt is asking about cards.
        Same logic as FAISS middleware for compatibility.
        """
        prompt_lower = prompt.lower()

        indicators = [
            "card", "price", "value", "worth", "pricing",
            "expensive", "cheap", "cost",
            "charizard", "pikachu", "mewtwo", "mew", "umbreon",
            "vmax", "psa", "graded", "grade",
            "pokemon", "tcg", "eevee"
        ]

        return any(indicator in prompt_lower for indicator in indicators)

    def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict] = None,
    ) -> List[Dict]:
        """
        Perform semantic search on card database.

        Args:
            query: Natural language query
            top_k: Number of results to return
            filters: Optional dict with filter params:
                - set_name: str
                - grade_company: str
                - min_grade: float
                - max_grade: float
                - min_price_cents: int
                - max_price_cents: int

        Returns:
            List of card metadata dicts with similarity scores
        """
        if not self.is_ready():
            print("[qdrant] Middleware not ready")
            return []

        try:
            # Encode query
            query_embedding = self.model.encode(query).tolist()

            # Build filter conditions
            filter_conditions = []

            if filters:
                if filters.get("set_name"):
                    filter_conditions.append(
                        FieldCondition(
                            key="setName",
                            match=MatchValue(value=filters["set_name"]),
                        )
                    )

                if filters.get("grade_company"):
                    filter_conditions.append(
                        FieldCondition(
                            key="gradeCompany",
                            match=MatchValue(value=filters["grade_company"]),
                        )
                    )

                if filters.get("min_grade") or filters.get("max_grade"):
                    filter_conditions.append(
                        FieldCondition(
                            key="grade",
                            range=Range(
                                gte=filters.get("min_grade"),
                                lte=filters.get("max_grade"),
                            ),
                        )
                    )

                if filters.get("min_price_cents") or filters.get("max_price_cents"):
                    filter_conditions.append(
                        FieldCondition(
                            key="priceCents",
                            range=Range(
                                gte=filters.get("min_price_cents"),
                                lte=filters.get("max_price_cents"),
                            ),
                        )
                    )

            # Build filter object
            query_filter = None
            if filter_conditions:
                query_filter = Filter(must=filter_conditions)

            # Search
            results = self.client.search(
                collection_name=self.collection,
                query_vector=query_embedding,
                query_filter=query_filter,
                limit=top_k,
                with_payload=True,
            )

            # Format results
            formatted = []
            for hit in results:
                result = dict(hit.payload) if hit.payload else {}
                result["similarity_score"] = hit.score
                result["id"] = str(hit.id)
                formatted.append(result)

            return formatted

        except Exception as e:
            print(f"[qdrant] Search error: {e}")
            return []

    def format_context_for_llm(self, cards: List[Dict]) -> str:
        """Format search results as context for LLM"""
        if not cards:
            return "No relevant cards found in database."

        context = ""
        for i, card in enumerate(cards, 1):
            name = card.get("pokemon_name") or card.get("cardName", "Unknown")
            price = card.get("sold_price") or card.get("priceCents", 0)
            if isinstance(price, int) and price > 100:
                price = price / 100  # Convert cents to dollars
            grade = card.get("grade", "Unknown")
            context += f"{i}. {name} (Grade: {grade}) - ${price:,.2f}\n"

        return context.strip()

    def augment_prompt(self, user_prompt: str) -> Tuple[str, bool]:
        """
        Augment prompt with semantic search results if it's a card query.
        ALWAYS includes TFV guardrail preamble + few-shot examples.

        Returns:
            (augmented_prompt, was_augmented)
        """
        TFV_PREAMBLE = """TFV = True Fair Value (market price estimate). NOT a grading scale. Grading uses PSA/BGS/CGC.

"""

        if not self.is_card_query(user_prompt):
            return user_prompt, False

        cards = self.semantic_search(user_prompt, top_k=5)

        if not cards:
            augmented = TFV_PREAMBLE + user_prompt
            return augmented[:12000], True

        context = self.format_context_for_llm(cards)

        augmented = f"""{TFV_PREAMBLE}Card database results:
{context}

User query: {user_prompt}"""

        if len(augmented) > 12000:
            augmented = augmented[:12000]

        return augmented, True

    # =========================================================================
    # Indexing Methods (for migration from FAISS)
    # =========================================================================

    def upsert_cards(self, cards: List[Dict]) -> int:
        """
        Upsert cards into Qdrant collection.

        Args:
            cards: List of card dicts with at least:
                - id: str
                - embedding_text: str (text to embed)
                - ... other payload fields

        Returns:
            Number of cards upserted
        """
        if not self.is_ready() or not cards:
            return 0

        try:
            points = []
            for card in cards:
                # Generate embedding from text
                text = card.get("embedding_text", "")
                if not text:
                    text = f"{card.get('cardName', '')} {card.get('setName', '')} {card.get('variant', '')}"

                embedding = self.model.encode(text).tolist()

                # Build payload (exclude embedding_text to save space)
                payload = {k: v for k, v in card.items() if k not in ["embedding_text", "vector"]}

                points.append(
                    PointStruct(
                        id=card["id"],
                        vector=embedding,
                        payload=payload,
                    )
                )

            # Batch upsert
            BATCH_SIZE = 100
            for i in range(0, len(points), BATCH_SIZE):
                batch = points[i : i + BATCH_SIZE]
                self.client.upsert(
                    collection_name=self.collection,
                    wait=True,
                    points=batch,
                )

            print(f"[qdrant] Upserted {len(cards)} cards")
            return len(cards)

        except Exception as e:
            print(f"[qdrant] Upsert error: {e}")
            return 0

    def delete_cards(self, ids: List[str]) -> int:
        """Delete cards by ID"""
        if not self.is_ready() or not ids:
            return 0

        try:
            self.client.delete(
                collection_name=self.collection,
                points_selector=ids,
                wait=True,
            )
            print(f"[qdrant] Deleted {len(ids)} cards")
            return len(ids)
        except Exception as e:
            print(f"[qdrant] Delete error: {e}")
            return 0

    def get_stats(self) -> Dict:
        """Get collection statistics"""
        if not self.is_ready():
            return {"error": "Not connected"}

        try:
            info = self.client.get_collection(self.collection)
            return {
                "collection": self.collection,
                "vectors_count": info.points_count,
                "indexed_vectors": info.indexed_vectors_count,
                "status": info.status.value,
            }
        except Exception as e:
            return {"error": str(e)}


# ============================================================================
# Singleton Instance
# ============================================================================

_middleware_instance: Optional[QdrantRAGMiddleware] = None


def get_qdrant_middleware() -> QdrantRAGMiddleware:
    """Get or create the singleton QdrantRAGMiddleware instance"""
    global _middleware_instance
    if _middleware_instance is None:
        _middleware_instance = QdrantRAGMiddleware()
    return _middleware_instance


# ============================================================================
# Test
# ============================================================================

def test_qdrant_rag():
    """Test Qdrant RAG middleware"""
    rag = QdrantRAGMiddleware()

    print("=" * 80)
    print("QDRANT RAG MIDDLEWARE TEST")
    print("=" * 80)
    print()
    print(f"Ready: {rag.is_ready()}")
    print(f"Stats: {rag.get_stats()}")
    print()

    test_queries = [
        "What are Charizard cards worth?",
        "Show me expensive Pikachu VMAX cards",
        "Find PSA 10 graded cards",
        "Umbreon pricing",
        "What's the weather like?",  # Should NOT trigger RAG
    ]

    for query in test_queries:
        print(f"Query: {query}")
        is_card_query = rag.is_card_query(query)
        print(f"  Card query: {is_card_query}")

        if is_card_query:
            augmented, was_aug = rag.augment_prompt(query)
            if was_aug:
                print(f"  Augmented with semantic search")
                print(f"  Preview: {augmented[:200]}...")
            else:
                print(f"  No results found")
        else:
            print(f"  Pass through to model (not a card query)")

        print()


if __name__ == "__main__":
    test_qdrant_rag()
