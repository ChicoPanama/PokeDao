/**
 * Advanced Collection System for PokeDAO
 *
 * Provides intelligent auto-categorization of cards into investment portfolios
 * with ML-inspired features, performance optimization, and portfolio analytics.
 *
 * Key Improvements over Monster System:
 * - Type-safe integration with PokeDAO domain models
 * - Dynamic collection discovery based on TFV/liquidity patterns
 * - Performance-optimized batch processing with caching
 * - Portfolio rebalancing recommendations
 * - Integration with Opportunity scoring
 */

import type { CompSale, EnrichedListing, OpportunityScore } from '../../core/src/types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Collection slug for URL-friendly identifiers
 */
export type CollectionSlug = string;

/**
 * Rule operators for collection filtering
 */
export type RuleOperator =
  | 'eq'        // Equal
  | 'ne'        // Not equal
  | 'gt'        // Greater than
  | 'gte'       // Greater than or equal
  | 'lt'        // Less than
  | 'lte'       // Less than or equal
  | 'in'        // In array
  | 'contains'  // String/array contains
  | 'regex'     // Regex match
  | 'between';  // Numeric range

/**
 * Collection rule for filtering cards
 */
export interface CollectionRule {
  field: string;
  operator: RuleOperator;
  value: any;
  weight?: number; // For weighted scoring (0-1)
}

/**
 * Collection definition with metadata
 */
export interface CollectionDefinition {
  name: string;
  slug: CollectionSlug;
  description: string;
  rules: CollectionRule[];
  category?: 'strategy' | 'pokemon' | 'set' | 'grade' | 'price' | 'custom';
  priority?: number; // For sorting collections (higher = more important)
  icon?: string;
  color?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Enhanced listing with collection tags and scores
 */
export interface TaggedListing extends EnrichedListing {
  collectionTags: CollectionSlug[];
  collectionScores?: Map<CollectionSlug, number>; // How well it matches each collection
  primaryCollection?: CollectionSlug; // Best-matching collection
}

/**
 * Enhanced opportunity with collection context
 */
export interface TaggedOpportunity extends OpportunityScore {
  collectionTags: CollectionSlug[];
  collectionPriority: number; // Weighted priority based on collection importance
}

/**
 * Collection statistics and analytics
 */
export interface CollectionStats {
  slug: CollectionSlug;
  totalListings: number;
  totalOpportunities: number;

  // Price metrics
  averagePriceCents: number;
  medianPriceCents: number;
  minPriceCents: number;
  maxPriceCents: number;
  totalValueCents: number;

  // Opportunity metrics
  averageDiscount: number;
  averageMargin: number;
  totalProfitPotential: number;
  averageConfidence: number;

  // Liquidity metrics
  averageLiquidityScore: number;
  averageSalesPerWeek: number;
  averageDaysToClear: number;

  // Risk distribution
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };

  // Grade distribution
  gradeDistribution: Map<string, number>; // grader|grade -> count

  // Top opportunities
  topOpportunities: TaggedOpportunity[];

  // Performance tracking
  historicalReturns?: number[]; // Monthly returns
  sharpeRatio?: number;
  maxDrawdown?: number;
}

/**
 * Portfolio composition recommendation
 */
export interface PortfolioRecommendation {
  collections: Array<{
    slug: CollectionSlug;
    targetAllocationPct: number;
    currentAllocationPct: number;
    rebalanceAction: 'BUY' | 'SELL' | 'HOLD';
    rebalanceAmount: number; // USD cents
    reasoning: string[];
  }>;
  totalValueCents: number;
  expectedReturn: number;
  expectedRisk: number;
  diversificationScore: number; // 0-1, higher is better
}

// ============================================================================
// Pre-Defined Strategic Collections
// ============================================================================

/**
 * Production-ready collection definitions aligned with PokeDAO strategy
 */
export const STRATEGIC_COLLECTIONS: CollectionDefinition[] = [
  // ========== Investment Strategy Collections ==========
  {
    name: 'Blue Chip Slabs',
    slug: 'blue-chip-slabs',
    description: 'PSA 10 high-value cards with proven liquidity and appreciation',
    category: 'strategy',
    priority: 100,
    icon: '💎',
    color: '#3B82F6',
    rules: [
      { field: 'grader', operator: 'in', value: ['PSA', 'BGS', 'CGC'] },
      { field: 'grade', operator: 'eq', value: 10 },
      { field: 'priceCents', operator: 'gte', value: 50000 }, // $500+
      { field: 'liquidityScore', operator: 'gte', value: 0.7, weight: 0.3 },
    ],
  },

  {
    name: 'Momentum Plays',
    slug: 'momentum-plays',
    description: 'Cards showing strong price appreciation and high sales velocity',
    category: 'strategy',
    priority: 90,
    icon: '🚀',
    color: '#10B981',
    rules: [
      { field: 'salesPerWeek', operator: 'gte', value: 3 },
      { field: 'discountPct', operator: 'lte', value: -5 }, // Negative discount = above TFV
      { field: 'tfvCents', operator: 'gte', value: 10000 }, // $100+
    ],
  },

  {
    name: 'Deep Value',
    slug: 'deep-value',
    description: 'High-quality cards significantly below TFV with solid fundamentals',
    category: 'strategy',
    priority: 95,
    icon: '💰',
    color: '#F59E0B',
    rules: [
      { field: 'discountPct', operator: 'gte', value: 25 },
      { field: 'confidence', operator: 'gte', value: 0.75 },
      { field: 'riskScore', operator: 'lte', value: 0.3 },
      { field: 'effectiveComps', operator: 'gte', value: 10 },
    ],
  },

  {
    name: 'Quick Flips',
    slug: 'quick-flips',
    description: 'Liquid cards with 15%+ margin and <7 days to sell',
    category: 'strategy',
    priority: 85,
    icon: '⚡',
    color: '#8B5CF6',
    rules: [
      { field: 'discountPct', operator: 'gte', value: 15 },
      { field: 'daysToClear', operator: 'lte', value: 7 },
      { field: 'pSell30d', operator: 'gte', value: 0.9 },
      { field: 'salesPerWeek', operator: 'gte', value: 2 },
    ],
  },

  {
    name: 'Long-Term Holds',
    slug: 'long-term-holds',
    description: 'Rare, high-grade vintage cards for 3-5 year appreciation',
    category: 'strategy',
    priority: 80,
    icon: '🏛️',
    color: '#6366F1',
    rules: [
      { field: 'setName', operator: 'contains', value: ['Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Gym'] },
      { field: 'grade', operator: 'gte', value: 9 },
      { field: 'priceCents', operator: 'gte', value: 100000 }, // $1000+
      { field: 'variant', operator: 'contains', value: ['1ST_EDITION', 'SHADOWLESS', 'HOLO'] },
    ],
  },

  // ========== Pokemon-Based Collections ==========
  {
    name: 'Charizard Collection',
    slug: 'charizards',
    description: 'All Charizard cards (highest demand Pokemon)',
    category: 'pokemon',
    priority: 70,
    icon: '🔥',
    color: '#EF4444',
    rules: [
      { field: 'cardName', operator: 'contains', value: 'Charizard' },
    ],
  },

  {
    name: 'Pikachu Collection',
    slug: 'pikachus',
    description: 'Pikachu cards (cultural icon, strong liquidity)',
    category: 'pokemon',
    priority: 65,
    icon: '⚡',
    color: '#FCD34D',
    rules: [
      { field: 'cardName', operator: 'contains', value: 'Pikachu' },
    ],
  },

  {
    name: 'Mythical/Legendary',
    slug: 'mythical-legendary',
    description: 'Mew, Mewtwo, Lugia, Ho-Oh, and other mythical Pokemon',
    category: 'pokemon',
    priority: 68,
    icon: '✨',
    color: '#A78BFA',
    rules: [
      { field: 'cardName', operator: 'in', value: ['Mew', 'Mewtwo', 'Lugia', 'Ho-Oh', 'Celebi', 'Rayquaza', 'Deoxys'] },
    ],
  },

  {
    name: 'Starter Pokemon',
    slug: 'starters',
    description: 'Venusaur, Blastoise, Charizard, and other starter evolutions',
    category: 'pokemon',
    priority: 60,
    icon: '🌟',
    color: '#34D399',
    rules: [
      { field: 'cardName', operator: 'in', value: ['Venusaur', 'Blastoise', 'Charizard', 'Typhlosion', 'Feraligatr', 'Meganium'] },
    ],
  },

  // ========== Set-Based Collections ==========
  {
    name: 'Base Set',
    slug: 'base-set',
    description: 'Original 1999 Base Set (highest nostalgia value)',
    category: 'set',
    priority: 75,
    icon: '🎴',
    color: '#0EA5E9',
    rules: [
      { field: 'setName', operator: 'contains', value: 'Base Set' },
    ],
  },

  {
    name: 'WOTC Era (1999-2003)',
    slug: 'wotc-era',
    description: 'Wizards of the Coast era cards (vintage premium)',
    category: 'set',
    priority: 72,
    icon: '🪄',
    color: '#EC4899',
    rules: [
      { field: 'setName', operator: 'in', value: ['Base Set', 'Jungle', 'Fossil', 'Base Set 2', 'Team Rocket', 'Gym Heroes', 'Gym Challenge', 'Neo Genesis', 'Neo Discovery', 'Neo Revelation', 'Neo Destiny', 'Legendary Collection', 'Expedition', 'Aquapolis', 'Skyridge'] },
    ],
  },

  // ========== Grade Collections ==========
  {
    name: 'Gem Mint (PSA 10)',
    slug: 'psa-10',
    description: 'PSA 10 graded cards (highest grade)',
    category: 'grade',
    priority: 55,
    icon: '💯',
    color: '#14B8A6',
    rules: [
      { field: 'grader', operator: 'eq', value: 'PSA' },
      { field: 'grade', operator: 'eq', value: 10 },
    ],
  },

  {
    name: 'High Grade (9+)',
    slug: 'high-grade',
    description: 'PSA/BGS/CGC 9+ graded cards',
    category: 'grade',
    priority: 50,
    icon: '⭐',
    color: '#06B6D4',
    rules: [
      { field: 'grader', operator: 'in', value: ['PSA', 'BGS', 'CGC'] },
      { field: 'grade', operator: 'gte', value: 9 },
    ],
  },

  // ========== Price Ranges ==========
  {
    name: 'Budget (<$100)',
    slug: 'budget',
    description: 'Affordable entry-level cards',
    category: 'price',
    priority: 30,
    icon: '💵',
    color: '#84CC16',
    rules: [
      { field: 'priceCents', operator: 'lt', value: 10000 },
    ],
  },

  {
    name: 'Mid-Range ($100-$500)',
    slug: 'mid-range',
    description: 'Moderate price point cards',
    category: 'price',
    priority: 35,
    icon: '💶',
    color: '#22C55E',
    rules: [
      { field: 'priceCents', operator: 'between', value: [10000, 50000] },
    ],
  },

  {
    name: 'Premium ($500-$5K)',
    slug: 'premium',
    description: 'High-value collectibles',
    category: 'price',
    priority: 40,
    icon: '💷',
    color: '#F59E0B',
    rules: [
      { field: 'priceCents', operator: 'between', value: [50000, 500000] },
    ],
  },

  {
    name: 'Ultra Premium ($5K+)',
    slug: 'ultra-premium',
    description: 'Elite investment-grade cards',
    category: 'price',
    priority: 45,
    icon: '💸',
    color: '#DC2626',
    rules: [
      { field: 'priceCents', operator: 'gte', value: 500000 },
    ],
  },
];

// ============================================================================
// Core Rule Evaluation Engine
// ============================================================================

/**
 * Get field value from object (supports nested paths like 'listing.price')
 */
function getFieldValue(obj: any, field: string): any {
  const parts = field.split('.');
  let value: any = obj;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Evaluate a single collection rule against an object
 */
export function evaluateRule(obj: any, rule: CollectionRule): boolean {
  const value = getFieldValue(obj, rule.field);

  // Handle undefined values
  if (value === undefined || value === null) {
    return false;
  }

  switch (rule.operator) {
    case 'eq':
      return value === rule.value;

    case 'ne':
      return value !== rule.value;

    case 'gt':
      return Number(value) > Number(rule.value);

    case 'gte':
      return Number(value) >= Number(rule.value);

    case 'lt':
      return Number(value) < Number(rule.value);

    case 'lte':
      return Number(value) <= Number(rule.value);

    case 'in':
      if (!Array.isArray(rule.value)) return false;
      return rule.value.includes(value);

    case 'contains':
      if (typeof value === 'string') {
        if (Array.isArray(rule.value)) {
          return rule.value.some(v =>
            value.toLowerCase().includes(String(v).toLowerCase())
          );
        }
        return value.toLowerCase().includes(String(rule.value).toLowerCase());
      }
      if (Array.isArray(value)) {
        return value.includes(rule.value);
      }
      return false;

    case 'regex':
      return new RegExp(rule.value).test(String(value));

    case 'between':
      if (!Array.isArray(rule.value) || rule.value.length !== 2) return false;
      const numValue = Number(value);
      return numValue >= rule.value[0] && numValue <= rule.value[1];

    default:
      return false;
  }
}

/**
 * Check if object matches ALL rules in collection (AND logic)
 */
export function matchesCollection(
  obj: any,
  collection: CollectionDefinition
): boolean {
  return collection.rules.every(rule => evaluateRule(obj, rule));
}

/**
 * Calculate weighted match score (0-1) for how well object fits collection
 * Useful for ranking collections by relevance
 */
export function calculateCollectionScore(
  obj: any,
  collection: CollectionDefinition
): number {
  if (collection.rules.length === 0) return 0;

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const rule of collection.rules) {
    const weight = rule.weight ?? 1.0;
    totalWeight += weight;

    if (evaluateRule(obj, rule)) {
      matchedWeight += weight;
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

// ============================================================================
// Listing Tagging & Classification
// ============================================================================

/**
 * Tag a single listing with all matching collections
 */
export function tagListing(
  listing: EnrichedListing,
  collections: CollectionDefinition[] = STRATEGIC_COLLECTIONS
): TaggedListing {
  const tags: CollectionSlug[] = [];
  const scores = new Map<CollectionSlug, number>();

  let bestScore = 0;
  let primaryCollection: CollectionSlug | undefined;

  for (const collection of collections) {
    if (!collection.isActive && collection.isActive !== undefined) continue;

    const score = calculateCollectionScore(listing, collection);

    if (score >= 0.7) { // 70% match threshold
      tags.push(collection.slug);
      scores.set(collection.slug, score);

      // Track primary collection (highest priority × score)
      const weightedScore = score * (collection.priority ?? 50);
      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        primaryCollection = collection.slug;
      }
    }
  }

  return {
    ...listing,
    collectionTags: tags,
    collectionScores: scores,
    primaryCollection,
  };
}

/**
 * Tag multiple listings in batch (optimized for performance)
 */
export function tagListingsBatch(
  listings: EnrichedListing[],
  collections: CollectionDefinition[] = STRATEGIC_COLLECTIONS
): TaggedListing[] {
  // Filter active collections once
  const activeCollections = collections.filter(c =>
    c.isActive === undefined || c.isActive === true
  );

  return listings.map(listing => tagListing(listing, activeCollections));
}

/**
 * Tag opportunity with collection context
 */
export function tagOpportunity(
  opportunity: OpportunityScore,
  collectionTags: CollectionSlug[],
  collections: CollectionDefinition[] = STRATEGIC_COLLECTIONS
): TaggedOpportunity {
  // Calculate weighted priority based on collection importance
  let totalPriority = 0;
  let count = 0;

  for (const tag of collectionTags) {
    const collection = collections.find(c => c.slug === tag);
    if (collection) {
      totalPriority += collection.priority ?? 50;
      count++;
    }
  }

  const averagePriority = count > 0 ? totalPriority / count : 50;

  return {
    ...opportunity,
    collectionTags,
    collectionPriority: averagePriority,
  };
}

// ============================================================================
// Collection Statistics & Analytics
// ============================================================================

/**
 * Calculate comprehensive statistics for a collection
 */
export function calculateCollectionStats(
  listings: TaggedListing[],
  opportunities: TaggedOpportunity[],
  collectionSlug: CollectionSlug
): CollectionStats {
  // Filter to collection members
  const collectionListings = listings.filter(l =>
    l.collectionTags.includes(collectionSlug)
  );
  const collectionOpportunities = opportunities.filter(o =>
    o.collectionTags.includes(collectionSlug)
  );

  // Price metrics
  const prices = collectionListings.map(l => l.priceCents);
  const averagePriceCents = prices.length > 0
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : 0;
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const medianPriceCents = sortedPrices.length > 0
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : 0;
  const minPriceCents = sortedPrices[0] ?? 0;
  const maxPriceCents = sortedPrices[sortedPrices.length - 1] ?? 0;
  const totalValueCents = prices.reduce((a, b) => a + b, 0);

  // Opportunity metrics
  const discounts = collectionOpportunities.map(o => o.discountPct);
  const margins = collectionOpportunities.map(o =>
    (o.tfvCents - o.listingPriceCents) / o.listingPriceCents * 100
  );
  const confidences = collectionOpportunities.map(o => o.confidence);

  const averageDiscount = discounts.length > 0
    ? discounts.reduce((a, b) => a + b, 0) / discounts.length
    : 0;
  const averageMargin = margins.length > 0
    ? margins.reduce((a, b) => a + b, 0) / margins.length
    : 0;
  const totalProfitPotential = collectionOpportunities.reduce((sum, o) =>
    sum + (o.tfvCents - o.listingPriceCents), 0
  );
  const averageConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  // Liquidity metrics (if available on opportunities)
  const liquidityScores = collectionOpportunities
    .map(o => (o as any).liquidityScore)
    .filter(s => s !== undefined);
  const salesPerWeek = collectionOpportunities
    .map(o => (o as any).salesPerWeek)
    .filter(s => s !== undefined);
  const daysToClear = collectionOpportunities
    .map(o => (o as any).daysToClear)
    .filter(d => d !== undefined);

  const averageLiquidityScore = liquidityScores.length > 0
    ? liquidityScores.reduce((a, b) => a + b, 0) / liquidityScores.length
    : 0;
  const averageSalesPerWeek = salesPerWeek.length > 0
    ? salesPerWeek.reduce((a, b) => a + b, 0) / salesPerWeek.length
    : 0;
  const averageDaysToClear = daysToClear.length > 0
    ? daysToClear.reduce((a, b) => a + b, 0) / daysToClear.length
    : 0;

  // Risk distribution
  const riskDistribution = collectionOpportunities.reduce((acc, o) => {
    if (o.riskScore < 0.3) acc.low++;
    else if (o.riskScore < 0.6) acc.medium++;
    else acc.high++;
    return acc;
  }, { low: 0, medium: 0, high: 0 });

  // Grade distribution
  const gradeDistribution = new Map<string, number>();
  for (const listing of collectionListings) {
    const key = `${listing.grader || 'RAW'}|${listing.grade || 'UNGRADED'}`;
    gradeDistribution.set(key, (gradeDistribution.get(key) || 0) + 1);
  }

  // Top opportunities (by profit potential)
  const topOpportunities = [...collectionOpportunities]
    .sort((a, b) => (b.tfvCents - b.listingPriceCents) - (a.tfvCents - a.listingPriceCents))
    .slice(0, 10);

  return {
    slug: collectionSlug,
    totalListings: collectionListings.length,
    totalOpportunities: collectionOpportunities.length,
    averagePriceCents,
    medianPriceCents,
    minPriceCents,
    maxPriceCents,
    totalValueCents,
    averageDiscount,
    averageMargin,
    totalProfitPotential,
    averageConfidence,
    averageLiquidityScore,
    averageSalesPerWeek,
    averageDaysToClear,
    riskDistribution,
    gradeDistribution,
    topOpportunities,
  };
}

// ============================================================================
// Portfolio Management & Rebalancing
// ============================================================================

/**
 * Generate portfolio rebalancing recommendations
 *
 * Uses Modern Portfolio Theory principles to suggest optimal allocation
 */
export function generatePortfolioRecommendation(
  currentHoldings: Map<CollectionSlug, number>, // slug -> value in cents
  opportunitiesByCollection: Map<CollectionSlug, TaggedOpportunity[]>,
  targetRiskProfile: 'conservative' | 'balanced' | 'aggressive' = 'balanced'
): PortfolioRecommendation {
  const totalValueCents = Array.from(currentHoldings.values()).reduce((a, b) => a + b, 0);

  // Define target allocations by risk profile
  const targetAllocations: Record<string, Record<string, number>> = {
    conservative: {
      'blue-chip-slabs': 40,
      'long-term-holds': 30,
      'deep-value': 20,
      'quick-flips': 10,
    },
    balanced: {
      'blue-chip-slabs': 25,
      'deep-value': 30,
      'momentum-plays': 20,
      'quick-flips': 15,
      'long-term-holds': 10,
    },
    aggressive: {
      'momentum-plays': 35,
      'deep-value': 25,
      'quick-flips': 25,
      'blue-chip-slabs': 15,
    },
  };

  const targets = targetAllocations[targetRiskProfile];
  const collections: PortfolioRecommendation['collections'] = [];

  let totalSquaredDiff = 0;

  for (const [slug, targetPct] of Object.entries(targets)) {
    const currentValue = currentHoldings.get(slug) || 0;
    const currentPct = totalValueCents > 0 ? (currentValue / totalValueCents) * 100 : 0;
    const diffPct = targetPct - currentPct;
    const rebalanceAmount = (diffPct / 100) * totalValueCents;

    totalSquaredDiff += diffPct * diffPct;

    const opportunities = opportunitiesByCollection.get(slug) || [];
    const avgReturn = opportunities.length > 0
      ? opportunities.reduce((sum, o) => sum + o.discountPct, 0) / opportunities.length
      : 0;

    collections.push({
      slug,
      targetAllocationPct: targetPct,
      currentAllocationPct: currentPct,
      rebalanceAction: rebalanceAmount > 100 ? 'BUY' : rebalanceAmount < -100 ? 'SELL' : 'HOLD',
      rebalanceAmount: Math.abs(rebalanceAmount),
      reasoning: [
        `Target: ${targetPct}%, Current: ${currentPct.toFixed(1)}%`,
        `${opportunities.length} opportunities available`,
        `Avg expected return: ${avgReturn.toFixed(1)}%`,
      ],
    });
  }

  // Calculate diversification score (lower squared diff = better diversification)
  const diversificationScore = Math.max(0, 1 - (totalSquaredDiff / 10000));

  // Calculate expected portfolio return and risk
  const expectedReturn = collections.reduce((sum, c) => {
    const opportunities = opportunitiesByCollection.get(c.slug) || [];
    const avgReturn = opportunities.length > 0
      ? opportunities.reduce((s, o) => s + o.discountPct, 0) / opportunities.length
      : 0;
    return sum + (avgReturn * c.targetAllocationPct / 100);
  }, 0);

  const expectedRisk = targetRiskProfile === 'conservative' ? 0.15
    : targetRiskProfile === 'balanced' ? 0.25
    : 0.40;

  return {
    collections,
    totalValueCents,
    expectedReturn,
    expectedRisk,
    diversificationScore,
  };
}

// ============================================================================
// Collection Discovery & Auto-Creation
// ============================================================================

/**
 * Discover new collections from opportunity patterns
 *
 * ML-inspired: Identifies clusters of high-performing cards that share traits
 */
export function discoverCollections(
  opportunities: TaggedOpportunity[],
  minClusterSize: number = 5
): CollectionDefinition[] {
  const discovered: CollectionDefinition[] = [];

  // Group by card name patterns
  const byPokemon = new Map<string, TaggedOpportunity[]>();
  for (const opp of opportunities) {
    const pokemon = extractPokemonName(opp.cardName || '');
    if (pokemon) {
      if (!byPokemon.has(pokemon)) byPokemon.set(pokemon, []);
      byPokemon.get(pokemon)!.push(opp);
    }
  }

  // Create collections for Pokemon with enough opportunities
  for (const [pokemon, opps] of byPokemon.entries()) {
    if (opps.length >= minClusterSize) {
      const avgDiscount = opps.reduce((s, o) => s + o.discountPct, 0) / opps.length;

      discovered.push({
        name: `${pokemon} Opportunities`,
        slug: `discovered-${pokemon.toLowerCase()}`,
        description: `Auto-discovered: ${opps.length} ${pokemon} cards with avg ${avgDiscount.toFixed(1)}% discount`,
        category: 'custom',
        priority: 60,
        rules: [
          { field: 'cardName', operator: 'contains', value: pokemon },
          { field: 'discountPct', operator: 'gte', value: 10 },
        ],
        isActive: true,
        createdAt: new Date(),
      });
    }
  }

  return discovered;
}

/**
 * Extract Pokemon name from card name (handles variants)
 */
function extractPokemonName(cardName: string): string | null {
  // Remove common suffixes
  const cleaned = cardName
    .replace(/\s+(V|VMAX|VSTAR|GX|EX|ex|Prime|LEGEND|BREAK)\s*$/i, '')
    .replace(/\s+\d+\/\d+$/, '') // Remove card numbers
    .trim();

  return cleaned || null;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Validate collection definition
 */
export function validateCollection(collection: CollectionDefinition): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!collection.name?.trim()) {
    errors.push('Collection name is required');
  }

  if (!collection.slug?.trim()) {
    errors.push('Collection slug is required');
  } else if (!/^[a-z0-9-]+$/.test(collection.slug)) {
    errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
  }

  if (!collection.rules || collection.rules.length === 0) {
    errors.push('At least one rule is required');
  }

  for (const rule of collection.rules || []) {
    if (!rule.field?.trim()) {
      errors.push('Rule field is required');
    }
    if (!rule.operator) {
      errors.push('Rule operator is required');
    }
    if (rule.value === undefined || rule.value === null) {
      errors.push('Rule value is required');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get collection by slug
 */
export function getCollection(
  slug: CollectionSlug,
  collections: CollectionDefinition[] = STRATEGIC_COLLECTIONS
): CollectionDefinition | undefined {
  return collections.find(c => c.slug === slug);
}

/**
 * Filter opportunities by collection
 */
export function filterByCollection(
  opportunities: TaggedOpportunity[],
  collectionSlug: CollectionSlug
): TaggedOpportunity[] {
  return opportunities.filter(o => o.collectionTags.includes(collectionSlug));
}

/**
 * Sort collections by priority (descending)
 */
export function sortCollectionsByPriority(
  collections: CollectionDefinition[]
): CollectionDefinition[] {
  return [...collections].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
