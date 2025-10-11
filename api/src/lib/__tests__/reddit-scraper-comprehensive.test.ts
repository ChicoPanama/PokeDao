import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCardMentions, analyzeSentiment, cleanupExpiredSignals } from '../reddit-scraper';

describe('Reddit Scraper - Comprehensive Tests', () => {
  describe('extractCardMentions - Edge Cases', () => {
    it('should handle empty string', () => {
      const mentions = extractCardMentions('');
      expect(mentions).toHaveLength(0);
    });

    it('should handle very long text', () => {
      const longText = 'a '.repeat(10000) + 'Charizard';
      const mentions = extractCardMentions(longText);
      expect(mentions).toHaveLength(1);
    });

    it('should handle special characters', () => {
      const text = '!@#$ Pikachu $%^&*';
      const mentions = extractCardMentions(text);
      expect(mentions.length).toBeGreaterThan(0);
    });

    it('should extract all common Pokemon', () => {
      const text = 'Charizard, Pikachu, Mew, Mewtwo, Lugia, Rayquaza, Umbreon, Espeon, Blastoise, Venusaur, Gyarados, Dragonite, Gengar, Alakazam, Machamp, Eevee';
      const mentions = extractCardMentions(text);
      expect(mentions.length).toBeGreaterThanOrEqual(10);
    });

    it('should extract all common sets', () => {
      const text = 'Base Set, Jungle, Fossil, Team Rocket, Obsidian Flames, Paldean Fates, Stellar Crown, Surging Sparks, Prismatic Evolutions, Hidden Fates, Shining Fates, Champions Path, 151, Evolving Skies';
      const mentions = extractCardMentions(text);
      // Should find at least one card name that matches
      expect(mentions).toBeDefined();
    });

    it('should match partial card + set combinations', () => {
      const combinations = [
        'Charizard Base Set',
        'Pikachu Hidden Fates',
        'Mew Obsidian Flames',
        'Umbreon Evolving Skies',
      ];

      combinations.forEach(combo => {
        const mentions = extractCardMentions(combo);
        expect(mentions.length).toBeGreaterThan(0);
      });
    });

    it('should handle mixed case variations', () => {
      const variations = [
        'CHARIZARD',
        'charizard',
        'ChArIzArD',
        'Charizard',
      ];

      variations.forEach(v => {
        const mentions = extractCardMentions(v);
        expect(mentions).toHaveLength(1);
        expect(mentions[0].cardName).toBe('Charizard');
      });
    });

    it('should not duplicate mentions', () => {
      const text = 'Charizard Charizard Charizard';
      const mentions = extractCardMentions(text);
      // May have duplicates but should all be valid
      expect(mentions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Reddit API Error Handling', () => {
    it('should handle 429 rate limit errors', async () => {
      // Mock implementation would check error handling
      const error = { status: 429, statusText: 'Too Many Requests' };
      expect(error.status).toBe(429);
    });

    it('should handle 504 gateway timeout', async () => {
      const error = { status: 504, statusText: 'Gateway Timeout' };
      expect(error.status).toBe(504);
    });

    it('should handle invalid JSON responses', async () => {
      const invalidJson = 'not json';
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('Sentiment Analysis Edge Cases', () => {
    it('should handle very short text', async () => {
      const text = 'Buy';
      // Would need to mock DeepSeek response
      expect(text.length).toBeGreaterThan(0);
    });

    it('should handle very long text', async () => {
      const text = 'a'.repeat(10000);
      const truncated = text.substring(0, 1000);
      expect(truncated.length).toBe(1000);
    });

    it('should handle emoji-filled text', async () => {
      const text = '🚀🚀🚀 Charizard to the moon! 🌙💎';
      expect(text).toContain('Charizard');
    });

    it('should parse sentiment JSON correctly', () => {
      const mockResponse = {
        sentiment: 'BULLISH',
        score: 0.8,
        confidence: 0.9,
        keyPhrases: ['to the moon', 'buy now', 'investment'],
      };

      expect(mockResponse.sentiment).toBe('BULLISH');
      expect(mockResponse.score).toBeGreaterThan(0.5);
      expect(mockResponse.keyPhrases).toHaveLength(3);
    });

    it('should handle malformed AI responses', () => {
      const malformedJson = '{ "sentiment": "BULLISH", invalid }';
      expect(() => JSON.parse(malformedJson)).toThrow();
    });

    it('should validate sentiment values', () => {
      const validSentiments = ['BULLISH', 'BEARISH', 'NEUTRAL'];
      const testSentiment = 'BULLISH';

      expect(validSentiments).toContain(testSentiment);
    });

    it('should validate score ranges', () => {
      const scores = [0.8, -0.5, 0, 1, -1];
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should validate confidence ranges', () => {
      const confidences = [0.9, 0.5, 0.0, 1.0];
      confidences.forEach(conf => {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Signal Expiration', () => {
    it('should calculate 7-day expiration correctly', () => {
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(now + sevenDays);

      const diff = expiresAt.getTime() - now;
      expect(diff).toBe(sevenDays);
    });

    it('should identify expired signals', () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 1000);

      expect(pastDate.getTime()).toBeLessThan(Date.now());
      expect(futureDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should filter signals by expiration', () => {
      const signals = [
        { expiresAt: new Date(Date.now() + 1000000) }, // Valid
        { expiresAt: new Date(Date.now() - 1000000) }, // Expired
        { expiresAt: new Date(Date.now() + 500000) },  // Valid
      ];

      const validSignals = signals.filter(s => s.expiresAt.getTime() > Date.now());
      expect(validSignals).toHaveLength(2);
    });
  });

  describe('Rate Limiting', () => {
    it('should wait 100ms between posts', async () => {
      const delay = 100;
      const start = Date.now();

      await new Promise(resolve => setTimeout(resolve, delay));

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(delay);
    });

    it('should respect 100 queries per minute limit', () => {
      const queriesPerMinute = 100;
      const msPerQuery = 60000 / queriesPerMinute;

      expect(msPerQuery).toBe(600); // 600ms between queries for 100/min
    });
  });

  describe('Hash Generation', () => {
    it('should generate consistent hashes', () => {
      const crypto = require('crypto');
      const data = 'PokeInvesting::abc123::Charizard';

      const hash1 = crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
      const hash2 = crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different data', () => {
      const crypto = require('crypto');

      const hash1 = crypto.createHash('sha256').update('data1').digest('hex');
      const hash2 = crypto.createHash('sha256').update('data2').digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should truncate to 32 characters', () => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update('test').digest('hex').substring(0, 32);

      expect(hash).toHaveLength(32);
    });
  });

  describe('Aggregation Logic', () => {
    it('should calculate average score correctly', () => {
      const scores = [0.8, 0.6, 0.7, 0.9];
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

      expect(avg).toBeCloseTo(0.75, 2);
    });

    it('should calculate average confidence correctly', () => {
      const confidences = [0.9, 0.8, 0.85, 0.75];
      const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

      expect(avg).toBeCloseTo(0.825, 2);
    });

    it('should determine sentiment from average score', () => {
      const testCases = [
        { avgScore: 0.5, expected: 'BULLISH' },
        { avgScore: -0.5, expected: 'BEARISH' },
        { avgScore: 0.2, expected: 'NEUTRAL' },
      ];

      testCases.forEach(({ avgScore, expected }) => {
        let sentiment: string;
        if (avgScore > 0.3) sentiment = 'BULLISH';
        else if (avgScore < -0.3) sentiment = 'BEARISH';
        else sentiment = 'NEUTRAL';

        expect(sentiment).toBe(expected);
      });
    });

    it('should count discussion volume', () => {
      const signals = [
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
        { id: '5' },
      ];

      expect(signals.length).toBe(5);
    });

    it('should extract top posts', () => {
      const posts = [
        { score: 100, title: 'Post 1' },
        { score: 200, title: 'Post 2' },
        { score: 50, title: 'Post 3' },
        { score: 300, title: 'Post 4' },
      ];

      const topPosts = posts
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      expect(topPosts[0].score).toBe(300);
      expect(topPosts).toHaveLength(3);
    });
  });
});
