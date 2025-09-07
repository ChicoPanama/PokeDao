/**
 * eBay Query Builder Utilities
 * 
 * Optimized query building for Pokemon card searches on eBay.
 * Integrates with Phase 2 normalization engine card keys.
 * 
 * @author PokeDAO Builder - Phase 3 Fork Integration  
 * @inspired_by eBay marketplace analysis patterns and query optimization
 */

export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  condition?: string[];
  grade?: string[];
  variant?: string;
  excludeTerms?: string[];
  soldListingsOnly?: boolean;
  auctionFormat?: 'auction' | 'buy_it_now' | 'both';
  timeRange?: '7d' | '30d' | '90d' | 'all';
}

export interface EbayQuery {
  keywords: string;
  categoryId?: string;
  filters: Record<string, any>;
  sortOrder: string;
  aspectFilters?: Record<string, string[]>;
}

export interface CardCategory {
  tcg: 'pokemon' | 'mtg' | 'yugioh' | 'other';
  era?: 'vintage' | 'modern' | 'contemporary';
  type?: 'single' | 'sealed' | 'graded';
}

export interface KeywordOptimization {
  primary: string[];
  secondary: string[];
  negative: string[];
  variants: string[];
}

/**
 * Advanced eBay query builder for Pokemon card marketplace analysis
 */
export class EbayQueryBuilder {
  private static readonly POKEMON_CATEGORY_ID = '2536'; // eBay Pokemon category
  
  private static readonly GRADE_SERVICE_MAP: Record<string, string> = {
    psa: 'PSA',
    bgs: 'BGS',
    cgc: 'CGC',
    sgc: 'SGC'
  };

  private static readonly VARIANT_KEYWORDS: Record<string, string[]> = {
    holo: ['holo', 'holographic', 'foil'],
    reverse: ['reverse holo', 'reverse', 'rev holo'],
    fullart: ['full art', 'fullart', 'full-art'],
    secret: ['secret rare', 'secret', 'sr'],
    rainbow: ['rainbow rare', 'rainbow', 'rr'],
    gold: ['gold rare', 'gold', 'gr'],
    promo: ['promo', 'promotional', 'black star']
  };

  private static readonly SET_ALIASES: Record<string, string[]> = {
    'base1': ['base set', 'base', 'unlimited', 'shadowless'],
    'jungle': ['jungle set', 'jungle'],
    'fossil': ['fossil set', 'fossil'],
    'teamrocket': ['team rocket', 'rocket'],
    'xyevolutions': ['xy evolutions', 'evolutions', 'xy evo']
  };

  /**
   * Build optimized eBay search query from normalized card key
   */
  static buildSearchQuery(cardKey: string, filters: SearchFilters = {}): EbayQuery {
    const cardInfo = this.parseCardKey(cardKey);
    const keywords = this.buildKeywords(cardInfo, filters);
    const categoryFilters = this.buildCategoryFilters({
      tcg: 'pokemon',
      type: filters.grade ? 'graded' : 'single'
    });

    return {
      keywords: keywords.join(' '),
      categoryId: this.POKEMON_CATEGORY_ID,
      filters: this.buildSearchFilters(filters),
      sortOrder: filters.soldListingsOnly ? 'EndTimeSoonest' : 'BestMatch',
      aspectFilters: this.buildAspectFilters(cardInfo, filters)
    };
  }

  /**
   * Optimize keywords for maximum search relevance
   */
  static optimizeKeywords(title: string, cardKey?: string): KeywordOptimization {
    const words = title.toLowerCase().split(/\s+/);
    const cardInfo = cardKey ? this.parseCardKey(cardKey) : null;

    // Primary keywords (essential for match)
    const primary = [
      ...this.extractPokemonName(words),
      ...this.extractSetKeywords(words, cardInfo?.set),
    ].filter(Boolean);

    // Secondary keywords (improve relevance)
    const secondary = [
      ...this.extractVariantKeywords(words, cardInfo?.variant),
      ...this.extractGradeKeywords(words, cardInfo?.grade),
      ...this.extractNumberKeywords(words, cardInfo?.number)
    ].filter(Boolean);

    // Negative keywords (exclude unwanted results)
    const negative = [
      'topps', 'panini', 'upper deck', 'japanese', 'korean',
      'fake', 'proxy', 'custom', 'ooak', 'art', 'sleeve'
    ];

    // Variant spellings and aliases
    const variants = this.generateKeywordVariants(primary);

    return { primary, secondary, negative, variants };
  }

  /**
   * Build category-specific filters
   */
  static buildCategoryFilters(category: CardCategory): Record<string, any> {
    const filters: Record<string, any> = {};

    if (category.tcg === 'pokemon') {
      filters.categoryId = this.POKEMON_CATEGORY_ID;
    }

    if (category.type === 'graded') {
      filters.aspectFilters = {
        'Professional Grader': ['PSA', 'BGS', 'CGC', 'SGC']
      };
    }

    if (category.era === 'vintage') {
      filters.yearRange = { min: 1998, max: 2003 };
    }

    return filters;
  }

  /**
   * Parse normalized card key into components
   */
  private static parseCardKey(cardKey: string): {
    set: string;
    number: string;
    variant: string;
    grade: string;
  } {
    const parts = cardKey.split('-');
    return {
      set: parts[0] || '',
      number: parts[1] || '',
      variant: parts[2] || '',
      grade: parts[3] || ''
    };
  }

  /**
   * Build optimized keyword string
   */
  private static buildKeywords(
    cardInfo: ReturnType<typeof this.parseCardKey>,
    filters: SearchFilters
  ): string[] {
    const keywords: string[] = [];

    // Add set keywords
    if (cardInfo.set && this.SET_ALIASES[cardInfo.set]) {
      keywords.push(this.SET_ALIASES[cardInfo.set][0]); // Use primary set name
    }

    // Add number if specific
    if (cardInfo.number && cardInfo.number !== '000') {
      keywords.push(`#${parseInt(cardInfo.number)}`); // Remove leading zeros
    }

    // Add variant keywords
    if (cardInfo.variant && cardInfo.variant !== 'base' && this.VARIANT_KEYWORDS[cardInfo.variant]) {
      keywords.push(this.VARIANT_KEYWORDS[cardInfo.variant][0]);
    }

    // Add grade service if specified
    if (cardInfo.grade && cardInfo.grade !== 'raw') {
      const gradeService = cardInfo.grade.match(/^(psa|bgs|cgc|sgc)/i)?.[1];
      if (gradeService && this.GRADE_SERVICE_MAP[gradeService.toLowerCase()]) {
        keywords.push(this.GRADE_SERVICE_MAP[gradeService.toLowerCase()]);
      }
    }

    // Add condition filters
    if (filters.condition?.length) {
      keywords.push(...filters.condition);
    }

    return keywords;
  }

  /**
   * Build eBay-specific search filters
   */
  private static buildSearchFilters(filters: SearchFilters): Record<string, any> {
    const searchFilters: Record<string, any> = {};

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      searchFilters.price = {
        min: filters.priceMin,
        max: filters.priceMax
      };
    }

    if (filters.soldListingsOnly) {
      searchFilters.soldListings = true;
    }

    if (filters.auctionFormat && filters.auctionFormat !== 'both') {
      searchFilters.listingType = filters.auctionFormat === 'auction' ? 'Auction' : 'FixedPrice';
    }

    if (filters.timeRange && filters.timeRange !== 'all') {
      const days = parseInt(filters.timeRange);
      searchFilters.endTimeFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    if (filters.excludeTerms?.length) {
      searchFilters.excludeWords = filters.excludeTerms.join(' ');
    }

    return searchFilters;
  }

  /**
   * Build aspect filters for refined search
   */
  private static buildAspectFilters(
    cardInfo: ReturnType<typeof this.parseCardKey>,
    filters: SearchFilters
  ): Record<string, string[]> {
    const aspectFilters: Record<string, string[]> = {};

    // Game filter
    aspectFilters['Game'] = ['Pokémon TCG'];

    // Language filter (default to English)
    aspectFilters['Language'] = ['English'];

    // Grade service filter
    if (cardInfo.grade && cardInfo.grade !== 'raw') {
      const gradeService = cardInfo.grade.match(/^(psa|bgs|cgc|sgc)/i)?.[1];
      if (gradeService) {
        aspectFilters['Professional Grader'] = [this.GRADE_SERVICE_MAP[gradeService.toLowerCase()]];
      }
    }

    // Card condition for raw cards
    if (cardInfo.grade === 'raw' && filters.condition?.length) {
      aspectFilters['Condition'] = filters.condition;
    }

    return aspectFilters;
  }

  /**
   * Extract Pokemon name from search terms
   */
  private static extractPokemonName(words: string[]): string[] {
    // Remove common non-name words
    const stopWords = ['pokemon', 'card', 'tcg', 'holo', 'rare', 'common', 'uncommon'];
    return words.filter(word => 
      !stopWords.includes(word) && 
      !word.match(/^\d+$/) && 
      !word.match(/^#\d+$/) &&
      word.length > 2
    );
  }

  /**
   * Extract set-related keywords
   */
  private static extractSetKeywords(words: string[], setCode?: string): string[] {
    if (setCode && this.SET_ALIASES[setCode]) {
      return [this.SET_ALIASES[setCode][0]];
    }

    const setWords = words.filter(word => 
      ['base', 'jungle', 'fossil', 'rocket', 'gym', 'neo', 'expedition'].includes(word)
    );

    return setWords;
  }

  /**
   * Extract variant keywords
   */
  private static extractVariantKeywords(words: string[], variant?: string): string[] {
    if (variant && variant !== 'base' && this.VARIANT_KEYWORDS[variant]) {
      return [this.VARIANT_KEYWORDS[variant][0]];
    }

    return words.filter(word => 
      Object.values(this.VARIANT_KEYWORDS).flat().includes(word)
    );
  }

  /**
   * Extract grade keywords
   */
  private static extractGradeKeywords(words: string[], grade?: string): string[] {
    if (grade && grade !== 'raw') {
      const gradeService = grade.match(/^(psa|bgs|cgc|sgc)/i)?.[1];
      if (gradeService) {
        return [this.GRADE_SERVICE_MAP[gradeService.toLowerCase()]];
      }
    }

    return [];
  }

  /**
   * Extract card number keywords
   */
  private static extractNumberKeywords(words: string[], number?: string): string[] {
    if (number && number !== '000') {
      return [`#${parseInt(number)}`];
    }

    const numberWords = words.filter(word => word.match(/^#?\d+$/));
    return numberWords;
  }

  /**
   * Generate keyword variants and aliases
   */
  private static generateKeywordVariants(keywords: string[]): string[] {
    const variants: string[] = [];

    keywords.forEach(keyword => {
      // Add common misspellings and abbreviations
      switch (keyword.toLowerCase()) {
        case 'charizard':
          variants.push('zard', 'charizard');
          break;
        case 'blastoise':
          variants.push('blastoise', 'toise');
          break;
        case 'venusaur':
          variants.push('venusaur', 'saur');
          break;
        case 'pikachu':
          variants.push('pika', 'pikachu');
          break;
      }
    });

    return variants;
  }
}

/**
 * Helper class for managing eBay search sessions and rate limiting
 */
export class EbaySearchSession {
  private static readonly MAX_REQUESTS_PER_MINUTE = 5000; // eBay API limit
  private static readonly REQUEST_INTERVAL = 12; // milliseconds between requests

  private requestCount = 0;
  private lastRequestTime = 0;

  /**
   * Execute rate-limited eBay search
   */
  async executeSearch(query: EbayQuery): Promise<{
    query: EbayQuery;
    timestamp: Date;
    rateLimit: {
      remaining: number;
      resetTime: Date;
    };
  }> {
    await this.enforceRateLimit();
    
    this.requestCount++;
    this.lastRequestTime = Date.now();

    return {
      query,
      timestamp: new Date(),
      rateLimit: {
        remaining: EbaySearchSession.MAX_REQUESTS_PER_MINUTE - this.requestCount,
        resetTime: new Date(Date.now() + 60000) // Reset in 1 minute
      }
    };
  }

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < EbaySearchSession.REQUEST_INTERVAL) {
      const delay = EbaySearchSession.REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Reset rate limit counters (called every minute)
   */
  resetRateLimit(): void {
    this.requestCount = 0;
  }
}
