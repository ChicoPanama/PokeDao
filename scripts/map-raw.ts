import { cardKey, compNaturalKey, stableHash } from '../packages/shared/keys';

// Minimal variant key builder; replace with domain logic as needed
function buildVariantKey(input: {
  edition?: string | null;
  shadowless?: boolean;
  holo?: boolean;
  reverse?: boolean;
  language?: string;
}) {
  const parts = [
    (input.edition || '').toString().trim(),
    input.shadowless ? 'shadowless' : '',
    input.holo ? 'holo' : '',
    input.reverse ? 'reverse' : '',
    (input.language || 'EN').toUpperCase(),
  ].filter(Boolean);
  return parts.join('|');
}

export type RawListing = any;
export type RawComp = any;

export function mapRawListingToCanonical(raw: RawListing, source: string) {
  const setCode = raw.setCode || raw.set || '';
  const number = raw.number || raw.cardNumber || '';
  const vkey = buildVariantKey({
    edition: raw.edition === 1 ? '1st' : raw.edition,
    shadowless: !!raw.shadowless,
    holo: !!raw.holo,
    reverse: !!raw.reverse,
    language: (raw.language || 'EN').toUpperCase(),
  });
  const cKey = cardKey(setCode, number, vkey, (raw.language || 'EN').toUpperCase());

  const canonical = {
    cardKey: cKey,
    source,
    sourceId: String(raw.id ?? raw.itemId ?? raw.sourceId ?? stableHash({ source, id: raw.id ?? raw.itemId ?? '', url: raw.url ?? '' })),
    priceCents: Number(raw.priceCents ?? Math.round((raw.price || 0) * 100)),
    currency: String(raw.currency || 'USD'),
    condition: String(raw.condition || 'Unknown'),
    grade: raw.grade ? String(raw.grade) : null,
    url: String(raw.url || raw.link || ''),
    seenAt: new Date(raw.seenAt || raw.timestamp || Date.now()),
  };

  const rawImport = {
    table: 'MarketListing',
    source,
    sourceId: String(canonical.sourceId),
    payload: raw,
    dedupKey: stableHash({ source, type: 'listing', id: canonical.sourceId }),
  };

  return { canonical, rawImport };
}

export function mapRawCompToCanonical(raw: RawComp, source: string) {
  const setCode = raw.setCode || raw.set || '';
  const number = raw.number || raw.cardNumber || '';
  const vkey = buildVariantKey({
    edition: raw.edition === 1 ? '1st' : raw.edition,
    shadowless: !!raw.shadowless,
    holo: !!raw.holo,
    reverse: !!raw.reverse,
    language: (raw.language || 'EN').toUpperCase(),
  });
  const cKey = cardKey(setCode, number, vkey, (raw.language || 'EN').toUpperCase());

  const externalId = raw.saleId || raw.transactionId || raw.externalId || null;
  const payload = {
    cardKey: cKey,
    source,
    externalId,
    priceCents: Number(raw.priceCents ?? Math.round((raw.price || 0) * 100)),
    currency: String(raw.currency || 'USD'),
    soldAt: new Date(raw.soldAt || raw.endTime || raw.date || Date.now()),
    raw,
  };

  const dedupKey = externalId
    ? null
    : compNaturalKey({
        source,
        setCode,
        number,
        variantKey: vkey,
        language: cKey.language || 'EN',
        soldAt: payload.soldAt,
        priceCents: payload.priceCents,
        currency: payload.currency,
      });

  const rawImport = {
    table: 'CompSale',
    source,
    sourceId: externalId || undefined,
    payload: raw,
    dedupKey: dedupKey || stableHash({ source, type: 'comp', fallback: payload }),
  };

  return { canonical: payload, rawImport };
}

