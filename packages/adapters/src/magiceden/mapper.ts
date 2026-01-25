/**
 * Magic Eden Data Mapper
 *
 * Maps Magic Eden NFT data to PokeDAO unified format
 */

import type { MagicEdenNFT, MagicEdenCollection } from './client.js';

export interface MagicEdenUnifiedListing {
  source: 'MAGICEDEN';
  sourceId: string;
  title: string;
  cardName: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;
  gradeCompany?: string;
  grade?: number;
  condition?: string;
  priceCents: number;
  currency: string;
  url?: string;
  dataQuality: number;
  tokenMint?: string;
}

/**
 * Parse attributes to extract card info
 */
function parseAttributes(attributes?: Array<{ trait_type: string; value: string | number }>): {
  gradeCompany?: string;
  grade?: number;
  setName?: string;
  cardNumber?: string;
  rarity?: string;
} {
  if (!attributes) return {};

  const result: any = {};

  for (const attr of attributes) {
    const type = attr.trait_type.toLowerCase();
    const value = attr.value;

    if (type.includes('grade') && type.includes('company')) {
      result.gradeCompany = String(value);
    } else if (type === 'grade' || type.includes('grade score')) {
      result.grade = typeof value === 'number' ? value : parseFloat(String(value));
    } else if (type === 'set' || type === 'set name') {
      result.setName = String(value);
    } else if (type === 'number' || type === 'card number') {
      result.cardNumber = String(value);
    } else if (type === 'rarity') {
      result.rarity = String(value);
    }
  }

  return result;
}

/**
 * Map Magic Eden NFT to unified listing format
 */
export function mapNFT(nft: MagicEdenNFT, solPrice: number): MagicEdenUnifiedListing | null {
  // Must have a price to be a valid listing
  if (!nft.listPrice && (!nft.listings || nft.listings.length === 0)) {
    return null;
  }

  const price = nft.listPrice || nft.listings?.[0]?.price || 0;
  if (price <= 0) return null;

  const priceUsd = price * solPrice;
  const attributes = parseAttributes(nft.attributes);

  return {
    source: 'MAGICEDEN',
    sourceId: nft.mintAddress,
    title: nft.name,
    cardName: nft.name.split(' - ')[0].trim(), // Often format is "Card Name - Set"
    setName: attributes.setName,
    cardNumber: attributes.cardNumber,
    gradeCompany: attributes.gradeCompany,
    grade: attributes.grade,
    priceCents: Math.round(priceUsd * 100),
    currency: 'USD',
    url: `https://magiceden.io/item-details/${nft.mintAddress}`,
    dataQuality: nft.attributes && nft.attributes.length > 3 ? 0.85 : 0.6,
    tokenMint: nft.mintAddress,
  };
}

/**
 * Map multiple NFTs to unified listings
 */
export function mapNFTs(nfts: MagicEdenNFT[], solPrice: number): MagicEdenUnifiedListing[] {
  return nfts
    .map(nft => mapNFT(nft, solPrice))
    .filter((listing): listing is MagicEdenUnifiedListing => listing !== null);
}

/**
 * Map collection stats
 */
export function mapCollection(collection: MagicEdenCollection, solPrice: number): {
  source: 'MAGICEDEN';
  sourceId: string;
  name: string;
  floorPriceUsd?: number;
  listingCount?: number;
  volumeUsd?: number;
} {
  return {
    source: 'MAGICEDEN',
    sourceId: collection.symbol,
    name: collection.name,
    floorPriceUsd: collection.floorPrice
      ? (collection.floorPrice / 1e9) * solPrice
      : undefined,
    listingCount: collection.listedCount,
    volumeUsd: collection.volumeAll
      ? (collection.volumeAll / 1e9) * solPrice
      : undefined,
  };
}
