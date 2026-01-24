/**
 * Rate limiting middleware for Telegram bot
 *
 * Prevents command spam and DoS attacks by limiting
 * the number of commands a user can send per time window.
 */

import { Context, NextFunction } from 'grammy';

// Rate limit configuration
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_COMMANDS = 10; // Max commands per window

// Track command timestamps per user
const userCommandTimes = new Map<string, number[]>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Rate limiting middleware
 *
 * Tracks command frequency per user and blocks excessive requests.
 */
export async function rateLimitMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const userId = ctx.from?.id?.toString();

  // Allow requests without user ID (shouldn't happen, but be safe)
  if (!userId) {
    return next();
  }

  const now = Date.now();
  const times = userCommandTimes.get(userId) || [];

  // Filter to only timestamps within the current window
  const recentTimes = times.filter((t) => now - t < WINDOW_MS);

  // Check if rate limited
  if (recentTimes.length >= MAX_COMMANDS) {
    await ctx.reply('⏳ Too many commands. Please wait a minute before trying again.');
    return;
  }

  // Record this command
  recentTimes.push(now);
  userCommandTimes.set(userId, recentTimes);

  return next();
}

/**
 * Cleanup old rate limit entries
 *
 * Call this periodically to prevent memory buildup.
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;

  // Use Array.from for ES5 compatibility
  const entries = Array.from(userCommandTimes.entries());
  for (const [userId, times] of entries) {
    // Remove users with no recent activity
    if (times.every((t) => now - t > WINDOW_MS)) {
      userCommandTimes.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} stale rate limit entries`);
  }
}

// Start periodic cleanup
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startRateLimitCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupRateLimits, CLEANUP_INTERVAL_MS);
  console.log('🔄 Rate limit cleanup scheduled');
}

export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
