/**
 * Alert Sender - Multi-platform notification system
 *
 * Sends arbitrage alerts to:
 * - Telegram
 * - Discord
 * - Webhook endpoints
 * - Email (future)
 */

import fetch from 'node-fetch';

export interface ArbitrageAlert {
  cardName: string;
  setName: string;
  grade?: number;
  gradeCompany?: string;

  buySource: string;
  buyPrice: number; // cents
  buyUrl: string;

  sellSource: string;
  sellPrice: number; // cents
  sellUrl: string;

  profit: number; // cents
  profitPercent: number;
  confidence: number; // 0-1
}

export class AlertSender {
  private telegramBotToken?: string;
  private telegramChatId?: string;
  private discordWebhookUrl?: string;

  constructor(config?: {
    telegramBotToken?: string;
    telegramChatId?: string;
    discordWebhookUrl?: string;
  }) {
    this.telegramBotToken = config?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = config?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    this.discordWebhookUrl = config?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
  }

  /**
   * Send alert to all configured platforms
   */
  async sendAlert(alert: ArbitrageAlert): Promise<{
    telegram?: boolean;
    discord?: boolean;
    errors: string[];
  }> {
    const results = {
      telegram: false,
      discord: false,
      errors: [] as string[],
    };

    // Send to Telegram
    if (this.telegramBotToken && this.telegramChatId) {
      try {
        await this.sendTelegram(alert);
        results.telegram = true;
      } catch (error: any) {
        results.errors.push(`Telegram: ${error.message}`);
      }
    }

    // Send to Discord
    if (this.discordWebhookUrl) {
      try {
        await this.sendDiscord(alert);
        results.discord = true;
      } catch (error: any) {
        results.errors.push(`Discord: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Send Telegram message
   */
  private async sendTelegram(alert: ArbitrageAlert): Promise<void> {
    if (!this.telegramBotToken || !this.telegramChatId) {
      throw new Error('Telegram not configured');
    }

    const message = this.formatTelegramMessage(alert);

    const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.telegramChatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }
  }

  /**
   * Send Discord message
   */
  private async sendDiscord(alert: ArbitrageAlert): Promise<void> {
    if (!this.discordWebhookUrl) {
      throw new Error('Discord not configured');
    }

    const embed = this.formatDiscordEmbed(alert);

    const response = await fetch(this.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${error}`);
    }
  }

  /**
   * Format Telegram message with Markdown
   */
  private formatTelegramMessage(alert: ArbitrageAlert): string {
    const buyPriceUsd = (alert.buyPrice / 100).toFixed(2);
    const sellPriceUsd = (alert.sellPrice / 100).toFixed(2);
    const profitUsd = (alert.profit / 100).toFixed(2);
    const profitEmoji = alert.profitPercent >= 50 ? '🚀' : alert.profitPercent >= 30 ? '💰' : '💵';
    const gradeStr = alert.gradeCompany && alert.grade
      ? `${alert.gradeCompany} ${alert.grade}`
      : 'RAW';

    return `${profitEmoji} *ARBITRAGE ALERT*

📦 *${alert.cardName}*
${alert.setName} | ${gradeStr}

💸 *Buy:* $${buyPriceUsd} on ${alert.buySource}
💰 *Sell:* $${sellPriceUsd} on ${alert.sellSource}

📈 *Profit:* $${profitUsd} (${alert.profitPercent.toFixed(1)}%)
🎯 *Confidence:* ${(alert.confidence * 100).toFixed(0)}%

🔗 [Buy Now](${alert.buyUrl})
🔗 [Compare Price](${alert.sellUrl})`;
  }

  /**
   * Format Discord embed
   */
  private formatDiscordEmbed(alert: ArbitrageAlert) {
    const buyPriceUsd = (alert.buyPrice / 100).toFixed(2);
    const sellPriceUsd = (alert.sellPrice / 100).toFixed(2);
    const profitUsd = (alert.profit / 100).toFixed(2);
    const gradeStr = alert.gradeCompany && alert.grade
      ? `${alert.gradeCompany} ${alert.grade}`
      : 'RAW';

    // Color based on profit percentage
    let color = 0x3498db; // Blue (default)
    if (alert.profitPercent >= 50) {
      color = 0xe74c3c; // Red (hot deal!)
    } else if (alert.profitPercent >= 30) {
      color = 0xf39c12; // Orange (good deal)
    } else if (alert.profitPercent >= 15) {
      color = 0x2ecc71; // Green (decent deal)
    }

    return {
      title: '🚨 Arbitrage Opportunity',
      description: `**${alert.cardName}**\n${alert.setName} | ${gradeStr}`,
      color,
      fields: [
        {
          name: '💸 Buy Price',
          value: `$${buyPriceUsd} on **${alert.buySource}**`,
          inline: true,
        },
        {
          name: '💰 Sell Price',
          value: `$${sellPriceUsd} on **${alert.sellSource}**`,
          inline: true,
        },
        {
          name: '📈 Profit',
          value: `$${profitUsd} (**${alert.profitPercent.toFixed(1)}%**)`,
          inline: true,
        },
        {
          name: '🎯 Confidence',
          value: `${(alert.confidence * 100).toFixed(0)}%`,
          inline: true,
        },
        {
          name: '🔗 Links',
          value: `[Buy Now](${alert.buyUrl}) • [Compare](${alert.sellUrl})`,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'PokeDAO Arbitrage Scanner',
      },
    };
  }
}
