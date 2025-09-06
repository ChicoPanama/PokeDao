declare module "lib/redis.js" {
  import { Redis } from "ioredis";

  export function getRedis(): Redis;
}
