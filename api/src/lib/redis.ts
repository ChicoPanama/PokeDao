import { Redis } from "ioredis";

const url = process.env.REDIS_URL || "redis://redis:6379";

let client: Redis | undefined;

export function getRedis() {
  if (!client) client = new Redis(url);
  return client;
}
