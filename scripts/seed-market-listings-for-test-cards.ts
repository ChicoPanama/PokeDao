#!/usr/bin/env tsx
/**
 * Seed MarketListing from UnifiedMarketListing for curated test cards.
 * - Attaches canonicalCardId via normalized (name|set|cardNumber) matches
 * - Uses stable id `${source}:${sourceId}` to upsert
 */
import fs from 'fs/promises';
import path from 'path';
// Reuse API prisma client
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import prisma from '../api/src/lib/prisma.js';

function norm(s?: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\w\s/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract card number (e.g., "044/185", "223/197") from text
 * Matches patterns like: 044/185, 223/197, #044/185
 */
function extractCardNumberFromText(s: string): string | null {
  const match = s.match(/\b(\d{1,3}\/\d{1,3})\b/);
  return match ? match[1] : null;
}

/**
 * Strip card number from card name
 * e.g., "Pikachu VMAX 044/185" → "Pikachu VMAX"
 *       "Charizard ex #223/197" → "Charizard ex"
 */
function stripCardNumber(s: string): string {
  return s
    // Remove explicit card numbers like "044/185"
    .replace(/\b\d{1,3}\/\d{1,3}\b/g, '')
    // Remove leading '#'
    .replace(/#\s*/g, '')
    // Remove common variant/suffix descriptors seen in titles
    .replace(/\((?:Alternate(?:\s+Full)?\s+Art|Alternate\s+Art\s+Secret)\)/gi, '')
    .replace(/\b(Full\s*Art|Rainbow|Ultra)\b/gi, '')
    // Remove platform or series prefixes
    .replace(/^Pokémon\s+/i, '')
    .replace(/^SWSH\d+:\s*/i, '')
    // Collapse extra whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function loadCuratedKeys(): Promise<Set<string>> {
  const p = path.join(process.cwd(), 'scripts', 'traffic-generator-cards.json');
  const raw = await fs.readFile(p, 'utf-8');
  const cards: Array<{ name: string; set: string; cardNumber: string }> = JSON.parse(raw);
  const keys = new Set<string>();
  for (const c of cards) {
    keys.add(`${norm(c.name)}|${norm(c.set)}|${c.cardNumber}`);
  }
  return keys;
}

async function main() {
  // CLI flags: --debug, --limit=5000
  const argv = process.argv.slice(2);
  const DEBUG = argv.includes('--debug');
  const LIMIT = (() => {
    const a = argv.find(a => a.startsWith('--limit='));
    if (!a) return 5000;
    const n = Number(a.split('=')[1]);
    return Number.isFinite(n) && n > 0 ? n : 5000;
  })();

  const curated = await loadCuratedKeys();

  const canonical = await prisma.canonicalCard.findMany({
    select: { id: true, canonicalName: true, canonicalSet: true, cardNumber: true },
  });
  const canonMap = new Map<string, string>();
  for (const c of canonical) {
    canonMap.set(`${norm(c.canonicalName)}|${norm(c.canonicalSet)}|${c.cardNumber || ''}`, c.id);
  }

  // Pull relevant unified rows (filter roughly by set/name/number tuples from curated list)
  const unified = await prisma.unifiedMarketListing.findMany({
    where: {
      OR: Array.from(curated).map((key) => {
        const [nm, st, num] = key.split('|');
        return {
          cardName: { contains: nm, mode: 'insensitive' },
          setName: { contains: st, mode: 'insensitive' },
          cardNumber: num,
        } as any;
      }),
    },
    take: LIMIT,
  });

  let upserts = 0;
  let linked = 0;
  let looseMatches = 0;
  let noMatches = 0;
  for (const u of unified) {
    // Extract and strip card number from name
    const guessedNum = u.cardNumber || extractCardNumberFromText(u.cardName || '') || '';
    const baseName = stripCardNumber(u.cardName || '');

    // Build lookup key: norm(stripped name) | norm(set) | cardNumber
    const key = `${norm(baseName)}|${norm(u.setName || '')}|${guessedNum}`;
    let canonicalCardId: string | null = canonMap.get(key) || null;
    // Fallback: if not found and we have a number, try any canonical with same name + number (looser set match)
    if (!canonicalCardId && guessedNum) {
      const looseKey = Array.from(canonMap.keys()).find(
        (k) => k.startsWith(`${norm(baseName)}|`) && k.endsWith(`|${guessedNum}`)
      );
      if (looseKey) {
        canonicalCardId = canonMap.get(looseKey) || null;
        looseMatches++;
      }
    }
    if (canonicalCardId) {
      linked++;
      if (DEBUG) {
        console.log(`[LINK] ${u.cardName} | ${u.setName} | ${guessedNum} -> ${canonicalCardId}${canonMap.has(key) ? '' : ' (loose)'} `);
      }
    } else {
      noMatches++;
      if (DEBUG) {
        console.log(`[MISS] ${u.cardName} | ${u.setName} | ${guessedNum} (key=${key})`);
      }
    }

    const row = {
      id: `${u.source}:${u.sourceId}`,
      canonicalCardId,
      source: u.source,
      sourceId: u.sourceId,
      sourceUrl: u.url || null,
      title: u.title,
      rawTitle: u.rawTitle || null,
      priceCents: u.priceCents || null,
      currency: u.currency || 'USD',
      cardName: u.cardName || null,
      setName: u.setName || null,
      cardNumber: u.cardNumber || null,
      variant: u.variant || null,
      gradeCompany: u.gradeCompany || null,
      grade: u.grade || null,
      condition: u.condition || null,
      dataQuality: u.dataQuality ?? 0.5,
      isActive: true,
      lastSeenAt: new Date(),
    };

    await prisma.marketListing.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
    upserts++;
  }

  const linkagePct = upserts > 0 ? ((linked / upserts) * 100).toFixed(1) : '0.0';
  console.log(`\n✅ Seeded/updated ${upserts} market_listings rows from UnifiedMarketListing.`);
  console.log(`📊 Linked to canonical_cards: ${linked}/${upserts} (${linkagePct}%)`);
  console.log(`   Loose matches: ${looseMatches}`);
  console.log(`   Unmatched: ${noMatches}`);
  console.log(`\nExpected linkage: >90% for curated cards`);

  if (linked < upserts * 0.9) {
    console.warn(`\n⚠️  WARNING: Linkage rate ${linkagePct}% is below 90% target`);
    console.warn(`   Check canonical_cards naming vs UnifiedMarketListing cardName format`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
