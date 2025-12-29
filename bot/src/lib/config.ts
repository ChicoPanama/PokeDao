import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  // API
  API_BASE_URL: z.string().default('http://localhost:3000'),

  // Feature flags
  READONLY_MODE: z.string().transform(v => v === 'true').default('false'),

  // Alert settings
  DEFAULT_MIN_DISCOUNT_PCT: z.string().transform(v => Number(v) || 10).default('10'),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
