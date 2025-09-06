import { DeepSeekCardEvaluator } from '../deepseek-evaluator.js';
import { CardParser } from './cardParser.js';
import { MarketAggregator } from './marketAggregator.js';
import { PokemonTCGAPI } from '../apis/pokemonTCG.js';
import { MarketAnalysis, PriceSource } from '../types/interfaces.js';

export class AIMarketAnalyzer {
  private tcgAPI: PokemonTCGAPI;
  private aggregator: MarketAggregator;
  private aiEvaluator: DeepSeekCardEvaluator;

  constructor(config: { pokemonTCGKey?: string; deepseekKey: string }) {
    this.tcgAPI = new PokemonTCGAPI(config.pokemonTCGKey);
    this.aggregator = new MarketAggregator();
    this.aiEvaluator = new DeepSeekCardEvaluator(config.deepseekKey);
  }

  async analyzeCard(cardName: string, listedPrice: number): Promise<MarketAnalysis> {
    console.log(`Analyzing: ${cardName}`);
    console.log(`Listed: $${listedPrice.toLocaleString()}`);
    
    // Parse card data
    const cardData = CardParser.parseCardName(cardName);
    
    // Gather market data
    const sources: PriceSource[] = [];
    
    // Get Pokemon TCG API data
    try {
      const tcgSources = await this.tcgAPI.searchCard(cardData);
      sources.push(...tcgSources);
    } catch (error) {
      console.log(`Pokemon TCG API failed: ${error.message}`);
    }
    
    // Add mock eBay data (replace with real eBay API later)
    sources.push(...this.generateMockEbaySources(cardData, listedPrice));
    
    // Aggregate market pricing
    const { marketValue, confidence } = this.aggregator.aggregatePrices(sources);
    
    // Assess value
    const assessment = this.aggregator.assessValue(listedPrice, marketValue);
    
    // Generate last two sales
    const lastTwoSales = this.aggregator.generateMockSales(marketValue);
    
    // Get AI analysis
    const aiInsights = await this.getAIAnalysis(cardData, listedPrice, marketValue, sources, assessment);
    
    return {
      card: cardData,
      pricing: {
        listedPrice,
        marketValue,
        confidence,
        sources
      },
      assessment,
      aiAnalysis: aiInsights.analysis,
      trendPrediction: aiInsights.trendPrediction,
      investmentThesis: aiInsights.investmentThesis,
      recommendation: aiInsights.recommendation,
      aiConfidence: aiInsights.confidence,
      lastTwoSales
    };
  }

  private generateMockEbaySources(cardData: any, listedPrice: number): PriceSource[] {
    // Estimate market value based on card characteristics
    let baseValue = 100;
    
    if (cardName.includes('1996') || cardName.includes('1998')) baseValue = 800;
    if (cardData.grade?.includes('10')) baseValue *= 15;
    if (cardData.language === 'Japanese') baseValue *= 2;
    if (cardData.set === 'Base Set') baseValue *= 2;
    if (['Charizard', 'Pikachu'].includes(cardData.name)) baseValue *= 3;
    
    const estimatedValue = Math.min(baseValue, listedPrice * 0.85);
    
    return [
      {
        source: 'eBay Sold Listings',
        price: Math.round(estimatedValue * (0.95 + Math.random() * 0.1)),
        confidence: 0.9,
        timestamp: new Date(),
        grade: cardData.grade
      },
      {
        source: 'Price Tracker API',
        price: Math.round(estimatedValue * (0.95 + Math.random() * 0.1)),
        confidence: 0.8,
        timestamp: new Date(),
        grade: cardData.grade
      }
    ];
  }

  private async getAIAnalysis(cardData: any, listedPrice: number, marketValue: number, sources: PriceSource[], assessment: string) {
    const prompt = `Analyze this Pokemon card investment:

CARD: ${cardData.name} from ${cardData.set}
GRADE: ${cardData.grade || 'Ungraded'}
LANGUAGE: ${cardData.language}
LISTED PRICE: $${listedPrice.toLocaleString()}
MARKET VALUE: $${marketValue.toLocaleString()}
ASSESSMENT: ${assessment}

MARKET DATA:
${sources.map(s => `- ${s.source}: $${s.price.toLocaleString()} (${Math.round(s.confidence * 100)}% confidence)`).join('\n')}

Provide analysis in JSON format:
{
  "analysis": "[2-3 sentences explaining why this assessment makes sense given market data]",
  "trendPrediction": "[1 sentence on trend direction with reasoning]", 
  "investmentThesis": "[2-3 sentences on investment case]",
  "recommendation": "STRONG_BUY|BUY|HOLD|PASS|AVOID",
  "confidence": [1-100]
}`;

    try {
      const response = await this.aiEvaluator['client'].chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a professional Pokemon card investment analyst. Provide clear, data-driven analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 800
      });

      const aiResponse = response.choices[0]?.message?.content;
      const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (parsed) {
        return {
          analysis: parsed.analysis || 'AI analysis unavailable',
          trendPrediction: parsed.trendPrediction || 'Trend analysis unavailable',
          investmentThesis: parsed.investmentThesis || 'Investment thesis unavailable',
          recommendation: parsed.recommendation || 'HOLD',
          confidence: parsed.confidence || 70
        };
      }
    } catch (error) {
      console.log(`AI analysis failed: ${error.message}`);
    }

    // Fallback analysis
    return {
      analysis: `Card is ${assessment.toLowerCase()} based on market data comparison.`,
      trendPrediction: 'Market trend analysis requires more historical data.',
      investmentThesis: 'Investment decision should consider personal portfolio goals and risk tolerance.',
      recommendation: assessment === 'UNDERVALUED' ? 'BUY' : assessment === 'OVERVALUED' ? 'PASS' : 'HOLD',
      confidence: 60
    };
  }
}
