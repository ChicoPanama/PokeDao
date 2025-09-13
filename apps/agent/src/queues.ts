import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379/0');

export const scanQueue = new Queue('agent:scan', { connection });
export const postQueue = new Queue('agent:post', { connection });

export async function shutdownQueues() {
  try { await scanQueue.close(); } catch {}
  try { await postQueue.close(); } catch {}
  const conn: any = (scanQueue as any).opts?.connection || (postQueue as any).opts?.connection;
  try {
    if (conn && typeof conn.quit === 'function') await conn.quit();
  } catch {}
}
