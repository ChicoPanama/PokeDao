// Price normalization and outlier detection utilities
// Provides consistent price handling across all marketplaces

import { CanonicalListing, PriceNormalization } from './types';
import { normalizePrice as normalizeCurrency, DEFAULT_CURRENCY } from './currency';

// Price range definitions for outlier detection
interface PriceRange {
  min: number;
  max: number;
  category: string;
}

const PRICE_RANGES: PriceRange[] = [
  { min: 0, max: 100, category: 'Budget' },
  { min: 100, max: 500, category: 'Common' },
  { min: 500, max: 1000, category: 'Uncommon' },
  { min: 1000, max: 5000, category: 'Rare' },
  { min: 5000, max: 10000, category: 'Very Rare' },
  { min: 10000, max: 25000, category: 'Ultra Rare' },
  { min: 25000, max: 100000, category: 'Legendary' },
  { min: 100000, max: 1000000, category: 'Mythic' },
  { min: 1000000, max: Infinity, category: 'Extreme' }
];

// Outlier detection thresholds
const OUTLIER_THRESHOLDS = {
  min: 1,           // Minimum realistic price in USD cents
  max: 10000000,    // Maximum realistic price in USD cents (100k USD)
  extremeMin: 0.01, // Extreme minimum (likely error)
  extremeMax: 100000000 // Extreme maximum (likely error)
};

/**
 * Normalize price with comprehensive validation
 */
export function normalizePrice(
  price: number,
  currency: string = DEFAULT_CURRENCY,
  context?: {
    pokemonName?: string;
    setCode?: string;
    grade?: number;
    condition?: string;
  }
): PriceNormalization {
  const issues: string[] = [];
  let confidence = 1.0;

  // Validate price
  if (!Number.isFinite(price)) {
    return {
      originalPrice: price,
      normalizedPrice: 0,
      currency: DEFAULT_CURRENCY,
      isValid: false,
      issues: ['Invalid price value'],
      confidence: 0
    };
  }

  if (price < 0) {
    issues.push('Negative price');
    confidence = 0;
  }

  // Check for extreme outliers
  if (price < OUTLIER_THRESHOLDS.extremeMin) {
    return {
      originalPrice: price,
      normalizedPrice: 0,
      currency: DEFAULT_CURRENCY,
      isValid: false,
      issues: ['Extremely low price (likely error)'],
      confidence: 0
    };
  }

  if (price > OUTLIER_THRESHOLDS.extremeMax) {
    return {
      originalPrice: price,
      normalizedPrice: 0,
      currency: DEFAULT_CURRENCY,
      isValid: false,
      issues: ['Extremely high price (likely error)'],
      confidence: 0
    };
  }

  // Convert to USD cents
  let normalizedPrice: number;
  let exchangeRate: number | undefined;

  try {
    const result = normalizeCurrency(price, currency, {
      minPrice: OUTLIER_THRESHOLDS.min / 100,
      maxPrice: OUTLIER_THRESHOLDS.max / 100
    });
    
    normalizedPrice = result.normalizedPrice;
    exchangeRate = result.exchangeRate;
    issues.push(...result.issues);
    confidence *= result.confidence;
  } catch (error) {
    issues.push(`Currency conversion failed: ${error}`);
    normalizedPrice = 0;
    confidence = 0;
  }

  // Context-specific validation
  if (context) {
    const contextIssues = validatePriceContext(normalizedPrice, context);
    issues.push(...contextIssues.issues);
    confidence *= contextIssues.confidence;
  }

  // Check for precision issues
  const priceStr = price.toString();
  if (priceStr.includes('.') && priceStr.split('.')[1].length > 2) {
    issues.push('Excessive decimal precision');
    confidence -= 0.1;
  }

  return {
    originalPrice: price,
    normalizedPrice,
    currency: DEFAULT_CURRENCY,
    exchangeRate,
    isValid: issues.length === 0,
    issues,
    confidence: Math.max(0, confidence)
  };
}

/**
 * Validate price against context (Pokemon name, grade, etc.)
 */
export function validatePriceContext(
  priceUSD: number,
  context: {
    pokemonName?: string;
    setCode?: string;
    grade?: number;
    condition?: string;
  }
): { issues: string[]; confidence: number } {
  const issues: string[] = [];
  let confidence = 1.0;

  // High-grade Charizard cards can be very expensive
  if (context.pokemonName?.toLowerCase() === 'charizard' && 
      context.grade && 
      context.grade >= 9) {
    if (priceUSD > 50000000) { // 500k USD
      issues.push('Unrealistically high price for Charizard');
      confidence -= 0.3;
    }
  }

  // PSA 10 cards of popular Pokemon can be expensive
  if (context.grade === 10 && 
      ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia'].includes(context.pokemonName?.toLowerCase() || '')) {
    if (priceUSD > 10000000) { // 100k USD
      issues.push('Unrealistically high price for PSA 10');
      confidence -= 0.2;
    }
  }

  // Damaged cards should be relatively cheap
  if (context.condition?.toLowerCase().includes('damaged') && priceUSD > 100000) { // 1k USD
    issues.push('High price for damaged card');
    confidence -= 0.4;
  }

  // Poor condition cards should be very cheap
  if (context.condition?.toLowerCase().includes('poor') && priceUSD > 10000) { // 100 USD
    issues.push('High price for poor condition card');
    confidence -= 0.5;
  }

  // Vintage cards (pre-2000) can be expensive
  const vintageSets = ['BS1', 'JU', 'FO', 'TR', 'GH', 'GC'];
  if (context.setCode && vintageSets.includes(context.setCode) && priceUSD < 100) { // Less than $1
    issues.push('Unrealistically low price for vintage card');
    confidence -= 0.3;
  }

  return { issues, confidence };
}

/**
 * Get price category for a given price
 */
export function getPriceCategory(priceUSD: number): string {
  for (const range of PRICE_RANGES) {
    if (priceUSD >= range.min && priceUSD < range.max) {
      return range.category;
    }
  }
  return 'Unknown';
}

/**
 * Detect price outliers using statistical methods
 */
export function detectOutliers(prices: number[]): {
  outliers: number[];
  mean: number;
  standardDeviation: number;
  threshold: number;
} {
  if (prices.length === 0) {
    return {
      outliers: [],
      mean: 0,
      standardDeviation: 0,
      threshold: 0
    };
  }

  // Calculate mean and standard deviation
  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
  const standardDeviation = Math.sqrt(variance);

  // Use 2 standard deviations as threshold for outliers
  const threshold = 2 * standardDeviation;
  
  // Find outliers
  const outliers = prices.filter(price => Math.abs(price - mean) > threshold);

  return {
    outliers,
    mean,
    standardDeviation,
    threshold
  };
}

/**
 * Calculate price statistics
 */
export function calculatePriceStatistics(prices: number[]): {
  count: number;
  mean: number;
  median: number;
  mode: string;
  min: number;
  max: number;
  range: number;
  standardDeviation: number;
  outliers: number[];
  categories: Record<string, number>;
} {
  if (prices.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      mode: 'Unknown',
      min: 0,
      max: 0,
      range: 0,
      standardDeviation: 0,
      outliers: [],
      categories: {}
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const count = prices.length;
  const mean = prices.reduce((sum, p) => sum + p, 0) / count;
  const median = count % 2 === 0 
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];
  
  // Calculate mode (most frequent price category)
  const categoryCounts: Record<string, number> = {};
  prices.forEach(price => {
    const category = getPriceCategory(price);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });
  const mode = Object.keys(categoryCounts).reduce((a, b) => 
    categoryCounts[a] > categoryCounts[b] ? a : b
  );

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  // Calculate standard deviation
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / count;
  const standardDeviation = Math.sqrt(variance);

  // Find outliers
  const outlierResult = detectOutliers(prices);

  // Calculate category distribution
  const categories: Record<string, number> = {};
  prices.forEach(price => {
    const category = getPriceCategory(price);
    categories[category] = (categories[category] || 0) + 1;
  });

  return {
    count,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    mode,
    min,
    max,
    range,
    standardDeviation: Math.round(standardDeviation * 100) / 100,
    outliers: outlierResult.outliers,
    categories
  };
}

/**
 * Normalize prices for a batch of listings
 */
export function batchNormalizePrices(
  listings: CanonicalListing[]
): Array<{ listing: CanonicalListing; normalization: PriceNormalization }> {
  return listings.map(listing => ({
    listing,
    normalization: normalizePrice(listing.price, listing.currency, {
      pokemonName: listing.cardName,
      setCode: listing.setName,
      grade: listing.grade ?? undefined,
      condition: listing.condition
    })
  }));
}

/**
 * Filter listings by price range
 */
export function filterByPriceRange(
  listings: CanonicalListing[],
  minPrice: number,
  maxPrice: number
): CanonicalListing[] {
  return listings.filter(listing => 
    listing.price >= minPrice && listing.price <= maxPrice
  );
}

/**
 * Filter listings by price category
 */
export function filterByPriceCategory(
  listings: CanonicalListing[],
  category: string
): CanonicalListing[] {
  return listings.filter(listing => {
    const listingCategory = getPriceCategory(listing.price);
    return listingCategory === category;
  });
}

/**
 * Calculate price trend over time
 */
export function calculatePriceTrend(
  historicalPrices: Array<{ date: Date; price: number }>
): {
  trend: 'rising' | 'falling' | 'stable';
  percentageChange: number;
  volatility: number;
} {
  if (historicalPrices.length < 2) {
    return {
      trend: 'stable',
      percentageChange: 0,
      volatility: 0
    };
  }

  const sorted = historicalPrices.sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstPrice = sorted[0].price;
  const lastPrice = sorted[sorted.length - 1].price;
  
  const percentageChange = ((lastPrice - firstPrice) / firstPrice) * 100;
  
  // Calculate volatility (standard deviation of price changes)
  const priceChanges = [];
  for (let i = 1; i < sorted.length; i++) {
    const change = ((sorted[i].price - sorted[i - 1].price) / sorted[i - 1].price) * 100;
    priceChanges.push(change);
  }
  
  const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
  const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / priceChanges.length;
  const volatility = Math.sqrt(variance);

  let trend: 'rising' | 'falling' | 'stable';
  if (Math.abs(percentageChange) < 5) {
    trend = 'stable';
  } else if (percentageChange > 0) {
    trend = 'rising';
  } else {
    trend = 'falling';
  }

  return {
    trend,
    percentageChange: Math.round(percentageChange * 100) / 100,
    volatility: Math.round(volatility * 100) / 100
  };
}

/**
 * Calculate price percentiles
 */
export function calculatePricePercentiles(prices: number[]): {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
} {
  const sorted = [...prices].sort((a, b) => a - b);
  const length = sorted.length;

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * length) - 1;
    return sorted[Math.max(0, Math.min(index, length - 1))];
  };

  return {
    p10: percentile(10),
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99)
  };
}

/**
 * Compare prices across listings
 */
export function comparePrices(
  listings: CanonicalListing[],
  referencePrice?: number
): Array<{
  listing: CanonicalListing;
  priceDifference: number;
  priceDifferencePercent: number;
  isOutlier: boolean;
}> {
  const prices = listings.map(l => l.price);
  const stats = calculatePriceStatistics(prices);
  const meanPrice = stats.mean;
  
  const reference = referencePrice || meanPrice;
  
  return listings.map(listing => {
    const difference = listing.price - reference;
    const differencePercent = (difference / reference) * 100;
    
    // Consider it an outlier if it's more than 2 standard deviations from the mean
    const isOutlier = Math.abs(listing.price - meanPrice) > (2 * stats.standardDeviation);
    
    return {
      listing,
      priceDifference: Math.round(difference),
      priceDifferencePercent: Math.round(differencePercent * 100) / 100,
      isOutlier
    };
  });
}

/**
 * Validate price normalization result
 */
export function validatePriceNormalization(normalization: PriceNormalization): boolean {
  return (
    Number.isFinite(normalization.originalPrice) &&
    Number.isFinite(normalization.normalizedPrice) &&
    normalization.normalizedPrice >= 0 &&
    normalization.confidence >= 0 &&
    normalization.confidence <= 1
  );
}

/**
 * Format price for display
 */
export function formatPrice(priceUSD: number, showCents: boolean = true): string {
  const dollars = priceUSD / 100;
  
  if (showCents) {
    return `$${dollars.toFixed(2)}`;
  } else {
    return `$${Math.round(dollars)}`;
  }
}

/**
 * Get price range for a category
 */
export function getPriceRangeForCategory(category: string): { min: number; max: number } | undefined {
  const range = PRICE_RANGES.find(r => r.category === category);
  return range ? { min: range.min, max: range.max } : undefined;
}

/**
 * Check if price is realistic for context
 */
export function isRealisticPrice(
  priceUSD: number,
  context: {
    pokemonName?: string;
    setCode?: string;
    grade?: number;
    condition?: string;
  }
): boolean {
  const validation = validatePriceContext(priceUSD, context);
  return validation.confidence > 0.5 && validation.issues.length === 0;
}
