/**
 * Courtyard Data Mapper
 *
 * Maps Courtyard API responses to PokeDAO unified format
 */

import type { CourtyardListing, CourtyardCollection } from './client.js';

export interface CourtyardUnifiedListing {
  source: 'COURTYARD';
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
}

/**
 * Parse card info from listing title
 */
function parseCardInfo(title: string): {
  cardName: string;
  setName?: string;
  cardNumber?: string;
} {
  // Common patterns:
  // "Charizard #4/102 Base Set PSA 10"
  // "Pikachu 025/165 151 BGS 9.5"

  let cardName = title;
  let setName: string | undefined;
  let cardNumber: string | undefined;

  // Extract card number
  const numberMatch = title.match(/[#]?(\d+\/\d+)/);
  if (numberMatch) {
    cardNumber = numberMatch[1];
    cardName = cardName.replace(numberMatch[0], '').trim();
  }

  // Common set names
  const setPatterns = [
    'Base Set', 'Jungle', 'Fossil', 'Team Rocket',
    'Gym Heroes', 'Gym Challenge', 'Neo Genesis',
    'Neo Discovery', 'Neo Revelation', 'Neo Destiny',
    'Legendary Collection', 'Expedition', 'Aquapolis', 'Skyridge',
    'EX Ruby & Sapphire', 'EX Sandstorm', 'EX Dragon',
    'Scarlet & Violet', 'Paldea Evolved', 'Obsidian Flames',
    '151', 'Prismatic Evolutions', 'Surging Sparks',
    'Crown Zenith', 'Silver Tempest', 'Lost Origin',
  ];

  for (const set of setPatterns) {
    if (title.includes(set)) {
      setName = set;
      cardName = cardName.replace(set, '').trim();
      break;
    }
  }

  // Clean up grade info from card name
  cardName = cardName
    .replace(/PSA\s*\d+\.?\d*/gi, '')
    .replace(/BGS\s*\d+\.?\d*/gi, '')
    .replace(/CGC\s*\d+\.?\d*/gi, '')
    .replace(/SGC\s*\d+\.?\d*/gi, '')
    .trim();

  return { cardName, setName, cardNumber };
}

/**
 * Map Courtyard listing to unified format
 */
export function mapListing(listing: CourtyardListing): CourtyardUnifiedListing {
  const { cardName, setName, cardNumber } = parseCardInfo(listing.title);

  return {
    source: 'COURTYARD',
    sourceId: listing.id,
    title: listing.title,
    cardName,
    setName,
    cardNumber,
    gradeCompany: listing.gradeCompany,
    grade: listing.grade,
    condition: listing.condition,
    priceCents: Math.round(listing.priceUsd * 100),
    currency: 'USD',
    url: `https://courtyard.io/listing/${listing.id}`,
    dataQuality: listing.gradeCompany ? 0.9 : 0.7, // Graded cards have better data
  };
}

/**
 * Map multiple listings
 */
export function mapListings(listings: CourtyardListing[]): CourtyardUnifiedListing[] {
  return listings
    .filter(l => l.isActive)
    .map(mapListing);
}
