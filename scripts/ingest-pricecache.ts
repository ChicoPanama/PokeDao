import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

type AnchorRow = {
  setCode: string;
  number: string;
  market?: number;
  low?: number;
  mid?: number;
  high?: number;
  directLow?: number | null;
};

const prisma = new PrismaClient();

async function upsertPrice(cardId: string, sourceType: string, priceType: string, price?: number | null) {
  if (price == null || !Number.isFinite(price)) return;
  await prisma.priceCache.create({
    data: {
      cardId,
      sourceType,
      priceType,
      price,
      currency: 'USD',
      confidence: 0.0,
      sampleSize: 0,
      timestamp: new Date(),
    },
  });
}

async function main() {
  const file = process.argv[2] || 'data/research/tcgplayer_anchors.json';
  const sourceType = process.argv[3] || 'tcgplayer';
  const raw = fs.readFileSync(file, 'utf8');
  const arr = JSON.parse(raw) as AnchorRow[];
  let linked = 0, skipped = 0;
  for (const r of arr) {
    const card = await prisma.card.findFirst({
      where: { set: r.setCode, number: r.number, variant: null, grade: null },
      select: { id: true },
    });
    if (!card) { skipped++; continue; }
    await upsertPrice(card.id, sourceType, 'market', r.market);
    await upsertPrice(card.id, sourceType, 'low', r.low);
    await upsertPrice(card.id, sourceType, 'mid', r.mid);
    await upsertPrice(card.id, sourceType, 'high', r.high);
    if (r.directLow !== undefined) await upsertPrice(card.id, sourceType, 'directLow', r.directLow);
    linked++;
  }
  console.log(`[ingest-pricecache] linked=${linked} skipped=${skipped}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

