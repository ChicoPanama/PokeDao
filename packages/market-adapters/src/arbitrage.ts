// Unified arbitrage detection engine
// Provides consistent arbitrage opportunity detection across all marketplaces

import { 
  CanonicalListing, 
  ArbitrageOpportunity,
  RiskLevel,
  LiquidityLevel,
  DemandTrend,
  MarketSource,
  CollectionSlug
} from '@pokedao/market-core';
import { calculateFees } from '@pokedao/market-core/src/fees';
import { calculateRiskAssessment, getLiquidityLevel } from '@pokedao/market-core/src/risk';
import { calculateConfidenceScore } from '@pokedao/market-core/src/risk';

// Arbitrage calculation interfaces
interface ArbitrageContext {
  expectedResalePrice: number;
  marketPrices?: number[];
  historicalPrices?: number[];
  crossReferenceData?: any;
  collectionTags?: CollectionSlug[];
}

interface ArbitrageThresholds {
  minProfitMargin: number;
  maxRisk: RiskLevel;
  minConfidence: number;
  minProfitAmount: number;
}

// Default thresholds for different modes
const ARBITRAGE_THRESHOLDS = {
  conservative: {
    minProfitMargin: 25,
    maxRisk: RiskLevel.LOW,
    minConfidence: 0.8,
    minProfitAmount: 50 // $0.50
  },
  default: {
    minProfitMargin: 15,
    maxRisk: RiskLevel.MEDIUM,
    minConfidence: 0.6,
    minProfitAmount: 25 // $0.25
  },
  aggressive: {
    minProfitMargin: 10,
    maxRisk: RiskLevel.HIGH,
    minConfidence: 0.4,
    minProfitAmount: 10 // $0.10
  }
};

/**
 * Detect arbitrage opportunities for a listing
 */
export function detectArbitrageOpportunity(
  listing: CanonicalListing,
  context: ArbitrageContext,
  mode: keyof typeof ARBITRAGE_THRESHOLDS = 'default'
): ArbitrageOpportunity | null {
  const thresholds = ARBITRAGE_THRESHOLDS[mode];
  
  // Calculate expected resale price
  const expectedResale = context.expectedResalePrice;
  
  // Calculate fees
  const fees = calculateFees(listing, {
    includeShipping: true,
    domesticShipping: true
  });
  
  // Calculate shipping costs
  const shippingCost = estimateShippingCost(listing);
  
  // Calculate net profit
  const totalCost = listing.price + fees.totalFees + shippingCost;
  const netProfit = expectedResale - totalCost;
  const marginPct = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  
  // Check minimum profit thresholds
  if (netProfit < thresholds.minProfitAmount) {
    return null;
  }
  
  if (marginPct < thresholds.minProfitMargin) {
    return null;
  }
  
  // Calculate market indicators
  const liquidity = calculateLiquidity(listing, context);
  const velocity = calculateVelocity(listing, context);
  const demand = calculateDemand(listing, context);
  const volatility = calculateVolatility(listing, context);
  
  // Calculate confidence and risk
  const riskAssessment = calculateRiskAssessment(listing, {
    marketPrices: context.marketPrices,
    historicalPrices: context.historicalPrices,
    crossReferenceMatch: context.crossReferenceData?.matchConfidence
  });
  
  // Check risk thresholds
  if (riskAssessment.riskLevel > thresholds.maxRisk) {
    return null;
  }
  
  if (riskAssessment.confidence < thresholds.minConfidence) {
    return null;
  }
  
  // Create arbitrage opportunity
  const opportunity: ArbitrageOpportunity = {
    id: `arb_${listing.id}_${Date.now()}`,
    canonicalId: listing.id,
    source: listing.source,
    expectedResale,
    expectedFees: fees.totalFees,
    expectedShipping: shippingCost,
    netProfit,
    marginPct,
    liquidity: getLiquidityLevel(liquidity),
    velocity,
    demand,
    volatility,
    confidence: riskAssessment.confidence,
    risk: riskAssessment.riskLevel,
    collectionTags: context.collectionTags || [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  return opportunity;
}

/**
 * Calculate liquidity score
 */
function calculateLiquidity(listing: CanonicalListing, context: ArbitrageContext): number {
  let liquidity = 0.5; // Base liquidity
  
  // Popular Pokemon have higher liquidity
  const popularPokemon = ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia', 'blastoise', 'venusaur'];
  if (listing.cardName && popularPokemon.includes(listing.cardName.toLowerCase())) {
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
  if (isVintageCard(listing)) {
    liquidity += 0.15;
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
 * Calculate velocity score
 */
function calculateVelocity(listing: CanonicalListing, context: ArbitrageContext): number {
  let velocity = 0.3; // Base velocity
  
  // Popular Pokemon sell faster
  const popularPokemon = ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia'];
  if (listing.cardName && popularPokemon.includes(listing.cardName.toLowerCase())) {
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
  if (isVintageCard(listing)) {
    velocity += 0.15;
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
function calculateDemand(listing: CanonicalListing, context: ArbitrageContext): DemandTrend {
  let demandScore = 0;
  
  // Vintage cards generally have rising demand
  if (isVintageCard(listing)) {
    demandScore += 0.3;
  }
  
  // High-grade cards have rising demand
  if (listing.grade && listing.grade >= 9) {
    demandScore += 0.2;
  }
  
  // Popular Pokemon have stable to rising demand
  const popularPokemon = ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia', 'blastoise', 'venusaur'];
  if (listing.cardName && popularPokemon.includes(listing.cardName.toLowerCase())) {
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
  if (isNewSet(listing)) {
    demandScore -= 0.2;
  }
  
  if (demandScore >= 0.3) return 'RISING';
  if (demandScore >= 0.1) return 'STABLE';
  return 'FALLING';
}

/**
 * Calculate volatility score
 */
function calculateVolatility(listing: CanonicalListing, context: ArbitrageContext): number {
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
  const popularPokemon = ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia'];
  if (listing.cardName && popularPokemon.includes(listing.cardName.toLowerCase())) {
    volatility += 0.1;
  }
  
  // Vintage cards are more volatile
  if (isVintageCard(listing)) {
    volatility += 0.15;
  }
  
  // Calculate volatility from historical data if available
  if (context.historicalPrices && context.historicalPrices.length > 1) {
    const mean = context.historicalPrices.reduce((sum, price) => sum + price, 0) / context.historicalPrices.length;
    const variance = context.historicalPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / context.historicalPrices.length;
    const historicalVolatility = Math.sqrt(variance) / mean;
    
    // Combine historical volatility with heuristic volatility
    volatility = (volatility + historicalVolatility) / 2;
  }
  
  return Math.min(Math.max(volatility, 0), 1);
}

/**
 * Estimate shipping costs
 */
function estimateShippingCost(listing: CanonicalListing): number {
  const priceUSD = listing.price / 100; // Convert cents to dollars
  
  // Shipping estimates based on price range
  if (priceUSD < 25) return 500; // $5
  if (priceUSD < 100) return 800; // $8
  if (priceUSD < 500) return 1500; // $15
  if (priceUSD < 1000) return 2500; // $25
  return 3500; // $35 for expensive items
}

/**
 * Check if card is vintage (pre-2000)
 */
function isVintageCard(listing: CanonicalListing): boolean {
  const vintageSets = ['Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Gym Heroes', 'Gym Challenge'];
  return listing.setName ? vintageSets.some(set => listing.setName?.includes(set)) : false;
}

/**
 * Check if card is from a new set
 */
function isNewSet(listing: CanonicalListing): boolean {
  const newSets = ['Scarlet & Violet', 'Paldea Evolved', 'Obsidian Flames', '151'];
  return listing.setName ? newSets.some(set => listing.setName?.includes(set)) : false;
}

/**
 * Batch detect arbitrage opportunities
 */
export function batchDetectArbitrageOpportunities(
  listings: CanonicalListing[],
  contexts: Map<string, ArbitrageContext>,
  mode: keyof typeof ARBITRAGE_THRESHOLDS = 'default'
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  for (const listing of listings) {
    const context = contexts.get(listing.id);
    if (!context) {
      continue;
    }
    
    try {
      const opportunity = detectArbitrageOpportunity(listing, context, mode);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    } catch (error) {
      console.error(`Failed to detect arbitrage opportunity for listing ${listing.id}:`, error);
    }
  }
  
  return opportunities;
}

/**
 * Filter opportunities by criteria
 */
export function filterOpportunities(
  opportunities: ArbitrageOpportunity[],
  filters: {
    minProfitMargin?: number;
    maxRisk?: RiskLevel;
    minConfidence?: number;
    minProfitAmount?: number;
    maxProfitAmount?: number;
    liquidity?: LiquidityLevel[];
    collections?: CollectionSlug[];
    sources?: MarketSource[];
  }
): ArbitrageOpportunity[] {
  return opportunities.filter(opportunity => {
    // Profit margin filter
    if (filters.minProfitMargin && opportunity.marginPct < filters.minProfitMargin) {
      return false;
    }
    
    // Risk filter
    if (filters.maxRisk && opportunity.risk > filters.maxRisk) {
      return false;
    }
    
    // Confidence filter
    if (filters.minConfidence && opportunity.confidence < filters.minConfidence) {
      return false;
    }
    
    // Profit amount filters
    if (filters.minProfitAmount && opportunity.netProfit < filters.minProfitAmount * 100) {
      return false;
    }
    
    if (filters.maxProfitAmount && opportunity.netProfit > filters.maxProfitAmount * 100) {
      return false;
    }
    
    // Liquidity filter
    if (filters.liquidity && !filters.liquidity.includes(opportunity.liquidity)) {
      return false;
    }
    
    // Collection filter
    if (filters.collections && !filters.collections.some(c => opportunity.collectionTags.includes(c))) {
      return false;
    }
    
    // Source filter
    if (filters.sources && !filters.sources.includes(opportunity.source)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort opportunities by criteria
 */
export function sortOpportunities(
  opportunities: ArbitrageOpportunity[],
  sortBy: 'profit' | 'margin' | 'confidence' | 'risk' = 'profit',
  order: 'asc' | 'desc' = 'desc'
): ArbitrageOpportunity[] {
  return opportunities.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'profit':
        comparison = a.netProfit - b.netProfit;
        break;
      case 'margin':
        comparison = a.marginPct - b.marginPct;
        break;
      case 'confidence':
        comparison = a.confidence - b.confidence;
        break;
      case 'risk':
        const riskOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
        comparison = riskOrder[a.risk] - riskOrder[b.risk];
        break;
    }
    
    return order === 'desc' ? -comparison : comparison;
  });
}

/**
 * Calculate arbitrage statistics
 */
export function calculateArbitrageStatistics(opportunities: ArbitrageOpportunity[]): {
  total: number;
  totalProfitPotential: number;
  averageMargin: number;
  riskDistribution: Record<string, number>;
  liquidityDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
  topOpportunities: ArbitrageOpportunity[];
} {
  if (opportunities.length === 0) {
    return {
      total: 0,
      totalProfitPotential: 0,
      averageMargin: 0,
      riskDistribution: {},
      liquidityDistribution: {},
      sourceDistribution: {},
      topOpportunities: []
    };
  }
  
  const totalProfitPotential = opportunities.reduce((sum, o) => sum + o.netProfit, 0);
  const averageMargin = opportunities.reduce((sum, o) => sum + o.marginPct, 0) / opportunities.length;
  
  const riskDistribution = opportunities.reduce((acc, o) => {
    acc[o.risk] = (acc[o.risk] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const liquidityDistribution = opportunities.reduce((acc, o) => {
    acc[o.liquidity] = (acc[o.liquidity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const sourceDistribution = opportunities.reduce((acc, o) => {
    acc[o.source] = (acc[o.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topOpportunities = opportunities
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 10);
  
  return {
    total: opportunities.length,
    totalProfitPotential: Math.round(totalProfitPotential),
    averageMargin: Math.round(averageMargin * 100) / 100,
    riskDistribution,
    liquidityDistribution,
    sourceDistribution,
    topOpportunities
  };
}

/**
 * Get arbitrage mode thresholds
 */
export function getArbitrageThresholds(mode: keyof typeof ARBITRAGE_THRESHOLDS): ArbitrageThresholds {
  return ARBITRAGE_THRESHOLDS[mode];
}

/**
 * Validate arbitrage opportunity
 */
export function validateArbitrageOpportunity(opportunity: ArbitrageOpportunity): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (opportunity.netProfit <= 0) {
    issues.push('Negative or zero net profit');
  }
  
  if (opportunity.marginPct <= 0) {
    issues.push('Negative or zero margin percentage');
  }
  
  if (opportunity.confidence < 0 || opportunity.confidence > 1) {
    issues.push('Invalid confidence score');
  }
  
  if (opportunity.velocity < 0 || opportunity.velocity > 1) {
    issues.push('Invalid velocity score');
  }
  
  if (opportunity.volatility < 0 || opportunity.volatility > 1) {
    issues.push('Invalid volatility score');
  }
  
  if (!opportunity.canonicalId) {
    issues.push('Missing canonical ID');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
