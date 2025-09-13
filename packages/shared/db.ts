import { PrismaClient } from '@prisma/client';
import type { CardKey } from './keys.js';
import { toUSD } from './money.js';

// If a caller doesn't provide a Prisma instance, use a shared one.
const sharedPrisma = new PrismaClient();

function langToName(lang?: string) {
  const l = (lang || 'EN').toUpperCase();
  if (l === 'EN' || l === 'ENG' || l === 'ENGLISH') return 'English';
  return 'English';
}

export async function upsertCardByKey(prisma: PrismaClient, key: CardKey, name: string) {
  // Our canonical Card has unique([set, number, variant, grade])
  const set = key.setCode;
  const number = key.number;
  const variant = key.variantKey || '';
  const language = langToName(key.language);

  const existing = await prisma.card.findFirst({
    where: { set, number, variant, grade: null },
  });
  if (existing) {
    if (
      existing.name !== name ||
      existing.language !== language ||
      existing.setCode !== set ||
      existing.variantKey !== variant
    ) {
      return prisma.card.update({
        where: { id: existing.id },
        data: { name, language, setCode: set, variantKey: variant },
      });
    }
    return existing;
  }

  return prisma.card.create({
    data: {
      name,
      set,
      number,
      variant,
      grade: null,
      condition: null,
      language,
      setCode: set,
      variantKey: variant,
      category: 'Pokemon',
    },
  });
}

export async function upsertListing(
  prisma: PrismaClient,
  data: {
    cardKey: CardKey;
    source: string;
    sourceId: string; // natural listing id from source (e.g., eBay itemId)
    priceCents: number;
    currency: string;
    condition: string;
    grade?: string | null;
    url: string;
    seenAt: Date;
  },
) {
  const priceCentsUsd = await toUSD(prisma, data.priceCents, data.currency);
  const card = await upsertCardByKey(
    prisma,
    data.cardKey,
    `${data.cardKey.setCode} ${data.cardKey.number}`,
  );

  return prisma.marketListing.upsert({
    where: { source_sourceId: { source: data.source, sourceId: data.sourceId } },
    update: {
      cardId: card.id,
      priceCents: data.priceCents,
      priceCentsUsd,
      currency: data.currency,
      condition: data.condition,
      grade: data.grade ?? null,
      url: data.url,
      seenAt: data.seenAt,
      isActive: true,
    },
    create: {
      cardId: card.id,
      source: data.source,
      sourceId: data.sourceId,
      priceCents: data.priceCents,
      priceCentsUsd,
      currency: data.currency,
      condition: data.condition,
      grade: data.grade ?? null,
      url: data.url,
      seenAt: data.seenAt,
      isActive: true,
    },
  });
}

export async function insertCompSale(
  prisma: PrismaClient,
  sale: {
    cardId: string;
    source: string;
    priceCents: number;
    currency: string;
    soldAt: Date;
    externalId?: string | null;
    raw?: any;
  },
) {
  const priceCentsUsd = await toUSD(prisma, sale.priceCents, sale.currency);
  return prisma.compSale.create({
    data: {
      cardId: sale.cardId,
      source: sale.source,
      externalId: sale.externalId ?? null,
      priceCents: sale.priceCents,
      priceCentsUsd,
      currency: sale.currency,
      soldAt: sale.soldAt,
      raw: sale.raw ?? null,
    },
  });
}

export { sharedPrisma };

// Save or update FeatureSnapshot by (cardId, windowDays)
export async function saveFeatureSnapshot(
  prisma: PrismaClient,
  snap: {
    cardId: string;
    windowDays: number;
    medianCents: number;
    p95Cents: number;
    p05Cents: number;
    volume: number;
    volatilityBp: number;
    nhiScore?: number | null;
    updatedAt?: Date;
  },
) {
  return prisma.featureSnapshot.upsert({
    where: { cardId_windowDays: { cardId: snap.cardId, windowDays: snap.windowDays } },
    update: {
      medianCents: snap.medianCents,
      p95Cents: snap.p95Cents,
      p05Cents: snap.p05Cents,
      volume: snap.volume,
      volatilityBp: snap.volatilityBp,
      nhiScore: snap.nhiScore ?? null,
      updatedAt: snap.updatedAt ?? new Date(),
    },
    create: {
      cardId: snap.cardId,
      windowDays: snap.windowDays,
      medianCents: snap.medianCents,
      p95Cents: snap.p95Cents,
      p05Cents: snap.p05Cents,
      volume: snap.volume,
      volatilityBp: snap.volatilityBp,
      nhiScore: snap.nhiScore ?? null,
      updatedAt: snap.updatedAt ?? new Date(),
    },
  });
}

// Create a Signal row (paper mode)
export async function saveSignal(
  prisma: PrismaClient,
  sig: {
    cardId: string;
    listingId?: string | null;
    kind: string;
    edgeBp: number;
    confidence: number;
    thesis?: string;
  },
) {
  return prisma.signal.create({
    data: {
      cardId: sig.cardId,
      listingId: sig.listingId ?? null,
      kind: sig.kind,
      edgeBp: Math.round(sig.edgeBp),
      confidence: Math.max(0, Math.min(1, sig.confidence)),
      thesis: sig.thesis ?? '',
    },
  });
}
