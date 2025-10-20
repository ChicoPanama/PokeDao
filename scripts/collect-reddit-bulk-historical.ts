/**
 * Bulk Historical Reddit Collection
 * Collects massive amounts of Reddit data using Pushshift API
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { RedditFetcher, SentimentProcessor, OutputFormatter } from '../packages/reddit-sentiment/src';
import * as path from 'path';

dotenv.config();

const prisma = new PrismaClient();

// Configuration
const SUBREDDITS = ['PokeInvesting', 'PokemonTCG'];
const START_DATE = new Date('2024-01-01');
const END_DATE = new Date('2025-10-17');
const OUTPUT_PATH = path.join(process.cwd(), 'data/training/reddit-sentiment-bulk.jsonl');

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   BULK HISTORICAL REDDIT COLLECTION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Date Range: ${START_DATE.toISOString()} to ${END_DATE.toISOString()}`);
  console.log(`Subreddits: ${SUBREDDITS.join(', ')}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log('');

  // Load card names
  console.log('📊 Loading card names from database...');
  const uniqueCards = await prisma.$queryRaw<Array<{ cardName: string }>>`
    SELECT DISTINCT "cardName"
    FROM "UnifiedMarketListing"
    WHERE "cardName" IS NOT NULL
    ORDER BY "cardName"
  `;

  const cardNames = uniqueCards.map(c => c.cardName).filter((name): name is string => Boolean(name));

  // Add common Pokemon
  const commonPokemon = [
    'Charizard', 'Pikachu', 'Mewtwo', 'Lugia', 'Umbreon', 'Espeon',
    'Rayquaza', 'Mew', 'Celebi', 'Gyarados', 'Blastoise', 'Venusaur',
  ];

  const enhancedCardNames = [...new Set([...cardNames, ...commonPokemon])];
  console.log(`   ✓ Loaded ${enhancedCardNames.length} unique card names`);
  console.log('');

  // Initialize
  const fetcher = new RedditFetcher({
    clientId: process.env.REDDIT_CLIENT_ID!,
    clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    username: process.env.REDDIT_USERNAME!,
    password: process.env.REDDIT_PASSWORD!,
    userAgent: 'PokeDAO Historical Collector v1.0',
  });

  const processor = new SentimentProcessor(enhancedCardNames);
  const formatter = new OutputFormatter();

  let allExamples: any[] = [];

  // Collect from each subreddit
  for (const subreddit of SUBREDDITS) {
    console.log(`📥 Fetching historical data from r/${subreddit}...`);

    // Fetch submissions via Pushshift
    console.log('   Fetching posts (submissions)...');
    const posts = await fetcher.fetchHistoricalBatch(
      subreddit,
      START_DATE,
      END_DATE,
      'submission'
    );

    console.log(`   ✓ Fetched ${posts.length} posts`);

    // Fetch comments via Pushshift
    console.log('   Fetching comments...');
    const comments = await fetcher.fetchHistoricalBatch(
      subreddit,
      START_DATE,
      END_DATE,
      'comment'
    );

    console.log(`   ✓ Fetched ${comments.length} comments`);

    // Convert Pushshift format to RedditItem format
    const convertedPosts = posts.map((p: any) => ({
      id: p.id,
      subreddit: p.subreddit,
      author: p.author,
      title: p.title || '',
      selftext: p.selftext || '',
      score: p.score || 0,
      created_utc: p.created_utc,
      permalink: `https://reddit.com/r/${p.subreddit}/comments/${p.id}`,
    }));

    const convertedComments = comments.map((c: any) => ({
      id: c.id,
      subreddit: c.subreddit,
      author: c.author,
      body: c.body || '',
      score: c.score || 0,
      created_utc: c.created_utc,
      permalink: `https://reddit.com${c.permalink || ''}`,
      link_id: c.link_id || '',
    }));

    // Process
    console.log('🔍 Processing sentiment...');
    const allItems = [...convertedPosts, ...convertedComments];
    const processed = processor.processBatch(allItems);

    console.log(`   ✓ Found ${processed.length} items mentioning Pokemon cards`);

    // Get stats
    const stats = processor.getBatchStatistics(processed);
    console.log(`   Sentiment: ${stats.positive} positive, ${stats.negative} negative, ${stats.neutral} neutral`);

    // Format
    const processedData = processed.map(p => ({
      id: p.item.id,
      subreddit: p.item.subreddit,
      author: p.item.author,
      text: p.text,
      score: p.item.score,
      date: new Date(p.item.created_utc * 1000).toISOString(),
      permalink: p.item.permalink,
      cardMatch: p.cardMatch,
      sentiment: p.sentiment.label,
      sentimentScore: p.sentiment.comparative,
    }));

    const examples = formatter.batchFormat(processedData, true); // Include investment signals
    allExamples.push(...examples);

    console.log(`   ✓ Generated ${examples.length} training examples`);
    console.log('');
  }

  // Write all examples
  await formatter.writeToJSONL(allExamples, OUTPUT_PATH);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   BULK COLLECTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Total examples: ${allExamples.length}`);
  console.log(`📁 Saved to: ${OUTPUT_PATH}`);
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
