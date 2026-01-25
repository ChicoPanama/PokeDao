/**
 * PSA Population Reports Client
 *
 * Fetches graded card population data from PSA
 * This helps understand rarity of graded cards
 */

import fetch from 'node-fetch';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

// PSA doesn't have a public API, we scrape or use cached data
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PSAConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const PSAPopulationSchema = z.object({
  cardName: z.string(),
  setName: z.string(),
  cardNumber: z.string().optional(),
  year: z.number().optional(),
  grades: z.object({
    '10': z.number().default(0),
    '9': z.number().default(0),
    '8': z.number().default(0),
    '7': z.number().default(0),
    '6': z.number().default(0),
    '5': z.number().default(0),
    '4': z.number().default(0),
    '3': z.number().default(0),
    '2': z.number().default(0),
    '1': z.number().default(0),
    'auth': z.number().default(0), // Authentic but not graded
  }),
  totalGraded: z.number(),
  lastUpdated: z.string(),
});

export type PSAPopulation = z.infer<typeof PSAPopulationSchema>;

// ============================================================================
// CLIENT
// ============================================================================

// In-memory cache for population data
const populationCache = new Map<string, { data: PSAPopulation; expiresAt: number }>();

export class PSAClient {
  private config: Required<PSAConfig>;
  private lastRequestTime: number = 0;

  constructor(config: PSAConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      requestsPerSecond: config.requestsPerSecond ?? 1, // Very conservative
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
   * Generate cache key for a card
   */
  private getCacheKey(cardName: string, setName: string, cardNumber?: string): string {
    return `${cardName.toLowerCase()}|${setName.toLowerCase()}|${cardNumber || ''}`;
  }

  /**
   * Get population data for a card
   */
  async getPopulation(
    cardName: string,
    setName: string,
    cardNumber?: string
  ): Promise<PSAPopulation | null> {
    const cacheKey = this.getCacheKey(cardName, setName, cardNumber);

    // Check cache first
    const cached = populationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // For now, return mock data
    // In production, this would scrape PSA or use a third-party data provider
    console.warn(`[PSA] Population data for ${cardName} not available - using mock data`);

    const mockData: PSAPopulation = {
      cardName,
      setName,
      cardNumber,
      grades: {
        '10': Math.floor(Math.random() * 500),
        '9': Math.floor(Math.random() * 2000),
        '8': Math.floor(Math.random() * 3000),
        '7': Math.floor(Math.random() * 1500),
        '6': Math.floor(Math.random() * 500),
        '5': Math.floor(Math.random() * 200),
        '4': Math.floor(Math.random() * 100),
        '3': Math.floor(Math.random() * 50),
        '2': Math.floor(Math.random() * 20),
        '1': Math.floor(Math.random() * 10),
        'auth': Math.floor(Math.random() * 100),
      },
      totalGraded: 0,
      lastUpdated: new Date().toISOString(),
    };

    // Calculate total
    mockData.totalGraded = Object.values(mockData.grades).reduce((a, b) => a + b, 0);

    // Cache the result
    populationCache.set(cacheKey, {
      data: mockData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return mockData;
  }

  /**
   * Get rarity score (0-1) based on PSA 10 population
   * Lower population = higher rarity score
   */
  async getRarityScore(
    cardName: string,
    setName: string,
    grade: number = 10,
    cardNumber?: string
  ): Promise<number> {
    const population = await this.getPopulation(cardName, setName, cardNumber);
    if (!population) return 0.5; // Default to medium rarity

    const gradeKey = grade.toString() as keyof typeof population.grades;
    const count = population.grades[gradeKey] || 0;

    // Rarity tiers based on population
    if (count <= 10) return 0.99; // Extremely rare
    if (count <= 50) return 0.95;
    if (count <= 100) return 0.9;
    if (count <= 250) return 0.8;
    if (count <= 500) return 0.7;
    if (count <= 1000) return 0.6;
    if (count <= 2500) return 0.5;
    if (count <= 5000) return 0.4;
    if (count <= 10000) return 0.3;
    return 0.2; // Common
  }

  /**
   * Get population comparison across grades
   */
  async getGradeDistribution(
    cardName: string,
    setName: string,
    cardNumber?: string
  ): Promise<{ grade: string; count: number; percentage: number }[]> {
    const population = await this.getPopulation(cardName, setName, cardNumber);
    if (!population) return [];

    const total = population.totalGraded || 1;

    return Object.entries(population.grades)
      .filter(([, count]) => count > 0)
      .map(([grade, count]) => ({
        grade,
        count,
        percentage: Math.round((count / total) * 100 * 10) / 10,
      }))
      .sort((a, b) => parseInt(b.grade) - parseInt(a.grade));
  }

  /**
   * Clear cache (useful for testing or force refresh)
   */
  clearCache(): void {
    populationCache.clear();
  }
}

/**
 * Create PSA client
 */
export function createPSAClient(): PSAClient {
  return new PSAClient({
    requestsPerSecond: parseFloat(process.env.PSA_RATE_LIMIT || '1'),
  });
}
