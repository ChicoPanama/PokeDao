#!/usr/bin/env tsx
/**
 * Pre-warm API and caches for top cards and common grades.
 * - Loads top 20 cards from scripts/traffic-generator-cards.json
 * - Resolves canonicalCardId via /api/cards/search-variants
 * - Calls /api/cards/comprehensive-analysis for RAW, PSA10, PSA9
 * - Uses API_KEYS (comma-separated) for authenticated requests
 */

import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

type TestCard = {
  name: string;
  set: string;
  cardNumber: string;
};

function getApiKeys(): string[] {
  return (process.env.API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function pickKey(keys: string[], i: number): string | undefined {
  if (!keys.length) return undefined;
  return keys[i % keys.length];
}

async function resolveCanonicalId(card: TestCard, apiKey?: string): Promise<string | null> {
  const url = `${API_BASE_URL}/api/cards/search-variants?q=${encodeURIComponent(card.name)}&set=${encodeURIComponent(card.set)}&language=EN`;
  const res = await fetch(url, { headers: apiKey ? { 'x-api-key': apiKey } : undefined });
  if (!res.ok) return null;
  const data = await res.json();
  const match = (data.matches || []).find((m: any) => m.cardNumber === card.cardNumber);
  return match?.canonicalCardId || null;
}

async function warmOne(card: TestCard, canonicalCardId: string, apiKey?: string) {
  const variants: Array<{ gradeCompany: string | null; grade: number | null; label: string }> = [
    { gradeCompany: null, grade: null, label: 'RAW' },
    { gradeCompany: 'PSA', grade: 10, label: 'PSA10' },
    { gradeCompany: 'PSA', grade: 9, label: 'PSA9' },
  ];

  for (const v of variants) {
    const url = new URL(`${API_BASE_URL}/api/cards/comprehensive-analysis`);
    url.searchParams.append('canonicalCardId', canonicalCardId);
    if (v.gradeCompany) url.searchParams.append('gradeCompany', v.gradeCompany);
    if (v.grade != null) url.searchParams.append('grade', String(v.grade));
    url.searchParams.append('language', 'EN');
    const t0 = Date.now();
    const res = await fetch(url.toString(), { headers: apiKey ? { 'x-api-key': apiKey } : undefined });
    const dt = Date.now() - t0;
    if (!res.ok) {
      console.log(`✗ ${card.name} (${card.cardNumber}) ${v.label} - ${res.status} (${dt}ms)`);
    } else {
      const hit = res.headers.get('x-cache-status') === 'HIT';
      console.log(`✓ ${card.name} (${card.cardNumber}) ${v.label} - ${res.status} (${dt}ms) ${hit ? '💾' : '🔍'}`);
    }
  }
}

async function main() {
  const cardsPath = path.join(process.cwd(), 'scripts', 'traffic-generator-cards.json');
  const raw = await fs.readFile(cardsPath, 'utf-8');
  const allCards = JSON.parse(raw) as TestCard[];
  const top = allCards.slice(0, 20);
  const keys = getApiKeys();

  console.log('Pre-warming API...');
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Cards: ${top.length}`);
  console.log(`API Keys: ${keys.length}`);

  let warmed = 0;
  for (let i = 0; i < top.length; i++) {
    const card = top[i];
    const key = pickKey(keys, i);
    const cid = await resolveCanonicalId(card, key);
    if (!cid) {
      console.log(`⚠  Could not resolve canonical id for ${card.name} (${card.cardNumber})`);
      continue;
    }
    await warmOne(card, cid, key);
    warmed++;
  }

  console.log(`\nDone. Warmed ${warmed}/${top.length} cards (RAW, PSA10, PSA9 each).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

