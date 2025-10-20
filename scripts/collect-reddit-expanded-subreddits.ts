/**
 * Expanded Subreddit Collection
 * Collects from ALL Pokemon TCG-related subreddits
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { RedditFetcher, SentimentProcessor, OutputFormatter } from '../packages/reddit-sentiment/src';
import * as path from 'path';

dotenv.config();

const prisma = new PrismaClient();

// Expanded list of Pokemon TCG subreddits
const SUBREDDITS = [
  // Primary (already collected)
  'PokeInvesting',
  'PokemonTCG',

  // Secondary - Active Pokemon TCG communities
  'pkmntcgcollections',    // Collection-focused
  'PKMNTCGDeals',           // Deal hunting & price discussions
  'pkmntcgtrades',          // Trading (price negotiations)
  'PokemonTcgCodes',        // Digital codes (some card discussion)
  'ptcgo',                  // Pokemon TCG Online (competitive)
  'PokemonMisprints',       // Misprints & errors (value discussion)

  // Tertiary - General Pokemon (filter for TCG)
  'pokemon',                // General Pokemon (huge, filter heavily)
  'pokemoncardcollectors',  // Collectors
];

const OUTPUT_PATH = path.join(process.cwd(), 'data/training/reddit-sentiment-expanded.jsonl');

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   EXPANDED SUBREDDIT COLLECTION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Subreddits: ${SUBREDDITS.length} communities`);
  console.log('Strategy: Collect from all Pokemon TCG-related subreddits');
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
  const commonPokemon = [
    'Charizard', 'Pikachu', 'Mewtwo', 'Lugia', 'Umbreon', 'Espeon',
    'Rayquaza', 'Mew', 'Celebi', 'Gyarados', 'Blastoise', 'Venusaur',
    'Eevee', 'Vaporeon', 'Jolteon', 'Flareon', 'Snorlax', 'Dragonite',
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
    userAgent: 'PokeDAO Expanded Collector v1.0',
  });

  const processor = new SentimentProcessor(enhancedCardNames);
  const formatter = new OutputFormatter();

  let allExamples: any[] = [];

  // Collection strategies (optimized for speed)
  const strategies = [
    { sort: 'new' as const, limit: 500, desc: 'Latest posts' },
    { sort: 'top' as const, limit: 500, timeframe: 'month' as const, desc: 'Top this month' },
  ];

  for (const subreddit of SUBREDDITS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 Collecting from r/${subreddit}`);
    console.log('='.repeat(60));

    for (const strategy of strategies) {
      console.log(`\n   Strategy: ${strategy.desc}`);

      try {
        // Fetch posts
        const posts = await fetcher.fetchPosts({
          subreddit,
          limit: strategy.limit,
          sort: strategy.sort,
          timeframe: strategy.timeframe,
        });

        console.log(`   ✓ Fetched ${posts.length} posts`);

        // Process posts
        const processed = processor.processBatch(posts);
        console.log(`   ✓ Found ${processed.length} relevant items`);

        if (processed.length > 0) {
          const stats = processor.getBatchStatistics(processed);
          console.log(`   📊 Sentiment: ${stats.positive} pos, ${stats.negative} neg, ${stats.neutral} neu`);

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

          const examples = formatter.batchFormat(processedData, true);
          allExamples.push(...examples);
        }

      } catch (error: any) {
        console.error(`   ✗ Error with ${strategy.desc}:`, error.message);
      }
    }

    // Also collect comments (fewer for speed)
    console.log(`\n   Strategy: Latest comments`);
    try {
      const comments = await fetcher.fetchComments({
        subreddit,
        limit: 250, // Fewer comments to save time
      });

      console.log(`   ✓ Fetched ${comments.length} comments`);

      const processed = processor.processBatch(comments);
      console.log(`   ✓ Found ${processed.length} relevant items`);

      if (processed.length > 0) {
        const stats = processor.getBatchStatistics(processed);
        console.log(`   📊 Sentiment: ${stats.positive} pos, ${stats.negative} neg, ${stats.neutral} neu`);

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

        const examples = formatter.batchFormat(processedData, true);
        allExamples.push(...examples);
      }
    } catch (error: any) {
      console.error(`   ✗ Error collecting comments:`, error.message);
    }
  }

  // Deduplicate by Reddit ID
  console.log(`\n\n📝 Deduplicating...`);
  const seen = new Set<string>();
  const unique = allExamples.filter(ex => {
    const id = ex.metadata.reddit_id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`   Before: ${allExamples.length} examples`);
  console.log(`   After: ${unique.length} unique examples`);
  console.log(`   Duplicates removed: ${allExamples.length - unique.length}`);

  // Write
  await formatter.writeToJSONL(unique, OUTPUT_PATH);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   EXPANDED COLLECTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n✅ Total unique examples: ${unique.length}`);
  console.log(`📁 Saved to: ${OUTPUT_PATH}`);
  console.log('');
  console.log('Breakdown by subreddit:');

  // Show breakdown
  const bySubreddit = new Map<string, number>();
  for (const ex of unique) {
    const sub = ex.metadata.subreddit;
    bySubreddit.set(sub, (bySubreddit.get(sub) || 0) + 1);
  }

  const sorted = Array.from(bySubreddit.entries()).sort((a, b) => b[1] - a[1]);
  for (const [sub, count] of sorted) {
    console.log(`   r/${sub}: ${count} examples`);
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
