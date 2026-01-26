/**
 * REDDIT SENTIMENT WORKER
 *
 * Collects posts from Pokemon TCG subreddits for sentiment analysis.
 * - r/pokemontcg
 * - r/pkmntcgtrades
 * - r/PokeInvesting
 *
 * Saves to RedditSignal table with engagement metrics.
 * Runs every hour.
 * Uses simple keyword-based sentiment (no LLM needed).
 */

import { randomUUID } from 'crypto';
import { BaseWorker } from './base-worker.js';

interface RedditPostData {
  redditId: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  score: number;
  numComments: number;
  url: string;
  sentiment: number;
  sentimentLabel: string;
  mentionedCards: string[];
  keyPhrases: string[];
  createdAt: Date;
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

        const keyPhrases = this.extractKeyPhrases(text);
        const redditPost: RedditPostData = {
          redditId: postData.id,
          subreddit,
          title: postData.title,
          body: postData.selftext || '',
          author: postData.author || '[deleted]',
          score: postData.score,
          numComments: postData.num_comments,
          url: `https://reddit.com${postData.permalink}`,
          sentiment: sentiment.score,
          sentimentLabel: sentiment.label,
          mentionedCards,
          keyPhrases,
          createdAt: new Date(postData.created_utc * 1000),
        };

        // Save to RedditSignal table - one signal per mentioned card
        // If no cards mentioned, create a general signal
        const cardsToProcess = mentionedCards.length > 0 ? mentionedCards : ['general'];

        try {
          for (const cardName of cardsToProcess) {
            const signalId = `reddit:${redditPost.redditId}:${cardName}`;

            // Check if signal already exists
            const existing = await prisma.redditSignal.findUnique({
              where: { id: signalId }
            });

            if (existing) {
              // Update engagement metrics
              await prisma.redditSignal.update({
                where: { id: signalId },
                data: {
                  score: redditPost.score,
                  numComments: redditPost.numComments,
                  scrapedAt: new Date()
                }
              });
              duplicates++;
            } else {
              // Create new signal
              await prisma.redditSignal.create({
                data: {
                  id: signalId,
                  cardName: cardName === 'general' ? 'Pokemon TCG' : cardName,
                  setName: null,
                  subreddit: redditPost.subreddit,
                  postId: redditPost.redditId,
                  postTitle: redditPost.title.substring(0, 500),
                  postUrl: redditPost.url,
                  author: redditPost.author,
                  score: redditPost.score,
                  numComments: redditPost.numComments,
                  sentiment: redditPost.sentimentLabel,
                  sentimentScore: redditPost.sentiment,
                  confidence: Math.min(1, Math.abs(redditPost.sentiment) + 0.3),
                  discussionVolume: 1,
                  keyPhrases: redditPost.keyPhrases,
                  createdAt: redditPost.createdAt,
                  scrapedAt: new Date(),
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                }
              });
              newPosts++;
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[reddit] Error saving post ${redditPost.redditId}:`, msg);
        }
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

  private extractKeyPhrases(text: string): string[] {
    const lower = text.toLowerCase();
    const phrases = new Set<string>();

    // Investment-related phrases
    const investmentPhrases = [
      'investment', 'investing', 'buy', 'sell', 'hold',
      'bullish', 'bearish', 'undervalued', 'overvalued',
      'price prediction', 'market', 'speculation',
      'long term', 'short term', 'portfolio'
    ];

    for (const phrase of investmentPhrases) {
      if (lower.includes(phrase)) {
        phrases.add(phrase);
      }
    }

    return Array.from(phrases).slice(0, 10); // Max 10 phrases
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
