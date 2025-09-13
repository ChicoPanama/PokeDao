import 'dotenv/config';
import IORedis from 'ioredis';
import { Queue, Worker, JobsOptions } from 'bullmq';
import { runAgentTick } from './tick.js';
import { postDailyBest } from './pipelines/daily.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379/0');

// --- scan worker ---
const scanQueueName = 'agent:scan';
const scanQueue = new Queue(scanQueueName, { connection });
const enabled = process.env.AGENT_ENABLED !== 'false';
const repeatMs = Number(process.env.AGENT_REPEAT_MS || 15 * 60 * 1000);
const addImmediate = process.env.AGENT_ADD_IMMEDIATE !== 'false';

new Worker(
  scanQueueName,
  async () => {
    console.time('[agent] tick');
    try {
      await runAgentTick();
    } catch (e) {
      console.error('[agent] tick error:', e);
      throw e;
    } finally {
      console.timeEnd('[agent] tick');
    }
  },
  { connection }
);

// --- post worker ---
const postQueueName = 'agent:post';
const postQueue = new Queue(postQueueName, { connection });

new Worker(
  postQueueName,
  async (job) => {
    const kind = job.data?.kind as string | undefined;
    if (kind === 'daily') return postDailyBest();
    if (kind === 'flash') {
      const { postThread } = await import('../../../packages/social/x/client.js');
      const lines: string[] = job.data?.lines || [];
      if (lines.length) await postThread(lines);
      return;
    }
  },
  { connection }
);

async function bootstrap() {
  if (enabled) {
    const repeat: JobsOptions = { jobId: 'agent-tick', repeat: { every: repeatMs } } as any;
    await scanQueue.add('tick', {}, repeat);
    console.log(`[agent] scheduled repeat every ${Math.round(repeatMs / 60000)} min`);
    if (addImmediate) {
      await scanQueue.add('tick-now', {}, { removeOnComplete: true, removeOnFail: true });
      console.log('[agent] enqueued immediate tick');
    }
  } else {
    console.log('[agent] scheduling disabled (AGENT_ENABLED=false)');
  }

  // daily post schedule
  const cron = process.env.DAILY_POST_CRON || '5 10 * * *';
  const tz = process.env.TZ || 'America/Los_Angeles';
  const opts: JobsOptions = { jobId: 'post-daily', repeat: { cron, tz } } as any;
  await postQueue.add('daily', { kind: 'daily' }, opts);
  console.log(`[post] scheduled daily thread at cron="${cron}" tz="${tz}"`);

  // keepalive log so external tools don’t think we’re idle
  const keepAliveMs = Number(process.env.AGENT_KEEPALIVE_MS || 15000);
  setInterval(() => process.stdout.write('[agent] alive\n'), keepAliveMs);

  console.log('[agent] workers up');
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
