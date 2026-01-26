import loadAndValidateEnv from './lib/validate-env.js';
// Validate required environment variables on startup
loadAndValidateEnv(['DATABASE_URL', 'DEEPSEEK_API_KEY']);
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import prisma from "./lib/prisma.js";
import { getRedis } from "./lib/redis.js";
import { getMetricsText as getApiMetricsText } from './lib/metrics.js';
import { createHash, randomUUID } from "node:crypto";
import type { FastifyBaseLogger, FastifyRequest } from "fastify";

// TODO: worker helpers - package doesn't exist yet
// import { normalizeCardQuery, getComparableSales, sanitizeComps, computeFairValue } from "@pokedao/worker";
import type {
  CompSaleWhereInput,
  CompSaleWhereUniqueInput,
  ReferralEventCreateInput,
  WatchlistItemWhereUniqueInput
} from "../prisma/generated/client/models.js";

// Extended logger type that includes pino methods
type Logger = FastifyBaseLogger & {
  error: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  info: (obj: object, msg?: string) => void;
  debug: (obj: object, msg?: string) => void;
};
import { registerSignals } from "./routes/signals.js";
import { registerPosts } from "./routes/posts.js";
import { registerEbayMADWebhook } from "./routes/webhooks/ebay-mad.js";
import { registerSearch } from "./routes/search.js";
import { registerArbitrage } from "./routes/arbitrage.js";
import { registerPriceHistory } from "./routes/price-history.js";
import { registerTokenized } from "./routes/tokenized.js";
import { registerBestExecution } from "./routes/best-execution.js";
import { registerConfidence } from "./routes/confidence.js";
import { registerAIAnalysis } from "./routes/ai-analysis.js";
import cardComprehensiveRoutes from "./routes/card-comprehensive.js";
import { registerPortfolio } from "./routes/portfolio.js";
import { registerMarketCommentary } from "./routes/market-commentary.js";
import collectRoutes from "./routes/collect.js";
import analyticsRoutes from "./routes/analytics.js";
import { initWebSocket, shutdownWebSocket, subscribeToRedisUpdates, getClientCount } from "./lib/websocket.js";
import { createServer } from "http";
import { tcgdex } from "./lib/tcgdex.js";

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
type compWhere = CompSaleWhereInput;
type compCursor = CompSaleWhereUniqueInput;
type referralData = ReferralEventCreateInput;
type watchlistKey = WatchlistItemWhereUniqueInput;

async function buildServer() {
  const app = Fastify({
    logger: { level: process.env.API_LOG_LEVEL || 'info' },
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    trustProxy: process.env.TRUST_PROXY === 'true',
  });

  // Initialize TCGdex service with DB-backed queries (skips 50MB JSON load)
  tcgdex.initDb(prisma, redis);

  // Propagate request id for client correlation
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  await app.register(cors, { origin: true });
  await app.register(helmet, { global: true });
  await app.register(compress, { global: true, threshold: 1024 });
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'PokeDAO API',
        description: 'Market intelligence API for trading cards',
        version: '0.1.0',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await registerSignals(app);
  await registerPosts(app);
  await registerEbayMADWebhook(app);
  await registerSearch(app);
  await registerArbitrage(app);
  await registerPriceHistory(app);
  await registerTokenized(app);
  await registerBestExecution(app);
  await registerConfidence(app);
  await registerAIAnalysis(app);
  await registerPortfolio(app);
  await registerMarketCommentary(app);
  await app.register(cardComprehensiveRoutes, { prefix: '/api/cards' });
  await app.register(collectRoutes, { prefix: '/api/collect' });
  await app.register(analyticsRoutes, { prefix: '/api/analytics' });

  app.get('/health', async (request, reply) => {
    try {
      const pong = await redis.ping();
      await prisma.$queryRaw`SELECT 1`;
      return reply.code(200).send({ status: 'ok', redis: pong });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error({ err: e }, 'health check failed');
      // Return 200 for Docker health checks, but log the error
      return reply.code(200).send({ status: 'degraded', error: msg });
    }
  });

  // Comprehensive health check including external services
  app.get('/health/comprehensive', async (request, reply) => {
    const checks: Record<string, { status: 'ok' | 'degraded' | 'error'; latency?: number; error?: string }> = {};
    let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';

    // Check Redis
    try {
      const start = Date.now();
      await redis.ping();
      checks.redis = { status: 'ok', latency: Date.now() - start };
    } catch (e) {
      checks.redis = { status: 'error', error: e instanceof Error ? e.message : String(e) };
      overallStatus = 'degraded';
    }

    // Check Postgres
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { status: 'ok', latency: Date.now() - start };
    } catch (e) {
      checks.postgres = { status: 'error', error: e instanceof Error ? e.message : String(e) };
      overallStatus = 'error'; // DB is critical
    }

    // Check Ollama (non-critical)
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const start = Date.now();
      const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      checks.ollama = res.ok
        ? { status: 'ok', latency: Date.now() - start }
        : { status: 'degraded', error: `HTTP ${res.status}` };
    } catch (e) {
      checks.ollama = { status: 'degraded', error: e instanceof Error ? e.message : String(e) };
      // Ollama is optional, don't change overall status
    }

    // Check DeepSeek API (non-critical, just verify API key format)
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey && deepseekKey.startsWith('sk-')) {
      checks.deepseek = { status: 'ok' };
    } else {
      checks.deepseek = { status: 'degraded', error: 'API key not configured' };
    }

    // Check WebSocket clients
    checks.websocket = { status: 'ok', latency: getClientCount() };

    return reply.code(overallStatus === 'error' ? 503 : 200).send({
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (request, reply) => {
    try {
      const [pong] = await Promise.all([
        redis.ping(),
        prisma.$queryRaw`SELECT 1`
      ]);
      if (pong !== 'PONG') throw new Error('Redis not ready');
      return reply.code(200).send({ ready: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error({ err: e }, 'readiness check failed');
      return reply.code(503).send({ ready: false, error: msg });
    }
  });

  // API routes catalog (dev-only)
  app.get('/api/_routes', async (request, reply) => {
    return reply.code(200).send({
      health: "/health",
      ready: "/ready", 
      metrics: "/metrics",
      cards: "/api/cards?limit=10",
      listings: "/api/listings?limit=10",
      feed: "/feed?limit=25",
      fairValue: "/fv?name=Charizard&set=Base%20Set&listPrice=100",
      external: "/external/status"
    });
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (request, reply) => {
    // Basic metrics - can be enhanced with prom-client later
    const dbConnections = await prisma.$queryRaw`SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`;
    const cardCount = await prisma.card.count();
    const listingCount = await prisma.listing.count();
    
    const metrics = [
      '# HELP pokedao_cards_total Total number of cards in database',
      '# TYPE pokedao_cards_total gauge',
      `pokedao_cards_total ${cardCount}`,
      '# HELP pokedao_listings_total Total number of listings in database', 
      '# TYPE pokedao_listings_total gauge',
      `pokedao_listings_total ${listingCount}`,
      '# HELP pokedao_db_connections Current database connections',
      '# TYPE pokedao_db_connections gauge',
      `pokedao_db_connections ${(dbConnections as any[])[0]?.count || 0}`,
      '',
      getApiMetricsText(),
    ].join('\n');

    return reply.code(200).type('text/plain').send(metrics);
  });

  /* TODO: fair value endpoint - disabled until worker package exists
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
  */

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

      const group = await prisma.compSale.groupBy({
        by: ['cardId'],
        where: {},
        _count: { id: true },
        orderBy: [{ _count: { id: 'desc' } }, { cardId: 'asc' }],
        take: limit + 1,
      });

  const nextCursor = group.length > limit ? group.pop()?.cardId : null;
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
      reply.header('x-cache-status', 'HIT');
      try {
        const metrics = await import('./lib/metrics.js');
        // Attribute gateway cache hit and a fast request duration (~0s)
        metrics.recordCacheHit('gateway');
        metrics.recordRequest(req.routerPath || req.url, 200, 0);
      } catch {}
      return reply.send(JSON.parse(cached));
    }
    reply.header('x-cache-status', 'MISS');
    (req as any).cacheKey = cacheKey; // Use type assertion to add cacheKey
  });

  // Middleware to set Redis cache
  app.addHook('onSend', async (req, reply, payload) => {
    const cacheKey = (req as any).cacheKey; // Use type assertion to access cacheKey
    if (cacheKey && req.routeOptions?.url) {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload); // Ensure payload is a string
      await redis.set(cacheKey, payloadString, { EX: req.routeOptions.url.includes('/top100') ? 300 : 120 });
    }
  });

  // Referral attribution middleware (best-effort, non-fatal)
  app.addHook('onRequest', async (req) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const ref = query.ref;
      const userId = req.headers['user-id'] as string | undefined;
      if (!ref || !userId) return;
      // hashed IP available if we later add a column
      const _ipHash = createHash('sha256').update(req.ip).digest('hex');
      await prisma.referralEvent.create({
        data: {
          code: ref,
          path: (req as any).routerPath || req.url,
          user: { connect: { id: userId } },
        },
      });
    } catch (err) {
      req.log.warn({ err }, 'referral attribution failed');
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

  // cards list endpoint
  app.get('/api/cards', async (req, reply) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const limit = Math.min(100, Math.max(1, Number(q.limit || '10')));
      const cursor = q.cursor ? { id: q.cursor } : undefined;

      const cards = await prisma.card.findMany({
        ...(cursor ? { cursor, skip: 1 } : {}),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          listings: {
            where: { isActive: true },
            orderBy: { scrapedAt: 'desc' },
            take: 1,
            select: {
              price: true,
              currency: true,
              url: true,
              source: true,
              scrapedAt: true
            }
          },
          _count: {
            select: {
              listings: true
            }
          }
        }
      });

      return {
        cards,
        pagination: {
          hasMore: cards.length === limit,
          nextCursor: cards.length === limit ? cards[cards.length - 1].id : null
        }
      };
    } catch (err: any) {
      app.log.error({ err }, "cards list error");
      reply.code(500);
      return { ok: false, error: "Internal error" };
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

      const comps = await prisma.compSale.findMany({
        where: {
          cardId: id,
          soldAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { soldAt: 'desc' },
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

  // P1-1 Fix: Watchlist endpoints removed until proper auth is implemented
  // TODO: Re-enable with JWT/session auth middleware
  // See: docs/AUDIT_RECOMMENDATIONS.md for implementation guidance

  // Central error handler for consistency
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled_error');
    const status = typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
    const body = {
      type: 'about:blank',
      title: status === 500 ? 'Internal Server Error' : err.name || 'Error',
      status,
      detail: process.env.NODE_ENV === 'production' ? undefined : err.message,
      instance: req.url,
      requestId: req.id,
    } as const;
    reply.code(status).header('content-type', 'application/problem+json').send(body);
  });

  return app;
}

let server: Awaited<ReturnType<typeof buildServer>>;
let httpServer: ReturnType<typeof createServer>;

buildServer()
  .then(async (app) => {
    server = app;

    // Create HTTP server for both Fastify and WebSocket
    httpServer = createServer(app.server);

    // Initialize WebSocket server
    initWebSocket(httpServer);
    console.log('[api] WebSocket server initialized at /ws');

    // Subscribe to Redis for cross-instance broadcasts
    try {
      await subscribeToRedisUpdates();
    } catch (e) {
      console.warn('[api] Redis pub/sub subscription failed (non-fatal):', e);
    }

    return app.listen({ port: PORT, host: HOST });
  })
  .then(() => {
    console.log(`[api] listening on http://${HOST}:${PORT}`);
    console.log(`[api] WebSocket available at ws://${HOST}:${PORT}/ws`);
  })
  .catch((err) => {
    console.error("[api] failed to start:", err);
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[api] ${signal} received, shutting down gracefully...`);
  try {
    // Shutdown WebSocket first
    shutdownWebSocket();
    console.log('[api] WebSocket server closed');

    if (server) {
      await server.close();
      console.log('[api] server closed');
    }
    await prisma.$disconnect();
    console.log('[api] database disconnected');
    await redis.quit();
    console.log('[api] redis disconnected');
    process.exit(0);
  } catch (err) {
    console.error('[api] error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
