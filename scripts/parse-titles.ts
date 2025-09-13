import { PrismaClient } from '@prisma/client';
import { parseTitleWithQwen, parseTitleFallback } from './normalizers/titleParser';
import { upsertCardByKey } from '../packages/shared/db';
import { cardKey } from '../packages/shared/keys';

const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.marketListing.findMany({
    where: { isActive: true },
    orderBy: { seenAt: 'desc' },
    take: 200,
    include: { card: true },
  });
  let fixed = 0, skipped = 0;
  for (const L of rows) {
    // We don't persist raw title; use URL or skip if nothing plausible
    const title = L.url || '';
    if (!title) { skipped++; continue; }
    const parsed = (await parseTitleWithQwen(title).catch(()=>null)) || parseTitleFallback(title);
    if (!parsed || parsed.confidence < 0.65) { skipped++; continue; }
    if (L.card && L.card.setCode && L.card.number) { skipped++; continue; }

    const ck = cardKey(parsed.setCode, parsed.number, '', parsed.language);
    const card = await upsertCardByKey(prisma, ck, `${parsed.setCode} ${parsed.number}`);
    await prisma.marketListing.update({ where: { id: L.id }, data: { cardId: card.id } });
    fixed++;
  }
  console.log(`[parse-titles] fixed=${fixed} skipped=${skipped}`);
  await prisma.$disconnect();
})();

