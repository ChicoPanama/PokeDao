/**
 * Upload Project Mew-1A training data to HuggingFace Dataset Hub
 *
 * Prerequisites:
 * 1. Create HuggingFace account: https://huggingface.co/join
 * 2. Get API token: https://huggingface.co/settings/tokens
 * 3. Set HUGGINGFACE_TOKEN env var
 *
 * Usage:
 *   export HUGGINGFACE_TOKEN=hf_...
 *   pnpm --filter @pokedao/mew1a train:upload
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
const DATASET_NAME = 'pokedao-mew1a-training-data';
const TRAINING_DATA_PATH = join(process.cwd(), '../../data/mew1a-training-data.jsonl');

async function uploadDataset() {
  console.log('🧬 PROJECT MEW-1A: HuggingFace Dataset Upload');
  console.log('=' .repeat(60));
  console.log('');

  // Step 1: Validate token
  if (!HUGGINGFACE_TOKEN) {
    console.error('❌ Error: HUGGINGFACE_TOKEN environment variable not set');
    console.log('');
    console.log('Setup:');
    console.log('1. Go to: https://huggingface.co/settings/tokens');
    console.log('2. Create new token with "write" access');
    console.log('3. Run: export HUGGINGFACE_TOKEN=hf_...');
    console.log('');
    process.exit(1);
  }

  console.log('✅ HuggingFace token found');

  // Step 2: Load training data
  console.log('📂 Loading training data...');

  if (!existsSync(TRAINING_DATA_PATH)) {
    console.error(`❌ Error: Training data not found at ${TRAINING_DATA_PATH}`);
    console.log('');
    console.log('Run first:');
    console.log('  pnpm tsx scripts/mew1a-extract-training-data.ts');
    console.log('');
    process.exit(1);
  }

  const data = readFileSync(TRAINING_DATA_PATH, 'utf-8');
  const lines = data.trim().split('\n');
  const examples = lines.map(line => JSON.parse(line));

  console.log(`   Loaded ${examples.length} training examples`);
  console.log('');

  // Step 3: Prepare dataset for HuggingFace
  console.log('🔧 Preparing dataset...');

  const dataset = {
    data: examples,
    metadata: {
      name: DATASET_NAME,
      description: "Project Mew-1A: Pokemon TCG pricing AI training dataset",
      task: "text-generation",
      language: "en",
      license: "proprietary",
      tags: ["pokemon", "tcg", "pricing", "trading-cards", "market-analysis"],
      source: "PokeDAO - 400k+ real market listings",
      version: "1.0.0",
      created: new Date().toISOString(),
      statistics: {
        total_examples: examples.length,
        avg_input_length: Math.round(
          examples.reduce((sum, ex) => sum + ex.input.length, 0) / examples.length
        ),
        avg_output_length: Math.round(
          examples.reduce((sum, ex) => sum + ex.output.length, 0) / examples.length
        ),
      },
    },
  };

  console.log(`   Dataset name: ${DATASET_NAME}`);
  console.log(`   Examples: ${dataset.metadata.statistics.total_examples}`);
  console.log(`   Avg input length: ${dataset.metadata.statistics.avg_input_length} chars`);
  console.log(`   Avg output length: ${dataset.metadata.statistics.avg_output_length} chars`);
  console.log('');

  // Step 4: Upload to HuggingFace
  console.log('📤 Uploading to HuggingFace...');
  console.log('');

  try {
    // Create dataset repository
    const createRepoResponse = await fetch(
      `https://huggingface.co/api/datasets/pokedao/${DATASET_NAME}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DATASET_NAME,
          private: false, // Make public for community use
        }),
      }
    );

    if (createRepoResponse.status === 409) {
      console.log('⚠️  Dataset already exists, updating...');
    } else if (!createRepoResponse.ok) {
      const error = await createRepoResponse.text();
      throw new Error(`Failed to create dataset: ${error}`);
    } else {
      console.log('✅ Dataset repository created');
    }

    // Upload training data as JSONL
    const uploadResponse = await fetch(
      `https://huggingface.co/api/datasets/pokedao/${DATASET_NAME}/upload/main/train.jsonl`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
          'Content-Type': 'application/jsonl',
        },
        body: data,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Failed to upload data: ${error}`);
    }

    console.log('✅ Training data uploaded');
    console.log('');

    // Upload README
    const readme = `# Project Mew-1A Training Dataset

The world's first AI training dataset specifically for Pokemon TCG pricing analysis.

## Dataset Description

This dataset contains ${examples.length} high-quality examples extracted from 400,000+ real market listings across 5 major marketplaces:
- eBay (11,795 listings)
- Courtyard (353,201 tokenized assets)
- Collector Crypt (22,442 listings)
- Phygitals (20,487 NFTs)
- TCGPlayer (1 listing)

## Task

Instruction-tuned text generation for TCG market analysis:
- Input: Card details, pricing data, market metrics
- Output: Investment recommendation with conviction score and analysis

## Format

JSONL with instruction-tuning format:
\`\`\`json
{
  "instruction": "You are a TCG market analyst...",
  "input": "Card: Charizard - Base Set PSA 10\\nListed Price: $5000...",
  "output": "RECOMMENDATION: STRONG_BUY\\nCONVICTION: 85%..."
}
\`\`\`

## Statistics

- Total Examples: ${examples.length}
- Avg Input Length: ${dataset.metadata.statistics.avg_input_length} chars
- Avg Output Length: ${dataset.metadata.statistics.avg_output_length} chars

## Recommended Base Model

\`meta-llama/Llama-3.2-3B-Instruct\`

## License

Proprietary - PokeDAO 2025
`;

    const readmeResponse = await fetch(
      `https://huggingface.co/api/datasets/pokedao/${DATASET_NAME}/upload/main/README.md`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
          'Content-Type': 'text/markdown',
        },
        body: readme,
      }
    );

    if (!readmeResponse.ok) {
      console.warn('⚠️  Failed to upload README (non-fatal)');
    } else {
      console.log('✅ README uploaded');
    }

    console.log('');
    console.log('🎉 Upload Complete!');
    console.log('=' .repeat(60));
    console.log('');
    console.log('📊 Dataset URL:');
    console.log(`   https://huggingface.co/datasets/pokedao/${DATASET_NAME}`);
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('1. Visit HuggingFace AutoTrain: https://huggingface.co/autotrain');
    console.log('2. Create new project → Text Generation');
    console.log(`3. Select dataset: pokedao/${DATASET_NAME}`);
    console.log('4. Base model: meta-llama/Llama-3.2-3B-Instruct');
    console.log('5. Configure:');
    console.log('   - Learning rate: 2e-4');
    console.log('   - Epochs: 3');
    console.log('   - Batch size: 4');
    console.log('   - LoRA rank: 8');
    console.log('6. Train! (~$20-30, 2-4 hours)');
    console.log('');
    console.log('📈 After training:');
    console.log('   - Deploy to HuggingFace Inference API');
    console.log('   - Update AI Ensemble to use Mew-1A');
    console.log('   - Benchmark against baseline models');

  } catch (error) {
    console.error('❌ Upload failed:', error);
    console.log('');
    console.log('Troubleshooting:');
    console.log('- Verify token has "write" access');
    console.log('- Check network connection');
    console.log('- Try manual upload via web UI');
    process.exit(1);
  }
}

uploadDataset();
