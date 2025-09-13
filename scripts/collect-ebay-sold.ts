import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { findCompletedItems } from '../ml/src/vendors/ebayFinding';
import { insertEbaySoldBatch } from '../packages/shared/mappers/ebaySoldToComp';

const prisma = new PrismaClient();
const CATEGORIES = { pokemonSingles: '183454' };

async function buildQueries() {
  try {
    // Pull top 10 by volume (30d)
    const snaps = await prisma.featureSnapshot.findMany({
      where: { windowDays: 30 },
      include: { card: true },
      orderBy: [{ volume: 'desc' }],
      take: 10,
    });
    const qs: string[] = [];
    for (const s of snaps) {
      const setCode = s.card?.setCode || s.card?.set || '';
      const number = s.card?.number || '';
      if (setCode && number) qs.push(`pokemon ${setCode} ${number}`);
    }
    if (qs.length) return qs;
  } catch {}
  // Fallback
  return ['pokemon sv1 15', 'pokemon sv2 210'];
}

async function withRetry<T>(fn: () => Promise<T>, { retries = 3, baseMs = 500 } = {}): Promise<T> {
  let last: any;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e: any) {
      last = e;
      const status = Number(String(e?.message || '').match(/\b(\d{3})\b/)?.[1] || 0);
      // Backoff heavier on 429/5xx
      const mult = status === 429 || status >= 500 ? 3 : 1 + i;
      await new Promise((r) => setTimeout(r, baseMs * mult));
    }
  }
  throw last;
}

(async () => {
  if (!process.env.EBAY_APP_ID) {
    console.log('[ebay] EBAY_APP_ID missing; skipping collector');
    process.exit(0);
  }

  const queries = await buildQueries();
  let totalOk = 0, totalDup = 0, totalErr = 0;

  for (const q of queries) {
    try {
      const { items } = await withRetry(() => findCompletedItems({ query: q, categoryId: CATEGORIES.pokemonSingles, perPage: 100 }));
      const rows = items.filter((i: any) => i.soldAt && i.priceCents > 0);
      const res = await insertEbaySoldBatch(prisma, rows as any);
      console.log(`[ebay] "${q}" ok=${res.ok} dup=${res.dup} err=${res.err}`);
      totalOk += res.ok; totalDup += res.dup; totalErr += res.err;
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e: any) {
      console.log(`[ebay] "${q}" failed: ${e?.message || e}`);
    }
  }

  console.log(`[ebay] total ok=${totalOk} dup=${totalDup} err=${totalErr}`);
  await prisma.$disconnect();
})();
