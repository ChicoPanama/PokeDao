import { PrismaClient } from '@prisma/client';
import { saveFeatureSnapshot } from '@pokedao/shared';

const prisma = new PrismaClient();

function median(sorted: number[]) {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = Math.floor(((p / 100) * (sorted.length - 1)));
  return sorted[i];
}

function volatilityBp(sorted: number[]) {
  if (sorted.length < 2) return 0;
  let acc = 0, n = 0;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    if (a > 0) { acc += Math.abs((b - a) / a); n++; }
  }
  return Math.round((acc / Math.max(1, n)) * 10000);
}

async function centsSeries(cardId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const rows = await prisma.compSale.findMany({
    where: { cardId, soldAt: { gte: since } },
    select: { priceCents: true, priceCentsUsd: true },
    orderBy: { soldAt: 'desc' },
  });
  return rows.map((r) => (r as any).priceCentsUsd ?? r.priceCents);
}

export async function computeFeatureForCard(cardId: string, windowDays: 7 | 30 | 90) {
  const cents = await centsSeries(cardId, windowDays);
  if (cents.length < 3) return null;
  const sorted = [...cents].sort((a, b) => a - b);
  const snap = {
    cardId,
    windowDays,
    medianCents: median(sorted),
    p95Cents: pct(sorted, 95),
    p05Cents: pct(sorted, 5),
    volume: cents.length,
    volatilityBp: volatilityBp(sorted),
    nhiScore: null,
    updatedAt: new Date(),
  };
  await saveFeatureSnapshot(prisma, snap as any);
  return snap;
}

export async function featurizeTouchedCards({ sinceHours = 24 } = {}) {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000);
  const touched = await prisma.compSale.findMany({
    where: { soldAt: { gte: since } },
    select: { cardId: true },
    distinct: ['cardId'],
  });
  let wrote = 0;
  for (const { cardId } of touched) {
    for (const W of [7, 30, 90] as const) {
      const out = await computeFeatureForCard(cardId, W);
      if (out) wrote++;
    }
  }
  return { cards: touched.length, snapshots: wrote };
}
