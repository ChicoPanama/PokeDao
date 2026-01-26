/**
 * TCGdex API Client
 *
 * Wraps the @tcgdex/sdk with rate limiting, retry logic, and Zod validation.
 * TCGdex is a free, keyless API providing Pokemon TCG card metadata.
 *
 * No pricing data — metadata only (rarity, illustrator, types, images).
 */

import TCGdex, { type SupportedLanguages, Query } from '@tcgdex/sdk';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TCGdexConfig {
  language?: SupportedLanguages;
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const TCGdexCardSchema = z.object({
  id: z.string(),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  illustrator: z.string().optional().nullable(),
  rarity: z.string().optional().nullable(),
  hp: z.number().optional().nullable(),
  types: z.array(z.string()).optional().nullable(),
  stage: z.string().optional().nullable(),
  variants: z.object({
    firstEdition: z.boolean().optional(),
    holo: z.boolean().optional(),
    normal: z.boolean().optional(),
    reverse: z.boolean().optional(),
  }).optional().nullable(),
  set: z.object({
    id: z.string(),
    name: z.string(),
  }).optional().nullable(),
});

const TCGdexSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().optional().nullable(),
  releaseDate: z.string().optional().nullable(),
  cardCount: z.object({
    total: z.number(),
    official: z.number().optional(),
  }).optional().nullable(),
});

const TCGdexSetFullSchema = TCGdexSetSchema.extend({
  cards: z.array(z.object({
    id: z.string(),
    localId: z.string(),
    name: z.string(),
    image: z.string().optional().nullable(),
  })).optional().nullable(),
});

export type TCGdexCardResponse = z.infer<typeof TCGdexCardSchema>;
export type TCGdexSetResponse = z.infer<typeof TCGdexSetSchema>;
export type TCGdexSetFullResponse = z.infer<typeof TCGdexSetFullSchema>;

// ============================================================================
// CLIENT
// ============================================================================

export class TCGdexClient {
  private sdk: TCGdex;
  private config: Required<TCGdexConfig>;
  private lastRequestTime: number = 0;

  constructor(config: TCGdexConfig = {}) {
    this.config = {
      language: config.language ?? (process.env.TCGDEX_LANGUAGE as SupportedLanguages) ?? 'en',
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      requestsPerSecond: config.requestsPerSecond ?? 5,
    };

    this.sdk = new TCGdex(this.config.language);
  }

  // ========================================================================
  // RATE LIMITING
  // ========================================================================

  private async rateLimit(): Promise<void> {
    const minDelay = 1000 / this.config.requestsPerSecond;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
  }

  // ========================================================================
  // RETRY LOGIC
  // ========================================================================

  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.rateLimit();
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const msg = (error as Error).message;

        // Non-retryable errors
        if (msg.includes('404') || msg.includes('validation')) {
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          console.warn(
            `[tcgdex] Retry ${attempt}/${this.config.maxRetries} for ${context}: ${msg} (waiting ${delay}ms)`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Get all sets (summary list).
   */
  async getAllSets(): Promise<TCGdexSetResponse[]> {
    return this.withRetry(async () => {
      const result = await this.sdk.fetch('sets');
      if (!result || !Array.isArray(result)) return [];
      return result.map((s: unknown) => TCGdexSetSchema.parse(s));
    }, 'getAllSets');
  }

  /**
   * Get a single set with its card list.
   */
  async getSet(setId: string): Promise<TCGdexSetFullResponse | null> {
    return this.withRetry(async () => {
      const result = await this.sdk.fetch('sets', setId);
      if (!result) return null;
      return TCGdexSetFullSchema.parse(result);
    }, `getSet(${setId})`);
  }

  /**
   * Get a single card by its global ID (e.g., "base1-4").
   */
  async getCard(globalId: string): Promise<TCGdexCardResponse | null> {
    return this.withRetry(async () => {
      const result = await this.sdk.fetch('cards', globalId);
      if (!result) return null;
      return TCGdexCardSchema.parse(result);
    }, `getCard(${globalId})`);
  }

  /**
   * Search cards by name using the SDK's Query API.
   */
  async searchCards(query: string): Promise<TCGdexCardResponse[]> {
    return this.withRetry(async () => {
      const q = Query.create().contains('name', query);
      const result = await this.sdk.card.list(q);
      if (!result || !Array.isArray(result)) return [];
      return result.map((c: unknown) => TCGdexCardSchema.parse(c));
    }, `searchCards(${query})`);
  }
}

/**
 * Create a TCGdex client with default configuration.
 */
export function createTCGdexClient(config?: TCGdexConfig): TCGdexClient {
  return new TCGdexClient(config);
}
