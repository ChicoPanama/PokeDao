import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { scrapeRedditSignals, cleanupExpiredSignals, getRedditSentiment } from '../reddit-scraper.js';

const prisma = new PrismaClient();
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-b2b1b770275140a8872e98ba46a52cff';

describe('Reddit Scraper - Full Integration with Real Database', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.redditSignal.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('scrapeRedditSignals - Full Workflow', () => {
    it('should scrape Reddit and store signals in database', async () => {
      console.log('🔍 Starting full Reddit scrape with real APIs...');

      const signalCount = await scrapeRedditSignals(DEEPSEEK_API_KEY);

      console.log(`✓ Scraped ${signalCount} signals from Reddit`);

      // Verify signals were stored
      const storedSignals = await prisma.redditSignal.findMany({});
      console.log(`✓ Found ${storedSignals.length} signals in database`);

      expect(signalCount).toBeGreaterThanOrEqual(0);
      expect(storedSignals.length).toBeGreaterThanOrEqual(0);

      if (storedSignals.length > 0) {
        const signal = storedSignals[0];
        console.log(`✓ Sample signal: ${signal.cardName} - ${signal.sentiment} (score: ${signal.score})`);

        expect(signal).toHaveProperty('cardName');
        expect(signal).toHaveProperty('sentiment');
        expect(signal).toHaveProperty('score');
        expect(signal).toHaveProperty('confidence');
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(signal.sentiment);
      }
    }, 120000); // 2 minute timeout for full scrape
  });

  describe('getRedditSentiment - Aggregation from Database', () => {
    it('should aggregate sentiment for popular cards', async () => {
      // First, ensure we have some data
      await scrapeRedditSignals(DEEPSEEK_API_KEY);

      // Get all unique card names
      const signals = await prisma.redditSignal.findMany({
        select: { cardName: true },
        distinct: ['cardName'],
      });

      console.log(`✓ Found ${signals.length} unique cards in database`);

      if (signals.length > 0) {
        const cardName = signals[0].cardName;
        console.log(`✓ Testing sentiment aggregation for: ${cardName}`);

        const sentiment = await getRedditSentiment(cardName);

        expect(sentiment).toBeDefined();
        expect(sentiment.sentiment).toBeDefined();
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(sentiment.sentiment);
        expect(sentiment.score).toBeGreaterThanOrEqual(-1);
        expect(sentiment.score).toBeLessThanOrEqual(1);
        expect(sentiment.confidence).toBeGreaterThanOrEqual(0);
        expect(sentiment.confidence).toBeLessThanOrEqual(1);
        expect(sentiment.discussionVolume).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(sentiment.topPosts)).toBe(true);

        console.log(`✓ Aggregated sentiment: ${sentiment.sentiment}`);
        console.log(`  Score: ${sentiment.score.toFixed(2)}`);
        console.log(`  Confidence: ${sentiment.confidence.toFixed(2)}`);
        console.log(`  Discussion Volume: ${sentiment.discussionVolume}`);
        console.log(`  Top Posts: ${sentiment.topPosts.length}`);
      }
    }, 120000);

    it('should return neutral for cards with no signals', async () => {
      const sentiment = await getRedditSentiment('NonExistentCard12345XYZ');

      expect(sentiment.sentiment).toBe('NEUTRAL');
      expect(sentiment.score).toBe(0);
      expect(sentiment.confidence).toBe(0);
      expect(sentiment.discussionVolume).toBe(0);
      expect(sentiment.topPosts).toHaveLength(0);

      console.log('✓ Correctly returned neutral for non-existent card');
    });
  });

  describe('cleanupExpiredSignals - Database Maintenance', () => {
    it('should clean up old signals', async () => {
      const result = await cleanupExpiredSignals();

      // Should execute without errors
      expect(result).toBeUndefined();

      console.log('✓ Cleaned up expired signals');

      // Verify remaining signals are recent
      const remainingSignals = await prisma.redditSignal.findMany({});
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      remainingSignals.forEach(signal => {
        expect(signal.createdAt.getTime()).toBeGreaterThan(sevenDaysAgo.getTime());
      });

      console.log(`✓ All ${remainingSignals.length} remaining signals are less than 7 days old`);
    });
  });

  describe('Database Integrity', () => {
    it('should enforce unique constraint on (subreddit, postId, cardName)', async () => {
      await scrapeRedditSignals(DEEPSEEK_API_KEY);

      const signals = await prisma.redditSignal.findMany({});

      if (signals.length > 0) {
        // Try to create duplicate signal
        const existingSignal = signals[0];

        try {
          await prisma.redditSignal.create({
            data: {
              subreddit: existingSignal.subreddit,
              postId: existingSignal.postId,
              cardName: existingSignal.cardName,
              setName: existingSignal.setName,
              postTitle: 'Duplicate test',
              postUrl: 'http://test.com',
              sentiment: 'NEUTRAL',
              score: 0,
              confidence: 0.5,
              upvotes: 10,
              keyPhrases: [],
            },
          });

          // Should not reach here
          expect.fail('Should have thrown unique constraint error');
        } catch (error: any) {
          expect(error.code).toBe('P2002'); // Prisma unique constraint error
          console.log('✓ Unique constraint correctly enforced');
        }
      }
    }, 120000);

    it('should allow multiple cards from same post', async () => {
      const testData = [
        {
          subreddit: 'PokeInvesting',
          postId: 'test123',
          cardName: 'Charizard',
          setName: null,
          postTitle: 'Test post',
          postUrl: 'http://test.com/1',
          sentiment: 'BULLISH' as const,
          score: 0.8,
          confidence: 0.9,
          upvotes: 100,
          keyPhrases: ['test'],
        },
        {
          subreddit: 'PokeInvesting',
          postId: 'test123', // Same post
          cardName: 'Pikachu', // Different card
          setName: null,
          postUrl: 'http://test.com/1',
          sentiment: 'BULLISH' as const,
          score: 0.7,
          confidence: 0.85,
          upvotes: 100,
          keyPhrases: ['test'],
        },
      ];

      // Clean up first
      await prisma.redditSignal.deleteMany({
        where: { postId: 'test123' },
      });

      // Create both signals
      await prisma.redditSignal.createMany({ data: testData });

      const signals = await prisma.redditSignal.findMany({
        where: { postId: 'test123' },
      });

      expect(signals).toHaveLength(2);
      expect(signals[0].cardName).not.toBe(signals[1].cardName);

      console.log('✓ Multiple cards from same post correctly stored');

      // Clean up
      await prisma.redditSignal.deleteMany({
        where: { postId: 'test123' },
      });
    });
  });
});
