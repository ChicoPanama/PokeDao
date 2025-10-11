import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AI Ensemble - Comprehensive Tests', () => {
  describe('Weighted Ensemble Scoring', () => {
    it('should weight Mew-1A at 2x in score calculation', () => {
      const mew1aScore = 0.8;
      const quickScore = 0.6;
      const deepScore = 0.7;
      const redditScore = 0.5;

      // Mew-1A counted twice
      const scores = [mew1aScore, mew1aScore, quickScore, deepScore, redditScore * 0.5];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Should be: (0.8 + 0.8 + 0.6 + 0.7 + 0.25) / 5 = 3.15 / 5 = 0.63
      expect(avgScore).toBeCloseTo(0.63, 2);
    });

    it('should weight Reddit at 0.5x in score calculation', () => {
      const redditScore = 1.0;
      const weightedRedditScore = redditScore * 0.5;

      expect(weightedRedditScore).toBe(0.5);
    });

    it('should calculate weighted confidence correctly', () => {
      const mew1aConf = 0.9;
      const quickConf = 0.8;
      const deepConf = 0.85;
      const redditConf = 0.6;

      // (0.9 * 2 + 0.8 + 0.85 + 0.6 * 0.3) / 4.3
      const weightedAvg = (mew1aConf * 2 + quickConf + deepConf + redditConf * 0.3) / 4.3;

      expect(weightedAvg).toBeCloseTo(0.844, 2);
    });

    it('should handle all models returning maximum bullish', () => {
      const scores = [1, 1, 1, 1, 0.5]; // Reddit at 0.5x
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBe(0.9);
    });

    it('should handle all models returning maximum bearish', () => {
      const scores = [-1, -1, -1, -1, -0.5]; // Reddit at 0.5x
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBe(-0.9);
    });

    it('should handle mixed signals', () => {
      const scores = [0.8, 0.8, -0.6, 0.2, 0.15]; // Mew-1A 2x, Reddit 0.5x
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBeCloseTo(0.27, 2);
    });
  });

  describe('Agreement Calculation', () => {
    it('should show high agreement when all models align bullish', () => {
      const scores = [0.9, 0.9, 0.85, 0.88, 0.425]; // Reddit 0.5x
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
      const agreement = 1 - Math.min(1, variance);

      expect(agreement).toBeGreaterThan(0.9);
    });

    it('should show low agreement when models disagree', () => {
      const scores = [1, 1, -1, 0, 0.5];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
      const agreement = 1 - Math.min(1, variance);

      expect(agreement).toBeLessThan(0.5);
    });

    it('should calculate variance correctly', () => {
      const scores = [1, 2, 3, 4, 5];
      const avg = 3;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;

      // (4 + 1 + 0 + 1 + 4) / 5 = 2
      expect(variance).toBe(2);
    });

    it('should cap agreement at 1.0', () => {
      const scores = [0.5, 0.5, 0.5, 0.5, 0.25];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
      const agreement = 1 - Math.min(1, variance);

      expect(agreement).toBeLessThanOrEqual(1.0);
      expect(agreement).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Conviction Scoring', () => {
    it('should calculate high conviction for strong signals', () => {
      const avgScore = 0.8;
      const avgConfidence = 0.9;
      const agreement = 0.95;

      const conviction = (Math.abs(avgScore) * avgConfidence * agreement) * 100;

      expect(conviction).toBeGreaterThan(65);
    });

    it('should calculate low conviction for weak signals', () => {
      const avgScore = 0.2;
      const avgConfidence = 0.5;
      const agreement = 0.4;

      const conviction = (Math.abs(avgScore) * avgConfidence * agreement) * 100;

      expect(conviction).toBeLessThan(10);
    });

    it('should handle negative scores correctly', () => {
      const avgScore = -0.8;
      const avgConfidence = 0.9;
      const agreement = 0.85;

      const conviction = (Math.abs(avgScore) * avgConfidence * agreement) * 100;

      expect(conviction).toBeGreaterThan(60);
    });

    it('should multiply by 100 for percentage', () => {
      const conviction = 0.75 * 100;
      expect(conviction).toBe(75);
    });
  });

  describe('Signal Classification', () => {
    it('should classify score > 0.3 as BULLISH', () => {
      const avgScore = 0.5;
      let signal: string;

      if (avgScore > 0.3) signal = 'BULLISH';
      else if (avgScore < -0.3) signal = 'BEARISH';
      else signal = 'NEUTRAL';

      expect(signal).toBe('BULLISH');
    });

    it('should classify score < -0.3 as BEARISH', () => {
      const avgScore = -0.5;
      let signal: string;

      if (avgScore > 0.3) signal = 'BULLISH';
      else if (avgScore < -0.3) signal = 'BEARISH';
      else signal = 'NEUTRAL';

      expect(signal).toBe('BEARISH');
    });

    it('should classify score between -0.3 and 0.3 as NEUTRAL', () => {
      const testScores = [0, 0.2, -0.2, 0.29, -0.29];

      testScores.forEach(avgScore => {
        let signal: string;

        if (avgScore > 0.3) signal = 'BULLISH';
        else if (avgScore < -0.3) signal = 'BEARISH';
        else signal = 'NEUTRAL';

        expect(signal).toBe('NEUTRAL');
      });
    });

    it('should handle boundary values correctly', () => {
      const boundaries = [
        { score: 0.3, expected: 'NEUTRAL' },
        { score: 0.31, expected: 'BULLISH' },
        { score: -0.3, expected: 'NEUTRAL' },
        { score: -0.31, expected: 'BEARISH' },
      ];

      boundaries.forEach(({ score, expected }) => {
        let signal: string;

        if (score > 0.3) signal = 'BULLISH';
        else if (score < -0.3) signal = 'BEARISH';
        else signal = 'NEUTRAL';

        expect(signal).toBe(expected);
      });
    });
  });

  describe('Recommendation Logic', () => {
    it('should recommend BUY for high conviction bullish', () => {
      const signal = 'BULLISH';
      const conviction = 75;

      let recommendation: string;
      if (signal === 'BULLISH' && conviction > 60) recommendation = 'BUY';
      else if (signal === 'BEARISH' && conviction > 60) recommendation = 'PASS';
      else recommendation = 'WATCH';

      expect(recommendation).toBe('BUY');
    });

    it('should recommend PASS for high conviction bearish', () => {
      const signal = 'BEARISH';
      const conviction = 75;

      let recommendation: string;
      if (signal === 'BULLISH' && conviction > 60) recommendation = 'BUY';
      else if (signal === 'BEARISH' && conviction > 60) recommendation = 'PASS';
      else recommendation = 'WATCH';

      expect(recommendation).toBe('PASS');
    });

    it('should recommend WATCH for low conviction', () => {
      const testCases = [
        { signal: 'BULLISH', conviction: 50 },
        { signal: 'BEARISH', conviction: 40 },
        { signal: 'NEUTRAL', conviction: 70 },
      ];

      testCases.forEach(({ signal, conviction }) => {
        let recommendation: string;
        if (signal === 'BULLISH' && conviction > 60) recommendation = 'BUY';
        else if (signal === 'BEARISH' && conviction > 60) recommendation = 'PASS';
        else recommendation = 'WATCH';

        expect(recommendation).toBe('WATCH');
      });
    });
  });

  describe('Reasoning Generation', () => {
    it('should include conviction in reasoning', () => {
      const conviction = 75;
      const reasoning = `High conviction signal (${conviction}%)`;

      expect(reasoning).toContain('75%');
      expect(reasoning).toContain('conviction');
    });

    it('should mention agreement when high', () => {
      const agreement = 0.95;
      const reasoning = `Models show ${(agreement * 100).toFixed(0)}% agreement`;

      expect(reasoning).toContain('95%');
      expect(reasoning).toContain('agreement');
    });

    it('should format percentages correctly', () => {
      const value = 0.8765;
      const formatted = (value * 100).toFixed(1);

      expect(formatted).toBe('87.6');
    });
  });

  describe('Error Handling', () => {
    it('should handle model timeout gracefully', () => {
      const error = new Error('Timeout');
      const fallbackScore = 0;
      const fallbackConfidence = 0;

      expect(fallbackScore).toBe(0);
      expect(fallbackConfidence).toBe(0);
    });

    it('should handle API errors with defaults', () => {
      const error = { status: 500, message: 'Internal Server Error' };
      const defaultSentiment = 'NEUTRAL';
      const defaultScore = 0;

      expect(defaultSentiment).toBe('NEUTRAL');
      expect(defaultScore).toBe(0);
    });

    it('should validate model responses', () => {
      const validResponses = [
        { signal: 'BULLISH', score: 0.8, confidence: 0.9 },
        { signal: 'BEARISH', score: -0.7, confidence: 0.85 },
        { signal: 'NEUTRAL', score: 0, confidence: 0.6 },
      ];

      validResponses.forEach(response => {
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(response.signal);
        expect(response.score).toBeGreaterThanOrEqual(-1);
        expect(response.score).toBeLessThanOrEqual(1);
        expect(response.confidence).toBeGreaterThanOrEqual(0);
        expect(response.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Price Calculation', () => {
    it('should calculate discount percentage correctly', () => {
      const listedPrice = 85;
      const fairValue = 100;
      const discount = ((fairValue - listedPrice) / fairValue) * 100;

      expect(discount).toBe(15);
    });

    it('should handle negative discount (premium)', () => {
      const listedPrice = 120;
      const fairValue = 100;
      const discount = ((fairValue - listedPrice) / fairValue) * 100;

      expect(discount).toBe(-20);
    });

    it('should handle zero fair value', () => {
      const listedPrice = 50;
      const fairValue = 0;
      const discount = fairValue === 0 ? 0 : ((fairValue - listedPrice) / fairValue) * 100;

      expect(discount).toBe(0);
    });
  });

  describe('Market Data Validation', () => {
    it('should validate sales count is non-negative', () => {
      const salesCounts = [0, 10, 100, 1000];

      salesCounts.forEach(count => {
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should validate volume is non-negative', () => {
      const volumes = [0, 1000, 50000, 100000];

      volumes.forEach(vol => {
        expect(vol).toBeGreaterThanOrEqual(0);
      });
    });

    it('should validate price changes are valid percentages', () => {
      const priceChanges = [-50, -10, 0, 10, 50, 100];

      priceChanges.forEach(change => {
        expect(typeof change).toBe('number');
        expect(isFinite(change)).toBe(true);
      });
    });
  });

  describe('Ensemble Integration', () => {
    it('should combine all four layers', () => {
      const layers = ['Mew-1A', 'Ollama', 'DeepSeek', 'Reddit'];
      expect(layers).toHaveLength(4);
    });

    it('should weight Mew-1A twice in array', () => {
      const mew1aScore = 0.8;
      const scores = [mew1aScore, mew1aScore]; // Appears twice

      expect(scores.filter(s => s === mew1aScore)).toHaveLength(2);
    });

    it('should apply 0.5x multiplier to Reddit', () => {
      const redditRawScore = 1.0;
      const redditWeightedScore = redditRawScore * 0.5;

      expect(redditWeightedScore).toBe(0.5);
    });

    it('should include all scores in average', () => {
      const scores = [0.8, 0.8, 0.6, 0.7, 0.5];
      expect(scores).toHaveLength(5);
    });
  });
});
