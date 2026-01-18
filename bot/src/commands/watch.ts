import { CommandContext } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * /watch command handler
 * Shows watchlist and allows adding/removing cards
 */
export async function watchCommand(ctx: CommandContext<UserContext>) {
  if (!ctx.user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  try {
    // Get user's watchlist
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.user.telegramId },
      include: {
        watchlistItems: {
          include: {
            card: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      await ctx.reply('Please use /start first to register.');
      return;
    }

    const watchlist = user.watchlistItems || [];

    if (watchlist.length === 0) {
      const message = `👀 **Your Watchlist**

Your watchlist is empty!

**How to add cards:**
1. Search for a card: \`/search Charizard Base Set\`
2. Click "👀 Watch" on any alert
3. Get notified when prices drop on watched cards

**Popular Cards to Watch:**
• Charizard (Base Set)
• Pikachu Illustrator
• Lugia (Neo Genesis)

_You'll receive priority alerts for cards on your watchlist._`;

      const keyboard = new InlineKeyboard()
        .text('🔍 Search Cards', 'watch:search')
        .row()
        .text('🔥 Popular Cards', 'watch:popular');

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } else {
      // Show watchlist
      let listText = watchlist
        .map((item, i) => {
          const card = item.card;
          const name = card?.name || 'Unknown';
          const set = card?.set || '';
          const grade = card?.grade || '';
          return `${i + 1}. **${name}** - ${set} ${grade}`;
        })
        .join('\n');

      const message = `👀 **Your Watchlist** (${watchlist.length} cards)

${listText}

💡 **Watchlist benefits:**
• Priority alerts when prices drop
• Price history tracking
• AI analysis on demand

_Tap a card number below to manage it, or use /search to find more cards._`;

      const keyboard = new InlineKeyboard();

      // Add buttons for first 5 items
      watchlist.slice(0, 5).forEach((item, i) => {
        keyboard.text(`${i + 1}`, `watch:view:${item.cardId}`);
      });
      if (watchlist.length > 5) {
        keyboard.text('More...', 'watch:list');
      }

      keyboard.row()
        .text('🔍 Search Cards', 'watch:search')
        .text('🗑️ Clear All', 'watch:clear');

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get watchlist');
    await ctx.reply('Failed to load watchlist. Please try again.');
  }
}

/**
 * Add a card to user's watchlist
 */
export async function addToWatchlist(
  ctx: UserContext,
  cardId: string
): Promise<boolean> {
  if (!ctx.user) return false;

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.user.telegramId },
    });

    if (!user) return false;

    // Check if already watching
    const existing = await prisma.watchlistItem.findFirst({
      where: { userId: user.id, cardId },
    });

    if (existing) {
      await ctx.reply('✅ This card is already on your watchlist!');
      return true;
    }

    // Add to watchlist
    await prisma.watchlistItem.create({
      data: {
        userId: user.id,
        cardId,
      },
    });

    // Get card details
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    });

    await ctx.reply(
      `✅ **Added to Watchlist!**\n\n` +
      `📦 ${card?.name || 'Card'}\n` +
      `📚 ${card?.set || ''} ${card?.grade || ''}\n\n` +
      `_You'll receive priority alerts for this card._`,
      { parse_mode: 'Markdown' }
    );

    logger.info({ userId: user.id, cardId }, 'Card added to watchlist');
    return true;
  } catch (error) {
    logger.error({ error, cardId }, 'Failed to add to watchlist');
    return false;
  }
}

/**
 * Remove a card from user's watchlist
 */
export async function removeFromWatchlist(
  ctx: UserContext,
  cardId: string
): Promise<boolean> {
  if (!ctx.user) return false;

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.user.telegramId },
    });

    if (!user) return false;

    await prisma.watchlistItem.deleteMany({
      where: { userId: user.id, cardId },
    });

    await ctx.reply('✅ Removed from watchlist');
    logger.info({ userId: user.id, cardId }, 'Card removed from watchlist');
    return true;
  } catch (error) {
    logger.error({ error, cardId }, 'Failed to remove from watchlist');
    return false;
  }
}

/**
 * Handle watchlist-related callbacks
 */
export async function handleWatchCallback(ctx: UserContext, action: string, params?: string) {
  if (!ctx.callbackQuery || !ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() },
  });

  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Please use /start first' });
    return;
  }

  switch (action) {
    case 'search':
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '🔍 **Search for cards**\n\n' +
        'Send the card name to search:\n\n' +
        'Examples:\n' +
        '• `Charizard Base Set PSA 10`\n' +
        '• `Pikachu Illustrator`\n' +
        '• `Lugia Neo Genesis`',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'popular':
      await ctx.answerCallbackQuery();
      // Get most-watched cards
      const popularCards = await prisma.card.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, set: true, grade: true },
      });

      if (popularCards.length === 0) {
        await ctx.reply('No popular cards found. Try searching!');
        return;
      }

      const keyboard = new InlineKeyboard();
      popularCards.forEach(card => {
        keyboard.text(
          `${card.name} (${card.set || ''})`,
          `watch:add:${card.id}`
        ).row();
      });

      await ctx.reply('🔥 **Popular Cards**\n\nTap to add to your watchlist:', {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      break;

    case 'view':
      if (params) {
        await ctx.answerCallbackQuery();
        const card = await prisma.card.findUnique({
          where: { id: params },
          include: {
            listings: {
              where: { isActive: true },
              orderBy: { scrapedAt: 'desc' },
              take: 1,
            },
          },
        });

        if (!card) {
          await ctx.reply('Card not found');
          return;
        }

        const listing = card.listings[0];
        const message = `📦 **${card.name}**\n\n` +
          `📚 Set: ${card.set || 'Unknown'}\n` +
          `🎖️ Grade: ${card.grade || 'Raw'}\n` +
          (listing ? `💰 Latest Price: $${listing.price}\n` : '') +
          `\n_Last updated: ${card.updatedAt.toLocaleDateString()}_`;

        const keyboard = new InlineKeyboard()
          .text('🗑️ Remove from Watchlist', `watch:remove:${card.id}`)
          .row()
          .text('◀️ Back to List', 'watch:list');

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
      break;

    case 'add':
      if (params) {
        await addToWatchlist(ctx, params);
        await ctx.answerCallbackQuery({ text: 'Added to watchlist!' });
      }
      break;

    case 'remove':
      if (params) {
        await removeFromWatchlist(ctx, params);
        await ctx.answerCallbackQuery({ text: 'Removed from watchlist' });
      }
      break;

    case 'clear':
      await ctx.answerCallbackQuery({ text: 'Clearing watchlist...' });
      await prisma.watchlistItem.deleteMany({
        where: { userId: user.id },
      });
      await ctx.reply('✅ Watchlist cleared');
      break;

    case 'list':
      await ctx.answerCallbackQuery();
      // Trigger watchlist command to show full list
      // This is a workaround - ideally would use a proper navigation system
      break;

    default:
      await ctx.answerCallbackQuery({ text: 'Unknown action' });
  }
}
