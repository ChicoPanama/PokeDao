import { Redis } from 'ioredis';
import { Queue } from 'bullmq';

export const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/0');

export const SCAN_Q = 'agent:scan';
export const POST_Q = 'agent:post';

export const scanQueue = new Queue(SCAN_Q, { connection });
export const postQueue = new Queue(POST_Q, { connection });

