import type { FreshListing } from './01_fetch.js';

// Pass-through with debug; require cardId present.
export async function normalizeListings(listings: FreshListing[]) {
  const norm = listings.filter(l => !!l.cardId);
  if (process.env.AGENT_DEBUG === 'true') {
    console.log(`[dbg][02_normalize] in=${listings.length} out=${norm.length}`);
  }
  return norm;
}

