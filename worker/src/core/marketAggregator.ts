import { PriceSource } from '../types/interfaces.js';

export class MarketAggregator {
  private sourceWeights: { [key: string]: number } = {
    'eBay Sold Listings': 0.40,
    'Pokemon TCG API': 0.30,
    'Price Tracker API': 0.20,
    'Other': 0.10
  };

  aggregatePrices(sources: PriceSource[]): {
    marketValue: number;
    confidence: number;
  } {
    if (sources.length === 0) {
      return { marketValue: 0, confidence: 0 };
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (const source of sources) {
      const weight = this.sourceWeights[source.source] || this.sourceWeights['Other'];
      const adjustedWeight = weight * source.confidence;
      
      weightedSum += source.price * adjustedWeight;
      totalWeight += adjustedWeight;
    }

    const marketValue = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const confidence = Math.min(totalWeight + (sources.length * 0.1), 1.0);

    return { marketValue, confidence };
  }

  assessValue(listedPrice: number, marketValue: number): 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' {
    const difference = (marketValue - listedPrice) / listedPrice;
    
    if (difference > 0.15) return 'UNDERVALUED';
    if (difference < -0.15) return 'OVERVALUED';
    return 'FAIRLY_VALUED';
  }

  generateMockSales(marketValue: number): { price: number; date: string; platform: string }[] {
    const variation = 0.12;
    
    return [
      {
        price: Math.round(marketValue * (1 + (Math.random() * variation * 2 - variation))),
        date: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        platform: 'eBay'
      },
      {
        price: Math.round(marketValue * (1 + (Math.random() * variation * 2 - variation))),
        date: new Date(Date.now() - (14 + Math.random() * 21) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        platform: 'TCGPlayer'
      }
    ];
  }
}
