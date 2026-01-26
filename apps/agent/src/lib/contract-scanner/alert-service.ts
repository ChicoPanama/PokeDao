/**
 * SCANNER ALERT SERVICE
 *
 * Sends vulnerability findings via Telegram with:
 * - Severity-based filtering (medium+ only by default)
 * - Rate limiting (1 msg/sec per chat)
 * - Aggregated per-contract alerts (not per-finding)
 * - HTML formatting with Solidity code blocks
 * - Deduplication across 24-hour windows
 */

import { Redis } from 'ioredis';
import pino from 'pino';

import type { ScanAlertData, EnrichedFinding, ScanSeverity } from './types.js';

const logger = pino({ name: 'scanner-alerts' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SCANNER_ALERT_CHAT_ID = process.env.SCANNER_ALERT_CHAT_ID || '';
const MIN_ALERT_SEVERITY: ScanSeverity = (process.env.SCANNER_MIN_SEVERITY as ScanSeverity) || 'MEDIUM';

const SEVERITY_ORDER: Record<ScanSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFORMATIONAL: 0,
};

const SEVERITY_EMOJI: Record<ScanSeverity, string> = {
  CRITICAL: '\u{1F534}', // red circle
  HIGH: '\u{1F7E0}',     // orange circle
  MEDIUM: '\u{1F7E1}',   // yellow circle
  LOW: '\u{1F7E2}',      // green circle
  INFORMATIONAL: '\u{26AA}', // white circle
};

// ============================================================================
// ALERT SERVICE
// ============================================================================

export class ScannerAlertService {
  private redis: Redis;
  private lastMessageTime = 0;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Send alert for a completed scan.
   * Only sends if there are findings at or above the minimum severity threshold.
   */
  async sendAlert(alertData: ScanAlertData): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !SCANNER_ALERT_CHAT_ID) {
      logger.warn('Telegram not configured for scanner alerts');
      return false;
    }

    // Filter findings by minimum severity
    const significantFindings = alertData.findings.filter(
      f => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[MIN_ALERT_SEVERITY],
    );

    if (significantFindings.length === 0) {
      logger.info('No significant findings to alert on');
      return false;
    }

    // Dedup check (24h window per contract)
    const dedupKey = `scanner:alert:sent:${alertData.contractAddress}`;
    const alreadySent = await this.redis.exists(dedupKey);
    if (alreadySent) {
      logger.info(
        { contract: alertData.contractAddress },
        'Alert already sent in last 24h, skipping',
      );
      return false;
    }

    // Format message
    const message = this.formatAlertMessage(alertData, significantFindings);

    // Send with rate limiting
    const sent = await this.sendTelegramMessage(message);

    if (sent) {
      // Mark as sent (24h TTL)
      await this.redis.set(dedupKey, '1', 'EX', 86400);
    }

    return sent;
  }

  /**
   * Queue alert to Redis for async delivery by Clawdbot skill
   */
  async queueAlert(alertData: ScanAlertData): Promise<void> {
    const alertId = `scan-alert-${alertData.scanId}`;

    await this.redis.hset(`scanner:alert:${alertId}`, {
      contractAddress: alertData.contractAddress,
      chainName: alertData.chainName,
      contractName: alertData.contractName || '',
      protocolName: alertData.protocolName || '',
      tvlUsd: (alertData.tvlUsd || 0).toString(),
      scanId: alertData.scanId,
      overallSeverity: alertData.overallSeverity,
      summary: alertData.summary,
      findingsCount: alertData.findings.length.toString(),
      findings: JSON.stringify(alertData.findings.slice(0, 10)), // Top 10
      timestamp: Date.now().toString(),
    });

    // Add to sorted set for polling
    await this.redis.zadd('scanner:alerts:pending', Date.now(), alertId);

    logger.info({ alertId, scanId: alertData.scanId }, 'Alert queued');
  }

  // ============================================================================
  // MESSAGE FORMATTING
  // ============================================================================

  private formatAlertMessage(
    alertData: ScanAlertData,
    findings: EnrichedFinding[],
  ): string {
    const severity = alertData.overallSeverity;
    const emoji = SEVERITY_EMOJI[severity];

    const header = [
      `${emoji} <b>Vulnerability Alert</b> ${emoji}`,
      '',
      `<b>Contract:</b> <code>${alertData.contractAddress}</code>`,
      `<b>Chain:</b> ${alertData.chainName}`,
    ];

    if (alertData.contractName) {
      header.push(`<b>Name:</b> ${this.escapeHtml(alertData.contractName)}`);
    }
    if (alertData.protocolName) {
      header.push(`<b>Protocol:</b> ${this.escapeHtml(alertData.protocolName)}`);
    }
    if (alertData.tvlUsd && alertData.tvlUsd > 0) {
      header.push(`<b>TVL:</b> $${this.formatNumber(alertData.tvlUsd)}`);
    }

    header.push(
      '',
      `<b>Severity:</b> ${severity}`,
      `<b>Findings:</b> ${findings.length}`,
      '',
    );

    // Group findings by severity
    const grouped = this.groupBySeverity(findings);
    const findingLines: string[] = [];

    for (const [sev, items] of grouped) {
      findingLines.push(`<b>${SEVERITY_EMOJI[sev]} ${sev} (${items.length})</b>`);

      // Show top 3 per severity
      for (const item of items.slice(0, 3)) {
        const assessment = item.aiAssessment
          ? ` [${item.aiAssessment}]`
          : '';
        findingLines.push(`  - ${this.escapeHtml(item.title)}${assessment}`);
        if (item.attackPath) {
          findingLines.push(`    Attack: ${this.escapeHtml(item.attackPath.slice(0, 100))}`);
        }
      }

      if (items.length > 3) {
        findingLines.push(`  ... and ${items.length - 3} more`);
      }
      findingLines.push('');
    }

    // Summary
    findingLines.push(`<b>Summary:</b> ${this.escapeHtml(alertData.summary)}`);

    return [...header, ...findingLines].join('\n');
  }

  private groupBySeverity(findings: EnrichedFinding[]): [ScanSeverity, EnrichedFinding[]][] {
    const groups = new Map<ScanSeverity, EnrichedFinding[]>();

    for (const f of findings) {
      const list = groups.get(f.severity) || [];
      list.push(f);
      groups.set(f.severity, list);
    }

    // Sort by severity (critical first)
    return Array.from(groups.entries())
      .sort((a, b) => SEVERITY_ORDER[b[0]] - SEVERITY_ORDER[a[0]]);
  }

  // ============================================================================
  // TELEGRAM API
  // ============================================================================

  private async sendTelegramMessage(text: string): Promise<boolean> {
    // Rate limit: 1 message per second
    const now = Date.now();
    const elapsed = now - this.lastMessageTime;
    if (elapsed < 1000) {
      await this.sleep(1000 - elapsed);
    }

    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: SCANNER_ALERT_CHAT_ID,
          text: text.slice(0, 4096), // Telegram message limit
          parse_mode: 'HTML',
          disable_notification: false,
        }),
      });

      this.lastMessageTime = Date.now();

      if (!response.ok) {
        const error = await response.text();
        logger.error({ status: response.status, error }, 'Telegram send failed');
        return false;
      }

      logger.info('Scanner alert sent to Telegram');
      return true;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Telegram send error');
      return false;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
