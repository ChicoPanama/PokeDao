import 'dotenv/config';
import { Worker, JobsOptions } from 'bullmq';
import { connection, SCAN_Q, POST_Q, scanQueue, postQueue } from './queues.js';
import { runAgentTick } from './tick.js';
import { postDailyBest } from './pipelines/daily.js';

// ---- Scan worker (15-min orchestration) ----
const ENABLED = process.env.AGENT_ENABLED !== 'false';
const EVERY_MS = Number(process.env.AGENT_REPEAT_MS || 15 * 60 * 1000);
const TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 60_000);
const ADD_IMMEDIATE = process.env.AGENT_ADD_IMMEDIATE !== 'false';

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race<T>([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`agent tick timeout after ${ms}ms`)), ms)) as Promise<T>,
  ]);
}

async function scheduleScan() {
  if (!ENABLED) return console.log('[agent] scheduling disabled');
  const repeat: JobsOptions = { jobId: 'agent-tick', repeat: { every: EVERY_MS } } as any;
  await scanQueue.add('tick', {}, repeat);
  console.log(`[agent] scheduled scan every ${Math.round(EVERY_MS/60000)} min`);
  if (ADD_IMMEDIATE) {
    await scanQueue.add('tick-now', {}, { jobId: `tick-now-${Date.now()}`, removeOnComplete: true, removeOnFail: true });
    console.log('[agent] enqueued immediate tick');
  }
}

new Worker(
  SCAN_Q,
  async (job) => {
    console.time('[agent] tick');
    try { await withTimeout(runAgentTick(), TIMEOUT_MS); console.log(`[agent] ${job.name} ok`); }
    catch (e) { console.error('[agent] tick error:', e); throw e; }
    finally { console.timeEnd('[agent] tick'); }
  },
  { connection }
);

// ---- Post worker (daily + flash) ----
new Worker(
  POST_Q,
  async (job) => {
    const kind = job.data?.kind as 'daily' | 'flash' | undefined;
    if (kind === 'daily') return postDailyBest();
    if (kind === 'flash') {
      const lines: string[] = job.data?.lines || [];
      if (lines.length) {
        const { postThread } = await import('../../../packages/social/x/client.js');
        await postThread(lines);
      }
      return;
    }
    console.log('[post] unknown job kind');
  },
  { connection }
);

async function scheduleDaily() {
  const cron = process.env.DAILY_POST_CRON || '5 10 * * *';
  const tz   = process.env.TZ || 'America/Los_Angeles';
  const opts: JobsOptions = { jobId: 'post-daily', repeat: { cron, tz } } as any;
  await postQueue.add('daily', { kind: 'daily' }, opts);
  console.log(`[post] scheduled daily thread at cron="${cron}" tz="${tz}"`);
}

await scheduleScan();
await scheduleDaily();
console.log('[agent] workers up');
