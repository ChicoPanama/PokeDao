/**
 * POKEDAO ALERTS SKILL
 *
 * Receives PokeDAO investment alerts and sends to subscribed users.
 * Works with Clawdbot's notification system.
 *
 * Features:
 * - Polls Redis for pending alerts
 * - Filters by user preferences
 * - Sends formatted notifications
 * - Tracks user feedback (bought/pass)
 */

export default {
  name: 'pokedao-alerts',
  description: 'Receives PokeDAO investment alerts and sends to users',
  version: '1.0.0',

  // Check for alerts every 30 seconds
  schedule: '*/30 * * * * *',

  async execute(context: any) {
    const { redis, notify, log, http } = context;
    const apiUrl = process.env.POKEDAO_API_URL || 'http://localhost:3000';

    try {
      // Get pending alerts from Redis (queued by processor)
      const alertKeys = await redis.zrange('opportunities:recent', -10, -1);

      for (const alertId of alertKeys) {
        // Check if already sent
        const sent = await redis.get(`alert:sent:${alertId}`);
        if (sent) continue;

        // Get alert data
        const alert = await redis.hgetall(`opportunity:${alertId}`);
        if (!alert || !alert.cardName) continue;

        // Get subscribed users
        const subscribers = await redis.smembers('pokedao:subscribers');

        for (const userId of subscribers) {
          // Get user preferences
          const prefs = await redis.hgetall(`pokedao:user:${userId}:prefs`);

          // Check if alert matches preferences
          if (this.matchesPreferences(alert, prefs)) {
            await notify(userId, {
              title: `${this.getEmoji(alert.recommendation)} ${alert.cardName}`,
              body: this.formatAlertBody(alert),
              actions: [
                { label: '🔗 View', url: alert.url },
                { label: '✅ Bought', data: `bought:${alertId}` },
                { label: '❌ Pass', data: `pass:${alertId}` }
              ]
            });

            // Collect alert delivery data
            this.collectAlertDelivery(http, apiUrl, userId, alertId).catch(() => {});
          }
        }

        // Mark as sent (24h TTL)
        await redis.setex(`alert:sent:${alertId}`, 24 * 60 * 60, '1');
      }
    } catch (error) {
      log.error('Error processing alerts:', error);
    }
  },

  getEmoji(recommendation: string): string {
    switch (recommendation) {
      case 'STRONG_BUY':
        return '🎯';
      case 'BUY':
        return '📊';
      case 'WATCH':
        return '👀';
      default:
        return '⚠️';
    }
  },

  formatAlertBody(alert: any): string {
    const lines = [
      `**${alert.recommendation}**`,
      '',
      `💰 Price: $${parseFloat(alert.price).toFixed(2)}`,
      `📊 Fair Value: $${parseFloat(alert.fairValue).toFixed(2)}`,
      `📉 ${alert.discount}% below market`,
      '',
      alert.thesis?.split('\n').slice(0, 3).join('\n') || ''
    ];

    return lines.join('\n');
  },

  async collectAlertDelivery(http: any, apiUrl: string, userId: string, opportunityId: string) {
    try {
      await http.post(`${apiUrl}/api/collect/alert-delivery`, {
        userId,
        opportunityId,
        platform: 'CLAWDBOT',
        status: 'SENT'
      });
    } catch {
      // Ignore - collection is best-effort
    }
  },

  async collectAction(http: any, apiUrl: string, userId: string, opportunityId: string, action: string) {
    try {
      await http.post(`${apiUrl}/api/collect/action`, {
        userId,
        opportunityId,
        action,
        platform: 'CLAWDBOT',
        source: 'ALERT'
      });
    } catch {
      // Ignore - collection is best-effort
    }
  },

  matchesPreferences(alert: any, prefs: any): boolean {
    // Check minimum discount
    if (prefs.minDiscount && parseFloat(alert.discount) < parseFloat(prefs.minDiscount)) {
      return false;
    }

    // Check maximum price
    if (prefs.maxPrice && parseFloat(alert.price) > parseFloat(prefs.maxPrice)) {
      return false;
    }

    // Check minimum price
    if (prefs.minPrice && parseFloat(alert.price) < parseFloat(prefs.minPrice)) {
      return false;
    }

    return true;
  },

  // Handle callback actions from notification buttons
  async onCallback(context: any, action: string, data: string) {
    const { redis, reply, userId, http } = context;
    const apiUrl = process.env.POKEDAO_API_URL || 'http://localhost:3000';
    const [type, opportunityId] = data.split(':');

    if (type === 'bought') {
      await redis.hset(`opportunity:${opportunityId}`, 'userAction', 'BOUGHT');
      await redis.sadd(`user:${userId}:purchases`, opportunityId);

      // Collect action data
      this.collectAction(http, apiUrl, userId, opportunityId, 'BUY').catch(() => {});

      await reply("✅ Marked as bought! Good luck with the investment. I'll track this in your portfolio.");
    } else if (type === 'pass') {
      await redis.hset(`opportunity:${opportunityId}`, 'userAction', 'PASSED');

      // Collect action data
      this.collectAction(http, apiUrl, userId, opportunityId, 'DISMISS').catch(() => {});

      await reply("👍 Got it, passing on this one. I'll keep looking for better opportunities.");
    }
  },

  // Commands users can send
  commands: {
    async subscribe(context: any) {
      const { redis, reply, userId } = context;

      await redis.sadd('pokedao:subscribers', userId);

      await reply(`✅ You're now subscribed to PokeDAO alerts!

I'll notify you when I find undervalued Pokemon cards.

**Configure your preferences:**
• "Set minimum discount to 15%"
• "Only cards under $500"
• "Focus on PSA 10 cards"

What would you like to customize?`);
    },

    async unsubscribe(context: any) {
      const { redis, reply, userId } = context;

      await redis.srem('pokedao:subscribers', userId);

      await reply('❌ Unsubscribed from PokeDAO alerts. You can resubscribe anytime by saying "subscribe to pokedao".');
    },

    async preferences(context: any, args: string) {
      const { redis, reply, userId } = context;

      // Parse preference updates
      const updates: Record<string, string> = {};

      if (args.match(/discount.*(\d+)/i)) {
        const match = args.match(/(\d+)/);
        if (match) updates.minDiscount = match[1];
      }

      if (args.match(/max.*\$?(\d+)/i)) {
        const match = args.match(/\$?(\d+)/);
        if (match) updates.maxPrice = match[1];
      }

      if (args.match(/min.*\$?(\d+)/i)) {
        const match = args.match(/min.*\$?(\d+)/i);
        if (match) {
          const priceMatch = match[0].match(/(\d+)/);
          if (priceMatch) updates.minPrice = priceMatch[1];
        }
      }

      if (Object.keys(updates).length > 0) {
        await redis.hset(`pokedao:user:${userId}:prefs`, updates);

        const summary = Object.entries(updates)
          .map(([k, v]) => `• ${k}: ${v}`)
          .join('\n');

        await reply(`✅ Preferences updated!\n\n${summary}`);
      } else {
        // Show current preferences
        const prefs = await redis.hgetall(`pokedao:user:${userId}:prefs`);

        if (Object.keys(prefs).length === 0) {
          await reply(`No preferences set yet. Try:
• "Set minimum discount to 15%"
• "Only cards under $500"
• "Minimum price $50"`);
        } else {
          const summary = Object.entries(prefs)
            .map(([k, v]) => `• ${k}: ${v}`)
            .join('\n');

          await reply(`**Your Preferences:**\n\n${summary}`);
        }
      }
    }
  }
};
