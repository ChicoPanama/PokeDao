/**
 * Alert System - Connects signal generation to Telegram notifications
 *
 * This module:
 * 1. Polls for new high-quality signals from the database
 * 2. Filters based on quality thresholds
 * 3. Formats and sends alerts to eligible Telegram users
 */

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Bot } from 'grammy';

// Lazy-initialized Prisma client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any = null;

async function getPrisma() {
  if (prisma) return prisma;
  const { PrismaClient } = await import('../../api/prisma/generated/client/client.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  return prisma;
}

// Alert thresholds
const ALERT_CONFIG = {
  MIN_EDGE_BP: Number(process.env.ALERT_MIN_EDGE_BP || 500), // 5% minimum edge
  MIN_CONFIDENCE: Number(process.env.ALERT_MIN_CONFIDENCE || 0.5),
  MIN_PRICE_USD: Number(process.env.ALERT_MIN_PRICE_USD || 50),
  MAX_ALERTS_PER_HOUR: Number(process.env.ALERT_MAX_PER_HOUR || 10),
  COOLDOWN_MINUTES: Number(process.env.ALERT_COOLDOWN_MINUTES || 15),
};

// Bounded cache configuration
const CACHE_CONFIG = {
  MAX_ENTRIES: 10000,
  TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
};

// Track sent alerts to prevent duplicates (bounded with TTL)
const sentAlerts = new Map<string, number>(); // alertKey -> timestamp
const lastAlertTime = new Map<string, number>(); // cardId -> timestamp

// Periodic cleanup to prevent memory leaks
let cleanupInterval: NodeJS.Timeout | null = null;

function startCacheCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const expiry = now - CACHE_CONFIG.TTL_MS;

    // Clean expired sentAlerts
    for (const [key, timestamp] of sentAlerts.entries()) {
      if (timestamp < expiry) {
        sentAlerts.delete(key);
      }
    }

    // Clean expired lastAlertTime
    for (const [key, timestamp] of lastAlertTime.entries()) {
      if (timestamp < expiry) {
        lastAlertTime.delete(key);
      }
    }

    // Enforce max entries (remove oldest if over limit)
    if (sentAlerts.size > CACHE_CONFIG.MAX_ENTRIES) {
      const entries = Array.from(sentAlerts.entries())
        .sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - CACHE_CONFIG.MAX_ENTRIES);
      for (const [key] of toRemove) {
        sentAlerts.delete(key);
      }
    }

    console.log(`[alertSystem] Cache cleanup: sentAlerts=${sentAlerts.size}, lastAlertTime=${lastAlertTime.size}`);
  }, CACHE_CONFIG.CLEANUP_INTERVAL_MS);
}

// Start cleanup on module load
startCacheCleanup();

export interface TelegramAlertData {
  listingId: string;
  cardName: string;
  setName: string;
  number?: string;
  grade?: string;
  source: string;
  priceUsd: number;
  fairValueUsd: number;
  discountPct: number;
  confidence: number;
  thesis: {
    rating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'PASS';
    reasoning: string;
    riskFactors?: string[];
  };
  listingUrl: string;
}

/**
 * Fetch new signals that qualify for alerting
 */
export async function fetchAlertableSignals(limit = 20): Promise<TelegramAlertData[]> {
  try {
    const db = await getPrisma();
    // Get recent signals with thesis
    const signals = await db.signal.findMany({
      where: {
        thesis: { not: '' },
        edgeBp: { gte: ALERT_CONFIG.MIN_EDGE_BP },
        confidence: { gte: ALERT_CONFIG.MIN_CONFIDENCE },
      },
      orderBy: [{ edgeBp: 'desc' }, { confidence: 'desc' }],
      take: limit,
      include: {
        card: true,
        marketListing: true,
      },
    });

    const alerts: TelegramAlertData[] = [];

    for (const sig of signals) {
      // Skip if already sent (check Map instead of Set)
      const alertKey = `${sig.id}`;
      if (sentAlerts.has(alertKey)) continue;

      // Guard against invalid edge values (prevents division by zero)
      const edgePctCheck = sig.edgeBp / 10000;
      if (edgePctCheck >= 1) {
        console.warn(`[alertSystem] Invalid edgeBp ${sig.edgeBp} (>=10000), skipping signal ${sig.id}`);
        continue;
      }

      // Skip if card was alerted recently (cooldown)
      const lastAlert = lastAlertTime.get(sig.cardId);
      if (lastAlert && Date.now() - lastAlert < ALERT_CONFIG.COOLDOWN_MINUTES * 60 * 1000) {
        continue;
      }

      const listing = sig.marketListing;
      if (!listing) continue;

      // Calculate price in USD
      const priceUsd = (listing.priceCents || 0) / 100;
      if (priceUsd < ALERT_CONFIG.MIN_PRICE_USD) continue;

      // Parse rating from thesis
      let rating: TelegramAlertData['thesis']['rating'] = 'BUY';
      const thesisUpper = (sig.thesis || '').toUpperCase();
      if (thesisUpper.includes('STRONG_BUY') || thesisUpper.includes('STRONG BUY')) {
        rating = 'STRONG_BUY';
      } else if (thesisUpper.includes('HOLD')) {
        rating = 'HOLD';
      } else if (thesisUpper.includes('PASS')) {
        rating = 'PASS';
      }

      // Extract risk factors from thesis
      const riskFactors: string[] = [];
      const flagsMatch = sig.thesis?.match(/\[flags:\s*([^\]]+)\]/i);
      if (flagsMatch) {
        riskFactors.push(...flagsMatch[1].split(',').map(s => s.trim()));
      }

      // Calculate fair value (edge = (fv - ask) / fv)
      // So: fv = ask / (1 - edge)
      const edgePct = sig.edgeBp / 10000;
      const fairValueUsd = priceUsd / (1 - edgePct);

      alerts.push({
        listingId: listing.id,
        cardName: sig.card?.name || 'Unknown',
        setName: sig.card?.set || sig.card?.setCode || '',
        number: sig.card?.number || undefined,
        grade: listing.grade || sig.card?.grade || undefined,
        source: listing.source || 'Unknown',
        priceUsd,
        fairValueUsd,
        discountPct: (sig.edgeBp / 100),
        confidence: sig.confidence,
        thesis: {
          rating,
          reasoning: sig.thesis?.replace(/\[flags:[^\]]+\]/i, '').trim() || '',
          riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
        },
        listingUrl: listing.url || '',
      });

      // Mark as sent (use Map.set for timestamp tracking)
      sentAlerts.set(alertKey, Date.now());
      lastAlertTime.set(sig.cardId, Date.now());

      // Limit alerts
      if (alerts.length >= ALERT_CONFIG.MAX_ALERTS_PER_HOUR) break;
    }

    return alerts;
  } catch (error) {
    console.error('[alertSystem] Failed to fetch signals:', error);
    return [];
  }
}

/**
 * Format alert for Telegram
 */
export function formatTelegramAlert(data: TelegramAlertData): string {
  const ratingEmoji = {
    STRONG_BUY: '=%',
    BUY: '',
    HOLD: '�',
    PASS: '�',
  }[data.thesis.rating];

  const discountEmoji = data.discountPct >= 20 ? '=�' : data.discountPct >= 15 ? '=�' : '=�';
  const confidenceBars = '�'.repeat(Math.round(data.confidence * 5)) +
    '�'.repeat(5 - Math.round(data.confidence * 5));

  const formatPrice = (n: number) => n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  let message = `${discountEmoji} **DEAL ALERT**

=� **${data.cardName}**
=� ${data.setName}${data.number ? ` #${data.number}` : ''}${data.grade ? ` " ${data.grade}` : ''}
<� ${data.source}

=� **Listed:** $${formatPrice(data.priceUsd)}
=� **Fair Value:** $${formatPrice(data.fairValueUsd)}
=� **Discount:** ${data.discountPct.toFixed(1)}%
P **Confidence:** ${confidenceBars} ${(data.confidence * 100).toFixed(0)}%

${ratingEmoji} **${data.thesis.rating}**
=� ${data.thesis.reasoning}`;

  if (data.thesis.riskFactors && data.thesis.riskFactors.length > 0) {
    message += `\n\n� _Risks: ${data.thesis.riskFactors.join(', ')}_`;
  }

  return message;
}

/**
 * Build inline keyboard for alert
 */
export function buildAlertKeyboard(listingId: string) {
  return {
    inline_keyboard: [
      [
        { text: '= Open', callback_data: `listing:open:${listingId}` },
        { text: ' Bought', callback_data: `listing:bought:${listingId}` },
      ],
      [
        { text: '=@ Watch', callback_data: `listing:watch:${listingId}` },
        { text: '=4 Snooze', callback_data: `listing:snooze:${listingId}` },
        { text: 'L Ignore', callback_data: `listing:ignore:${listingId}` },
      ],
    ],
  };
}

/**
 * Get users eligible for alerts
 */
export async function getEligibleUsers(alert: TelegramAlertData): Promise<string[]> {
  try {
    const db = await getPrisma();
    // Get all users (in a real implementation, filter by preferences)
    const users = await db.user.findMany({
      select: { telegramId: true },
    });

    return users.map(u => u.telegramId);
  } catch (error) {
    console.error('[alertSystem] Failed to get users:', error);
    return [];
  }
}

/**
 * Send alerts via Telegram Bot API
 */
export async function sendTelegramAlerts(
  botToken: string,
  alerts: TelegramAlertData[]
): Promise<{ sent: number; failed: number }> {
  if (!botToken) {
    console.log('[alertSystem] No bot token, skipping sends');
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const alert of alerts) {
    const message = formatTelegramAlert(alert);
    const keyboard = buildAlertKeyboard(alert.listingId);
    const users = await getEligibleUsers(alert);

    for (const telegramId of users) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramId,
              text: message,
              parse_mode: 'Markdown',
              reply_markup: keyboard,
              disable_web_page_preview: true,
            }),
          }
        );

        if (response.ok) {
          sent++;
        } else {
          const error = await response.json();
          console.error('[alertSystem] Telegram API error:', error);
          failed++;
        }

        // Rate limiting
        await sleep(50);
      } catch (error) {
        console.error('[alertSystem] Send error:', error);
        failed++;
      }
    }
  }

  console.log(`[alertSystem] Sent ${sent} alerts, ${failed} failed`);
  return { sent, failed };
}

/**
 * Main alert processing loop
 */
export async function processAlerts(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  console.log('[alertSystem] Fetching alertable signals...');
  const alerts = await fetchAlertableSignals();

  if (alerts.length === 0) {
    console.log('[alertSystem] No new alerts to send');
    return;
  }

  console.log(`[alertSystem] Found ${alerts.length} alerts to send`);

  if (botToken) {
    await sendTelegramAlerts(botToken, alerts);
  } else {
    // Log alerts for debugging when no token
    for (const alert of alerts) {
      console.log('[alertSystem] Would send:', {
        card: alert.cardName,
        discount: `${alert.discountPct.toFixed(1)}%`,
        price: `$${alert.priceUsd.toFixed(2)}`,
        rating: alert.thesis.rating,
      });
    }
  }
}

/**
 * Clear sent alerts cache (call periodically)
 */
export function clearSentAlerts(): void {
  sentAlerts.clear();
  lastAlertTime.clear();
  console.log('[alertSystem] Cleared alert cache');
}

/**
 * Stop the cache cleanup interval (for graceful shutdown)
 */
export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[alertSystem] Cache cleanup stopped');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check watchlist cards for price drops and send alerts
 */
export async function checkWatchlistPriceDrops(): Promise<{ sent: number; failed: number }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log('[alertSystem] No bot token, skipping watchlist checks');
    return { sent: 0, failed: 0 };
  }

  try {
    const db = await getPrisma();
    // Get distinct cards being watched
    const watchedCards = await db.watchlistItem.findMany({
      distinct: ['cardId'],
      include: {
        card: true,
        user: true,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const item of watchedCards) {
      if (!item.card) continue;

      // Get the card's feature snapshot for historical price
      const snapshot = await db.featureSnapshot.findFirst({
        where: { cardId: item.cardId, windowDays: 7 },
        orderBy: { createdAt: 'desc' },
      });

      // Get cheapest active listing
      const listing = await db.marketListing.findFirst({
        where: {
          canonicalCardId: item.card.canonicalCardId || undefined,
          isActive: true,
        },
        orderBy: { priceCents: 'asc' },
      });

      if (!snapshot?.medianCents || !listing) continue;

      // Calculate drop percentage
      const dropPct = ((snapshot.medianCents - listing.priceCents) / snapshot.medianCents) * 100;

      // Only alert if 15%+ below median
      if (dropPct < 15) continue;

      // Check cooldown for this card
      const cooldownKey = `watchlist:${item.cardId}`;
      const lastAlert = lastAlertTime.get(cooldownKey);
      if (lastAlert && Date.now() - lastAlert < ALERT_CONFIG.COOLDOWN_MINUTES * 60 * 1000) {
        continue;
      }

      // Get all users watching this card
      const watchers = await db.watchlistItem.findMany({
        where: { cardId: item.cardId },
        include: { user: true },
      });

      // Send alert to each watcher
      for (const watcher of watchers) {
        try {
          const message = `👀 **WATCHLIST ALERT**

📦 **${item.card.name}**
📚 ${item.card.set || ''}${item.card.grade ? ` • ${item.card.grade}` : ''}

💰 **Price Drop Detected!**
~~$${(snapshot.medianCents / 100).toFixed(2)}~~ → **$${(listing.priceCents / 100).toFixed(2)}**
📉 Down ${dropPct.toFixed(1)}%

_This card is on your watchlist._`;

          const keyboard = {
            inline_keyboard: [
              [
                { text: '🔗 View Listing', url: listing.sourceUrl || '' },
                { text: '✅ Bought', callback_data: `bought:${listing.id}` },
              ],
              [
                { text: '😴 Snooze', callback_data: `snooze:${item.cardId}` },
                { text: '❌ Remove', callback_data: `watch:remove:${item.cardId}` },
              ],
            ],
          };

          const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: watcher.user.telegramId,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true,
              }),
            }
          );

          if (response.ok) {
            sent++;
          } else {
            failed++;
          }

          await sleep(50);
        } catch (e) {
          failed++;
        }
      }

      // Update cooldown
      lastAlertTime.set(cooldownKey, Date.now());
    }

    console.log(`[alertSystem] Watchlist alerts: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  } catch (error) {
    console.error('[alertSystem] Watchlist check error:', error);
    return { sent: 0, failed: 0 };
  }
}

// Export for use in agent tick
export { ALERT_CONFIG };
