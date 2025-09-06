import 'dotenv/config';
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { getRedis } from "./lib/redis.js"; // ✅
import {
  normalizeCardQuery,
  getComparableSales,
  sanitizeComps,
  computeFairValue,
} from "@pokedao/worker";
import { FastifyReply, FastifyRequest } from "fastify";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const prisma = new PrismaClient();
const redis = getRedis();

function createLogger() {
  return {
    level: "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  };
}

function createApp() {
  const app = Fastify({ logger: createLogger() });
  app.register(cors, { origin: true });
  return app;
}

async function healthCheckHandler() {
  return { ok: true };
}

async function dbCheckHandler() {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
  return { ok: true, dbNow: rows[0]?.now };
}

async function fairValueHandler(req: FastifyRequest, reply: FastifyReply) {
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
}

async function testAlertHandler(_req: FastifyRequest, reply: FastifyReply) {
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
}

async function buildServer() {
  const app = createApp();

  app.get("/health", healthCheckHandler);
  app.get("/db-check", dbCheckHandler);
  app.get("/fv", fairValueHandler);
  app.post("/alerts/test", testAlertHandler);

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

// Ensure all imports include explicit file extensions for NodeNext compatibility.
