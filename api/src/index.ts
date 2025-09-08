import loadAndValidateEnv from './lib/validate-env.js';
// Validate API env vars
loadAndValidateEnv(['PORT', 'REDIS_URL']);
import Fastify from "fastify";
import cors from "@fastify/cors";
import prisma from "./lib/prisma.js";
import { getRedis } from "./lib/redis.js";
import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";

// worker helpers (exported by @pokedao/worker)
import { normalizeCardQuery, getComparableSales, sanitizeComps, computeFairValue } from "@pokedao/worker";
import { Prisma } from "@prisma/client";

// External data integration endpoints
import { 
  getExternalDataStatus, 
  previewNormalization, 
  getMarketSignals, 
  getDiscoveryEndpoints 
} from "./external-data-endpoints.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const redis = getRedis();

// Typed variables for Prisma queries
type compWhere = Prisma.CompWhereInput;
type compCursor = Prisma.CompWhereUniqueInput;
type referralData = Prisma.ReferralEventCreateInput;
type watchlistKey = Prisma.WatchlistItemWhereUniqueInput;

async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, { origin: true });

  app.get('/health', async (request, reply) => {
    try {
      const pong = await redis.ping();
      await prisma.$queryRaw`SELECT 1`;
      return reply.code(200).send({ status: 'ok', redis: pong });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error({ err: e }, 'health check failed');
      return reply.code(500).send({ status: 'error', error: msg });
    }
  });

  // fair value endpoint
  app.get("/fv", async (req, reply) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const name = (q.name || "").trim();
      const set = (q.set || "").trim();
      const listPrice = Number(q.listPrice || "0");

      if (!name || !set) {
        reply.code(400);
        return { ok: false, error: "Missing required query params: name & set" };
      }
      if (!Number.isFinite(listPrice) || listPrice <= 0) {
        reply.code(400);
        return { ok: false, error: "Invalid listPrice" };
      }

      const norm = normalizeCardQuery({ name, set });
      const { comps } = await getComparableSales(norm);
      const usable = sanitizeComps(comps);

      const { fv, confidence, basis } = computeFairValue(usable);

      const discountPct = fv > 0 ? ((fv - listPrice) / fv) * 100 : 0;
      const qualified = fv > 0 && discountPct >= 15 && confidence >= 0.5;

      return {
        ok: true,
        input: { name, set, listPrice },
        fv: Math.round(fv * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        basis,
        discountPct: Math.round(discountPct * 10) / 10,
        qualified,
        comps: usable,
      };
    } catch (err: any) {
      app.log.error({ err }, "fv route error");
      reply.code(500);
      return { ok: false, error: "Internal error" };
    }
  });

  // feed endpoint: recent active listings with card info
  app.get('/feed', async (req, reply) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const limit = Math.min(100, Math.max(1, Number(q.limit || '25')));
      const cursor = q.cursor ? { id: q.cursor } : undefined;

      const listings = await prisma.listing.findMany({
        where: { isActive: true },
        include: { card: true },
        orderBy: [{ scrapedAt: 'desc' }, { id: 'asc' }],
        cursor,
        take: limit + 1,
      });

      const nextCursor = listings.length > limit ? listings.pop()?.id : null;
      return { ok: true, items: listings, nextCursor, count: listings.length, generatedAt: new Date().toISOString() };
    } catch (err: any) {
      app.log.error({ err }, 'feed route error'); // Use error for logging
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // top100 endpoint: robust ranking implementation
  app.get('/top100', async (req, reply) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const limit = Math.min(100, Math.max(1, Number(q.limit || '25')));
      const cursor = q.cursor ? { id: q.cursor } : undefined;

      const group = await prisma.comp.groupBy({
        by: ['id'], // Replace 'cardId' with 'id' as per schema
        where: {}, // Remove 'soldAt' as it does not exist in the schema
        _count: { id: true }, // Replace '_all' with 'id' for valid aggregation
        orderBy: [{ _count: { id: 'desc' } }, { id: 'asc' }],
        cursor: cursor as never, // Explicitly cast cursor to match the expected type
        take: limit + 1,
      });

  const nextCursor = group.length > limit ? group.pop()?.id : null;
      return { ok: true, items: group, nextCursor, count: group.length, generatedAt: new Date().toISOString() };
    } catch (err: any) {
      app.log.error({ err }, 'top100 route error'); // Use error for logging
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // test alert publisher (prep for Telegram bot)
  app.post("/alerts/test", async (_req, reply) => {
    const payload = {
      title: "Test High-Value Card",
      set: "Base Set",
      listPrice: 100,
      fv: 128.5,
      discountPct: 22.2,
      ts: new Date().toISOString(),
    };
    await redis.publish("deals", JSON.stringify(payload));
    return reply.send({ ok: true, published: true, payload });
  });

  const logger = app.log as FastifyBaseLogger;

  // Middleware to check Redis cache
  app.addHook('onRequest', async (req, reply) => {
    const cacheKey = `${req.routerPath}:v1:${JSON.stringify(req.query)}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('x-cache', 'hit');
      return reply.send(JSON.parse(cached));
    }
    reply.header('x-cache', 'miss');
    (req as any).cacheKey = cacheKey; // Use type assertion to add cacheKey
  });

  // Middleware to set Redis cache
  app.addHook('onSend', async (req, reply, payload) => {
    const cacheKey = (req as any).cacheKey; // Use type assertion to access cacheKey
    if (cacheKey) {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload); // Ensure payload is a string
      await redis.set(cacheKey, payloadString, { EX: req.routerPath.includes('/top100') ? 300 : 120 });
    }
  });

  // Referral attribution middleware
  app.addHook('onRequest', async (req) => {
    const query = req.query as Record<string, string | undefined>; // Explicitly type req.query
    const ref = query.ref;
    if (ref) {
      const ipHash = createHash('sha256').update(req.ip).digest('hex');
      await prisma.referralEvent.create({
        data: {
          code: ref,
          path: req.routerPath,
          user: { connect: { id: req.headers['user-id'] as string } },
        },
      });
    }
  });

  // Referral analytics summary endpoint
  app.get('/analytics/ref/:code/summary', async (req, reply) => {
    try {
      const { code } = req.params as { code: string };
      const views = await prisma.referralEvent.count({ where: { code } });
      const outbound = await prisma.referralEvent.count({ where: { code, path: { contains: '/outbound' } } });

      return { ok: true, views, outbound };
    } catch (err: any) {
      logger.error?.({ err }, 'referral analytics error'); // Use optional chaining for safety
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // card details endpoint
  app.get('/cards/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const card = await prisma.card.findUnique({ where: { id } });
      if (!card) {
        reply.code(404);
        return { error: 'not_found' };
      }

      const listings = await prisma.listing.findMany({
        where: { cardId: id, isActive: true },
        orderBy: { scrapedAt: 'desc' },
        take: 1,
      });

      const comps = await prisma.comp.findMany({
        where: {
          id,
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        ok: true,
        card,
        latestListing: listings[0] || null,
        recentComps: comps,
      };
    } catch (err: any) {
      logger.error?.({ err }, 'card details route error'); // Use optional chaining for safety
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // External data integration endpoints
  
  // Get status of all external data sources
  app.get('/external/status', async (req, reply) => {
    try {
      const status = await getExternalDataStatus();
      return { ok: true, sources: status, generatedAt: new Date().toISOString() };
    } catch (err: any) {
      app.log.error({ err }, 'external status error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // Preview normalization without saving to database
  app.get('/external/preview/:source', async (req, reply) => {
    try {
      const { source } = req.params as { source: string };
      const q = req.query as Record<string, string | undefined>;
      const limit = Math.min(50, Math.max(1, Number(q.limit || '10')));
      
      const preview = await previewNormalization(source, limit);
      return { 
        ok: true, 
        source, 
        previews: preview, 
        count: preview.length,
        generatedAt: new Date().toISOString() 
      };
    } catch (err: any) {
      app.log.error({ err }, 'normalization preview error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // Get AI-powered market signals from external data
  app.get('/external/signals', async (req, reply) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const limit = Math.min(100, Math.max(1, Number(q.limit || '20')));
      
      const signals = await getMarketSignals(limit);
      return { 
        ok: true, 
        signals, 
        count: signals.length,
        generatedAt: new Date().toISOString() 
      };
    } catch (err: any) {
      app.log.error({ err }, 'market signals error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // Discovery endpoints for integration testing
  app.get('/external/discovery', async (req, reply) => {
    try {
      const discovery = await getDiscoveryEndpoints();
      return { 
        ok: true, 
        discovery,
        generatedAt: new Date().toISOString() 
      };
    } catch (err: any) {
      app.log.error({ err }, 'discovery endpoints error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  // watchlist endpoints
  app.post('/watchlist', async (req, reply) => {
    try {
      const { cardId } = req.body as { cardId: string };
      const userId = 'stub-user'; // Replace with actual user auth logic

      await prisma.watchlistItem.upsert({
        where: {
          id: `${userId}-${cardId}`,
        },
        create: { userId, cardId },
        update: {},
      });

      return { ok: true };
    } catch (err: any) {
      logger.error?.({ err }, 'watchlist add error'); // Use optional chaining for safety
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  app.get('/watchlist', async (req, reply) => {
    try {
      const userId = 'stub-user'; // Replace with actual user auth logic
      const items = await prisma.watchlistItem.findMany({
        where: { userId },
        include: { card: true },
      });

      return { ok: true, items };
    } catch (err: any) {
      logger.error?.({ err }, 'watchlist fetch error'); // Use optional chaining for safety
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  return app;
}

buildServer()
  .then((app) => app.listen({ port: PORT, host: HOST }))
  .then(() => {
    console.log(`[api] listening on http://${HOST}:${PORT}`);
  })
  .catch((err) => {
    console.error("[api] failed to start:", err);
    process.exit(1);
  });
