/**
 * Discord User Management
 *
 * Handles user registration, lookup, and wallet management for Discord users.
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { nanoid } from 'nanoid';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscordUserInput {
  discordId: string;
  username?: string;
  discriminator?: string;
  guildId?: string;
}

export interface DiscordUser {
  id: string;
  discordId: string;
  username?: string;
  referralCode: string;
  walletAddress?: string | null;
  tier?: string;
  tokenBalance?: number;
  alertsEnabled: boolean;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Find or create a Discord user
 */
export async function findOrCreateDiscordUser(input: DiscordUserInput): Promise<DiscordUser> {
  const { discordId, username, guildId } = input;

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { discordId },
    include: { preferences: true },
  });

  if (user) {
    // Update username if changed
    if (username && user.username !== username) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { username },
        include: { preferences: true },
      });
    }

    return mapUser(user);
  }

  // Create new user with retry logic for race conditions
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const referralCode = nanoid(8);

      user = await prisma.user.create({
        data: {
          discordId,
          username,
          referralCode,
          preferences: {
            create: {
              alertsEnabled: true,
              minDiscountPct: 10,
              minPriceUsd: 0,
              maxPriceUsd: 10000,
              grades: ['PSA 10', 'PSA 9', 'CGC 10', 'BGS 10'],
            },
          },
        },
        include: { preferences: true },
      });

      logger.info({ discordId, userId: user.id }, '[Discord] Created new user');
      return mapUser(user);
    } catch (error: any) {
      lastError = error;

      // Check if it's a unique constraint violation (race condition)
      if (error.code === 'P2002') {
        // Try to fetch the user that was created by another request
        const existing = await prisma.user.findUnique({
          where: { discordId },
          include: { preferences: true },
        });

        if (existing) {
          return mapUser(existing);
        }
      }

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error('Failed to create user after retries');
}

/**
 * Get Discord user by ID
 */
export async function getDiscordUser(discordId: string): Promise<DiscordUser | null> {
  const user = await prisma.user.findUnique({
    where: { discordId },
    include: { preferences: true },
  });

  return user ? mapUser(user) : null;
}

/**
 * Update user wallet address
 */
export async function updateDiscordUserWallet(
  discordId: string,
  walletAddress: string | null
): Promise<DiscordUser | null> {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user) return null;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { walletAddress },
    include: { preferences: true },
  });

  return mapUser(updated);
}

// ============================================================================
// WATCHLIST OPERATIONS
// ============================================================================

/**
 * Get user's watchlist
 */
export async function getDiscordUserWatchlist(
  discordId: string
): Promise<Array<{ cardName: string; addedAt: Date }>> {
  const user = await prisma.user.findUnique({
    where: { discordId },
    include: {
      watchlistItems: {
        include: { card: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) return [];

  return user.watchlistItems.map(item => ({
    cardName: item.card?.name || item.cardId,
    addedAt: item.createdAt,
  }));
}

/**
 * Add card to watchlist
 */
export async function addToDiscordWatchlist(discordId: string, cardName: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Find card by name (fuzzy match)
  const card = await prisma.card.findFirst({
    where: {
      name: { contains: cardName, mode: 'insensitive' },
    },
  });

  const cardId = card?.id || cardName;

  // Check if already watching
  const existing = await prisma.watchlistItem.findFirst({
    where: { userId: user.id, cardId },
  });

  if (existing) {
    return; // Already watching
  }

  await prisma.watchlistItem.create({
    data: {
      userId: user.id,
      cardId,
    },
  });
}

/**
 * Remove card from watchlist
 */
export async function removeFromDiscordWatchlist(discordId: string, cardName: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user) return false;

  // Find card
  const card = await prisma.card.findFirst({
    where: {
      name: { contains: cardName, mode: 'insensitive' },
    },
  });

  const cardId = card?.id || cardName;

  const result = await prisma.watchlistItem.deleteMany({
    where: { userId: user.id, cardId },
  });

  return result.count > 0;
}

// ============================================================================
// HELPERS
// ============================================================================

function mapUser(user: any): DiscordUser {
  return {
    id: user.id,
    discordId: user.discordId,
    username: user.username,
    referralCode: user.referralCode,
    walletAddress: user.walletAddress,
    tier: user.tier || 'FREE',
    tokenBalance: user.tokenBalance || 0,
    alertsEnabled: user.preferences?.alertsEnabled ?? true,
  };
}
