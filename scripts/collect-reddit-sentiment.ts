/**
 * Reddit Sentiment Collection Script
 * Collects Pokemon TCG community sentiment from Reddit for Mew-1A training
 *
 * Usage:
 *   pnpm tsx scripts/collect-reddit-sentiment.ts [options]
 *
 * Options:
 *   --mode=full|incremental  Collection mode (default: full)
 *   --limit=N                Limit posts/comments per subreddit (default: 100)
 *   --output=PATH            Output JSONL path (default: data/training/reddit-sentiment.jsonl)
 *   --since=TIMESTAMP        For incremental mode: Unix timestamp of last collection
 *   --investment             Include investment-focused examples
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { collectRedditSentiment, incrementalUpdate } from '../packages/reddit-sentiment/src';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value || 'true';
  return acc;
}, {} as Record<string, string>);

const MODE = args.mode || 'full';
const LIMIT = parseInt(args.limit || '100', 10);
const OUTPUT_PATH = args.output || path.join(process.cwd(), 'data/training/reddit-sentiment.jsonl');
const SINCE_TIMESTAMP = args.since ? parseInt(args.since, 10) : undefined;
const INCLUDE_INVESTMENT = args.investment === 'true';

// Target subreddits
const SUBREDDITS = ['PokeInvesting', 'PokemonTCG'];

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   REDDIT SENTIMENT COLLECTION FOR MEW-1A');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Mode: ${MODE}`);
  console.log(`Subreddits: ${SUBREDDITS.join(', ')}`);
  console.log(`Limit per subreddit: ${LIMIT}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Include investment examples: ${INCLUDE_INVESTMENT}`);
  console.log('');

  // Validate environment variables
  const requiredEnvVars = [
    'REDDIT_CLIENT_ID',
    'REDDIT_CLIENT_SECRET',
    'REDDIT_USERNAME',
    'REDDIT_PASSWORD',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('');
    console.error('Please add these to your .env file:');
    console.error('');
    console.error('REDDIT_CLIENT_ID=your_client_id');
    console.error('REDDIT_CLIENT_SECRET=your_client_secret');
    console.error('REDDIT_USERNAME=your_username');
    console.error('REDDIT_PASSWORD=your_password');
    console.error('');
    console.error('See: https://www.reddit.com/prefs/apps');
    process.exit(1);
  }

  try {
    // Load card names from database
    console.log('📊 Loading card names from database...');
    const uniqueCards = await prisma.$queryRaw<Array<{ cardName: string }>>`
      SELECT DISTINCT "cardName"
      FROM "UnifiedMarketListing"
      WHERE "cardName" IS NOT NULL
      ORDER BY "cardName"
    `;

    const cardNames = uniqueCards
      .map(c => c.cardName)
      .filter((name): name is string => Boolean(name));

    console.log(`   ✓ Loaded ${cardNames.length} unique card names`);
    console.log('');

    // Add common Pokemon names and variants for better matching
    const commonPokemon = [
      'Charizard', 'Pikachu', 'Mewtwo', 'Lugia', 'Umbreon', 'Espeon',
      'Rayquaza', 'Mew', 'Celebi', 'Gyarados', 'Blastoise', 'Venusaur',
      'Eevee', 'Vaporeon', 'Jolteon', 'Flareon', 'Snorlax', 'Dragonite',
      'Gengar', 'Alakazam', 'Machamp', 'Golem', 'Zapdos', 'Moltres', 'Articuno',
    ];

    const enhancedCardNames = [...new Set([...cardNames, ...commonPokemon])];

    // Configuration
    const config = {
      reddit: {
        clientId: process.env.REDDIT_CLIENT_ID!,
        clientSecret: process.env.REDDIT_CLIENT_SECRET!,
        username: process.env.REDDIT_USERNAME!,
        password: process.env.REDDIT_PASSWORD!,
        userAgent: 'PokeDAO Sentiment Collector v1.0',
      },
      subreddits: SUBREDDITS,
      cardNames: enhancedCardNames,
      outputPath: OUTPUT_PATH,
      limit: LIMIT,
      includeInvestment: INCLUDE_INVESTMENT,
    };

    // Run collection
    let examples;
    if (MODE === 'incremental' && SINCE_TIMESTAMP) {
      examples = await incrementalUpdate(config, SINCE_TIMESTAMP);
    } else {
      examples = await collectRedditSentiment(config);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   COLLECTION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Collected ${examples.length} training examples`);
    console.log(`📁 Saved to: ${OUTPUT_PATH}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the generated JSONL file');
    console.log('2. Merge with existing Mew-1A training data');
    console.log('3. Update training script to include reddit-sentiment.jsonl');
    console.log('4. Fine-tune Mew-1A v4.1 or v5 with community sentiment data');
    console.log('');

    // Save checkpoint (last timestamp)
    const checkpointPath = path.join(process.cwd(), 'data/training/.reddit-checkpoint.json');
    const checkpoint = {
      lastRun: new Date().toISOString(),
      lastTimestamp: Math.floor(Date.now() / 1000),
      examplesCollected: examples.length,
    };

    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    console.log(`💾 Checkpoint saved to: ${checkpointPath}`);
    console.log('   (Use this timestamp for next incremental update)');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('   ERROR');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error(error);
    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
