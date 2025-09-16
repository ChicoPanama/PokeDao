// eBay marketplace adapter
// Migrates existing eBay components into the unified adapter pattern

import { Database } from 'better-sqlite3';
import { 
  MarketSource, 
  CanonicalListing, 
  MarketAdapter,
  CrossReferenceData 
} from '@pokedao/market-core';
import { parseTitle, calculateParsingConfidence } from '@pokedao/market-core/src/parsing';
import { normalizePrice } from '@pokedao/market-core/src/price';
import { calculateFees } from '@pokedao/market-core/src/fees';

// eBay-specific interfaces
interface EBayRawListing {
  id: number;
  ebay_item_id: string;
  title: string;
  current_price?: number;
  buy_it_now_price?: number;
  condition_description?: string;
  grading_company?: string;
  grade_number?: string;
  seller_name?: string;
  seller_feedback?: number;
  shipping_cost?: number;
  location?: string;
  watchers_count?: number;
  bid_count?: number;
  listing_type?: string;
  ebay_url?: string;
  pokemon_name?: string;
  set_name?: string;
  card_number?: string;
  rarity?: string;
  created_at: string;
  last_updated: string;
}

interface EBayCleanedListing extends EBayRawListing {
  cleaned_set_name?: string;
  cleaned_set_code?: string;
  cleaned_card_number?: string;
  cleaned_pokemon_name?: string;
  cleaned_grading_company?: string;
  cleaned_grade_number?: string;
  cleaned_price?: number;
  cleaned_currency?: string;
  cleaned_condition?: string;
  cleaned_variant?: string;
  generated_ebay_url?: string;
  confidence_score?: number;
  data_quality_score?: number;
  parser_confidence?: number;
}

// eBay adapter implementation
export const SOURCE: MarketSource = MarketSource.EBAY;

/**
 * Ingest raw eBay data from database
 */
export async function ingest(options: { since?: Date; limit?: number } = {}): Promise<EBayRawListing[]> {
  const { since, limit } = options;
  
  try {
    // Connect to eBay database
    const db = new Database('research/tcgplayer-discovery/collector_crypt_ebay_complete.db');
    
    let query = `
      SELECT * FROM ebay_current_listings_cleaned
      WHERE confidence_score > 0.5
    `;
    
    const params: any[] = [];
    
    if (since) {
      query += ` AND created_at >= ?`;
      params.push(since.toISOString());
    }
    
    query += ` ORDER BY confidence_score DESC`;
    
    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }
    
    const listings = db.prepare(query).all(...params);
    db.close();
    
    return listings as EBayRawListing[];
  } catch (error) {
    throw new Error(`Failed to ingest eBay data: ${error}`);
  }
}

/**
 * Map eBay raw data to canonical format
 */
export function map(raw: EBayRawListing): CanonicalListing {
  const cleaned = raw as EBayCleanedListing;
  
  // Use cleaned data if available, otherwise parse from title
  let cardName = cleaned.cleaned_pokemon_name;
  let setName = cleaned.cleaned_set_name;
  let setCode = cleaned.cleaned_set_code;
  let cardNumber = cleaned.cleaned_card_number;
  let gradeCompany = cleaned.cleaned_grading_company;
  let grade = cleaned.cleaned_grade_number;
  let condition = cleaned.cleaned_condition;
  let variant = cleaned.cleaned_variant;
  
  // Parse title if cleaned data is missing
  if (!cardName || !setName || !cardNumber) {
    const parsed = parseTitle(cleaned.title);
    cardName = cardName || parsed.cardName;
    setName = setName || parsed.setName;
    cardNumber = cardNumber || parsed.cardNumber;
    gradeCompany = gradeCompany || parsed.gradeCompany;
    grade = grade || parsed.grade;
    condition = condition || parsed.condition;
    variant = variant || parsed.variant;
  }
  
  // Determine final price
  const finalPrice = cleaned.cleaned_price || 
                    cleaned.current_price || 
                    cleaned.buy_it_now_price || 0;
  
  // Normalize price to USD cents
  const priceNormalization = normalizePrice(finalPrice, cleaned.cleaned_currency || 'USD');
  
  // Generate eBay URL if missing
  const ebayUrl = cleaned.generated_ebay_url || 
                  cleaned.ebay_url || 
                  `https://www.ebay.com/itm/${cleaned.ebay_item_id}`;
  
  // Calculate data quality score
  const dataQualityScore = cleaned.data_quality_score || 
                          calculateDataQualityScore(cleaned);
  
  return {
    id: `${SOURCE}:${cleaned.ebay_item_id}`,
    source: SOURCE,
    sourceId: cleaned.ebay_item_id,
    title: cleaned.title,
    rawTitle: cleaned.title,
    cardName,
    setName,
    cardNumber,
    variant,
    gradeCompany: gradeCompany as any,
    grade: grade ? parseFloat(grade.toString()) : null,
    condition,
    price: priceNormalization.normalizedPrice,
    currency: 'USD',
    shipping: cleaned.shipping_cost ? Math.round(cleaned.shipping_cost * 100) : undefined,
    location: cleaned.location,
    listedAt: new Date(cleaned.created_at),
    url: ebayUrl,
    dataQualityScore,
    createdAt: new Date(cleaned.created_at),
    updatedAt: new Date(cleaned.last_updated)
  };
}

/**
 * Calculate eBay platform fees
 */
export function fees(listing: CanonicalListing): number {
  return calculateFees(listing, {
    includeShipping: false, // Shipping is separate
    domesticShipping: true
  }).totalFees;
}

/**
 * Parse eBay title to extract structured data
 */
export function parseTitle(title: string): Partial<CanonicalListing> {
  return parseTitle(title);
}

/**
 * Validate eBay listing data quality
 */
export function validate(listing: CanonicalListing): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check required fields
  if (!listing.sourceId) {
    issues.push('Missing eBay item ID');
  }
  
  if (!listing.title || listing.title.trim().length === 0) {
    issues.push('Missing title');
  }
  
  if (listing.price <= 0) {
    issues.push('Invalid price');
  }
  
  if (listing.price > 10000000) { // $100k USD
    issues.push('Unrealistically high price');
  }
  
  // Check data completeness
  if (!listing.cardName) {
    issues.push('Missing Pokemon name');
  }
  
  if (!listing.setName) {
    issues.push('Missing set name');
  }
  
  if (!listing.cardNumber) {
    issues.push('Missing card number');
  }
  
  // Check URL validity
  if (listing.url && !listing.url.includes('ebay.com')) {
    issues.push('Invalid eBay URL');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Calculate data quality score for eBay listing
 */
function calculateDataQualityScore(listing: EBayCleanedListing): number {
  let score = 0;
  
  // Base score from parser confidence
  if (listing.parser_confidence) {
    score += listing.parser_confidence * 0.3;
  }
  
  // Completeness score
  const fields = [
    listing.cleaned_pokemon_name,
    listing.cleaned_set_name,
    listing.cleaned_card_number,
    listing.cleaned_grading_company,
    listing.cleaned_grade_number,
    listing.generated_ebay_url
  ];
  
  const completedFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
  score += (completedFields / fields.length) * 0.4;
  
  // Price reasonableness
  const price = listing.cleaned_price || listing.current_price || listing.buy_it_now_price;
  if (price && price > 0 && price < 100000) { // Less than $1000 USD
    score += 0.2;
  }
  
  // Seller credibility
  if (listing.seller_feedback && listing.seller_feedback > 100) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Get eBay listing statistics
 */
export async function getStatistics(): Promise<{
  totalListings: number;
  cleanedListings: number;
  averageConfidence: number;
  qualityDistribution: Record<string, number>;
}> {
  try {
    const db = new Database('research/tcgplayer-discovery/collector_crypt_ebay_complete.db');
    
    // Get total listings
    const totalListings = db.prepare('SELECT COUNT(*) as count FROM ebay_current_listings').get().count;
    
    // Get cleaned listings
    const cleanedListings = db.prepare('SELECT COUNT(*) as count FROM ebay_current_listings_cleaned').get().count;
    
    // Get average confidence
    const avgConfidence = db.prepare(`
      SELECT AVG(confidence_score) as avg_confidence 
      FROM ebay_current_listings_cleaned 
      WHERE confidence_score IS NOT NULL
    `).get().avg_confidence || 0;
    
    // Get quality distribution
    const qualityStats = db.prepare(`
      SELECT 
        CASE 
          WHEN confidence_score >= 0.8 THEN 'excellent'
          WHEN confidence_score >= 0.6 THEN 'good'
          WHEN confidence_score >= 0.4 THEN 'fair'
          ELSE 'poor'
        END as quality,
        COUNT(*) as count
      FROM ebay_current_listings_cleaned
      WHERE confidence_score IS NOT NULL
      GROUP BY quality
    `).all();
    
    const qualityDistribution: Record<string, number> = {};
    for (const stat of qualityStats) {
      qualityDistribution[stat.quality] = stat.count;
    }
    
    db.close();
    
    return {
      totalListings,
      cleanedListings,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
      qualityDistribution
    };
  } catch (error) {
    throw new Error(`Failed to get eBay statistics: ${error}`);
  }
}

/**
 * Get eBay listings by Pokemon name
 */
export async function getListingsByPokemon(pokemonName: string, limit: number = 100): Promise<EBayCleanedListing[]> {
  try {
    const db = new Database('research/tcgplayer-discovery/collector_crypt_ebay_complete.db');
    
    const listings = db.prepare(`
      SELECT * FROM ebay_current_listings_cleaned
      WHERE cleaned_pokemon_name = ? OR pokemon_name = ?
      ORDER BY confidence_score DESC
      LIMIT ?
    `).all(pokemonName.toLowerCase(), pokemonName.toLowerCase(), limit);
    
    db.close();
    
    return listings as EBayCleanedListing[];
  } catch (error) {
    throw new Error(`Failed to get eBay listings for ${pokemonName}: ${error}`);
  }
}

/**
 * Get eBay listings by set
 */
export async function getListingsBySet(setName: string, limit: number = 100): Promise<EBayCleanedListing[]> {
  try {
    const db = new Database('research/tcgplayer-discovery/collector_crypt_ebay_complete.db');
    
    const listings = db.prepare(`
      SELECT * FROM ebay_current_listings_cleaned
      WHERE cleaned_set_name LIKE ? OR set_name LIKE ?
      ORDER BY confidence_score DESC
      LIMIT ?
    `).all(`%${setName}%`, `%${setName}%`, limit);
    
    db.close();
    
    return listings as EBayCleanedListing[];
  } catch (error) {
    throw new Error(`Failed to get eBay listings for set ${setName}: ${error}`);
  }
}

/**
 * Get eBay listings by price range
 */
export async function getListingsByPriceRange(
  minPrice: number, 
  maxPrice: number, 
  limit: number = 100
): Promise<EBayCleanedListing[]> {
  try {
    const db = new Database('research/tcgplayer-discovery/collector_crypt_ebay_complete.db');
    
    const listings = db.prepare(`
      SELECT * FROM ebay_current_listings_cleaned
      WHERE cleaned_price >= ? AND cleaned_price <= ?
      ORDER BY confidence_score DESC
      LIMIT ?
    `).all(minPrice, maxPrice, limit);
    
    db.close();
    
    return listings as EBayCleanedListing[];
  } catch (error) {
    throw new Error(`Failed to get eBay listings for price range ${minPrice}-${maxPrice}: ${error}`);
  }
}

// Export the adapter
export const ebayAdapter: MarketAdapter = {
  SOURCE,
  ingest,
  map,
  fees,
  parseTitle,
  validate
};

export default ebayAdapter;
