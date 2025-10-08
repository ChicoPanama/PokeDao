import { describe, it, expect, vi } from 'vitest';

// Mock sharp to avoid native module issues in tests
vi.mock('sharp', () => ({
  default: vi.fn(),
}));

const { generateMockPriceHistory } = await import('../image-generator.js');

describe('Image Generator', () => {
  describe('generateMockPriceHistory', () => {
    it('should generate correct number of days', () => {
      const history = generateMockPriceHistory(100, 30);

      expect(history).toHaveLength(31); // 30 days + today
    });

    it('should have prices around base price', () => {
      const basePrice = 100;
      const history = generateMockPriceHistory(basePrice, 30);

      const prices = history.map(h => h.price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Average should be within 10% of base price
      expect(avgPrice).toBeGreaterThan(basePrice * 0.9);
      expect(avgPrice).toBeLessThan(basePrice * 1.1);
    });

    it('should have dates in chronological order', () => {
      const history = generateMockPriceHistory(100, 30);

      // History goes from oldest to newest
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].date.getTime()).toBeLessThan(history[i + 1].date.getTime());
      }
    });

    it('should include today as last entry', () => {
      const history = generateMockPriceHistory(100, 30);
      const today = new Date();
      const lastDate = history[history.length - 1].date;

      expect(lastDate.toDateString()).toBe(today.toDateString());
    });
  });
});
