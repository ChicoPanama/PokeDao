/**
 * /portfolio Command
 *
 * View and manage portfolio holdings.
 */

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../../lib/prisma.js';
import { getDiscordUser } from '../lib/users.js';
import { logger } from '../../lib/logger.js';

export async function handlePortfolio(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'view':
      await handlePortfolioView(interaction);
      break;
    case 'add':
      await handlePortfolioAdd(interaction);
      break;
  }
}

async function handlePortfolioView(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await getDiscordUser(interaction.user.id);
    if (!user) {
      await interaction.editReply({ content: 'Please run `/start` first to register.' });
      return;
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: user.id },
      include: {
        holdings: {
          include: { card: true },
          orderBy: { currentValueCents: 'desc' },
        },
      },
    });

    if (!portfolio || portfolio.holdings.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('Your Portfolio')
        .setDescription(
          'Your portfolio is empty.\n\n' +
          'Use `/portfolio add <card> <cost>` to add holdings.'
        );

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Calculate totals
    const totalCost = portfolio.holdings.reduce((sum, h) => sum + h.costBasisCents, 0);
    const totalValue = portfolio.holdings.reduce((sum, h) => sum + (h.currentValueCents || h.costBasisCents), 0);
    const totalPnL = totalValue - totalCost;
    const pnlPct = totalCost > 0 ? ((totalPnL / totalCost) * 100).toFixed(1) : '0.0';

    const pnlColor = totalPnL >= 0 ? 0x00ff00 : 0xff0000;
    const pnlEmoji = totalPnL >= 0 ? '📈' : '📉';

    const embed = new EmbedBuilder()
      .setColor(pnlColor)
      .setTitle('Your Portfolio')
      .setDescription(
        `**Total Value:** $${(totalValue / 100).toFixed(2)}\n` +
        `**Total Cost:** $${(totalCost / 100).toFixed(2)}\n` +
        `**P&L:** ${pnlEmoji} $${(totalPnL / 100).toFixed(2)} (${pnlPct}%)`
      )
      .setTimestamp();

    // Add top holdings
    const topHoldings = portfolio.holdings.slice(0, 10);
    for (const holding of topHoldings) {
      const holdingPnL = (holding.currentValueCents || holding.costBasisCents) - holding.costBasisCents;
      const holdingPnLPct = holding.costBasisCents > 0
        ? ((holdingPnL / holding.costBasisCents) * 100).toFixed(1)
        : '0.0';
      const emoji = holdingPnL >= 0 ? '🟢' : '🔴';

      embed.addFields({
        name: holding.card?.name || holding.cardId,
        value:
          `Qty: ${holding.quantity} | ` +
          `Cost: $${(holding.costBasisCents / 100).toFixed(2)} | ` +
          `${emoji} ${holdingPnLPct}%`,
        inline: true,
      });
    }

    if (portfolio.holdings.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${portfolio.holdings.length} holdings` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to load portfolio');
    await interaction.editReply({ content: 'Failed to load portfolio. Please try again.' });
  }
}

async function handlePortfolioAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const cardName = interaction.options.getString('card', true);
  const costCents = interaction.options.getInteger('cost', true);
  const quantity = interaction.options.getInteger('quantity') ?? 1;

  try {
    const user = await getDiscordUser(interaction.user.id);
    if (!user) {
      await interaction.editReply({ content: 'Please run `/start` first to register.' });
      return;
    }

    // Find or create portfolio
    let portfolio = await prisma.portfolio.findUnique({
      where: { userId: user.id },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: {
          userId: user.id,
          name: 'Default Portfolio',
        },
      });
    }

    // Find card by name (fuzzy match)
    const card = await prisma.card.findFirst({
      where: {
        name: { contains: cardName, mode: 'insensitive' },
      },
    });

    // Create holding
    await prisma.portfolioHolding.create({
      data: {
        portfolioId: portfolio.id,
        cardId: card?.id || cardName, // Use card ID if found, else use name as ID
        quantity,
        costBasisCents: costCents * quantity,
        currentValueCents: costCents * quantity, // Initial value = cost
        acquiredAt: new Date(),
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Holding Added')
      .setDescription(
        `Added **${quantity}x ${cardName}** to your portfolio.\n\n` +
        `**Cost Basis:** $${((costCents * quantity) / 100).toFixed(2)}`
      );

    await interaction.editReply({ embeds: [embed] });
    logger.info(
      { discordId: interaction.user.id, card: cardName, cost: costCents, qty: quantity },
      '[Discord] Holding added'
    );
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to add holding');
    await interaction.editReply({ content: 'Failed to add holding. Please try again.' });
  }
}
