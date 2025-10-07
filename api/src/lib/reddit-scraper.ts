/**
 * REDDIT SCRAPER
 * Scrapes Pokemon TCG discussions from r/PokeInvesting and r/PokemonTCG
 * Uses Reddit's unofficial .json API (no authentication required)
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const USER_AGENT = 'PokeDAO/1.0 (TCG Market Analysis Bot)';
const SUBREDDITS = ['PokeInvesting', 'PokemonTCG'];

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
 * Fetch posts from a subreddit using Reddit's .json API
 */
export async function fetchSubredditPosts(
  subreddit: string,
  limit: number = 100,
  sort: 'hot' | 'new' | 'top' = 'hot'
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  const data: RedditResponse = await response.json();
  return data.data.children.map((child) => child.data);
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

  for (const subreddit of SUBREDDITS) {
    console.log(`Fetching r/${subreddit}...`);

    const posts = await fetchSubredditPosts(subreddit, 100, 'hot');
    console.log(`  Found ${posts.length} posts`);

    for (const post of posts) {
      // Extract card mentions
      const mentions = extractCardMentions(post.title + ' ' + post.selftext);

      if (mentions.length === 0) continue;

      // Analyze sentiment
      const sentiment = await analyzeSentiment(post.title + ' ' + post.selftext, deepseekApiKey);

      // Store signal for each card mention
      for (const mention of mentions) {
        const id = createHash('sha256')
          .update(`${subreddit}::${post.id}::${mention.cardName}`)
          .digest('hex')
          .substring(0, 32);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await prisma.redditSignal.upsert({
          where: { id },
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

      // Rate limit: Wait 100ms between posts to avoid throttling
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('');
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
  const avgScore = signals.reduce((sum, s) => sum + s.sentimentScore, 0) / signals.length;
  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

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
