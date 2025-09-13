import { PrismaClient } from '@prisma/client';
import { composeTraderTake } from '../bot/x/composerPersona.ts';

const prisma = new PrismaClient();

async function main() {
  const PROOF_BASE_URL = process.env.PROOF_BASE_URL || 'http://localhost:3000';
  const minEdgeBp = Number(process.env.POST_MIN_EDGE_BP || 700);
  const minConf = Number(process.env.POST_MIN_CONF || 0.55);
  const limit = Number(process.env.POST_LIMIT || 10);

  const sigs = await prisma.signal.findMany({
    where: {
      thesis: { not: '' },
      edgeBp: { gte: minEdgeBp },
      confidence: { gte: minConf },
    },
    orderBy: [{ edgeBp: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { card: true, marketListing: true },
  });

  let created = 0;
  for (const s of sigs) {
    const edgePct = Number((s.edgeBp / 100).toFixed(1));
    const confPct = Math.round(s.confidence * 100);
    const slugPart = (x: string) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const setCode = s.card?.setCode || s.card?.set || '';
    const number = s.card?.number || '';
    const variant = (s.card?.variantKey || 'EN').toLowerCase();
    const cardSlug = `${slugPart(setCode)}-${slugPart(number)}-${slugPart(variant)}`;
    const text = composeTraderTake({
      name: s.card?.name ?? '',
      setCode: s.card?.setCode ?? s.card?.set ?? '',
      number: s.card?.number ?? '',
      edgePct,
      confPct,
      thesis: s.thesis || '',
      link: s.marketListing?.url || `${PROOF_BASE_URL}/signals/${s.id}/proof`,
    });

    const payload = {
      text,
      links: {
        listing: s.marketListing?.url || '',
        proof: `${PROOF_BASE_URL}/signals/${s.id}/proof`,
      },
      meta: {
        signalId: s.id,
        edgeBp: s.edgeBp,
        confidence: s.confidence,
        cardSlug,
      },
    };

    await prisma.postQueue.create({
      data: {
        signalId: s.id,
        payload,
        status: 'PENDING',
        scheduledAt: new Date(),
      },
    });
    created++;
  }

  console.log(JSON.stringify({ candidates: sigs.length, enqueued: created }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
