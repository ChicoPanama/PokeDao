/**
 * JustTCG API Client
 *
 * Official docs: https://justtcg.com/docs
 * Base URL: https://api.justtcg.com/v1
 */

import fetch from 'node-fetch';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://api.justtcg.com/v1';

export interface JustTCGConfig {
  apiKey: string;
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number; // Rate limiting
}

// ============================================================================
// SCHEMAS
// ============================================================================

const JustTCGVariantSchema = z.object({
  id: z.string(),
  condition: z.string(),
  printing: z.string().optional(),
  language: z.string(),
  price: z.number().nullable(),
  priceHistory: z.array(z.object({
    date: z.string(),
    price: z.number(),
  })).optional(),
  change: z.object({
    day: z.number().optional(),
    week: z.number().optional(),
    month: z.number().optional(),
  }).optional(),
});

const JustTCGCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  game: z.string(),
  set: z.string(),
  setName: z.string().optional(),
  tcgplayerId: z.string().optional(),
  rarity: z.string().optional(),
  number: z.string().optional(),
  variants: z.array(JustTCGVariantSchema),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
});

const JustTCGSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  game: z.string(),
  releaseDate: z.string().optional(),
  cardCount: z.number().optional(),
});

export type JustTCGCard = z.infer<typeof JustTCGCardSchema>;
export type JustTCGVariant = z.infer<typeof JustTCGVariantSchema>;
export type JustTCGSet = z.infer<typeof JustTCGSetSchema>;

// ============================================================================
// CLIENT
// ============================================================================

export class JustTCGClient {
  private config: Required<JustTCGConfig>;
  private lastRequestTime: number = 0;

  constructor(config: JustTCGConfig) {
    if (!config.apiKey) {
      throw new Error('JustTCG API key is required');
    }

    this.config = {
      apiKey: config.apiKey,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      requestsPerSecond: config.requestsPerSecond ?? 2, // Conservative default
    };
  }

  /**
   * Rate limiting: Wait between requests
   */
  private async rateLimit(): Promise<void> {
    const minDelay = 1000 / this.config.requestsPerSecond;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make API request with retries
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    await this.rateLimit();

    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value);
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            'x-api-key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - wait longer
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            console.warn(`[JustTCG] Rate limited. Waiting ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          throw new Error(`JustTCG API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(`[JustTCG] Request failed, retrying in ${delay}ms...`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('JustTCG request failed after retries');
  }

  /**
   * Get all Pokemon sets
   */
  async getSets(): Promise<JustTCGSet[]> {
    const response = await this.request<{ data: any[] }>('/sets', { game: 'pokemon' });
    return response.data.map(set => JustTCGSetSchema.parse(set));
  }

  /**
   * Get cards from a specific set
   */
  async getCardsBySet(setId: string): Promise<JustTCGCard[]> {
    const response = await this.request<{ data: any[] }>('/cards', {
      game: 'pokemon',
      set: setId,
    });

    return response.data.map(card => JustTCGCardSchema.parse(card));
  }

  /**
   * Search cards by name
   */
  async searchCards(query: string, limit: number = 100): Promise<JustTCGCard[]> {
    const response = await this.request<{ data: any[] }>('/cards', {
      game: 'pokemon',
      name: query,
      limit: limit.toString(),
    });

    return response.data.map(card => JustTCGCardSchema.parse(card));
  }

  /**
   * Get card by ID
   */
  async getCardById(cardId: string): Promise<JustTCGCard> {
    const response = await this.request<{ data: any }>(`/cards/${cardId}`);
    return JustTCGCardSchema.parse(response.data);
  }

  /**
   * Get all Pokemon cards (paginated)
   * WARNING: This can be expensive on your API quota
   */
  async getAllCards(options: {
    limit?: number;
    offset?: number;
    onProgress?: (current: number, total: number) => void;
  } = {}): Promise<JustTCGCard[]> {
    const limit = options.limit || 1000;
    const offset = options.offset || 0;

    const response = await this.request<{ data: any[]; meta?: { total: number } }>('/cards', {
      game: 'pokemon',
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const cards = response.data.map(card => JustTCGCardSchema.parse(card));

    if (options.onProgress && response.meta?.total) {
      options.onProgress(offset + cards.length, response.meta.total);
    }

    return cards;
  }

  /**
   * Get current pricing for a card
   */
  async getCardPricing(cardId: string): Promise<JustTCGVariant[]> {
    const card = await this.getCardById(cardId);
    return card.variants;
  }
}

/**
 * Create JustTCG client from environment
 */
export function createJustTCGClient(): JustTCGClient {
  const apiKey = process.env.JUSTTCG_API_KEY;

  if (!apiKey) {
    throw new Error('JUSTTCG_API_KEY environment variable is required');
  }

  return new JustTCGClient({
    apiKey,
    requestsPerSecond: parseInt(process.env.JUSTTCG_RATE_LIMIT || '2', 10),
  });
}
