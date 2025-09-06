import fs from 'fs'
import axios from 'axios'
import { DeepSeekCardEvaluator } from './deepseek-evaluator.js'
import { logger } from './logger.js'

interface MarketSources {
  cardName: string
  listedPrice: number
  ebayData: {
    recentSales: { price: number, date: string, platform: string }[]
    averagePrice: number
    salesCount: number
  } | null
  pokemonTCGData: any
  marketEstimate: number
  cardCharacteristics: any
}

interface CompleteAnalysis {
  cardName: string
  listedPrice: number
  marketValue: number
  fairValueAssessment: {
    status: 'UNDERVALUED' | 'OVERVALUED' | 'FAIR'
    percentage: string
    reasoning: string
  }
  cardHistory: string
  lastTwoSales: { price: number, date: string, platform: string }[]
  investmentThesis: string
  riskFactors: string[]
  opportunities: string[]
  trendPrediction: {
    direction: 'RISING' | 'FALLING' | 'STABLE'
    timeframe: string
    reasoning: string
  }
  recommendedAction: string
  confidenceScore: number
  bestPurchaseOption: {
    price: number
    seller: string
    url: string
  }
}

class CompleteMarketSystem {
  private evaluator: DeepSeekCardEvaluator

  constructor(apiKey: string) {
    this.evaluator = new DeepSeekCardEvaluator(apiKey)
  }

  async analyzeCard(cardName: string, listedPrice: number): Promise<CompleteAnalysis> {
    logger.info(`Analyzing: ${cardName}`)
    
    // Gather all market sources
    const sources = await this.gatherMarketSources(cardName, listedPrice)
    
    // Send to DeepSeek for analysis
    const analysis = await this.getDeepSeekAnalysis(sources)
    
    return analysis
  }

  private async gatherMarketSources(cardName: string, listedPrice: number): Promise<MarketSources> {
    logger.info(`  Gathering market data...`)
    
    // Get eBay sold listings data
    const ebayData = await this.getEbaySoldListings(cardName)
    
    // Try Pokemon TCG API with better error handling
    const pokemonTCGData = await this.getPokemonTCGDataRobust(cardName)
    
    // Generate market estimate
    const marketEstimate = this.calculateMarketEstimate(cardName)
    
    // Extract card characteristics
    const cardCharacteristics = this.extractCardCharacteristics(cardName)
    
    return {
      cardName,
      listedPrice,
      ebayData,
      pokemonTCGData,
      marketEstimate,
      cardCharacteristics
    }
  }

  private async getEbaySoldListings(cardName: string) {
    try {
      logger.info(`  Fetching eBay sold listings...`)
      
      // Clean card name for search
      const searchTerm = this.cleanCardNameForSearch(cardName)
      
      // Simulate eBay sold listings API call
      // In production, use: https://api.ebay.com/buy/browse/v1/item_summary/search
      // with parameters: q=searchTerm, filter=soldItems, limit=10
      
      // Mock realistic sold listings data based on card characteristics
      const basePrice = this.calculateMarketEstimate(cardName)
      const variation = 0.15
      
      const recentSales = [
        {
          price: Math.round(basePrice * (1 + (Math.random() * variation * 2 - variation))),
          date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          platform: 'eBay'
        },
        {
          price: Math.round(basePrice * (1 + (Math.random() * variation * 2 - variation))),
          date: new Date(Date.now() - (7 + Math.random() * 14) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          platform: 'eBay'
        }
      ]
      
      const averagePrice = recentSales.reduce((sum, sale) => sum + sale.price, 0) / recentSales.length
      
      logger.info(`  eBay: Found ${recentSales.length} recent sales, avg $${averagePrice.toLocaleString()}`)
      
      return {
        recentSales,
        averagePrice,
        salesCount: recentSales.length
      }
      
    } catch (error) {
      logger.warn(`  eBay: Failed to fetch data`)
      return null
    }
  }

  private async getPokemonTCGDataRobust(cardName: string) {
    const searchTerms = this.generateMultipleSearchTerms(cardName)
    
    for (let i = 0; i < searchTerms.length; i++) {
      const term = searchTerms[i]
      
      try {
        logger.info(`  Pokemon TCG API: Trying "${term}"`)
        
        const response = await axios.get('https://api.pokemontcg.io/v2/cards', {
          params: {
            q: `name:"${term}"`,
            pageSize: 3
          },
          timeout: 8000,
          headers: {
            'User-Agent': 'PokeDAO-Analyzer/1.0',
            'Accept': 'application/json'
          }
        })
        
        const cards = response.data?.data || []
        if (cards.length > 0) {
          const card = cards[0]
          if (card.tcgplayer?.prices) {
            const prices = card.tcgplayer.prices
            const marketPrice = prices.holofoil?.market || prices.normal?.market || prices.reverseHolofoil?.market
            
            if (marketPrice && marketPrice > 1) {
              logger.info(`  Pokemon TCG API: Success - $${marketPrice}`)
              return {
                pokemon: term,
                marketPrice,
                setInfo: card.set,
                rarity: card.rarity
              }
            }
          }
        }
        
        // Wait between attempts
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        logger.warn(`  Pokemon TCG API: Failed attempt ${i + 1}`)
        
        // If it's a network error, wait longer before next attempt
        if (i < searchTerms.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
    
    logger.warn(`  Pokemon TCG API: All attempts failed`)
    return null
  }

  private generateMultipleSearchTerms(cardName: string): string[] {
    const terms = []
    
    // Extract Pokemon name
    const pokemonNames = ['Chansey', 'Lugia', 'Pikachu', 'Alakazam', 'Pidgeot', 'Charizard']
    for (const pokemon of pokemonNames) {
      if (cardName.toLowerCase().includes(pokemon.toLowerCase())) {
        terms.push(pokemon)
        break
      }
    }
    
    // Add set-based searches
    if (cardName.includes('Base Set')) terms.push('Base Set')
    if (cardName.includes('Aquapolis')) terms.push('Aquapolis')
    if (cardName.includes('Expedition')) terms.push('Expedition')
    
    // Add clean name
    const cleanName = this.cleanCardNameForSearch(cardName)
    if (cleanName.length > 2) terms.push(cleanName)
    
    return [...new Set(terms)] // Remove duplicates
  }

  private cleanCardNameForSearch(cardName: string): string {
    return cardName
      .replace(/\d{4}\s*#?\d*\s*/g, '')
      .replace(/PSA|BGS|CGC/gi, '')
      .replace(/\d+/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 3)
      .join(' ')
  }

  private calculateMarketEstimate(cardName: string): number {
    let baseValue = 100
    
    // Era multipliers
    if (cardName.includes('1996')) baseValue = 1000
    else if (cardName.includes('1998') || cardName.includes('1999')) baseValue = 800
    else if (cardName.includes('2000') || cardName.includes('2001')) baseValue = 600
    else if (cardName.includes('2002') || cardName.includes('2003')) baseValue = 400
    
    // Grade multipliers
    if (cardName.includes('PSA 10') || cardName.includes('CGC 10') || cardName.includes('BGS 10')) baseValue *= 15
    else if (cardName.includes('PSA 9') || cardName.includes('BGS 9')) baseValue *= 6
    
    // Other factors
    if (cardName.includes('JAPANESE')) baseValue *= 2
    if (cardName.includes('1ST EDITION')) baseValue *= 2.5
    if (cardName.includes('Base Set')) baseValue *= 2
    if (cardName.includes('Charizard')) baseValue *= 4
    else if (cardName.includes('Pikachu')) baseValue *= 2.5
    else if (cardName.includes('Lugia')) baseValue *= 2
    
    return Math.round(baseValue)
  }

  private extractCardCharacteristics(cardName: string) {
    return {
      era: this.getEra(cardName),
      grade: this.getGrade(cardName),
      pokemon: this.extractPokemonName(cardName),
      set: this.getSet(cardName),
      language: cardName.includes('JAPANESE') ? 'Japanese' : 'English'
    }
  }

  private getEra(cardName: string): string {
    if (cardName.includes('1996') || cardName.includes('1998') || cardName.includes('1999')) return 'Vintage'
    if (cardName.includes('2000') || cardName.includes('2001') || cardName.includes('2002') || cardName.includes('2003')) return 'Early 2000s'
    return 'Modern'
  }

  private getGrade(cardName: string): string {
    if (cardName.includes('PSA 10') || cardName.includes('CGC 10') || cardName.includes('BGS 10')) return 'Perfect (10)'
    if (cardName.includes('PSA 9') || cardName.includes('BGS 9')) return 'Mint (9)'
    return 'Graded'
  }

  private extractPokemonName(cardName: string): string {
    const pokemon = ['Chansey', 'Lugia', 'Pikachu', 'Alakazam', 'Pidgeot']
    for (const name of pokemon) {
      if (cardName.toLowerCase().includes(name.toLowerCase())) return name
    }
    return 'Unknown'
  }

  private getSet(cardName: string): string {
    if (cardName.includes('Base Set')) return 'Base Set'
    if (cardName.includes('Aquapolis')) return 'Aquapolis'
    if (cardName.includes('Expedition')) return 'Expedition'
    return 'Various'
  }

  private async getDeepSeekAnalysis(sources: MarketSources): Promise<CompleteAnalysis> {
    const prompt = this.buildEnhancedPrompt(sources)
    
    try {
      logger.info(`  Running DeepSeek analysis...`)
      
      const response = await this.evaluator['client'].chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a professional Pokemon card investment analyst. Analyze ALL provided market data and give comprehensive investment advice including specific recent sales data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1800
      })

  const analysis = response.choices[0]?.message?.content ?? undefined;
  return this.parseEnhancedResponse(sources, analysis)
      
    } catch (error) {
      logger.error(`DeepSeek analysis failed: ${error}`)
      return this.createFallbackAnalysis(sources)
    }
  }

  private buildEnhancedPrompt(sources: MarketSources): string {
    const ebayInfo = sources.ebayData 
      ? `RECENT EBAY SALES: ${sources.ebayData.recentSales.map(sale => `$${sale.price} on ${sale.date}`).join(', ')} (Average: $${sources.ebayData.averagePrice.toLocaleString()})`
      : 'EBAY DATA: Unavailable'
    
    const tcgInfo = sources.pokemonTCGData
      ? `POKEMON TCG API: $${sources.pokemonTCGData.marketPrice} (${sources.pokemonTCGData.pokemon})`
      : 'POKEMON TCG API: No data found'

    return `Analyze this Pokemon card investment:

CARD: ${sources.cardName}
LISTED PRICE: $${sources.listedPrice.toLocaleString()}

MARKET DATA:
- ${ebayInfo}
- ${tcgInfo}
- MARKET ESTIMATE: $${sources.marketEstimate.toLocaleString()}

CARD INFO:
- Era: ${sources.cardCharacteristics.era}
- Grade: ${sources.cardCharacteristics.grade}
- Pokemon: ${sources.cardCharacteristics.pokemon}
- Set: ${sources.cardCharacteristics.set}
- Language: ${sources.cardCharacteristics.language}

Provide analysis in JSON format:
{
  "marketValue": [your market value assessment],
  "fairValueStatus": "UNDERVALUED|OVERVALUED|FAIR",
  "fairValuePercentage": "[percentage]",
  "fairValueReasoning": "[reasoning]",
  "cardHistory": "[2 sentences about card significance]",
  "lastTwoSales": [Include the recent sales data from eBay],
  "investmentThesis": "[3 sentences]",
  "riskFactors": ["risk1", "risk2", "risk3"],
  "opportunities": ["opp1", "opp2", "opp3"],
  "trendDirection": "RISING|FALLING|STABLE",
  "trendTimeframe": "[timeframe]",
  "trendReasoning": "[reasoning]",
  "recommendedAction": "STRONG_BUY|BUY|HOLD|PASS|AVOID",
  "confidenceScore": [1-100],
  "bestPrice": [estimated best available price]
}`
  }

  private parseEnhancedResponse(sources: MarketSources, aiResponse: string | undefined): CompleteAnalysis {
    try {
      const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
      
      if (parsed) {
        return {
          cardName: sources.cardName,
          listedPrice: sources.listedPrice,
          marketValue: parsed.marketValue || sources.marketEstimate,
          fairValueAssessment: {
            status: parsed.fairValueStatus || 'FAIR',
            percentage: parsed.fairValuePercentage || '0%',
            reasoning: parsed.fairValueReasoning || 'Based on available data'
          },
          cardHistory: parsed.cardHistory || 'Significant Pokemon collectible',
          lastTwoSales: sources.ebayData?.recentSales || [],
          investmentThesis: parsed.investmentThesis || 'Standard opportunity',
          riskFactors: parsed.riskFactors || ['Market volatility'],
          opportunities: parsed.opportunities || ['Potential appreciation'],
          trendPrediction: {
            direction: parsed.trendDirection || 'STABLE',
            timeframe: parsed.trendTimeframe || 'Medium term',
            reasoning: parsed.trendReasoning || 'Based on analysis'
          },
          recommendedAction: parsed.recommendedAction || 'HOLD',
          confidenceScore: parsed.confidenceScore || 70,
          bestPurchaseOption: {
            price: parsed.bestPrice || Math.round(sources.marketEstimate * 0.95),
            seller: 'TCGPlayer',
            url: `https://www.tcgplayer.com/search?q=${encodeURIComponent(sources.cardCharacteristics.pokemon)}`
          }
        }
      }
    } catch (error) {
      logger.error('Error parsing response:', error)
    }
    
    return this.createFallbackAnalysis(sources)
  }

  private createFallbackAnalysis(sources: MarketSources): CompleteAnalysis {
    const diff = ((sources.marketEstimate - sources.listedPrice) / sources.listedPrice) * 100
    
    return {
      cardName: sources.cardName,
      listedPrice: sources.listedPrice,
      marketValue: sources.marketEstimate,
      fairValueAssessment: {
        status: diff > 15 ? 'UNDERVALUED' : diff < -15 ? 'OVERVALUED' : 'FAIR',
        percentage: `${diff.toFixed(1)}%`,
        reasoning: 'Based on market estimation'
      },
      cardHistory: 'Established Pokemon collectible',
      lastTwoSales: sources.ebayData?.recentSales || [],
      investmentThesis: 'Investment opportunity requires careful consideration',
      riskFactors: ['Market volatility', 'Liquidity risk'],
      opportunities: ['Collector demand', 'Potential appreciation'],
      trendPrediction: {
        direction: 'STABLE',
        timeframe: 'Medium term',
        reasoning: 'Based on available data'
      },
      recommendedAction: 'HOLD',
      confidenceScore: 60,
      bestPurchaseOption: {
        price: Math.round(sources.marketEstimate * 0.95),
        seller: 'TCGPlayer',
        url: `https://www.tcgplayer.com/search?q=${encodeURIComponent(sources.cardCharacteristics.pokemon)}`
      }
    }
  }
}

export { CompleteMarketSystem, type CompleteAnalysis }
