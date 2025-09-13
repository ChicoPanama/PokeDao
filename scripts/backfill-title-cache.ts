import { PrismaClient } from '@prisma/client';
import { parseTitleWithCacheAndFallback } from './normalizers/titleParser';

const prisma = new PrismaClient();

function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<any>) {
  const queue = items.slice();
  let inFlight = 0;
  let resolve!: () => void;
  const done = new Promise<void>((res) => (resolve = res));

  let ok = 0,
    miss = 0,
    err = 0;

  function next() {
    if (!queue.length && inFlight === 0) return resolve();
    while (inFlight < limit && queue.length) {
      const t = queue.shift()!;
      inFlight++;
      fn(t)
        .then((res) => {
          ok += res ? 1 : 0;
          miss += res ? 0 : 1;
        })
        .catch(() => {
          err++;
        })
        .finally(() => {
          inFlight--;
          next();
        });
    }
  }
  next();
  return { done, stats: () => ({ ok, miss, err }) };
}

async function collectTitles(limitEach: number) {
  const titles: string[] = [];
  const q = (sql: string) => prisma.$queryRawUnsafe<{ t: string }[]>(sql);
  // Our schema stores raw titles on CompSale.raw only
  const c = await q(
    `SELECT DISTINCT (raw->>'title') AS t FROM "CompSale" WHERE raw ? 'title' AND raw->>'title' IS NOT NULL LIMIT ${limitEach}`,
  );
  for (const r of c) if (r.t) titles.push(r.t);
  return Array.from(new Set(titles));
}

(async () => {
  const max = Number(process.env.TITLE_CACHE_BACKFILL_MAX ?? 50000);
  const conc = Number(process.env.TITLE_CACHE_CONCURRENCY ?? 8);
  const titles = await collectTitles(max);
  const { done, stats } = pool(
    titles,
    conc,
    async (t) => {
      const parsed = await parseTitleWithCacheAndFallback(t);
      return !!parsed;
    },
  );
  await done;
  const s = stats();
  console.log(`[title-cache/backfill] ok=${s.ok} miss=${s.miss} err=${s.err}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
