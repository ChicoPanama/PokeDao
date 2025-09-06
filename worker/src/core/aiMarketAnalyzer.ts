import { DeepSeekCardEvaluator } from '../deepseek-evaluator.js';
import { CardParser } from './cardParser.js';
import { DataAggregator } from './dataAggregator.js';
import { PriceSource, CardData, LowestPrice } from '../types/interfaces.js';

export interface MarketAnalysis {
  pricing: {
    marketValue: number;
    confidence: number;
    sources: PriceSource[];
    lowestPrice: LowestPrice;
  };
  assessment: string;
  aiAnalysis: string;
  trendPrediction: string;
  investmentThesis: string;
  recommendation: string;
  aiConfidence: number;
}

export class AIMarketAnalyzer {
  private deepseek: DeepSeekCardEvaluator;
  private parser: CardParser;
  private dataAggregator: DataAggregator;
  private cache = new Map<string, MarketAnalysis>();

  constructor(config: { pokemonTCGKey?: string; deepseekKey: string }) {
    this.deepseek = new DeepSeekCardEvaluator(config.deepseekKey);
    this.parser = new CardParser();
    this.dataAggregator = new DataAggregator();
  }

  async analyzeCard(cardName: string, listedPrice: number): Promise<MarketAnalysis> {
    const cacheKey = `${cardName}-${listedPrice}`;
    if (this.cache.has(cacheKey)) {
      console.log('Using cached analysis');
      return this.cache.get(cacheKey)!;
    }

    const cardData = this.parser.parseCardName(cardName);
    const marketData = await this.dataAggregator.aggregateMarketData(cardData, listedPrice);
    const aiAnalysis = await this.generateAIAnalysis(cardData, marketData, listedPrice);
    
    const analysis: MarketAnalysis = {
      pricing: {
        marketValue: marketData.trimmedMean,
        confidence: this.mapConfidenceToNumber(marketData.confidence),
        sources: marketData.sources,
        lowestPrice: marketData.lowestPrice
      },
      assessment: this.generateAssessment(marketData.trimmedMean, listedPrice),
      aiAnalysis: aiAnalysis.analysis,
      trendPrediction: aiAnalysis.trend,
      investmentThesis: aiAnalysis.thesis,
      recommendation: aiAnalysis.recommendation,
      aiConfidence: aiAnalysis.confidence
    };

    this.cache.set(cacheKey, analysis);
    return analysis;
  }

  private async generateAIAnalysis(cardData: CardData, marketData: any, listedPrice: number) {
    const trendInfo = `${marketData.trend.direction} ${marketData.trend.percentage}% over ${marketData.trend.timeframe}`;
    const dataQuality = `${marketData.count} comparable sales, ${marketData.confidence} confidence`;
    
    const prompt = `Pokemon card investment analysis:

Card: ${cardData.name} ${cardData.set} ${cardData.grade}
Listed: $${listedPrice.toLocaleString()}
Market Value: $${marketData.trimmedMean.toLocaleString()} (based on ${dataQuality})
Recent Trend: ${trendInfo}
Lowest Available: $${marketData.lowestPrice.price.toLocaleString()} on ${marketData.lowestPrice.source}

Provide detailed analysis in this format:

ANALYSIS: [2-3 sentences about market position, collectibility, and current pricing vs market]
TREND: [1-2 sentences about price trajectory and market dynamics] 
THESIS: [2-3 sentences about investment rationale and risk/reward profile]
RECOMMENDATION: BUY/HOLD/PASS
CONFIDENCE: [75-95]%

Focus on collectibles fundamentals, population scarcity, and market timing.`;

    try {
      const completion = await this.deepseek.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.3
      });

      const response = completion.choices[0]?.message?.content || '';
      
      return {
        analysis: this.extractSection(response, 'ANALYSIS'),
        trend: this.extractSection(response, 'TREND'),
        thesis: this.extractSection(response, 'THESIS'),
        recommendation: this.extractSection(response, 'RECOMMENDATION'),
        confidence: this.extractConfidence(response)
      };

    } catch (error) {
      console.log('AI analysis failed, using market-informed fallback');
      return this.getMarketInformedFallback(cardData, marketData, listedPrice);
    }
  }

  private extractSection(response: string, section: string): string {
    const match = response.match(new RegExp(`${section}:\\s*(.+?)(?:\\n|${section.slice(0, -1)}:|$)`, 'i'));
    return match ? match[1].trim() : this.getFallbackForSection(section);
  }

  private extractConfidence(response: string): number {
    const match = response.match(/CONFIDENCE:\s*(\d+)%/i);
    return match ? parseInt(match[1]) : 85;
  }

  private getFallbackForSection(section: string): string {
    const fallbacks: { [key: string]: string } = {
      'ANALYSIS': 'Market analysis based on recent comparable sales and established collector demand patterns.',
      'TREND': 'Price trends indicate stable market conditions with potential for appreciation in premium grades.',
      'THESIS': 'Investment fundamentals supported by collectible scarcity and sustained market interest.',
      'RECOMMENDATION': 'HOLD'
    };
    return fallbacks[section] || 'Analysis complete';
  }

  private getMarketInformedFallback(cardData: CardData, marketData: any, listedPrice: number) {
    const ratio = listedPrice / marketData.trimmedMean;
    
    return {
      analysis: `Based on ${marketData.count} recent sales, this ${cardData.grade} ${cardData.set} ${cardData.name} shows ${marketData.confidence} market confidence. Current listing ${ratio > 1.15 ? 'exceeds' : 'aligns with'} established transaction data.`,
      trend: `Market trend: ${marketData.trend.direction} ${Math.abs(marketData.trend.percentage)}% over recent ${marketData.trend.timeframe}, indicating ${marketData.trend.direction === 'up' ? 'strengthening' : marketData.trend.direction === 'down' ? 'softening' : 'stable'} collector demand.`,
      thesis: `Investment rationale centers on ${cardData.grade?.includes('10') ? 'population scarcity in perfect grade' : 'high-grade collectible status'} with ${ratio > 1.2 ? 'premium pricing requiring market appreciation' : 'reasonable entry point for long-term holding'}.`,
      recommendation: ratio > 1.25 ? 'PASS' : ratio > 1.1 ? 'HOLD' : 'BUY',
      confidence: 80
    };
  }

  private mapConfidenceToNumber(confidence: string): number {
  const mapping: { [key: string]: number } = { 'high': 0.9, 'medium': 0.75, 'low': 0.6 };
  return mapping[confidence] || 0.75;
  }

  private generateAssessment(marketValue: number, listedPrice: number): string {
    const diff = ((listedPrice - marketValue) / marketValue * 100);
    
    if (diff > 20) return 'OVERVALUED';
    if (diff > 10) return 'ABOVE MARKET';
    if (diff > -8) return 'FAIR VALUE';
    if (diff > -20) return 'BELOW MARKET';
    return 'UNDERVALUED';
  }
}
