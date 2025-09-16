// Risk assessment and confidence scoring utilities
// Provides consistent risk evaluation across all marketplaces

import { RiskLevel, LiquidityLevel, DemandTrend, CanonicalListing, RiskAssessment } from './types';

// Risk thresholds for different modes
const RISK_THRESHOLDS = {
  conservative: {
    minConfidence: 0.8,
    maxRisk: RiskLevel.LOW,
    minDataQuality: 0.7,
    maxPriceOutlier: 0.3,
    minLiquidity: 0.6,
    maxVolatility: 0.3
  },
  default: {
    minConfidence: 0.6,
    maxRisk: RiskLevel.MEDIUM,
    minDataQuality: 0.5,
    maxPriceOutlier: 0.5,
    minLiquidity: 0.4,
    maxVolatility: 0.5
  },
  aggressive: {
    minConfidence: 0.4,
    maxRisk: RiskLevel.HIGH,
    minDataQuality: 0.3,
    maxPriceOutlier: 0.7,
    minLiquidity: 0.2,
    maxVolatility: 0.7
  }
};

// Popular Pokemon for liquidity assessment
const POPULAR_POKEMON = new Set([
  'charizard', 'pikachu', 'mew', 'mewtwo', 'lugia', 'blastoise', 'venusaur',
  'alakazam', 'gengar', 'gyarados', 'dragonite', 'machamp', 'snorlax',
  'rayquaza', 'groudon', 'kyogre', 'dialga', 'palkia', 'arceus'
]);

// Vintage sets for trend assessment
const VINTAGE_SETS = new Set(['BS1', 'JU', 'FO', 'TR', 'GH', 'GC', 'NG', 'ND', 'NR']);

/**
 * Calculate overall confidence score for a listing
 */
export function calculateConfidenceScore(
  listing: CanonicalListing,
  context?: {
    crossReferenceMatch?: number;
    parsingConfidence?: number;
    dataQuality?: number;
  }
): number {
  let confidence = 0;

  // Base confidence from data quality
  confidence += (listing.dataQualityScore || 0) * 0.3;

  // Cross-reference match confidence
  if (context?.crossReferenceMatch) {
    confidence += context.crossReferenceMatch * 0.25;
  }

  // Parsing confidence
  if (context?.parsingConfidence) {
    confidence += context.parsingConfidence * 0.2;
  }

  // Data completeness score
  const fields = [
    listing.cardName,
    listing.setName,
    listing.cardNumber,
    listing.gradeCompany,
    listing.grade,
    listing.url
  ];
  const completedFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
  confidence += (completedFields / fields.length) * 0.15;

  // Price reasonableness
  if (listing.price > 0 && listing.price < 10000000) { // Less than 100k USD
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Calculate liquidity score based on card characteristics
 */
export function calculateLiquidityScore(listing: CanonicalListing): number {
  let liquidity = 0.5; // Base liquidity

  // Popular Pokemon have higher liquidity
  if (listing.cardName && POPULAR_POKEMON.has(listing.cardName.toLowerCase())) {
    liquidity += 0.2;
  }

  // High-grade cards have higher liquidity
  if (listing.grade && listing.grade >= 9) {
    liquidity += 0.15;
  }

  // PSA cards have higher liquidity
  if (listing.gradeCompany === 'PSA') {
    liquidity += 0.1;
  }

  // Vintage cards have higher liquidity
  if (listing.setName) {
    const vintageSets = ['Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Gym Heroes', 'Gym Challenge'];
    if (vintageSets.some(set => listing.setName?.includes(set))) {
      liquidity += 0.15;
    }
  }

  // Price range affects liquidity
  if (listing.price >= 1000 && listing.price <= 100000) { // $10-$1000
    liquidity += 0.1;
  } else if (listing.price > 100000) { // Over $1000
    liquidity -= 0.1; // Very expensive cards are less liquid
  }

  return Math.min(Math.max(liquidity, 0), 1);
}

/**
 * Calculate velocity score (how quickly the card sells)
 */
export function calculateVelocityScore(listing: CanonicalListing): number {
  let velocity = 0.3; // Base velocity

  // Popular Pokemon sell faster
  if (listing.cardName && POPULAR_POKEMON.has(listing.cardName.toLowerCase())) {
    velocity += 0.2;
  }

  // High-grade cards sell faster
  if (listing.grade && listing.grade >= 9) {
    velocity += 0.15;
  }

  // PSA cards sell faster
  if (listing.gradeCompany === 'PSA') {
    velocity += 0.1;
  }

  // Vintage cards sell faster
  if (listing.setName) {
    const vintageSets = ['Base Set', 'Jungle', 'Fossil', 'Team Rocket'];
    if (vintageSets.some(set => listing.setName?.includes(set))) {
      velocity += 0.15;
    }
  }

  // Price range affects velocity
  if (listing.price >= 1000 && listing.price <= 50000) { // $10-$500
    velocity += 0.1;
  } else if (listing.price > 500000) { // Over $5000
    velocity -= 0.1; // Very expensive cards take longer to sell
  }

  return Math.min(Math.max(velocity, 0), 1);
}

/**
 * Calculate demand trend
 */
export function calculateDemandTrend(listing: CanonicalListing): DemandTrend {
  let demandScore = 0;

  // Vintage cards generally have rising demand
  if (listing.setName) {
    const vintageSets = ['Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Gym Heroes'];
    if (vintageSets.some(set => listing.setName?.includes(set))) {
      demandScore += 0.3;
    }
  }

  // High-grade cards have rising demand
  if (listing.grade && listing.grade >= 9) {
    demandScore += 0.2;
  }

  // Popular Pokemon have stable to rising demand
  if (listing.cardName && POPULAR_POKEMON.has(listing.cardName.toLowerCase())) {
    demandScore += 0.2;
  }

  // PSA cards have rising demand
  if (listing.gradeCompany === 'PSA') {
    demandScore += 0.1;
  }

  // Price range affects demand
  if (listing.price >= 5000 && listing.price <= 100000) { // $50-$1000
    demandScore += 0.1;
  } else if (listing.price > 100000) { // Over $1000
    demandScore += 0.1; // High-value cards have rising demand
  }

  // Newer sets have falling demand
  if (listing.setName) {
    const newSets = ['Scarlet & Violet', 'Paldea Evolved', 'Obsidian Flames'];
    if (newSets.some(set => listing.setName?.includes(set))) {
      demandScore -= 0.2;
    }
  }

  if (demandScore >= 0.3) return DemandTrend.RISING;
  if (demandScore >= 0.1) return DemandTrend.STABLE;
  return DemandTrend.FALLING;
}

/**
 * Calculate volatility score
 */
export function calculateVolatilityScore(
  listing: CanonicalListing,
  historicalPrices?: number[]
): number {
  let volatility = 0.2; // Base volatility

  // High-value cards are more volatile
  if (listing.price > 50000) { // Over $500
    volatility += 0.2;
  }

  // High-grade cards are more volatile
  if (listing.grade && listing.grade >= 9.5) {
    volatility += 0.15;
  }

  // Popular Pokemon are more volatile
  if (listing.cardName && POPULAR_POKEMON.has(listing.cardName.toLowerCase())) {
    volatility += 0.1;
  }

  // Vintage cards are more volatile
  if (listing.setName) {
    const vintageSets = ['Base Set', 'Jungle', 'Fossil'];
    if (vintageSets.some(set => listing.setName?.includes(set))) {
      volatility += 0.15;
    }
  }

  // Calculate volatility from historical data if available
  if (historicalPrices && historicalPrices.length > 1) {
    const mean = historicalPrices.reduce((sum, price) => sum + price, 0) / historicalPrices.length;
    const variance = historicalPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / historicalPrices.length;
    const historicalVolatility = Math.sqrt(variance) / mean;
    
    // Combine historical volatility with heuristic volatility
    volatility = (volatility + historicalVolatility) / 2;
  }

  return Math.min(Math.max(volatility, 0), 1);
}

/**
 * Calculate price outlier score
 */
export function calculatePriceOutlierScore(
  listing: CanonicalListing,
  marketPrices?: number[]
): number {
  if (!marketPrices || marketPrices.length === 0) {
    return 0.5; // Neutral if no market data
  }

  const mean = marketPrices.reduce((sum, price) => sum + price, 0) / marketPrices.length;
  const variance = marketPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / marketPrices.length;
  const standardDeviation = Math.sqrt(variance);

  // Calculate how many standard deviations the listing price is from the mean
  const zScore = Math.abs(listing.price - mean) / standardDeviation;
  
  // Convert z-score to 0-1 scale (higher = more outlier)
  return Math.min(zScore / 3, 1); // Cap at 3 standard deviations
}

/**
 * Calculate comprehensive risk assessment
 */
export function calculateRiskAssessment(
  listing: CanonicalListing,
  context?: {
    crossReferenceMatch?: number;
    parsingConfidence?: number;
    marketPrices?: number[];
    historicalPrices?: number[];
  }
): RiskAssessment {
  const confidence = calculateConfidenceScore(listing, context);
  const liquidity = calculateLiquidityScore(listing);
  const velocity = calculateVelocityScore(listing);
  const volatility = calculateVolatilityScore(listing, context?.historicalPrices);
  const priceOutlier = calculatePriceOutlierScore(listing, context?.marketPrices);
  
  // Data quality score
  const dataQuality = listing.dataQualityScore || 0.5;
  
  // Market trend score (based on demand trend)
  const demandTrend = calculateDemandTrend(listing);
  const marketTrend = demandTrend === 'RISING' ? 0.8 : demandTrend === 'STABLE' ? 0.5 : 0.2;

  // Calculate overall risk level
  let riskLevel: RiskLevel;
  const riskScore = (1 - confidence) + (1 - liquidity) + volatility + priceOutlier + (1 - dataQuality);
  
  if (riskScore < 1.5) {
    riskLevel = RiskLevel.LOW;
  } else if (riskScore < 3.0) {
    riskLevel = RiskLevel.MEDIUM;
  } else {
    riskLevel = RiskLevel.HIGH;
  }

  // Generate reasoning
  const reasoning: string[] = [];
  
  if (confidence < 0.5) {
    reasoning.push('Low confidence due to incomplete or poor quality data');
  }
  
  if (liquidity < 0.3) {
    reasoning.push('Low liquidity - may be difficult to sell quickly');
  }
  
  if (volatility > 0.7) {
    reasoning.push('High price volatility - significant price risk');
  }
  
  if (priceOutlier > 0.7) {
    reasoning.push('Price appears to be an outlier compared to market');
  }
  
  if (dataQuality < 0.5) {
    reasoning.push('Poor data quality - information may be unreliable');
  }
  
  if (demandTrend === 'FALLING') {
    reasoning.push('Falling demand trend - may be losing value');
  }

  return {
    riskLevel,
    confidence,
    factors: {
      dataQuality,
      priceOutlier,
      liquidity,
      volatility,
      marketTrend
    },
    reasoning
  };
}

/**
 * Check if listing meets risk criteria for a given mode
 */
export function meetsRiskCriteria(
  listing: CanonicalListing,
  mode: 'conservative' | 'default' | 'aggressive',
  riskAssessment: RiskAssessment
): boolean {
  const thresholds = RISK_THRESHOLDS[mode];
  
  return (
    riskAssessment.confidence >= thresholds.minConfidence &&
    riskAssessment.riskLevel <= thresholds.maxRisk &&
    riskAssessment.factors.dataQuality >= thresholds.minDataQuality &&
    riskAssessment.factors.priceOutlier <= thresholds.maxPriceOutlier &&
    riskAssessment.factors.liquidity >= thresholds.minLiquidity &&
    riskAssessment.factors.volatility <= thresholds.maxVolatility
  );
}

/**
 * Calculate liquidity level from score
 */
export function getLiquidityLevel(liquidityScore: number): LiquidityLevel {
  if (liquidityScore >= 0.7) return LiquidityLevel.HIGH;
  if (liquidityScore >= 0.4) return LiquidityLevel.MEDIUM;
  return LiquidityLevel.LOW;
}

/**
 * Batch calculate risk assessments
 */
export function batchCalculateRiskAssessments(
  listings: CanonicalListing[],
  context?: {
    crossReferenceMatches?: Map<string, number>;
    parsingConfidences?: Map<string, number>;
    marketPrices?: Map<string, number[]>;
    historicalPrices?: Map<string, number[]>;
  }
): Map<string, RiskAssessment> {
  const results = new Map<string, RiskAssessment>();
  
  for (const listing of listings) {
    const assessment = calculateRiskAssessment(listing, {
      crossReferenceMatch: context?.crossReferenceMatches?.get(listing.id),
      parsingConfidence: context?.parsingConfidences?.get(listing.id),
      marketPrices: context?.marketPrices?.get(listing.id),
      historicalPrices: context?.historicalPrices?.get(listing.id)
    });
    
    results.set(listing.id, assessment);
  }
  
  return results;
}

/**
 * Filter listings by risk criteria
 */
export function filterByRiskCriteria(
  listings: CanonicalListing[],
  mode: 'conservative' | 'default' | 'aggressive',
  riskAssessments: Map<string, RiskAssessment>
): CanonicalListing[] {
  return listings.filter(listing => {
    const assessment = riskAssessments.get(listing.id);
    return assessment ? meetsRiskCriteria(listing, mode, assessment) : false;
  });
}

/**
 * Sort listings by risk-adjusted confidence
 */
export function sortByRiskAdjustedConfidence(
  listings: CanonicalListing[],
  riskAssessments: Map<string, RiskAssessment>
): CanonicalListing[] {
  return listings.sort((a, b) => {
    const assessmentA = riskAssessments.get(a.id);
    const assessmentB = riskAssessments.get(b.id);
    
    if (!assessmentA || !assessmentB) return 0;
    
    // Risk-adjusted confidence: confidence * (1 - risk_factor)
    const riskFactorA = assessmentA.riskLevel === RiskLevel.HIGH ? 0.5 : 
                       assessmentA.riskLevel === RiskLevel.MEDIUM ? 0.25 : 0;
    const riskFactorB = assessmentB.riskLevel === RiskLevel.HIGH ? 0.5 : 
                       assessmentB.riskLevel === RiskLevel.MEDIUM ? 0.25 : 0;
    
    const adjustedConfidenceA = assessmentA.confidence * (1 - riskFactorA);
    const adjustedConfidenceB = assessmentB.confidence * (1 - riskFactorB);
    
    return adjustedConfidenceB - adjustedConfidenceA;
  });
}

/**
 * Calculate risk distribution across listings
 */
export function calculateRiskDistribution(
  riskAssessments: Map<string, RiskAssessment>
): {
  low: number;
  medium: number;
  high: number;
  total: number;
} {
  let low = 0, medium = 0, high = 0;
  
  for (const assessment of riskAssessments.values()) {
    switch (assessment.riskLevel) {
      case RiskLevel.LOW:
        low++;
        break;
      case RiskLevel.MEDIUM:
        medium++;
        break;
      case RiskLevel.HIGH:
        high++;
        break;
    }
  }
  
  return {
    low,
    medium,
    high,
    total: low + medium + high
  };
}

/**
 * Get risk summary for reporting
 */
export function getRiskSummary(
  riskAssessments: Map<string, RiskAssessment>
): {
  averageConfidence: number;
  averageLiquidity: number;
  averageVolatility: number;
  riskDistribution: { low: number; medium: number; high: number; total: number };
  topRisks: string[];
} {
  const assessments = Array.from(riskAssessments.values());
  
  if (assessments.length === 0) {
    return {
      averageConfidence: 0,
      averageLiquidity: 0,
      averageVolatility: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, total: 0 },
      topRisks: []
    };
  }
  
  const averageConfidence = assessments.reduce((sum, a) => sum + a.confidence, 0) / assessments.length;
  const averageLiquidity = assessments.reduce((sum, a) => sum + a.factors.liquidity, 0) / assessments.length;
  const averageVolatility = assessments.reduce((sum, a) => sum + a.factors.volatility, 0) / assessments.length;
  
  const riskDistribution = calculateRiskDistribution(riskAssessments);
  
  // Get top risks (highest risk factors)
  const topRisks = assessments
    .sort((a, b) => {
      const riskScoreA = (1 - a.confidence) + (1 - a.factors.liquidity) + a.factors.volatility;
      const riskScoreB = (1 - b.confidence) + (1 - b.factors.liquidity) + b.factors.volatility;
      return riskScoreB - riskScoreA;
    })
    .slice(0, 5)
    .map(a => a.reasoning.join('; '));
  
  return {
    averageConfidence: Math.round(averageConfidence * 1000) / 1000,
    averageLiquidity: Math.round(averageLiquidity * 1000) / 1000,
    averageVolatility: Math.round(averageVolatility * 1000) / 1000,
    riskDistribution,
    topRisks
  };
}
