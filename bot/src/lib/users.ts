/**
 * User repository for Telegram bot
 */

import { db } from './db.js';
import { nanoid } from 'nanoid';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/**
 * Find or create a user from Telegram context
 */
export async function findOrCreateUser(telegramUser: TelegramUser) {
  const telegramId = String(telegramUser.id);
  
  // Try to find existing user
  let user = await db.user.findUnique({
    where: { telegramId },
    include: {
      watchlistItems: {
        include: { card: true }
      }
    }
  });

  if (!user) {
    // Create new user with unique referral code
    const referralCode = `PD${nanoid(8).toUpperCase()}`;
    
    user = await db.user.create({
      data: {
        telegramId,
        username: telegramUser.username || null,
        firstName: telegramUser.first_name || null,
        lastName: telegramUser.last_name || null,
        referralCode,
      },
      include: {
        watchlistItems: {
          include: { card: true }
        }
      }
    });
  }

  return user;
}

/**
 * Get user by Telegram ID
 */
export async function getUserByTelegramId(telegramId: string) {
  return db.user.findUnique({
    where: { telegramId },
    include: {
      watchlistItems: {
        include: { card: true }
      },
      purchases: true
    }
  });
}

/**
 * Add card to user's watchlist
 */
export async function addToWatchlist(userId: string, cardId: string) {
  // Check if already watching
  const existing = await db.watchlistItem.findFirst({
    where: { userId, cardId }
  });

  if (existing) {
    return { created: false, item: existing };
  }

  const item = await db.watchlistItem.create({
    data: { userId, cardId },
    include: { card: true }
  });

  return { created: true, item };
}

/**
 * Remove card from watchlist
 */
export async function removeFromWatchlist(userId: string, cardId: string) {
  const deleted = await db.watchlistItem.deleteMany({
    where: { userId, cardId }
  });

  return deleted.count > 0;
}

/**
 * Get user's watchlist
 */
export async function getWatchlist(userId: string) {
  return db.watchlistItem.findMany({
    where: { userId },
    include: { card: true },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Record a purchase
 */
export async function recordPurchase(
  userId: string,
  listingId: string,
  amountCents: number,
  feeCents: number
) {
  return db.purchase.create({
    data: {
      userId,
      listingId,
      amount: amountCents / 100,
      fee: feeCents / 100,
      status: 'recorded'
    }
  });
}
