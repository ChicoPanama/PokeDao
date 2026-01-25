/**
 * Discord Alert Consumer Worker
 *
 * BullMQ worker that processes alerts from the discord:alerts queue
 * and sends them to eligible Discord users.
 */

import { Worker, Job } from 'bullmq';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { client } from '../index.js';
import { getDiscordUsersWithAlertsEnabled, isCardSnoozed } from '../lib/preferences.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'discord:alerts';
const RATE_LIMIT_MS = 100; // 100ms between sends (Discord rate limits)

// ============================================================================
// ALERT JOB TYPE
// ============================================================================

interface AlertJob {
  type: 'opportunity' | 'arbitrage' | 'price_drop';
  signal: {
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
  };
}

// ============================================================================
// WORKER
// ============================================================================

let worker: Worker | null = null;

export function startDiscordAlertConsumer(): void {
  if (worker) {
    logger.warn('[Discord] Alert consumer already running');
    return;
  }

  worker = new Worker<AlertJob>(
    QUEUE_NAME,
    async (job: Job<AlertJob>) => {
      await processAlert(job.data);
    },
    {
      connection: { url: REDIS_URL },
      concurrency: 1, // Process one at a time for rate limiting
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, '[Discord] Alert job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, '[Discord] Alert job failed');
  });

  logger.info('[Discord] Alert consumer started');
}

export async function stopDiscordAlertConsumer(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('[Discord] Alert consumer stopped');
  }
}

// ============================================================================
// ALERT PROCESSING
// ============================================================================

async function processAlert(data: AlertJob): Promise<void> {
  const { signal } = data;

  // Get all eligible users
  const users = await getDiscordUsersWithAlertsEnabled();

  if (users.length === 0) {
    logger.debug('[Discord] No users with alerts enabled');
    return;
  }

  // Format the alert embed
  const embed = formatAlertEmbed(data);
  const buttons = createAlertButtons(signal.id);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    // Check user preferences
    const priceUsd = signal.priceCents / 100;
    const discountPct = ((signal.sellCompCents - signal.priceCents) / signal.sellCompCents) * 100;

    // Skip if doesn't match preferences
    if (discountPct < user.prefs.minDiscountPct) {
      skipped++;
      continue;
    }

    if (priceUsd < user.prefs.minPriceUsd || priceUsd > user.prefs.maxPriceUsd) {
      skipped++;
      continue;
    }

    // Skip if card is snoozed
    if (isCardSnoozed(user.prefs, signal.cardId)) {
      skipped++;
      continue;
    }

    // Send DM
    try {
      const discordUser = await client.users.fetch(user.discordId);
      await discordUser.send({ embeds: [embed], components: [buttons] });
      sent++;

      // Rate limit
      await sleep(RATE_LIMIT_MS);
    } catch (error: any) {
      // Handle common errors
      if (error.code === 50007) {
        // Cannot send DM (user has DMs disabled)
        logger.debug({ discordId: user.discordId }, '[Discord] User has DMs disabled');
      } else {
        logger.error({ error: error.message, discordId: user.discordId }, '[Discord] Failed to send alert');
      }
      failed++;
    }
  }

  logger.info(
    { signalId: signal.id, sent, skipped, failed, total: users.length },
    '[Discord] Alert batch processed'
  );
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatAlertEmbed(data: AlertJob): EmbedBuilder {
  const { signal, type } = data;

  const spreadPct = (signal.netSpreadBps / 100).toFixed(1);
  const confidencePct = Math.round(signal.confidence * 100);
  const profitUsd = (signal.expectedProfitCents / 100).toFixed(2);
  const priceUsd = (signal.priceCents / 100).toFixed(2);
  const fairValueUsd = (signal.sellCompCents / 100).toFixed(2);

  // Color based on spread
  const color = signal.netSpreadBps >= 2500 ? 0x00ff00 : // Green for 25%+
                signal.netSpreadBps >= 1500 ? 0xffff00 : // Yellow for 15%+
                0xff9900; // Orange for lower

  const typeEmoji = type === 'arbitrage' ? '⚡' : type === 'price_drop' ? '📉' : '🎯';
  const typeLabel = type === 'arbitrage' ? 'Arbitrage Alert' :
                    type === 'price_drop' ? 'Price Drop Alert' :
                    'Deal Alert';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${typeEmoji} ${typeLabel}`)
    .setDescription(`**${signal.cardName || signal.cardId}**${signal.setName ? ` - ${signal.setName}` : ''}`)
    .addFields(
      { name: 'Buy Price', value: `$${priceUsd}`, inline: true },
      { name: 'Fair Value', value: `$${fairValueUsd}`, inline: true },
      { name: 'Spread', value: `${spreadPct}%`, inline: true },
      { name: 'Expected Profit', value: `$${profitUsd}`, inline: true },
      { name: 'Confidence', value: `${confidencePct}%`, inline: true },
      { name: 'Source', value: `${signal.source} → ${signal.sourceSell}`, inline: true }
    )
    .setTimestamp();

  if (signal.rationale) {
    embed.addFields({
      name: 'Analysis',
      value: signal.rationale.slice(0, 200) + (signal.rationale.length > 200 ? '...' : ''),
    });
  }

  if (signal.url) {
    embed.setURL(signal.url);
  }

  embed.setFooter({ text: 'PokeDAO | Use /alerts to configure' });

  return embed;
}

function createAlertButtons(signalId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`alert:bought:${signalId}`)
      .setLabel('Bought')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`alert:watch:${signalId}`)
      .setLabel('Watch')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👁️'),
    new ButtonBuilder()
      .setCustomId(`alert:ignore:${signalId}`)
      .setLabel('Ignore')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔕'),
    new ButtonBuilder()
      .setCustomId(`alert:snooze:${signalId}`)
      .setLabel('Snooze 7d')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('😴')
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
