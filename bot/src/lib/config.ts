import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (parent of bot directory)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../../../.env') });

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
  READONLY_MODE: z.string().default('false').transform(v => v === 'true'),

  // Alert settings
  DEFAULT_MIN_DISCOUNT_PCT: z.string().default('10').transform(v => Number(v) || 10),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
