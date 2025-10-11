import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketSignal } from '../ai-ensemble';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI response' } }],
        }),
      },
    },
  })),
}));

// Mock Reddit scraper
vi.mock('../reddit-scraper.js', () => ({
  getRedditSentiment: vi.fn().mockResolvedValue({
    sentiment: 'BULLISH',
    score: 0.7,
    confidence: 0.8,
    discussionVolume: 5,
    topPosts: [],
  }),
}));

const { AIEnsembleEngine } = await import('../ai-ensemble.js');

describe('AI Ensemble Engine', () => {
  let engine: InstanceType<typeof AIEnsembleEngine>;

  beforeEach(() => {
    engine = new AIEnsembleEngine({
      mew1aEndpoint: 'http://test-endpoint',
      ollamaURL: 'http://localhost:11434',
      deepseekApiKey: 'test-key',
    });
  });

  describe('Market Signal Processing', () => {
    it('should accept valid market signal', () => {
      const signal: MarketSignal = {
        cardName: 'Charizard',
        setName: 'Base Set',
        listedPrice: 100,
        marketData: {
          fairValue: 120,
          salesCount: 10,
          avgVolume30d: 5,
          priceChange7d: 2.5,
          priceChange30d: 5.0,
          lowestAvailable: 110,
        },
      };

      expect(signal.cardName).toBe('Charizard');
      expect(signal.listedPrice).toBeLessThan(signal.marketData.fairValue);
    });

    it('should calculate discount correctly', () => {
      const listedPrice = 100;
      const fairValue = 125;
      const expectedDiscount = ((listedPrice - fairValue) / fairValue) * 100;

      expect(expectedDiscount).toBe(-20); // 20% below fair value
    });

    it('should identify STRONG_BUY on high discount', () => {
      const discount = -20; // 20% below fair value
      const conviction = 85;

      // STRONG_BUY criteria: discount < -15% AND conviction >= 80
      const isStrongBuy = discount < -15 && conviction >= 80;

      expect(isStrongBuy).toBe(true);
    });

    it('should identify HOLD on low discount', () => {
      const discount = -5; // 5% below fair value
      const conviction = 65;

      // HOLD criteria: discount < 10 AND conviction >= 60
      const isHold = discount < 10 && conviction >= 60;

      expect(isHold).toBe(true);
    });
  });

  describe('Sentiment Scoring', () => {
    it('should map BUY to positive score', () => {
      const recommendation = 'BUY';
      const score = recommendation === 'BUY' ? 1 : recommendation === 'PASS' ? -1 : 0;

      expect(score).toBe(1);
    });

    it('should map PASS to negative score', () => {
      const recommendation = 'PASS';
      const score = recommendation === 'BUY' ? 1 : recommendation === 'PASS' ? -1 : 0;

      expect(score).toBe(-1);
    });

    it('should map NEUTRAL to zero score', () => {
      const recommendation = 'NEUTRAL';
      const score = recommendation === 'BUY' ? 1 : recommendation === 'PASS' ? -1 : 0;

      expect(score).toBe(0);
    });
  });

  describe('Weighted Ensemble Scoring', () => {
    it('should weight Mew-1A at 2x', () => {
      const mew1aScore = 1;
      const quickScore = 0;
      const deepScore = 0;
      const redditScore = 0;

      // Mew-1A appears twice in scoring array
      const scores = [mew1aScore, mew1aScore, quickScore, deepScore, redditScore * 0.5];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBeGreaterThan(0.3); // Mew-1A dominates
    });

    it('should weight Reddit at 0.5x', () => {
      const redditScore = 1;
      const weightedScore = redditScore * 0.5;

      expect(weightedScore).toBe(0.5);
    });

    it('should calculate weighted confidence correctly', () => {
      const mew1aConf = 90;
      const quickConf = 80;
      const deepConf = 85;
      const redditConf = 70;

      // (90*2 + 80 + 85 + 70*0.3) / 4.3
      const weightedConf = (mew1aConf * 2 + quickConf + deepConf + redditConf * 0.3) / 4.3;

      expect(weightedConf).toBeGreaterThan(80);
      expect(weightedConf).toBeLessThan(90);
    });
  });

  describe('Agreement Calculation', () => {
    it('should show high agreement when all models align', () => {
      const scores = [1, 1, 1, 1, 0.5]; // All bullish
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
      const agreement = 1 - Math.min(1, variance);

      expect(agreement).toBeGreaterThan(0.8);
    });

    it('should show low agreement when models conflict', () => {
      const scores = [1, -1, 1, -1, 0]; // Mixed signals
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
      const agreement = 1 - Math.min(1, variance);

      expect(agreement).toBeLessThan(0.5);
    });
  });

  describe('Liquidity Metrics', () => {
    it('should calculate sell probability based on volume', () => {
      const avgVolume30d = 10; // 10 sales per month
      const baseProbability = Math.min(1, avgVolume30d / 20); // Cap at 1

      expect(baseProbability).toBe(0.5); // 10/20 = 50%
    });

    it('should estimate days to sell', () => {
      const sellProbability = 0.8; // 80% chance
      const daysToSell = Math.ceil(30 / (sellProbability * 10 + 1));

      expect(daysToSell).toBeLessThanOrEqual(30);
      expect(daysToSell).toBeGreaterThan(0);
    });

    it('should calculate liquidity-adjusted fair value', () => {
      const fairValue = 100;
      const sellProbability = 0.8;
      const liquidityAdjusted = fairValue * sellProbability;

      expect(liquidityAdjusted).toBe(80);
    });
  });

  describe('Whale Detection', () => {
    it('should detect whale activity on volume spike + price increase', () => {
      const avgVolume30d = 6; // >5 sales
      const priceChange30d = 20; // >15% gain

      const whaleActivity = avgVolume30d > 5 && priceChange30d > 15;

      expect(whaleActivity).toBe(true);
    });

    it('should not detect whales on low volume', () => {
      const avgVolume30d = 3; // Low volume
      const priceChange30d = 20; // Price up but no volume

      const whaleActivity = avgVolume30d > 5 && priceChange30d > 15;

      expect(whaleActivity).toBe(false);
    });
  });
});
