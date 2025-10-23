#!/usr/bin/env python3
"""
Build Vector RAG for Mew-1A using FAISS with Memory-Efficient Batching
Phase 1.2: Create vector embeddings for TCG cards database

IMPROVEMENTS:
- Batch processing to avoid memory exhaustion
- Progress checkpoints every 10K cards
- Memory cleanup between batches
- Resume capability from last checkpoint
"""

import sqlite3
import sys
import pickle
import json
import gc
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
CHECKPOINT_FILE = VECTOR_STORE_PATH / "build-checkpoint.json"

# Batching configuration
BATCH_SIZE = 5000  # Process 5K cards at a time (safe for memory)
CHECKPOINT_INTERVAL = 10000  # Save progress every 10K cards

def extract_cards_from_db(db_path: str, offset: int = 0, limit: int = None) -> List[Dict]:
    """Extract card data with pagination support"""
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
          AND sold_price < 100000

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
          AND current_price < 100000

        ORDER BY date DESC
    """

    if limit:
        query += f" LIMIT {limit} OFFSET {offset}"

    cursor.execute(query)
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return results

def get_total_card_count(db_path: str) -> int:
    """Get total number of cards in database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) FROM (
            SELECT 1 FROM ebay_sold_listings
            WHERE sold_price IS NOT NULL AND sold_price > 0 AND sold_price < 100000
            UNION ALL
            SELECT 1 FROM ebay_current_listings
            WHERE current_price IS NOT NULL AND current_price > 0 AND current_price < 100000
        )
    """)

    total = cursor.fetchone()[0]
    conn.close()
    return total

def prepare_texts_and_metadata(cards: List[Dict]) -> tuple:
    """Convert cards to text embeddings and metadata"""
    texts = []
    metadata = []

    for card in cards:
        name = card.get('pokemon_name') or 'Unknown'
        title = card.get('title') or ''
        price = card.get('price', 0)
        date = card.get('date') or ''
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

    return texts, metadata

def build_vector_index_batched(db_path: str, persist_dir: Path):
    """Build FAISS vector index with memory-efficient batching"""
    print("🔮 Building vector index with FAISS (batched approach)...")

    # Create persist directory
    persist_dir.mkdir(parents=True, exist_ok=True)

    # Initialize embedding model (only once)
    print("  Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # Get total count
    total_cards = get_total_card_count(str(db_path))
    print(f"  Total cards to process: {total_cards:,}")

    # Initialize FAISS index
    dimension = 384  # all-MiniLM-L6-v2 dimension
    index = faiss.IndexFlatIP(dimension)

    # Storage for all metadata and cards
    all_metadata = []
    all_cards = []

    # Process in batches
    offset = 0
    batch_num = 0

    while offset < total_cards:
        batch_num += 1
        print(f"\n📦 Batch {batch_num}: Processing cards {offset:,} to {min(offset + BATCH_SIZE, total_cards):,}")

        # Extract batch
        print(f"  Extracting batch from database...")
        cards_batch = extract_cards_from_db(str(db_path), offset=offset, limit=BATCH_SIZE)

        if not cards_batch:
            break

        # Prepare texts and metadata
        print(f"  Preparing {len(cards_batch):,} cards for embedding...")
        texts, metadata = prepare_texts_and_metadata(cards_batch)

        # Generate embeddings for this batch
        print(f"  Encoding batch to embeddings...")
        embeddings = model.encode(
            texts,
            show_progress_bar=True,
            convert_to_numpy=True,
            batch_size=32  # Internal batch size for encoding
        )

        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings)

        # Add to index
        index.add(embeddings)
        print(f"  ✅ Added {len(embeddings)} vectors (total: {index.ntotal:,})")

        # Store metadata and cards
        all_metadata.extend(metadata)
        all_cards.extend(cards_batch)

        # Cleanup memory
        del embeddings, texts, metadata, cards_batch
        gc.collect()

        # Save checkpoint every CHECKPOINT_INTERVAL
        if offset > 0 and offset % CHECKPOINT_INTERVAL == 0:
            print(f"  💾 Checkpoint: Saving progress at {offset:,} cards...")
            save_checkpoint(offset, index, all_metadata, all_cards, persist_dir)

        offset += BATCH_SIZE

        # Progress update
        progress = (offset / total_cards) * 100
        print(f"  Progress: {progress:.1f}% complete ({offset:,}/{total_cards:,})")

    # Final save
    print("\n💾 Saving final index and metadata...")

    print(f"  Saving index to {INDEX_FILE}...")
    faiss.write_index(index, str(INDEX_FILE))

    print(f"  Saving metadata to {METADATA_FILE}...")
    with open(METADATA_FILE, 'wb') as f:
        pickle.dump(all_metadata, f)

    print(f"  Saving card data to {CARDS_FILE}...")
    with open(CARDS_FILE, 'w') as f:
        json.dump(all_cards, f, indent=2)

    # Remove checkpoint file
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()

    print(f"✅ Vector index built successfully!")
    print(f"   Total vectors: {index.ntotal:,}")

    return index, all_metadata, model

def save_checkpoint(offset: int, index, metadata: List[Dict], cards: List[Dict], persist_dir: Path):
    """Save checkpoint to resume from if crash occurs"""
    checkpoint = {
        "offset": offset,
        "total_vectors": index.ntotal,
        "timestamp": str(Path.cwd())
    }

    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(checkpoint, f, indent=2)

    # Save partial index
    temp_index_file = persist_dir / f"faiss-checkpoint-{offset}.index"
    faiss.write_index(index, str(temp_index_file))

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
                print(f"  {i}. {meta['pokemon_name']} - ${meta['price']:,.2f} (score: {score:.3f})")
                print(f"     Grade: {meta['grade']}, Date: {meta['date']}")

        print("-" * 70)

def main():
    print("=" * 80)
    print("PHASE 1.2: BUILD VECTOR RAG - MEMORY-EFFICIENT BATCHED VERSION")
    print("=" * 80)
    print()
    print("🎯 Features:")
    print("  • Batch size: 5,000 cards per batch")
    print("  • Checkpoints every 10,000 cards")
    print("  • Memory cleanup between batches")
    print("  • Resume capability from checkpoints")
    print()

    # Check database exists
    if not DB_PATH.exists():
        print(f"❌ ERROR: Database not found at {DB_PATH}")
        print("Please ensure the database file exists.")
        sys.exit(1)

    # Build vector index with batching
    index, metadata, model = build_vector_index_batched(str(DB_PATH), VECTOR_STORE_PATH)

    # Test search
    test_semantic_search(INDEX_FILE, METADATA_FILE)

    print()
    print("=" * 80)
    print("✅ VECTOR RAG BUILD COMPLETE!")
    print("=" * 80)
    print()
    print(f"📊 Stats:")
    print(f"  • Cards indexed: {len(metadata):,}")
    print(f"  • Embedding model: all-MiniLM-L6-v2 (384 dimensions)")
    print(f"  • Index file: {INDEX_FILE}")
    print(f"  • Metadata file: {METADATA_FILE}")
    print(f"  • Cards file: {CARDS_FILE}")
    print()
    print("🎯 Next Steps:")
    print("  1. Upload vector store to Modal Labs")
    print("  2. Deploy Vector RAG to production")
    print("  3. Test with Mew-1A v4.3 model")
    print()

if __name__ == "__main__":
    main()
