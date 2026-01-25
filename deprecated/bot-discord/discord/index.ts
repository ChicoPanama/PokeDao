/**
 * Discord Bot Entry Point
 *
 * Mirrors Telegram bot functionality for Discord users.
 * Uses discord.js v14 with slash commands and embeds.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import { logger } from '../lib/logger.js';
import { registerCommands, handleCommand } from './commands/index.js';
import { handleInteraction } from './events/interactions.js';
import { startDiscordAlertConsumer } from './workers/alert-consumer.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_ALERTS_ENABLED = process.env.DISCORD_ALERTS_ENABLED === 'true';

if (!DISCORD_BOT_TOKEN) {
  logger.warn('DISCORD_BOT_TOKEN not set, Discord bot will not start');
}

// ============================================================================
// CLIENT SETUP
// ============================================================================

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

// ============================================================================
// EVENT HANDLERS
// ============================================================================

client.once(Events.ClientReady, async (readyClient) => {
  logger.info({ user: readyClient.user.tag }, '[Discord] Bot is ready');

  // Register slash commands
  if (DISCORD_CLIENT_ID) {
    try {
      const rest = new REST().setToken(DISCORD_BOT_TOKEN);
      const commands = registerCommands();

      logger.info(`[Discord] Registering ${commands.length} slash commands...`);

      await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
        body: commands,
      });

      logger.info('[Discord] Slash commands registered successfully');
    } catch (error) {
      logger.error({ error }, '[Discord] Failed to register slash commands');
    }
  }

  // Start alert consumer if enabled
  if (DISCORD_ALERTS_ENABLED) {
    startDiscordAlertConsumer();
    logger.info('[Discord] Alert consumer started');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      await handleInteraction(interaction);
    }
  } catch (error) {
    logger.error({ error, interactionId: interaction.id }, '[Discord] Interaction error');

    // Try to respond with error (only for repliable interactions)
    try {
      if (interaction.isRepliable()) {
        const errorMessage = { content: 'An error occurred. Please try again.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    } catch {
      // Ignore - already responded or can't respond
    }
  }
});

client.on(Events.Error, (error) => {
  logger.error({ error }, '[Discord] Client error');
});

// ============================================================================
// START BOT
// ============================================================================

export async function startDiscordBot(): Promise<void> {
  if (!DISCORD_BOT_TOKEN) {
    logger.warn('[Discord] Bot token not configured, skipping Discord bot startup');
    return;
  }

  try {
    await client.login(DISCORD_BOT_TOKEN);
    logger.info('[Discord] Bot logged in successfully');
  } catch (error) {
    logger.error({ error }, '[Discord] Failed to login');
    throw error;
  }
}

export async function stopDiscordBot(): Promise<void> {
  client.destroy();
  logger.info('[Discord] Bot disconnected');
}

// Run if called directly
if (process.argv[1]?.includes('discord/index')) {
  startDiscordBot().catch((error) => {
    logger.error({ error }, '[Discord] Fatal error');
    process.exit(1);
  });
}
