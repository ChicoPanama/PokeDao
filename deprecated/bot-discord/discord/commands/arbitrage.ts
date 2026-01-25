/**
 * /arbitrage Command
 *
 * Show top arbitrage opportunities.
 */

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export async function handleArbitrage(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const limit = interaction.options.getInteger('limit') ?? 5;

  try {
    // Fetch top signals ordered by edge
    const signals = await prisma.signal.findMany({
      where: {
        status: 'ACTIVE',
        isValidated: true,
      },
      orderBy: { edgeBp: 'desc' },
      take: limit,
      include: {
        card: true,
      },
    });

    if (signals.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('Arbitrage Opportunities')
        .setDescription('No active arbitrage opportunities found at the moment.\n\nCheck back later!');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`Top ${signals.length} Arbitrage Opportunities`)
      .setDescription('Cross-venue arbitrage with fee-adjusted spreads:')
      .setTimestamp();

    for (const signal of signals) {
      const spreadPct = (signal.edgeBp / 100).toFixed(1);
      const confidence = Math.round(signal.confidence * 100);
      const cardName = signal.card?.name || signal.cardId;

      embed.addFields({
        name: `${cardName}`,
        value:
          `**Spread:** ${spreadPct}% | **Confidence:** ${confidence}%\n` +
          `${signal.thesis || 'Quantitative arbitrage opportunity'}`,
        inline: false,
      });
    }

    embed.setFooter({ text: 'Use /alerts on to receive real-time alerts' });

    await interaction.editReply({ embeds: [embed] });
    logger.debug({ discordId: interaction.user.id, count: signals.length }, '[Discord] Arbitrage displayed');
  } catch (error) {
    logger.error({ error, discordId: interaction.user.id }, '[Discord] Failed to fetch arbitrage');
    await interaction.editReply({ content: 'Failed to load opportunities. Please try again.' });
  }
}
