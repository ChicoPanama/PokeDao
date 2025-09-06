import axios from 'axios';
import { PriceSource, CardData } from '../types/interfaces.js';

export class PokemonTCGAPI {
  private baseURL = 'https://api.pokemontcg.io/v2';
  private apiKey?: string;
  private cache = new Map<string, PriceSource[]>();

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async searchPrices(cardData: CardData): Promise<PriceSource[]> {
    const cacheKey = `${cardData.name}-${cardData.set}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const searchTerms = this.generateSearchTerms(cardData);

    for (const term of searchTerms) {
      try {
        console.log(`  Pokemon TCG API: Searching "${term}"`);

        const response = await axios.get(`${this.baseURL}/cards`, {
          params: {
            q: `name:"${term}"`,
            pageSize: 5
          },
          headers: {
            ...(this.apiKey && { 'X-Api-Key': this.apiKey })
          },
          timeout: 8000
        });

        const cards = response.data?.data || [];

        for (const card of cards) {
          if (card.tcgplayer?.prices) {
            const priceSource = this.extractPrice(card, cardData);
            if (priceSource) {
              console.log(`  Pokemon TCG API: Found ${card.name} - $${priceSource.price}`);
              const result = [priceSource];
              this.cache.set(cacheKey, result);
              return result;
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`  Pokemon TCG API: Failed for "${term}"`);
        continue;
      }
    }

    console.log(`  Pokemon TCG API: No results found`);
    return [];
  }

  private generateSearchTerms(cardData: CardData): string[] {
    const terms = [cardData.name];

    if (cardData.set !== 'Unknown') {
      terms.push(`${cardData.name} ${cardData.set}`);
    }

    return terms;
  }

  private extractPrice(card: any, cardData: CardData): PriceSource | null {
    const prices = card.tcgplayer.prices;
    let price = 0;

    if (cardData.isHolo && prices.holofoil?.market) {
      price = prices.holofoil.market;
    } else if (prices.normal?.market) {
      price = prices.normal.market;
    } else if (prices.reverseHolofoil?.market) {
      price = prices.reverseHolofoil.market;
    }

    if (price <= 0) return null;

    if (cardData.grade) {
      const gradeNum = parseFloat(cardData.grade.split(' ')[1] || '0');
      if (gradeNum >= 9) price *= 3;
      else if (gradeNum >= 8) price *= 2;
    }

    return {
      source: 'Pokemon TCG API',
      price: Math.round(price),
      confidence: 0.8,
      timestamp: new Date(),
      grade: cardData.grade
    };
  }
}
