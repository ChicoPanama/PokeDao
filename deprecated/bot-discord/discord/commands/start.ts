/**
 * /start Command
 *
 * Registers user with PokeDAO and sends welcome message.
 */

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { findOrCreateDiscordUser } from '../lib/users.js';
import { logger } from '../../lib/logger.js';

export async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const user = await findOrCreateDiscordUser({
      discordId: interaction.user.id,
      username: interaction.user.username,
      discriminator: interaction.user.discriminator,
      guildId: interaction.guildId ?? undefined,
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Welcome to PokeDAO!')
      .setDescription(
        'Your Bloomberg Terminal for Pokemon TCG trading.\n\n' +
        'You are now registered and ready to receive alerts.'
      )
      .addFields(
        { name: 'Your Tier', value: user.tier || 'FREE', inline: true },
        { name: 'Alerts', value: user.alertsEnabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Referral Code', value: `\`${user.referralCode}\``, inline: true }
      )
      .addFields({
        name: 'Quick Start',
        value:
          '`/alerts on` - Enable deal alerts\n' +
          '`/watch add <card>` - Watch specific cards\n' +
          '`/arbitrage` - See top opportunities\n' +
          '`/help` - All commands',
      })
      .setFooter({ text: 'PokeDAO - Smart Trading for Pokemon TCG' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(
      { discordId: interaction.user.id, userId: user.id },
      '[Discord] User registered'
    );
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to register user');
    await interaction.editReply({
      content: 'Failed to register. Please try again later.',
    });
  }
}
