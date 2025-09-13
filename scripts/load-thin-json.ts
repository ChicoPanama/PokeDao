import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { mapRawListingToCanonical, mapRawCompToCanonical } from './map-raw';
import { upsertCardByKey, upsertListing, insertCompSale } from '../packages/shared/db';

const prisma = new PrismaClient();

type Opts = { listings?: string; comps?: string; limit?: number; source?: string };
function parseArgs(): Opts {
  const args = process.argv.slice(2);
  const get = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const listings = get('--listings');
  const comps = get('--comps');
  const limit = get('--limit') ? Number(get('--limit')) : undefined;
  const source = get('--source') || 'Ebay';
  if (!listings && !comps) {
    throw new Error('Usage: tsx scripts/load-thin-json.ts [--listings listings.json] [--comps comps.json] [--limit N] [--source Name]');
  }
  return { listings, comps, limit, source };
}

function readJson(path: string): any[] {
  const raw = fs.readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items;
  throw new Error(`Expected array or {items: []} in ${path}`);
}

async function main() {
  const { listings, comps, limit, source } = parseArgs();
  console.log(`[thin-json] source=${source} limit=${limit || 'ALL'} listings=${!!listings} comps=${!!comps}`);

  if (listings) {
    const arr = readJson(listings);
    let listOk = 0, listDup = 0, listErr = 0;
    for (const raw of (limit ? arr.slice(0, limit) : arr)) {
      try {
        const { canonical, rawImport } = await mapRawListingToCanonical(raw, source);
        await prisma.rawImport.create({ data: rawImport as any });
        const card = await upsertCardByKey(prisma, canonical.cardKey, raw.name || `${canonical.cardKey.setCode} ${canonical.cardKey.number}`);
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
        if (msg.includes('Unique constraint failed') || msg.includes('unique constraint')) listDup++; else listErr++;
      }
    }
    console.log(`[thin-json] listings ok=${listOk} dup=${listDup} err=${listErr}`);
  }

  if (comps) {
    const arr = readJson(comps);
    let compOk = 0, compDup = 0, compErr = 0;
    for (const raw of (limit ? arr.slice(0, limit) : arr)) {
      try {
        const { canonical, rawImport } = mapRawCompToCanonical(raw, source + 'Sold');
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
        if (msg.includes('Unique constraint failed') || msg.includes('unique constraint')) compDup++; else compErr++;
      }
    }
    console.log(`[thin-json] comps ok=${compOk} dup=${compDup} err=${compErr}`);
  }

  await prisma.$disconnect();
  console.log('[thin-json] done');
}

main().catch((e) => { console.error(e); process.exit(1); });
