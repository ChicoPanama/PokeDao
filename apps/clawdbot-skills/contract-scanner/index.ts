/**
 * CONTRACT SCANNER CLAWDBOT SKILL
 *
 * Receives scanner alerts and provides interactive contract scanning
 * through the Clawdbot notification system.
 *
 * Features:
 * - Polls Redis for pending scanner alerts
 * - On-demand contract scanning via commands
 * - Formatted vulnerability notifications
 * - Subscriber management
 */

export default {
  name: 'contract-scanner',
  description: 'Autonomous smart contract vulnerability scanner for DeFi protocols',
  version: '1.0.0',

  // Check for alerts every 60 seconds
  schedule: '*/60 * * * * *',

  async execute(context: any) {
    const { redis, notify, log } = context;

    try {
      // Get pending scanner alerts from Redis
      const alertIds = await redis.zrange('scanner:alerts:pending', 0, 9);

      for (const alertId of alertIds) {
        // Check if already sent
        const sent = await redis.get(`scanner:alert:clawdbot:sent:${alertId}`);
        if (sent) continue;

        // Get alert data
        const alert = await redis.hgetall(`scanner:alert:${alertId}`);
        if (!alert || !alert.contractAddress) continue;

        // Get subscribed users
        const subscribers = await redis.smembers('scanner:subscribers');

        for (const userId of subscribers) {
          const prefs = await redis.hgetall(`scanner:user:${userId}:prefs`);

          // Check minimum severity preference
          if (!this.meetsSeverityThreshold(alert.overallSeverity, prefs.minSeverity)) {
            continue;
          }

          await notify(userId, {
            title: `${this.getSeverityEmoji(alert.overallSeverity)} Contract Alert: ${alert.contractName || alert.contractAddress.slice(0, 10)}`,
            body: this.formatAlertBody(alert),
            actions: [
              { label: 'View Details', data: `scan:details:${alert.scanId}` },
              { label: 'Dismiss', data: `scan:dismiss:${alertId}` },
            ],
          });
        }

        // Mark as sent (24h TTL)
        await redis.setex(`scanner:alert:clawdbot:sent:${alertId}`, 86400, '1');

        // Remove from pending queue
        await redis.zrem('scanner:alerts:pending', alertId);
      }
    } catch (error) {
      log.error('Error processing scanner alerts:', error);
    }
  },

  getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return '\u{1F534}';
      case 'HIGH': return '\u{1F7E0}';
      case 'MEDIUM': return '\u{1F7E1}';
      case 'LOW': return '\u{1F7E2}';
      default: return '\u{26AA}';
    }
  },

  formatAlertBody(alert: any): string {
    const lines = [
      `**${alert.overallSeverity} Severity**`,
      '',
      `Contract: \`${alert.contractAddress}\``,
      `Chain: ${alert.chainName}`,
    ];

    if (alert.protocolName) {
      lines.push(`Protocol: ${alert.protocolName}`);
    }

    if (alert.tvlUsd && parseFloat(alert.tvlUsd) > 0) {
      const tvl = parseFloat(alert.tvlUsd);
      const tvlStr = tvl >= 1e9 ? `$${(tvl / 1e9).toFixed(1)}B`
        : tvl >= 1e6 ? `$${(tvl / 1e6).toFixed(1)}M`
        : `$${(tvl / 1e3).toFixed(1)}K`;
      lines.push(`TVL: ${tvlStr}`);
    }

    lines.push('', `Findings: ${alert.findingsCount}`, '', alert.summary || '');

    // Show top findings if available
    try {
      const findings = JSON.parse(alert.findings || '[]');
      if (findings.length > 0) {
        lines.push('', '**Top Findings:**');
        for (const f of findings.slice(0, 5)) {
          lines.push(`- [${f.severity}] ${f.title}`);
        }
      }
    } catch {
      // Ignore parse errors
    }

    return lines.join('\n');
  },

  meetsSeverityThreshold(alertSeverity: string, minSeverity?: string): boolean {
    const order: Record<string, number> = {
      CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFORMATIONAL: 0,
    };
    const threshold = order[minSeverity || 'MEDIUM'] || 2;
    const alertLevel = order[alertSeverity] || 0;
    return alertLevel >= threshold;
  },

  // Handle callback actions from notification buttons
  async onCallback(context: any, _action: string, data: string) {
    const { redis, reply } = context;
    const parts = data.split(':');

    if (parts[0] === 'scan' && parts[1] === 'details') {
      const scanId = parts[2];
      // Fetch scan details from Redis or API
      const scanData = await redis.hgetall(`scanner:scan:${scanId}`);
      if (scanData && scanData.summary) {
        await reply(`**Scan Details**\n\n${scanData.summary}`);
      } else {
        await reply(`Scan ${scanId} details not found. Check the dashboard for full results.`);
      }
    } else if (parts[0] === 'scan' && parts[1] === 'dismiss') {
      await reply('Alert dismissed.');
    }
  },

  // User commands
  commands: {
    async subscribe(context: any) {
      const { redis, reply, userId } = context;
      await redis.sadd('scanner:subscribers', userId);
      await reply(`Subscribed to contract scanner alerts.

You'll receive notifications when vulnerabilities are found in high-TVL DeFi protocols.

**Configure preferences:**
- "Set minimum severity to HIGH"
- "Only alert on critical findings"

Use "unsubscribe" to stop alerts.`);
    },

    async unsubscribe(context: any) {
      const { redis, reply, userId } = context;
      await redis.srem('scanner:subscribers', userId);
      await reply('Unsubscribed from contract scanner alerts.');
    },

    async status(context: any) {
      const { redis, reply } = context;

      const health = await redis.hgetall('worker:health:contract-scanner');
      if (!health || !health.lastHeartbeat) {
        await reply('Scanner worker is not running or has not reported health yet.');
        return;
      }

      const lastRun = health.lastRunAt ? new Date(health.lastRunAt).toISOString() : 'Never';
      const lastSuccess = health.lastSuccessAt ? new Date(health.lastSuccessAt).toISOString() : 'Never';
      const status = health.status || 'unknown';

      await reply(`**Contract Scanner Status**

Status: ${status}
Last Run: ${lastRun}
Last Success: ${lastSuccess}
Total Runs: ${health.totalRuns || 0}
Total Failures: ${health.totalFailures || 0}
Items Processed: ${health.itemsProcessed || 0}
Avg Duration: ${health.avgDurationMs || 0}ms`);
    },

    async preferences(context: any, args: string) {
      const { redis, reply, userId } = context;

      const updates: Record<string, string> = {};

      if (args.match(/critical/i)) {
        updates.minSeverity = 'CRITICAL';
      } else if (args.match(/high/i)) {
        updates.minSeverity = 'HIGH';
      } else if (args.match(/medium/i)) {
        updates.minSeverity = 'MEDIUM';
      } else if (args.match(/low/i)) {
        updates.minSeverity = 'LOW';
      }

      if (Object.keys(updates).length > 0) {
        await redis.hset(`scanner:user:${userId}:prefs`, updates);
        const summary = Object.entries(updates)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n');
        await reply(`Preferences updated:\n${summary}`);
      } else {
        const prefs = await redis.hgetall(`scanner:user:${userId}:prefs`);
        if (Object.keys(prefs).length === 0) {
          await reply('No preferences set. Defaults: minimum severity = MEDIUM');
        } else {
          const summary = Object.entries(prefs)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n');
          await reply(`**Your Preferences:**\n${summary}`);
        }
      }
    },
  },
};
