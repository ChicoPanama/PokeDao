/**
 * Alert System - Connects signal generation to Telegram notifications
 *
 * This module:
 * 1. Polls for new high-quality signals from the database
 * 2. Filters based on quality thresholds
 * 3. Formats and sends alerts to eligible Telegram users
 */

import { PrismaClient } from '@prisma/client';
import { Bot } from 'grammy';

const prisma = new PrismaClient();

// Alert thresholds
const ALERT_CONFIG = {
  MIN_EDGE_BP: Number(process.env.ALERT_MIN_EDGE_BP || 500), // 5% minimum edge
  MIN_CONFIDENCE: Number(process.env.ALERT_MIN_CONFIDENCE || 0.5),
  MIN_PRICE_USD: Number(process.env.ALERT_MIN_PRICE_USD || 50),
  MAX_ALERTS_PER_HOUR: Number(process.env.ALERT_MAX_PER_HOUR || 10),
  COOLDOWN_MINUTES: Number(process.env.ALERT_COOLDOWN_MINUTES || 15),
};

// Track sent alerts to prevent duplicates
const sentAlerts = new Set<string>();
const lastAlertTime = new Map<string, number>(); // cardId -> timestamp

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
    // Get recent signals with thesis
    const signals = await prisma.signal.findMany({
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
      // Skip if already sent
      const alertKey = `${sig.id}`;
      if (sentAlerts.has(alertKey)) continue;

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

      // Mark as sent
      sentAlerts.add(alertKey);
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
    HOLD: 'ø',
    PASS: 'í',
  }[data.thesis.rating];

  const discountEmoji = data.discountPct >= 20 ? '=¨' : data.discountPct >= 15 ? '=É' : '=Ê';
  const confidenceBars = 'ˆ'.repeat(Math.round(data.confidence * 5)) +
    '‘'.repeat(5 - Math.round(data.confidence * 5));

  const formatPrice = (n: number) => n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  let message = `${discountEmoji} **DEAL ALERT**

=æ **${data.cardName}**
=Ú ${data.setName}${data.number ? ` #${data.number}` : ''}${data.grade ? ` " ${data.grade}` : ''}
<ê ${data.source}

=° **Listed:** $${formatPrice(data.priceUsd)}
=Ê **Fair Value:** $${formatPrice(data.fairValueUsd)}
=É **Discount:** ${data.discountPct.toFixed(1)}%
P **Confidence:** ${confidenceBars} ${(data.confidence * 100).toFixed(0)}%

${ratingEmoji} **${data.thesis.rating}**
=¡ ${data.thesis.reasoning}`;

  if (data.thesis.riskFactors && data.thesis.riskFactors.length > 0) {
    message += `\n\n  _Risks: ${data.thesis.riskFactors.join(', ')}_`;
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
    // Get all users (in a real implementation, filter by preferences)
    const users = await prisma.user.findMany({
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export for use in agent tick
export { ALERT_CONFIG };
