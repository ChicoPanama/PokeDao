/**
 * TCGPlayer Data Mapper
 *
 * Maps TCGPlayer API responses to PokeDAO unified format
 */

import type { TCGPlayerProduct, TCGPlayerPrice, TCGPlayerGroup } from './client.js';

export interface TCGPlayerListing {
  source: 'TCGPLAYER';
  sourceId: string;
  title: string;
  cardName: string;
  setName: string;
  cardNumber?: string;
  variant?: string;
  gradeCompany?: string;
  grade?: number;
  condition?: string;
  priceCents: number;
  currency: string;
  url?: string;
  dataQuality: number;
}

export interface UnifiedSet {
  source: 'TCGPLAYER';
  sourceId: string;
  name: string;
  abbreviation?: string;
  releaseDate?: string;
}

/**
 * Map TCGPlayer group to unified set format
 */
export function mapGroup(group: TCGPlayerGroup): UnifiedSet {
  return {
    source: 'TCGPLAYER',
    sourceId: group.groupId.toString(),
    name: group.name,
    abbreviation: group.abbreviation,
    releaseDate: group.publishedOn,
  };
}

/**
 * Map TCGPlayer product + price to unified listing format
 */
export function mapProductWithPrice(
  product: TCGPlayerProduct,
  price: TCGPlayerPrice,
  setName?: string
): TCGPlayerListing | null {
  // Use market price, fall back to mid price
  const priceValue = price.marketPrice ?? price.midPrice ?? price.lowPrice;
  if (!priceValue || priceValue <= 0) {
    return null;
  }

  // Extract card number from extended data
  const numberData = product.extendedData?.find(d => d.name === 'Number');
  const rarityData = product.extendedData?.find(d => d.name === 'Rarity');

  // Determine condition/variant from subTypeName
  const condition = mapCondition(price.subTypeName);

  return {
    source: 'TCGPLAYER',
    sourceId: `${product.productId}-${price.subTypeName || 'default'}`,
    title: product.name,
    cardName: product.cleanName || product.name,
    setName: setName || '',
    cardNumber: numberData?.value,
    variant: rarityData?.value,
    condition,
    priceCents: Math.round(priceValue * 100),
    currency: 'USD',
    url: product.url,
    dataQuality: 0.9, // TCGPlayer is a reliable source
  };
}

/**
 * Map TCGPlayer subType to condition string
 */
function mapCondition(subTypeName?: string): string {
  if (!subTypeName) return 'Near Mint';

  const lower = subTypeName.toLowerCase();
  if (lower.includes('nm') || lower.includes('near mint')) return 'Near Mint';
  if (lower.includes('lp') || lower.includes('lightly played')) return 'Lightly Played';
  if (lower.includes('mp') || lower.includes('moderately played')) return 'Moderately Played';
  if (lower.includes('hp') || lower.includes('heavily played')) return 'Heavily Played';
  if (lower.includes('dmg') || lower.includes('damaged')) return 'Damaged';
  if (lower.includes('holofoil')) return 'Holofoil';
  if (lower.includes('reverse')) return 'Reverse Holofoil';
  if (lower.includes('1st edition')) return '1st Edition';

  return subTypeName;
}

/**
 * Map multiple products with their prices
 */
export function mapProductsWithPrices(
  products: TCGPlayerProduct[],
  prices: TCGPlayerPrice[],
  setName?: string
): TCGPlayerListing[] {
  const priceMap = new Map<number, TCGPlayerPrice[]>();

  // Group prices by product ID (can have multiple per product for different conditions)
  for (const price of prices) {
    const existing = priceMap.get(price.productId) || [];
    existing.push(price);
    priceMap.set(price.productId, existing);
  }

  const listings: TCGPlayerListing[] = [];

  for (const product of products) {
    const productPrices = priceMap.get(product.productId) || [];
    for (const price of productPrices) {
      const listing = mapProductWithPrice(product, price, setName);
      if (listing) {
        listings.push(listing);
      }
    }
  }

  return listings;
}
