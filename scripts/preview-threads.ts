import { PrismaClient } from '@prisma/client';
import { composeQuickHit } from '../bot/src/x/composer.ts';
import { composeTraderTake } from '../bot/x/composerPersona.ts';

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

    const edgePct = Number((s.edgeBp / 100).toFixed(1));
    const confPct = Math.round(s.confidence * 100);
    const traderLine = composeTraderTake({
      name: s.card.name,
      setCode: s.card.setCode || s.card.set || '',
      number: s.card.number || '',
      edgePct,
      confPct,
      thesis: s.thesis || '—',
      link: s.marketListing?.url || '',
    });
    console.log(traderLine);
  }
  await prisma.$disconnect();
})();
