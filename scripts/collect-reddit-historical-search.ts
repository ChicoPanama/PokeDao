/**
 * Historical Reddit Collection via Search API
 * Uses Reddit's search with date ranges to get older content
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { RedditFetcher, SentimentProcessor, OutputFormatter } from '../packages/reddit-sentiment/src';
import * as path from 'path';

dotenv.config();

const prisma = new PrismaClient();

const SUBREDDITS = ['PokeInvesting', 'PokemonTCG'];
const OUTPUT_PATH = path.join(process.cwd(), 'data/training/reddit-sentiment-historical.jsonl');

// Search queries for popular Pokemon TCG cards
const SEARCH_QUERIES = [
  'Charizard',
  'Pikachu VMAX',
  'Umbreon VMAX',
  'Mewtwo ex',
  'Lugia VSTAR',
  'booster box',
  'graded PSA',
  'investment',
  'undervalued',
  'price prediction',
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   HISTORICAL REDDIT SEARCH COLLECTION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Strategy: Search for specific Pokemon TCG terms');
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
    userAgent: 'PokeDAO Historical Search v1.0',
  });

  const processor = new SentimentProcessor(enhancedCardNames);
  const formatter = new OutputFormatter();

  let allExamples: any[] = [];

  // For each subreddit and search query
  for (const subreddit of SUBREDDITS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 Searching r/${subreddit}`);
    console.log('='.repeat(60));

    for (const query of SEARCH_QUERIES) {
      console.log(`\n   Query: "${query}"`);

      try {
        // Use Reddit's search (will return historical results)
        const subredditObj = (fetcher as any).reddit.getSubreddit(subreddit);
        const results = await subredditObj.search({
          query,
          limit: 100,
          sort: 'relevance',
          time: 'all', // All time = historical!
        });

        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit

        const posts = results.map((post: any) => ({
          id: post.id,
          subreddit: post.subreddit.display_name,
          author: post.author.name,
          title: post.title,
          selftext: post.selftext || '',
          score: post.score,
          created_utc: post.created_utc,
          permalink: `https://reddit.com${post.permalink}`,
        }));

        console.log(`   ✓ Found ${posts.length} results`);

        if (posts.length > 0) {
          // Process
          const processed = processor.processBatch(posts);
          console.log(`   ✓ ${processed.length} relevant items`);

          if (processed.length > 0) {
            const stats = processor.getBatchStatistics(processed);
            console.log(`   📊 ${stats.positive} pos, ${stats.negative} neg, ${stats.neutral} neu`);

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
        }

      } catch (error) {
        console.error(`   ✗ Error searching "${query}":`, error);
      }
    }
  }

  // Deduplicate
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
  console.log('   HISTORICAL SEARCH COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n✅ Total unique examples: ${unique.length}`);
  console.log(`📁 Saved to: ${OUTPUT_PATH}`);
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
