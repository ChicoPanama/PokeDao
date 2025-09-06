import { PriceSource } from '../types/interfaces.js';

export class PriceAggregator {
  private readonly sourceWeights = {
    'eBay Sold Listings': 0.40,
    'Pokemon TCG API': 0.30,
    'Price Tracker API': 0.20,
    'JustTCG API': 0.10
  };

  calculateMarketValue(sources: PriceSource[]): {
    marketValue: number;
    confidence: number;
    weightedSources: PriceSource[];
  } {
    if (sources.length === 0) {
      return { marketValue: 0, confidence: 0, weightedSources: [] };
    }

    // Filter out extremely low confidence sources
    const validSources = sources.filter(source => source.confidence >= 0.3);
    
    if (validSources.length === 0) {
      return { marketValue: 0, confidence: 0, weightedSources: [] };
    }

    // Remove outliers (prices more than 3 standard deviations from mean)
    const filteredSources = this.removeOutliers(validSources);
    
    // Calculate weighted average
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const source of filteredSources) {
      const sourceWeight = this.sourceWeights[source.source] || 0.05;
      const adjustedWeight = sourceWeight * source.confidence;
      
      weightedSum += source.price * adjustedWeight;
      totalWeight += adjustedWeight;
    }
    
    const marketValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(filteredSources);
    
    return {
      marketValue: Math.round(marketValue),
      confidence,
      weightedSources: filteredSources
    };
  }

  private removeOutliers(sources: PriceSource[]): PriceSource[] {
    if (sources.length <= 2) return sources;
    
    const prices = sources.map(s => s.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Keep sources within 2 standard deviations
    return sources.filter(source => 
      Math.abs(source.price - mean) <= 2 * stdDev
    );
  }

  private calculateOverallConfidence(sources: PriceSource[]): number {
    if (sources.length === 0) return 0;
    
    // Base confidence on number of sources and their individual confidences
    const avgConfidence = sources.reduce((sum, s) => sum + s.confidence, 0) / sources.length;
    const sourceCountBonus = Math.min(sources.length * 0.1, 0.3);
    
    return Math.min(avgConfidence + sourceCountBonus, 1.0);
  }

  assessValue(listedPrice: number, marketValue: number): 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' {
    const difference = (marketValue - listedPrice) / listedPrice;
    
    if (difference > 0.15) return 'UNDERVALUED';
    if (difference < -0.15) return 'OVERVALUED';
    return 'FAIRLY_VALUED';
  }

  generateRecommendation(
    assessment: 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED',
    confidence: number,
    trend: 'RISING' | 'STABLE' | 'DECLINING'
  ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'PASS' | 'AVOID' {
    if (confidence < 0.5) return 'PASS';
    
    if (assessment === 'UNDERVALUED') {
      if (trend === 'RISING' && confidence > 0.8) return 'STRONG_BUY';
      if (trend !== 'DECLINING') return 'BUY';
      return 'HOLD';
    }
    
    if (assessment === 'OVERVALUED') {
      if (trend === 'DECLINING') return 'AVOID';
      return 'PASS';
    }
    
    // FAIRLY_VALUED
    if (trend === 'RISING' && confidence > 0.7) return 'BUY';
    if (trend === 'DECLINING') return 'PASS';
    return 'HOLD';
  }

