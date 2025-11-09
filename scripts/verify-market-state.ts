#!/usr/bin/env tsx
/**
 * Verify DB state for cache-optimized testing.
 * - Prints counts for canonical_cards and market_listings (total/linked)
 * - Checks curated cards have listings
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import prisma from '../api/src/lib/prisma.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  // Basic counts
  const canonCount = await prisma.canonicalCard.count();
  const mlTotal = await prisma.marketListing.count();
  const mlLinked = await prisma.marketListing.count({ where: { NOT: { canonicalCardId: null } } });
  const linkagePct = mlTotal > 0 ? Math.round((mlLinked / mlTotal) * 1000) / 10 : 0;

  console.log('=== Database State ===');
  console.log(`canonical_cards: ${canonCount}`);
  console.log(`market_listings: total=${mlTotal}, linked=${mlLinked} (${linkagePct}%)`);

  // Load curated cards
  const cardsPath = path.join(process.cwd(), 'scripts', 'traffic-generator-cards.json');
  const raw = await fs.readFile(cardsPath, 'utf-8');
  const cards: Array<{ name: string; set: string; cardNumber: string }> = JSON.parse(raw);

  console.log('\n=== Sample Coverage (first 10 curated) ===');
  for (const c of cards.slice(0, 10)) {
    const canon = await prisma.canonicalCard.findFirst({
      where: {
        canonicalName: { equals: c.name, mode: 'insensitive' },
        canonicalSet: { contains: c.set, mode: 'insensitive' },
        cardNumber: c.cardNumber,
      },
      select: { id: true },
    });
    if (!canon) {
      console.log(`- ${c.name} (${c.cardNumber}) [${c.set}] → canonical: MISSING`);
      continue;
    }
    const listings = await prisma.marketListing.count({ where: { canonicalCardId: canon.id, isActive: true } });
    console.log(`- ${c.name} (${c.cardNumber}) [${c.set}] → canonical: OK, listings: ${listings}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

