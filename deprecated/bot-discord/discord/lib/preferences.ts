/**
 * Discord User Preferences
 *
 * Manages alert preferences for Discord users with caching.
 */

import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscordUserPreferences {
  alertsEnabled: boolean;
  minDiscountPct: number;
  minPriceUsd: number;
  maxPriceUsd: number;
  grades: string[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
  snoozedCards: Record<string, number>; // cardId -> expiresAt timestamp
}

// ============================================================================
// CACHE
// ============================================================================

const preferencesCache = new Map<string, { prefs: DiscordUserPreferences; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// PREFERENCES OPERATIONS
// ============================================================================

/**
 * Get user preferences (with caching)
 */
export async function getDiscordUserPreferences(discordId: string): Promise<DiscordUserPreferences> {
  // Check cache
  const cached = preferencesCache.get(discordId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prefs;
  }

  // Fetch from DB
  const user = await prisma.user.findUnique({
    where: { discordId },
    include: { preferences: true },
  });

  const prefs: DiscordUserPreferences = {
    alertsEnabled: user?.preferences?.alertsEnabled ?? true,
    minDiscountPct: user?.preferences?.minDiscountPct ?? 10,
    minPriceUsd: user?.preferences?.minPriceUsd ?? 0,
    maxPriceUsd: user?.preferences?.maxPriceUsd ?? 10000,
    grades: (user?.preferences?.grades as string[]) ?? ['PSA 10', 'PSA 9', 'CGC 10', 'BGS 10'],
    quietHoursStart: user?.preferences?.quietHoursStart ?? undefined,
    quietHoursEnd: user?.preferences?.quietHoursEnd ?? undefined,
    snoozedCards: (user?.preferences?.snoozedCards as Record<string, number>) ?? {},
  };

  // Cache the result
  preferencesCache.set(discordId, {
    prefs,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return prefs;
}

/**
 * Update user preferences
 */
export async function updateDiscordUserPreferences(
  discordId: string,
  updates: Partial<DiscordUserPreferences>
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Build update data
  const data: any = {};
  if (updates.alertsEnabled !== undefined) data.alertsEnabled = updates.alertsEnabled;
  if (updates.minDiscountPct !== undefined) data.minDiscountPct = updates.minDiscountPct;
  if (updates.minPriceUsd !== undefined) data.minPriceUsd = updates.minPriceUsd;
  if (updates.maxPriceUsd !== undefined) data.maxPriceUsd = updates.maxPriceUsd;
  if (updates.grades !== undefined) data.grades = updates.grades;
  if (updates.quietHoursStart !== undefined) data.quietHoursStart = updates.quietHoursStart;
  if (updates.quietHoursEnd !== undefined) data.quietHoursEnd = updates.quietHoursEnd;

  // Upsert preferences
  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: data,
    create: {
      userId: user.id,
      alertsEnabled: updates.alertsEnabled ?? true,
      minDiscountPct: updates.minDiscountPct ?? 10,
      minPriceUsd: updates.minPriceUsd ?? 0,
      maxPriceUsd: updates.maxPriceUsd ?? 10000,
      grades: updates.grades ?? ['PSA 10', 'PSA 9', 'CGC 10', 'BGS 10'],
    },
  });

  // Invalidate cache
  preferencesCache.delete(discordId);

  logger.debug({ discordId, updates }, '[Discord] Preferences updated');
}

/**
 * Snooze a card for a Discord user
 */
export async function snoozeDiscordCard(
  discordId: string,
  cardId: string,
  durationMs: number = 24 * 60 * 60 * 1000 // Default 24h
): Promise<void> {
  const prefs = await getDiscordUserPreferences(discordId);
  const snoozedCards = { ...prefs.snoozedCards };
  snoozedCards[cardId] = Date.now() + durationMs;

  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user) return;

  await prisma.userPreference.update({
    where: { userId: user.id },
    data: { snoozedCards },
  });

  // Invalidate cache
  preferencesCache.delete(discordId);
}

/**
 * Check if card is snoozed for user
 */
export function isCardSnoozed(prefs: DiscordUserPreferences, cardId: string): boolean {
  const expiresAt = prefs.snoozedCards[cardId];
  if (!expiresAt) return false;
  return expiresAt > Date.now();
}

/**
 * Get all Discord users with alerts enabled
 */
export async function getDiscordUsersWithAlertsEnabled(): Promise<
  Array<{ discordId: string; userId: string; prefs: DiscordUserPreferences }>
> {
  const users = await prisma.user.findMany({
    where: {
      discordId: { not: null },
      preferences: { alertsEnabled: true },
    },
    include: { preferences: true },
  });

  return users
    .filter(u => u.discordId)
    .map(u => ({
      discordId: u.discordId!,
      userId: u.id,
      prefs: {
        alertsEnabled: u.preferences?.alertsEnabled ?? true,
        minDiscountPct: u.preferences?.minDiscountPct ?? 10,
        minPriceUsd: u.preferences?.minPriceUsd ?? 0,
        maxPriceUsd: u.preferences?.maxPriceUsd ?? 10000,
        grades: (u.preferences?.grades as string[]) ?? [],
        snoozedCards: (u.preferences?.snoozedCards as Record<string, number>) ?? {},
      },
    }));
}
