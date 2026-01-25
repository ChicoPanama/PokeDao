/**
 * Discord Interaction Handler
 *
 * Handles button clicks, select menus, and modal submissions.
 */

import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
} from 'discord.js';
import { updateDiscordUserPreferences, snoozeDiscordCard } from '../lib/preferences.js';
import { addToDiscordWatchlist } from '../lib/users.js';
import { logger } from '../../lib/logger.js';

type Interaction = ButtonInteraction | StringSelectMenuInteraction;

// ============================================================================
// INTERACTION ROUTER
// ============================================================================

export async function handleInteraction(interaction: Interaction): Promise<void> {
  const customId = interaction.customId;

  logger.debug(
    { customId, user: interaction.user.id, type: interaction.type },
    '[Discord] Interaction received'
  );

  // Parse custom ID format: action:data or action:subaction:data
  const [action, ...rest] = customId.split(':');

  switch (action) {
    case 'alert':
      await handleAlertInteraction(interaction as ButtonInteraction, rest);
      break;
    case 'settings':
      await handleSettingsInteraction(interaction as ButtonInteraction, rest);
      break;
    default:
      logger.warn({ customId }, '[Discord] Unknown interaction');
      await interaction.reply({ content: 'Unknown action', ephemeral: true });
  }
}

// ============================================================================
// ALERT INTERACTIONS
// ============================================================================

async function handleAlertInteraction(
  interaction: ButtonInteraction,
  parts: string[]
): Promise<void> {
  const [subAction, signalId] = parts;

  await interaction.deferReply({ ephemeral: true });

  try {
    switch (subAction) {
      case 'bought':
        // Record purchase
        await interaction.editReply({
          content: '🎉 Marked as purchased! This will improve your analytics.',
        });
        logger.info({ discordId: interaction.user.id, signalId }, '[Discord] Alert marked as bought');
        break;

      case 'watch':
        // Add to watchlist
        await addToDiscordWatchlist(interaction.user.id, signalId);
        await interaction.editReply({
          content: '👁️ Added to your watchlist. You\'ll get alerts for similar cards.',
        });
        break;

      case 'ignore':
        // Snooze this card for 24h
        await snoozeDiscordCard(interaction.user.id, signalId);
        await interaction.editReply({
          content: '🔕 Snoozed for 24 hours. You won\'t see alerts for this card.',
        });
        break;

      case 'snooze':
        // Snooze for 7 days
        await snoozeDiscordCard(interaction.user.id, signalId, 7 * 24 * 60 * 60 * 1000);
        await interaction.editReply({
          content: '🔕 Snoozed for 7 days.',
        });
        break;

      default:
        await interaction.editReply({ content: 'Unknown action' });
    }
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Alert interaction failed');
    await interaction.editReply({ content: 'Action failed. Please try again.' });
  }
}

// ============================================================================
// SETTINGS INTERACTIONS
// ============================================================================

async function handleSettingsInteraction(
  interaction: ButtonInteraction,
  parts: string[]
): Promise<void> {
  const [subAction] = parts;

  await interaction.deferReply({ ephemeral: true });

  try {
    switch (subAction) {
      case 'alerts_toggle':
        // Toggle alerts
        const { getDiscordUserPreferences } = await import('../lib/preferences.js');
        const prefs = await getDiscordUserPreferences(interaction.user.id);
        const newState = !prefs.alertsEnabled;

        await updateDiscordUserPreferences(interaction.user.id, { alertsEnabled: newState });

        const embed = new EmbedBuilder()
          .setColor(newState ? 0x00ff00 : 0xff0000)
          .setTitle(newState ? 'Alerts Enabled' : 'Alerts Disabled')
          .setDescription(
            newState
              ? 'You will now receive deal alerts.'
              : 'You will no longer receive deal alerts.'
          );

        await interaction.editReply({ embeds: [embed] });
        break;

      case 'grades':
        await interaction.editReply({
          content:
            'To configure grade filters, use:\n' +
            '`/alerts grades PSA 10, PSA 9, CGC 10`\n\n' +
            'Leave empty to accept all grades.',
        });
        break;

      case 'quiet_hours':
        await interaction.editReply({
          content:
            'Quiet hours feature coming soon!\n\n' +
            'This will let you set times when you don\'t want to receive alerts.',
        });
        break;

      default:
        await interaction.editReply({ content: 'Unknown setting' });
    }
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Settings interaction failed');
    await interaction.editReply({ content: 'Action failed. Please try again.' });
  }
}
