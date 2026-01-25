/**
 * Portfolio Command
 *
 * View portfolio holdings and P&L via Telegram
 */

import { Context, InlineKeyboard } from 'grammy';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// Type assertions for new Prisma models (run `prisma generate` after schema update)
const db = prisma as any;

const API_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * /portfolio command handler
 */
export async function portfolioCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) {
    await ctx.reply('Could not identify user.');
    return;
  }

  try {
    // Get user from DB
    const user = await db.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      await ctx.reply(
        '❌ You need to register first!\n\nSend /start to create your account.'
      );
      return;
    }

    // Fetch portfolio from API
    const response = await fetch(`${API_URL}/api/portfolio/${user.id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch portfolio');
    }

    const data = await response.json();
    const { holdings, summary } = data;

    if (!holdings || holdings.length === 0) {
      const keyboard = new InlineKeyboard()
        .text('➕ Add Holding', 'portfolio:add')
        .row()
        .text('📊 View Market', 'portfolio:market');

      await ctx.reply(
        `💼 **Your Portfolio**

📭 No holdings yet!

Start building your portfolio by adding your card purchases.

_Track your Pokemon TCG investments and see real-time P&L._`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
      return;
    }

    // Format holdings summary
    const isPositive = parseFloat(summary.totalGainLossPct) >= 0;
    const emoji = isPositive ? '📈' : '📉';
    const sign = isPositive ? '+' : '';

    let message = `💼 **Your Portfolio**\n\n`;
    message += `📊 **Summary**\n`;
    message += `├ Holdings: ${summary.totalHoldings}\n`;
    message += `├ Cost Basis: $${summary.totalCostBasisUsd}\n`;
    message += `├ Current Value: $${summary.totalCurrentValueUsd}\n`;
    message += `└ ${emoji} P&L: ${sign}$${summary.totalGainLossUsd} (${sign}${summary.totalGainLossPct}%)\n\n`;

    message += `📦 **Holdings**\n`;

    // Show top 5 holdings
    const topHoldings = holdings.slice(0, 5);
    topHoldings.forEach((h: any, i: number) => {
      const pnlEmoji = h.gainLossPct && parseFloat(h.gainLossPct) >= 0 ? '🟢' : '🔴';
      const pnlText = h.gainLossPct
        ? `${parseFloat(h.gainLossPct) >= 0 ? '+' : ''}${h.gainLossPct}%`
        : '-';

      message += `${i + 1}. **${h.cardName}**\n`;
      message += `   ${h.setName || ''} ${h.grade ? `• ${h.grade}` : ''}\n`;
      message += `   Cost: $${h.costBasisUsd} | ${pnlEmoji} ${pnlText}\n`;
    });

    if (holdings.length > 5) {
      message += `\n_...and ${holdings.length - 5} more holdings_`;
    }

    const keyboard = new InlineKeyboard()
      .text('➕ Add', 'portfolio:add')
      .text('📜 Full List', 'portfolio:list')
      .row()
      .text('📈 Performance', 'portfolio:perf')
      .text('🔄 Refresh', 'portfolio:refresh');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error({ error }, 'Portfolio command failed');
    await ctx.reply(
      '❌ Failed to load portfolio. Please try again later.'
    );
  }
}

/**
 * Portfolio callback handler
 */
export async function handlePortfolioCallback(
  ctx: Context,
  action: string,
  params?: string
): Promise<void> {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return;

  try {
    await ctx.answerCallbackQuery();

    switch (action) {
      case 'add':
        await ctx.reply(
          `➕ **Add Holding**

To add a card to your portfolio, use:

\`/add_holding <card_name> | <set> | <grade> | <cost>\`

Example:
\`/add_holding Charizard ex | 151 | PSA 10 | 299.99\`

_All fields except card name are optional._`,
          { parse_mode: 'Markdown' }
        );
        break;

      case 'list':
        await portfolioCommand(ctx);
        break;

      case 'refresh':
        await portfolioCommand(ctx);
        break;

      case 'perf':
        await showPerformance(ctx, telegramId);
        break;

      case 'market':
        await showMarketSummary(ctx);
        break;

      default:
        await ctx.reply('Unknown action');
    }
  } catch (error) {
    logger.error({ error, action }, 'Portfolio callback failed');
    await ctx.reply('❌ Action failed. Please try again.');
  }
}

/**
 * Show portfolio performance
 */
async function showPerformance(ctx: Context, telegramId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { telegramId },
    });

    if (!user) return;

    const response = await fetch(`${API_URL}/api/portfolio/${user.id}/performance?days=30`);
    if (!response.ok) {
      throw new Error('Failed to fetch performance');
    }

    const data = await response.json();
    const { dataPoints, summary } = data;

    if (!dataPoints || dataPoints.length === 0) {
      await ctx.reply('📊 No performance data available yet.');
      return;
    }

    const startValue = dataPoints[0]?.costBasisCents || 0;
    const endValue = dataPoints[dataPoints.length - 1]?.costBasisCents || 0;
    const change = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
    const isPositive = change >= 0;

    await ctx.reply(
      `📈 **Portfolio Performance (30 days)**

Start Value: $${(startValue / 100).toFixed(2)}
Current Value: $${(endValue / 100).toFixed(2)}
Change: ${isPositive ? '+' : ''}${change.toFixed(2)}%

_Based on ${dataPoints.length} data points_`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error({ error }, 'Show performance failed');
    await ctx.reply('❌ Failed to load performance data.');
  }
}

/**
 * Show market summary
 */
async function showMarketSummary(ctx: Context): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/market/summary`);
    if (!response.ok) {
      throw new Error('Failed to fetch market summary');
    }

    const data = await response.json();
    const { summary, marketSentiment, topOpportunities } = data;

    const sentimentEmoji = marketSentiment === 'active' ? '🟢' :
      marketSentiment === 'moderate' ? '🟡' : '🔴';

    let message = `📊 **Market Summary**\n\n`;
    message += `${sentimentEmoji} Sentiment: ${marketSentiment.toUpperCase()}\n`;
    message += `📝 New Listings (24h): ${summary.newListings24h}\n`;
    message += `⚡ Active Opportunities: ${summary.activeOpportunities}\n`;
    message += `🎴 Total Cards: ${summary.totalCards.toLocaleString()}\n\n`;

    if (topOpportunities && topOpportunities.length > 0) {
      message += `🔥 **Top Opportunities**\n`;
      topOpportunities.slice(0, 3).forEach((opp: any) => {
        message += `• ${opp.cardName}: +${opp.spreadPct}%\n`;
      });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error({ error }, 'Show market summary failed');
    await ctx.reply('❌ Failed to load market data.');
  }
}

/**
 * /add_holding command handler
 */
export async function addHoldingCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return;

  const text = ctx.message?.text || '';
  const parts = text.replace('/add_holding', '').trim().split('|').map((p) => p.trim());

  if (!parts[0]) {
    await ctx.reply(
      `Usage: \`/add_holding <card_name> | <set> | <grade> | <cost>\`

Example: \`/add_holding Charizard ex | 151 | PSA 10 | 299.99\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const [cardName, setName, grade, costStr] = parts;
  const cost = parseFloat(costStr || '0');

  if (isNaN(cost) || cost <= 0) {
    await ctx.reply('❌ Please provide a valid cost (e.g., 299.99)');
    return;
  }

  try {
    const user = await db.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      await ctx.reply('❌ Please register first with /start');
      return;
    }

    const response = await fetch(`${API_URL}/api/portfolio/${user.id}/holdings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardKey: `${cardName}-${setName || ''}-${grade || ''}`.toLowerCase().replace(/\s+/g, '-'),
        cardName,
        setName: setName || undefined,
        grade: grade || undefined,
        costBasisCents: Math.round(cost * 100),
        purchaseVenue: 'Manual Entry',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add holding');
    }

    await ctx.reply(
      `✅ **Added to Portfolio**

📦 ${cardName}
${setName ? `📚 Set: ${setName}\n` : ''}${grade ? `⭐ Grade: ${grade}\n` : ''}💰 Cost: $${cost.toFixed(2)}

Use /portfolio to view your holdings.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error({ error }, 'Add holding failed');
    await ctx.reply('❌ Failed to add holding. Please try again.');
  }
}
