// Fee calculation utilities for different marketplaces
// Provides deterministic fee calculations for arbitrage analysis

import { MarketSource, CanonicalListing, FeeCalculation } from './types';

// Fee structures for different marketplaces
interface MarketplaceFees {
  platformFee: number;      // percentage of sale price
  paymentFee: number;       // percentage of sale price
  listingFee?: number;      // fixed fee or percentage
  finalValueFee?: number;   // percentage of final value
  paymentProcessingFee?: number; // percentage of payment
  subscriptionFee?: number; // monthly/annual subscription
}

// Marketplace-specific fee structures
const MARKETPLACE_FEES: Record<MarketSource, MarketplaceFees> = {
  [MarketSource.EBAY]: {
    platformFee: 13.25,     // Final Value Fee (most categories)
    paymentFee: 2.9,        // PayPal processing fee
    listingFee: 0,          // Free listings for most items
    finalValueFee: 13.25,   // Same as platform fee
    paymentProcessingFee: 2.9,
  },
  
  [MarketSource.TCGPLAYER]: {
    platformFee: 10.25,     // TCGPlayer commission
    paymentFee: 2.9,        // Payment processing
    listingFee: 0,          // Free to list
    finalValueFee: 10.25,
    paymentProcessingFee: 2.9,
  },
  
  [MarketSource.FANATICS]: {
    platformFee: 15.0,      // Higher commission for sports cards
    paymentFee: 3.0,        // Payment processing
    listingFee: 0,
    finalValueFee: 15.0,
    paymentProcessingFee: 3.0,
  },
  
  [MarketSource.COLLECTOR_CRYPT]: {
    platformFee: 2.5,       // Lower fees for NFT marketplace
    paymentFee: 0,          // No payment processing fee
    listingFee: 0,
    finalValueFee: 2.5,
  },
  
  [MarketSource.MANUAL]: {
    platformFee: 0,         // No platform fees for manual entries
    paymentFee: 0,
    listingFee: 0,
  },
  
  [MarketSource.CSV]: {
    platformFee: 0,         // No platform fees for CSV imports
    paymentFee: 0,
    listingFee: 0,
  },
};

// Shipping cost estimates by price range
const SHIPPING_ESTIMATES = {
  // Domestic US shipping estimates
  DOMESTIC: {
    under25: 5.00,    // $0-25: $5 shipping
    under100: 8.00,   // $25-100: $8 shipping
    under500: 15.00,  // $100-500: $15 shipping with insurance
    under1000: 25.00, // $500-1000: $25 shipping with signature
    over1000: 35.00,  // $1000+: $35 shipping with full insurance
  },
  
  // International shipping estimates
  INTERNATIONAL: {
    under25: 15.00,
    under100: 25.00,
    under500: 45.00,
    under1000: 75.00,
    over1000: 125.00,
  },
};

/**
 * Calculate total fees for a listing
 */
export function calculateFees(
  listing: CanonicalListing,
  options: {
    includeShipping?: boolean;
    domesticShipping?: boolean;
    customFees?: Partial<MarketplaceFees>;
  } = {}
): FeeCalculation {
  const fees = { ...MARKETPLACE_FEES[listing.source], ...options.customFees };
  const priceUSD = listing.price / 100; // Convert cents to dollars
  
  // Calculate platform fees
  const platformFee = (priceUSD * fees.platformFee) / 100;
  const paymentFee = (priceUSD * fees.paymentFee) / 100;
  
  // Calculate shipping cost
  let shippingFee = 0;
  if (options.includeShipping) {
    shippingFee = estimateShipping(priceUSD, options.domesticShipping ?? true);
  }
  
  const totalFees = (platformFee + paymentFee + shippingFee) * 100; // Convert back to cents
  const feePercentage = (totalFees / listing.price) * 100;
  
  return {
    platformFee: Math.round(platformFee * 100), // Convert to cents
    paymentFee: Math.round(paymentFee * 100),
    shippingFee: Math.round(shippingFee * 100),
    totalFees: Math.round(totalFees),
    feePercentage: Math.round(feePercentage * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Estimate shipping costs based on price range
 */
export function estimateShipping(priceUSD: number, domestic: boolean = true): number {
  const estimates = domestic ? SHIPPING_ESTIMATES.DOMESTIC : SHIPPING_ESTIMATES.INTERNATIONAL;
  
  if (priceUSD < 25) return estimates.under25;
  if (priceUSD < 100) return estimates.under100;
  if (priceUSD < 500) return estimates.under500;
  if (priceUSD < 1000) return estimates.under1000;
  return estimates.over1000;
}

/**
 * Calculate net profit after fees
 */
export function calculateNetProfit(
  listing: CanonicalListing,
  expectedResalePrice: number, // in USD cents
  options: {
    includeShipping?: boolean;
    domesticShipping?: boolean;
  } = {}
): {
  netProfit: number;
  marginPercentage: number;
  totalCost: number;
  fees: FeeCalculation;
} {
  const fees = calculateFees(listing, options);
  const totalCost = listing.price + fees.totalFees;
  const netProfit = expectedResalePrice - totalCost;
  const marginPercentage = (netProfit / totalCost) * 100;
  
  return {
    netProfit: Math.round(netProfit),
    marginPercentage: Math.round(marginPercentage * 100) / 100,
    totalCost: Math.round(totalCost),
    fees,
  };
}

/**
 * Calculate break-even price (minimum resale price to cover costs)
 */
export function calculateBreakEvenPrice(
  listing: CanonicalListing,
  options: {
    includeShipping?: boolean;
    domesticShipping?: boolean;
    targetMargin?: number; // percentage
  } = {}
): number {
  const fees = calculateFees(listing, options);
  const totalCost = listing.price + fees.totalFees;
  
  if (options.targetMargin) {
    // Calculate price needed to achieve target margin
    return Math.round(totalCost * (1 + options.targetMargin / 100));
  }
  
  // Return break-even price (no profit, no loss)
  return Math.round(totalCost);
}

/**
 * Calculate fees for multiple listings
 */
export function batchCalculateFees(
  listings: CanonicalListing[],
  options: {
    includeShipping?: boolean;
    domesticShipping?: boolean;
  } = {}
): FeeCalculation[] {
  return listings.map(listing => calculateFees(listing, options));
}

/**
 * Get marketplace fee structure
 */
export function getMarketplaceFees(source: MarketSource): MarketplaceFees {
  return MARKETPLACE_FEES[source];
}

/**
 * Update marketplace fees (for dynamic fee updates)
 */
export function updateMarketplaceFees(
  source: MarketSource,
  fees: Partial<MarketplaceFees>
): void {
  MARKETPLACE_FEES[source] = { ...MARKETPLACE_FEES[source], ...fees };
}

/**
 * Compare fees across marketplaces
 */
export function compareMarketplaceFees(
  price: number, // in USD cents
  sources: MarketSource[] = Object.values(MarketSource)
): Array<{ source: MarketSource; totalFees: number; feePercentage: number }> {
  return sources.map(source => {
    const mockListing: CanonicalListing = {
      id: 'mock',
      source,
      sourceId: 'mock',
      title: 'Mock Listing',
      rawTitle: 'Mock Listing',
      price,
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const fees = calculateFees(mockListing);
    
    return {
      source,
      totalFees: fees.totalFees,
      feePercentage: fees.feePercentage,
    };
  }).sort((a, b) => a.totalFees - b.totalFees);
}

/**
 * Calculate fee impact on profitability
 */
export function calculateFeeImpact(
  originalPrice: number,
  resalePrice: number,
  source: MarketSource,
  options: {
    includeShipping?: boolean;
    domesticShipping?: boolean;
  } = {}
): {
  grossProfit: number;
  netProfit: number;
  feeImpact: number;
  feePercentage: number;
} {
  const mockListing: CanonicalListing = {
    id: 'mock',
    source,
    sourceId: 'mock',
    title: 'Mock Listing',
    rawTitle: 'Mock Listing',
    price: originalPrice,
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const fees = calculateFees(mockListing, options);
  const grossProfit = resalePrice - originalPrice;
  const netProfit = grossProfit - fees.totalFees;
  const feeImpact = grossProfit - netProfit;
  const feePercentage = (feeImpact / grossProfit) * 100;
  
  return {
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    feeImpact: Math.round(feeImpact),
    feePercentage: Math.round(feePercentage * 100) / 100,
  };
}

/**
 * Find optimal marketplace for selling based on fees
 */
export function findOptimalMarketplace(
  price: number, // in USD cents
  sources: MarketSource[] = Object.values(MarketSource)
): { source: MarketSource; netProfit: number; fees: FeeCalculation } {
  const comparisons = compareMarketplaceFees(price, sources);
  const optimalSource = comparisons[0].source; // Lowest fees
  
  const mockListing: CanonicalListing = {
    id: 'mock',
    source: optimalSource,
    sourceId: 'mock',
    title: 'Mock Listing',
    rawTitle: 'Mock Listing',
    price,
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const fees = calculateFees(mockListing);
  const netProfit = price - fees.totalFees;
  
  return {
    source: optimalSource,
    netProfit: Math.round(netProfit),
    fees,
  };
}

/**
 * Validate fee calculation
 */
export function validateFeeCalculation(fees: FeeCalculation): boolean {
  return (
    fees.platformFee >= 0 &&
    fees.paymentFee >= 0 &&
    fees.shippingFee >= 0 &&
    fees.totalFees >= 0 &&
    fees.feePercentage >= 0 &&
    fees.feePercentage <= 100
  );
}

/**
 * Format fees for display
 */
export function formatFees(fees: FeeCalculation): string {
  return `Platform: $${(fees.platformFee / 100).toFixed(2)} (${fees.feePercentage.toFixed(1)}%), Payment: $${(fees.paymentFee / 100).toFixed(2)}, Shipping: $${(fees.shippingFee / 100).toFixed(2)}, Total: $${(fees.totalFees / 100).toFixed(2)}`;
}

/**
 * Calculate fee trends over time (for historical analysis)
 */
export function calculateFeeTrends(
  historicalFees: Array<{ date: Date; fees: FeeCalculation }>
): {
  averageFeePercentage: number;
  feeVolatility: number;
  trend: 'increasing' | 'decreasing' | 'stable';
} {
  if (historicalFees.length === 0) {
    return {
      averageFeePercentage: 0,
      feeVolatility: 0,
      trend: 'stable',
    };
  }
  
  const feePercentages = historicalFees.map(h => h.fees.feePercentage);
  const averageFeePercentage = feePercentages.reduce((sum, fee) => sum + fee, 0) / feePercentages.length;
  
  // Calculate volatility (standard deviation)
  const variance = feePercentages.reduce((sum, fee) => sum + Math.pow(fee - averageFeePercentage, 2), 0) / feePercentages.length;
  const feeVolatility = Math.sqrt(variance);
  
  // Determine trend
  const sortedFees = historicalFees.sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstHalf = sortedFees.slice(0, Math.floor(sortedFees.length / 2));
  const secondHalf = sortedFees.slice(Math.floor(sortedFees.length / 2));
  
  const firstHalfAvg = firstHalf.reduce((sum, h) => sum + h.fees.feePercentage, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, h) => sum + h.fees.feePercentage, 0) / secondHalf.length;
  
  let trend: 'increasing' | 'decreasing' | 'stable';
  const difference = secondHalfAvg - firstHalfAvg;
  
  if (Math.abs(difference) < 0.1) {
    trend = 'stable';
  } else if (difference > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }
  
  return {
    averageFeePercentage: Math.round(averageFeePercentage * 100) / 100,
    feeVolatility: Math.round(feeVolatility * 100) / 100,
    trend,
  };
}
