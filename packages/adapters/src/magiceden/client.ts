/**
 * Magic Eden API Client
 *
 * Solana NFT marketplace for tokenized Pokemon cards
 * Docs: https://api.magiceden.io
 */

import fetch from 'node-fetch';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://api-mainnet.magiceden.dev/v2';

export interface MagicEdenConfig {
  apiKey?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const MagicEdenListingSchema = z.object({
  pdaAddress: z.string(),
  auctionHouse: z.string(),
  tokenAddress: z.string(),
  tokenMint: z.string(),
  seller: z.string(),
  tokenSize: z.number(),
  price: z.number(), // Price in SOL
  priceInfo: z.object({
    solPrice: z.object({
      rawAmount: z.string(),
      address: z.string(),
      decimals: z.number(),
    }).optional(),
  }).optional(),
  expiry: z.number().optional(),
});

const MagicEdenNFTSchema = z.object({
  mintAddress: z.string(),
  owner: z.string().optional(),
  name: z.string(),
  symbol: z.string().optional(),
  image: z.string().optional(),
  animationUrl: z.string().optional(),
  collection: z.string().optional(),
  collectionName: z.string().optional(),
  attributes: z.array(z.object({
    trait_type: z.string(),
    value: z.union([z.string(), z.number()]),
  })).optional(),
  listings: z.array(MagicEdenListingSchema).optional(),
  listPrice: z.number().optional(), // Lowest price in SOL
});

const MagicEdenCollectionSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  description: z.string().optional(),
  image: z.string().optional(),
  twitter: z.string().optional(),
  discord: z.string().optional(),
  website: z.string().optional(),
  floorPrice: z.number().optional(), // Floor price in lamports
  listedCount: z.number().optional(),
  volumeAll: z.number().optional(), // Total volume in lamports
});

export type MagicEdenListing = z.infer<typeof MagicEdenListingSchema>;
export type MagicEdenNFT = z.infer<typeof MagicEdenNFTSchema>;
export type MagicEdenCollection = z.infer<typeof MagicEdenCollectionSchema>;

// ============================================================================
// CLIENT
// ============================================================================

export class MagicEdenClient {
  private config: Required<MagicEdenConfig>;
  private lastRequestTime: number = 0;

  // SOL to USD conversion (update periodically)
  private solPrice: number = 150; // Default, should be fetched

  constructor(config: MagicEdenConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? '',
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      requestsPerSecond: config.requestsPerSecond ?? 2,
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
            console.warn(`[MagicEden] Rate limited. Waiting ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          throw new Error(`Magic Eden API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(`[MagicEden] Request failed, retrying in ${delay}ms...`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Magic Eden request failed after retries');
  }

  /**
   * Update SOL price
   */
  async updateSolPrice(): Promise<void> {
    try {
      // Use CoinGecko or similar to get current SOL price
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const data = await response.json() as any;
      this.solPrice = data.solana?.usd || 150;
    } catch (error) {
      console.warn('[MagicEden] Failed to update SOL price:', error);
    }
  }

  /**
   * Convert SOL to USD
   */
  solToUsd(sol: number): number {
    return sol * this.solPrice;
  }

  /**
   * Get Pokemon-related collections
   */
  async getPokemonCollections(): Promise<MagicEdenCollection[]> {
    // Search for Pokemon-related collections
    const collections: MagicEdenCollection[] = [];

    const knownCollections = [
      'pokemon_graded_cards',
      'courtyard_pokemon',
      'phygitals_pokemon',
    ];

    for (const symbol of knownCollections) {
      try {
        const data = await this.request<any>(`/collections/${symbol}`);
        collections.push(MagicEdenCollectionSchema.parse(data));
      } catch (e) {
        // Collection might not exist
      }
    }

    return collections;
  }

  /**
   * Get listings for a collection
   */
  async getCollectionListings(
    collectionSymbol: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<MagicEdenNFT[]> {
    const params: Record<string, string> = {};
    if (options.limit) params.limit = options.limit.toString();
    if (options.offset) params.offset = options.offset.toString();

    const data = await this.request<any[]>(`/collections/${collectionSymbol}/listings`, params);
    return data.map(nft => MagicEdenNFTSchema.parse(nft));
  }

  /**
   * Get NFT details by mint address
   */
  async getNFT(mintAddress: string): Promise<MagicEdenNFT> {
    const data = await this.request<any>(`/tokens/${mintAddress}`);
    return MagicEdenNFTSchema.parse(data);
  }

  /**
   * Get activities (sales) for a collection
   */
  async getCollectionActivities(
    collectionSymbol: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<any[]> {
    const params: Record<string, string> = {};
    if (options.limit) params.limit = options.limit.toString();
    if (options.offset) params.offset = options.offset.toString();

    return this.request<any[]>(`/collections/${collectionSymbol}/activities`, params);
  }

  /**
   * Search for NFTs
   */
  async searchNFTs(query: string, limit: number = 20): Promise<MagicEdenNFT[]> {
    const data = await this.request<any[]>('/marketplace/search', {
      q: query,
      limit: limit.toString(),
    });
    return data.map(nft => MagicEdenNFTSchema.parse(nft));
  }

  /**
   * Get floor price for collection in USD
   */
  async getFloorPriceUsd(collectionSymbol: string): Promise<number | null> {
    try {
      const collection = await this.request<any>(`/collections/${collectionSymbol}/stats`);
      if (collection.floorPrice) {
        // Floor price is in lamports, convert to SOL then USD
        const solAmount = collection.floorPrice / 1e9;
        return this.solToUsd(solAmount);
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Create Magic Eden client from environment
 */
export function createMagicEdenClient(): MagicEdenClient {
  return new MagicEdenClient({
    apiKey: process.env.MAGICEDEN_API_KEY,
    requestsPerSecond: parseInt(process.env.MAGICEDEN_RATE_LIMIT || '2', 10),
  });
}
