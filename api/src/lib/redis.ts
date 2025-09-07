import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const client = createClient({ url: redisUrl });

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export function getRedis() {
  if (!client.isOpen) {
    client.connect();
  }
  return client;
}