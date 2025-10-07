/**
 * TEST REDDIT SCRAPER
 * Tests fetching posts from Reddit and analyzing sentiment
 */

import { fetchSubredditPosts, extractCardMentions, analyzeSentiment, scrapeRedditSignals, getRedditSentiment } from '../api/src/lib/reddit-scraper.js';

async function testRedditScraper() {
  console.log('🧪 TESTING REDDIT SCRAPER');
  console.log('='.repeat(80));
  console.log('');

  // Step 1: Test fetching posts
  console.log('Step 1: Fetch posts from r/PokeInvesting');
  console.log('-'.repeat(80));

  try {
    const posts = await fetchSubredditPosts('PokeInvesting', 10, 'hot');
    console.log(`✅ Fetched ${posts.length} posts`);
    console.log('');

    // Show first 3 posts
    console.log('Sample posts:');
    posts.slice(0, 3).forEach((post, i) => {
      console.log(`  ${i + 1}. ${post.title}`);
      console.log(`     Score: ${post.score} | Comments: ${post.num_comments}`);
      console.log(`     URL: https://www.reddit.com${post.permalink}`);
      console.log('');
    });

    // Step 2: Test card extraction
    console.log('Step 2: Extract card mentions');
    console.log('-'.repeat(80));

    for (const post of posts.slice(0, 5)) {
      const mentions = extractCardMentions(post.title + ' ' + post.selftext);
      if (mentions.length > 0) {
        console.log(`Post: "${post.title}"`);
        console.log(`  Cards mentioned: ${mentions.map((m) => `${m.cardName}${m.setName ? ` (${m.setName})` : ''}`).join(', ')}`);
        console.log('');
      }
    }

    // Step 3: Test sentiment analysis (if DeepSeek key available)
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      console.log('Step 3: Analyze sentiment');
      console.log('-'.repeat(80));

      const testPost = posts.find((p) => extractCardMentions(p.title + ' ' + p.selftext).length > 0);
      if (testPost) {
        console.log(`Analyzing: "${testPost.title}"`);
        const sentiment = await analyzeSentiment(testPost.title + ' ' + testPost.selftext, deepseekKey);
        console.log(`  Sentiment: ${sentiment.sentiment}`);
        console.log(`  Score: ${sentiment.score.toFixed(2)} (-1 = bearish, +1 = bullish)`);
        console.log(`  Confidence: ${(sentiment.confidence * 100).toFixed(0)}%`);
        console.log(`  Key Phrases: ${sentiment.keyPhrases.join(', ')}`);
        console.log('');
      }

      // Step 4: Full scrape (optional - commented out to avoid rate limits)
      console.log('Step 4: Full Reddit scrape (skipped - uncomment to test)');
      console.log('-'.repeat(80));
      console.log('  To test full scrape, uncomment the scrapeRedditSignals() call');
      console.log('  This will scrape both subreddits and store signals in the database');
      console.log('');

      // Uncomment to test full scrape:
      // const signalCount = await scrapeRedditSignals(deepseekKey);
      // console.log(`✅ Stored ${signalCount} Reddit signals in database`);

    } else {
      console.log('⚠️  DEEPSEEK_API_KEY not set - skipping sentiment analysis');
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('✅ REDDIT SCRAPER TEST COMPLETE');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testRedditScraper();
