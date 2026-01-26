/**
 * TCGdex Adapter
 *
 * Card metadata provider (no pricing).
 * Free API, no key required.
 */

export { TCGdexClient, createTCGdexClient } from './client.js';
export type { TCGdexConfig, TCGdexCardResponse, TCGdexSetResponse, TCGdexSetFullResponse } from './client.js';

export {
  mapToCanonicalCard,
  mapToCanonicalSet,
  generateCardKey,
  buildImageUrl,
  getImageCandidates,
} from './mapper.js';
export type { TCGdexCanonicalCard, TCGdexCanonicalSet } from './mapper.js';
