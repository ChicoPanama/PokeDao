// Collection management utilities for user portfolio groupings
// Provides helpers for managing and filtering by user collections

import { CollectionSlug, PortfolioCollection, PortfolioItem, CanonicalListing, ArbitrageOpportunity } from './types';

// Default collection definitions
export const DEFAULT_COLLECTIONS: Array<{ name: string; slug: CollectionSlug; description: string; rules: CollectionRule[] }> = [
  {
    name: 'High-Grade Slabs',
    slug: 'slabs',
    description: 'PSA/BGS/CGC graded cards with high grades',
    rules: [
      { field: 'gradeCompany', operator: 'in', value: ['PSA', 'BGS', 'CGC'] },
      { field: 'grade', operator: 'gte', value: 9 }
    ]
  },
  {
    name: 'Investment Prospects',
    slug: 'prospects',
    description: 'Cards with high profit potential and good liquidity',
    rules: [
      { field: 'marginPct', operator: 'gte', value: 15 },
      { field: 'confidence', operator: 'gte', value: 0.7 },
      { field: 'risk', operator: 'lte', value: 'MEDIUM' }
    ]
  },
  {
    name: 'Watchlist',
    slug: 'watchlist',
    description: 'Cards to monitor for price changes',
    rules: [
      { field: 'cardName', operator: 'in', value: ['charizard', 'pikachu', 'mew', 'mewtwo'] },
      { field: 'grade', operator: 'gte', value: 8 }
    ]
  },
  {
    name: 'Flip Queue',
    slug: 'flip-queue',
    description: 'Cards ready for quick resale',
    rules: [
      { field: 'marginPct', operator: 'gte', value: 20 },
      { field: 'liquidity', operator: 'eq', value: 'HIGH' },
      { field: 'velocity', operator: 'gte', value: 0.7 }
    ]
  },
  {
    name: 'Vintage Collection',
    slug: 'vintage',
    description: 'Pre-2000 vintage Pokemon cards',
    rules: [
      { field: 'setName', operator: 'contains', value: ['Base Set', 'Jungle', 'Fossil', 'Team Rocket'] }
    ]
  },
  {
    name: 'Budget Finds',
    slug: 'budget',
    description: 'Affordable cards under $100',
    rules: [
      { field: 'price', operator: 'lte', value: 10000 }, // $100 in cents
      { field: 'marginPct', operator: 'gte', value: 10 }
    ]
  }
];

// Collection rule definition
export interface CollectionRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'regex';
  value: any;
}

// Collection definition with rules
export interface CollectionDefinition {
  name: string;
  slug: CollectionSlug;
  description: string;
  rules: CollectionRule[];
}

/**
 * Apply collection rules to a listing
 */
export function applyCollectionRules(listing: CanonicalListing, rules: CollectionRule[]): boolean {
  return rules.every(rule => evaluateRule(listing, rule));
}

/**
 * Evaluate a single collection rule
 */
export function evaluateRule(listing: CanonicalListing, rule: CollectionRule): boolean {
  const fieldValue = getFieldValue(listing, rule.field);
  
  switch (rule.operator) {
    case 'eq':
      return fieldValue === rule.value;
    case 'ne':
      return fieldValue !== rule.value;
    case 'gt':
      return Number(fieldValue) > Number(rule.value);
    case 'gte':
      return Number(fieldValue) >= Number(rule.value);
    case 'lt':
      return Number(fieldValue) < Number(rule.value);
    case 'lte':
      return Number(fieldValue) <= Number(rule.value);
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(fieldValue);
    case 'contains':
      if (Array.isArray(rule.value)) {
        return rule.value.some(val => 
          String(fieldValue).toLowerCase().includes(String(val).toLowerCase())
        );
      }
      return String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'regex':
      return new RegExp(rule.value).test(String(fieldValue));
    default:
      return false;
  }
}

/**
 * Get field value from listing (supports nested fields)
 */
function getFieldValue(listing: CanonicalListing, field: string): any {
  const fields = field.split('.');
  let value: any = listing;
  
  for (const f of fields) {
    if (value && typeof value === 'object' && f in value) {
      value = value[f];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Tag listings with collection memberships
 */
export function tagListingsWithCollections(
  listings: CanonicalListing[],
  collections: CollectionDefinition[]
): Map<string, CollectionSlug[]> {
  const tags = new Map<string, CollectionSlug[]>();
  
  for (const listing of listings) {
    const collectionTags: CollectionSlug[] = [];
    
    for (const collection of collections) {
      if (applyCollectionRules(listing, collection.rules)) {
        collectionTags.push(collection.slug);
      }
    }
    
    tags.set(listing.id, collectionTags);
  }
  
  return tags;
}

/**
 * Tag arbitrage opportunities with collection memberships
 */
export function tagOpportunitiesWithCollections(
  opportunities: ArbitrageOpportunity[],
  collectionTags: Map<string, CollectionSlug[]>
): ArbitrageOpportunity[] {
  return opportunities.map(opportunity => {
    const tags = collectionTags.get(opportunity.canonicalId) || [];
    return {
      ...opportunity,
      collectionTags: tags
    };
  });
}

/**
 * Filter listings by collection
 */
export function filterListingsByCollection(
  listings: CanonicalListing[],
  collectionSlug: CollectionSlug,
  collections: CollectionDefinition[]
): CanonicalListing[] {
  const collection = collections.find(c => c.slug === collectionSlug);
  if (!collection) {
    return [];
  }
  
  return listings.filter(listing => applyCollectionRules(listing, collection.rules));
}

/**
 * Filter opportunities by collection
 */
export function filterOpportunitiesByCollection(
  opportunities: ArbitrageOpportunity[],
  collectionSlug: CollectionSlug
): ArbitrageOpportunity[] {
  return opportunities.filter(opportunity => 
    opportunity.collectionTags.includes(collectionSlug)
  );
}

/**
 * Get collection statistics
 */
export function getCollectionStatistics(
  listings: CanonicalListing[],
  opportunities: ArbitrageOpportunity[],
  collectionSlug: CollectionSlug
): {
  totalListings: number;
  totalOpportunities: number;
  averagePrice: number;
  averageMargin: number;
  totalProfitPotential: number;
  riskDistribution: { low: number; medium: number; high: number };
  topOpportunities: ArbitrageOpportunity[];
} {
  const collectionOpportunities = filterOpportunitiesByCollection(opportunities, collectionSlug);
  
  const averagePrice = listings.length > 0 
    ? listings.reduce((sum, l) => sum + l.price, 0) / listings.length 
    : 0;
  
  const averageMargin = collectionOpportunities.length > 0
    ? collectionOpportunities.reduce((sum, o) => sum + o.marginPct, 0) / collectionOpportunities.length
    : 0;
  
  const totalProfitPotential = collectionOpportunities.reduce((sum, o) => sum + o.netProfit, 0);
  
  const riskDistribution = collectionOpportunities.reduce((acc, o) => {
    acc[o.risk.toLowerCase() as keyof typeof acc]++;
    return acc;
  }, { low: 0, medium: 0, high: 0 });
  
  const topOpportunities = collectionOpportunities
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 10);
  
  return {
    totalListings: listings.length,
    totalOpportunities: collectionOpportunities.length,
    averagePrice: Math.round(averagePrice),
    averageMargin: Math.round(averageMargin * 100) / 100,
    totalProfitPotential: Math.round(totalProfitPotential),
    riskDistribution,
    topOpportunities
  };
}

/**
 * Create custom collection from rules
 */
export function createCustomCollection(
  name: string,
  slug: CollectionSlug,
  description: string,
  rules: CollectionRule[]
): CollectionDefinition {
  return {
    name,
    slug,
    description,
    rules
  };
}

/**
 * Validate collection definition
 */
export function validateCollectionDefinition(collection: CollectionDefinition): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!collection.name || collection.name.trim().length === 0) {
    errors.push('Collection name is required');
  }
  
  if (!collection.slug || collection.slug.trim().length === 0) {
    errors.push('Collection slug is required');
  }
  
  if (!/^[a-z0-9-]+$/.test(collection.slug)) {
    errors.push('Collection slug must contain only lowercase letters, numbers, and hyphens');
  }
  
  if (collection.rules.length === 0) {
    errors.push('At least one rule is required');
  }
  
  for (const rule of collection.rules) {
    if (!rule.field || rule.field.trim().length === 0) {
      errors.push('Rule field is required');
    }
    
    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'regex'];
    if (!validOperators.includes(rule.operator)) {
      errors.push(`Invalid operator: ${rule.operator}`);
    }
    
    if (rule.value === undefined || rule.value === null) {
      errors.push('Rule value is required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get all collection slugs
 */
export function getCollectionSlugs(collections: CollectionDefinition[]): CollectionSlug[] {
  return collections.map(c => c.slug);
}

/**
 * Find collection by slug
 */
export function findCollectionBySlug(
  collections: CollectionDefinition[],
  slug: CollectionSlug
): CollectionDefinition | undefined {
  return collections.find(c => c.slug === slug);
}

/**
 * Check if listing belongs to collection
 */
export function listingBelongsToCollection(
  listing: CanonicalListing,
  collectionSlug: CollectionSlug,
  collections: CollectionDefinition[]
): boolean {
  const collection = findCollectionBySlug(collections, collectionSlug);
  if (!collection) {
    return false;
  }
  
  return applyCollectionRules(listing, collection.rules);
}

/**
 * Get collection membership for a listing
 */
export function getListingCollections(
  listing: CanonicalListing,
  collections: CollectionDefinition[]
): CollectionSlug[] {
  const membership: CollectionSlug[] = [];
  
  for (const collection of collections) {
    if (applyCollectionRules(listing, collection.rules)) {
      membership.push(collection.slug);
    }
  }
  
  return membership;
}

/**
 * Batch process listings for collection membership
 */
export function batchProcessCollectionMembership(
  listings: CanonicalListing[],
  collections: CollectionDefinition[]
): Map<string, CollectionSlug[]> {
  const membership = new Map<string, CollectionSlug[]>();
  
  for (const listing of listings) {
    const listingCollections = getListingCollections(listing, collections);
    membership.set(listing.id, listingCollections);
  }
  
  return membership;
}

/**
 * Create collection from price range
 */
export function createPriceRangeCollection(
  name: string,
  slug: CollectionSlug,
  minPrice: number,
  maxPrice: number
): CollectionDefinition {
  return {
    name,
    slug,
    description: `Cards priced between $${minPrice} and $${maxPrice}`,
    rules: [
      { field: 'price', operator: 'gte', value: minPrice * 100 }, // Convert to cents
      { field: 'price', operator: 'lte', value: maxPrice * 100 }
    ]
  };
}

/**
 * Create collection from Pokemon name
 */
export function createPokemonCollection(
  name: string,
  slug: CollectionSlug,
  pokemonNames: string[]
): CollectionDefinition {
  return {
    name,
    slug,
    description: `Cards featuring ${pokemonNames.join(', ')}`,
    rules: [
      { field: 'cardName', operator: 'in', value: pokemonNames }
    ]
  };
}

/**
 * Create collection from set
 */
export function createSetCollection(
  name: string,
  slug: CollectionSlug,
  setNames: string[]
): CollectionDefinition {
  return {
    name,
    slug,
    description: `Cards from ${setNames.join(', ')} sets`,
    rules: [
      { field: 'setName', operator: 'in', value: setNames }
    ]
  };
}

/**
 * Create collection from grade range
 */
export function createGradeCollection(
  name: string,
  slug: CollectionSlug,
  gradeCompany: string,
  minGrade: number,
  maxGrade: number
): CollectionDefinition {
  return {
    name,
    slug,
    description: `${gradeCompany} graded cards from ${minGrade} to ${maxGrade}`,
    rules: [
      { field: 'gradeCompany', operator: 'eq', value: gradeCompany },
      { field: 'grade', operator: 'gte', value: minGrade },
      { field: 'grade', operator: 'lte', value: maxGrade }
    ]
  };
}

/**
 * Merge collections (union of rules)
 */
export function mergeCollections(
  collections: CollectionDefinition[]
): CollectionDefinition {
  const allRules = collections.flatMap(c => c.rules);
  const names = collections.map(c => c.name).join(', ');
  const slugs = collections.map(c => c.slug).join('-');
  
  return {
    name: `Merged: ${names}`,
    slug: `merged-${slugs}` as CollectionSlug,
    description: `Merged collection containing ${collections.length} sub-collections`,
    rules: allRules
  };
}

/**
 * Get collection overlap (listings that belong to multiple collections)
 */
export function getCollectionOverlap(
  listings: CanonicalListing[],
  collections: CollectionDefinition[]
): Map<string, CollectionSlug[]> {
  const overlap = new Map<string, CollectionSlug[]>();
  
  for (const listing of listings) {
    const listingCollections = getListingCollections(listing, collections);
    if (listingCollections.length > 1) {
      overlap.set(listing.id, listingCollections);
    }
  }
  
  return overlap;
}

/**
 * Calculate collection intersection
 */
export function calculateCollectionIntersection(
  collection1: CollectionSlug,
  collection2: CollectionSlug,
  collections: CollectionDefinition[]
): CollectionDefinition {
  const col1 = findCollectionBySlug(collections, collection1);
  const col2 = findCollectionBySlug(collections, collection2);
  
  if (!col1 || !col2) {
    throw new Error('One or both collections not found');
  }
  
  return {
    name: `${col1.name} ∩ ${col2.name}`,
    slug: `${collection1}-intersection-${collection2}` as CollectionSlug,
    description: `Intersection of ${col1.name} and ${col2.name}`,
    rules: [...col1.rules, ...col2.rules]
  };
}
