import type { FastifyPluginAsync } from 'fastify';
import prisma from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';
import { tcgdex, type TCGdexCard } from '../lib/tcgdex.js';

const redis = getRedis();

// Add ±10% jitter to TTL to avoid synchronized cache expirations
function jitteredTTL(baseTTL: number): number {
  const jitter = baseTTL * 0.1; // 10% jitter
  return Math.floor(baseTTL + (Math.random() * 2 - 1) * jitter);
}

function trimmedMean(values: number[]): number {
  const nums = values.filter(v => Number.isFinite(v));
  if (nums.length === 0) return 0;
  if (nums.length < 3) return nums.reduce((a, b) => a + b, 0) / nums.length;
  const sorted = [...nums].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.1);
  const slice = sorted.slice(trim, sorted.length - trim);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function weekStartISO(d: Date): string {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day; // week starts Sunday
  dt.setDate(diff);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().split('T')[0];
}

function aggregateByWeek(sales: Array<{ soldAt: Date; soldPriceCents: number }>) {
  const map = new Map<string, number[]>();
  for (const s of sales) {
    const key = weekStartISO(new Date(s.soldAt));
    const list = map.get(key) || [];
    list.push((s.soldPriceCents || 0) / 100);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([week, prices]) => ({
      week,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      saleCount: prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function calculateTrend(sales: Array<{ soldAt: Date; soldPriceCents: number }>) {
  const sorted = [...sales].sort((a, b) => new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime());
  if (sorted.length < 2) return { direction: 'stable', changePct: 0, velocity: 'low' };
  const first = (sorted[0].soldPriceCents || 0) / 100;
  const last = (sorted[sorted.length - 1].soldPriceCents || 0) / 100;
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  return {
    direction: changePct > 5 ? 'up' : changePct < -5 ? 'down' : 'stable',
    changePct,
    velocity: sorted.length > 20 ? 'high' : sorted.length > 10 ? 'medium' : 'low',
  };
}

async function callMew1AShapedAnalyze(payload: {
  card_name: string;
  set_name?: string;
  listed_price?: number;
  fair_value?: number;
}): Promise<any | null> {
  const endpoint = process.env.MEW1A_CANARY_ENDPOINT || process.env.MEW1A_STABLE_ENDPOINT;
  if (!endpoint) return null;
  const url = endpoint.endsWith('/analyze') ? endpoint : endpoint.replace(/\/?$/, '/analyze');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mew1A-Variant': 'comprehensive-ui' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    } as any);
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function validateApiKey(key?: string | string[]): boolean {
  if (!key) return false;
  const provided = Array.isArray(key) ? key[0] : key;
  const list = (process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(provided);
}

async function enforceAnonRateLimit(req: any, reply: any) {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (validateApiKey(apiKey)) return; // skip anon limiter
  const ip = req.ip || 'unknown';
  const k = `rl:anon:comp:${ip}`;
  const count = await redis.incr(k);
  if (count === 1) await redis.expire(k, 3600);
  if (count > 10) {
    reply.code(429);
    throw new Error('Rate limit exceeded (anonymous tier: 10/hr). Provide X-API-Key for higher limits.');
  }
}

const cardComprehensiveRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/cards/search-variants
  fastify.get('/search-variants', {
    schema: {
      summary: 'Search and disambiguate cards by name/set',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string' },
          set: { type: 'string' },
          language: { type: 'string', enum: ['EN', 'JA'], default: 'EN' },
          limit: { type: 'number', default: 20, maximum: 50 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            query: { type: 'object' },
            matches: { type: 'array' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    preHandler: enforceAnonRateLimit,
  }, async (request, reply) => {
    const { q, set, language = 'EN', limit = 20 } = request.query as any;
    await tcgdex.load();
    const t0 = Date.now();

    const cacheKey = `search-variants:v1:${String(q).toLowerCase()}:${set || 'any'}:${language}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.metadata = { ...parsed.metadata, cached: true };
      try { (reply as any).header && reply.header('x-cache-status', 'HIT'); } catch {}
      // metrics
      try { (await import('../lib/metrics.js')).recordCacheHit('search-variants'); } catch {}
      try { (await import('../lib/metrics.js')).recordRequest('/api/cards/search-variants', 200, (Date.now() - t0) / 1000); } catch {}
      return parsed;
    }

    // DB: canonical cards
    const canon = await prisma.canonicalCard.findMany({
      where: {
        canonicalName: { contains: String(q), mode: 'insensitive' },
        ...(set ? { canonicalSet: { contains: String(set), mode: 'insensitive' } } : {}),
      },
      include: { officialCard: true },
      take: Number(limit),
    });

    // TCGdex matches to enrich rarity/image candidates
    const tcgMatches: TCGdexCard[] = tcgdex.searchByName(String(q), set);

    const enriched = await Promise.all(
      canon.map(async (card) => {
        // ConsensusPricing first
        const cps = await prisma.consensusPricing.findMany({
          where: { canonicalCardId: card.id },
          select: {
            gradeCompany: true,
            grade: true,
            consensusPriceCents: true,
            confidenceScore: true,
            sourceCount: true,
          },
        });

        const pricesByGrade: Record<string, any> = {};
        for (const cp of cps) {
          const key = cp.gradeCompany ? `${cp.gradeCompany}_${cp.grade}` : 'RAW';
          pricesByGrade[key] = {
            avg: (cp.consensusPriceCents || 0) / 100,
            confidence: cp.confidenceScore,
            sources: cp.sourceCount,
          };
        }

        if (Object.keys(pricesByGrade).length === 0) {
          const listings = await prisma.marketListing.findMany({
            where: { canonicalCardId: card.id, isActive: true },
            select: { gradeCompany: true, grade: true, priceCents: true },
          });
          const groups = new Map<string, number[]>();
          for (const l of listings) {
            if (l.priceCents == null) continue;
            const key = l.gradeCompany ? `${l.gradeCompany}_${l.grade}` : 'RAW';
            const arr = groups.get(key) || [];
            arr.push(l.priceCents / 100);
            groups.set(key, arr);
          }
          for (const [key, arr] of groups.entries()) {
            pricesByGrade[key] = {
              avg: trimmedMean(arr),
              confidence: arr.length >= 5 ? 0.8 : 0.5,
              sources: arr.length,
            };
          }
        }

        // Match TCGdex by name + card number (localId)
        const match = tcgMatches.find(
          (m) => m.name.toLowerCase() === card.canonicalName.toLowerCase() && m.localId === card.cardNumber,
        );
        const imageCandidateUrls = match ? tcgdex.getImageCandidates(match, language) : [];

        return {
          canonicalCardId: card.id,
          name: card.canonicalName,
          set: card.canonicalSet,
          cardNumber: card.cardNumber,
          rarity: match?.rarity || card.officialCard?.rarity || 'Unknown',
          illustrator: match?.illustrator || card.officialCard?.illustrator || null,
          imageCandidateUrls,
          imageUrl: imageCandidateUrls[0] || '',
          pricesByGrade,
          listingCount: card.totalListings || 0,
          dataQuality: card.dataQuality,
        };
      }),
    );

    const response = {
      ok: true,
      query: { q, set, language },
      matches: enriched,
      metadata: { resultCount: enriched.length, cached: false, queryTimeMs: Date.now() - t0 },
    };
    const baseTTL = Number(process.env.CACHE_TTL_SEARCH || 900);
    await redis.set(
      cacheKey,
      JSON.stringify(response),
      { EX: jitteredTTL(baseTTL) }
    );
    try { (await import('../lib/metrics.js')).recordRequest('/api/cards/search-variants', 200, (Date.now() - t0) / 1000); } catch {}
    return response;
  });

  // GET /api/cards/comprehensive-analysis
  fastify.get('/comprehensive-analysis', {
    config: {
      rateLimit: {
        max: 100, // API key tier; anonymous additionally limited by preHandler
        timeWindow: '1 hour',
        keyGenerator: (req: any) => (req.headers['x-api-key'] as string) || req.ip,
      },
    },
    schema: {
      summary: 'Comprehensive analysis for a specific card/grade',
      querystring: {
        type: 'object',
        properties: {
          canonicalCardId: { type: 'string' },
          cardNumber: { type: 'string' },
          setName: { type: 'string' },
          gradeCompany: { type: 'string' },
          grade: { type: 'number' },
          language: { type: 'string', enum: ['EN', 'JA'], default: 'EN' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            card: { type: 'object' },
            trueFairValue: { type: ['object', 'null'] },
            bestDeal: { type: ['object', 'null'] },
            marketplaces: { type: 'object' },
            priceHistory: { type: 'object' },
            marketSignals: { type: 'object' },
            sentiment: { type: 'object' },
            aiAnalysis: { type: ['object', 'null'] },
            variants: { type: ['object', 'null'] },
            metadata: { type: 'object' },
          },
        },
      },
    },
    preHandler: enforceAnonRateLimit,
  }, async (request, reply) => {
    const params = request.query as any;
    const t0 = Date.now();

    // Resolve canonical id
    let canonicalCardId = params.canonicalCardId as string | undefined;
    if (!canonicalCardId && params.cardNumber && params.setName) {
      const found = await prisma.canonicalCard.findFirst({
        where: { cardNumber: params.cardNumber, canonicalSet: { contains: params.setName, mode: 'insensitive' } },
      });
      if (!found) return reply.code(404).send({ ok: false, error: 'Card not found' });
      canonicalCardId = found.id;
    }
    if (!canonicalCardId) return reply.code(400).send({ ok: false, error: 'Missing canonicalCardId or (cardNumber + setName)' });

    const cacheKey = `comprehensive-analysis:v1:${canonicalCardId}:${params.gradeCompany || 'any'}:${params.grade || 'any'}:${params.language || 'EN'}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.metadata = { ...parsed.metadata, cached: true };
      try { (reply as any).header && reply.header('x-cache-status', 'HIT'); } catch {}
      try { (await import('../lib/metrics.js')).recordCacheHit('comprehensive-analysis'); } catch {}
      try { (await import('../lib/metrics.js')).recordRequest('/api/cards/comprehensive-analysis', 200, (Date.now() - t0) / 1000); } catch {}
      return parsed;
    }

    const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const timeoutMs = Number(process.env.ANALYSIS_TIMEOUT_MS || 30000);
    const all = Promise.allSettled([
      prisma.canonicalCard.findUnique({ where: { id: canonicalCardId }, include: { officialCard: true } }),
      prisma.marketListing.findMany({
        where: {
          canonicalCardId,
          isActive: true,
          ...(params.gradeCompany ? { gradeCompany: params.gradeCompany } : {}),
          ...(params.grade ? { grade: params.grade } : {}),
        },
        orderBy: { priceCents: 'asc' },
        take: 50,
      }),
      prisma.saleRecord.findMany({ where: { canonicalCardId, soldAt: { gte: since90d } }, orderBy: { soldAt: 'desc' } }),
      prisma.consensusPricing.findFirst({
        where: {
          canonicalCardId,
          ...(params.gradeCompany ? { gradeCompany: params.gradeCompany } : {}),
          ...(params.grade ? { grade: params.grade } : {}),
        },
      }),
      prisma.cardSignal.findFirst({ where: { canonicalCardId } }),
      prisma.redditSignal.findMany({ where: { canonicalCardId, expiresAt: { gt: new Date() } }, orderBy: { score: 'desc' }, take: 10 }),
    ]);
    const results = (await Promise.race([
      all,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout (30s)')), timeoutMs)),
    ])) as PromiseSettledResult<any>[];

    const card = results[0].status === 'fulfilled' ? results[0].value as any : null;
    if (!card) return reply.code(404).send({ ok: false, error: 'Card not found' });
    const listings = results[1].status === 'fulfilled' ? (results[1].value as any[]).filter(l => l.priceCents != null) : [];
    const saleRecords = results[2].status === 'fulfilled' ? (results[2].value as any[]) : [];
    const consensus = results[3].status === 'fulfilled' ? results[3].value as any : null;
    const cardSignal = results[4].status === 'fulfilled' ? results[4].value as any : null;
    const redditSignals = results[5].status === 'fulfilled' ? results[5].value as any[] : [];

    const tfv = consensus?.consensusPriceCents ? consensus.consensusPriceCents / 100 : (listings.length ? trimmedMean(listings.map(l => (l.priceCents || 0) / 100)) : null);

    const best = listings[0];
    const bestDeal = best
      ? {
          source: best.source,
          listingId: best.sourceId,
          price: (best.priceCents || 0) / 100,
          discountPct: tfv ? (((tfv - (best.priceCents || 0) / 100) / tfv) * 100) : 0,
          url: (best as any).sourceUrl || null,
          title: best.title,
          shippingCost: 0,
          totalCost: (best.priceCents || 0) / 100,
        }
      : null;

    const bySource = listings.reduce((acc: Record<string, any[]>, l) => {
      (acc[l.source] = acc[l.source] || []).push(l);
      return acc;
    }, {});
    const marketplaces = {
      dataAvailable: listings.length > 0,
      summary: {
        totalListings: listings.length,
        avgPrice: listings.length ? listings.reduce((s, l) => s + (l.priceCents || 0), 0) / listings.length / 100 : null,
        marketplacesWithListings: Object.keys(bySource).length,
      },
      bySource: Object.fromEntries(
        Object.entries(bySource).map(([src, arr]) => [
          src,
          {
            listingCount: arr.length,
            avgPrice: arr.reduce((s: number, l: any) => s + (l.priceCents || 0), 0) / arr.length / 100,
            minPrice: Math.min(...arr.map((l: any) => l.priceCents || 0)) / 100,
            topListings: arr.slice(0, 5).map((l: any) => ({ id: l.sourceId, price: (l.priceCents || 0) / 100, url: l.sourceUrl || null, title: l.title })),
          },
        ]),
      ),
    };

    const priceHistory = saleRecords.length
      ? { dataAvailable: true, period: '90d', granularity: 'week', dataPoints: aggregateByWeek(saleRecords), trend: calculateTrend(saleRecords) }
      : { dataAvailable: false, reason: 'No sales in last 90 days' };

    const marketSignals = cardSignal
      ? {
          dataAvailable: true,
          salesPerWeek: cardSignal.salesPerWeek,
          liquidity: cardSignal.salesPerWeek > 5 ? 'high' : cardSignal.salesPerWeek > 2 ? 'medium' : 'low',
          daysToSell: cardSignal.daysToClear,
          arbitrageOpportunity: cardSignal.hasArbitrage ? { exists: true, spreadPct: cardSignal.arbitrageSpreadPct } : null,
        }
      : { dataAvailable: false };

    // Mew-1A analysis (cache 5m)
    const aiKey = `ai-analysis:${canonicalCardId}:${params.gradeCompany || 'any'}:${params.grade || 'any'}`;
    let aiAnalysis = null as any;
    const aiCached = await redis.get(aiKey);
    if (aiCached) {
      aiAnalysis = JSON.parse(aiCached);
      aiAnalysis.cached = true;
    } else {
      const mew = await callMew1AShapedAnalyze({
        card_name: card.canonicalName,
        set_name: card.canonicalSet,
        listed_price: bestDeal?.price || tfv || 0,
        fair_value: tfv || 0,
      });
      if (mew) {
        aiAnalysis = {
          recommendation: mew.recommendation,
          conviction: 85,
          mew1a: {
            recommendation: mew.recommendation,
            headline: mew.headline,
            explanation: mew.explanation || mew.analysis,
            shaped: !!mew.shaped,
          },
          cached: false,
        };
        const aiTTL = Number(process.env.CACHE_TTL_AI || 900);
        await redis.set(
          aiKey,
          JSON.stringify(aiAnalysis),
          { EX: jitteredTTL(aiTTL) }
        );
      }
    }

    // TCGdex image candidates
    await tcgdex.load();
    const tcgList = tcgdex.searchByName(card.canonicalName, card.canonicalSet);
    const tcgMatch = tcgList.find((c) => c.localId === card.cardNumber);
    const imageCandidateUrls = tcgMatch ? tcgdex.getImageCandidates(tcgMatch, params.language || 'EN') : [];

    // Variants: other grades and other versions (Phase 2 refinement)
    // otherGrades: all consensusPricing tuples for this canonical card
    const otherGradesRows = await prisma.consensusPricing.findMany({
      where: { canonicalCardId },
      select: { gradeCompany: true, grade: true, consensusPriceCents: true, confidenceScore: true, sourceCount: true },
      orderBy: [{ gradeCompany: 'asc' }, { grade: 'asc' }],
      take: 20,
    });
    const otherGrades = otherGradesRows
      .filter(r => r.consensusPriceCents != null)
      .map(r => ({
        gradeCompany: r.gradeCompany || 'RAW',
        grade: r.grade || null,
        avgPrice: (r.consensusPriceCents || 0) / 100,
        confidence: r.confidenceScore || 0,
        sources: r.sourceCount || 0,
      }));

    // otherVersions: same name+set, different cardNumber
    const siblings = await prisma.canonicalCard.findMany({
      where: { canonicalName: card.canonicalName, canonicalSet: card.canonicalSet, id: { not: card.id } },
      select: { id: true, cardNumber: true },
      take: 10,
    });
    const siblingIds = siblings.map(s => s.id);
    const siblingPSA10 = siblingIds.length
      ? await prisma.consensusPricing.findMany({
          where: { canonicalCardId: { in: siblingIds }, gradeCompany: 'PSA', grade: 10 },
          select: { canonicalCardId: true, consensusPriceCents: true },
        })
      : [];
    const psaMap = new Map<string, number>();
    for (const row of siblingPSA10) psaMap.set(row.canonicalCardId, (row.consensusPriceCents || 0) / 100);
    const otherVersions = siblings.map(sib => {
      const tcgSibling = tcgList.find(t => t.localId === sib.cardNumber);
      return {
        canonicalCardId: sib.id,
        cardNumber: sib.cardNumber,
        rarity: tcgSibling?.rarity || 'Unknown',
        avgPricePSA10: psaMap.get(sib.id) || null,
      };
    });

    const response = {
      ok: true,
      card: {
        id: card.id,
        name: card.canonicalName,
        set: card.canonicalSet,
        cardNumber: card.cardNumber,
        rarity: tcgMatch?.rarity || card.officialCard?.rarity || 'Unknown',
        illustrator: tcgMatch?.illustrator || card.officialCard?.illustrator || null,
        imageCandidateUrls,
        imageUrl: imageCandidateUrls[0] || '',
      },
      query: params,
      trueFairValue: (() => {
        if (!tfv) return null;
        const prices = listings.map((l: any) => l.priceCents).filter((v: any) => v != null) as number[];
        const minP = consensus?.minPriceCents != null ? consensus.minPriceCents / 100 : (prices.length ? Math.min(...prices) / 100 : null);
        const maxP = consensus?.maxPriceCents != null ? consensus.maxPriceCents / 100 : (prices.length ? Math.max(...prices) / 100 : null);
        return {
          price: tfv,
          confidence: consensus?.confidenceScore || 0.8,
          method: consensus ? 'ConsensusPricing' : 'TrimmedMean',
          sampleSize: consensus?.sourceCount || listings.length,
          priceRange: minP != null && maxP != null ? { min: minP, max: maxP } : null,
        };
      })(),
      bestDeal,
      marketplaces,
      priceHistory,
      marketSignals,
      sentiment: redditSignals.length
        ? {
            dataAvailable: true,
            reddit: {
              overall: (() => {
                const avg = redditSignals.reduce((s, r) => s + (r.sentimentScore || 0), 0) / redditSignals.length;
                return avg > 0.2 ? 'BULLISH' : avg < -0.2 ? 'BEARISH' : 'NEUTRAL';
              })(),
              score: redditSignals.reduce((s, r) => s + (r.sentimentScore || 0), 0) / redditSignals.length,
              confidence: redditSignals.reduce((s, r) => s + (r.confidence || 0), 0) / redditSignals.length,
              discussionVolume: redditSignals.length,
              topMentions: redditSignals.slice(0, 3).map((r) => ({ subreddit: r.subreddit, title: r.postTitle, url: r.postUrl, sentiment: r.sentiment, score: r.score })),
            },
          }
        : { dataAvailable: false },
      aiAnalysis,
      variants: {
        otherGrades,
        otherVersions,
      },
      metadata: { lastUpdated: new Date().toISOString(), dataSources: Array.from(new Set([...(listings.map((l: any) => l.source)), ...(saleRecords.length ? ['SALES_HISTORY'] : []), ...(redditSignals.length ? ['REDDIT'] : [])])), cached: false, queryTimeMs: Date.now() - t0 },
    };

    const analysisTTL = Number(process.env.CACHE_TTL_ANALYSIS || 900);
    await redis.set(
      cacheKey,
      JSON.stringify(response),
      { EX: jitteredTTL(analysisTTL) }
    );
    try {
      fastify.log.info({ endpoint: '/api/cards/comprehensive-analysis', canonicalCardId, cached: false, queryTimeMs: Date.now() - t0, otherGrades: otherGrades.length, otherVersions: otherVersions.length }, 'comprehensive analysis');
      (await import('../lib/metrics.js')).recordRequest('/api/cards/comprehensive-analysis', 200, (Date.now() - t0) / 1000);
    } catch {}
    return response;
  });
};

export default cardComprehensiveRoutes;
