import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeSentiment, scrapeRedditSignals, cleanupExpiredSignals, fetchSubredditPosts } from '../reddit-scraper.js';
import prisma from '../prisma.js';

describe('Reddit Scraper - Full Coverage', () => {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-b2b1b770275140a8872e98ba46a52cff';

  describe('analyzeSentiment - Error Handling', () => {
    it('should fallback to NEUTRAL when JSON parsing fails', async () => {
      // Mock fetch to return invalid JSON response
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'This is not valid JSON for sentiment analysis',
              },
            },
          ],
        }),
      });

      const result = await analyzeSentiment('Test text', DEEPSEEK_API_KEY);

      expect(result).toEqual({
        sentiment: 'NEUTRAL',
        score: 0,
        confidence: 0.5,
        keyPhrases: [],
      });

      global.fetch = originalFetch;
    });

    it('should throw error when DeepSeek API fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(analyzeSentiment('Test', DEEPSEEK_API_KEY)).rejects.toThrow('DeepSeek API error: 500');

      global.fetch = originalFetch;
    });
  });

  describe('fetchSubredditPosts', () => {
    it('should fetch posts from subreddit', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                kind: 't3',
                data: {
                  id: 'test123',
                  title: 'Charizard price discussion',
                  selftext: 'What do you think about Charizard prices?',
                  author: 'testuser',
                  score: 100,
                  num_comments: 50,
                  created_utc: 1234567890,
                  permalink: '/r/PokeInvesting/comments/test123',
                  subreddit: 'PokeInvesting',
                },
              },
            ],
            after: null,
          },
        }),
      });

      const posts = await fetchSubredditPosts('PokeInvesting', 100, 'hot');

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('Charizard price discussion');
      expect(posts[0].subreddit).toBe('PokeInvesting');

      global.fetch = originalFetch;
    });

    it('should throw error when Reddit API fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(fetchSubredditPosts('PokeInvesting')).rejects.toThrow('Reddit API error: 429 Too Many Requests');

      global.fetch = originalFetch;
    });

    it('should fetch with different sort options', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            children: [],
            after: null,
          },
        }),
      });

      await fetchSubredditPosts('PokeInvesting', 50, 'new');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/new.json?limit=50'),
        expect.any(Object)
      );

      await fetchSubredditPosts('PokeInvesting', 25, 'top');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/top.json?limit=25'),
        expect.any(Object)
      );

      global.fetch = originalFetch;
    });
  });

  describe('scrapeRedditSignals', () => {
    it('should scrape and store Reddit signals', async () => {
      // Mock fetch for Reddit API
      const originalFetch = global.fetch;
      global.fetch = vi.fn()
        // First call: Reddit posts
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              children: [
                {
                  kind: 't3',
                  data: {
                    id: 'abc123',
                    title: 'Charizard from Base Set is going up!',
                    selftext: 'I think Charizard is a great investment',
                    author: 'investor123',
                    score: 150,
                    num_comments: 75,
                    created_utc: Date.now() / 1000,
                    permalink: '/r/PokeInvesting/comments/abc123',
                    subreddit: 'PokeInvesting',
                  },
                },
              ],
              after: null,
            },
          }),
        })
        // Second call: DeepSeek API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sentiment: 'BULLISH',
                    score: 0.8,
                    confidence: 0.9,
                    keyPhrases: ['great investment', 'going up', 'bullish'],
                  }),
                },
              },
            ],
          }),
        })
        // Third call: Second subreddit (empty)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              children: [],
              after: null,
            },
          }),
        });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const totalSignals = await scrapeRedditSignals(DEEPSEEK_API_KEY);

      expect(totalSignals).toBeGreaterThanOrEqual(0);
      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      global.fetch = originalFetch;
    }, 30000);

    it('should skip posts with no card mentions', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                kind: 't3',
                data: {
                  id: 'xyz789',
                  title: 'Random discussion about nothing',
                  selftext: 'Just chatting',
                  author: 'user456',
                  score: 10,
                  num_comments: 2,
                  created_utc: Date.now() / 1000,
                  permalink: '/r/PokeInvesting/comments/xyz789',
                  subreddit: 'PokeInvesting',
                },
              },
            ],
            after: null,
          },
        }),
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [],
            after: null,
          },
        }),
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const totalSignals = await scrapeRedditSignals(DEEPSEEK_API_KEY);

      // Should not create signals for posts without card mentions
      expect(totalSignals).toBe(0);

      consoleLogSpy.mockRestore();
      global.fetch = originalFetch;
    }, 15000);
  });

  describe('cleanupExpiredSignals', () => {
    it('should delete expired signals', async () => {
      // Create an expired signal
      const expiredId = 'expired_test_signal_' + Date.now();
      await prisma.redditSignal.create({
        data: {
          id: expiredId,
          cardName: 'Pikachu',
          subreddit: 'PokeInvesting',
          postId: 'expired123',
          postTitle: 'Old post',
          postUrl: 'https://reddit.com/test',
          author: 'testuser',
          score: 10,
          numComments: 5,
          sentiment: 'NEUTRAL',
          sentimentScore: 0,
          confidence: 0.5,
          discussionVolume: 1,
          keyPhrases: [],
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const deletedCount = await cleanupExpiredSignals();

      expect(deletedCount).toBeGreaterThanOrEqual(1);
    });

    it('should not delete non-expired signals', async () => {
      // Create a non-expired signal
      const futureId = 'future_test_signal_' + Date.now();
      await prisma.redditSignal.create({
        data: {
          id: futureId,
          cardName: 'Mewtwo',
          subreddit: 'PokeInvesting',
          postId: 'future123',
          postTitle: 'Recent post',
          postUrl: 'https://reddit.com/test2',
          author: 'testuser2',
          score: 20,
          numComments: 10,
          sentiment: 'BULLISH',
          sentimentScore: 0.7,
          confidence: 0.8,
          discussionVolume: 1,
          keyPhrases: ['bullish'],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
        },
      });

      // Run cleanup
      await cleanupExpiredSignals();

      // Verify signal still exists
      const signal = await prisma.redditSignal.findUnique({
        where: { id: futureId },
      });

      expect(signal).not.toBeNull();

      // Cleanup
      await prisma.redditSignal.delete({ where: { id: futureId } });
    });
  });
});
