/**
 * PokemonPriceTracker API Client
 *
 * Fetches Pokemon card prices from PokemonPriceTracker.com
 * Aggregates data from TCGPlayer, eBay, and CardMarket.
 *
 * API Docs: https://www.pokemonpricetracker.com/docs
 *
 * Features:
 * - Multi-source pricing (TCGPlayer, eBay, CardMarket)
 * - PSA graded card prices (7, 8, 9, 10)
 * - Historical price data
 * - Card search and filtering
 *
 * Rate Limits:
 * - Free: 100 calls/day
 * - Standard: 20,000 calls/day ($9.99/mo)
 * - Business: 200,000 calls/day
 */

import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'pokemon-price-tracker-client' });

// API Response Schemas
const PriceSourceSchema = z.object({
  market: z.number().optional(),
  low: z.number().optional(),
  mid: z.number().optional(),
  high: z.number().optional(),
  average: z.number().optional(),
  trend: z.number().optional(),
  lastUpdated: z.string().optional(),
});

const GradedPricesSchema = z.object({
  psa10: z.number().optional(),
  psa9: z.number().optional(),
  psa8: z.number().optional(),
  psa7: z.number().optional(),
});

const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.string().optional(),
  rarity: z.string().optional(),
  setId: z.string().optional(),
  imageUrl: z.string().optional(),
});

const PriceResponseSchema = z.object({
  card: CardSchema,
  prices: z.object({
    tcgplayer: PriceSourceSchema.optional(),
    ebay: PriceSourceSchema.optional(),
    cardmarket: PriceSourceSchema.optional(),
  }),
  gradedPrices: GradedPricesSchema.optional(),
});

const SetSchema = z.object({
  id: z.string(),
  name: z.string(),
  series: z.string().optional(),
  releaseDate: z.string().optional(),
  totalCards: z.number().optional(),
});

const SetsResponseSchema = z.object({
  sets: z.array(SetSchema),
});

const CardsSearchResponseSchema = z.object({
  cards: z.array(CardSchema),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export type PriceResponse = z.infer<typeof PriceResponseSchema>;
export type CardData = z.infer<typeof CardSchema>;
export type SetData = z.infer<typeof SetSchema>;

export interface ParseTitleMatch {
  tcgPlayerId: string;
  name: string;
  setName: string;
  setId: number;
  cardNumber: string;
  rarity: string | null;
  language: string;
  matchScore: number;
  matchReasons: string[];
  prices: {
    market: number | null;
    low: number | null;
    mid: number | null;
    high: number | null;
  };
}

export interface ParseTitleResponse {
  originalTitle: string;
  sanitizedTitle: string;
  parsed: {
    confidence: number;
    psaGrade?: number;
    setName?: string;
    cardName?: string;
    fieldConfidence: {
      grade?: number;
      setName?: number;
      cardName?: number;
    };
  };
  matches: ParseTitleMatch[];
  metadata: {
    parseTime: string;
    processingTimeMs: number;
    confidence: number;
    apiCallsConsumed: number;
  };
}

export interface NormalizedPrice {
  cardId: string;
  cardName: string;
  setId: string | null;
  prices: {
    source: 'tcgplayer' | 'ebay' | 'cardmarket';
    market: number | null;
    low: number | null;
    high: number | null;
  }[];
  gradedPrices: {
    grade: string;
    grader: string;
    priceCents: number;
  }[];
  fetchedAt: Date;
}

export class PokemonPriceTrackerClient {
  private baseUrl = 'https://www.pokemonpricetracker.com/api';
  private apiKey: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private minRequestInterval = 100; // ms between requests (allow faster since they advertise <50ms response)
  private dailyRequestCount = 0;
  private dailyLimitResetTime = 0;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('PokemonPriceTracker API key is required');
    }
    this.apiKey = apiKey;
    this.dailyLimitResetTime = this.getNextMidnightUTC();
  }

  private getNextMidnightUTC(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    return tomorrow.getTime();
  }

  private async throttle(): Promise<void> {
    // Check daily limit reset
    if (Date.now() > this.dailyLimitResetTime) {
      this.dailyRequestCount = 0;
      this.dailyLimitResetTime = this.getNextMidnightUTC();
    }

    // Check rate limit
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
    this.requestCount++;
    this.dailyRequestCount++;
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T | null> {
    await this.throttle();

    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('Rate limit exceeded');
          return null;
        }
        if (response.status === 404) {
          return null;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.error({ endpoint, error }, 'API request failed');
      throw error;
    }
  }

  /**
   * Get pricing for a specific card
   */
  async getCardPrices(cardId: string): Promise<PriceResponse | null> {
    const data = await this.fetch<unknown>(`/cards/${cardId}`);
    if (!data) return null;

    try {
      return PriceResponseSchema.parse(data);
    } catch (error) {
      logger.warn({ cardId, error }, 'Failed to parse price response');
      return null;
    }
  }

  /**
   * Search cards by name
   */
  async searchCards(name: string, limit = 50): Promise<CardData[]> {
    const data = await this.fetch<unknown>('/prices', {
      name,
      limit: limit.toString(),
    });

    if (!data) return [];

    try {
      // API may return different formats
      if (Array.isArray(data)) {
        return data.map((card) => CardSchema.parse(card));
      }
      const parsed = CardsSearchResponseSchema.safeParse(data);
      if (parsed.success) {
        return parsed.data.cards;
      }
      return [];
    } catch (error) {
      logger.warn({ name, error }, 'Failed to parse search response');
      return [];
    }
  }

  /**
   * Get all sets
   */
  async getSets(): Promise<SetData[]> {
    const data = await this.fetch<unknown>('/sets', {
      sortBy: 'releaseDate',
      sortOrder: 'desc',
    });

    if (!data) return [];

    try {
      const parsed = SetsResponseSchema.safeParse(data);
      if (parsed.success) {
        return parsed.data.sets;
      }
      // May be array directly
      if (Array.isArray(data)) {
        return data.map((set) => SetSchema.parse(set));
      }
      return [];
    } catch (error) {
      logger.warn({ error }, 'Failed to parse sets response');
      return [];
    }
  }

  /**
   * Get price by set and number
   */
  async getPriceBySetNumber(
    setId: string,
    number: string
  ): Promise<PriceResponse | null> {
    const data = await this.fetch<unknown>('/prices', {
      setId,
      number,
    });

    if (!data) return null;

    try {
      return PriceResponseSchema.parse(data);
    } catch (error) {
      logger.warn({ setId, number, error }, 'Failed to parse price response');
      return null;
    }
  }

  /**
   * Parse a card title (e.g., eBay listing title) and get pricing
   * This is the primary working endpoint for the API
   */
  async parseTitle(title: string): Promise<ParseTitleResponse | null> {
    await this.throttle();

    try {
      const response = await fetch(`${this.baseUrl}/v2/parse-title`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          logger.error('API key unauthorized');
          return null;
        }
        if (response.status === 429) {
          logger.warn('Rate limit exceeded');
          return null;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as { data: ParseTitleResponse };
      return data.data;
    } catch (error) {
      logger.error({ title, error }, 'Failed to parse title');
      return null;
    }
  }

  /**
   * Normalize price response to standard format
   */
  normalizePrice(response: PriceResponse): NormalizedPrice {
    const prices: NormalizedPrice['prices'] = [];
    const gradedPrices: NormalizedPrice['gradedPrices'] = [];

    // TCGPlayer prices
    if (response.prices.tcgplayer) {
      const tcp = response.prices.tcgplayer;
      prices.push({
        source: 'tcgplayer',
        market: tcp.market ?? tcp.mid ?? null,
        low: tcp.low ?? null,
        high: tcp.high ?? null,
      });
    }

    // eBay prices
    if (response.prices.ebay) {
      const ebay = response.prices.ebay;
      prices.push({
        source: 'ebay',
        market: ebay.average ?? ebay.market ?? null,
        low: ebay.low ?? null,
        high: ebay.high ?? null,
      });
    }

    // CardMarket prices
    if (response.prices.cardmarket) {
      const cm = response.prices.cardmarket;
      prices.push({
        source: 'cardmarket',
        market: cm.average ?? cm.trend ?? null,
        low: cm.low ?? null,
        high: cm.high ?? null,
      });
    }

    // PSA graded prices (convert to cents)
    if (response.gradedPrices) {
      const gp = response.gradedPrices;
      if (gp.psa10) {
        gradedPrices.push({
          grade: '10',
          grader: 'PSA',
          priceCents: Math.round(gp.psa10 * 100),
        });
      }
      if (gp.psa9) {
        gradedPrices.push({
          grade: '9',
          grader: 'PSA',
          priceCents: Math.round(gp.psa9 * 100),
        });
      }
      if (gp.psa8) {
        gradedPrices.push({
          grade: '8',
          grader: 'PSA',
          priceCents: Math.round(gp.psa8 * 100),
        });
      }
      if (gp.psa7) {
        gradedPrices.push({
          grade: '7',
          grader: 'PSA',
          priceCents: Math.round(gp.psa7 * 100),
        });
      }
    }

    return {
      cardId: response.card.id,
      cardName: response.card.name,
      setId: response.card.setId ?? null,
      prices,
      gradedPrices,
      fetchedAt: new Date(),
    };
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  getDailyRequestCount(): number {
    return this.dailyRequestCount;
  }
}
