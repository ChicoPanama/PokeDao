/**
 * DEFILLAMA API CLIENT
 *
 * Free, unauthenticated access to comprehensive protocol TVL data.
 * Used to prioritize high-value DeFi protocols for scanning.
 *
 * Features:
 * - Protocol discovery with TVL filtering
 * - Chain-specific TVL breakdowns
 * - In-memory caching (15 min TTL)
 * - Category filtering (DEX, Lending, Bridge, etc.)
 */

import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export const ProtocolSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  category: z.string().optional(),
  chains: z.array(z.string()),
  tvl: z.number().nullable().optional(),
  chainTvls: z.record(z.number()).optional(),
  url: z.string().optional(),
  logo: z.string().optional(),
  symbol: z.string().optional(),
});

export type Protocol = z.infer<typeof ProtocolSchema>;

export interface DefiLlamaClientConfig {
  cacheTtlMs?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ============================================================================
// CLIENT
// ============================================================================

export class DefiLlamaClient {
  private readonly baseUrl = 'https://api.llama.fi';
  private readonly cacheTtlMs: number;
  private cache = new Map<string, CacheEntry<any>>();

  constructor(config: DefiLlamaClientConfig = {}) {
    this.cacheTtlMs = config.cacheTtlMs ?? 15 * 60 * 1000; // 15 min
  }

  /**
   * Get all protocols sorted by TVL
   */
  async getProtocols(): Promise<Protocol[]> {
    return this.cachedFetch<Protocol[]>('protocols', '/protocols');
  }

  /**
   * Get protocols on a specific chain, filtered by minimum TVL
   */
  async getProtocolsByChain(chain: string, minTvlUsd = 10_000_000): Promise<Protocol[]> {
    const protocols = await this.getProtocols();
    return protocols
      .filter(p => {
        const chainTvl = p.chainTvls?.[chain] ?? 0;
        return p.chains.includes(chain) && chainTvl >= minTvlUsd;
      })
      .sort((a, b) => {
        const aTvl = a.chainTvls?.[chain] ?? 0;
        const bTvl = b.chainTvls?.[chain] ?? 0;
        return bTvl - aTvl;
      });
  }

  /**
   * Get protocols by category (DEX, Lending, Bridge, etc.)
   */
  async getProtocolsByCategory(category: string, minTvlUsd = 10_000_000): Promise<Protocol[]> {
    const protocols = await this.getProtocols();
    return protocols
      .filter(p => {
        const matchesCategory = p.category?.toLowerCase() === category.toLowerCase();
        const meetsTvl = (p.tvl ?? 0) >= minTvlUsd;
        return matchesCategory && meetsTvl;
      })
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
  }

  /**
   * Get top protocols across all chains by TVL
   */
  async getTopProtocols(limit = 50, minTvlUsd = 10_000_000): Promise<Protocol[]> {
    const protocols = await this.getProtocols();
    return protocols
      .filter(p => (p.tvl ?? 0) >= minTvlUsd)
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
      .slice(0, limit);
  }

  /**
   * Get protocol details by slug
   */
  async getProtocol(slug: string): Promise<any> {
    return this.cachedFetch(`protocol:${slug}`, `/protocol/${slug}`);
  }

  // ============================================================================
  // INTERNAL
  // ============================================================================

  private async cachedFetch<T>(cacheKey: string, path: string): Promise<T> {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PokeDao-Scanner/1.0' },
    });

    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as T;

    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    // Clean expired entries
    this.cleanCache();

    return data;
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}
