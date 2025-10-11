import { describe, it, expect, beforeAll } from 'vitest';
import { getRedditSentiment } from '../reddit-scraper.js';
import prisma from '../prisma.js';

describe('Reddit Sentiment - Real Database Tests', () => {
  const now = Date.now();
  const testCardBullish = `TestBullishCard_${now}`;
  const testCardBearish = `TestBearishCard_${now}`;
  const testCardNeutral = `TestNeutralCard_${now}`;

  beforeAll(async () => {
    // Bullish signals
    await prisma.redditSignal.create({
      data: {
        id: `test_bullish1_${now}`,
        cardName: testCardBullish,
        setName: 'Base Set',
        subreddit: 'PokeInvesting',
        postId: `test1_${now}`,
        postTitle: 'Card is going to moon!',
        postUrl: `https://reddit.com/test1_${now}`,
        author: 'testuser1',
        score: 150,
        numComments: 75,
        sentiment: 'BULLISH',
        sentimentScore: 0.9,
        confidence: 0.95,
        discussionVolume: 1,
        keyPhrases: ['moon', 'bullish', 'buy'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.redditSignal.create({
      data: {
        id: `test_bullish2_${now}`,
        cardName: testCardBullish,
        setName: 'Base Set',
        subreddit: 'PokemonTCG',
        postId: `test2_${now}`,
        postTitle: 'Best investment ever',
        postUrl: `https://reddit.com/test2_${now}`,
        author: 'testuser2',
        score: 200,
        numComments: 100,
        sentiment: 'BULLISH',
        sentimentScore: 0.85,
        confidence: 0.9,
        discussionVolume: 1,
        keyPhrases: ['investment', 'bullish'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Bearish signals
    await prisma.redditSignal.create({
      data: {
        id: `test_bearish1_${now}`,
        cardName: testCardBearish,
        subreddit: 'PokeInvesting',
        postId: `test3_${now}`,
        postTitle: 'Prices crashing',
        postUrl: `https://reddit.com/test3_${now}`,
        author: 'testuser3',
        score: 80,
        numComments: 40,
        sentiment: 'BEARISH',
        sentimentScore: -0.8,
        confidence: 0.85,
        discussionVolume: 1,
        keyPhrases: ['crash', 'sell', 'bearish'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.redditSignal.create({
      data: {
        id: `test_bearish2_${now}`,
        cardName: testCardBearish,
        subreddit: 'PokemonTCG',
        postId: `test4_${now}`,
        postTitle: 'Avoid this card',
        postUrl: `https://reddit.com/test4_${now}`,
        author: 'testuser4',
        score: 120,
        numComments: 60,
        sentiment: 'BEARISH',
        sentimentScore: -0.7,
        confidence: 0.8,
        discussionVolume: 1,
        keyPhrases: ['avoid', 'pass'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Neutral signals
    await prisma.redditSignal.create({
      data: {
        id: `test_neutral_${now}`,
        cardName: testCardNeutral,
        subreddit: 'PokeInvesting',
        postId: `test5_${now}`,
        postTitle: 'Card discussion',
        postUrl: `https://reddit.com/test5_${now}`,
        author: 'testuser5',
        score: 50,
        numComments: 25,
        sentiment: 'NEUTRAL',
        sentimentScore: 0,
        confidence: 0.6,
        discussionVolume: 1,
        keyPhrases: ['discussion'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  });

  it('should return BULLISH sentiment for cards with positive signals', async () => {
    const result = await getRedditSentiment(testCardBullish);

    expect(result.sentiment).toBe('BULLISH');
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.discussionVolume).toBeGreaterThanOrEqual(2);
    expect(result.topPosts.length).toBeGreaterThan(0);
    expect(result.topPosts.length).toBeLessThanOrEqual(3);

    console.log('✓ Bullish sentiment detected:', result);
  });

  it('should return BEARISH sentiment for cards with negative signals', async () => {
    const result = await getRedditSentiment(testCardBearish);

    expect(result.sentiment).toBe('BEARISH');
    expect(result.score).toBeLessThan(-0.3);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.discussionVolume).toBeGreaterThanOrEqual(2);
    expect(result.topPosts.length).toBeGreaterThan(0);

    console.log('✓ Bearish sentiment detected:', result);
  });

  it('should return NEUTRAL sentiment for cards with neutral signals', async () => {
    const result = await getRedditSentiment(testCardNeutral);

    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.score).toBeGreaterThanOrEqual(-0.3);
    expect(result.score).toBeLessThanOrEqual(0.3);
    expect(result.discussionVolume).toBeGreaterThanOrEqual(1);

    console.log('✓ Neutral sentiment detected:', result);
  });

  it('should return NEUTRAL with empty data for unknown cards', async () => {
    const result = await getRedditSentiment('UnknownCard_' + Date.now());

    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.discussionVolume).toBe(0);
    expect(result.topPosts).toEqual([]);

    console.log('✓ No data returns neutral:', result);
  });

  it('should aggregate multiple signals correctly', async () => {
    const result = await getRedditSentiment(testCardBullish);

    // Should average the scores
    expect(result.score).toBeCloseTo((0.9 + 0.85) / 2, 1);
    expect(result.confidence).toBeCloseTo((0.95 + 0.9) / 2, 1);
    expect(result.discussionVolume).toBeGreaterThanOrEqual(2);

    console.log('✓ Aggregated scores:', result);
  });

  it('should return top 3 posts sorted by score', async () => {
    const result = await getRedditSentiment(testCardBullish);

    expect(result.topPosts.length).toBeLessThanOrEqual(3);

    // Should be sorted by score (highest first)
    if (result.topPosts.length > 1) {
      expect(result.topPosts[0].score).toBeGreaterThanOrEqual(result.topPosts[1].score);
    }

    result.topPosts.forEach(post => {
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('url');
      expect(post).toHaveProperty('score');
      expect(post.score).toBeGreaterThan(0);
    });

    console.log('✓ Top posts:', result.topPosts);
  });

  it('should handle case-insensitive card names', async () => {
    const lower = testCardBullish.toLowerCase();
    const upper = testCardBullish.toUpperCase();

    const result1 = await getRedditSentiment(lower);
    const result2 = await getRedditSentiment(upper);

    expect(result1.sentiment).toBe('BULLISH');
    expect(result2.sentiment).toBe('BULLISH');

    console.log('✓ Case-insensitive search working');
  });
});
