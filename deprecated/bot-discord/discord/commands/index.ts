/**
 * Discord Slash Command Registry
 *
 * Registers and routes all slash commands for the Discord bot.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { logger } from '../../lib/logger.js';
import { handleStart } from './start.js';
import { handleAlerts } from './alerts.js';
import { handleWatch } from './watch.js';
import { handleArbitrage } from './arbitrage.js';
import { handlePortfolio } from './portfolio.js';
import { handleSettings } from './settings.js';
import { handleHelp } from './help.js';
import { handleWallet } from './wallet.js';

// ============================================================================
// COMMAND DEFINITIONS
// ============================================================================

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Register with PokeDAO and start receiving alerts')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and how to use the bot')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('alerts')
    .setDescription('Configure your alert preferences')
    .addSubcommand((sub) =>
      sub.setName('on').setDescription('Enable alerts')
    )
    .addSubcommand((sub) =>
      sub.setName('off').setDescription('Disable alerts')
    )
    .addSubcommand((sub) =>
      sub.setName('settings').setDescription('View current alert settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('discount')
        .setDescription('Set minimum discount percentage')
        .addIntegerOption((opt) =>
          opt
            .setName('percent')
            .setDescription('Minimum discount (0-100)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('price')
        .setDescription('Set price range filter')
        .addIntegerOption((opt) =>
          opt.setName('min').setDescription('Minimum price in USD').setRequired(true).setMinValue(0)
        )
        .addIntegerOption((opt) =>
          opt.setName('max').setDescription('Maximum price in USD').setRequired(true).setMinValue(1)
        )
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('watch')
    .setDescription('Manage your watchlist')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show your watchlist')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a card to your watchlist')
        .addStringOption((opt) =>
          opt.setName('card').setDescription('Card name to watch').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a card from your watchlist')
        .addStringOption((opt) =>
          opt.setName('card').setDescription('Card name to remove').setRequired(true)
        )
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('arbitrage')
    .setDescription('Show top arbitrage opportunities')
    .addIntegerOption((opt) =>
      opt.setName('limit').setDescription('Number of opportunities to show (default: 5)').setMinValue(1).setMaxValue(20)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('portfolio')
    .setDescription('View your portfolio and P&L')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View your portfolio')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a holding to your portfolio')
        .addStringOption((opt) =>
          opt.setName('card').setDescription('Card name').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('cost').setDescription('Cost in cents').setRequired(true).setMinValue(1)
        )
        .addIntegerOption((opt) =>
          opt.setName('quantity').setDescription('Quantity (default: 1)').setMinValue(1)
        )
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure advanced preferences')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Manage your Solana wallet for token-gated features')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View connected wallet')
    )
    .addSubcommand((sub) =>
      sub
        .setName('connect')
        .setDescription('Connect a Solana wallet')
        .addStringOption((opt) =>
          opt.setName('address').setDescription('Solana wallet address').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('disconnect').setDescription('Disconnect wallet')
    )
    .toJSON(),
];

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================

export function registerCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return commands;
}

// ============================================================================
// COMMAND ROUTING
// ============================================================================

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;

  logger.debug(
    { command: commandName, user: interaction.user.id, guild: interaction.guildId },
    '[Discord] Command received'
  );

  switch (commandName) {
    case 'start':
      await handleStart(interaction);
      break;
    case 'help':
      await handleHelp(interaction);
      break;
    case 'alerts':
      await handleAlerts(interaction);
      break;
    case 'watch':
      await handleWatch(interaction);
      break;
    case 'arbitrage':
      await handleArbitrage(interaction);
      break;
    case 'portfolio':
      await handlePortfolio(interaction);
      break;
    case 'settings':
      await handleSettings(interaction);
      break;
    case 'wallet':
      await handleWallet(interaction);
      break;
    default:
      await interaction.reply({
        content: `Unknown command: ${commandName}`,
        ephemeral: true,
      });
  }
}
