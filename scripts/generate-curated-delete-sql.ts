#!/usr/bin/env tsx
/**
 * Generate SQL cleanup statements for curated test cards.
 *
 * Reads scripts/traffic-generator-cards.json and prints two SQL options:
 *  - Option A: Delete only rows for curated cards (by name, set, cardNumber)
 *  - Option B: Delete ALL rows from market_listings (use with caution)
 *
 * Usage:
 *   pnpm tsx scripts/generate-curated-delete-sql.ts > /tmp/curated_cleanup.sql
 *   psql "$DATABASE_URL" -f /tmp/curated_cleanup.sql
 */

import fs from 'fs/promises';
import path from 'path';

type Card = { name: string; set: string; cardNumber: string };

function esc(s: string) {
  return s.replace(/'/g, "''");
}

function toLowerTuple(c: Card) {
  return `('${esc(c.name.toLowerCase())}','${esc(c.set.toLowerCase())}','${esc(c.cardNumber)}')`;
}

async function main() {
  const cardsPath = path.join(process.cwd(), 'scripts', 'traffic-generator-cards.json');
  const raw = await fs.readFile(cardsPath, 'utf-8');
  const cards: Card[] = JSON.parse(raw);

  // Deduplicate tuples
  const seen = new Set<string>();
  const tuples: string[] = [];
  for (const c of cards) {
    const key = `${c.name}\u0000${c.set}\u0000${c.cardNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tuples.push(toLowerTuple(c));
  }

  const values = tuples.join(',\n    ');

  const optionA = `-- Option A: Delete only curated test rows from market_listings\n` +
`-- Safe: removes rows for the curated cards (by name, set, cardNumber)\n` +
`BEGIN;\n\n` +
`WITH curated(name, set, num) AS (\n` +
`  VALUES\n    ${values}\n` +
`)\n` +
`DELETE FROM market_listings ml\n` +
`USING curated c\n` +
`WHERE lower(ml."cardName") = c.name\n` +
`  AND lower(ml."setName") = c.set\n` +
`  AND ml."cardNumber" = c.num;\n\n` +
`-- Optional: verify how many rows remain\n` +
`-- SELECT COUNT(*) FROM market_listings;\n\n` +
`COMMIT;\n`;

  const optionB = `\n-- Option B: Delete ALL market_listings (use with caution)\n` +
`-- Only run this if market_listings contains test data only\n` +
`BEGIN;\n` +
`DELETE FROM market_listings;\n` +
`COMMIT;\n`;

  // Print both options
  process.stdout.write(optionA + optionB);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

