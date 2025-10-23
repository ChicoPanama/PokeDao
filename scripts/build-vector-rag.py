#!/usr/bin/env python3
"""
Build Vector RAG for Mew-1A
Phase 1.2: Create vector embeddings for TCG cards database

This script:
1. Extracts card data from SQLite database
2. Creates embeddings using sentence-transformers
3. Stores embeddings in Chroma vector store
4. Enables semantic search for card queries
"""

import sqlite3
import sys
from pathlib import Path
from typing import List, Dict
import chromadb
from chromadb.utils import embedding_functions

# Paths
DB_PATH = Path("research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db")
VECTOR_STORE_PATH = Path("data/vector-store")

def extract_cards_from_db(db_path: str, limit: int = None) -> List[Dict]:
    """Extract card data from database"""
    print(f"📖 Extracting cards from {db_path}...")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Query all cards with pricing data
    query = """
        SELECT DISTINCT
            pokemon_name,
            title,
            sold_price,
            sold_date,
            grading_company,
            grade_number,
            condition_description,
            bid_count,
            listing_url,
            seller_username
        FROM ebay_sold_listings
        WHERE sold_price IS NOT NULL
          AND sold_price > 0
          AND sold_price < 100000  -- Filter errors
        ORDER BY sold_date DESC
    """

    if limit:
        query += f" LIMIT {limit}"

    cursor.execute(query)
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    print(f"✅ Extracted {len(results)} cards")
    return results

def build_vector_store(cards: List[Dict], persist_dir: Path):
    """Build Chroma vector store with embeddings"""
    print("🔮 Building vector store...")

    # Create Chroma client
    persist_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(persist_dir))

    # Create embedding function (sentence-transformers)
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # Delete existing collection if it exists
    try:
        client.delete_collection("tcg_cards")
        print("  Deleted existing collection")
    except:
        pass

    # Create new collection
    collection = client.create_collection(
        name="tcg_cards",
        embedding_function=embedding_fn,
        metadata={"description": "TCG Pokemon card pricing database"}
    )

    # Prepare data for insertion
    print(f"  Creating embeddings for {len(cards)} cards...")
    documents = []
    metadatas = []
    ids = []

    for i, card in enumerate(cards):
        # Build rich text representation for embedding
        name = card.get('pokemon_name') or 'Unknown'
        title = card.get('title') or ''
        price = card.get('sold_price', 0)
        date = card.get('sold_date') or ''
        grade_company = card.get('grading_company') or ''
        grade_num = card.get('grade_number') or ''
        condition = card.get('condition_description') or ''
        bids = card.get('bid_count', 0)

        # Build grade string
        grade_str = ""
        if grade_company and grade_num:
            grade_str = f"{grade_company} {grade_num}"
        elif grade_company:
            grade_str = grade_company
        elif condition:
            grade_str = condition

        # Create rich text for semantic search
        text = f"""Pokemon Card: {name}
Full Title: {title}
Price: ${price:,.2f}
Date Sold: {date}
Grade/Condition: {grade_str}
Bid Count: {bids}"""

        documents.append(text)
        metadatas.append({
            "pokemon_name": name,
            "sold_price": float(price),
            "sold_date": date,
            "grade": grade_str,
            "bid_count": int(bids) if bids else 0,
            "title": title,
        })
        ids.append(f"card_{i}")

    # Insert in batches (Chroma has size limits)
    batch_size = 1000
    total_batches = (len(documents) + batch_size - 1) // batch_size

    for i in range(0, len(documents), batch_size):
        batch_num = (i // batch_size) + 1
        print(f"  Inserting batch {batch_num}/{total_batches}...")

        batch_docs = documents[i:i+batch_size]
        batch_meta = metadatas[i:i+batch_size]
        batch_ids = ids[i:i+batch_size]

        collection.add(
            documents=batch_docs,
            metadatas=batch_meta,
            ids=batch_ids,
        )

    print(f"✅ Vector store built: {collection.count()} cards indexed")
    return collection

def test_semantic_search(persist_dir: Path):
    """Test semantic search on the vector store"""
    print("\n🧪 Testing semantic search...")

    # Load the vector store
    client = chromadb.PersistentClient(path=str(persist_dir))
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    collection = client.get_collection(
        name="tcg_cards",
        embedding_function=embedding_fn
    )

    # Test queries
    test_queries = [
        "What's the price of Charizard cards?",
        "Show me expensive Pikachu cards",
        "Find graded PSA 10 cards",
        "Umbreon VMAX pricing"
    ]

    for query in test_queries:
        print(f"\n📝 Query: '{query}'")
        results = collection.query(
            query_texts=[query],
            n_results=3
        )

        print(f"  Found {len(results['documents'][0])} results:")
        for i, doc in enumerate(results['documents'][0], 1):
            meta = results['metadatas'][0][i-1]
            print(f"  {i}. {meta['pokemon_name']} - ${meta['sold_price']:,.2f}")
            print(f"     Grade: {meta['grade']}, Date: {meta['sold_date']}")

        print("-" * 60)

def main():
    print("=" * 80)
    print("PHASE 1.2: BUILD VECTOR RAG FOR MEW-1A")
    print("=" * 80)
    print()

    # Check database exists
    if not DB_PATH.exists():
        print(f"❌ ERROR: Database not found at {DB_PATH}")
        print("Please ensure the database file exists.")
        sys.exit(1)

    # Step 1: Extract cards
    # Use limit for initial testing, remove for production
    print("🎯 Starting with 10,000 cards for testing...")
    cards = extract_cards_from_db(str(DB_PATH), limit=10000)

    if not cards:
        print("❌ No cards found in database")
        sys.exit(1)

    # Step 2: Build vector store
    collection = build_vector_store(cards, VECTOR_STORE_PATH)

    # Step 3: Test search
    test_semantic_search(VECTOR_STORE_PATH)

    print()
    print("=" * 80)
    print("✅ VECTOR RAG BUILD COMPLETE!")
    print("=" * 80)
    print()
    print(f"📊 Stats:")
    print(f"  • Cards indexed: {collection.count()}")
    print(f"  • Vector store: {VECTOR_STORE_PATH}")
    print(f"  • Embedding model: all-MiniLM-L6-v2 (384 dimensions)")
    print()
    print("🎯 Next Steps:")
    print("  1. Update rag_middleware.py to use vector store")
    print("  2. Add semantic search to Mew-1A inference")
    print("  3. Deploy to Modal Labs")
    print()
    print("💡 To index ALL cards, re-run without the limit parameter")

if __name__ == "__main__":
    main()
