/**
 * Price Outlier Detection Utilities
 * 
 * Extracted and adapted from statistical analysis patterns commonly used
 * in marketplace price analysis. Integrates with PokeDAO's PriceCache table.
 * 
 * @author PokeDAO Builder - Phase 3 Fork Integration
 * @inspired_by Statistical outlier detection patterns from market analysis tools
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Define types based on our Prisma schema
type PriceCache = {
  id: number;
  cardKey: string;
  marketplace: string;
  price: Decimal;
  currency: string;
  condition: string | null;
  grade: string | null;
  soldAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type Listing = {
  id: number;
  cardId: number;
  price: Decimal;
  condition: string | null;
  marketplace: string;
  url: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface OutlierResult {
  value: number;
  isOutlier: boolean;
  outlierType: 'statistical' | 'manual' | 'temporal';
  confidence: number;
  reason: string;
}

export interface PriceStatistics {
  mean: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  standardDeviation: number;
  count: number;
}

export interface OutlierDetectionConfig {
  method: 'iqr' | 'zscore' | 'modified_zscore' | 'isolation_forest';
  threshold: number;
  minSampleSize: number;
  windowDays?: number;
}

/**
 * Advanced price outlier detection for Pokemon card market analysis
 */
export class PriceOutlierDetector {
  private static readonly DEFAULT_CONFIG: OutlierDetectionConfig = {
    method: 'iqr',
    threshold: 1.5,
    minSampleSize: 5,
    windowDays: 30
  };

  /**
   * Detect outliers in price data using multiple statistical methods
   */
  static detectOutliers(
    prices: number[], 
    config: Partial<OutlierDetectionConfig> = {}
  ): OutlierResult[] {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    if (prices.length < finalConfig.minSampleSize) {
      return prices.map(price => ({
        value: price,
        isOutlier: false,
        outlierType: 'statistical' as const,
        confidence: 0,
        reason: 'Insufficient sample size for outlier detection'
      }));
    }

    switch (finalConfig.method) {
      case 'iqr':
        return this.detectIQROutliers(prices, finalConfig.threshold);
      case 'zscore':
        return this.detectZScoreOutliers(prices, finalConfig.threshold);
      case 'modified_zscore':
        return this.detectModifiedZScoreOutliers(prices, finalConfig.threshold);
      default:
        return this.detectIQROutliers(prices, finalConfig.threshold);
    }
  }

  /**
   * Calculate comprehensive price statistics
   */
  static calculateStatistics(prices: number[]): PriceStatistics {
    const sorted = [...prices].sort((a, b) => a - b);
    const n = sorted.length;
    
    const mean = sorted.reduce((sum, price) => sum + price, 0) / n;
    const median = this.calculatePercentile(sorted, 50);
    const q1 = this.calculatePercentile(sorted, 25);
    const q3 = this.calculatePercentile(sorted, 75);
    const iqr = q3 - q1;
    
    const variance = sorted.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    return {
      mean,
      median,
      q1,
      q3,
      iqr,
      standardDeviation,
      count: n
    };
  }

  /**
   * Filter listings by removing statistical outliers
   * Integrates with PokeDAO Listing type from Prisma
   */
  static filterStatisticalOutliers(
    listings: (Listing & { price: number })[], 
    config: Partial<OutlierDetectionConfig> = {}
  ): (Listing & { price: number })[] {
    const prices = listings.map(listing => listing.price);
    const outlierResults = this.detectOutliers(prices, config);
    
    return listings.filter((_, index) => !outlierResults[index].isOutlier);
  }

  /**
   * IQR-based outlier detection (most robust for skewed price distributions)
   */
  private static detectIQROutliers(prices: number[], threshold: number): OutlierResult[] {
    const stats = this.calculateStatistics(prices);
    const lowerBound = stats.q1 - threshold * stats.iqr;
    const upperBound = stats.q3 + threshold * stats.iqr;

    return prices.map(price => {
      const isOutlier = price < lowerBound || price > upperBound;
      const confidence = isOutlier 
        ? Math.min(Math.abs(price - stats.median) / stats.iqr, 1.0)
        : 0;

      return {
        value: price,
        isOutlier,
        outlierType: 'statistical' as const,
        confidence,
        reason: isOutlier 
          ? `Price ${price < lowerBound ? 'below' : 'above'} IQR bounds (${lowerBound.toFixed(2)}-${upperBound.toFixed(2)})`
          : 'Within normal price range'
      };
    });
  }

  /**
   * Z-score based outlier detection
   */
  private static detectZScoreOutliers(prices: number[], threshold: number): OutlierResult[] {
    const stats = this.calculateStatistics(prices);
    
    return prices.map(price => {
      const zScore = Math.abs(price - stats.mean) / stats.standardDeviation;
      const isOutlier = zScore > threshold;
      
      return {
        value: price,
        isOutlier,
        outlierType: 'statistical' as const,
        confidence: Math.min(zScore / threshold, 1.0),
        reason: isOutlier 
          ? `Z-score ${zScore.toFixed(2)} exceeds threshold ${threshold}`
          : `Z-score ${zScore.toFixed(2)} within threshold`
      };
    });
  }

  /**
   * Modified Z-score using median absolute deviation (more robust)
   */
  private static detectModifiedZScoreOutliers(prices: number[], threshold: number): OutlierResult[] {
    const sorted = [...prices].sort((a, b) => a - b);
    const median = this.calculatePercentile(sorted, 50);
    
    const absoluteDeviations = prices.map(price => Math.abs(price - median));
    const mad = this.calculatePercentile([...absoluteDeviations].sort((a, b) => a - b), 50);
    
    return prices.map(price => {
      const modifiedZScore = 0.6745 * (price - median) / mad;
      const isOutlier = Math.abs(modifiedZScore) > threshold;
      
      return {
        value: price,
        isOutlier,
        outlierType: 'statistical' as const,
        confidence: Math.min(Math.abs(modifiedZScore) / threshold, 1.0),
        reason: isOutlier 
          ? `Modified Z-score ${modifiedZScore.toFixed(2)} exceeds threshold ${threshold}`
          : `Modified Z-score ${modifiedZScore.toFixed(2)} within threshold`
      };
    });
  }

  /**
   * Calculate percentile value from sorted array
   */
  private static calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    return sortedArray[lower] * (upper - index) + sortedArray[upper] * (index - lower);
  }
}

/**
 * Integration helper for PokeDAO PriceCache table
 */
export class PriceCacheOutlierAnalyzer {
  /**
   * Analyze price cache entries for a specific card
   */
  static analyzeCardPrices(
    priceCacheEntries: PriceCache[],
    config: Partial<OutlierDetectionConfig> = {}
  ): {
    statistics: PriceStatistics;
    outliers: OutlierResult[];
    cleanedPrices: number[];
  } {
    const prices = priceCacheEntries.map(entry => entry.price.toNumber());
    const statistics = PriceOutlierDetector.calculateStatistics(prices);
    const outliers = PriceOutlierDetector.detectOutliers(prices, config);
    const cleanedPrices = prices.filter((_, index) => !outliers[index].isOutlier);
    
    return {
      statistics,
      outliers,
      cleanedPrices
    };
  }

  /**
   * Calculate fair value estimate after removing outliers
   */
  static calculateFairValue(
    priceCacheEntries: PriceCache[],
    method: 'median' | 'mean' | 'trimmed_mean' = 'median'
  ): {
    fairValue: number;
    confidence: number;
    sampleSize: number;
    outlierCount: number;
  } {
    const analysis = this.analyzeCardPrices(priceCacheEntries);
    
    let fairValue: number;
    switch (method) {
      case 'median':
        fairValue = analysis.statistics.median;
        break;
      case 'mean':
        fairValue = analysis.statistics.mean;
        break;
      case 'trimmed_mean':
        // Use 10% trimmed mean (remove top and bottom 10%)
        const trimmedPrices = analysis.cleanedPrices
          .sort((a, b) => a - b)
          .slice(
            Math.floor(analysis.cleanedPrices.length * 0.1),
            Math.ceil(analysis.cleanedPrices.length * 0.9)
          );
        fairValue = trimmedPrices.reduce((sum, price) => sum + price, 0) / trimmedPrices.length;
        break;
    }
    
    const outlierCount = analysis.outliers.filter(o => o.isOutlier).length;
    const confidence = Math.min(analysis.cleanedPrices.length / 10, 1.0); // More samples = higher confidence
    
    return {
      fairValue,
      confidence,
      sampleSize: analysis.cleanedPrices.length,
      outlierCount
    };
  }
}
