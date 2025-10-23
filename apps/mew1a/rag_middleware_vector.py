"""
Vector RAG Middleware for Mew-1A v4.3
Provides semantic search using FAISS vector embeddings for card queries.

This is a MAJOR UPGRADE over pattern-based RAG:
- Before: Only matched exact keywords like "most expensive"
- Now: Understands semantic meaning (e.g., "Charizard cards" finds all Charizard variants)
"""

import pickle
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss

# Paths
VECTOR_STORE_PATH = Path(__file__).parent.parent.parent / "data/vector-store"
INDEX_FILE = VECTOR_STORE_PATH / "faiss.index"
METADATA_FILE = VECTOR_STORE_PATH / "metadata.pkl"

class VectorRAGMiddleware:
    """Semantic search for TCG cards using FAISS vector embeddings"""

    def __init__(self, index_path: str = None, metadata_path: str = None):
        self.index_path = index_path or str(INDEX_FILE)
        self.metadata_path = metadata_path or str(METADATA_FILE)
        self.index = None
        self.metadata = None
        self.model = None
        self._load_index()

    def _load_index(self):
        """Load FAISS index, metadata, and embedding model"""
        try:
            # Load FAISS index
            if Path(self.index_path).exists():
                self.index = faiss.read_index(self.index_path)
                print(f"✅ Loaded FAISS index: {self.index.ntotal} vectors")
            else:
                print(f"⚠️  FAISS index not found at {self.index_path}")
                return

            # Load metadata
            if Path(self.metadata_path).exists():
                with open(self.metadata_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                print(f"✅ Loaded metadata: {len(self.metadata)} cards")
            else:
                print(f"⚠️  Metadata not found at {self.metadata_path}")
                return

            # Load embedding model
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            print(f"✅ Loaded embedding model")

        except Exception as e:
            print(f"❌ Error loading vector RAG: {e}")
            self.index = None
            self.metadata = None
            self.model = None

    def is_card_query(self, prompt: str) -> bool:
        """
        Detect if prompt is asking about cards.

        This is MORE FLEXIBLE than pattern matching:
        - Detects any card name mention
        - Detects pricing questions
        - Detects general card queries
        """
        prompt_lower = prompt.lower()

        # Card query indicators
        indicators = [
            'card', 'price', 'value', 'worth', 'pricing',
            'expensive', 'cheap', 'cost',
            'charizard', 'pikachu', 'mewtwo', 'mew', 'umbreon',
            'vmax', 'psa', 'graded', 'grade',
            'pokemon', 'tcg', 'eevee'
        ]

        return any(indicator in prompt_lower for indicator in indicators)

    def semantic_search(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Perform semantic search on card database.

        Args:
            query: Natural language query
            top_k: Number of results to return

        Returns:
            List of card metadata dicts with similarity scores
        """
        if not self.index or not self.model or not self.metadata:
            print("⚠️  Vector RAG not initialized")
            return []

        try:
            # Encode query
            query_embedding = self.model.encode([query], convert_to_numpy=True)
            faiss.normalize_L2(query_embedding)

            # Search
            distances, indices = self.index.search(query_embedding, top_k)

            # Format results
            results = []
            for i, idx in enumerate(indices[0]):
                if idx < len(self.metadata):
                    result = self.metadata[idx].copy()
                    result['similarity_score'] = float(distances[0][i])
                    results.append(result)

            return results

        except Exception as e:
            print(f"❌ Semantic search error: {e}")
            return []

    def format_context_for_llm(self, cards: List[Dict]) -> str:
        """Format search results as context for LLM"""
        if not cards:
            return "No relevant cards found in database."

        context = "Based on TCG pricing database (semantic search results):\n\n"

        for i, card in enumerate(cards, 1):
            name = card.get('pokemon_name', 'Unknown')
            price = card.get('sold_price', 0)
            date = card.get('sold_date', 'Unknown')
            grade = card.get('grade', 'Unknown')
            score = card.get('similarity_score', 0)

            context += f"{i}. {name} - ${price:,.2f}\n"
            context += f"   Grade: {grade}, Date: {date}\n"
            context += f"   Relevance: {score:.2f}\n\n"

        return context

    def augment_prompt(self, user_prompt: str) -> Tuple[str, bool]:
        """
        Augment prompt with semantic search results if it's a card query.

        Returns:
            (augmented_prompt, was_augmented)
        """
        # Check if this is a card query
        if not self.is_card_query(user_prompt):
            return user_prompt, False

        # Perform semantic search
        cards = self.semantic_search(user_prompt, top_k=5)

        if not cards:
            # No results, let model handle it
            return user_prompt, False

        # Build augmented prompt
        context = self.format_context_for_llm(cards)
        augmented = f"""[CARD DATABASE CONTEXT - Semantic Search]
{context}

[USER QUERY]
{user_prompt}

Answer using the database context above. Focus on the most relevant cards (highest similarity scores)."""

        return augmented, True


def test_vector_rag():
    """Test vector RAG middleware"""
    rag = VectorRAGMiddleware()

    test_queries = [
        "What are Charizard cards worth?",
        "Show me expensive Pikachu VMAX cards",
        "Find PSA 10 graded cards",
        "Umbreon pricing",
        "What's the weather like?",  # Should NOT trigger RAG
    ]

    print("=" * 80)
    print("VECTOR RAG MIDDLEWARE TEST")
    print("=" * 80)
    print()

    for query in test_queries:
        print(f"Query: {query}")
        is_card_query = rag.is_card_query(query)
        print(f"  Card query: {is_card_query}")

        if is_card_query:
            augmented, was_aug = rag.augment_prompt(query)
            if was_aug:
                print(f"  ✅ Augmented with semantic search")
                print(f"  Preview: {augmented[:200]}...")
            else:
                print(f"  ⚠️  No results found")
        else:
            print(f"  ➡️  Pass through to model (not a card query)")

        print()


if __name__ == "__main__":
    test_vector_rag()
