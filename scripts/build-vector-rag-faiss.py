#!/usr/bin/env python3
"""
Build Vector RAG for Mew-1A using FAISS
Phase 1.2: Create vector embeddings for TCG cards database

This script:
1. Extracts card data from SQLite database
2. Creates embeddings using sentence-transformers
3. Stores embeddings in FAISS vector index
4. Enables semantic search for card queries
"""

import sqlite3
import sys
import pickle
import json
from pathlib import Path
from typing import List, Dict
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss

# Paths
DB_PATH = Path("research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db")
VECTOR_STORE_PATH = Path("data/vector-store")
INDEX_FILE = VECTOR_STORE_PATH / "faiss.index"
METADATA_FILE = VECTOR_STORE_PATH / "metadata.pkl"
CARDS_FILE = VECTOR_STORE_PATH / "cards.json"

def extract_cards_from_db(db_path: str, limit: int = None) -> List[Dict]:
    """Extract card data from BOTH sold and current listings"""
    print(f"📖 Extracting cards from {db_path}...")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Query BOTH sold listings AND current listings
    query = """
        SELECT DISTINCT
            pokemon_name,
            title,
            sold_price as price,
            sold_date as date,
            grading_company,
            grade_number,
            condition_description,
            bid_count,
            'sold' as listing_type
        FROM ebay_sold_listings
        WHERE sold_price IS NOT NULL
          AND sold_price > 0
          AND sold_price < 100000  -- Filter errors

        UNION ALL

        SELECT DISTINCT
            pokemon_name,
            title,
            current_price as price,
            created_at as date,
            grading_company,
            grade_number,
            condition_description,
            NULL as bid_count,
            'current' as listing_type
        FROM ebay_current_listings
        WHERE current_price IS NOT NULL
          AND current_price > 0
          AND current_price < 100000  -- Filter errors

        ORDER BY date DESC
    """

    if limit:
        query += f" LIMIT {limit}"

    print("  Querying sold listings...")
    print("  Querying current listings...")
    cursor.execute(query)
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    print(f"✅ Extracted {len(results):,} total cards (sold + current)")
    return results

def build_vector_index(cards: List[Dict], persist_dir: Path):
    """Build FAISS vector index with embeddings"""
    print("🔮 Building vector index with FAISS...")

    # Create persist directory
    persist_dir.mkdir(parents=True, exist_ok=True)

    # Initialize embedding model
    print("  Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # Prepare texts and metadata
    print(f"  Creating embeddings for {len(cards)} cards...")
    texts = []
    metadata = []

    for card in cards:
        # Build rich text representation for embedding
        name = card.get('pokemon_name') or 'Unknown'
        title = card.get('title') or ''
        price = card.get('price', 0)  # Now unified field
        date = card.get('date') or ''  # Now unified field
        grade_company = card.get('grading_company') or ''
        grade_num = card.get('grade_number') or ''
        condition = card.get('condition_description') or ''
        bids = card.get('bid_count', 0)
        listing_type = card.get('listing_type', 'unknown')

        # Build grade string
        grade_str = ""
        if grade_company and grade_num:
            grade_str = f"{grade_company} {grade_num}"
        elif grade_company:
            grade_str = grade_company
        elif condition:
            grade_str = condition

        # Create rich text for semantic search
        text = f"""Pokemon: {name}
Title: {title}
Price: ${price:,.2f}
Date: {date}
Grade: {grade_str}
Bids: {bids}"""

        texts.append(text)
        metadata.append({
            "pokemon_name": name,
            "price": float(price),
            "date": date,
            "listing_type": listing_type,
            "grade": grade_str,
            "bid_count": int(bids) if bids else 0,
            "title": title,
        })

    # Generate embeddings (384 dimensions for all-MiniLM-L6-v2)
    print("  Encoding texts to embeddings...")
    embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    print(f"  Generated embeddings: {embeddings.shape}")

    # Create FAISS index
    dimension = embeddings.shape[1]  # 384 for all-MiniLM-L6-v2
    print(f"  Creating FAISS index (dimension={dimension})...")

    # Use IndexFlatIP for inner product (cosine similarity)
    # Normalize embeddings for cosine similarity
    faiss.normalize_L2(embeddings)
    index = faiss.IndexFlatIP(dimension)

    # Add embeddings to index
    index.add(embeddings)
    print(f"  ✅ Added {index.ntotal} vectors to FAISS index")

    # Save index
    print(f"  Saving index to {INDEX_FILE}...")
    faiss.write_index(index, str(INDEX_FILE))

    # Save metadata
    print(f"  Saving metadata to {METADATA_FILE}...")
    with open(METADATA_FILE, 'wb') as f:
        pickle.dump(metadata, f)

    # Save card data as JSON for easy inspection
    print(f"  Saving card data to {CARDS_FILE}...")
    with open(CARDS_FILE, 'w') as f:
        json.dump(cards, f, indent=2)

    print(f"✅ Vector index built successfully!")
    return index, metadata, model

def test_semantic_search(index_file: Path, metadata_file: Path):
    """Test semantic search on the FAISS index"""
    print("\n🧪 Testing semantic search...")

    # Load index
    print(f"  Loading FAISS index from {index_file}...")
    index = faiss.read_index(str(index_file))

    # Load metadata
    print(f"  Loading metadata from {metadata_file}...")
    with open(metadata_file, 'rb') as f:
        metadata = pickle.load(f)

    # Load embedding model
    print("  Loading embedding model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # Test queries
    test_queries = [
        "What's the price of Charizard cards?",
        "Show me expensive Pikachu VMAX cards",
        "Find graded PSA 10 cards",
        "Umbreon VMAX pricing and value"
    ]

    for query in test_queries:
        print(f"\n📝 Query: '{query}'")

        # Encode query
        query_embedding = model.encode([query], convert_to_numpy=True)
        faiss.normalize_L2(query_embedding)

        # Search
        k = 5  # top 5 results
        distances, indices = index.search(query_embedding, k)

        print(f"  Top {k} results:")
        for i, idx in enumerate(indices[0], 1):
            if idx < len(metadata):
                meta = metadata[idx]
                score = distances[0][i-1]
                print(f"  {i}. {meta['pokemon_name']} - ${meta['sold_price']:,.2f} (score: {score:.3f})")
                print(f"     Grade: {meta['grade']}, Date: {meta['sold_date']}")

        print("-" * 70)

def main():
    print("=" * 80)
    print("PHASE 1.2: BUILD VECTOR RAG FOR MEW-1A (FAISS) - COMPLETE DATASET")
    print("=" * 80)
    print()

    # Check database exists
    if not DB_PATH.exists():
        print(f"❌ ERROR: Database not found at {DB_PATH}")
        print("Please ensure the database file exists.")
        sys.exit(1)

    # Step 1: Extract ALL cards (no limit)
    print("🎯 Extracting ALL cards from database (sold + current listings)...")
    print("⏱️  This will take ~5-10 minutes for ~482K records")
    cards = extract_cards_from_db(str(DB_PATH), limit=None)

    if not cards:
        print("❌ No cards found in database")
        sys.exit(1)

    # Step 2: Build vector index
    index, metadata, model = build_vector_index(cards, VECTOR_STORE_PATH)

    # Step 3: Test search
    test_semantic_search(INDEX_FILE, METADATA_FILE)

    print()
    print("=" * 80)
    print("✅ VECTOR RAG BUILD COMPLETE!")
    print("=" * 80)
    print()
    print(f"📊 Stats:")
    print(f"  • Cards indexed: {len(cards)}")
    print(f"  • Embedding model: all-MiniLM-L6-v2 (384 dimensions)")
    print(f"  • Index file: {INDEX_FILE}")
    print(f"  • Metadata file: {METADATA_FILE}")
    print(f"  • Cards file: {CARDS_FILE}")
    print()
    print("🎯 Next Steps:")
    print("  1. Update rag_middleware.py to use FAISS vector store")
    print("  2. Add semantic search to Mew-1A inference pipeline")
    print("  3. Test performance vs pattern-based RAG")
    print("  4. Deploy to Modal Labs")
    print()
    print("💡 To index ALL cards, re-run without the limit parameter")

if __name__ == "__main__":
    main()
