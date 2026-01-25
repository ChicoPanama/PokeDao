/**
 * Qdrant Vector Database Client for PokeDAO
 *
 * Replaces FAISS for production vector search with:
 * - Persistent storage (no cold start rebuilds)
 * - Hybrid search (dense + sparse vectors)
 * - Metadata filtering (set, grade, price range)
 * - Production SLAs
 */

import { QdrantClient } from '@qdrant/js-client-rest';

// ============================================================================
// Types
// ============================================================================

export interface CardVector {
  id: string;
  vector: number[];
  payload: CardPayload;
}

export interface CardPayload {
  canonicalCardId: string;
  cardName: string;
  setName: string;
  cardNumber?: string;
  variant?: string;
  grade?: number;
  gradeCompany?: string;
  priceCents?: number;
  soldAt?: string;
  source?: string;
  embedding_text: string;
}

export interface CardSearchFilters {
  setName?: string;
  gradeCompany?: string;
  minGrade?: number;
  maxGrade?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  source?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: CardPayload;
}

// ============================================================================
// Configuration
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'pokemon_cards';
const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 embedding size

// ============================================================================
// Client Instance
// ============================================================================

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    _client = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
  return _client;
}

// ============================================================================
// Collection Management
// ============================================================================

/**
 * Initialize the pokemon_cards collection if it doesn't exist
 */
export async function initializeCollection(): Promise<void> {
  const client = getQdrantClient();

  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
        optimizers_config: {
          indexing_threshold: 10000,
        },
        on_disk_payload: true,
      });

      // Create payload indexes for filtering
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'setName',
        field_schema: 'keyword',
      });

      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'gradeCompany',
        field_schema: 'keyword',
      });

      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'grade',
        field_schema: 'float',
      });

      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'priceCents',
        field_schema: 'integer',
      });

      console.log(`[qdrant] Created collection: ${COLLECTION_NAME}`);
    } else {
      console.log(`[qdrant] Collection exists: ${COLLECTION_NAME}`);
    }
  } catch (error) {
    console.error('[qdrant] Failed to initialize collection:', error);
    throw error;
  }
}

/**
 * Get collection info and stats
 */
export async function getCollectionInfo() {
  const client = getQdrantClient();
  return client.getCollection(COLLECTION_NAME);
}

// ============================================================================
// Vector Operations
// ============================================================================

/**
 * Upsert card vectors into Qdrant
 */
export async function upsertCards(cards: CardVector[]): Promise<void> {
  if (cards.length === 0) return;

  const client = getQdrantClient();

  const points = cards.map((card) => ({
    id: card.id,
    vector: card.vector,
    payload: card.payload as unknown as Record<string, unknown>,
  }));

  // Batch upsert in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points: batch,
    });
  }

  console.log(`[qdrant] Upserted ${cards.length} card vectors`);
}

/**
 * Search for similar cards using vector similarity
 */
export async function searchCards(
  embedding: number[],
  filters?: CardSearchFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  const client = getQdrantClient();

  const searchParams: Parameters<typeof client.search>[1] = {
    vector: embedding,
    limit,
    with_payload: true,
  };

  // Build filter conditions
  if (filters) {
    const must: any[] = [];

    if (filters.setName) {
      must.push({
        key: 'setName',
        match: { value: filters.setName },
      });
    }

    if (filters.gradeCompany) {
      must.push({
        key: 'gradeCompany',
        match: { value: filters.gradeCompany },
      });
    }

    if (filters.minGrade !== undefined || filters.maxGrade !== undefined) {
      must.push({
        key: 'grade',
        range: {
          gte: filters.minGrade,
          lte: filters.maxGrade,
        },
      });
    }

    if (filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined) {
      must.push({
        key: 'priceCents',
        range: {
          gte: filters.minPriceCents,
          lte: filters.maxPriceCents,
        },
      });
    }

    if (filters.source) {
      must.push({
        key: 'source',
        match: { value: filters.source },
      });
    }

    if (must.length > 0) {
      searchParams.filter = { must };
    }
  }

  const results = await client.search(COLLECTION_NAME, searchParams);

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload as unknown as CardPayload,
  }));
}

/**
 * Search cards by text query (requires external embedding)
 * This is a convenience wrapper - caller must provide the embedding
 */
export async function searchCardsByQuery(
  queryEmbedding: number[],
  options?: {
    filters?: CardSearchFilters;
    limit?: number;
  }
): Promise<SearchResult[]> {
  return searchCards(queryEmbedding, options?.filters, options?.limit ?? 10);
}

/**
 * Delete cards from the collection
 */
export async function deleteCards(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const client = getQdrantClient();

  await client.delete(COLLECTION_NAME, {
    wait: true,
    points: ids,
  });

  console.log(`[qdrant] Deleted ${ids.length} card vectors`);
}

/**
 * Get a specific card by ID
 */
export async function getCard(id: string): Promise<SearchResult | null> {
  const client = getQdrantClient();

  try {
    const results = await client.retrieve(COLLECTION_NAME, {
      ids: [id],
      with_payload: true,
      with_vector: false,
    });

    if (results.length === 0) return null;

    return {
      id: String(results[0].id),
      score: 1.0,
      payload: results[0].payload as unknown as CardPayload,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Hybrid Search (Future Enhancement)
// ============================================================================

/**
 * Hybrid search combining dense vectors with sparse keyword matching
 * Note: Requires Qdrant with sparse vectors enabled
 */
export async function hybridSearch(
  denseEmbedding: number[],
  _sparseTerms: string[],
  filters?: CardSearchFilters,
  limit: number = 10
): Promise<SearchResult[]> {
  // For now, fall back to dense-only search
  // TODO: Implement sparse vectors when Qdrant collection supports it
  return searchCards(denseEmbedding, filters, limit);
}

// ============================================================================
// Health Check
// ============================================================================

export async function healthCheck(): Promise<boolean> {
  try {
    const client = getQdrantClient();
    await client.getCollections();
    return true;
  } catch {
    return false;
  }
}
