"""
RAG Middleware for Mew-1A v4.2
Provides database-grounded factual responses for general knowledge queries.
"""

import sqlite3
import re
from typing import Optional, List, Dict, Tuple
from pathlib import Path

# Database path (relative to Modal container)
DB_PATH = Path(__file__).parent.parent.parent / "research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db"


class RAGMiddleware:
    """Detects factual queries and retrieves database context"""

    # Patterns that indicate factual/database queries
    FACTUAL_PATTERNS = [
        r'most expensive',
        r'highest price',
        r'top \d+',
        r'historically',
        r'all[ -]time',
        r'ever sold',
        r'price record',
        r'biggest sale',
    ]

    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(DB_PATH)

    def is_factual_query(self, prompt: str) -> bool:
        """Detect if prompt is asking for factual database information"""
        prompt_lower = prompt.lower()
        return any(re.search(pattern, prompt_lower) for pattern in self.FACTUAL_PATTERNS)

    def get_most_expensive_cards(self, limit: int = 10) -> List[Dict]:
        """Query top N most expensive cards from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = """
                SELECT
                    pokemon_name,
                    title,
                    sold_price,
                    sold_date,
                    grading_company,
                    grade_number,
                    condition_description,
                    bid_count
                FROM ebay_sold_listings
                WHERE sold_price IS NOT NULL
                  AND sold_price < 100000  -- Filter out data errors (prices > $100k likely corrupt)
                ORDER BY sold_price DESC
                LIMIT ?
            """

            cursor.execute(query, (limit,))
            results = [dict(row) for row in cursor.fetchall()]
            conn.close()

            return results
        except Exception as e:
            print(f"RAG query error: {e}")
            return []

    def format_context_for_llm(self, cards: List[Dict]) -> str:
        """Format database results as context for LLM"""
        if not cards:
            return "No data available."

        context = "Based on eBay sales data, here are the most expensive Pokemon cards sold:\n\n"

        for i, card in enumerate(cards, 1):
            name = card.get('pokemon_name') or 'Unknown'
            title = card.get('title') or 'Unknown Card'
            price = card.get('sold_price', 0)
            date = card.get('sold_date') or 'Unknown date'
            grade_company = card.get('grading_company')
            grade_num = card.get('grade_number')
            condition = card.get('condition_description')

            # Build grade string
            grade_str = ""
            if grade_company and grade_num:
                grade_str = f" ({grade_company} {grade_num})"
            elif grade_company:
                grade_str = f" ({grade_company})"
            elif condition:
                grade_str = f" ({condition})"

            context += f"{i}. {name} - {title}{grade_str}\n"
            context += f"   Sold for: ${price:,.2f} on {date}\n\n"

        return context

    def augment_prompt(self, user_prompt: str) -> Tuple[str, bool]:
        """
        Augment prompt with database context if it's a factual query.

        Returns:
            (augmented_prompt, was_augmented)
        """
        if not self.is_factual_query(user_prompt):
            return user_prompt, False

        # Query database
        cards = self.get_most_expensive_cards(limit=10)

        if not cards:
            # No data available, let model handle it
            return user_prompt, False

        # Build augmented prompt
        context = self.format_context_for_llm(cards)
        augmented = f"""[DATABASE CONTEXT]
{context}

[USER QUERY]
{user_prompt}

Answer the user's query using ONLY the database context provided above. Do not make up prices or details not in the data."""

        return augmented, True


def test_rag():
    """Test RAG middleware locally"""
    rag = RAGMiddleware()

    test_queries = [
        "What are the most expensive Pokemon cards sold on eBay historically?",
        "Analyze: Charizard ex - Obsidian Flames. Listed $45",
        "Show me top 5 biggest sales all-time",
        "What's the market trend for Umbreon VMAX?"
    ]

    print("RAG Middleware Test\n" + "="*60 + "\n")

    for query in test_queries:
        print(f"Query: {query}")
        is_factual = rag.is_factual_query(query)
        print(f"  Factual query: {is_factual}")

        if is_factual:
            augmented, was_aug = rag.augment_prompt(query)
            print(f"  Augmented: Yes")
            print(f"  Context preview: {augmented[:200]}...")
        else:
            print(f"  Augmented: No (pass through to model)")

        print()


if __name__ == "__main__":
    test_rag()
