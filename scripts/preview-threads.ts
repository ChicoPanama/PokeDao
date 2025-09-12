import { PrismaClient } from '@prisma/client';
import { composeQuickHit } from '../bot/src/x/composer.ts';

const prisma = new PrismaClient();

(async () => {
  const sigs = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { card: true, marketListing: true },
  });
  for (const s of sigs) {
    const payload = composeQuickHit({
      cardName: s.card.name,
      setCode: s.card.setCode || s.card.set || '',
      number: s.card.number || '',
      edgeBp: s.edgeBp,
      confidence: s.confidence,
      thesis: s.thesis || '—',
      links: { listing: s.marketListing?.url || '', audit: `https://example.local/signals/${s.id}/proof` },
    });
    console.log(JSON.stringify(payload, null, 2));
  }
  await prisma.$disconnect();
})();

