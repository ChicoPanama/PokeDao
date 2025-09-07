/**
 * Comprehensive tests for Price Outlier Detection utilities
 * 
 * Tests integration with PokeDAO data structures and validates
 * statistical accuracy of outlier detection methods.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { 
  PriceOutlierDetector, 
  PriceCacheOutlierAnalyzer,
  OutlierDetectionConfig 
} from '../outlier-detection';

describe('PriceOutlierDetector', () => {
  const normalPrices = [10, 12, 11, 13, 12, 10, 14, 12, 15, 14, 13, 11];
  const pricesWithOutliers = [10, 12, 11, 13, 12, 100, 14, 12, 15, 14, 2, 11]; // 100 and 2 are outliers

  describe('detectOutliers', () => {
    test('IQR method correctly identifies outliers', () => {
      const results = PriceOutlierDetector.detectOutliers(pricesWithOutliers, {
        method: 'iqr',
        threshold: 1.5
      });

      const outliers = results.filter(r => r.isOutlier);
      const outlierValues = outliers.map(o => o.value);
      
      expect(outlierValues).toContain(100);
      expect(outlierValues).toContain(2);
      expect(outliers.length).toBe(2);
    });

    test('Z-score method correctly identifies outliers', () => {
      const results = PriceOutlierDetector.detectOutliers(pricesWithOutliers, {
        method: 'zscore',
        threshold: 2.0
      });

      const outliers = results.filter(r => r.isOutlier);
      expect(outliers.length).toBeGreaterThan(0);
    });

    test('handles insufficient sample size gracefully', () => {
      const smallSample = [10, 12];
      const results = PriceOutlierDetector.detectOutliers(smallSample, {
        minSampleSize: 5
      });

      expect(results.every(r => !r.isOutlier)).toBe(true);
      expect(results[0].reason).toContain('Insufficient sample size');
    });

    test('confidence scores are properly calculated', () => {
      const results = PriceOutlierDetector.detectOutliers(pricesWithOutliers);
      const outliers = results.filter(r => r.isOutlier);
      
      outliers.forEach(outlier => {
        expect(outlier.confidence).toBeGreaterThan(0);
        expect(outlier.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('calculateStatistics', () => {
    test('calculates correct basic statistics', () => {
      const stats = PriceOutlierDetector.calculateStatistics(normalPrices);
      
      expect(stats.count).toBe(12);
      expect(stats.median).toBeCloseTo(12, 1);
      expect(stats.mean).toBeCloseTo(12.25, 1);
      expect(stats.q1).toBeCloseTo(11, 1);
      expect(stats.q3).toBeCloseTo(13.5, 1);
      expect(stats.iqr).toBeCloseTo(2.5, 1);
    });

    test('handles edge cases correctly', () => {
      const singleValue = [10];
      const stats = PriceOutlierDetector.calculateStatistics(singleValue);
      
      expect(stats.count).toBe(1);
      expect(stats.median).toBe(10);
      expect(stats.mean).toBe(10);
      expect(stats.standardDeviation).toBe(0);
    });
  });

  describe('filterStatisticalOutliers', () => {
    const mockListings = pricesWithOutliers.map((price, index) => ({
      id: `listing-${index}`,
      cardId: 'card-1',
      source: 'test',
      price,
      currency: 'USD',
      url: `http://test.com/${index}`,
      isActive: true,
      scrapedAt: new Date(),
      card: null as any,
      evaluations: []
    }));

    test('filters out outlier listings correctly', () => {
      const filtered = PriceOutlierDetector.filterStatisticalOutliers(mockListings);
      
      const filteredPrices = filtered.map(l => l.price);
      expect(filteredPrices).not.toContain(100);
      expect(filteredPrices).not.toContain(2);
      expect(filtered.length).toBeLessThan(mockListings.length);
    });

    test('preserves listing structure and properties', () => {
      const filtered = PriceOutlierDetector.filterStatisticalOutliers(mockListings);
      
      filtered.forEach(listing => {
        expect(listing).toHaveProperty('id');
        expect(listing).toHaveProperty('cardId');
        expect(listing).toHaveProperty('source');
        expect(listing).toHaveProperty('price');
        expect(listing.currency).toBe('USD');
      });
    });
  });
});

describe('PriceCacheOutlierAnalyzer', () => {
  const mockPriceCacheEntries = [
    { id: '1', cardId: 'card-1', source: 'ebay', price: 10, windowStart: new Date(), windowEnd: new Date(), aggregatedAt: new Date(), sampleSize: 5, card: null as any },
    { id: '2', cardId: 'card-1', source: 'ebay', price: 12, windowStart: new Date(), windowEnd: new Date(), aggregatedAt: new Date(), sampleSize: 5, card: null as any },
    { id: '3', cardId: 'card-1', source: 'ebay', price: 11, windowStart: new Date(), windowEnd: new Date(), aggregatedAt: new Date(), sampleSize: 5, card: null as any },
    { id: '4', cardId: 'card-1', source: 'ebay', price: 100, windowStart: new Date(), windowEnd: new Date(), aggregatedAt: new Date(), sampleSize: 5, card: null as any }, // outlier
    { id: '5', cardId: 'card-1', source: 'ebay', price: 13, windowStart: new Date(), windowEnd: new Date(), aggregatedAt: new Date(), sampleSize: 5, card: null as any },
  ];

  describe('analyzeCardPrices', () => {
    test('provides comprehensive analysis of price cache entries', () => {
      const analysis = PriceCacheOutlierAnalyzer.analyzeCardPrices(mockPriceCacheEntries);
      
      expect(analysis.statistics).toHaveProperty('mean');
      expect(analysis.statistics).toHaveProperty('median');
      expect(analysis.statistics).toHaveProperty('iqr');
      expect(analysis.outliers).toHaveLength(5);
      expect(analysis.cleanedPrices.length).toBeLessThan(5); // Should remove outlier
    });

    test('identifies price cache outliers correctly', () => {
      const analysis = PriceCacheOutlierAnalyzer.analyzeCardPrices(mockPriceCacheEntries);
      const outlierPrices = analysis.outliers
        .filter(o => o.isOutlier)
        .map(o => o.value);
      
      expect(outlierPrices).toContain(100);
    });
  });

  describe('calculateFairValue', () => {
    test('calculates median fair value correctly', () => {
      const result = PriceCacheOutlierAnalyzer.calculateFairValue(
        mockPriceCacheEntries, 
        'median'
      );
      
      expect(result.fairValue).toBeCloseTo(11.5, 1); // Should be around median of normal values
      expect(result.outlierCount).toBe(1);
      expect(result.sampleSize).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('calculates trimmed mean fair value', () => {
      const result = PriceCacheOutlierAnalyzer.calculateFairValue(
        mockPriceCacheEntries,
        'trimmed_mean'
      );
      
      expect(result.fairValue).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('provides confidence based on sample size', () => {
      const smallSample = mockPriceCacheEntries.slice(0, 2);
      const largeSample = mockPriceCacheEntries;
      
      const smallResult = PriceCacheOutlierAnalyzer.calculateFairValue(smallSample);
      const largeResult = PriceCacheOutlierAnalyzer.calculateFairValue(largeSample);
      
      expect(largeResult.confidence).toBeGreaterThanOrEqual(smallResult.confidence);
    });
  });
});

describe('Integration with PokeDAO patterns', () => {
  test('outlier detection integrates with card normalization keys', () => {
    // Test that our outlier detection works with cardKeys from Phase 2
    const cardKey = 'base1-004-holo-psa9'; // From our Phase 2 normalization
    
    const mockListings = [
      { price: 100, cardId: 'card-1', source: 'ebay' },
      { price: 105, cardId: 'card-1', source: 'ebay' },
      { price: 98, cardId: 'card-1', source: 'ebay' },
      { price: 500, cardId: 'card-1', source: 'ebay' }, // Obvious outlier
    ];

    const prices = mockListings.map(l => l.price);
    const outliers = PriceOutlierDetector.detectOutliers(prices);
    const hasOutliers = outliers.some(o => o.isOutlier);
    
    expect(hasOutliers).toBe(true);
  });

  test('performance meets requirements for high-volume processing', () => {
    const largePriceSet = Array.from({ length: 1000 }, () => Math.random() * 100 + 50);
    
    const startTime = performance.now();
    const outliers = PriceOutlierDetector.detectOutliers(largePriceSet);
    const endTime = performance.now();
    
    const processingTime = endTime - startTime;
    expect(processingTime).toBeLessThan(100); // Should process 1000 prices in under 100ms
    expect(outliers).toHaveLength(1000);
  });
});
