/**
 * /alerts Command
 *
 * Configure alert preferences: enable/disable, discount threshold, price range.
 */

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDiscordUserPreferences, updateDiscordUserPreferences } from '../lib/preferences.js';
import { logger } from '../../lib/logger.js';

export async function handleAlerts(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'on':
      await handleAlertsOn(interaction);
      break;
    case 'off':
      await handleAlertsOff(interaction);
      break;
    case 'settings':
      await handleAlertsSettings(interaction);
      break;
    case 'discount':
      await handleAlertsDiscount(interaction);
      break;
    case 'price':
      await handleAlertsPrice(interaction);
      break;
  }
}

async function handleAlertsOn(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    await updateDiscordUserPreferences(interaction.user.id, { alertsEnabled: true });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Alerts Enabled')
      .setDescription(
        'You will now receive deal alerts when we find opportunities matching your criteria.\n\n' +
        'Use `/alerts settings` to view your current filters.'
      );

    await interaction.editReply({ embeds: [embed] });
    logger.info({ discordId: interaction.user.id }, '[Discord] Alerts enabled');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to enable alerts');
    await interaction.editReply({ content: 'Failed to enable alerts. Please try again.' });
  }
}

async function handleAlertsOff(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    await updateDiscordUserPreferences(interaction.user.id, { alertsEnabled: false });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('Alerts Disabled')
      .setDescription('You will no longer receive deal alerts.\n\nUse `/alerts on` to re-enable.');

    await interaction.editReply({ embeds: [embed] });
    logger.info({ discordId: interaction.user.id }, '[Discord] Alerts disabled');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to disable alerts');
    await interaction.editReply({ content: 'Failed to disable alerts. Please try again.' });
  }
}

async function handleAlertsSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const prefs = await getDiscordUserPreferences(interaction.user.id);

    const statusEmoji = prefs.alertsEnabled ? '🟢' : '🔴';
    const statusText = prefs.alertsEnabled ? 'Enabled' : 'Disabled';

    const embed = new EmbedBuilder()
      .setColor(prefs.alertsEnabled ? 0x00ff00 : 0xff0000)
      .setTitle('Alert Settings')
      .addFields(
        { name: 'Status', value: `${statusEmoji} ${statusText}`, inline: true },
        { name: 'Min Discount', value: `${prefs.minDiscountPct}%`, inline: true },
        { name: 'Price Range', value: `$${prefs.minPriceUsd} - $${prefs.maxPriceUsd}`, inline: true }
      )
      .addFields({
        name: 'Grades',
        value: prefs.grades?.length > 0 ? prefs.grades.join(', ') : 'All grades',
      })
      .setFooter({ text: 'Use /alerts <setting> to modify' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to get alert settings');
    await interaction.editReply({ content: 'Failed to load settings. Please try again.' });
  }
}

async function handleAlertsDiscount(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const percent = interaction.options.getInteger('percent', true);

  // Validation
  if (percent < 0 || percent > 100) {
    await interaction.editReply({ content: 'Discount must be between 0 and 100.' });
    return;
  }

  try {
    await updateDiscordUserPreferences(interaction.user.id, { minDiscountPct: percent });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Discount Filter Updated')
      .setDescription(`You will only receive alerts for deals with **${percent}%+** discount.`);

    await interaction.editReply({ embeds: [embed] });
    logger.info({ discordId: interaction.user.id, discount: percent }, '[Discord] Discount updated');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to update discount');
    await interaction.editReply({ content: 'Failed to update discount. Please try again.' });
  }
}

async function handleAlertsPrice(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const min = interaction.options.getInteger('min', true);
  const max = interaction.options.getInteger('max', true);

  // Validation
  if (min < 0) {
    await interaction.editReply({ content: 'Minimum price cannot be negative.' });
    return;
  }

  if (max <= min) {
    await interaction.editReply({ content: 'Maximum price must be greater than minimum.' });
    return;
  }

  if (max > 10000000) {
    await interaction.editReply({ content: 'Maximum price cannot exceed $10,000,000.' });
    return;
  }

  try {
    await updateDiscordUserPreferences(interaction.user.id, {
      minPriceUsd: min,
      maxPriceUsd: max,
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Price Range Updated')
      .setDescription(`You will only receive alerts for cards priced **$${min} - $${max}**.`);

    await interaction.editReply({ embeds: [embed] });
    logger.info({ discordId: interaction.user.id, min, max }, '[Discord] Price range updated');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to update price range');
    await interaction.editReply({ content: 'Failed to update price range. Please try again.' });
  }
}
