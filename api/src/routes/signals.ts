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
    const minEdge = Number(q.min_edge || '0'); // in basis points
    const minConf = Number(q.min_conf || '0');
    const sort = (q.sort || 'edge').toLowerCase(); // edge|conf|recent
    const take = Math.min(50, Math.max(1, Number(q.limit || '20')));
    const includeBlank = q.include_blank === '1' || q.include_blank === 'true';

    const orderBy =
      sort === 'conf'
        ? [{ confidence: 'desc' as const }, { createdAt: 'desc' as const }]
        : sort === 'recent'
        ? [{ createdAt: 'desc' as const }]
        : [{ edgeBp: 'desc' as const }, { createdAt: 'desc' as const }];

    const rows = await prisma.signal.findMany({
      where: {
        ...(Number.isFinite(minEdge) && minEdge > 0 ? { edgeBp: { gte: minEdge } } : {}),
        ...(Number.isFinite(minConf) && minConf > 0 ? { confidence: { gte: minConf } } : {}),
        ...(!includeBlank ? { thesis: { not: '' } } : {}),
      },
      orderBy: orderBy as any,
      take,
      include: { card: true, marketListing: true },
    });

    const out = rows.map((s) => {
      const edgePctNum = Number((s.edgeBp / 100).toFixed(1));
      const edgePctStr = `${s.edgeBp >= 0 ? '+' : ''}${edgePctNum}%`;
      return {
        id: s.id,
        cardName: s.card?.name ?? '',
        setCode: s.card?.setCode ?? s.card?.set ?? '',
        number: s.card?.number ?? '',
        variantKey: s.card?.variantKey ?? '',
        edgePct: edgePctNum,
        edgePctStr,
        confidence: Number(s.confidence.toFixed(2)),
        thesis: s.thesis,
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
