import crypto from 'node:crypto';

export type CardKey = {
  setCode: string;
  number: string;
  variantKey: string;
  language?: string;
};

export function stableHash(obj: unknown) {
  // Deterministic JSON: sort keys shallowly
  const replacer = (_key: string, value: any) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((acc: Record<string, any>, k) => {
          acc[k] = value[k];
          return acc;
        }, {});
    }
    return value;
  };
  const json = JSON.stringify(obj, replacer);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
}

// Canonical Card key tuple
export function cardKey(setCode: string, number: string, variantKey: string, language = 'EN'): CardKey {
  return { setCode, number, variantKey: variantKey || '', language: language || 'EN' };
}

// CompSale dedupe key if no externalId
export function compNaturalKey(input: {
  source: string;
  setCode: string;
  number: string;
  variantKey: string;
  language: string;
  soldAt: string | Date;
  priceCents: number;
  currency: string;
}) {
  const soldAtIso = new Date(input.soldAt).toISOString().slice(0, 19);
  const base = {
    source: input.source,
    setCode: input.setCode,
    number: input.number,
    variantKey: input.variantKey || '',
    language: (input.language || 'EN').toUpperCase(),
    soldAt: soldAtIso,
    priceCents: input.priceCents,
    currency: input.currency,
  };
  return stableHash(base);
}

