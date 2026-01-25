/**
 * REDDIT SCRAPER
 * Scrapes Pokemon TCG discussions from r/PokeInvesting and r/PokemonTCG
 * Uses Reddit's unofficial .json API (no authentication required)
 */

import prisma from './prisma.js';
import { createHash } from 'crypto';

// Configuration with defaults
const CONFIG = {
  userAgent: process.env.REDDIT_USER_AGENT || 'PokeDAO/1.0 (TCG Market Analysis Bot)',
  maxRetries: Number(process.env.REDDIT_MAX_RETRIES || 3),
  retryBackoffMs: Number(process.env.REDDIT_RETRY_BACKOFF_MS || 1000),
  requestTimeoutMs: Number(process.env.REDDIT_REQUEST_TIMEOUT_MS || 10000),
  rateLimitDelayMs: Number(process.env.REDDIT_RATE_LIMIT_DELAY_MS || 100),
  subreddits: ['PokeInvesting', 'PokemonTCG'],
};

// Circuit breaker state
let circuitOpen = false;
let lastFailureTime = 0;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reset circuit breaker state (for testing purposes)
 */
export function resetCircuitBreaker(): void {
  circuitOpen = false;
  lastFailureTime = 0;
}

// Legacy exports for backward compatibility
const USER_AGENT = CONFIG.userAgent;
const SUBREDDITS = CONFIG.subreddits;

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  subreddit: string;
}

interface RedditResponse {
  data: {
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
    after: string | null;
  };
}

/**
 * Helper function for exponential backoff sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic and circuit breaker
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Circuit breaker check
  if (circuitOpen) {
    if (Date.now() - lastFailureTime < CIRCUIT_RESET_MS) {
      throw new Error('Circuit breaker is open - Reddit API temporarily unavailable');
    }
    // Try to reset circuit
    circuitOpen = false;
    console.log('[reddit-scraper] Circuit breaker reset, retrying...');
  }

  let lastError: Error | null = null;
  let consecutiveFailures = 0;

  for (let attempt = 0; attempt < CONFIG.maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': CONFIG.userAgent,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * CONFIG.retryBackoffMs;

        console.warn(`[reddit-scraper] Rate limited (429), waiting ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // Handle server errors (5xx)
      if (response.status >= 500) {
        consecutiveFailures++;
        const waitTime = Math.pow(2, attempt) * CONFIG.retryBackoffMs;
        console.warn(`[reddit-scraper] Server error (${response.status}), retrying in ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // Success - reset failure count
      consecutiveFailures = 0;
      return response;
    } catch (error: any) {
      lastError = error;
      consecutiveFailures++;

      // Check if it's an abort (timeout)
      if (error.name === 'AbortError') {
        console.warn(`[reddit-scraper] Request timeout, attempt ${attempt + 1}/${CONFIG.maxRetries}`);
      } else {
        console.warn(`[reddit-scraper] Network error: ${error.message}, attempt ${attempt + 1}/${CONFIG.maxRetries}`);
      }

      // Exponential backoff
      if (attempt < CONFIG.maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * CONFIG.retryBackoffMs;
        await sleep(waitTime);
      }
    }
  }

  // Open circuit breaker after exhausting retries
  if (consecutiveFailures >= CONFIG.maxRetries) {
    circuitOpen = true;
    lastFailureTime = Date.now();
    console.error('[reddit-scraper] Circuit breaker opened due to repeated failures');
  }

  throw lastError || new Error('Failed to fetch after retries');
}

/**
 * Fetch posts from a subreddit using Reddit's .json API
 */
export async function fetchSubredditPosts(
  subreddit: string,
  limit: number = 100,
  sort: 'hot' | 'new' | 'top' = 'hot'
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const data: RedditResponse = await response.json();
    return data.data.children.map((child) => child.data);
  } catch (error: any) {
    console.error(`[reddit-scraper] Failed to fetch r/${subreddit}: ${error.message}`);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Extract card mentions from Reddit post
 */
export function extractCardMentions(text: string): Array<{ cardName: string; setName?: string }> {
  const mentions: Array<{ cardName: string; setName?: string }> = [];

  // Common Pokemon card names
  const cardNames = [
    'Charizard',
    'Pikachu',
    'Mew',
    'Mewtwo',
    'Lugia',
    'Rayquaza',
    'Umbreon',
    'Espeon',
    'Blastoise',
    'Venusaur',
    'Gyarados',
    'Dragonite',
    'Gengar',
    'Alakazam',
    'Machamp',
    'Eevee',
  ];

  // Common set names
  const setNames = [
    'Base Set',
    'Jungle',
    'Fossil',
    'Team Rocket',
    'Obsidian Flames',
    'Paldean Fates',
    'Stellar Crown',
    'Surging Sparks',
    'Prismatic Evolutions',
    'Hidden Fates',
    'Shining Fates',
    'Champion\'s Path',
    '151',
    'Evolving Skies',
  ];

  const lowerText = text.toLowerCase();

  // Find card names
  for (const cardName of cardNames) {
    if (lowerText.includes(cardName.toLowerCase())) {
      // Try to find associated set
      let setName: string | undefined;
      for (const set of setNames) {
        if (lowerText.includes(set.toLowerCase())) {
          setName = set;
          break;
        }
      }
      mentions.push({ cardName, setName });
    }
  }

  return mentions;
}

/**
 * Analyze sentiment of Reddit post using DeepSeek
 */
export async function analyzeSentiment(
  text: string,
  deepseekApiKey: string
): Promise<{ sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; score: number; confidence: number; keyPhrases: string[] }> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a sentiment analysis expert for Pokemon TCG investment discussions. Analyze the sentiment and extract key investment phrases.',
        },
        {
          role: 'user',
          content: `Analyze this Reddit post about Pokemon cards and return ONLY a JSON object with this exact format:
{
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "score": number between -1.0 (very bearish) and 1.0 (very bullish),
  "confidence": number between 0.0 and 1.0,
  "keyPhrases": [array of 3-5 key investment-related phrases from the text]
}

Post text:
${text.substring(0, 1000)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data: any = await response.json();
  const content = data.choices[0].message.content;

  // Parse JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback to neutral if parsing fails
    return {
      sentiment: 'NEUTRAL',
      score: 0,
      confidence: 0.5,
      keyPhrases: [],
    };
  }

  const result = JSON.parse(jsonMatch[0]);
  return result;
}

/**
 * Scrape Reddit and store signals in database
 */
export async function scrapeRedditSignals(deepseekApiKey: string): Promise<number> {
  console.log('🔍 Scraping Reddit for Pokemon TCG discussions...');
  console.log('');

  let totalSignals = 0;
  let errors = 0;

  for (const subreddit of SUBREDDITS) {
    console.log(`Fetching r/${subreddit}...`);

    const posts = await fetchSubredditPosts(subreddit, 100, 'hot');

    if (posts.length === 0) {
      console.log(`  No posts retrieved (possibly rate limited or error)`);
      continue;
    }

    console.log(`  Found ${posts.length} posts`);

    for (const post of posts) {
      try {
        // Extract card mentions
        const mentions = extractCardMentions(post.title + ' ' + post.selftext);

        if (mentions.length === 0) continue;

        // Analyze sentiment with error handling
        let sentiment;
        try {
          sentiment = await analyzeSentiment(post.title + ' ' + post.selftext, deepseekApiKey);
        } catch (sentimentError: any) {
          console.warn(`[reddit-scraper] Sentiment analysis failed for post ${post.id}: ${sentimentError.message}`);
          // Use neutral sentiment as fallback
          sentiment = {
            sentiment: 'NEUTRAL' as const,
            score: 0,
            confidence: 0.3,
            keyPhrases: [],
          };
        }

        // Store signal for each card mention
        for (const mention of mentions) {
          const id = createHash('sha256')
            .update(`${subreddit}::${post.id}::${mention.cardName}`)
            .digest('hex')
            .substring(0, 32);

          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          await prisma.redditSignal.upsert({
            where: {
              subreddit_postId_cardName: {
                subreddit,
                postId: post.id,
                cardName: mention.cardName,
              },
            },
            create: {
              id,
              cardName: mention.cardName,
              setName: mention.setName,
              subreddit,
              postId: post.id,
              postTitle: post.title,
              postUrl: `https://www.reddit.com${post.permalink}`,
              author: post.author,
              score: post.score,
              numComments: post.num_comments,
              sentiment: sentiment.sentiment,
              sentimentScore: sentiment.score,
              confidence: sentiment.confidence,
              discussionVolume: 1,
              keyPhrases: sentiment.keyPhrases,
              expiresAt,
            },
            update: {
              score: post.score,
              numComments: post.num_comments,
              sentiment: sentiment.sentiment,
              sentimentScore: sentiment.score,
              confidence: sentiment.confidence,
              keyPhrases: sentiment.keyPhrases,
            },
          });

          totalSignals++;
        }

        // Rate limit: Wait between posts to avoid throttling
        await sleep(CONFIG.rateLimitDelayMs);
      } catch (postError: any) {
        errors++;
        console.error(`[reddit-scraper] Error processing post ${post.id}: ${postError.message}`);
        // Continue to next post
      }
    }

    console.log('');
  }

  if (errors > 0) {
    console.warn(`[reddit-scraper] Completed with ${errors} errors`);
  }

  return totalSignals;
}

/**
 * Get Reddit sentiment for a specific card
 */
export async function getRedditSentiment(cardName: string): Promise<{
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;
  confidence: number;
  discussionVolume: number;
  topPosts: Array<{ title: string; url: string; score: number }>;
}> {
  const signals = await prisma.redditSignal.findMany({
    where: {
      cardName: {
        equals: cardName,
        mode: 'insensitive',
      },
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      score: 'desc',
    },
    take: 10,
  });

  if (signals.length === 0) {
    return {
      sentiment: 'NEUTRAL',
      score: 0,
      confidence: 0,
      discussionVolume: 0,
      topPosts: [],
    };
  }

  // Aggregate sentiment
  const avgScore = signals.reduce((sum: number, s) => sum + s.sentimentScore, 0) / signals.length;
  const avgConfidence = signals.reduce((sum: number, s) => sum + s.confidence, 0) / signals.length;

  // Determine overall sentiment
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (avgScore > 0.3) sentiment = 'BULLISH';
  else if (avgScore < -0.3) sentiment = 'BEARISH';
  else sentiment = 'NEUTRAL';

  return {
    sentiment,
    score: avgScore,
    confidence: avgConfidence,
    discussionVolume: signals.length,
    topPosts: signals.slice(0, 3).map((s) => ({
      title: s.postTitle,
      url: s.postUrl,
      score: s.score,
    })),
  };
}

/**
 * Cleanup expired Reddit signals
 */
export async function cleanupExpiredSignals(): Promise<number> {
  const result = await prisma.redditSignal.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
