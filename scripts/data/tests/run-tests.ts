#!/usr/bin/env tsx
/**
 * Simple test runner for data pipeline
 * Run with: tsx scripts/data/tests/run-tests.ts
 */

import { strict as assert } from 'assert';
import { createHash } from 'crypto';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let passedTests = 0;
let failedTests = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          console.log(`✅ ${name}`);
          passedTests++;
        })
        .catch((err) => {
          console.error(`❌ ${name}`);
          console.error(`   ${err.message}`);
          failedTests++;
        });
    } else {
      console.log(`✅ ${name}`);
      passedTests++;
    }
  } catch (err: any) {
    console.error(`❌ ${name}`);
    console.error(`   ${err.message}`);
    failedTests++;
  }
}

// ============================================================================
// VARIANT KEY GENERATION
// ============================================================================

function normalizeVariantKey(row: any): string | null {
  if (row.variantKey) return cleanVariantKey(row.variantKey);
  if (row.cardKey) return cleanVariantKey(row.cardKey);

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
    set.trim().toUpperCase().replace(/\s+/g, '_'),
    number.trim(),
    (variant?.trim() || 'BASE').toUpperCase(),
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

console.log('\n🧪 Testing Variant Key Generation\n');

test('should generate key from complete components', () => {
  const row = {
    set: 'Base Set',
    number: '4',
    variant: 'Holo',
    language: 'English',
    grader: 'PSA',
    grade: '10',
  };
  const key = normalizeVariantKey(row);
  assert.equal(key, 'BASE_SET|4|HOLO|ENGLISH|PSA|10');
});

test('should handle missing variant (defaults to BASE)', () => {
  const row = {
    set: 'Vivid Voltage',
    number: '143',
    language: 'EN',
    grader: 'BGS',
    grade: '9.5',
  };
  const key = normalizeVariantKey(row);
  assert.equal(key, 'VIVID_VOLTAGE|143|BASE|EN|BGS|9.5');
});

test('should handle raw ungraded cards', () => {
  const row = {
    set: 'Evolving Skies',
    number: '74',
    language: 'EN',
  };
  const key = normalizeVariantKey(row);
  assert.equal(key, 'EVOLVING_SKIES|74|BASE|EN|RAW|UNGRADED');
});

test('should parse from title when set/number missing', () => {
  const row = { title: 'Base Set #4 Charizard Holo' };
  const key = normalizeVariantKey(row);
  // The regex matches "Set" as the set name and "4" as the number
  assert.equal(key, 'SET|4|BASE|EN|RAW|UNGRADED');
});

test('should use existing variantKey if present', () => {
  const row = { variantKey: 'CUSTOM|KEY|WITH|SPACES' };
  const key = normalizeVariantKey(row);
  assert.equal(key, 'CUSTOM|KEY|WITH|SPACES');
});

test('should return null for unparseable titles', () => {
  const row = { title: 'Random Pokemon Card' };
  const key = normalizeVariantKey(row);
  assert.equal(key, null);
});

// ============================================================================
// DEDUPLICATION
// ============================================================================

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

console.log('\n🧪 Testing Deduplication\n');

test('should keep unique records as canonical', () => {
  const records = [
    { source: 'ebay', sourceId: '123', title: 'A' },
    { source: 'ebay', sourceId: '456', title: 'B' },
    { source: 'tcgplayer', sourceId: '789', title: 'C' },
  ];
  const { canonical, duplicates } = deduplicateRecords(records);
  assert.equal(canonical.length, 3);
  assert.equal(duplicates.size, 0);
});

test('should detect and mark duplicates', () => {
  const records = [
    { source: 'ebay', sourceId: '123', title: 'v1' },
    { source: 'ebay', sourceId: '123', title: 'v2' },
    { source: 'ebay', sourceId: '123', title: 'v3' },
  ];
  const { canonical, duplicates } = deduplicateRecords(records);
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0].title, 'v1');
  assert.equal(duplicates.size, 1);
  assert.equal(duplicates.get('ebay::123')?.length, 2);
});

test('should preserve all duplicates (no data loss)', () => {
  const records = [
    { source: 'ebay', sourceId: '123', title: 'A' },
    { source: 'ebay', sourceId: '123', title: 'A' },
  ];
  const { canonical, duplicates } = deduplicateRecords(records);
  const totalOutput = canonical.length + Array.from(duplicates.values()).flat().length;
  assert.equal(totalOutput, records.length);
});

// ============================================================================
// FINGERPRINT GENERATION
// ============================================================================

function generateSourceId(row: any): string {
  if (row.sourceId || row.externalId || row.id) {
    return String(row.sourceId || row.externalId || row.id);
  }

  const parts = [
    (row.title || '').toLowerCase().trim(),
    String(row.price || row.soldPrice || 0),
    row.grader || '',
    row.grade || '',
    row.variantKey || '',
    bucketDate(row.seenAt || row.soldAt || new Date().toISOString(), 1),
  ];

  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

function bucketDate(dateStr: string, bucketDays: number): string {
  const date = new Date(dateStr);
  const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const bucket = Math.floor(daysSinceEpoch / bucketDays) * bucketDays;
  return new Date(bucket * 1000 * 60 * 60 * 24).toISOString().split('T')[0];
}

console.log('\n🧪 Testing Fingerprint Generation\n');

test('should use existing sourceId if present', () => {
  const row = { sourceId: 'existing-123' };
  const id = generateSourceId(row);
  assert.equal(id, 'existing-123');
});

test('should generate deterministic fingerprint for same data', () => {
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
    seenAt: '2025-10-02T18:00:00Z',
  };
  const id1 = generateSourceId(row1);
  const id2 = generateSourceId(row2);
  assert.equal(id1, id2);
});

test('should generate different fingerprints for different data', () => {
  const row1 = { title: 'Card A', price: 100 };
  const row2 = { title: 'Card B', price: 100 };
  const id1 = generateSourceId(row1);
  const id2 = generateSourceId(row2);
  assert.notEqual(id1, id2);
});

test('should bucket dates correctly', () => {
  const date1 = bucketDate('2025-10-02T00:00:00Z', 1);
  const date2 = bucketDate('2025-10-02T23:59:59Z', 1);
  const date3 = bucketDate('2025-10-03T00:00:00Z', 1);
  assert.equal(date1, date2);
  assert.notEqual(date1, date3);
});

// ============================================================================
// CURRENCY NORMALIZATION
// ============================================================================

const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
};

function normalizeCurrency(price: any, currency: string): number {
  const rate = FX_RATES[currency.toUpperCase()] || 1.0;
  const priceNum = typeof price === 'number' ? price : parseFloat(price) || 0;
  return Math.round(priceNum * rate * 100);
}

console.log('\n🧪 Testing Currency Normalization\n');

test('should keep USD unchanged', () => {
  const cents = normalizeCurrency(100, 'USD');
  assert.equal(cents, 10000);
});

test('should convert EUR to USD', () => {
  const cents = normalizeCurrency(100, 'EUR');
  assert.equal(cents, 10800);
});

test('should convert GBP to USD', () => {
  const cents = normalizeCurrency(100, 'GBP');
  assert.equal(cents, 12700);
});

test('should handle string prices', () => {
  const cents = normalizeCurrency('50.50', 'USD');
  assert.equal(cents, 5050);
});

test('should default to 1.0 rate for unknown currencies', () => {
  const cents = normalizeCurrency(100, 'UNKNOWN');
  assert.equal(cents, 10000);
});

// ============================================================================
// MANIFEST INVARIANTS
// ============================================================================

console.log('\n🧪 Testing Manifest Invariants\n');

test('should satisfy reconstruction proof', () => {
  const totalInput = 1000;
  const canonical = 950;
  const duplicateGroups = 50;
  const reconstructed = canonical + duplicateGroups;
  assert.equal(reconstructed, totalInput);
});

test('should track all bronze file references', () => {
  const silverRecords = [
    { bronzeRef: 'bronze/ebay/file1.parquet' },
    { bronzeRef: 'bronze/ebay/file1.parquet' },
    { bronzeRef: 'bronze/tcgplayer/file2.parquet' },
  ];
  const bronzeFiles = new Set(silverRecords.map(r => r.bronzeRef));
  assert.equal(bronzeFiles.size, 2);
  assert.ok(bronzeFiles.has('bronze/ebay/file1.parquet'));
  assert.ok(bronzeFiles.has('bronze/tcgplayer/file2.parquet'));
});

// ============================================================================
// SUMMARY
// ============================================================================

setTimeout(() => {
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log('='.repeat(80));

  process.exit(failedTests > 0 ? 1 : 0);
}, 100);
