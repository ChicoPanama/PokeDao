import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function jitter(base: number, pct: number) {
  const f = 1 + (Math.random() * 2 - 1) * pct;
  return Math.max(50, Math.round(base * f));
}

(async () => {
  const cards = await prisma.card.findMany({ take: 5 });
  let wrote = 0;
  const today = Date.now();
  for (const c of cards) {
    const base = 1200 + Math.floor(Math.random() * 600);
    for (let d = 1; d <= 30; d++) {
      const soldAt = new Date(today - d * 86400000);
      try {
        await prisma.compSale.create({
          data: {
            cardId: c.id,
            source: 'Synthetic',
            externalId: null,
            priceCents: jitter(base, 0.08),
            currency: 'USD',
            soldAt,
            raw: { synthetic: true },
          },
        });
        wrote++;
      } catch {}
    }
  }
  console.log(`[seed-synthetic-comps] wrote=${wrote}`);
  await prisma.$disconnect();
})();

