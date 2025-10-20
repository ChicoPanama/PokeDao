/**
 * Phase 1: Expanded Search Terms
 * Search for top 50 Pokemon cards + all major sets
 */

import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { RedditFetcher, SentimentProcessor, OutputFormatter } from '../packages/reddit-sentiment/src';
import * as path from 'path';

dotenv.config();

const prisma = new PrismaClient();

const SUBREDDITS = [
  'PokeInvesting', 'PokemonTCG', 'pkmntcgcollections', 'PKMNTCGDeals',
  'pkmntcgtrades', 'ptcgo', 'PokemonMisprints', 'pokemon', 'pokemoncardcollectors',
];

// Top 50 Pokemon cards for searching
const TOP_CARDS = [
  'Charizard', 'Charizard VMAX', 'Charizard ex', 'Charizard V',
  'Pikachu', 'Pikachu VMAX', 'Pikachu V', 'Pikachu ex',
  'Mewtwo', 'Mewtwo VSTAR', 'Mewtwo ex', 'Mewtwo V',
  'Umbreon VMAX', 'Umbreon V', 'Espeon VMAX',
  'Lugia', 'Lugia VSTAR', 'Lugia ex',
  'Gyarados', 'Rayquaza', 'Mew', 'Celebi',
  'Blastoise', 'Venusaur', 'Alakazam',
  'Gengar', 'Dragonite', 'Snorlax',
  'Eevee', 'Vaporeon', 'Jolteon', 'Flareon',
  'Zapdos', 'Moltres', 'Articuno',
  'Garchomp', 'Lucario', 'Dialga', 'Palkia',
  'Giratina', 'Darkrai', 'Cresselia',
  'Zacian', 'Zamazenta', 'Eternatus',
  'Koraidon', 'Miraidon',
];

// Major Pokemon TCG sets
const MAJOR_SETS = [
  'Base Set', 'Jungle', 'Fossil', 'Team Rocket',
  '151', 'Obsidian Flames', 'Paldea Evolved',
  'Scarlet Violet', 'Crown Zenith', 'Silver Tempest',
  'Lost Origin', 'Astral Radiance', 'Brilliant Stars',
  'Fusion Strike', 'Evolving Skies', 'Chilling Reign',
  'Battle Styles', 'Shining Fates', 'Vivid Voltage',
  'Champions Path', 'Darkness Ablaze', 'Rebel Clash',
  'Sword Shield', 'Cosmic Eclipse', 'Hidden Fates',
  'Unified Minds', 'Unbroken Bonds', 'Team Up',
  'Lost Thunder', 'Celestial Storm', 'Forbidden Light',
];

const ALL_SEARCH_TERMS = [...TOP_CARDS, ...MAJOR_SETS];

const OUTPUT_PATH = path.join(process.cwd(), 'data/training/reddit-sentiment-phase1.jsonl');

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   PHASE 1: EXPANDED SEARCH COLLECTION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Search terms: ${ALL_SEARCH_TERMS.length} (${TOP_CARDS.length} cards + ${MAJOR_SETS.length} sets)`);
  console.log(`Subreddits: ${SUBREDDITS.length} communities`);
  console.log('Strategy: Search all major cards and sets');
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
  const enhancedCardNames = [...new Set([...cardNames, ...TOP_CARDS])];
  console.log(`   ✓ Loaded ${enhancedCardNames.length} unique card names`);
  console.log('');

  // Initialize
  const fetcher = new RedditFetcher({
    clientId: process.env.REDDIT_CLIENT_ID!,
    clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    username: process.env.REDDIT_USERNAME!,
    password: process.env.REDDIT_PASSWORD!,
    userAgent: 'PokeDAO Phase 1 Collector v1.0',
  });

  const processor = new SentimentProcessor(enhancedCardNames);
  const formatter = new OutputFormatter();

  let allExamples: any[] = [];
  let searchCount = 0;
  const totalSearches = ALL_SEARCH_TERMS.length * SUBREDDITS.length;

  // For each subreddit
  for (const subreddit of SUBREDDITS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 Searching r/${subreddit}`);
    console.log('='.repeat(60));

    for (const term of ALL_SEARCH_TERMS) {
      searchCount++;

      if (searchCount % 10 === 0) {
        console.log(`\n   Progress: ${searchCount}/${totalSearches} searches (${Math.round(searchCount/totalSearches*100)}%)`);
      }

      try {
        const subredditObj = (fetcher as any).reddit.getSubreddit(subreddit);
        const results = await subredditObj.search({
          query: term,
          limit: 50, // 50 per term to avoid rate limits
          sort: 'relevance',
          time: 'all',
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

        if (posts.length > 0) {
          const processed = processor.processBatch(posts);

          if (processed.length > 0) {
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

      } catch (error: any) {
        if (!error.message.includes('403')) { // Ignore 403s
          console.error(`   ✗ Error searching "${term}":`, error.message);
        }
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
  console.log('   PHASE 1 COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n✅ Total unique examples: ${unique.length}`);
  console.log(`📁 Saved to: ${OUTPUT_PATH}`);
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
