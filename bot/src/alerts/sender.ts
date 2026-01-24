import { Bot } from 'grammy';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { formatDealAlert, formatPriceDropAlert, formatArbitrageAlert, DealAlertData, ArbitrageAlertData } from './formatter.js';
import { UserContext } from '../middleware/auth.js';
import {
  getPreferences,
  getUsersWithAlertsEnabled,
  isCardSnoozed,
  UserPreferences,
} from '../lib/preferences.js';

/**
 * AlertSender class to manage sending alerts to users
 */
export class AlertSender {
  private bot: Bot<UserContext>;
  private sentAlerts = new Set<string>(); // Track sent alert IDs to prevent duplicates

  constructor(bot: Bot<UserContext>) {
    this.bot = bot;
  }

  /**
   * Send a deal alert to all eligible users
   */
  async sendDealAlert(alert: DealAlertData): Promise<{ sent: number; failed: number }> {
    // Dedup check
    const alertKey = `${alert.listingId}`;
    if (this.sentAlerts.has(alertKey)) {
      logger.debug({ alertKey }, 'Alert already sent, skipping');
      return { sent: 0, failed: 0 };
    }
    this.sentAlerts.add(alertKey);

    // Find eligible users
    const users = await this.findEligibleUsers(alert);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const { text, keyboard } = formatDealAlert(alert);

        await this.bot.api.sendMessage(user.telegramId, text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });

        sent++;
        logger.debug({ userId: user.userId, listingId: alert.listingId }, 'Alert sent');
      } catch (error: any) {
        failed++;

        // Handle blocked/deactivated users
        if (error.error_code === 403) {
          logger.warn({ userId: user.userId }, 'User blocked the bot');
          // Could mark user as inactive here
        } else {
          logger.error({ error, userId: user.userId }, 'Failed to send alert');
        }
      }

      // Rate limiting - don't spam Telegram API
      await sleep(50);
    }

    logger.info({
      listingId: alert.listingId,
      sent,
      failed,
      total: users.length
    }, 'Deal alert sent');

    return { sent, failed };
  }

  /**
   * Send an arbitrage alert to users
   */
  async sendArbitrageAlert(alert: ArbitrageAlertData): Promise<{ sent: number; failed: number }> {
    // Dedup check
    const alertKey = `arb:${alert.cardId}:${alert.buyVenue}:${alert.sellVenue}`;
    if (this.sentAlerts.has(alertKey)) {
      logger.debug({ alertKey }, 'Arbitrage alert already sent, skipping');
      return { sent: 0, failed: 0 };
    }
    this.sentAlerts.add(alertKey);

    // Get users with alerts enabled and minimum spread threshold
    const users = await getUsersWithAlertsEnabled();

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Check if card is snoozed
        if (isCardSnoozed(user.prefs, alert.cardId)) {
          continue;
        }

        // Skip if spread is below user's minimum discount threshold (use as proxy)
        if (alert.spreadPct < user.prefs.minDiscountPct) {
          continue;
        }

        const { text, keyboard } = formatArbitrageAlert(alert);

        await this.bot.api.sendMessage(user.telegramId, text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });

        sent++;
      } catch (error: any) {
        failed++;
        if (error.error_code !== 403) {
          logger.error({ error, telegramId: user.telegramId }, 'Failed to send arbitrage alert');
        }
      }

      await sleep(50);
    }

    logger.info({
      cardId: alert.cardId,
      spreadPct: alert.spreadPct,
      sent,
      failed,
    }, 'Arbitrage alert sent');

    return { sent, failed };
  }

  /**
   * Send a price drop alert to users watching a card
   */
  async sendPriceDropAlert(data: {
    cardId: string;
    cardName: string;
    setName: string;
    grade?: string;
    oldPrice: number;
    newPrice: number;
    listingUrl: string;
    listingId: string;
  }): Promise<{ sent: number; failed: number }> {
    const dropPct = ((data.oldPrice - data.newPrice) / data.oldPrice) * 100;

    // Find users watching this card
    const watchers = await prisma.watchlistItem.findMany({
      where: { cardId: data.cardId },
      include: { user: true },
    });

    let sent = 0;
    let failed = 0;

    for (const watcher of watchers) {
      try {
        // Check user preferences
        const prefs = await getPreferences(watcher.user.telegramId);
        if (!prefs.alertsEnabled) continue;
        if (isCardSnoozed(prefs, data.cardId)) continue;

        const { text, keyboard } = formatPriceDropAlert({
          ...data,
          dropPct,
        });

        await this.bot.api.sendMessage(watcher.user.telegramId, text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });

        sent++;
      } catch (error: any) {
        failed++;
        if (error.error_code !== 403) {
          logger.error({ error, userId: watcher.userId }, 'Failed to send price drop alert');
        }
      }

      await sleep(50);
    }

    logger.info({
      cardId: data.cardId,
      sent,
      failed,
      total: watchers.length
    }, 'Price drop alert sent');

    return { sent, failed };
  }

  /**
   * Send a message to a specific user
   */
  async sendToUser(telegramId: string, message: string): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(telegramId, message, {
        parse_mode: 'Markdown',
      });
      return true;
    } catch (error) {
      logger.error({ error, telegramId }, 'Failed to send message to user');
      return false;
    }
  }

  /**
   * Broadcast a message to all users
   */
  async broadcast(
    message: string,
    options: { onlyActive?: boolean } = {}
  ): Promise<{ sent: number; failed: number }> {
    const users = await prisma.user.findMany({
      select: { id: true, telegramId: true },
    });

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await this.bot.api.sendMessage(user.telegramId, message, {
          parse_mode: 'Markdown',
        });
        sent++;
      } catch (error: any) {
        failed++;
        if (error.error_code !== 403) {
          logger.error({ error, userId: user.id }, 'Failed to broadcast');
        }
      }

      // More aggressive rate limiting for broadcasts
      await sleep(100);
    }

    logger.info({ sent, failed, total: users.length }, 'Broadcast complete');
    return { sent, failed };
  }

  /**
   * Find users eligible to receive an alert based on their preferences
   */
  private async findEligibleUsers(alert: DealAlertData): Promise<Array<{
    telegramId: string;
    userId: string;
    prefs: UserPreferences;
  }>> {
    // Get all users with alerts enabled
    const users = await getUsersWithAlertsEnabled();

    // Filter based on preferences
    return users.filter(user => {
      const prefs = user.prefs;

      // Check if card is snoozed
      if (alert.cardId && isCardSnoozed(prefs, alert.cardId)) {
        return false;
      }

      // Check minimum discount
      if (alert.discountPct < prefs.minDiscountPct) return false;

      // Check price range
      if (alert.priceUsd < prefs.minPriceUsd || alert.priceUsd > prefs.maxPriceUsd) {
        return false;
      }

      // Check grade filter (if applicable)
      if (alert.grade && prefs.grades.length > 0) {
        const gradeMatches = prefs.grades.some(g =>
          alert.grade?.toLowerCase().includes(g.toLowerCase())
        );
        if (!gradeMatches) return false;
      }

      return true;
    });
  }

  /**
   * Clear old sent alerts from memory (call periodically)
   */
  clearSentAlerts(): void {
    this.sentAlerts.clear();
    logger.debug('Cleared sent alerts cache');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Singleton instance
let alertSender: AlertSender | null = null;

export function initAlertSender(bot: Bot<UserContext>): AlertSender {
  alertSender = new AlertSender(bot);
  return alertSender;
}

export function getAlertSender(): AlertSender | null {
  return alertSender;
}
