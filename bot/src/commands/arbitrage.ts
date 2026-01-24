import { CommandContext } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getPreferences } from '../lib/preferences.js';

// Minimum spread to show in the list
const MIN_SPREAD_PCT = 10;

/**
 * /arbitrage command handler
 * Shows current cross-venue arbitrage opportunities
 */
export async function arbitrageCommand(ctx: CommandContext<UserContext>) {
  if (!ctx.user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  try {
    // Get user preferences to respect their filters
    const prefs = await getPreferences(ctx.user.telegramId);

    // Find arbitrage opportunities from CardSignal
    const opportunities = await prisma.cardSignal.findMany({
      where: {
        hasArbitrage: true,
        arbitrageSpreadPct: { gte: Math.max(MIN_SPREAD_PCT, prefs.minDiscountPct) },
      },
      include: {
        canonicalCard: true,
      },
      orderBy: { arbitrageSpreadPct: 'desc' },
      take: 10,
    });

    if (opportunities.length === 0) {
      await ctx.reply(
        `⚡ **Arbitrage Scanner**\n\n` +
        `No arbitrage opportunities found above ${Math.max(MIN_SPREAD_PCT, prefs.minDiscountPct)}% spread.\n\n` +
        `_We continuously scan 13+ marketplaces for price discrepancies. ` +
        `Check back soon or lower your minimum discount in /alerts._`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let message = `⚡ **Arbitrage Opportunities**\n\n` +
      `Found **${opportunities.length}** cross-venue opportunities:\n\n`;

    for (let i = 0; i < opportunities.length; i++) {
      const opp = opportunities[i];
      const card = opp.canonicalCard;

      // Parse arbitrage venues from JSON
      const venues = opp.arbitrageVenues as { buy?: string; sell?: string } | null;
      const buyVenue = venues?.buy || 'Unknown';
      const sellVenue = venues?.sell || 'Unknown';

      message += `**${i + 1}. ${card?.canonicalName || 'Unknown Card'}**\n`;
      if (card?.canonicalSet) {
        message += `   📚 ${card.canonicalSet}\n`;
      }
      message += `   📊 Spread: **+${opp.arbitrageSpreadPct?.toFixed(1) || '?'}%**\n`;
      message += `   🛒 Buy: ${buyVenue}\n`;
      message += `   💵 Sell: ${sellVenue}\n\n`;
    }

    message += `_Tap a card for full details and purchase links._`;

    // Build keyboard with first 5 opportunities
    const keyboard = new InlineKeyboard();
    opportunities.slice(0, 5).forEach((opp, i) => {
      const cardName = opp.canonicalCard?.canonicalName || 'Card';
      const shortName = cardName.length > 20 ? cardName.substring(0, 17) + '...' : cardName;
      keyboard.text(
        `${i + 1}. ${shortName}`,
        `arbitrage:details:${opp.canonicalCardId}`
      );
      if (i < 4 && i < opportunities.length - 1) {
        keyboard.row();
      }
    });

    keyboard.row().text('🔄 Refresh', 'arbitrage:refresh');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    logger.debug({ userId: ctx.user.id, count: opportunities.length }, 'Arbitrage list shown');
  } catch (error) {
    logger.error({ error }, 'Failed to load arbitrage opportunities');
    await ctx.reply('Failed to load arbitrage opportunities. Please try again.');
  }
}

/**
 * Handle arbitrage-related callbacks
 */
export async function handleArbitrageCallback(ctx: UserContext, action: string, cardId?: string) {
  if (!ctx.callbackQuery || !ctx.from) return;

  if (action === 'refresh') {
    await ctx.answerCallbackQuery({ text: 'Refreshing...' });
    // Re-run the command essentially
    await showArbitrageList(ctx);
    return;
  }

  if (action === 'details' && cardId) {
    await ctx.answerCallbackQuery();
    await showArbitrageDetails(ctx, cardId);
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Unknown action' });
}

/**
 * Show detailed arbitrage info for a specific card
 */
async function showArbitrageDetails(ctx: UserContext, cardId: string) {
  try {
    const signal = await prisma.cardSignal.findFirst({
      where: {
        canonicalCardId: cardId,
        hasArbitrage: true,
      },
      include: {
        canonicalCard: true,
      },
    });

    if (!signal) {
      await ctx.reply('Arbitrage opportunity no longer available.');
      return;
    }

    const card = signal.canonicalCard;
    const venues = signal.arbitrageVenues as {
      buy?: string;
      buyPrice?: number;
      buyUrl?: string;
      sell?: string;
      sellPrice?: number;
      sellUrl?: string;
    } | null;

    // Get current listings for this card
    const listings = await prisma.marketListing.findMany({
      where: {
        canonicalCardId: cardId,
        isActive: true,
      },
      orderBy: { priceCents: 'asc' },
      take: 5,
    });

    const formatPrice = (cents: number) => (cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    let message = `⚡ **Arbitrage Details**\n\n`;
    message += `📦 **${card?.canonicalName || 'Unknown Card'}**\n`;
    if (card?.canonicalSet) {
      message += `📚 ${card.canonicalSet}\n\n`;
    }

    if (venues) {
      const buyPrice = venues.buyPrice ? `$${formatPrice(venues.buyPrice)}` : 'Check link';
      const sellPrice = venues.sellPrice ? `$${formatPrice(venues.sellPrice)}` : 'Check link';

      message += `🛒 **Buy on ${venues.buy || 'Unknown'}:** ${buyPrice}\n`;
      message += `💵 **Sell on ${venues.sell || 'Unknown'}:** ${sellPrice}\n\n`;
    }

    message += `📊 **Spread:** +${signal.arbitrageSpreadPct?.toFixed(1) || '?'}%\n`;
    message += `⭐ **Signal Strength:** ${((signal.signalStrength || 0) * 100).toFixed(0)}%\n\n`;

    if (listings.length > 0) {
      message += `📋 **Current Listings:**\n`;
      listings.forEach((l, i) => {
        message += `${i + 1}. ${l.source}: $${formatPrice(l.priceCents)}\n`;
      });
      message += '\n';
    }

    message += `⚠️ _Note: Prices may have changed. Verify before purchasing. ` +
      `Fees and shipping not included in spread calculation._`;

    const keyboard = new InlineKeyboard();
    if (venues?.buyUrl) {
      keyboard.url('🛒 Buy Link', venues.buyUrl);
    }
    if (venues?.sellUrl) {
      keyboard.url('💵 Sell Link', venues.sellUrl);
    }
    keyboard.row()
      .text('👀 Watch Card', `arbitrage:watch:${cardId}`)
      .text('◀️ Back', 'arbitrage:refresh');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    logger.error({ error, cardId }, 'Failed to show arbitrage details');
    await ctx.reply('Failed to load details. Please try again.');
  }
}

/**
 * Show arbitrage list (for refresh and callbacks)
 */
async function showArbitrageList(ctx: UserContext) {
  try {
    const prefs = await getPreferences(ctx.from!.id.toString());

    const opportunities = await prisma.cardSignal.findMany({
      where: {
        hasArbitrage: true,
        arbitrageSpreadPct: { gte: Math.max(MIN_SPREAD_PCT, prefs.minDiscountPct) },
      },
      include: {
        canonicalCard: true,
      },
      orderBy: { arbitrageSpreadPct: 'desc' },
      take: 10,
    });

    if (opportunities.length === 0) {
      await ctx.reply(
        `⚡ **Arbitrage Scanner**\n\n` +
        `No opportunities found above ${Math.max(MIN_SPREAD_PCT, prefs.minDiscountPct)}% spread.\n\n` +
        `_Check back soon or adjust filters in /alerts._`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let message = `⚡ **Arbitrage Opportunities** (Updated)\n\n`;

    for (let i = 0; i < opportunities.length; i++) {
      const opp = opportunities[i];
      const card = opp.canonicalCard;
      const venues = opp.arbitrageVenues as { buy?: string; sell?: string } | null;

      message += `**${i + 1}. ${card?.canonicalName || 'Unknown'}**\n`;
      message += `   📊 +${opp.arbitrageSpreadPct?.toFixed(1) || '?'}% `;
      message += `(${venues?.buy || '?'} → ${venues?.sell || '?'})\n`;
    }

    const keyboard = new InlineKeyboard();
    opportunities.slice(0, 5).forEach((opp, i) => {
      const shortName = (opp.canonicalCard?.canonicalName || 'Card').substring(0, 17);
      keyboard.text(`${i + 1}. ${shortName}`, `arbitrage:details:${opp.canonicalCardId}`);
      if (i < 4) keyboard.row();
    });
    keyboard.row().text('🔄 Refresh', 'arbitrage:refresh');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to refresh arbitrage list');
    await ctx.reply('Failed to refresh. Please try again.');
  }
}
