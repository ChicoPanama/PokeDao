import { Context, MiddlewareFn } from 'grammy';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface UserContext extends Context {
  user: {
    id: string;
    telegramId: string;
    username: string | null;
    referralCode: string;
    alertsEnabled: boolean;
    minDiscountPct: number;
    walletAddress: string | null;
  };
}

/**
 * Middleware to ensure user exists in database and attach to context.
 * Creates new user if they don't exist.
 */
export const authMiddleware: MiddlewareFn<UserContext> = async (ctx, next) => {
  if (!ctx.from) {
    return next();
  }

  const telegramId = ctx.from.id.toString();

  try {
    // P1-6 Fix: Upsert with retry logic for race conditions
    let user;
    let retries = 3;
    while (retries > 0) {
      try {
        user = await prisma.user.upsert({
          where: { telegramId },
          update: {
            username: ctx.from.username || null,
            firstName: ctx.from.first_name || null,
            lastName: ctx.from.last_name || null,
          },
          create: {
            telegramId,
            username: ctx.from.username || null,
            firstName: ctx.from.first_name || null,
            lastName: ctx.from.last_name || null,
            referralCode: generateReferralCode(),
          },
        });
        break; // Success, exit retry loop
      } catch (upsertError: any) {
        const msg = String(upsertError?.message || '');
        // Retry on unique constraint violation (race condition)
        if (msg.includes('Unique constraint') && retries > 1) {
          retries--;
          logger.debug({ telegramId, retriesLeft: retries }, 'Upsert race condition, retrying');
          await new Promise(r => setTimeout(r, 50 * (4 - retries))); // Exponential backoff
          continue;
        }
        throw upsertError;
      }
    }
    if (!user) {
      throw new Error('Failed to upsert user after retries');
    }

    // Attach user to context for use in handlers
    ctx.user = {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      referralCode: user.referralCode,
      alertsEnabled: true, // Default, will be stored in User model later
      minDiscountPct: 10, // Default 10%
      walletAddress: null, // Will be implemented
    };

    logger.debug({ userId: user.id, telegramId }, 'User authenticated');
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to upsert user');
  }

  return next();
};

/**
 * Generate a unique referral code using cryptographically secure randomness
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomValues = randomBytes(6);
  let code = 'PKD';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(randomValues[i] % chars.length);
  }
  return code;
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

export const rateLimitMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  if (!ctx.from) return next();

  const key = ctx.from.id.toString();
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (record.count >= RATE_LIMIT_MAX) {
    logger.warn({ telegramId: key }, 'Rate limit exceeded');
    await ctx.reply('⏳ Too many requests. Please slow down.');
    return;
  } else {
    record.count++;
  }

  return next();
};
