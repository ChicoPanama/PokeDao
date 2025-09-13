import { PrismaClient } from '@prisma/client';
import { saveSignal } from '@pokedao/shared';

const prisma = new PrismaClient();

function basisPoints(delta: number, base: number) {
  if (!base) return 0;
  return Math.round((delta / base) * 10000);
}

type Guards = { minComps: number; maxFreshDays: number; maxVolBp: number; minPriceCents: number };
const GUARDS: Guards = { minComps: 3, maxFreshDays: 14, maxVolBp: 1200, minPriceCents: 200 };

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function scoreFrom(fair: number, ask: number, comps: number, freshDays: number, volBp: number) {
  const edgeBp = basisPoints(fair - ask, fair);
  const raw = 0.6 * (edgeBp / 100) + 0.3 * Math.log(comps + 1) - 0.05 * (volBp / 100) - 0.05 * freshDays;
  const confidence = Math.max(0, Math.min(1, sigmoid(raw)));
  return { edgeBp, confidence };
}

export async function scoreListingsPaper({ limit = 200 } = {}) {
  const listings = await prisma.marketListing.findMany({
    take: limit,
    orderBy: { seenAt: 'desc' },
    include: { card: true },
  });

  let created = 0,
    dropped = 0;
  for (const L of listings) {
    const snaps = await prisma.featureSnapshot.findMany({
      where: { cardId: L.cardId, windowDays: { in: [30, 90] } },
      orderBy: { windowDays: 'desc' },
    });
    if (!snaps.length) {
      dropped++;
      continue;
    }
    const s = snaps[0];
    const fair = s.medianCents;
    const comps = s.volume;
    const vol = s.volatilityBp;

    const askCents = (L as any).priceCentsUsd ?? L.priceCents;
    const freshDays = Math.max(0, Math.floor((Date.now() - L.seenAt.getTime()) / 86400000));
    if (comps < GUARDS.minComps || freshDays > GUARDS.maxFreshDays || vol > GUARDS.maxVolBp || L.priceCents < GUARDS.minPriceCents) {
      dropped++;
      continue;
    }

    const { edgeBp, confidence } = scoreFrom(fair, askCents, comps, freshDays, vol);

    await saveSignal(prisma, {
      cardId: L.cardId,
      listingId: L.id,
      kind: edgeBp > 0 ? 'UNDERVALUED' : 'WATCH',
      edgeBp,
      confidence,
      thesis: '',
    });
    created++;
  }
  return { created, dropped };
}
