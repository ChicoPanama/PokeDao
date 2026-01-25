/**
 * /wallet Command
 *
 * Manage Solana wallet for token-gated features.
 */

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getDiscordUser, updateDiscordUserWallet } from '../lib/users.js';
import { logger } from '../../lib/logger.js';

// Solana address validation (base58, 32-44 chars)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function handleWallet(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'view':
      await handleWalletView(interaction);
      break;
    case 'connect':
      await handleWalletConnect(interaction);
      break;
    case 'disconnect':
      await handleWalletDisconnect(interaction);
      break;
  }
}

async function handleWalletView(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await getDiscordUser(interaction.user.id);

    if (!user) {
      await interaction.editReply({ content: 'Please run `/start` first to register.' });
      return;
    }

    if (!user.walletAddress) {
      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('No Wallet Connected')
        .setDescription(
          'You haven\'t connected a Solana wallet yet.\n\n' +
          'Use `/wallet connect <address>` to connect your wallet and unlock premium features.'
        )
        .addFields({
          name: 'Token-Gated Features',
          value:
            '🥉 **BRONZE** (100+ PKDAO): Priority alerts, portfolio tracking\n' +
            '🥈 **SILVER** (500+ PKDAO): Unlimited alerts, API access\n' +
            '🥇 **GOLD** (1000+ PKDAO): Early access, AI insights',
        });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const shortAddress = `${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-8)}`;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Connected Wallet')
      .setDescription(`**Address:** \`${shortAddress}\``)
      .addFields(
        { name: 'Tier', value: user.tier || 'FREE', inline: true },
        { name: 'Token Balance', value: `${user.tokenBalance || 0} PKDAO`, inline: true }
      )
      .setFooter({ text: 'Use /wallet disconnect to remove wallet' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to view wallet');
    await interaction.editReply({ content: 'Failed to load wallet info. Please try again.' });
  }
}

async function handleWalletConnect(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const address = interaction.options.getString('address', true);

  // Validate Solana address format
  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    await interaction.editReply({
      content: 'Invalid Solana wallet address. Please provide a valid base58 address.',
    });
    return;
  }

  try {
    const user = await updateDiscordUserWallet(interaction.user.id, address);

    if (!user) {
      await interaction.editReply({ content: 'Please run `/start` first to register.' });
      return;
    }

    const shortAddress = `${address.slice(0, 8)}...${address.slice(-8)}`;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Wallet Connected')
      .setDescription(`Successfully connected wallet:\n\`${shortAddress}\``)
      .addFields(
        { name: 'Tier', value: user.tier || 'FREE', inline: true },
        { name: 'Status', value: 'Verifying balance...', inline: true }
      )
      .setFooter({ text: 'Your tier will update once we verify your token balance' });

    await interaction.editReply({ embeds: [embed] });
    logger.info({ discordId: interaction.user.id, wallet: shortAddress }, '[Discord] Wallet connected');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to connect wallet');
    await interaction.editReply({ content: 'Failed to connect wallet. Please try again.' });
  }
}

async function handleWalletDisconnect(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await updateDiscordUserWallet(interaction.user.id, null);

    if (!user) {
      await interaction.editReply({ content: 'Please run `/start` first to register.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle('Wallet Disconnected')
      .setDescription(
        'Your Solana wallet has been disconnected.\n\n' +
        'You will now have FREE tier access only.'
      );

    await interaction.editReply({ embeds: [embed] });
    logger.info({ discordId: interaction.user.id }, '[Discord] Wallet disconnected');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to disconnect wallet');
    await interaction.editReply({ content: 'Failed to disconnect wallet. Please try again.' });
  }
}
