"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedPrisma = void 0;
exports.upsertCardByKey = upsertCardByKey;
exports.upsertListing = upsertListing;
exports.insertCompSale = insertCompSale;
exports.saveFeatureSnapshot = saveFeatureSnapshot;
exports.saveSignal = saveSignal;
const client_1 = require("@prisma/client");
// If a caller doesn't provide a Prisma instance, use a shared one.
const sharedPrisma = new client_1.PrismaClient();
exports.sharedPrisma = sharedPrisma;
function langToName(lang) {
    const l = (lang || 'EN').toUpperCase();
    if (l === 'EN' || l === 'ENG' || l === 'ENGLISH')
        return 'English';
    return 'English';
}
async function upsertCardByKey(prisma, key, name) {
    // Our canonical Card has unique([set, number, variant, grade])
    const set = key.setCode;
    const number = key.number;
    const variant = key.variantKey || '';
    const language = langToName(key.language);
    const existing = await prisma.card.findFirst({
        where: { set, number, variant, grade: null },
    });
    if (existing) {
        if (existing.name !== name ||
            existing.language !== language ||
            existing.setCode !== set ||
            existing.variantKey !== variant) {
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
async function upsertListing(prisma, data) {
    const card = await upsertCardByKey(prisma, data.cardKey, `${data.cardKey.setCode} ${data.cardKey.number}`);
    return prisma.marketListing.upsert({
        where: { source_sourceId: { source: data.source, sourceId: data.sourceId } },
        update: {
            cardId: card.id,
            priceCents: data.priceCents,
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
            currency: data.currency,
            condition: data.condition,
            grade: data.grade ?? null,
            url: data.url,
            seenAt: data.seenAt,
            isActive: true,
        },
    });
}
async function insertCompSale(prisma, sale) {
    return prisma.compSale.create({
        data: {
            cardId: sale.cardId,
            source: sale.source,
            externalId: sale.externalId ?? null,
            priceCents: sale.priceCents,
            currency: sale.currency,
            soldAt: sale.soldAt,
            raw: sale.raw ?? null,
        },
    });
}
// Save or update FeatureSnapshot by (cardId, windowDays)
async function saveFeatureSnapshot(prisma, snap) {
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
async function saveSignal(prisma, sig) {
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
