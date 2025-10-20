/**
 * Reddit Sentiment Extraction Module
 * Extracts Pokemon TCG community sentiment from Reddit for Mew-1A training
 */

export { RedditFetcher } from './RedditFetcher';
export { SentimentProcessor } from './SentimentProcessor';
export { OutputFormatter } from './OutputFormatter';

export * from './types';

// Main workflow function
import { RedditFetcher } from './RedditFetcher';
import { SentimentProcessor } from './SentimentProcessor';
import { OutputFormatter } from './OutputFormatter';
import { ProcessedRedditData, Mew1ATrainingExample } from './types';

export interface RedditSentimentConfig {
  reddit: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
    userAgent: string;
  };
  subreddits: string[];
  cardNames: string[];
  outputPath: string;
  limit?: number;
  includeInvestment?: boolean;
}

/**
 * Main workflow: Fetch, process, and export Reddit sentiment data
 */
export async function collectRedditSentiment(
  config: RedditSentimentConfig
): Promise<Mew1ATrainingExample[]> {
  console.log('🚀 Starting Reddit Sentiment Collection');
  console.log(`   Subreddits: ${config.subreddits.join(', ')}`);
  console.log(`   Card names: ${config.cardNames.length}`);
  console.log(`   Output: ${config.outputPath}`);
  console.log('');

  // Initialize components
  const fetcher = new RedditFetcher(config.reddit);
  const processor = new SentimentProcessor(config.cardNames);
  const formatter = new OutputFormatter();

  // Fetch posts and comments
  console.log('📥 Fetching Reddit data...');
  const posts = await fetcher.fetchFromMultipleSubreddits(config.subreddits, {
    limit: config.limit || 100,
    sort: 'new',
  });

  const comments = await fetcher.fetchCommentsFromMultiple(config.subreddits, {
    limit: config.limit || 100,
  });

  console.log(`   ✓ Fetched ${posts.length} posts and ${comments.length} comments`);
  console.log('');

  // Process and filter
  console.log('🔍 Processing sentiment...');
  const allItems = [...posts, ...comments];
  const processed = processor.processBatch(allItems);

  console.log(`   ✓ Found ${processed.length} items mentioning Pokemon cards`);

  // Get statistics
  const stats = processor.getBatchStatistics(processed);
  console.log(`   Sentiment: ${stats.positive} positive, ${stats.negative} negative, ${stats.neutral} neutral`);
  console.log('');

  // Convert to training format
  console.log('📝 Formatting for Mew-1A training...');
  const processedData: ProcessedRedditData[] = processed.map(p => ({
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

  const examples = formatter.batchFormat(processedData, config.includeInvestment);

  // Write to JSONL
  await formatter.writeToJSONL(examples, config.outputPath);

  console.log('');
  console.log('✅ Reddit sentiment collection complete!');
  console.log(`   Total examples: ${examples.length}`);
  console.log(`   Saved to: ${config.outputPath}`);

  return examples;
}

/**
 * Incremental update: Fetch only new data since last run
 */
export async function incrementalUpdate(
  config: RedditSentimentConfig,
  lastTimestamp: number
): Promise<Mew1ATrainingExample[]> {
  console.log('🔄 Starting incremental update');
  console.log(`   Since: ${new Date(lastTimestamp * 1000).toISOString()}`);
  console.log('');

  const fetcher = new RedditFetcher(config.reddit);
  const processor = new SentimentProcessor(config.cardNames);
  const formatter = new OutputFormatter();

  // Fetch new posts since last timestamp
  const allPosts = [];
  for (const subreddit of config.subreddits) {
    const posts = await fetcher.fetchPostsSince(subreddit, lastTimestamp, 100);
    allPosts.push(...posts);
  }

  console.log(`   ✓ Fetched ${allPosts.length} new posts`);

  // Process
  const processed = processor.processBatch(allPosts);
  console.log(`   ✓ Found ${processed.length} relevant items`);

  // Format
  const processedData: ProcessedRedditData[] = processed.map(p => ({
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

  const examples = formatter.batchFormat(processedData, config.includeInvestment);

  // Append to existing file
  await formatter.appendToJSONL(examples, config.outputPath);

  console.log('✅ Incremental update complete!');
  console.log(`   New examples: ${examples.length}`);

  return examples;
}
