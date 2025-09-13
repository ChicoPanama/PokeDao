import type { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';

const PROOF_BASE_URL = process.env.PROOF_BASE_URL || 'http://localhost:3000';

function sparklineUrl(xs: number[]) {
  const data = encodeURIComponent(JSON.stringify(xs));
  return `https://quickchart.io/chart?c={"type":"sparkline","data":{"datasets":[{"data":${data}}]}}`;
}

export async function registerSignals(app: FastifyInstance) {
  // GET /signals/latest
  app.get('/signals/latest', async (req, reply) => {
    const q = (req.query || {}) as Record<string, string | undefined>;
    const debug = q.debug === '1' || q.debug === 'true';
    const sort = (q.sort || 'edge').toLowerCase(); // edge|conf|recent
    const limit = Number.isFinite(Number(q.limit)) ? Number(q.limit) : 20;
    const includeBlank = q.include_blank === '1' || q.include_blank === 'true';

    // Validate/clamp params
    const minEdge = q.min_edge !== undefined ? Number(q.min_edge) : 0; // basis points
    const minConf = q.min_conf !== undefined ? Number(q.min_conf) : 0; // 0..1
    const minNhi = q.min_nhi !== undefined ? Number(q.min_nhi) : 0; // 0..100
    const minPriceUsd = q.min_price_usd !== undefined ? Number(q.min_price_usd) : 0; // dollars

    const validSort = sort === 'edge' || sort === 'conf' || sort === 'recent';
    if (!validSort ||
        !Number.isFinite(minEdge) || minEdge < 0 ||
        !Number.isFinite(minConf) || minConf < 0 || minConf > 1 ||
        !Number.isFinite(minNhi) || minNhi < 0 || minNhi > 100 ||
        !Number.isFinite(minPriceUsd) || minPriceUsd < 0 ||
        !Number.isFinite(limit) || limit < 1 || limit > 100) {
      reply.code(400);
      return reply.send({ error: 'invalid_params' });
    }

    const orderBy =
      sort === 'conf'
        ? [{ confidence: 'desc' as const }, { createdAt: 'desc' as const }]
        : sort === 'recent'
        ? [{ createdAt: 'desc' as const }]
        : [{ edgeBp: 'desc' as const }, { createdAt: 'desc' as const }];

    // Fetch extra to accommodate later de-dup by cardId
    const rawTake = Math.min(200, Math.max(limit, limit * 3));
    const rows = await prisma.signal.findMany({
      where: {
        ...(Number.isFinite(minEdge) && minEdge > 0 ? { edgeBp: { gte: minEdge } } : {}),
        ...(Number.isFinite(minConf) && minConf > 0 ? { confidence: { gte: minConf } } : {}),
        ...(!includeBlank ? { thesis: { not: '' } } : {}),
      },
      orderBy: orderBy as any,
      take: rawTake,
      include: { card: true, marketListing: true },
    });

    // Optional min_nhi filter based on latest 30d FeatureSnapshot
    let filtered = rows;
    if (Number.isFinite(minNhi) && minNhi > 0) {
      const cardIds = Array.from(new Set(rows.map((r) => r.cardId)));
      const snaps = await prisma.featureSnapshot.findMany({
        where: { cardId: { in: cardIds }, windowDays: 30 },
        select: { cardId: true, nhiScore: true },
      });
      const nhiMap = new Map(snaps.map((s) => [s.cardId, s.nhiScore ?? 0]));
      filtered = rows.filter((r) => (nhiMap.get(r.cardId) ?? 0) >= minNhi);
    }

    // Optional min_price_usd filter based on listing ask (USD-normalized if available)
    if (Number.isFinite(minPriceUsd) && minPriceUsd > 0) {
      const cents = Math.round(minPriceUsd * 100);
      filtered = filtered.filter((r) => {
        const L = r.marketListing as any;
        if (!L) return false;
        const ask = (L.priceCentsUsd ?? L.priceCents) as number | undefined;
        return typeof ask === 'number' && ask >= cents;
      });
    }

    // Per-card de-dup: keep best per card according to current sort
    const seen = new Set<string>();
    const deduped: typeof filtered = [];
    for (const r of filtered) {
      if (seen.has(r.cardId)) continue;
      seen.add(r.cardId);
      deduped.push(r);
      if (deduped.length >= limit) break;
    }

    // Optional: include nhiScore when debug=1
    let nhiDebugMap: Map<string, number> | undefined;
    if (debug && deduped.length) {
      const cids = deduped.map((d) => d.cardId);
      const snaps = await prisma.featureSnapshot.findMany({
        where: { cardId: { in: cids }, windowDays: 30 },
        select: { cardId: true, nhiScore: true },
      });
      nhiDebugMap = new Map(snaps.map((s) => [s.cardId, s.nhiScore ?? 0]));
    }

    const out = deduped.map((s) => {
      const edgePctNum = Number((s.edgeBp / 100).toFixed(1));
      const edgePctStr = `${s.edgeBp >= 0 ? '+' : ''}${edgePctNum}%`;
      const setCode = s.card?.setCode ?? s.card?.set ?? '';
      const number = s.card?.number ?? '';
      const variant = (s.card?.variantKey ?? 'EN').toLowerCase();
      const slugPart = (x: string) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const cardSlug = `${slugPart(setCode)}-${slugPart(number)}-${slugPart(variant)}`;
      return {
        id: s.id,
        cardName: s.card?.name ?? '',
        setCode,
        number,
        variantKey: s.card?.variantKey ?? '',
        cardSlug,
        edgePct: edgePctNum,
        edgePctStr,
        confidence: Number(s.confidence.toFixed(2)),
        thesis: s.thesis,
        ...(debug && nhiDebugMap ? { nhiScore: nhiDebugMap.get(s.cardId) ?? null } : {}),
        listingUrl: s.marketListing?.url ?? '',
        proofUrl: `${PROOF_BASE_URL}/signals/${s.id}/proof`,
      };
    });

    return reply.send(out);
  });

  // GET /signals/:id/proof
  app.get('/signals/:id/proof', async (req, reply) => {
    const id = String((req.params as any).id);

    const sig = await prisma.signal.findUnique({
      where: { id },
      include: { card: true, marketListing: true },
    });
    if (!sig) return reply.code(404).send({ error: 'not found' });

    const f30 = await prisma.featureSnapshot.findUnique({
      where: { cardId_windowDays: { cardId: sig.cardId, windowDays: 30 } },
    });

    const comps = await prisma.compSale.findMany({
      where: { cardId: sig.cardId },
      orderBy: { soldAt: 'desc' },
      take: 5,
      select: { priceCents: true, currency: true, soldAt: true, source: true },
    });

    const series = f30 ? [f30.p05Cents, f30.medianCents, f30.p95Cents] : [];
    const spark = series.length ? sparklineUrl(series) : null;

    return reply.send({
      id: sig.id,
      card: {
        name: sig.card?.name ?? '',
        setCode: sig.card?.setCode ?? sig.card?.set ?? '',
        number: sig.card?.number ?? '',
        variantKey: sig.card?.variantKey ?? '',
      },
      listing: sig.marketListing && {
        source: sig.marketListing.source,
        priceCents: sig.marketListing.priceCents,
        currency: sig.marketListing.currency,
        condition: sig.marketListing.condition,
        grade: sig.marketListing.grade,
        url: sig.marketListing.url,
        seenAt: sig.marketListing.seenAt,
      },
      features30d: f30 && {
        medianCents: f30.medianCents,
        p05Cents: f30.p05Cents,
        p95Cents: f30.p95Cents,
        volume: f30.volume,
        volatilityBp: f30.volatilityBp,
        updatedAt: f30.updatedAt,
      },
      comps,
      thesis: sig.thesis,
      sparklineUrl: spark,
    });
  });
}
