/**
 * /watch Command
 *
 * Manage watchlist of cards to track.
 */

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDiscordUserWatchlist, addToDiscordWatchlist, removeFromDiscordWatchlist } from '../lib/users.js';
import { logger } from '../../lib/logger.js';

export async function handleWatch(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'list':
      await handleWatchList(interaction);
      break;
    case 'add':
      await handleWatchAdd(interaction);
      break;
    case 'remove':
      await handleWatchRemove(interaction);
      break;
  }
}

async function handleWatchList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const watchlist = await getDiscordUserWatchlist(interaction.user.id);

    if (watchlist.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('Your Watchlist')
        .setDescription('Your watchlist is empty.\n\nUse `/watch add <card>` to start tracking cards.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const cardList = watchlist.map((item, i) => `${i + 1}. ${item.cardName}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('Your Watchlist')
      .setDescription(`You are watching **${watchlist.length}** card(s):\n\n${cardList}`)
      .setFooter({ text: 'Use /watch remove <card> to remove items' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to get watchlist');
    await interaction.editReply({ content: 'Failed to load watchlist. Please try again.' });
  }
}

async function handleWatchAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cardName = interaction.options.getString('card', true);

  try {
    await addToDiscordWatchlist(interaction.user.id, cardName);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Added to Watchlist')
      .setDescription(`**${cardName}** has been added to your watchlist.\n\nYou will receive alerts when this card has deals.`);

    await interaction.editReply({ embeds: [embed] });
    logger.info({ discordId: interaction.user.id, card: cardName }, '[Discord] Card added to watchlist');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to add to watchlist');
    await interaction.editReply({ content: 'Failed to add card. Please try again.' });
  }
}

async function handleWatchRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cardName = interaction.options.getString('card', true);

  try {
    const removed = await removeFromDiscordWatchlist(interaction.user.id, cardName);

    if (removed) {
      const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('Removed from Watchlist')
        .setDescription(`**${cardName}** has been removed from your watchlist.`);

      await interaction.editReply({ embeds: [embed] });
      logger.info({ discordId: interaction.user.id, card: cardName }, '[Discord] Card removed from watchlist');
    } else {
      await interaction.editReply({ content: `**${cardName}** was not found in your watchlist.` });
    }
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to remove from watchlist');
    await interaction.editReply({ content: 'Failed to remove card. Please try again.' });
  }
}
