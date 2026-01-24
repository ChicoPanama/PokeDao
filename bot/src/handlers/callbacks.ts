/**
 * Inline button callback handlers
 *
 * Handles button clicks for deal alerts (Bought, Watch, Ignore).
 */

import { Context } from 'grammy';
import { getUserByTelegramId, addToWatchlist, recordPurchase } from '../lib/users.js';
import { db } from '../lib/db.js';
import { sanitizeCallbackId } from '../lib/validation.js';

// =============================================================================
// DEAL CACHE WITH EXPIRATION AND AUTHORIZATION
// =============================================================================

// Cache configuration
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 10000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface CachedDeal {
  listingId: string;
  cardId: string;
  cardName: string;
  priceCents: number;
  expiresAt: number;
  telegramUserId: string; // Track who received this deal for authorization
}

// Simple in-memory cache for pending interactions
// In production, this should be Redis for multi-instance support
const pendingDeals = new Map<string, CachedDeal>();

/**
 * Cleanup expired cache entries
 */
function cleanupExpiredDeals(): void {
  const now = Date.now();
  let cleaned = 0;

  // Use Array.from for ES5 compatibility
  const entries = Array.from(pendingDeals.entries());
  for (const [key, value] of entries) {
    if (value.expiresAt < now) {
      pendingDeals.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired deals from cache`);
  }
}

// Start periodic cleanup
setInterval(cleanupExpiredDeals, CLEANUP_INTERVAL_MS);

/**
 * Store deal info for callback handling
 *
 * @param listingId - The listing ID (cache key)
 * @param telegramUserId - The Telegram user ID who received this deal
 * @param data - Deal data to cache
 */
export function cacheDeal(
  listingId: string,
  telegramUserId: string,
  data: {
    cardId: string;
    cardName: string;
    priceCents: number;
  }
): void {
  // Enforce max cache size by removing oldest entry
  if (pendingDeals.size >= MAX_CACHE_SIZE) {
    const oldestKey = pendingDeals.keys().next().value;
    if (oldestKey) {
      pendingDeals.delete(oldestKey);
    }
  }

  pendingDeals.set(listingId, {
    ...data,
    listingId,
    telegramUserId,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// =============================================================================
// CALLBACK HANDLERS
// =============================================================================

/**
 * Handle "Bought" callback
 */
export async function handleBoughtCallback(ctx: Context): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  // Validate callback ID
  const listingId = sanitizeCallbackId('bought:', callbackData);
  if (!listingId) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid request' });
    return;
  }

  const from = ctx.from;
  if (!from) {
    await ctx.answerCallbackQuery({ text: '❌ User not found' });
    return;
  }

  try {
    const user = await getUserByTelegramId(String(from.id));
    if (!user) {
      await ctx.answerCallbackQuery({ text: '❌ Please /start first' });
      return;
    }

    // Get cached deal for authorization check
    const cachedDeal = pendingDeals.get(listingId);

    // Authorization check: only the user who received the deal can mark it bought
    if (cachedDeal && cachedDeal.telegramUserId !== String(from.id)) {
      await ctx.answerCallbackQuery({ text: '❌ This deal was sent to another user' });
      return;
    }

    // Get listing from database
    const listing = await db.listing.findFirst({
      where: { id: listingId },
      include: { card: true },
    });

    const priceCents = cachedDeal?.priceCents || (listing?.price ? listing.price * 100 : 0);
    const feeCents = Math.round(priceCents * 0.01); // 1% fee

    // Record the purchase
    await recordPurchase(user.id, listingId, priceCents, feeCents);

    const cardName = cachedDeal?.cardName || listing?.card?.name || 'Unknown Card';
    const priceUsd = (priceCents / 100).toFixed(2);

    await ctx.answerCallbackQuery({ text: '✅ Purchase recorded!' });

    await ctx.editMessageText(
      `✅ *Purchase Recorded\\!*\n\n` +
        `📦 ${escapeMarkdown(cardName)}\n` +
        `💵 $${priceUsd}\n\n` +
        `Good luck with your investment\\! 🍀`,
      { parse_mode: 'MarkdownV2' }
    );

    // Log without exposing full Telegram ID
    console.log(`💰 Purchase recorded: user=${user.id} listing=${listingId}`);
  } catch (error) {
    console.error('❌ Error in bought callback:', error);
    await ctx.answerCallbackQuery({ text: '❌ Error recording purchase' });
  }
}

/**
 * Handle "Watch" callback
 */
export async function handleWatchCallback(ctx: Context): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  // Validate callback ID
  const cardId = sanitizeCallbackId('watch:', callbackData);
  if (!cardId) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid request' });
    return;
  }

  const from = ctx.from;
  if (!from) {
    await ctx.answerCallbackQuery({ text: '❌ User not found' });
    return;
  }

  try {
    const user = await getUserByTelegramId(String(from.id));
    if (!user) {
      await ctx.answerCallbackQuery({ text: '❌ Please /start first' });
      return;
    }

    const result = await addToWatchlist(user.id, cardId);

    if (result.created) {
      await ctx.answerCallbackQuery({ text: '👁️ Added to watchlist!' });
    } else {
      await ctx.answerCallbackQuery({ text: '👁️ Already watching this card' });
    }

    // Log without exposing Telegram ID
    console.log(`👁️ Watchlist updated: user=${user.id} card=${cardId}`);
  } catch (error) {
    console.error('❌ Error in watch callback:', error);
    await ctx.answerCallbackQuery({ text: '❌ Error updating watchlist' });
  }
}

/**
 * Handle "Ignore" callback
 */
export async function handleIgnoreCallback(ctx: Context): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  // Validate callback ID
  const listingId = sanitizeCallbackId('ignore:', callbackData);
  if (!listingId) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid request' });
    return;
  }

  try {
    // Remove from cache if present
    pendingDeals.delete(listingId);

    await ctx.answerCallbackQuery({ text: '🔕 Alert dismissed' });

    // Update message to show it was dismissed
    await ctx.editMessageText(
      '🔕 *Alert Dismissed*\n\nThis deal has been hidden\\.',
      { parse_mode: 'MarkdownV2' }
    );

    console.log(`🔕 Alert dismissed: ${listingId}`);
  } catch (error) {
    console.error('❌ Error in ignore callback:', error);
    await ctx.answerCallbackQuery({ text: '❌ Error dismissing alert' });
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
