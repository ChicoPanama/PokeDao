/**
 * Migration Script: FAISS to Qdrant
 *
 * Migrates existing FAISS vector store to Qdrant for production use.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-faiss-to-qdrant.ts
 *
 * Prerequisites:
 *   - QDRANT_URL and QDRANT_API_KEY in .env
 *   - Existing FAISS index at data/vector-store/faiss.index
 *   - Metadata at data/vector-store/metadata.pkl
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';

// ============================================================================
// Configuration
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'pokemon_cards';
const VECTOR_SIZE = 384; // all-MiniLM-L6-v2

const VECTOR_STORE_PATH = join(process.cwd(), 'data', 'vector-store');
const FAISS_INDEX_PATH = join(VECTOR_STORE_PATH, 'faiss.index');
const METADATA_PATH = join(VECTOR_STORE_PATH, 'metadata.pkl');

// ============================================================================
// Main Migration
// ============================================================================

async function migrate() {
  console.log('='.repeat(80));
  console.log('FAISS to Qdrant Migration');
  console.log('='.repeat(80));
  console.log();

  // Check prerequisites
  console.log('Checking prerequisites...');

  if (!existsSync(METADATA_PATH)) {
    console.error(`ERROR: Metadata file not found: ${METADATA_PATH}`);
    console.log('');
    console.log('This script requires the FAISS metadata pickle file.');
    console.log('If you have no existing data, skip this migration.');
    process.exit(1);
  }

  console.log(`  QDRANT_URL: ${QDRANT_URL}`);
  console.log(`  COLLECTION: ${COLLECTION_NAME}`);
  console.log(`  METADATA: ${METADATA_PATH}`);
  console.log();

  // Initialize Qdrant client
  console.log('Connecting to Qdrant...');
  const client = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
  });

  // Check connection
  try {
    const collections = await client.getCollections();
    console.log(`  Connected! Found ${collections.collections.length} collections`);
  } catch (error) {
    console.error('ERROR: Failed to connect to Qdrant');
    console.error(error);
    process.exit(1);
  }

  // Create collection if needed
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (exists) {
    console.log(`  Collection '${COLLECTION_NAME}' already exists`);

    const info = await client.getCollection(COLLECTION_NAME);
    console.log(`  Current vectors: ${info.points_count}`);

    if (info.points_count && info.points_count > 0) {
      console.log('');
      console.log('WARNING: Collection already has data.');
      console.log('To re-migrate, delete the collection first:');
      console.log(`  curl -X DELETE "${QDRANT_URL}/collections/${COLLECTION_NAME}"`);
      console.log('');
      console.log('Continuing will UPSERT (update/insert) data...');
    }
  } else {
    console.log(`  Creating collection '${COLLECTION_NAME}'...`);

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

    // Create indexes
    console.log('  Creating payload indexes...');

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

    console.log('  Collection created!');
  }

  console.log();

  // Load metadata from pickle (need Python for this)
  console.log('Loading metadata...');
  console.log('');
  console.log('NOTE: This script cannot read Python pickle files directly.');
  console.log('To complete migration, use the Python migration script:');
  console.log('');
  console.log('  python scripts/migrate_faiss_to_qdrant.py');
  console.log('');
  console.log('Or export metadata to JSON first:');
  console.log('');
  console.log('  python -c "import pickle; import json;');
  console.log("  data = pickle.load(open('data/vector-store/metadata.pkl', 'rb'));");
  console.log("  json.dump(data, open('data/vector-store/metadata.json', 'w'))\"");
  console.log('');

  // Check if JSON export exists
  const jsonPath = join(VECTOR_STORE_PATH, 'metadata.json');
  if (existsSync(jsonPath)) {
    console.log('Found metadata.json - proceeding with migration...');
    console.log();

    const metadata = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    console.log(`  Loaded ${metadata.length} card records`);

    // We need embeddings too - check for embeddings.json
    const embeddingsPath = join(VECTOR_STORE_PATH, 'embeddings.json');
    if (!existsSync(embeddingsPath)) {
      console.log('');
      console.log('ERROR: embeddings.json not found');
      console.log('Export embeddings from FAISS index using Python:');
      console.log('');
      console.log('  import faiss');
      console.log('  import json');
      console.log("  index = faiss.read_index('data/vector-store/faiss.index')");
      console.log('  vectors = faiss.rev_swig_ptr(index.get_xb(), index.ntotal * index.d)');
      console.log('  vectors = vectors.reshape(index.ntotal, index.d).tolist()');
      console.log("  json.dump(vectors, open('data/vector-store/embeddings.json', 'w'))");
      process.exit(1);
    }

    const embeddings = JSON.parse(readFileSync(embeddingsPath, 'utf-8'));
    console.log(`  Loaded ${embeddings.length} embeddings`);

    if (metadata.length !== embeddings.length) {
      console.error('ERROR: Metadata and embeddings count mismatch!');
      process.exit(1);
    }

    // Batch upsert
    console.log();
    console.log('Uploading to Qdrant...');

    const BATCH_SIZE = 100;
    let uploaded = 0;

    for (let i = 0; i < metadata.length; i += BATCH_SIZE) {
      const batchMeta = metadata.slice(i, i + BATCH_SIZE);
      const batchEmbed = embeddings.slice(i, i + BATCH_SIZE);

      const points = batchMeta.map((meta: any, idx: number) => ({
        id: meta.id || `card_${i + idx}`,
        vector: batchEmbed[idx],
        payload: {
          ...meta,
          // Normalize field names
          cardName: meta.cardName || meta.pokemon_name || meta.name,
          priceCents: meta.priceCents || (meta.sold_price ? Math.round(meta.sold_price * 100) : null),
        },
      }));

      await client.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });

      uploaded += points.length;
      process.stdout.write(`\r  Uploaded ${uploaded}/${metadata.length} vectors`);
    }

    console.log('\n');
    console.log('Migration complete!');

    const info = await client.getCollection(COLLECTION_NAME);
    console.log(`  Total vectors: ${info.points_count}`);
  }

  console.log();
  console.log('='.repeat(80));
}

migrate().catch(console.error);
