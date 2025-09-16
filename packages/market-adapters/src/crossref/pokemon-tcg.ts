// Pokemon TCG API cross-reference integration
// Provides market validation and pricing data from Pokemon TCG API

import axios from 'axios';
import { 
  CanonicalListing, 
  CrossReferenceData,
  CrossReferenceError 
} from '@pokedao/market-core';

// Pokemon TCG API interfaces
interface PokemonTCGCard {
  id: string;
  name: string;
  nationalPokedexNumbers: number[];
  images: {
    small: string;
    large: string;
  };
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    updatedAt: string;
  };
  number: string;
  rarity: string;
  subtypes: string[];
  types: string[];
  hp?: string;
  attacks?: any[];
  weaknesses?: any[];
  resistances?: any[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  level?: string;
  abilities?: any[];
  ancientTrait?: any;
  evolvesFrom?: string;
  evolvesTo?: string[];
  regulationMark?: string;
  legalities: {
    unlimited: string;
    standard?: string;
    expanded?: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      holofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      normal?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      reverseHolofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
    };
  };
}

interface PokemonTCGResponse {
  data: PokemonTCGCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

// Pokemon TCG API configuration
const POKEMON_TCG_API_BASE = 'https://api.pokemontcg.io/v2';
const POKEMON_TCG_API_KEY = process.env.POKEMON_TCG_API_KEY;

// Cache for API responses
const apiCache = new Map<string, { data: PokemonTCGCard[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Search Pokemon TCG API for card data
 */
export async function searchPokemonTCG(
  cardName: string,
  options: {
    set?: string;
    limit?: number;
    useCache?: boolean;
  } = {}
): Promise<PokemonTCGCard[]> {
  const { set, limit = 50, useCache = true } = options;
  
  // Create cache key
  const cacheKey = `${cardName}:${set || 'all'}:${limit}`;
  
  // Check cache first
  if (useCache && apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }
  
  try {
    // Build search query
    let query = `name:"${cardName}"`;
    if (set) {
      query += ` set.name:"${set}"`;
    }
    
    const params = new URLSearchParams({
      q: query,
      pageSize: limit.toString()
    });
    
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    if (POKEMON_TCG_API_KEY) {
      headers['X-Api-Key'] = POKEMON_TCG_API_KEY;
    }
    
    const response = await axios.get<PokemonTCGResponse>(
      `${POKEMON_TCG_API_BASE}/cards?${params}`,
      { headers }
    );
    
    const cards = response.data.data;
    
    // Cache the results
    if (useCache) {
      apiCache.set(cacheKey, {
        data: cards,
        timestamp: Date.now()
      });
    }
    
    return cards;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new CrossReferenceError(
        `Pokemon TCG API error: ${error.message}`,
        undefined,
        { status: error.response?.status, data: error.response?.data }
      );
    }
    throw new CrossReferenceError(`Failed to search Pokemon TCG API: ${error}`);
  }
}

/**
 * Cross-reference listing with Pokemon TCG API
 */
export async function crossReferenceListing(
  listing: CanonicalListing
): Promise<CrossReferenceData> {
  if (!listing.cardName) {
    return {
      matchConfidence: 0,
      matchType: 'none',
      discrepancies: ['Missing card name']
    };
  }
  
  try {
    const cards = await searchPokemonTCG(listing.cardName, {
      set: listing.setName,
      limit: 20
    });
    
    if (cards.length === 0) {
      return {
        matchConfidence: 0,
        matchType: 'none',
        discrepancies: ['No matching cards found']
      };
    }
    
    // Find best match
    const bestMatch = findBestMatch(listing, cards);
    
    if (!bestMatch) {
      return {
        matchConfidence: 0,
        matchType: 'none',
        discrepancies: ['No suitable match found']
      };
    }
    
    // Extract pricing data
    const tcgPlayerData = extractTCGPlayerData(bestMatch);
    
    // Calculate match confidence
    const matchConfidence = calculateMatchConfidence(listing, bestMatch);
    
    // Determine match type
    const matchType = determineMatchType(listing, bestMatch, matchConfidence);
    
    // Generate discrepancies
    const discrepancies = generateDiscrepancies(listing, bestMatch);
    
    return {
      pokemonTcgId: bestMatch.id,
      tcgPlayerData,
      matchConfidence,
      matchType,
      discrepancies
    };
  } catch (error) {
    throw new CrossReferenceError(
      `Failed to cross-reference listing: ${error}`,
      listing.source,
      { listingId: listing.id, error }
    );
  }
}

/**
 * Find best matching card from API results
 */
function findBestMatch(listing: CanonicalListing, cards: PokemonTCGCard[]): PokemonTCGCard | null {
  let bestMatch: PokemonTCGCard | null = null;
  let bestScore = 0;
  
  for (const card of cards) {
    const score = calculateMatchScore(listing, card);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }
  
  return bestScore > 0.3 ? bestMatch : null; // Minimum confidence threshold
}

/**
 * Calculate match score between listing and card
 */
function calculateMatchScore(listing: CanonicalListing, card: PokemonTCGCard): number {
  let score = 0;
  
  // Name matching (highest weight)
  if (listing.cardName && card.name.toLowerCase().includes(listing.cardName.toLowerCase())) {
    score += 0.5;
  }
  
  // Set matching
  if (listing.setName && card.set.name.toLowerCase().includes(listing.setName.toLowerCase())) {
    score += 0.3;
  }
  
  // Card number matching
  if (listing.cardNumber && card.number === listing.cardNumber) {
    score += 0.2;
  }
  
  return score;
}

/**
 * Extract TCGPlayer pricing data from card
 */
function extractTCGPlayerData(card: PokemonTCGCard): CrossReferenceData['tcgPlayerData'] {
  if (!card.tcgplayer?.prices) {
    return undefined;
  }
  
  const prices = card.tcgplayer.prices;
  
  // Prioritize holofoil prices, then normal, then reverse holofoil
  const priceData = prices.holofoil || prices.normal || prices.reverseHolofoil;
  
  if (!priceData) {
    return undefined;
  }
  
  return {
    marketPrice: priceData.market,
    lowPrice: priceData.low,
    highPrice: priceData.high,
    midPrice: priceData.mid
  };
}

/**
 * Calculate match confidence
 */
function calculateMatchConfidence(listing: CanonicalListing, card: PokemonTCGCard): number {
  let confidence = 0;
  
  // Name match
  if (listing.cardName && card.name.toLowerCase() === listing.cardName.toLowerCase()) {
    confidence += 0.4;
  } else if (listing.cardName && card.name.toLowerCase().includes(listing.cardName.toLowerCase())) {
    confidence += 0.2;
  }
  
  // Set match
  if (listing.setName && card.set.name.toLowerCase().includes(listing.setName.toLowerCase())) {
    confidence += 0.3;
  }
  
  // Number match
  if (listing.cardNumber && card.number === listing.cardNumber) {
    confidence += 0.3;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * Determine match type
 */
function determineMatchType(
  listing: CanonicalListing, 
  card: PokemonTCGCard, 
  confidence: number
): CrossReferenceData['matchType'] {
  if (confidence >= 0.8) {
    return 'exact';
  } else if (confidence >= 0.6) {
    return 'fuzzy';
  } else if (confidence >= 0.3) {
    return 'partial';
  } else {
    return 'none';
  }
}

/**
 * Generate discrepancies between listing and card
 */
function generateDiscrepancies(listing: CanonicalListing, card: PokemonTCGCard): string[] {
  const discrepancies: string[] = [];
  
  // Name discrepancies
  if (listing.cardName && card.name.toLowerCase() !== listing.cardName.toLowerCase()) {
    discrepancies.push(`Name mismatch: "${listing.cardName}" vs "${card.name}"`);
  }
  
  // Set discrepancies
  if (listing.setName && !card.set.name.toLowerCase().includes(listing.setName.toLowerCase())) {
    discrepancies.push(`Set mismatch: "${listing.setName}" vs "${card.set.name}"`);
  }
  
  // Number discrepancies
  if (listing.cardNumber && card.number !== listing.cardNumber) {
    discrepancies.push(`Number mismatch: "${listing.cardNumber}" vs "${card.number}"`);
  }
  
  return discrepancies;
}

/**
 * Batch cross-reference multiple listings
 */
export async function batchCrossReference(
  listings: CanonicalListing[],
  options: {
    concurrency?: number;
    useCache?: boolean;
  } = {}
): Promise<Map<string, CrossReferenceData>> {
  const { concurrency = 5, useCache = true } = options;
  const results = new Map<string, CrossReferenceData>();
  
  // Process listings in batches to avoid rate limiting
  for (let i = 0; i < listings.length; i += concurrency) {
    const batch = listings.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (listing) => {
      try {
        const crossRefData = await crossReferenceListing(listing);
        results.set(listing.id, crossRefData);
      } catch (error) {
        // Log error but continue with other listings
        console.error(`Failed to cross-reference listing ${listing.id}:`, error);
        results.set(listing.id, {
          matchConfidence: 0,
          matchType: 'none',
          discrepancies: ['Cross-reference failed']
        });
      }
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches to be respectful to the API
    if (i + concurrency < listings.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Clear API cache
 */
export function clearCache(): void {
  apiCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: string[];
} {
  return {
    size: apiCache.size,
    entries: Array.from(apiCache.keys())
  };
}

/**
 * Validate Pokemon TCG API connection
 */
export async function validateConnection(): Promise<boolean> {
  try {
    await searchPokemonTCG('charizard', { limit: 1 });
    return true;
  } catch (error) {
    console.error('Pokemon TCG API validation failed:', error);
    return false;
  }
}
