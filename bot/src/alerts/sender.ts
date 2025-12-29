import { Bot } from 'grammy';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { formatDealAlert, formatPriceDropAlert, DealAlertData } from './formatter.js';
import { UserContext } from '../middleware/auth.js';

// In-memory store for user preferences (until added to User model)
const userPreferences = new Map<string, {
  alertsEnabled: boolean;
  minDiscountPct: number;
  minPriceUsd: number;
  maxPriceUsd: number;
  grades: string[];
}>();

function getPreferences(telegramId: string) {
  if (!userPreferences.has(telegramId)) {
    return {
      alertsEnabled: true,
      minDiscountPct: 10,
      minPriceUsd: 0,
      maxPriceUsd: 10000,
      grades: ['PSA 10', 'PSA 9', 'CGC 10', 'BGS 10'],
    };
  }
  return userPreferences.get(telegramId)!;
}

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
          disable_web_page_preview: true,
        });

        sent++;
        logger.debug({ userId: user.id, listingId: alert.listingId }, 'Alert sent');
      } catch (error: any) {
        failed++;

        // Handle blocked/deactivated users
        if (error.error_code === 403) {
          logger.warn({ userId: user.id }, 'User blocked the bot');
          // Could mark user as inactive here
        } else {
          logger.error({ error, userId: user.id }, 'Failed to send alert');
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
        const { text, keyboard } = formatPriceDropAlert({
          ...data,
          dropPct,
        });

        await this.bot.api.sendMessage(watcher.user.telegramId, text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          disable_web_page_preview: true,
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
    id: string;
    telegramId: string;
  }>> {
    // Get all users
    const allUsers = await prisma.user.findMany({
      select: { id: true, telegramId: true },
    });

    // Filter based on preferences
    return allUsers.filter(user => {
      const prefs = getPreferences(user.telegramId);

      // Check if alerts enabled
      if (!prefs.alertsEnabled) return false;

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
