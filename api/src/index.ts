import 'dotenv/config';
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

// worker helpers (exported by @pokedao/worker)
import { normalizeCardQuery, getComparableSales, sanitizeComps, computeFairValue } from "@pokedao/worker";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

async function buildServer() {
  const app = Fastify({
    logger: {
      level: "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, { origin: true });

  // basic health
  app.get("/health", async () => ({ ok: true }));

  // db connectivity check
  app.get("/db-check", async () => {
    const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    return { ok: true, dbNow: rows[0]?.now };
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
      req.log.error({ err }, "fv route error");
      reply.code(500);
      return { ok: false, error: "Internal error" };
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
