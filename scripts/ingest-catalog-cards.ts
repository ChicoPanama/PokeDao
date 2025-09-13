import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { upsertCardByKey } from '../packages/shared/db';
import { cardKey } from '../packages/shared/keys';

type CardRow = { set_id: string; number: string; name?: string };

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2] || 'data/research/tcg_catalog_cards.json';
  const raw = fs.readFileSync(file, 'utf8');
  const rows = JSON.parse(raw) as CardRow[];
  let ok = 0,
    err = 0;
  for (const r of rows) {
    try {
      const ck = cardKey(r.set_id, r.number, '', 'EN');
      await upsertCardByKey(prisma as any, ck, r.name || `${r.set_id} ${r.number}`);
      ok++;
    } catch {
      err++;
    }
  }
  console.log(`[ingest-catalog-cards] ok=${ok} err=${err}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

