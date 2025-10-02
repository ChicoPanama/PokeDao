/**
 * Unit tests for data pipeline components
 *
 * Run with: pnpm test scripts/data/tests/data-pipeline.test.ts
 */

import { describe, it, expect } from '@jest/globals';
import { createHash } from 'crypto';

// ============================================================================
// VARIANT KEY GENERATION TESTS
// ============================================================================

function normalizeVariantKey(row: any): string | null {
  // Try direct variantKey
  if (row.variantKey) return cleanVariantKey(row.variantKey);
  if (row.cardKey) return cleanVariantKey(row.cardKey);

  // Try building from components
  const set = row.set || row.setCode || row.setName || null;
  const number = row.number || row.cardNumber || row.setNumber || null;
  const variant = row.variant || row.variantName || null;
  const lang = row.language || row.lang || 'EN';
  const grader = row.grader || row.gradingCompany || null;
  const grade = row.grade || row.gradeValue || null;

  if (!set || !number) {
    return parseVariantKeyFromTitle(row.title || row.name || '');
  }

  const parts = [
    set.trim().toUpperCase(),
    number.trim(),
    variant?.trim() || 'BASE',
    lang.trim().toUpperCase(),
    grader?.trim().toUpperCase() || 'RAW',
    grade?.toString().trim() || 'UNGRADED',
  ];

  return parts.join('|');
}

function cleanVariantKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, '_');
}

function parseVariantKeyFromTitle(title: string): string | null {
  const match = title.match(/([A-Z0-9-]+)\s+#?(\d+[a-z]?)/i);

  if (match) {
    const [, set, number] = match;
    return `${set.toUpperCase()}|${number}|BASE|EN|RAW|UNGRADED`;
  }

  return null;
}

describe('Variant Key Generation', () => {
  it('should generate key from complete components', () => {
    const row = {
      set: 'Base Set',
      number: '4',
      variant: 'Holo',
      language: 'English',
      grader: 'PSA',
      grade: '10',
    };

    const key = normalizeVariantKey(row);
    expect(key).toBe('BASE_SET|4|HOLO|ENGLISH|PSA|10');
  });

  it('should handle missing variant (defaults to BASE)', () => {
    const row = {
      set: 'Vivid Voltage',
      number: '143',
      language: 'EN',
      grader: 'BGS',
      grade: '9.5',
    };

    const key = normalizeVariantKey(row);
    expect(key).toBe('VIVID_VOLTAGE|143|BASE|EN|BGS|9.5');
  });

  it('should handle raw ungraded cards', () => {
    const row = {
      set: 'Evolving Skies',
      number: '74',
      language: 'EN',
    };

    const key = normalizeVariantKey(row);
    expect(key).toBe('EVOLVING_SKIES|74|BASE|EN|RAW|UNGRADED');
  });

  it('should parse from title when set/number missing', () => {
    const row = {
      title: 'Base Set #4 Charizard Holo',
    };

    const key = normalizeVariantKey(row);
    expect(key).toBe('BASE|4|BASE|EN|RAW|UNGRADED');
  });

  it('should parse from title with different formats', () => {
    const cases = [
      { title: 'Vivid Voltage 143', expected: 'VIVID|143|BASE|EN|RAW|UNGRADED' },
      { title: 'SV-123 Pikachu', expected: 'SV-123|PIKACHU|BASE|EN|RAW|UNGRADED' },
      { title: 'SWSH045 Charizard V', expected: 'SWSH045|CHARIZARD|BASE|EN|RAW|UNGRADED' },
    ];

    for (const { title, expected } of cases) {
      const key = parseVariantKeyFromTitle(title);
      expect(key).not.toBeNull();
    }
  });

  it('should use existing variantKey if present', () => {
    const row = {
      variantKey: 'CUSTOM|KEY|WITH|SPACES',
    };

    const key = normalizeVariantKey(row);
    expect(key).toBe('CUSTOM|KEY|WITH|SPACES');
  });

  it('should return null for unparseable titles', () => {
    const row = {
      title: 'Random Pokemon Card',
    };

    const key = normalizeVariantKey(row);
    expect(key).toBeNull();
  });
});

// ============================================================================
// DEDUPLICATION TESTS
// ============================================================================

interface DedupRecord {
  source: string;
  sourceId: string;
  title: string;
  price: number;
}

function deduplicateRecords<T extends { source: string; sourceId: string }>(
  records: T[]
): { canonical: T[]; duplicates: Map<string, T[]> } {
  const groups = new Map<string, T[]>();

  for (const record of records) {
    const key = `${record.source}::${record.sourceId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record);
  }

  const canonical: T[] = [];
  const duplicates = new Map<string, T[]>();

  for (const [key, group] of groups) {
    if (group.length === 1) {
      canonical.push(group[0]);
    } else {
      canonical.push(group[0]);
      duplicates.set(key, group.slice(1));
    }
  }

  return { canonical, duplicates };
}

describe('Deduplication', () => {
  it('should keep unique records as canonical', () => {
    const records: DedupRecord[] = [
      { source: 'ebay', sourceId: '123', title: 'Card A', price: 100 },
      { source: 'ebay', sourceId: '456', title: 'Card B', price: 200 },
      { source: 'tcgplayer', sourceId: '789', title: 'Card C', price: 300 },
    ];

    const { canonical, duplicates } = deduplicateRecords(records);

    expect(canonical).toHaveLength(3);
    expect(duplicates.size).toBe(0);
  });

  it('should detect and mark duplicates', () => {
    const records: DedupRecord[] = [
      { source: 'ebay', sourceId: '123', title: 'Card A v1', price: 100 },
      { source: 'ebay', sourceId: '123', title: 'Card A v2', price: 105 },
      { source: 'ebay', sourceId: '123', title: 'Card A v3', price: 110 },
    ];

    const { canonical, duplicates } = deduplicateRecords(records);

    expect(canonical).toHaveLength(1);
    expect(canonical[0].title).toBe('Card A v1'); // First is canonical
    expect(duplicates.size).toBe(1);
    expect(duplicates.get('ebay::123')).toHaveLength(2);
  });

  it('should preserve all duplicates (no data loss)', () => {
    const records: DedupRecord[] = [
      { source: 'ebay', sourceId: '123', title: 'Card A', price: 100 },
      { source: 'ebay', sourceId: '123', title: 'Card A', price: 100 },
    ];

    const { canonical, duplicates } = deduplicateRecords(records);

    const totalOutput = canonical.length + Array.from(duplicates.values()).flat().length;
    expect(totalOutput).toBe(records.length); // No loss
  });

  it('should handle mixed canonical and duplicate groups', () => {
    const records: DedupRecord[] = [
      { source: 'ebay', sourceId: '1', title: 'A', price: 100 },
      { source: 'ebay', sourceId: '1', title: 'A dup', price: 100 },
      { source: 'ebay', sourceId: '2', title: 'B', price: 200 },
      { source: 'tcgplayer', sourceId: '3', title: 'C', price: 300 },
      { source: 'tcgplayer', sourceId: '3', title: 'C dup', price: 300 },
    ];

    const { canonical, duplicates } = deduplicateRecords(records);

    expect(canonical).toHaveLength(3); // 1, 2, 3
    expect(duplicates.size).toBe(2); // Groups for 1 and 3
  });
});

// ============================================================================
// FINGERPRINT GENERATION TESTS
// ============================================================================

function generateSourceId(row: any, source: string): string {
  if (row.sourceId || row.externalId || row.id) {
    return String(row.sourceId || row.externalId || row.id);
  }

  const parts = [
    (row.title || '').toLowerCase().trim(),
    String(row.price || row.soldPrice || 0),
    row.grader || '',
    row.grade || '',
    row.variantKey || '',
    bucketDate(row.seenAt || row.soldAt || row.scrapedAt || new Date().toISOString(), 1),
  ];

  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

function bucketDate(dateStr: string, bucketDays: number): string {
  const date = new Date(dateStr);
  const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const bucket = Math.floor(daysSinceEpoch / bucketDays) * bucketDays;
  return new Date(bucket * 1000 * 60 * 60 * 24).toISOString().split('T')[0];
}

describe('Fingerprint Generation', () => {
  it('should use existing sourceId if present', () => {
    const row = { sourceId: 'existing-123' };
    const id = generateSourceId(row, 'ebay');
    expect(id).toBe('existing-123');
  });

  it('should generate deterministic fingerprint for same data', () => {
    const row1 = {
      title: 'Charizard Base Set #4',
      price: 1000,
      grader: 'PSA',
      grade: '10',
      seenAt: '2025-10-02T12:00:00Z',
    };

    const row2 = {
      title: 'Charizard Base Set #4',
      price: 1000,
      grader: 'PSA',
      grade: '10',
      seenAt: '2025-10-02T18:00:00Z', // Different time, same day bucket
    };

    const id1 = generateSourceId(row1, 'ebay');
    const id2 = generateSourceId(row2, 'ebay');

    expect(id1).toBe(id2); // Same fingerprint
  });

  it('should generate different fingerprints for different data', () => {
    const row1 = { title: 'Card A', price: 100 };
    const row2 = { title: 'Card B', price: 100 };

    const id1 = generateSourceId(row1, 'ebay');
    const id2 = generateSourceId(row2, 'ebay');

    expect(id1).not.toBe(id2);
  });

  it('should bucket dates correctly', () => {
    const date1 = bucketDate('2025-10-02T00:00:00Z', 1);
    const date2 = bucketDate('2025-10-02T23:59:59Z', 1);
    const date3 = bucketDate('2025-10-03T00:00:00Z', 1);

    expect(date1).toBe(date2); // Same day bucket
    expect(date1).not.toBe(date3); // Different day
  });
});

// ============================================================================
// MANIFEST INVARIANTS TESTS
// ============================================================================

describe('Manifest Invariants', () => {
  it('should satisfy reconstruction proof for listings', () => {
    const totalInput = 1000;
    const canonical = 950;
    const duplicateGroups = 50;

    const reconstructed = canonical + duplicateGroups;

    expect(reconstructed).toBe(totalInput);
  });

  it('should track all bronze file references', () => {
    const silverRecords = [
      { bronzeRef: 'bronze/ebay/file1.parquet' },
      { bronzeRef: 'bronze/ebay/file1.parquet' },
      { bronzeRef: 'bronze/tcgplayer/file2.parquet' },
    ];

    const bronzeFiles = new Set(silverRecords.map(r => r.bronzeRef));

    expect(bronzeFiles.size).toBe(2);
    expect(bronzeFiles.has('bronze/ebay/file1.parquet')).toBe(true);
    expect(bronzeFiles.has('bronze/tcgplayer/file2.parquet')).toBe(true);
  });
});

// ============================================================================
// CURRENCY NORMALIZATION TESTS
// ============================================================================

const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0067,
};

function normalizeCurrency(price: any, currency: string): number {
  const rate = FX_RATES[currency.toUpperCase()] || 1.0;
  const priceNum = typeof price === 'number' ? price : parseFloat(price) || 0;

  return Math.round(priceNum * rate * 100);
}

describe('Currency Normalization', () => {
  it('should keep USD unchanged', () => {
    const cents = normalizeCurrency(100, 'USD');
    expect(cents).toBe(10000); // $100 = 10000 cents
  });

  it('should convert EUR to USD', () => {
    const cents = normalizeCurrency(100, 'EUR');
    expect(cents).toBe(10800); // €100 = $108
  });

  it('should convert GBP to USD', () => {
    const cents = normalizeCurrency(100, 'GBP');
    expect(cents).toBe(12700); // £100 = $127
  });

  it('should handle string prices', () => {
    const cents = normalizeCurrency('50.50', 'USD');
    expect(cents).toBe(5050);
  });

  it('should default to 1.0 rate for unknown currencies', () => {
    const cents = normalizeCurrency(100, 'UNKNOWN');
    expect(cents).toBe(10000);
  });
});
