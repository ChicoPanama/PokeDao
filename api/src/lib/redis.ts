import { createClient, type RedisClientType } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Upstash requires TLS - enable if using rediss:// or if URL contains upstash.io
const isTLS = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');

const client = createClient({
  url: redisUrl,
  socket: isTLS ? {
    tls: true,
    rejectUnauthorized: false // Upstash uses self-signed certs
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