import type { FreshListing } from './01_fetch';

// Pass-through normalization (placeholder for TitleParseCache / card normalization hooks)
export async function normalizeListings(listings: FreshListing[]) {
  return listings.filter((l) => !!l.cardId);
}

