/**
 * RedditFetcher: Handles API integration with Reddit and Pushshift
 */

import Snoowrap from 'snoowrap';
import { RedditPost, RedditComment, FetchOptions } from './types';

export class RedditFetcher {
  private reddit: Snoowrap;
  private rateLimitDelay = 2000; // 2 seconds between requests

  constructor(credentials: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
    userAgent: string;
  }) {
    this.reddit = new Snoowrap({
      userAgent: credentials.userAgent,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
    });

    // Disable warnings for large listings
    this.reddit.config({ warnings: false, continueAfterRatelimitError: true });
  }

  /**
   * Fetch posts from a subreddit
   */
  async fetchPosts(options: FetchOptions): Promise<RedditPost[]> {
    const { subreddit, limit = 100, sort = 'new' } = options;

    console.log(`Fetching posts from r/${subreddit} (${sort}, limit: ${limit})...`);

    try {
      const subredditObj = this.reddit.getSubreddit(subreddit);
      let listing;

      switch (sort) {
        case 'new':
          listing = await subredditObj.getNew({ limit });
          break;
        case 'hot':
          listing = await subredditObj.getHot({ limit });
          break;
        case 'top':
          listing = await subredditObj.getTop({
            limit,
            time: options.timeframe || 'week'
          });
          break;
        default:
          listing = await subredditObj.getNew({ limit });
      }

      await this.delay(this.rateLimitDelay);

      return listing.map((post: any) => ({
        id: post.id,
        subreddit: post.subreddit.display_name,
        author: post.author.name,
        title: post.title,
        selftext: post.selftext || '',
        score: post.score,
        created_utc: post.created_utc,
        permalink: `https://reddit.com${post.permalink}`,
      }));
    } catch (error) {
      console.error(`Error fetching posts from r/${subreddit}:`, error);
      throw error;
    }
  }

  /**
   * Fetch comments from a subreddit
   */
  async fetchComments(options: FetchOptions): Promise<RedditComment[]> {
    const { subreddit, limit = 100 } = options;

    console.log(`Fetching comments from r/${subreddit} (limit: ${limit})...`);

    try {
      const subredditObj = this.reddit.getSubreddit(subreddit);
      const comments = await subredditObj.getNewComments({ limit });

      await this.delay(this.rateLimitDelay);

      return comments.map((comment: any) => ({
        id: comment.id,
        subreddit: comment.subreddit.display_name,
        author: comment.author.name,
        body: comment.body,
        score: comment.score,
        created_utc: comment.created_utc,
        permalink: `https://reddit.com${comment.permalink}`,
        link_id: comment.link_id,
      }));
    } catch (error) {
      console.error(`Error fetching comments from r/${subreddit}:`, error);
      throw error;
    }
  }

  /**
   * Fetch posts from multiple subreddits
   */
  async fetchFromMultipleSubreddits(
    subreddits: string[],
    options: Omit<FetchOptions, 'subreddit'>
  ): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];

    for (const subreddit of subreddits) {
      try {
        const posts = await this.fetchPosts({ ...options, subreddit });
        allPosts.push(...posts);
        console.log(`  ✓ Fetched ${posts.length} posts from r/${subreddit}`);
      } catch (error) {
        console.error(`  ✗ Failed to fetch from r/${subreddit}`);
      }
    }

    return allPosts;
  }

  /**
   * Fetch comments from multiple subreddits
   */
  async fetchCommentsFromMultiple(
    subreddits: string[],
    options: Omit<FetchOptions, 'subreddit'>
  ): Promise<RedditComment[]> {
    const allComments: RedditComment[] = [];

    for (const subreddit of subreddits) {
      try {
        const comments = await this.fetchComments({ ...options, subreddit });
        allComments.push(...comments);
        console.log(`  ✓ Fetched ${comments.length} comments from r/${subreddit}`);
      } catch (error) {
        console.error(`  ✗ Failed to fetch comments from r/${subreddit}`);
      }
    }

    return allComments;
  }

  /**
   * Fetch posts since a specific timestamp
   */
  async fetchPostsSince(
    subreddit: string,
    sinceTimestamp: number,
    batchSize = 100
  ): Promise<RedditPost[]> {
    const posts: RedditPost[] = [];
    let lastPostId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      try {
        const subredditObj = this.reddit.getSubreddit(subreddit);
        const listing = await subredditObj.getNew({
          limit: batchSize,
          ...(lastPostId && { before: lastPostId }),
        });

        await this.delay(this.rateLimitDelay);

        if (listing.length === 0) {
          hasMore = false;
          break;
        }

        for (const post of listing) {
          if (post.created_utc < sinceTimestamp) {
            hasMore = false;
            break;
          }

          posts.push({
            id: post.id,
            subreddit: post.subreddit.display_name,
            author: post.author.name,
            title: post.title,
            selftext: post.selftext || '',
            score: post.score,
            created_utc: post.created_utc,
            permalink: `https://reddit.com${post.permalink}`,
          });
        }

        lastPostId = listing[listing.length - 1]?.name;

        console.log(`  Fetched ${posts.length} posts so far...`);
      } catch (error) {
        console.error('Error in incremental fetch:', error);
        hasMore = false;
      }
    }

    return posts;
  }

  /**
   * Fetch using Pushshift API for historical data
   */
  async fetchFromPushshift(
    subreddit: string,
    after: string,
    before: string,
    type: 'submission' | 'comment' = 'submission',
    size = 500
  ): Promise<any[]> {
    const baseUrl = 'https://api.pushshift.io/reddit/search';
    const url = `${baseUrl}/${type}?subreddit=${subreddit}&after=${after}&before=${before}&size=${size}`;

    console.log(`Fetching from Pushshift: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Pushshift API error: ${response.status}`);
      }

      const data = await response.json() as { data?: any[] };

      await this.delay(1000); // Be respectful to Pushshift API

      return data.data || [];
    } catch (error) {
      console.error('Error fetching from Pushshift:', error);
      return [];
    }
  }

  /**
   * Fetch historical data in batches using Pushshift
   */
  async fetchHistoricalBatch(
    subreddit: string,
    startDate: Date,
    endDate: Date,
    type: 'submission' | 'comment' = 'submission'
  ): Promise<any[]> {
    const afterTimestamp = Math.floor(startDate.getTime() / 1000);
    const beforeTimestamp = Math.floor(endDate.getTime() / 1000);

    const after = afterTimestamp.toString();
    const before = beforeTimestamp.toString();

    console.log(
      `Fetching historical ${type}s from r/${subreddit} between ${startDate.toISOString()} and ${endDate.toISOString()}`
    );

    const allData: any[] = [];
    let currentAfter = after;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.fetchFromPushshift(
        subreddit,
        currentAfter,
        before,
        type,
        500
      );

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      allData.push(...batch);

      // Update currentAfter to the last item's timestamp
      const lastTimestamp = batch[batch.length - 1].created_utc;
      currentAfter = lastTimestamp.toString();

      console.log(`  Fetched ${allData.length} items so far...`);

      // Stop if we've reached the end
      if (batch.length < 500) {
        hasMore = false;
      }
    }

    return allData;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
