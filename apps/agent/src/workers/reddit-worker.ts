/**
 * REDDIT SENTIMENT WORKER
 *
 * Collects posts from Pokemon TCG subreddits for sentiment analysis.
 * - r/pokemontcg
 * - r/pkmntcgtrades
 * - r/PokeInvesting
 *
 * Saves to SocialPost table with engagement metrics.
 * Runs every hour.
 * Uses simple keyword-based sentiment (no LLM needed).
 */

import crypto from 'crypto';
import { BaseWorker } from './base-worker.js';

const PARSER_VERSION = '1.0.0';

interface RedditPostData {
  redditId: string;
  subreddit: string;
  title: string;
  body: string;
  score: number;
  numComments: number;
  url: string;
  sentiment: number;
  sentimentLabel: string;
  mentionedCards: string[];
  createdAt: Date;
  raw: object;
}

export class RedditWorker extends BaseWorker {
  private subreddits = ['pokemontcg', 'pkmntcgtrades', 'PokeInvesting'];

  constructor() {
    super({
      name: 'reddit',
      cronPattern: '0 * * * *', // Every hour
      maxRetries: 3,
      retryDelayMs: 2000,
      timeoutMs: 120000,
    });
  }

  async run() {
    const prisma = await this.getPrisma();

    try {
      for (const subreddit of this.subreddits) {
        await this.fetchSubreddit(prisma, subreddit);
        await this.delay(1000); // Rate limit between subreddits
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  private async fetchSubreddit(prisma: any, subreddit: string) {
    console.log(`[reddit] Fetching r/${subreddit}...`);

    try {
      const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=100`, {
        headers: {
          'User-Agent': 'PokeDao/1.0 (Investment Alert Bot)'
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data = (await response.json()) as { data?: { children?: any[] } };
      const posts = data.data?.children || [];

      let newPosts = 0;
      let duplicates = 0;

      for (const post of posts) {
        const postData = post.data;
        const text = postData.title + ' ' + (postData.selftext || '');

        const sentiment = this.analyzeSentiment(text);
        const mentionedCards = this.extractCardMentions(text);

        const redditPost: RedditPostData = {
          redditId: postData.id,
          subreddit,
          title: postData.title,
          body: postData.selftext || '',
          score: postData.score,
          numComments: postData.num_comments,
          url: `https://reddit.com${postData.permalink}`,
          sentiment: sentiment.score,
          sentimentLabel: sentiment.label,
          mentionedCards,
          createdAt: new Date(postData.created_utc * 1000),
          raw: postData
        };

        // Calculate rawHash for deduplication
        const rawHash = crypto
          .createHash('sha256')
          .update(JSON.stringify({ id: redditPost.redditId, score: redditPost.score }))
          .digest('hex');

        // Save to SocialPost table
        try {
          const existing = await prisma.socialPost.findFirst({
            where: { sourceId: redditPost.redditId, platform: 'REDDIT' }
          });

          if (existing) {
            // Update engagement metrics
            await prisma.socialPost.update({
              where: { id: existing.id },
              data: {
                engagement: {
                  score: redditPost.score,
                  comments: redditPost.numComments
                },
                updatedAt: new Date()
              }
            });
            duplicates++;
          } else {
            // Create new
            await prisma.socialPost.create({
              data: {
                platform: 'REDDIT',
                sourceId: redditPost.redditId,
                sourceUrl: redditPost.url,
                author: postData.author || '[deleted]',
                content: redditPost.title + '\n\n' + redditPost.body.substring(0, 5000),
                timestamp: redditPost.createdAt,
                engagement: {
                  score: redditPost.score,
                  comments: redditPost.numComments,
                  upvoteRatio: postData.upvote_ratio
                },
                sentiment: redditPost.sentiment,
                sentimentLabel: redditPost.sentimentLabel,
                mentionedCards: redditPost.mentionedCards,
                raw: redditPost.raw as any,
                rawHash,
                parserVersion: PARSER_VERSION
              }
            });
            newPosts++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[reddit] Error saving post ${redditPost.redditId}:`, msg);
        }

        // Also keep legacy RedditPost table updated
        await this.saveLegacyRedditPost(prisma, redditPost);
      }

      console.log(
        `[reddit] r/${subreddit}: ${newPosts} new, ${duplicates} updated`
      );

      // Store aggregate stats in Redis
      const avgSentiment =
        posts.reduce((sum: number, p: any) => {
          const text = p.data.title + ' ' + (p.data.selftext || '');
          return sum + this.analyzeSentiment(text).score;
        }, 0) / Math.max(posts.length, 1);

      await this.redis.hset(`reddit:${subreddit}:stats`, {
        lastFetch: new Date().toISOString(),
        postCount: (newPosts + duplicates).toString(),
        avgSentiment: avgSentiment.toFixed(3)
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[reddit] Error fetching r/${subreddit}:`, msg);
    }
  }

  private async saveLegacyRedditPost(prisma: any, post: RedditPostData) {
    try {
      await prisma.redditPost.upsert({
        where: { redditId: post.redditId },
        create: {
          redditId: post.redditId,
          subreddit: post.subreddit,
          title: post.title,
          body: post.body.substring(0, 10000),
          score: post.score,
          numComments: post.numComments,
          url: post.url,
          sentiment: post.sentiment,
          sentimentLabel: post.sentimentLabel,
          mentionedCards: post.mentionedCards,
          createdAt: post.createdAt
        },
        update: {
          score: post.score,
          numComments: post.numComments,
          updatedAt: new Date()
        }
      });
    } catch {
      // Legacy table might not exist, ignore
    }
  }

  private analyzeSentiment(text: string): { score: number; label: string } {
    const lower = text.toLowerCase();

    // Positive indicators
    const positiveWords = [
      'buy',
      'bought',
      'investing',
      'investment',
      'bullish',
      'moon',
      'undervalued',
      'gem',
      'hidden gem',
      'rare',
      'grail',
      'steal',
      'amazing deal',
      'pickup',
      'excited',
      'beautiful',
      'love',
      'great'
    ];

    // Negative indicators
    const negativeWords = [
      'sell',
      'sold',
      'selling',
      'bearish',
      'overpriced',
      'overvalued',
      'dump',
      'dumping',
      'avoid',
      'scam',
      'fake',
      'counterfeit',
      'reprint',
      'crash',
      'bubble',
      'disappointed',
      'regret'
    ];

    let score = 0;

    for (const word of positiveWords) {
      if (lower.includes(word)) score += 1;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) score -= 1;
    }

    // Normalize to -1 to 1 range
    const normalized = Math.max(-1, Math.min(1, score / 5));

    return {
      score: normalized,
      label: normalized > 0.2 ? 'BULLISH' : normalized < -0.2 ? 'BEARISH' : 'NEUTRAL'
    };
  }

  private extractCardMentions(text: string): string[] {
    const lower = text.toLowerCase();
    const mentions = new Set<string>();

    // Popular Pokemon card names
    const cardNames = [
      'charizard',
      'pikachu',
      'mewtwo',
      'blastoise',
      'venusaur',
      'gengar',
      'mew',
      'lugia',
      'ho-oh',
      'rayquaza',
      'umbreon',
      'espeon',
      'gyarados',
      'dragonite',
      'snorlax',
      'alakazam',
      'machamp',
      'eevee'
    ];

    // Set names
    const setNames = [
      'base set',
      'jungle',
      'fossil',
      'team rocket',
      'neo genesis',
      'neo discovery',
      'neo revelation',
      'neo destiny',
      'legendary collection',
      'skyridge',
      'aquapolis',
      'expedition',
      'gold star',
      'illustrator'
    ];

    for (const name of cardNames) {
      if (lower.includes(name)) {
        mentions.add(name);
      }
    }

    for (const set of setNames) {
      if (lower.includes(set)) {
        mentions.add(set.replace(/\s+/g, '-'));
      }
    }

    return Array.from(mentions);
  }
}

export const redditWorker = new RedditWorker();
