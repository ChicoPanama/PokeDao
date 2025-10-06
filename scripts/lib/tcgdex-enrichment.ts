/**
 * TCGdex Metadata Enrichment Library
 *
 * Provides feature engineering utilities for Mew-1A ML model using TCGdex metadata.
 * Implements:
 * - Rarity scoring (5x impact on pricing)
 * - Artist premium calculation
 * - Set vintage/generation scoring
 * - Character popularity ("Charizard Tax")
 * - Seasonal trend multipliers
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface TCGdexCard {
  id: string;
  localId: string;
  name: string;
  set: {
    id: string;
    name: string;
  };
  rarity?: string;
  category: string;
  illustrator?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  retreat?: number;
  variants?: {
    firstEdition?: boolean;
    holo?: boolean;
    normal?: boolean;
    reverse?: boolean;
  };
}

interface TCGdexSet {
  id: string;
  name: string;
  releaseDate?: string;
}

// Lazy-loaded metadata
let cardsMetadata: TCGdexCard[] | null = null;
let setsMetadata: TCGdexSet[] | null = null;
let nameIndex: Map<string, TCGdexCard[]> | null = null;

/**
 * Load TCGdex metadata from JSON files
 */
function loadMetadata() {
  if (cardsMetadata && setsMetadata && nameIndex) return;

  const dataDir = join(process.cwd(), 'data', 'tcgdex');

  // Load cards
  const cardsPath = join(dataDir, 'cards-metadata.json');
  cardsMetadata = JSON.parse(readFileSync(cardsPath, 'utf-8'));

  // Load sets
  const setsPath = join(dataDir, 'sets.json');
  setsMetadata = JSON.parse(readFileSync(setsPath, 'utf-8'));

  // Build name index for fast lookup
  nameIndex = new Map();
  for (const card of cardsMetadata!) {
    if (!card.name) continue; // Skip cards without names
    const normalized = normalizeCardName(card.name);
    if (!nameIndex.has(normalized)) {
      nameIndex.set(normalized, []);
    }
    nameIndex.get(normalized)!.push(card);
  }
}

/**
 * Normalize card names for matching
 */
function normalizeCardName(name: string | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find TCGdex card by name and optional set
 */
export function findTCGdexCard(cardName: string, setName?: string): TCGdexCard | null {
  loadMetadata();

  const normalized = normalizeCardName(cardName);
  const candidates = nameIndex!.get(normalized) || [];

  if (candidates.length === 0) return null;

  // If set name provided, try to match
  if (setName) {
    const normalizedSet = normalizeCardName(setName);
    const exactMatch = candidates.find(c =>
      normalizeCardName(c.set.name).includes(normalizedSet) ||
      normalizedSet.includes(normalizeCardName(c.set.name))
    );
    if (exactMatch) return exactMatch;
  }

  // Return first match (prefer oldest sets for nostalgia premium)
  return candidates[0];
}

/**
 * TIER 1 FEATURES: Rarity Scoring
 * Ultra Rare, Secret Rare, etc. are the #1 price predictors
 */
const RARITY_MULTIPLIERS: Record<string, number> = {
  // Modern era rarities
  'Secret Rare': 15.0,
  'Hyper Rare': 12.0,
  'Ultra Rare': 10.0,
  'Special Illustration Rare': 18.0,  // SIR cards are highly sought
  'Illustration Rare': 8.0,
  'Double Rare': 7.0,
  'Rare Holo': 4.0,
  'Rare': 2.5,
  'Uncommon': 1.0,
  'Common': 0.5,

  // Vintage era
  'Rare Holo VMAX': 11.0,
  'Rare Holo GX': 9.0,
  'Rare Holo EX': 8.5,
  'Rare Holo V': 7.5,
  'Rare Rainbow': 16.0,
  'Rare BREAK': 6.0,
  'Rare Prime': 7.0,
  'Rare Shining': 20.0,  // Shining cards are legendary
  'Rare ACE': 10.0,
};

export function getRarityMultiplier(rarity?: string): number {
  if (!rarity) return 1.0;
  return RARITY_MULTIPLIERS[rarity] || 1.0;
}

export function getRarityTier(rarity?: string): number {
  const multiplier = getRarityMultiplier(rarity);
  if (multiplier >= 15) return 5; // Ultra premium
  if (multiplier >= 10) return 4; // Premium
  if (multiplier >= 5) return 3;  // High
  if (multiplier >= 2) return 2;  // Medium
  return 1; // Common
}

/**
 * TIER 1 FEATURES: Artist Premium
 * Certain illustrators command 20-50% premiums
 */
const ARTIST_PREMIUMS: Record<string, number> = {
  'Mitsuhiro Arita': 1.4,        // Base Set Charizard artist - legendary
  'Ken Sugimori': 1.3,            // Original Pokemon designer
  'Kagemaru Himeno': 1.25,
  'Atsuko Nishida': 1.25,
  'Masakazu Fukuda': 1.2,
  '5ban Graphics': 1.15,          // Modern full arts
  'Kouki Saitou': 1.15,
  'PLANETA Mochizuki': 1.2,
  'Akira Egawa': 1.1,
  'Yuka Morii': 1.1,
};

export function getArtistPremium(illustrator?: string): number {
  if (!illustrator) return 1.0;
  return ARTIST_PREMIUMS[illustrator] || 1.0;
}

/**
 * TIER 1 FEATURES: Set Vintage/Generation Scoring
 * Gen 1 cards command 5-10x premiums due to nostalgia
 */
const SET_GENERATIONS: Record<string, { generation: number; vintage: number; releaseYear: number }> = {
  // Gen 1 (1996-1999) - MAXIMUM nostalgia premium
  'base1': { generation: 1, vintage: 10, releaseYear: 1999 },
  'base2': { generation: 1, vintage: 9, releaseYear: 1999 },
  'base3': { generation: 1, vintage: 9, releaseYear: 1999 },
  'base4': { generation: 1, vintage: 8, releaseYear: 2000 },
  'base5': { generation: 1, vintage: 9, releaseYear: 2000 },
  'basep': { generation: 1, vintage: 10, releaseYear: 1999 },
  'gym1': { generation: 1, vintage: 8, releaseYear: 2000 },
  'gym2': { generation: 1, vintage: 8, releaseYear: 2000 },

  // Gen 2 (2000-2002)
  'neo1': { generation: 2, vintage: 7, releaseYear: 2000 },
  'neo2': { generation: 2, vintage: 7, releaseYear: 2000 },
  'neo3': { generation: 2, vintage: 7, releaseYear: 2001 },
  'neo4': { generation: 2, vintage: 7, releaseYear: 2001 },
  'lc': { generation: 2, vintage: 8, releaseYear: 2002 },
  'ecard1': { generation: 2, vintage: 6, releaseYear: 2002 },
  'ecard2': { generation: 2, vintage: 6, releaseYear: 2003 },
  'ecard3': { generation: 2, vintage: 6, releaseYear: 2003 },

  // Gen 3 (2003-2007) - EX era
  'ex1': { generation: 3, vintage: 5, releaseYear: 2003 },
  'ex2': { generation: 3, vintage: 5, releaseYear: 2003 },
  'ex3': { generation: 3, vintage: 5, releaseYear: 2003 },
  'ex4': { generation: 3, vintage: 5, releaseYear: 2004 },
  'ex5': { generation: 3, vintage: 5, releaseYear: 2004 },
  'ex6': { generation: 3, vintage: 5, releaseYear: 2004 },
  'ex7': { generation: 3, vintage: 5, releaseYear: 2004 },
  'ex8': { generation: 3, vintage: 5, releaseYear: 2005 },
  'ex9': { generation: 3, vintage: 5, releaseYear: 2005 },
  'ex10': { generation: 3, vintage: 5, releaseYear: 2005 },
  'ex11': { generation: 3, vintage: 5, releaseYear: 2005 },
  'ex12': { generation: 3, vintage: 5, releaseYear: 2006 },
  'ex13': { generation: 3, vintage: 5, releaseYear: 2006 },
  'ex14': { generation: 3, vintage: 5, releaseYear: 2006 },
  'ex15': { generation: 3, vintage: 5, releaseYear: 2006 },
  'ex16': { generation: 3, vintage: 5, releaseYear: 2007 },

  // Gen 4 (2007-2010) - Diamond & Pearl
  'dp1': { generation: 4, vintage: 4, releaseYear: 2007 },
  'dp2': { generation: 4, vintage: 4, releaseYear: 2007 },
  'dp3': { generation: 4, vintage: 4, releaseYear: 2007 },
  'dp4': { generation: 4, vintage: 4, releaseYear: 2008 },
  'dp5': { generation: 4, vintage: 4, releaseYear: 2008 },
  'dp6': { generation: 4, vintage: 4, releaseYear: 2008 },
  'dp7': { generation: 4, vintage: 4, releaseYear: 2008 },
  'pl1': { generation: 4, vintage: 4, releaseYear: 2009 },
  'pl2': { generation: 4, vintage: 4, releaseYear: 2009 },
  'pl3': { generation: 4, vintage: 4, releaseYear: 2009 },
  'pl4': { generation: 4, vintage: 4, releaseYear: 2009 },
  'hgss1': { generation: 4, vintage: 4, releaseYear: 2010 },
  'hgss2': { generation: 4, vintage: 4, releaseYear: 2010 },
  'hgss3': { generation: 4, vintage: 4, releaseYear: 2010 },
  'hgss4': { generation: 4, vintage: 4, releaseYear: 2010 },

  // Gen 5+ (2011+) - Modern era
  'bw1': { generation: 5, vintage: 3, releaseYear: 2011 },
  'xy1': { generation: 6, vintage: 2, releaseYear: 2014 },
  'sm1': { generation: 7, vintage: 1, releaseYear: 2017 },
  'swsh1': { generation: 8, vintage: 0, releaseYear: 2020 },
  'sv01': { generation: 9, vintage: 0, releaseYear: 2023 },
};

export function getSetMetadata(setId?: string): { generation: number; vintage: number; releaseYear: number } {
  if (!setId) return { generation: 9, vintage: 0, releaseYear: 2024 };

  // Try exact match
  if (SET_GENERATIONS[setId]) return SET_GENERATIONS[setId];

  // Try prefix match for variant sets
  const prefix = setId.replace(/\d+$/, '');
  for (const [key, value] of Object.entries(SET_GENERATIONS)) {
    if (key.startsWith(prefix)) return value;
  }

  // Default to modern
  return { generation: 9, vintage: 0, releaseYear: 2024 };
}

export function getVintageMultiplier(vintage: number): number {
  // Exponential scaling for nostalgia
  if (vintage >= 9) return 8.0;   // Base Set, Jungle, Fossil
  if (vintage >= 7) return 4.0;   // Neo, e-Card era
  if (vintage >= 5) return 2.0;   // EX era
  if (vintage >= 3) return 1.5;   // DP/BW era
  return 1.0; // Modern
}

/**
 * TIER 1 FEATURES: Character Popularity ("Charizard Tax")
 * Certain Pokemon command massive premiums regardless of other factors
 */
const CHARACTER_PREMIUMS: Record<string, number> = {
  // Ultra premium tier
  'charizard': 3.5,
  'pikachu': 2.2,
  'mewtwo': 2.0,

  // Premium tier
  'blastoise': 1.8,
  'venusaur': 1.7,
  'gengar': 1.6,
  'rayquaza': 1.6,
  'lugia': 1.6,
  'mew': 1.5,

  // Popular tier
  'umbreon': 1.5,
  'espeon': 1.4,
  'gyarados': 1.4,
  'dragonite': 1.4,
  'snorlax': 1.3,
  'eevee': 1.3,
  'sylveon': 1.3,
  'vaporeon': 1.25,
  'jolteon': 1.25,
  'flareon': 1.25,
  'glaceon': 1.25,
  'leafeon': 1.25,
  'greninja': 1.3,
  'lucario': 1.25,
  'garchomp': 1.2,
  'alakazam': 1.2,
  'machamp': 1.2,
  'tyranitar': 1.2,
};

export function getCharacterPremium(cardName: string): number {
  const normalized = cardName.toLowerCase();

  for (const [character, premium] of Object.entries(CHARACTER_PREMIUMS)) {
    if (normalized.includes(character)) {
      return premium;
    }
  }

  return 1.0;
}

/**
 * TIER 1 FEATURES: Seasonal Trends
 * Holiday season = +40%, Summer = -25%
 */
export function getSeasonalMultiplier(date: Date = new Date()): number {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Holiday season (Nov-Dec)
  if (month === 11 || month === 12) return 1.35;

  // Pokemon Day (Feb 27)
  if (month === 2 && day === 27) return 1.15;

  // Summer slump (June-August)
  if (month >= 6 && month <= 8) return 0.80;

  // Back to school (September)
  if (month === 9) return 1.10;

  return 1.0;
}

/**
 * Composite feature: Calculate all enrichment features for a card
 */
export interface EnrichmentFeatures {
  // Rarity features
  rarity?: string;
  rarityTier: number;
  rarityMultiplier: number;

  // Artist features
  illustrator?: string;
  artistPremium: number;

  // Set vintage features
  generation: number;
  vintage: number;
  releaseYear: number;
  vintageMultiplier: number;

  // Character popularity
  characterPremium: number;

  // Seasonal trends
  seasonalMultiplier: number;

  // Card attributes
  hp?: number;
  stage?: string;
  types?: string[];
  retreat?: number;

  // Composite score
  totalMultiplier: number;
}

export function enrichCardFeatures(
  cardName: string,
  setName?: string,
  date: Date = new Date()
): EnrichmentFeatures {
  const tcgdexCard = findTCGdexCard(cardName, setName);
  const setMetadata = getSetMetadata(tcgdexCard?.set.id);

  const rarityMultiplier = getRarityMultiplier(tcgdexCard?.rarity);
  const artistPremium = getArtistPremium(tcgdexCard?.illustrator);
  const vintageMultiplier = getVintageMultiplier(setMetadata.vintage);
  const characterPremium = getCharacterPremium(cardName);
  const seasonalMultiplier = getSeasonalMultiplier(date);

  const totalMultiplier =
    rarityMultiplier *
    artistPremium *
    vintageMultiplier *
    characterPremium *
    seasonalMultiplier;

  return {
    rarity: tcgdexCard?.rarity,
    rarityTier: getRarityTier(tcgdexCard?.rarity),
    rarityMultiplier,

    illustrator: tcgdexCard?.illustrator,
    artistPremium,

    generation: setMetadata.generation,
    vintage: setMetadata.vintage,
    releaseYear: setMetadata.releaseYear,
    vintageMultiplier,

    characterPremium,
    seasonalMultiplier,

    hp: tcgdexCard?.hp,
    stage: tcgdexCard?.stage,
    types: tcgdexCard?.types,
    retreat: tcgdexCard?.retreat,

    totalMultiplier,
  };
}
