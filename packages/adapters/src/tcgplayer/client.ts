/**
 * TCGPlayer API Client
 *
 * Official docs: https://docs.tcgplayer.com
 * Base URL: https://api.tcgplayer.com
 */

import fetch from 'node-fetch';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://api.tcgplayer.com';
const CATALOG_URL = `${BASE_URL}/catalog`;
const PRICING_URL = `${BASE_URL}/pricing`;

export interface TCGPlayerConfig {
  publicKey: string;
  privateKey: string;
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const TCGPlayerProductSchema = z.object({
  productId: z.number(),
  name: z.string(),
  cleanName: z.string().optional(),
  imageUrl: z.string().optional(),
  categoryId: z.number(),
  groupId: z.number(),
  url: z.string().optional(),
  modifiedOn: z.string().optional(),
  extendedData: z.array(z.object({
    name: z.string(),
    displayName: z.string(),
    value: z.string(),
  })).optional(),
});

const TCGPlayerPriceSchema = z.object({
  productId: z.number(),
  lowPrice: z.number().nullable(),
  midPrice: z.number().nullable(),
  highPrice: z.number().nullable(),
  marketPrice: z.number().nullable(),
  directLowPrice: z.number().nullable(),
  subTypeName: z.string().optional(),
});

const TCGPlayerGroupSchema = z.object({
  groupId: z.number(),
  name: z.string(),
  abbreviation: z.string().optional(),
  publishedOn: z.string().optional(),
  modifiedOn: z.string().optional(),
  categoryId: z.number(),
});

export type TCGPlayerProduct = z.infer<typeof TCGPlayerProductSchema>;
export type TCGPlayerPrice = z.infer<typeof TCGPlayerPriceSchema>;
export type TCGPlayerGroup = z.infer<typeof TCGPlayerGroupSchema>;

// ============================================================================
// CLIENT
// ============================================================================

export class TCGPlayerClient {
  private config: Required<TCGPlayerConfig>;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private lastRequestTime: number = 0;

  // Pokemon category ID on TCGPlayer
  private static readonly POKEMON_CATEGORY_ID = 3;

  constructor(config: TCGPlayerConfig) {
    if (!config.publicKey || !config.privateKey) {
      throw new Error('TCGPlayer API keys are required');
    }

    this.config = {
      publicKey: config.publicKey,
      privateKey: config.privateKey,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      requestsPerSecond: config.requestsPerSecond ?? 5,
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
   * Get or refresh access token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(`${BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.publicKey,
        client_secret: this.config.privateKey,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    this.accessToken = data.access_token;
    // Token expires in ~1 hour, refresh 5 minutes early
    this.tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;

    return this.accessToken!;
  }

  /**
   * Make authenticated API request with retries
   */
  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: any } = {}
  ): Promise<T> {
    await this.rateLimit();
    const token = await this.getAccessToken();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(`${endpoint}`, {
          method: options.method || 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            console.warn(`[TCGPlayer] Rate limited. Waiting ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          if (response.status === 401) {
            // Token expired, force refresh
            this.accessToken = null;
            this.tokenExpiry = 0;
            continue;
          }

          throw new Error(`TCGPlayer API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(`[TCGPlayer] Request failed, retrying in ${delay}ms...`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('TCGPlayer request failed after retries');
  }

  /**
   * Get all Pokemon sets (groups)
   */
  async getSets(): Promise<TCGPlayerGroup[]> {
    const response = await this.request<{ results: any[] }>(
      `${CATALOG_URL}/categories/${TCGPlayerClient.POKEMON_CATEGORY_ID}/groups?limit=100`
    );
    return response.results.map(g => TCGPlayerGroupSchema.parse(g));
  }

  /**
   * Get products (cards) from a set
   */
  async getProductsByGroup(groupId: number, limit: number = 100, offset: number = 0): Promise<TCGPlayerProduct[]> {
    const response = await this.request<{ results: any[] }>(
      `${CATALOG_URL}/products?groupId=${groupId}&limit=${limit}&offset=${offset}`
    );
    return response.results.map(p => TCGPlayerProductSchema.parse(p));
  }

  /**
   * Search products by name
   */
  async searchProducts(query: string, limit: number = 50): Promise<TCGPlayerProduct[]> {
    const response = await this.request<{ results: any[] }>(
      `${CATALOG_URL}/categories/${TCGPlayerClient.POKEMON_CATEGORY_ID}/search?productName=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.results.map(p => TCGPlayerProductSchema.parse(p));
  }

  /**
   * Get pricing for products (max 250 at a time)
   */
  async getPricing(productIds: number[]): Promise<TCGPlayerPrice[]> {
    if (productIds.length === 0) return [];
    if (productIds.length > 250) {
      throw new Error('TCGPlayer pricing API limited to 250 products per request');
    }

    const response = await this.request<{ results: any[] }>(
      `${PRICING_URL}/product/${productIds.join(',')}`
    );
    return response.results.map(p => TCGPlayerPriceSchema.parse(p));
  }

  /**
   * Get product details by ID
   */
  async getProduct(productId: number): Promise<TCGPlayerProduct> {
    const response = await this.request<{ results: any[] }>(
      `${CATALOG_URL}/products/${productId}`
    );
    return TCGPlayerProductSchema.parse(response.results[0]);
  }

  /**
   * Get market prices for a set
   */
  async getSetPricing(groupId: number): Promise<TCGPlayerPrice[]> {
    const response = await this.request<{ results: any[] }>(
      `${PRICING_URL}/group/${groupId}`
    );
    return response.results.map(p => TCGPlayerPriceSchema.parse(p));
  }
}

/**
 * Create TCGPlayer client from environment
 */
export function createTCGPlayerClient(): TCGPlayerClient {
  const publicKey = process.env.TCGPLAYER_PUBLIC_KEY;
  const privateKey = process.env.TCGPLAYER_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error('TCGPLAYER_PUBLIC_KEY and TCGPLAYER_PRIVATE_KEY environment variables are required');
  }

  return new TCGPlayerClient({
    publicKey,
    privateKey,
    requestsPerSecond: parseInt(process.env.TCGPLAYER_RATE_LIMIT || '5', 10),
  });
}
