/**
 * Card Matcher Service
 *
 * Centralized card identification with cascading match strategies:
 * 1. Direct tcgdexId lookup
 * 2. Exact searchName + searchSet + number
 * 3. Normalized name + set
 * 4. Fuzzy match via Jaro-Winkler
 *
 * Results are cached in Redis (1-hour TTL) for hot-path performance.
 */

import { FuzzyMatcher, jaroWinklerSimilarity } from './fuzzy-matcher.js';

// Redis client interface (compatible with ioredis)
interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
}

// ============================================================================
// TYPES
// ============================================================================

export interface CardMatchInput {
  name: string;
  setName?: string;
  number?: string;
  grade?: string;
  tcgdexId?: string;
}

export interface CardMatchResult {
  cardId: string | null;
  tcgdexId: string | null;
  cardKey: string | null;
  confidence: number;
  matchMethod: 'EXACT_ID' | 'EXACT_NAME_SET_NUM' | 'NORMALIZED' | 'FUZZY' | 'NONE';
  metadata?: {
    rarity: string | null;
    category: string | null;
    types: string[];
    illustrator: string | null;
    imageUrl: string | null;
  };
}

// ============================================================================
// CARD MATCHER
// ============================================================================

export class CardMatcher {
  private redis: RedisLike;
  private fuzzyMatcher: FuzzyMatcher;
  private cachePrefix = 'cardmatch:';
  private cacheTtl = 3600; // 1 hour

  constructor(redis: RedisLike) {
    this.redis = redis;
    this.fuzzyMatcher = new FuzzyMatcher(0.80); // Higher threshold for card matching
  }

  /**
   * Match a card input to a Card record in the database.
   */
  async match(input: CardMatchInput, prisma: any): Promise<CardMatchResult> {
    const noMatch: CardMatchResult = {
      cardId: null,
      tcgdexId: null,
      cardKey: null,
      confidence: 0,
      matchMethod: 'NONE',
    };

    if (!input.name && !input.tcgdexId) return noMatch;

    // Check cache first
    const cacheKey = this.buildCacheKey(input);
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    let result: CardMatchResult;

    // Strategy 1: Direct tcgdexId lookup
    if (input.tcgdexId) {
      result = await this.matchByTcgdexId(input.tcgdexId, prisma);
      if (result.matchMethod !== 'NONE') {
        await this.setCache(cacheKey, result);
        return result;
      }
    }

    // Strategy 2: Exact searchName + searchSet + number
    if (input.name) {
      result = await this.matchExact(input, prisma);
      if (result.matchMethod !== 'NONE') {
        await this.setCache(cacheKey, result);
        return result;
      }
    }

    // Strategy 3: Normalized name + set
    if (input.name && input.setName) {
      result = await this.matchNormalized(input, prisma);
      if (result.matchMethod !== 'NONE') {
        await this.setCache(cacheKey, result);
        return result;
      }
    }

    // Strategy 4: Fuzzy match against SourceCatalogItem (TCGDEX source)
    if (input.name) {
      result = await this.matchFuzzy(input, prisma);
      if (result.matchMethod !== 'NONE') {
        await this.setCache(cacheKey, result);
        return result;
      }
    }

    // Cache negative result too (shorter TTL)
    await this.redis.setex(
      this.cachePrefix + cacheKey,
      300, // 5 min for misses
      JSON.stringify(noMatch)
    );

    return noMatch;
  }

  // ========================================================================
  // STRATEGIES
  // ========================================================================

  private async matchByTcgdexId(tcgdexId: string, prisma: any): Promise<CardMatchResult> {
    const card = await prisma.card.findFirst({
      where: { tcgdexId },
    });

    if (card) {
      return {
        cardId: card.id,
        tcgdexId: card.tcgdexId,
        cardKey: card.cardKey,
        confidence: 1.0,
        matchMethod: 'EXACT_ID',
        metadata: this.extractMetadata(card),
      };
    }

    return this.noMatchResult();
  }

  private async matchExact(input: CardMatchInput, prisma: any): Promise<CardMatchResult> {
    const searchName = this.normalize(input.name);
    const searchSet = input.setName ? this.normalize(input.setName) : undefined;

    const where: any = { searchName };
    if (searchSet) where.searchSet = searchSet;
    if (input.number) where.number = input.number;

    const card = await prisma.card.findFirst({ where });

    if (card) {
      return {
        cardId: card.id,
        tcgdexId: card.tcgdexId,
        cardKey: card.cardKey,
        confidence: 1.0,
        matchMethod: 'EXACT_NAME_SET_NUM',
        metadata: this.extractMetadata(card),
      };
    }

    return this.noMatchResult();
  }

  private async matchNormalized(input: CardMatchInput, prisma: any): Promise<CardMatchResult> {
    const searchName = this.normalize(input.name);
    const canonicalSet = this.fuzzyMatcher.normalizeSetName(input.setName || '');

    if (!canonicalSet) return this.noMatchResult();

    const normalizedSet = this.normalize(canonicalSet);

    const card = await prisma.card.findFirst({
      where: {
        searchName,
        searchSet: normalizedSet,
      },
    });

    if (card) {
      return {
        cardId: card.id,
        tcgdexId: card.tcgdexId,
        cardKey: card.cardKey,
        confidence: 0.9,
        matchMethod: 'NORMALIZED',
        metadata: this.extractMetadata(card),
      };
    }

    return this.noMatchResult();
  }

  private async matchFuzzy(input: CardMatchInput, prisma: any): Promise<CardMatchResult> {
    const searchName = this.normalize(input.name);

    // Get candidate catalog items from TCGdex source
    const candidates = await prisma.sourceCatalogItem.findMany({
      where: {
        source: 'TCGDEX',
        title: {
          contains: input.name.split(' ')[0], // First word prefix filter
          mode: 'insensitive',
        },
      },
      take: 50,
    });

    if (candidates.length === 0) return this.noMatchResult();

    let bestMatch: any = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateName = this.normalize(candidate.title);
      const nameScore = jaroWinklerSimilarity(searchName, candidateName);

      let setScore = 0;
      if (input.setName && candidate.setName) {
        setScore = jaroWinklerSimilarity(
          this.normalize(input.setName),
          this.normalize(candidate.setName)
        );
      }

      // Combined score (name weighted more)
      const totalScore = input.setName
        ? nameScore * 0.6 + setScore * 0.4
        : nameScore;

      if (totalScore > bestScore && totalScore >= 0.80) {
        bestScore = totalScore;
        bestMatch = candidate;
      }
    }

    if (!bestMatch) return this.noMatchResult();

    // Try to find linked Card
    const card = bestMatch.cardId
      ? await prisma.card.findFirst({ where: { id: bestMatch.cardId } })
      : null;

    return {
      cardId: card?.id ?? null,
      tcgdexId: bestMatch.sourceItemId, // TCGdex ID stored as sourceItemId
      cardKey: bestMatch.cardKey ?? card?.cardKey ?? null,
      confidence: bestScore,
      matchMethod: 'FUZZY',
      metadata: card ? this.extractMetadata(card) : undefined,
    };
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private normalize(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractMetadata(card: any) {
    return {
      rarity: card.rarity ?? null,
      category: card.category ?? null,
      types: card.pokemonTypes ?? [],
      illustrator: card.illustrator ?? null,
      imageUrl: card.imageUrl ?? null,
    };
  }

  private noMatchResult(): CardMatchResult {
    return {
      cardId: null,
      tcgdexId: null,
      cardKey: null,
      confidence: 0,
      matchMethod: 'NONE',
    };
  }

  private buildCacheKey(input: CardMatchInput): string {
    const parts = [
      input.tcgdexId || '',
      this.normalize(input.name),
      input.setName ? this.normalize(input.setName) : '',
      input.number || '',
    ];
    return parts.join('|');
  }

  private async getFromCache(key: string): Promise<CardMatchResult | null> {
    try {
      const raw = await this.redis.get(this.cachePrefix + key);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore cache errors
    }
    return null;
  }

  private async setCache(key: string, result: CardMatchResult): Promise<void> {
    try {
      await this.redis.setex(this.cachePrefix + key, this.cacheTtl, JSON.stringify(result));
    } catch {
      // Ignore cache errors
    }
  }

  /**
   * Clear the match cache (useful for testing or after bulk updates).
   */
  async clearCache(): Promise<void> {
    const keys = await this.redis.keys(this.cachePrefix + '*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

/**
 * Create a CardMatcher instance.
 */
export function createCardMatcher(redis: RedisLike): CardMatcher {
  return new CardMatcher(redis);
}
