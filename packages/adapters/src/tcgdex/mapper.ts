/**
 * TCGdex Mapper
 *
 * Maps TCGdex SDK responses to PokeDAO internal types.
 * Generates cardKey, image URLs, and normalized metadata.
 */

import type { TCGdexCardResponse, TCGdexSetResponse } from './client.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TCGdexCanonicalCard {
  tcgdexId: string;       // Global ID (e.g., "base1-4")
  localId: string;        // Card number within set (e.g., "4")
  name: string;
  setId: string;          // Set ID (e.g., "base1")
  setName: string;
  cardKey: string;        // Normalized grouping key
  rarity: string | null;
  category: string | null;
  illustrator: string | null;
  hp: number | null;
  types: string[];        // e.g., ["Fire", "Water"]
  stage: string | null;   // e.g., "Basic", "Stage1", "Stage2"
  imageUrl: string | null;
  variants: {
    firstEdition?: boolean;
    holo?: boolean;
    normal?: boolean;
    reverse?: boolean;
  } | null;
}

export interface TCGdexCanonicalSet {
  id: string;
  name: string;
  logo: string | null;
  releaseDate: string | null;
  totalCards: number | null;
}

// ============================================================================
// MAPPER
// ============================================================================

/**
 * Generate a cardKey from name and set name.
 * Follows the existing pattern in the codebase.
 */
export function generateCardKey(name: string, setName: string): string {
  return `${name}-${setName}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Build image URL from TCGdex CDN.
 */
export function buildImageUrl(setId: string, localId: string, language: string = 'en'): string {
  return `https://assets.tcgdex.net/${language}/${setId}/${localId}/high.png`;
}

/**
 * Get all image URL candidates for a card.
 */
export function getImageCandidates(
  setId: string,
  localId: string,
  language: 'en' | 'ja' = 'en'
): string[] {
  return [
    `https://assets.tcgdex.net/${language}/${setId}/${localId}/high.png`,
    `https://assets.tcgdex.net/${language}/${setId}/${localId}/low.png`,
    `https://assets.tcgdex.net/${language}/${setId}/${localId}.png`,
    `https://images.pokemontcg.io/${setId}/${localId}.png`,
    `https://images.pokemontcg.io/${setId}/${localId}_hires.png`,
  ];
}

/**
 * Map a TCGdex card response to our canonical card type.
 */
export function mapToCanonicalCard(card: TCGdexCardResponse): TCGdexCanonicalCard {
  const setId = card.set?.id ?? '';
  const setName = card.set?.name ?? '';

  return {
    tcgdexId: card.id,
    localId: card.localId,
    name: card.name,
    setId,
    setName,
    cardKey: generateCardKey(card.name, setName),
    rarity: card.rarity ?? null,
    category: card.category ?? null,
    illustrator: card.illustrator ?? null,
    hp: card.hp ?? null,
    types: card.types ?? [],
    stage: card.stage ?? null,
    imageUrl: setId ? buildImageUrl(setId, card.localId) : null,
    variants: card.variants ?? null,
  };
}

/**
 * Map a TCGdex set response to our canonical set type.
 */
export function mapToCanonicalSet(set: TCGdexSetResponse): TCGdexCanonicalSet {
  return {
    id: set.id,
    name: set.name,
    logo: (set as any).logo ?? null,
    releaseDate: (set as any).releaseDate ?? null,
    totalCards: (set as any).cardCount?.total ?? null,
  };
}
