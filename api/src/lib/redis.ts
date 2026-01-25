import { createClient, type RedisClientType } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Upstash requires TLS - enable if using rediss:// or if URL contains upstash.io
const isTLS = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');

// P1-2 Fix: TLS validation is enabled by default, can be disabled via env var for dev
const rejectUnauthorized = process.env.REDIS_TLS_VERIFY !== 'false';

const client = createClient({
  url: redisUrl,
  socket: isTLS ? {
    tls: true,
    rejectUnauthorized, // Verify TLS certs by default (set REDIS_TLS_VERIFY=false to disable)
  } : undefined
});

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export function getRedis(): RedisClientType {
  if (!client.isOpen) {
    client.connect();
  }
  return client as RedisClientType;
}