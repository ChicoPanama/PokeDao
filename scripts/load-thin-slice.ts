import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { mapRawListingToCanonical, mapRawCompToCanonical } from './map-raw';
import { upsertCardByKey, upsertListing, insertCompSale } from '../packages/shared/db';

const prisma = new PrismaClient();

type Opts = { from: string; limit?: number };
function parseArgs(): Opts {
  const fromIdx = process.argv.indexOf('--from');
  if (fromIdx < 0) throw new Error('Usage: node scripts/load-thin-slice.ts --from ./data/pokedao.sqlite [--limit 10000]');
  const from = process.argv[fromIdx + 1];
  const limIdx = process.argv.indexOf('--limit');
  const limit = limIdx > -1 ? Number(process.argv[limIdx + 1]) : undefined;
  return { from, limit };
}

async function main() {
  const { from, limit } = parseArgs();
  const db = new Database(from, { readonly: true });
  console.log(`[thin-load] source=${from} limit=${limit || 'ALL'}`);

  // 1) Listings sample
  const listStmt = db.prepare(`SELECT * FROM Listings ${limit ? 'LIMIT ?' : ''}`);
  const listings = listStmt.all(limit ? [limit] : undefined);

  let listOk = 0,
    listDup = 0,
    listErr = 0;
  for (const raw of listings) {
    try {
      const { canonical, rawImport } = mapRawListingToCanonical(raw, raw.source || 'Ebay');
      // audit copy
      await prisma.rawImport.create({ data: rawImport as any });

      await upsertListing(prisma, {
        cardKey: canonical.cardKey,
        source: canonical.source,
        sourceId: canonical.sourceId,
        priceCents: canonical.priceCents,
        currency: canonical.currency,
        condition: canonical.condition,
        grade: canonical.grade,
        url: canonical.url,
        seenAt: canonical.seenAt,
      });

      listOk++;
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('Unique constraint failed') || msg.includes('unique constraint')) listDup++;
      else listErr++;
    }
  }
  console.log(`[thin-load] listings ok=${listOk} dup=${listDup} err=${listErr}`);

  // 2) Sold comps sample
  const compStmt = db.prepare(`SELECT * FROM SoldComps ${limit ? 'LIMIT ?' : ''}`);
  const comps = compStmt.all(limit ? [limit] : undefined);

  let compOk = 0,
    compDup = 0,
    compErr = 0;
  for (const raw of comps) {
    try {
      const { canonical, rawImport } = mapRawCompToCanonical(raw, raw.source || 'EbaySold');
      await prisma.rawImport.create({ data: rawImport as any });

      const card = await upsertCardByKey(prisma, canonical.cardKey, raw.name || `${canonical.cardKey.setCode} ${canonical.cardKey.number}`);
      await insertCompSale(prisma, {
        cardId: card.id,
        source: canonical.source,
        priceCents: canonical.priceCents,
        currency: canonical.currency,
        soldAt: canonical.soldAt,
        externalId: canonical.externalId ?? null,
        raw: canonical.raw,
      });

      compOk++;
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('Unique constraint failed') || msg.includes('unique constraint')) compDup++;
      else compErr++;
    }
  }
  console.log(`[thin-load] comps ok=${compOk} dup=${compDup} err=${compErr}`);

  await prisma.$disconnect();
  console.log('[thin-load] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
