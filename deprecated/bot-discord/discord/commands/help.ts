/**
 * /help Command
 *
 * Shows all available commands and how to use the bot.
 */

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('PokeDAO Commands')
    .setDescription('Your Bloomberg Terminal for Pokemon TCG trading.')
    .addFields(
      {
        name: 'Getting Started',
        value:
          '`/start` - Register and see your profile\n' +
          '`/help` - Show this help message',
      },
      {
        name: 'Alerts',
        value:
          '`/alerts on` - Enable deal alerts\n' +
          '`/alerts off` - Disable alerts\n' +
          '`/alerts settings` - View current settings\n' +
          '`/alerts discount <percent>` - Set minimum discount\n' +
          '`/alerts price <min> <max>` - Set price range',
      },
      {
        name: 'Watchlist',
        value:
          '`/watch list` - View your watchlist\n' +
          '`/watch add <card>` - Add a card\n' +
          '`/watch remove <card>` - Remove a card',
      },
      {
        name: 'Trading',
        value:
          '`/arbitrage` - Top arbitrage opportunities\n' +
          '`/portfolio view` - View your holdings\n' +
          '`/portfolio add <card> <cost>` - Add a holding',
      },
      {
        name: 'Account',
        value:
          '`/settings` - Advanced preferences\n' +
          '`/wallet view` - View connected wallet\n' +
          '`/wallet connect <address>` - Connect Solana wallet',
      }
    )
    .setFooter({ text: 'PokeDAO - Smart Trading for Pokemon TCG' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
