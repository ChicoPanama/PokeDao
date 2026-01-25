/**
 * Alert Consumer Worker - Processes queued alerts and sends to Telegram
 *
 * Consumes from the telegram:alerts queue (populated by agent pipeline)
 * and sends formatted alerts to eligible users.
 */

import { Worker, Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import {
  getPreferences,
  getUsersWithAlertsEnabled,
  isCardSnoozed,
} from '../lib/preferences.js';

const ALERT_QUEUE = 'telegram:alerts';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';

interface AlertSignal {
  id: string;
  cardId: string;
  cardName?: string;
  setName?: string;
  source: string;
  sourceSell: string;
  priceCents: number;
  sellCompCents: number;
  expectedProfitCents: number;
  netSpreadBps: number;
  confidence: number;
  rationale?: string;
  url?: string;
}

interface AlertJob {
  type: 'opportunity' | 'arbitrage' | 'price_drop';
  signal: AlertSignal;
  createdAt: string;
}

/**
 * Format alert message
 */
function formatAlert(signal: AlertSignal): { text: string; keyboard: InlineKeyboard } {
  const spreadPct = signal.netSpreadBps / 100;
  const profitUsd = signal.expectedProfitCents / 100;
  const buyPrice = signal.priceCents / 100;
  const sellPrice = signal.sellCompCents / 100;

  const emoji = spreadPct >= 25 ? '🔥' : spreadPct >= 20 ? '🚨' : '⚡';
  const confidenceBars = '█'.repeat(Math.round(signal.confidence * 5)) +
    '░'.repeat(5 - Math.round(signal.confidence * 5));

  const text = `${emoji} **OPPORTUNITY ALERT**

📦 **${signal.cardName || signal.cardId}**
${signal.setName ? `📚 ${signal.setName}\n` : ''}🏪 ${signal.source} → ${signal.sourceSell}

💰 **Buy:** $${buyPrice.toFixed(2)}
💵 **Sell (comp):** $${sellPrice.toFixed(2)}
📊 **Spread:** +${spreadPct.toFixed(1)}%
💸 **Est. Profit:** $${profitUsd.toFixed(2)}
⭐ **Confidence:** ${confidenceBars} ${(signal.confidence * 100).toFixed(0)}%

${signal.rationale || '_Analysis pending_'}

_Fees and shipping included in calculations._`;

  const keyboard = new InlineKeyboard();
  if (signal.url) {
    keyboard.url('🛒 Open Listing', signal.url);
  }
  keyboard.text('👀 Watch', `watch:${signal.cardId}`);
  keyboard.row();
  keyboard.text('✅ Bought', `bought:${signal.id}`);
  keyboard.text('😴 Ignore', `ignore:${signal.cardId}`);

  return { text, keyboard };
}

/**
 * Process a single alert job
 */
async function processAlert(
  job: Job<AlertJob>,
  bot: Bot
): Promise<{ sent: number; failed: number; skipped: number }> {
  const { signal } = job.data;
  const spreadPct = signal.netSpreadBps / 100;
  const priceUsd = signal.priceCents / 100;

  logger.info({ cardId: signal.cardId, spread: spreadPct }, 'Processing alert');

  // Get eligible users
  const users = await getUsersWithAlertsEnabled();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of users) {
    const prefs = user.prefs;

    // Check user preferences
    if (isCardSnoozed(prefs, signal.cardId)) {
      skipped++;
      continue;
    }

    // Use minDiscountPct as proxy for spread threshold
    if (spreadPct < prefs.minDiscountPct) {
      skipped++;
      continue;
    }

    // Check price range
    if (priceUsd < prefs.minPriceUsd || priceUsd > prefs.maxPriceUsd) {
      skipped++;
      continue;
    }

    try {
      const { text, keyboard } = formatAlert(signal);

      await bot.api.sendMessage(user.telegramId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });

      sent++;
      logger.debug({ telegramId: user.telegramId }, 'Alert sent');
    } catch (error: any) {
      failed++;
      if (error.error_code === 403) {
        logger.warn({ telegramId: user.telegramId }, 'User blocked bot');
      } else {
        logger.error({ error, telegramId: user.telegramId }, 'Failed to send alert');
      }
    }

    // Rate limiting - don't spam Telegram API
    await new Promise(r => setTimeout(r, 50));
  }

  logger.info({ cardId: signal.cardId, sent, failed, skipped }, 'Alert processing complete');
  return { sent, failed, skipped };
}

/**
 * Start the alert consumer worker
 */
export function startAlertConsumer(bot: Bot): Worker {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<AlertJob>(
    ALERT_QUEUE,
    async (job) => processAlert(job, bot),
    {
      connection,
      concurrency: 1, // Process one at a time to respect Telegram rate limits
    }
  );

  worker.on('completed', (job, result) => {
    logger.info(
      { jobId: job.id, ...result },
      'Alert job completed'
    );
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Alert job failed');
  });

  logger.info('Alert consumer worker started');
  return worker;
}

/**
 * Get queue statistics
 */
export async function getAlertQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue<AlertJob>(ALERT_QUEUE, { connection });

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  await connection.quit();
  return { waiting, active, completed, failed };
}
