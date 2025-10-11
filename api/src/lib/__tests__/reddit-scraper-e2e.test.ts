import { describe, it, expect, beforeAll } from 'vitest';
import { extractCardMentions, analyzeSentiment } from '../reddit-scraper.js';

// These tests make REAL API calls to DeepSeek
describe('Reddit Scraper - E2E Real API Tests', () => {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-b2b1b770275140a8872e98ba46a52cff';

  beforeAll(() => {
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'test-key') {
      throw new Error('DEEPSEEK_API_KEY required for E2E tests');
    }
  });

  describe('extractCardMentions - Real Execution', () => {
    it('should extract Charizard from real text', () => {
      const text = 'Just pulled a Charizard from my booster pack!';
      const mentions = extractCardMentions(text);

      expect(mentions.length).toBeGreaterThan(0);
      expect(mentions[0].cardName).toBe('Charizard');
    });

    it('should extract multiple Pokemon from real text', () => {
      const text = 'My collection has Pikachu, Mewtwo, and Charizard';
      const mentions = extractCardMentions(text);

      expect(mentions.length).toBeGreaterThanOrEqual(3);
      const names = mentions.map(m => m.cardName);
      expect(names).toContain('Pikachu');
      expect(names).toContain('Mewtwo');
      expect(names).toContain('Charizard');
    });

    it('should extract set names from real text', () => {
      const text = 'Charizard from Base Set is valuable';
      const mentions = extractCardMentions(text);

      expect(mentions.length).toBeGreaterThan(0);
      const hasBaseSet = mentions.some(m => m.setName === 'Base Set');
      expect(hasBaseSet).toBe(true);
    });

    it('should handle empty text', () => {
      const mentions = extractCardMentions('');
      expect(mentions).toHaveLength(0);
    });

    it('should handle text with no Pokemon', () => {
      const mentions = extractCardMentions('This is just random text about nothing');
      expect(mentions).toHaveLength(0);
    });
  });

  describe('analyzeSentiment - Real DeepSeek API Calls', () => {
    it('should analyze bullish sentiment with real API', async () => {
      const text = 'Charizard is going to the moon! Best investment ever! 🚀🚀🚀';

      const result = await analyzeSentiment(text, DEEPSEEK_API_KEY);

      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(result.sentiment);
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.keyPhrases)).toBe(true);

      console.log(`✓ Real API returned: ${result.sentiment} (score: ${result.score}, confidence: ${result.confidence})`);
    }, 15000); // 15 second timeout for API call

    it('should analyze bearish sentiment with real API', async () => {
      const text = 'This card is way overpriced. Avoid at all costs. Not worth the money.';

      const result = await analyzeSentiment(text, DEEPSEEK_API_KEY);

      expect(result).toBeDefined();
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(result.sentiment);
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);

      console.log(`✓ Real API returned: ${result.sentiment} (score: ${result.score})`);
    }, 15000);

    it('should analyze neutral sentiment with real API', async () => {
      const text = 'The card exists. It has some features. People have opinions about it.';

      const result = await analyzeSentiment(text, DEEPSEEK_API_KEY);

      expect(result).toBeDefined();
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(result.sentiment);

      console.log(`✓ Real API returned: ${result.sentiment} (score: ${result.score})`);
    }, 15000);

    it('should handle very short text with real API', async () => {
      const text = 'Good card';

      const result = await analyzeSentiment(text, DEEPSEEK_API_KEY);

      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();

      console.log(`✓ Real API handled short text: ${result.sentiment}`);
    }, 15000);

    it('should handle text with emojis with real API', async () => {
      const text = '🔥🔥🔥 Charizard is fire! 🚀💎🙌';

      const result = await analyzeSentiment(text, DEEPSEEK_API_KEY);

      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();

      console.log(`✓ Real API handled emojis: ${result.sentiment}`);
    }, 15000);

    it('should truncate and analyze long text with real API', async () => {
      const longText = 'This is a very long post about Pokemon cards. '.repeat(50) + 'Charizard is amazing!';

      const result = await analyzeSentiment(longText, DEEPSEEK_API_KEY);

      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();

      console.log(`✓ Real API handled long text: ${result.sentiment}`);
    }, 15000);
  });
});
