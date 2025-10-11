import { describe, it, expect } from 'vitest';
import { generateMockPriceHistory } from '../image-generator.js';

// Simple unit tests that actually call the real functions
describe('Image Generator - Unit Tests with Real Function Calls', () => {
  describe('generateMockPriceHistory', () => {
    it('generates history with correct length', () => {
      const result = generateMockPriceHistory(100, 30);
      expect(result).toHaveLength(31);
    });

    it('generates history with 7 days', () => {
      const result = generateMockPriceHistory(100, 7);
      expect(result).toHaveLength(8);
    });

    it('generates history with 14 days', () => {
      const result = generateMockPriceHistory(100, 14);
      expect(result).toHaveLength(15);
    });

    it('generates history with 60 days', () => {
      const result = generateMockPriceHistory(100, 60);
      expect(result).toHaveLength(61);
    });

    it('generates history with 90 days', () => {
      const result = generateMockPriceHistory(100, 90);
      expect(result).toHaveLength(91);
    });

    it('works with small base price', () => {
      const result = generateMockPriceHistory(1, 30);
      expect(result).toHaveLength(31);
      result.forEach(p => expect(p.price).toBeGreaterThanOrEqual(0));
    });

    it('works with large base price', () => {
      const result = generateMockPriceHistory(10000, 30);
      expect(result).toHaveLength(31);
      result.forEach(p => expect(p.price).toBeGreaterThan(0));
    });

    it('generates chronological dates', () => {
      const result = generateMockPriceHistory(100, 30);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].date.getTime()).toBeLessThan(result[i + 1].date.getTime());
      }
    });

    it('generates non-negative prices', () => {
      const result = generateMockPriceHistory(100, 30);
      result.forEach(p => expect(p.price).toBeGreaterThanOrEqual(0));
    });

    it('includes date objects', () => {
      const result = generateMockPriceHistory(100, 30);
      result.forEach(p => expect(p.date).toBeInstanceOf(Date));
    });

    it('includes price numbers', () => {
      const result = generateMockPriceHistory(100, 30);
      result.forEach(p => expect(typeof p.price).toBe('number'));
    });

    it('generates prices with volatility', () => {
      const result = generateMockPriceHistory(100, 30);
      const prices = result.map(p => p.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      expect(max).toBeGreaterThan(min); // Should have some variation
    });
  });
});
