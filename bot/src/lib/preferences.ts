/**
 * User Preferences Service
 * Persists user alert preferences to database with Redis caching
 */

import { prisma } from './prisma.js';
import { logger } from './logger.js';

// Default preferences
const DEFAULT_PREFERENCES = {
  alertsEnabled: true,
  minDiscountPct: 10,
  minPriceUsd: 0,
  maxPriceUsd: 10000,
  grades: ['PSA 10', 'PSA 9', 'CGC 10', 'BGS 10'],
  snoozedCards: {} as Record<string, number>, // cardId -> expiresAt timestamp
};

export type UserPreferences = typeof DEFAULT_PREFERENCES;

// In-memory cache with TTL (Redis can be added later for multi-instance)
const preferencesCache = new Map<string, { prefs: UserPreferences; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get user preferences by Telegram ID
 * Uses cache first, then DB, creates default if not found
 */
export async function getPreferences(telegramId: string): Promise<UserPreferences> {
  // Check cache first
  const cached = preferencesCache.get(telegramId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prefs;
  }

  try {
    // Find user and preferences
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { preferences: true },
    });

    if (!user) {
      // Return defaults if user doesn't exist
      return { ...DEFAULT_PREFERENCES };
    }

    let prefs: UserPreferences;

    if (user.preferences) {
      // Map DB record to UserPreferences
      prefs = {
        alertsEnabled: user.preferences.alertsEnabled,
        minDiscountPct: user.preferences.minDiscountPct,
        minPriceUsd: user.preferences.minPriceUsd,
        maxPriceUsd: user.preferences.maxPriceUsd,
        grades: user.preferences.grades,
        snoozedCards: (user.preferences.snoozedCards as Record<string, number>) || {},
      };
    } else {
      // Create default preferences for user
      const created = await prisma.userPreference.create({
        data: {
          userId: user.id,
          alertsEnabled: DEFAULT_PREFERENCES.alertsEnabled,
          minDiscountPct: DEFAULT_PREFERENCES.minDiscountPct,
          minPriceUsd: DEFAULT_PREFERENCES.minPriceUsd,
          maxPriceUsd: DEFAULT_PREFERENCES.maxPriceUsd,
          grades: DEFAULT_PREFERENCES.grades,
          snoozedCards: {},
        },
      });
      prefs = {
        ...DEFAULT_PREFERENCES,
        snoozedCards: {},
      };
    }

    // Cache the result
    preferencesCache.set(telegramId, {
      prefs,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return prefs;
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to get preferences');
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Update user preferences
 */
export async function updatePreferences(
  telegramId: string,
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  try {
    // Find user first
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { preferences: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prepare update data
    const updateData: any = {};
    if (updates.alertsEnabled !== undefined) updateData.alertsEnabled = updates.alertsEnabled;
    if (updates.minDiscountPct !== undefined) updateData.minDiscountPct = updates.minDiscountPct;
    if (updates.minPriceUsd !== undefined) updateData.minPriceUsd = updates.minPriceUsd;
    if (updates.maxPriceUsd !== undefined) updateData.maxPriceUsd = updates.maxPriceUsd;
    if (updates.grades !== undefined) updateData.grades = updates.grades;
    if (updates.snoozedCards !== undefined) updateData.snoozedCards = updates.snoozedCards;

    // Upsert preferences
    const updated = await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...DEFAULT_PREFERENCES,
        snoozedCards: DEFAULT_PREFERENCES.snoozedCards,
        ...updateData,
      },
      update: updateData,
    });

    // Build full preferences object
    const prefs: UserPreferences = {
      alertsEnabled: updated.alertsEnabled,
      minDiscountPct: updated.minDiscountPct,
      minPriceUsd: updated.minPriceUsd,
      maxPriceUsd: updated.maxPriceUsd,
      grades: updated.grades,
      snoozedCards: (updated.snoozedCards as Record<string, number>) || {},
    };

    // Update cache
    preferencesCache.set(telegramId, {
      prefs,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    logger.debug({ telegramId, updates }, 'Preferences updated');
    return prefs;
  } catch (error) {
    logger.error({ error, telegramId }, 'Failed to update preferences');
    throw error;
  }
}

/**
 * Invalidate preferences cache for a user
 */
export function invalidatePreferencesCache(telegramId: string): void {
  preferencesCache.delete(telegramId);
}

/**
 * Add a card to snoozed list
 */
export async function snoozeCard(
  telegramId: string,
  cardId: string,
  durationMs: number = 24 * 60 * 60 * 1000 // 24 hours default
): Promise<void> {
  const prefs = await getPreferences(telegramId);
  const snoozedCards = { ...prefs.snoozedCards };
  snoozedCards[cardId] = Date.now() + durationMs;
  await updatePreferences(telegramId, { snoozedCards });
}

/**
 * Remove a card from snoozed list
 */
export async function unsnoozeCard(telegramId: string, cardId: string): Promise<void> {
  const prefs = await getPreferences(telegramId);
  const snoozedCards = { ...prefs.snoozedCards };
  delete snoozedCards[cardId];
  await updatePreferences(telegramId, { snoozedCards });
}

/**
 * Check if a card is currently snoozed
 */
export function isCardSnoozed(prefs: UserPreferences, cardId: string): boolean {
  const expiresAt = prefs.snoozedCards[cardId];
  if (!expiresAt) return false;
  return expiresAt > Date.now();
}

/**
 * Clean up expired snoozed cards from preferences
 */
export async function cleanupExpiredSnoozes(telegramId: string): Promise<void> {
  const prefs = await getPreferences(telegramId);
  const now = Date.now();
  const snoozedCards: Record<string, number> = {};
  let hasChanges = false;

  for (const [cardId, expiresAt] of Object.entries(prefs.snoozedCards)) {
    if (expiresAt > now) {
      snoozedCards[cardId] = expiresAt;
    } else {
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await updatePreferences(telegramId, { snoozedCards });
  }
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(telegramId: string): Promise<UserPreferences> {
  return updatePreferences(telegramId, { ...DEFAULT_PREFERENCES, snoozedCards: {} });
}

/**
 * Get all users with alerts enabled (for broadcasting)
 */
export async function getUsersWithAlertsEnabled(): Promise<
  Array<{ telegramId: string; userId: string; prefs: UserPreferences }>
> {
  try {
    const users = await prisma.user.findMany({
      where: {
        preferences: {
          alertsEnabled: true,
        },
      },
      include: {
        preferences: true,
      },
    });

    return users
      .filter((u) => u.preferences)
      .map((u) => ({
        telegramId: u.telegramId,
        userId: u.id,
        prefs: {
          alertsEnabled: u.preferences!.alertsEnabled,
          minDiscountPct: u.preferences!.minDiscountPct,
          minPriceUsd: u.preferences!.minPriceUsd,
          maxPriceUsd: u.preferences!.maxPriceUsd,
          grades: u.preferences!.grades,
          snoozedCards: (u.preferences!.snoozedCards as Record<string, number>) || {},
        },
      }));
  } catch (error) {
    logger.error({ error }, 'Failed to get users with alerts enabled');
    return [];
  }
}

// Cleanup cache periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of preferencesCache.entries()) {
    if (value.expiresAt < now) {
      preferencesCache.delete(key);
    }
  }
}, 10 * 60 * 1000);
