// Source-agnostic data normalization
// Provides unified data cleaning and quality assessment across all marketplaces

import { 
  CanonicalListing, 
  QualityAssessment,
  MarketSource,
  AdapterError 
} from '@pokedao/market-core';
import { normalizePrice } from '@pokedao/market-core/src/price';
import { calculateParsingConfidence } from '@pokedao/market-core/src/parsing';
import { calculateConfidenceScore } from '@pokedao/market-core/src/risk';

/**
 * Normalize listing data across all sources
 */
export function normalizeListing(listing: CanonicalListing): CanonicalListing {
  // Normalize price if not already normalized
  if (listing.currency !== 'USD') {
    const priceNormalization = normalizePrice(listing.price, listing.currency);
    listing.price = priceNormalization.normalizedPrice;
    listing.currency = 'USD';
  }
  
  // Ensure price is in cents
  if (listing.price < 1000) { // Assume it's in dollars if less than $10
    listing.price = Math.round(listing.price * 100);
  }
  
  // Normalize text fields
  listing.title = normalizeText(listing.title);
  listing.rawTitle = normalizeText(listing.rawTitle);
  listing.cardName = listing.cardName ? normalizeText(listing.cardName) : undefined;
  listing.setName = listing.setName ? normalizeText(listing.setName) : undefined;
  listing.cardNumber = listing.cardNumber ? normalizeText(listing.cardNumber) : undefined;
  listing.condition = listing.condition ? normalizeText(listing.condition) : undefined;
  listing.location = listing.location ? normalizeText(listing.location) : undefined;
  
  // Calculate data quality score if not present
  if (!listing.dataQualityScore) {
    listing.dataQualityScore = calculateDataQualityScore(listing);
  }
  
  return listing;
}

/**
 * Normalize text field
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s\-\.\,\:\;]/g, '') // Remove special characters except common punctuation
    .trim();
}

/**
 * Calculate data quality score for a listing
 */
export function calculateDataQualityScore(listing: CanonicalListing): number {
  let score = 0;
  
  // Required fields (40% of score)
  if (listing.sourceId) score += 0.1;
  if (listing.title && listing.title.trim().length > 0) score += 0.1;
  if (listing.price > 0) score += 0.1;
  if (listing.url && isValidUrl(listing.url)) score += 0.1;
  
  // Optional but valuable fields (40% of score)
  if (listing.cardName) score += 0.1;
  if (listing.setName) score += 0.1;
  if (listing.cardNumber) score += 0.1;
  if (listing.gradeCompany) score += 0.05;
  if (listing.grade !== null && listing.grade !== undefined) score += 0.05;
  
  // Additional quality indicators (20% of score)
  if (listing.condition) score += 0.05;
  if (listing.location) score += 0.05;
  if (listing.listedAt) score += 0.05;
  if (listing.shipping !== undefined) score += 0.05;
  
  return Math.min(score, 1.0);
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Assess data quality for a batch of listings
 */
export function assessDataQuality(listings: CanonicalListing[]): QualityAssessment {
  if (listings.length === 0) {
    return {
      overallScore: 0,
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      freshness: 0,
      issues: ['No data to assess'],
      recommendations: ['Collect more data']
    };
  }
  
  // Calculate completeness
  const completeness = calculateCompleteness(listings);
  
  // Calculate accuracy
  const accuracy = calculateAccuracy(listings);
  
  // Calculate consistency
  const consistency = calculateConsistency(listings);
  
  // Calculate freshness
  const freshness = calculateFreshness(listings);
  
  // Overall score (weighted average)
  const overallScore = (completeness * 0.3) + (accuracy * 0.3) + (consistency * 0.2) + (freshness * 0.2);
  
  // Identify issues
  const issues = identifyIssues(listings);
  
  // Generate recommendations
  const recommendations = generateRecommendations(listings, issues);
  
  return {
    overallScore: Math.round(overallScore * 1000) / 1000,
    completeness: Math.round(completeness * 1000) / 1000,
    accuracy: Math.round(accuracy * 1000) / 1000,
    consistency: Math.round(consistency * 1000) / 1000,
    freshness: Math.round(freshness * 1000) / 1000,
    issues,
    recommendations
  };
}

/**
 * Calculate completeness score
 */
function calculateCompleteness(listings: CanonicalListing[]): number {
  const fields = ['sourceId', 'title', 'price', 'url', 'cardName', 'setName', 'cardNumber'];
  const totalFields = fields.length;
  
  let totalCompleteness = 0;
  
  for (const listing of listings) {
    let completedFields = 0;
    
    for (const field of fields) {
      const value = (listing as any)[field];
      if (value !== null && value !== undefined && value !== '') {
        completedFields++;
      }
    }
    
    totalCompleteness += completedFields / totalFields;
  }
  
  return totalCompleteness / listings.length;
}

/**
 * Calculate accuracy score
 */
function calculateAccuracy(listings: CanonicalListing[]): number {
  let totalAccuracy = 0;
  
  for (const listing of listings) {
    let accuracy = 0;
    
    // Price reasonableness
    if (listing.price > 0 && listing.price < 10000000) { // Less than $100k USD
      accuracy += 0.3;
    }
    
    // URL validity
    if (listing.url && isValidUrl(listing.url)) {
      accuracy += 0.2;
    }
    
    // Grade validity
    if (listing.grade === null || (listing.grade >= 1 && listing.grade <= 10)) {
      accuracy += 0.2;
    }
    
    // Text field quality
    if (listing.title && listing.title.length > 10) {
      accuracy += 0.3;
    }
    
    totalAccuracy += accuracy;
  }
  
  return totalAccuracy / listings.length;
}

/**
 * Calculate consistency score
 */
function calculateConsistency(listings: CanonicalListing[]): number {
  if (listings.length < 2) {
    return 1.0; // Single listing is considered consistent
  }
  
  // Check for consistent data patterns
  const sources = new Set(listings.map(l => l.source));
  const currencies = new Set(listings.map(l => l.currency));
  const gradeCompanies = new Set(listings.map(l => l.gradeCompany).filter(Boolean));
  
  let consistency = 0;
  
  // Source consistency (should be consistent within a batch)
  if (sources.size === 1) {
    consistency += 0.3;
  }
  
  // Currency consistency
  if (currencies.size === 1) {
    consistency += 0.3;
  }
  
  // Grade company consistency (for graded cards)
  const gradedListings = listings.filter(l => l.gradeCompany);
  if (gradedListings.length > 0) {
    const gradedCompanies = new Set(gradedListings.map(l => l.gradeCompany));
    if (gradedCompanies.size <= 2) { // Allow some variation
      consistency += 0.2;
    }
  }
  
  // Price range consistency (no extreme outliers)
  const prices = listings.map(l => l.price);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const outliers = prices.filter(p => Math.abs(p - avgPrice) > avgPrice * 2).length;
  if (outliers / prices.length < 0.1) { // Less than 10% outliers
    consistency += 0.2;
  }
  
  return Math.min(consistency, 1.0);
}

/**
 * Calculate freshness score
 */
function calculateFreshness(listings: CanonicalListing[]): number {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  
  let totalFreshness = 0;
  
  for (const listing of listings) {
    const age = now - listing.updatedAt.getTime();
    
    if (age < oneDayMs) {
      totalFreshness += 1.0;
    } else if (age < oneWeekMs) {
      totalFreshness += 0.7;
    } else if (age < oneWeekMs * 4) { // One month
      totalFreshness += 0.4;
    } else {
      totalFreshness += 0.1;
    }
  }
  
  return totalFreshness / listings.length;
}

/**
 * Identify data quality issues
 */
function identifyIssues(listings: CanonicalListing[]): string[] {
  const issues: string[] = [];
  
  // Missing fields analysis
  const missingFields = {
    cardName: 0,
    setName: 0,
    cardNumber: 0,
    url: 0,
    price: 0
  };
  
  for (const listing of listings) {
    if (!listing.cardName) missingFields.cardName++;
    if (!listing.setName) missingFields.setName++;
    if (!listing.cardNumber) missingFields.cardNumber++;
    if (!listing.url) missingFields.url++;
    if (listing.price <= 0) missingFields.price++;
  }
  
  const total = listings.length;
  
  if (missingFields.cardName > total * 0.5) {
    issues.push(`Missing card names: ${missingFields.cardName}/${total}`);
  }
  if (missingFields.setName > total * 0.5) {
    issues.push(`Missing set names: ${missingFields.setName}/${total}`);
  }
  if (missingFields.cardNumber > total * 0.5) {
    issues.push(`Missing card numbers: ${missingFields.cardNumber}/${total}`);
  }
  if (missingFields.url > total * 0.3) {
    issues.push(`Missing URLs: ${missingFields.url}/${total}`);
  }
  if (missingFields.price > total * 0.1) {
    issues.push(`Invalid prices: ${missingFields.price}/${total}`);
  }
  
  // Price analysis
  const prices = listings.map(l => l.price);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const outliers = prices.filter(p => Math.abs(p - avgPrice) > avgPrice * 3).length;
  
  if (outliers > total * 0.05) {
    issues.push(`Price outliers detected: ${outliers}/${total}`);
  }
  
  // Data source analysis
  const sources = new Map<string, number>();
  for (const listing of listings) {
    sources.set(listing.source, (sources.get(listing.source) || 0) + 1);
  }
  
  if (sources.size === 1) {
    issues.push('Single data source - limited diversity');
  }
  
  return issues;
}

/**
 * Generate recommendations for data quality improvement
 */
function generateRecommendations(listings: CanonicalListing[], issues: string[]): string[] {
  const recommendations: string[] = [];
  
  if (issues.some(i => i.includes('Missing card names'))) {
    recommendations.push('Implement better title parsing for Pokemon names');
  }
  
  if (issues.some(i => i.includes('Missing set names'))) {
    recommendations.push('Improve set name extraction from titles');
  }
  
  if (issues.some(i => i.includes('Missing card numbers'))) {
    recommendations.push('Enhance card number recognition patterns');
  }
  
  if (issues.some(i => i.includes('Price outliers'))) {
    recommendations.push('Implement price validation and outlier detection');
  }
  
  if (issues.some(i => i.includes('Single data source'))) {
    recommendations.push('Integrate additional data sources for better coverage');
  }
  
  // General recommendations based on data quality
  const avgQuality = listings.reduce((sum, l) => sum + (l.dataQualityScore || 0), 0) / listings.length;
  
  if (avgQuality < 0.5) {
    recommendations.push('Overall data quality is low - consider data source improvements');
  }
  
  if (avgQuality < 0.7) {
    recommendations.push('Implement additional data validation rules');
  }
  
  return recommendations;
}

/**
 * Validate listing data
 */
export function validateListing(listing: CanonicalListing): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Required field validation
  if (!listing.sourceId) {
    issues.push('Missing source ID');
  }
  
  if (!listing.title || listing.title.trim().length === 0) {
    issues.push('Missing or empty title');
  }
  
  if (listing.price <= 0) {
    issues.push('Invalid price');
  }
  
  if (listing.price > 10000000) { // $100k USD
    issues.push('Unrealistically high price');
  }
  
  if (!listing.url || !isValidUrl(listing.url)) {
    issues.push('Invalid or missing URL');
  }
  
  // Data quality validation
  if (!listing.dataQualityScore || listing.dataQualityScore < 0.3) {
    issues.push('Low data quality score');
  }
  
  // Date validation
  if (listing.createdAt > new Date()) {
    issues.push('Invalid creation date');
  }
  
  if (listing.updatedAt > new Date()) {
    issues.push('Invalid update date');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Batch normalize listings
 */
export function batchNormalizeListings(listings: CanonicalListing[]): CanonicalListing[] {
  return listings.map(listing => normalizeListing(listing));
}

/**
 * Filter listings by quality threshold
 */
export function filterByQuality(
  listings: CanonicalListing[],
  minQuality: number = 0.5
): CanonicalListing[] {
  return listings.filter(listing => 
    (listing.dataQualityScore || 0) >= minQuality
  );
}

/**
 * Get quality statistics
 */
export function getQualityStatistics(listings: CanonicalListing[]): {
  total: number;
  average: number;
  distribution: Record<string, number>;
  topIssues: string[];
} {
  if (listings.length === 0) {
    return {
      total: 0,
      average: 0,
      distribution: {},
      topIssues: []
    };
  }
  
  const scores = listings.map(l => l.dataQualityScore || 0);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  const distribution = {
    'excellent': scores.filter(s => s >= 0.8).length,
    'good': scores.filter(s => s >= 0.6 && s < 0.8).length,
    'fair': scores.filter(s => s >= 0.4 && s < 0.6).length,
    'poor': scores.filter(s => s < 0.4).length
  };
  
  const assessment = assessDataQuality(listings);
  const topIssues = assessment.issues.slice(0, 5);
  
  return {
    total: listings.length,
    average: Math.round(average * 1000) / 1000,
    distribution,
    topIssues
  };
}
