export type Grade = 'RAW' | 'PSA' | 'BGS' | 'CGC' | 'SGC';

export interface NormalizedCardQuery {
  name: string;     // e.g., "Charizard"
  set: string;      // e.g., "Base Set"
  number?: string;  // e.g., "4/102"
  variant?: string; // e.g., "Holo", "Reverse"
  grade?: Grade;
  gradeNumber?: number; // e.g., 10, 9.5
  language?: string; // e.g., "EN"
}

export interface NormalizedListingIdentity extends NormalizedCardQuery {
  externalId: string; // marketplace id
  source: string;     // "collector-crypt" | "ebay" | ...
}

export function normalizeCardQuery(q: Partial<NormalizedCardQuery>): NormalizedCardQuery {
  const name = (q.name || '').trim();
  const set = (q.set || '').trim();
  return {
    name,
    set,
    number: q.number?.trim(),
    variant: q.variant?.trim(),
    grade: q.grade || 'RAW',
    gradeNumber: q.gradeNumber,
    language: q.language || 'EN',
  };
}

export function normalizeListingToCardIdentity(listing: any): NormalizedListingIdentity {
  // Very safe defaults; real parser should map real listing fields.
  const source = String(listing?.source || 'unknown');
  const externalId = String(listing?.externalId || listing?.id || '');
  const name = String(listing?.name || listing?.title || '').trim();
  const set = String(listing?.set || '').trim();
  const number = listing?.number ? String(listing.number) : undefined;
  const variant = listing?.variant ? String(listing.variant) : undefined;
  const language = listing?.language ? String(listing.language) : 'EN';
  return {
    source,
    externalId,
    name,
    set,
    number,
    variant,
    grade: 'RAW',
    language,
  };
}
