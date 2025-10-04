/**
 * Phygitals.com API Client
 *
 * Phygitals is a Solana-based NFT marketplace for physical collectibles (Pokemon cards, etc.)
 * Platform: https://www.phygitals.com
 * API Base: https://api.phygitals.com/api
 */

import fetch from 'node-fetch';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://api.phygitals.com/api';
const NEXTDATA_BASE_URL = 'https://www.phygitals.com/_next/data/Orw32MMnmZuQaMUzy29Nh';

export interface PhygitalsConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number; // Rate limiting
}

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Phygitals Marketplace Listing
 */
export const PhygitalsListingSchema = z.object({
  id: z.string(),
  nftAddress: z.string().optional(),
  name: z.string(),
  price: z.number().nullable(), // USD price
  fmv: z.number().nullable(), // Fair Market Value
  priceInLamports: z.number().optional(), // Solana lamports
  imageUrl: z.string().optional(),
  set: z.string().optional(),
  grader: z.string().optional(), // PSA, BGS, CGC, etc.
  grade: z.union([z.string(), z.number()]).optional(),
  gradeType: z.string().optional(),
  rarity: z.string().optional(),
  language: z.string().optional(),
  category: z.string().optional(),
  listedStatus: z.string().optional(), // "listed", "sold", etc.
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  seller: z.object({
    id: z.string().optional(),
    username: z.string().optional(),
    wallet: z.string().optional(),
  }).optional(),
});

/**
 * Phygitals Sales Data
 */
export const PhygitalsSaleSchema = z.object({
  id: z.string(),
  nftAddress: z.string().optional(),
  cardName: z.string().optional(),
  price: z.number(), // USD
  soldAt: z.string(), // ISO timestamp
  buyer: z.object({
    username: z.string().optional(),
    wallet: z.string().optional(),
  }).optional(),
  seller: z.object({
    username: z.string().optional(),
    wallet: z.string().optional(),
  }).optional(),
});

/**
 * Phygitals Marketplace Filters
 */
export const PhygitalsFiltersSchema = z.object({
  sets: z.array(z.string()).optional(),
  graders: z.array(z.string()).optional(),
  grades: z.array(z.string()).optional(),
  rarities: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

export type PhygitalsListing = z.infer<typeof PhygitalsListingSchema>;
export type PhygitalsSale = z.infer<typeof PhygitalsSaleSchema>;
export type PhygitalsFilters = z.infer<typeof PhygitalsFiltersSchema>;

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface MarketplaceListingsRequest {
  searchTerm?: string;
  sortBy?: 'price-low-high' | 'price-high-low' | 'date-newest' | 'date-oldest';
  itemsPerPage?: number;
  page?: number;
  metadataConditions?: {
    set?: string[];
    grader?: string[];
    grade?: string[];
    rarity?: string[];
    type?: string[];
    'set release date'?: string[];
    'grade type'?: string[];
    language?: string[];
    category?: string[];
  };
  priceRange?: [number | null, number | null];
  fmvRange?: [number | null, number | null];
  listedStatus?: 'listed' | 'sold' | 'any';
}

export interface MarketplaceListingsResponse {
  listings: PhygitalsListing[];
  total: number;
  page: number;
  itemsPerPage: number;
}

export interface SalesDataResponse {
  sales: PhygitalsSale[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// CLIENT
// ============================================================================

export class PhygitalsClient {
  private config: Required<PhygitalsConfig>;
  private lastRequestTime: number = 0;

  constructor(config: PhygitalsConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      requestsPerSecond: config.requestsPerSecond ?? 2, // Conservative rate limit
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
    url: string,
    options: Record<string, any> = {}
  ): Promise<T> {
    await this.rateLimit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'PokeDAO/1.0 (Market Intelligence Platform)',
          'Accept': 'application/json',
          'Referer': 'https://www.phygitals.com/',
        };

        // Merge custom headers
        if (options.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
              headers[key] = value;
            }
          });
        }

        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - wait longer
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            console.warn(`[Phygitals] Rate limited. Waiting ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          throw new Error(`Phygitals API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(`[Phygitals] Request failed, retrying in ${delay}ms...`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Phygitals request failed after retries');
  }

  /**
   * Get marketplace listings with filters
   */
  async getMarketplaceListings(
    options: MarketplaceListingsRequest = {}
  ): Promise<MarketplaceListingsResponse> {
    const params = new URLSearchParams({
      searchTerm: options.searchTerm || '',
      sortBy: options.sortBy || 'price-low-high',
      itemsPerPage: (options.itemsPerPage || 24).toString(),
      page: (options.page || 0).toString(),
      metadataConditions: JSON.stringify(options.metadataConditions || {}),
      priceRange: JSON.stringify(options.priceRange || [null, null]),
      fmvRange: JSON.stringify(options.fmvRange || [null, null]),
      listedStatus: options.listedStatus || 'any',
    });

    const response = await this.request<{ data: any[]; total: number }>(
      `${API_BASE_URL}/marketplace/marketplace-listings?${params}`
    );

    return {
      listings: response.data.map(item => PhygitalsListingSchema.parse(item)),
      total: response.total,
      page: options.page || 0,
      itemsPerPage: options.itemsPerPage || 24,
    };
  }

  /**
   * Get recent sales data
   */
  async getSalesData(
    limit: number = 100,
    page: number = 0
  ): Promise<SalesDataResponse> {
    const response = await this.request<{ data: any[]; total: number }>(
      `${API_BASE_URL}/marketplace/sales?limit=${limit}&page=${page}`
    );

    return {
      sales: response.data.map(item => PhygitalsSaleSchema.parse(item)),
      total: response.total,
      page,
      limit,
    };
  }

  /**
   * Get marketplace filters (available sets, graders, etc.)
   */
  async getMarketplaceFilters(): Promise<PhygitalsFilters> {
    const response = await this.request<any>(
      `${API_BASE_URL}/marketplace/filters`
    );

    return PhygitalsFiltersSchema.parse(response);
  }

  /**
   * Search for Pokemon cards
   */
  async searchPokemon(
    query: string = 'pokemon',
    options: Partial<MarketplaceListingsRequest> = {}
  ): Promise<MarketplaceListingsResponse> {
    return this.getMarketplaceListings({
      searchTerm: query,
      ...options,
    });
  }

  /**
   * Get graded Pokemon cards
   */
  async getGradedCards(
    grader?: string,
    grade?: string,
    options: Partial<MarketplaceListingsRequest> = {}
  ): Promise<MarketplaceListingsResponse> {
    const metadataConditions: any = {};

    if (grader) metadataConditions.grader = [grader];
    if (grade) metadataConditions.grade = [grade];

    return this.getMarketplaceListings({
      ...options,
      metadataConditions,
    });
  }

  /**
   * Get all Pokemon cards (paginated)
   * WARNING: This can take a while depending on inventory size
   */
  async getAllPokemonCards(options: {
    maxPages?: number;
    itemsPerPage?: number;
    onProgress?: (current: number, total: number) => void;
  } = {}): Promise<PhygitalsListing[]> {
    const itemsPerPage = options.itemsPerPage || 100;
    const maxPages = options.maxPages || Infinity;

    const allListings: PhygitalsListing[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore && page < maxPages) {
      const response = await this.getMarketplaceListings({
        searchTerm: 'pokemon',
        itemsPerPage,
        page,
      });

      allListings.push(...response.listings);

      if (options.onProgress) {
        options.onProgress(allListings.length, response.total);
      }

      hasMore = allListings.length < response.total;
      page++;

      // Safety check
      if (response.listings.length === 0) {
        break;
      }
    }

    return allListings;
  }
}

/**
 * Create Phygitals client
 */
export function createPhygitalsClient(config: PhygitalsConfig = {}): PhygitalsClient {
  return new PhygitalsClient(config);
}
