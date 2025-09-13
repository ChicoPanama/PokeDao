import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

function now() { return new Date(); }

async function alreadyPostedInLastHour() {
  const since = new Date(Date.now() - 3600_000);
  return prisma.postQueue.count({ where: { status: 'POSTED', createdAt: { gte: since } } });
}

async function postedCardSlugIn24h(slug: string) {
  const since = new Date(Date.now() - 24 * 3600_000);
  const rows = await prisma.postQueue.findMany({
    where: { status: 'POSTED', createdAt: { gte: since } },
    select: { payload: true },
  });
  return rows.some((r) => (r as any).payload?.meta?.cardSlug === slug);
}

async function main() {
  const PAPER_MODE = String(process.env.PAPER_MODE || 'true') === 'true';
  const TARGET = (process.env.POSTER_TARGET || 'console').toLowerCase();
  const RATE_LIMIT_PER_HOUR = Number(process.env.POST_RATE_LIMIT || 2);

  const postedCount = await alreadyPostedInLastHour();
  if (postedCount >= RATE_LIMIT_PER_HOUR) {
    console.log(`[poster] rate-limited: already posted ${postedCount} in last hour`);
    await prisma.$disconnect();
    return;
  }

  const pending = await prisma.postQueue.findMany({
    where: { status: 'PENDING' },
    orderBy: { scheduledAt: 'asc' },
    take: RATE_LIMIT_PER_HOUR - postedCount,
  });
  let posted = 0, skipped = 0;
  for (const p of pending) {
    const payload = p.payload as any;
    const slug = payload?.meta?.cardSlug || '';
    if (slug && (await postedCardSlugIn24h(slug))) {
      await prisma.postQueue.update({ where: { id: p.id }, data: { status: 'SKIPPED' } });
      skipped++;
      continue;
    }

    if (PAPER_MODE || TARGET === 'console') {
      console.log('[poster] DRY-RUN:', payload.text);
      await prisma.postQueue.update({ where: { id: p.id }, data: { status: 'POSTED' } });
      posted++;
      continue;
    }

    if (TARGET === 'x') {
      // TODO: integrate real X client here
      console.log('[poster] X stub:', payload.text);
      await prisma.postQueue.update({ where: { id: p.id }, data: { status: 'POSTED' } });
      posted++;
      continue;
    }

    // Unknown target
    await prisma.postQueue.update({ where: { id: p.id }, data: { status: 'SKIPPED' } });
    skipped++;
  }
  console.log(JSON.stringify({ posted, skipped }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

