import 'dotenv/config';
import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { runAgentTick } from './tick.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379/0');
const queueName = 'agent:scan';
const scanQueue = new Queue(queueName, { connection });

const enabled = process.env.AGENT_ENABLED !== 'false';
const repeatMs = Number(process.env.AGENT_REPEAT_MS || 15 * 60 * 1000);
const jobTimeoutMs = Number(process.env.AGENT_TIMEOUT_MS || 60_000);

async function main() {
  if (enabled) {
    const repeat: JobsOptions = {
      jobId: 'agent-tick',
      repeat: { every: repeatMs },
      timeout: jobTimeoutMs,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    } as any;
    await scanQueue.add('tick', {}, repeat);
    console.log(`[agent] scheduled repeat every ${Math.round(repeatMs / 60000)} min (timeout ${jobTimeoutMs}ms)`);

    // Optionally enqueue an immediate tick for smoke test
    if (process.env.AGENT_ADD_IMMEDIATE !== 'false') {
      await scanQueue.add('tick-now', {}, { timeout: jobTimeoutMs, removeOnComplete: true, removeOnFail: { count: 10 } as any });
      console.log('[agent] enqueued immediate tick-now');
    }
  } else {
    console.log('[agent] scheduling disabled (AGENT_ENABLED=false)');
  }

  const worker = new Worker(
    queueName,
    async () => {
      console.time('[agent] tick');
      try {
        await runAgentTick();
      } catch (e) {
        console.error('[agent] tick error:', e);
        throw e; // let BullMQ record failure
      } finally {
        console.timeEnd('[agent] tick');
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`[agent] completed job ${job.id}`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[agent] failed job ${job?.id}:`, err?.message);
  });
  worker.on('stalled', (jobId) => {
    console.warn(`[agent] stalled job ${jobId}`);
  });
  worker.on('error', (err) => {
    console.error('[agent] worker error:', err);
  });

  console.log('[agent] worker up');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
