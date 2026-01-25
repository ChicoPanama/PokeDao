/**
 * /settings Command
 *
 * View and configure advanced preferences.
 */

import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDiscordUserPreferences } from '../lib/preferences.js';
import { logger } from '../../lib/logger.js';

export async function handleSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const prefs = await getDiscordUserPreferences(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('Advanced Settings')
      .setDescription('Configure your PokeDAO experience.')
      .addFields(
        {
          name: 'Alert Settings',
          value:
            `**Status:** ${prefs.alertsEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
            `**Min Discount:** ${prefs.minDiscountPct}%\n` +
            `**Price Range:** $${prefs.minPriceUsd} - $${prefs.maxPriceUsd}`,
        },
        {
          name: 'Grade Filters',
          value: prefs.grades?.length > 0 ? prefs.grades.join(', ') : 'All grades accepted',
        },
        {
          name: 'Quiet Hours',
          value: prefs.quietHoursStart && prefs.quietHoursEnd
            ? `${prefs.quietHoursStart} - ${prefs.quietHoursEnd}`
            : 'Not configured',
        }
      )
      .setFooter({ text: 'Use the buttons below to modify settings' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('settings:alerts_toggle')
        .setLabel(prefs.alertsEnabled ? 'Disable Alerts' : 'Enable Alerts')
        .setStyle(prefs.alertsEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('settings:grades')
        .setLabel('Configure Grades')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('settings:quiet_hours')
        .setLabel('Quiet Hours')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to load settings');
    await interaction.editReply({ content: 'Failed to load settings. Please try again.' });
  }
}
