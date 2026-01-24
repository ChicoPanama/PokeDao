/**
 * Admin-only middleware for Telegram bot
 *
 * Restricts certain commands to admin users only.
 */

import { Context, NextFunction } from 'grammy';

// Parse admin IDs from environment variable
// Format: comma-separated Telegram user IDs (e.g., "123456789,987654321")
const ADMIN_IDS: Set<string> = new Set(
  (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

/**
 * Check if a user ID is an admin
 */
export function isAdmin(userId: string | number | undefined): boolean {
  if (userId === undefined || userId === null) return false;
  return ADMIN_IDS.has(String(userId));
}

/**
 * Admin-only middleware
 *
 * Blocks non-admin users from accessing protected commands.
 */
export async function adminOnlyMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const userId = ctx.from?.id;

  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is restricted to administrators.');
    return;
  }

  return next();
}

/**
 * Get the list of admin IDs (for debugging)
 */
export function getAdminIds(): string[] {
  return Array.from(ADMIN_IDS);
}
