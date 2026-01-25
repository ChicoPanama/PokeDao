/**
 * Courtyard.io API Client
 *
 * Tokenized trading card marketplace on Solana
 * Docs: https://docs.courtyard.io
 */

import fetch from 'node-fetch';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://api.courtyard.io/v1';

export interface CourtyardConfig {
  apiKey?: string; // Some endpoints may require auth
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const CourtyardListingSchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  priceUsd: z.number(),
  priceSol: z.number().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  condition: z.string().optional(),
  gradeCompany: z.string().optional(),
  grade: z.number().optional(),
  seller: z.object({
    address: z.string(),
    username: z.string().optional(),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const CourtyardCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  category: z.string(),
  floorPriceUsd: z.number().optional(),
  totalListings: z.number(),
  volumeUsd: z.number().optional(),
});

export type CourtyardListing = z.infer<typeof CourtyardListingSchema>;
export type CourtyardCollection = z.infer<typeof CourtyardCollectionSchema>;

// ============================================================================
// CLIENT
// ============================================================================

export class CourtyardClient {
  private config: Required<CourtyardConfig>;
  private lastRequestTime: number = 0;

  constructor(config: CourtyardConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? '',
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      requestsPerSecond: config.requestsPerSecond ?? 3,
    };
  }

  /**
   * Rate limiting
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
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (this.config.apiKey) {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const response = await fetch(url.toString(), { headers });

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            console.warn(`[Courtyard] Rate limited. Waiting ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          throw new Error(`Courtyard API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(`[Courtyard] Request failed, retrying in ${delay}ms...`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Courtyard request failed after retries');
  }

  /**
   * Get Pokemon card listings
   */
  async getPokemonListings(options: {
    limit?: number;
    offset?: number;
    minPrice?: number;
    maxPrice?: number;
    gradeCompany?: string;
    minGrade?: number;
  } = {}): Promise<CourtyardListing[]> {
    const params: Record<string, string> = {
      category: 'pokemon',
      isActive: 'true',
    };

    if (options.limit) params.limit = options.limit.toString();
    if (options.offset) params.offset = options.offset.toString();
    if (options.minPrice) params.minPriceUsd = options.minPrice.toString();
    if (options.maxPrice) params.maxPriceUsd = options.maxPrice.toString();
    if (options.gradeCompany) params.gradeCompany = options.gradeCompany;
    if (options.minGrade) params.minGrade = options.minGrade.toString();

    const response = await this.request<{ data: any[] }>('/listings', params);
    return response.data.map(l => CourtyardListingSchema.parse(l));
  }

  /**
   * Get listing by ID
   */
  async getListing(listingId: string): Promise<CourtyardListing> {
    const response = await this.request<{ data: any }>(`/listings/${listingId}`);
    return CourtyardListingSchema.parse(response.data);
  }

  /**
   * Search listings
   */
  async searchListings(query: string, limit: number = 50): Promise<CourtyardListing[]> {
    const response = await this.request<{ data: any[] }>('/listings/search', {
      q: query,
      category: 'pokemon',
      limit: limit.toString(),
    });
    return response.data.map(l => CourtyardListingSchema.parse(l));
  }

  /**
   * Get Pokemon collections
   */
  async getCollections(): Promise<CourtyardCollection[]> {
    const response = await this.request<{ data: any[] }>('/collections', {
      category: 'pokemon',
    });
    return response.data.map(c => CourtyardCollectionSchema.parse(c));
  }

  /**
   * Get recent sales
   */
  async getRecentSales(options: {
    limit?: number;
    category?: string;
  } = {}): Promise<CourtyardListing[]> {
    const params: Record<string, string> = {
      category: options.category || 'pokemon',
    };
    if (options.limit) params.limit = options.limit.toString();

    const response = await this.request<{ data: any[] }>('/sales/recent', params);
    return response.data.map(l => CourtyardListingSchema.parse(l));
  }
}

/**
 * Create Courtyard client from environment
 */
export function createCourtyardClient(): CourtyardClient {
  return new CourtyardClient({
    apiKey: process.env.COURTYARD_API_KEY,
    requestsPerSecond: parseInt(process.env.COURTYARD_RATE_LIMIT || '3', 10),
  });
}
