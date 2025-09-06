import { CardSearchEngine } from './cardSearchEngine.js';
import { PriceAggregator } from './priceAggregator.js';
import { PokemonTCGAPI } from '../apis/pokemonTCG.js';
import { PriceTrackerAPI } from '../apis/priceTracker.js';
import { CardAnalysis, PriceSource } from '../types/interfaces.js';

export class MarketAnalyzer {
  private searchEngine: CardSearchEngine;
  private priceAggregator: PriceAggregator;
  private pokemonTCG: PokemonTCGAPI;
  private priceTracker?: PriceTrackerAPI;

  constructor(config: {
    pokemonTCGKey?: string;
    priceTrackerKey?: string;
  }) {
    this.searchEngine = new CardSearchEngine();
    this.priceAggregator = new PriceAggregator();
    this.pokemonTCG = new PokemonTCGAPI(config.pokemonTCGKey);
    
    if (config.priceTrackerKey) {
      this.priceTracker = new PriceTrackerAPI(config.priceTrackerKey);
    }
  }

  async analyzeCard(cardName: string, listedPrice: number): Promise<CardAnalysis> {
    console.log(`Analyzing: ${cardName}`);
    console.log(`Listed Price: $${listedPrice.toLocaleString()}`);
    
    // Generate search strategies
    const searchStrategy = this.searchEngine.generateSearchStrategies(cardName);
    const cardData = this.searchEngine['parseCardName'](cardName);
    
    // Gather price sources from multiple APIs
    const allSources: PriceSource[] = [];
    
    // Pokemon TCG API
    try {
      const tcgSources = await this.pokemonTCG.searchCard(
        [searchStrategy.primary, ...searchStrategy.fallbacks],
        cardData
      );
      allSources.push(...tcgSources);
    } catch (error) {
      console.log(`Pokemon TCG API failed: ${error.message}`);
    }
    
    // Price Tracker API (if available)
    if (this.priceTracker) {
      try {
        const trackerSources = await this.priceTracker.searchCard(
          [searchStrategy.primary, ...searchStrategy.fallbacks],
          cardData
        );
        allSources.push(...trackerSources);
      } catch (error) {
        console.log(`Price Tracker API failed: ${error.message}`);
      }
    }
    
    // Add mock eBay data (replace with real eBay API)
    allSources.push(...this.generateMockEbaySales(listedPrice, cardData));
    
    // Aggregate prices
    const { marketValue, confidence, weightedSources } = this.priceAggregator.calculateMarketValue(allSources);
    
    // Generate assessment and recommendation
    const assessment = this.priceAggregator.assessValue(listedPrice, marketValue);
    const trend = this.determineTrend(cardData, weightedSources);
    const recommendation = this.priceAggregator.generateRecommendation(assessment, confidence, trend);
    
    // Generate analysis
    const analysis: CardAnalysis = {
      card: cardData,
      pricing: {
        listedPrice,
        marketValue,
        confidence,
        sources: weightedSources,
        gradedPremium: cardData.grade ? this.calculateGradedPremium(weightedSources) : undefined
      },
      assessment,
      recommendation,
      reasoning: this.generateReasoning(listedPrice, marketValue, assessment, confidence),
      trend,
      investmentThesis: this.generateInvestmentThesis(cardData, assessment, trend),
      lastTwoSales: this.extractLastTwoSales(weightedSources)
    };
    
    return analysis;
  }

  private generateMockEbaySales(listedPrice: number, cardData: any): PriceSource[] {
    // This would be replaced with real eBay API calls
    const basePrice = listedPrice * (0.7 + Math.random() * 0.4);
    
    return [
      {
        source: 'eBay Sold Listings',
        price: Math.round(basePrice * (0.95 + Math.random() * 0.1)),
        confidence: 0.9,
        timestamp: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
        grade: cardData.grade
      },
      {
        source: 'eBay Sold Listings',
        price: Math.round(basePrice * (0.95 + Math.random() * 0.1)),
        confidence: 0.9,
        timestamp: new Date(Date.now() - (14 + Math.random() * 21) * 24 * 60 * 60 * 1000),
        grade: cardData.grade
      }
    ];
  }

  private determineTrend(cardData: any, sources: PriceSource[]): 'RISING' | 'STABLE' | 'DECLINING' {
    // Simplified trend analysis - would use historical data in production
    if (cardData.language === 'Japanese' && cardData.grade?.includes('10')) return 'RISING';
    if (cardData.set === 'Base Set' || cardData.set === 'Jungle') return 'RISING';
    if (parseInt(cardData.name.match(/\d{4}/)?.[0] || '2000') >= 2020) return 'STABLE';
    return 'STABLE';
  }

  private calculateGradedPremium(sources: PriceSource[]): number {
    const gradedSources = sources.filter(s => s.grade);
    const ungradedSources = sources.filter(s => !s.grade);
    
    if (gradedSources.length === 0 || ungradedSources.length === 0) return 0;
    
    const gradedAvg = gradedSources.reduce((sum, s) => sum + s.price, 0) / gradedSources.length;
    const ungradedAvg = ungradedSources.reduce((sum, s) => sum + s.price, 0) / ungradedSources.length;
    
    return ((gradedAvg - ungradedAvg) / ungradedAvg) * 100;
  }

  private generateReasoning(
    listedPrice: number,
    marketValue: number,
    assessment: string,
    confidence: number
  ): string {
    const percentage = Math.abs(((marketValue - listedPrice) / listedPrice) * 100).toFixed(1);
    
    if (assessment === 'UNDERVALUED') {
      return `Listed ${percentage}% below market value of $${marketValue.toLocaleString()}. Strong value opportunity with ${(confidence * 100).toFixed(0)}% confidence.`;
    } else if (assessment === 'OVERVALUED') {
      return `Listed ${percentage}% above market value of $${marketValue.toLocaleString()}. Premium pricing not justified by current market data.`;
    } else {
      return `Fairly priced within ${percentage}% of market value $${marketValue.toLocaleString()}. Reasonable market pricing.`;
    }
  }

  private generateInvestmentThesis(cardData: any, assessment: string, trend: string): string {
    const elements = [];
    
    if (cardData.language === 'Japanese') elements.push('Japanese exclusivity premium');
    if (cardData.grade?.includes('10')) elements.push('perfect grade scarcity');
    if (cardData.set === 'Base Set') elements.push('foundational set significance');
    if (['Charizard', 'Pikachu', 'Lugia'].includes
if (['Charizard', 'Pikachu', 'Lugia'].includes(cardData.name)) elements.push('iconic Pokemon recognition');
    if (cardData.isFirstEdition) elements.push('first edition rarity');
    
    let thesis = `This card represents `;
    
    if (assessment === 'UNDERVALUED') {
      thesis += `a compelling investment opportunity with ${elements.join(', ')}. `;
      thesis += trend === 'RISING' ? 'Rising market trends support near-term appreciation potential.' : 'Market stability provides lower-risk entry point.';
    } else if (assessment === 'OVERVALUED') {
      thesis += `limited investment appeal due to premium pricing despite ${elements.join(', ')}. `;
      thesis += 'Current asking price requires significant market appreciation to justify investment returns.';
    } else {
      thesis += `solid fundamentals with ${elements.join(', ')}. `;
      thesis += 'Fair pricing allows for steady long-term appreciation aligned with market growth.';
    }
    
    return thesis;
  }

  private extractLastTwoSales(sources: PriceSource[]): { price: number; date: string; platform: string }[] {
    return sources
      .filter(s => s.source.includes('eBay') || s.source.includes('TCGPlayer'))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 2)
      .map(s => ({
        price: s.price,
        date: s.timestamp.toISOString().split('T')[0],
        platform: s.source
      }));
  }
}
