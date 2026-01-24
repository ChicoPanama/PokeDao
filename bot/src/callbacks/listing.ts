import { InlineKeyboard } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { snoozeCard } from '../lib/preferences.js';

/**
 * Handle listing-related callbacks from deal alerts
 */
export async function handleListingCallback(
  ctx: UserContext,
  action: string,
  listingId: string
) {
  if (!ctx.callbackQuery || !ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() },
  });

  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Please use /start first' });
    return;
  }

  // Get the listing
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { card: true },
  });

  if (!listing) {
    await ctx.answerCallbackQuery({ text: 'Listing not found' });
    return;
  }

  switch (action) {
    case 'open':
      // Open the listing URL
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `🔗 **Open Listing**\n\n` +
        `📦 ${listing.card?.name || 'Card'}\n` +
        `💰 $${listing.price.toFixed(2)}\n` +
        `🏪 ${listing.source}\n\n` +
        `👉 [Click here to view](${listing.url})`,
        { parse_mode: 'Markdown', link_preview_options: { is_disabled: false } }
      );
      break;

    case 'bought':
      // Record the purchase
      try {
        // Create a pending purchase record
        await prisma.purchase.create({
          data: {
            userId: user.id,
            listingId: listing.id,
            amount: listing.price,
            fee: listing.price * 0.01, // 1% fee
            status: 'pending',
          },
        });

        await ctx.answerCallbackQuery({ text: '🎉 Marked as bought!' });

        // Update the message to show it's been acted upon
        const keyboard = new InlineKeyboard()
          .text('✅ Purchased', `listing:confirmed:${listingId}`);

        try {
          await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
        } catch (e) {
          // Message might not be editable
        }

        await ctx.reply(
          `🎉 **Purchase Recorded!**\n\n` +
          `📦 ${listing.card?.name || 'Card'}\n` +
          `💰 $${listing.price.toFixed(2)}\n` +
          `💸 Fee: $${(listing.price * 0.01).toFixed(2)}\n\n` +
          `_Your purchase has been logged. If you have a wallet connected, ` +
          `the fee will be processed from your next transaction._`,
          { parse_mode: 'Markdown' }
        );

        logger.info({
          userId: user.id,
          listingId,
          amount: listing.price
        }, 'Purchase recorded');
      } catch (error) {
        logger.error({ error, listingId }, 'Failed to record purchase');
        await ctx.answerCallbackQuery({ text: 'Failed to record purchase' });
      }
      break;

    case 'ignore':
      // Just dismiss the alert
      await ctx.answerCallbackQuery({ text: 'Alert dismissed' });
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Message might not be deletable
        const keyboard = new InlineKeyboard()
          .text('❌ Dismissed', `listing:dismissed:${listingId}`);
        try {
          await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
        } catch (e2) {
          // Ignore edit errors
        }
      }
      break;

    case 'watch':
      // Add the card to watchlist
      try {
        const existing = await prisma.watchlistItem.findFirst({
          where: { userId: user.id, cardId: listing.cardId },
        });

        if (existing) {
          await ctx.answerCallbackQuery({ text: 'Already on watchlist!' });
        } else {
          await prisma.watchlistItem.create({
            data: {
              userId: user.id,
              cardId: listing.cardId,
            },
          });
          await ctx.answerCallbackQuery({ text: '👀 Added to watchlist!' });
        }

        logger.info({
          userId: user.id,
          cardId: listing.cardId
        }, 'Card added to watchlist from alert');
      } catch (error) {
        logger.error({ error, listingId }, 'Failed to add to watchlist');
        await ctx.answerCallbackQuery({ text: 'Failed to add to watchlist' });
      }
      break;

    case 'snooze':
      // Snooze alerts for this card for 24 hours
      try {
        await snoozeCard(ctx.from.id.toString(), listing.cardId);
        await ctx.answerCallbackQuery({ text: '😴 Snoozed for 24 hours' });

        // Update the keyboard to show snoozed state
        const snoozedKeyboard = new InlineKeyboard()
          .text('🔗 Open', `listing:open:${listingId}`)
          .text('✅ Bought', `listing:bought:${listingId}`)
          .row()
          .text('👀 Watch', `listing:watch:${listingId}`)
          .text('😴 Snoozed', `listing:snoozed:${listingId}`)
          .text('❌ Ignore', `listing:ignore:${listingId}`);

        try {
          await ctx.editMessageReplyMarkup({ reply_markup: snoozedKeyboard });
        } catch (e) {
          // Message might not be editable
        }

        await ctx.reply(
          `😴 **Snoozed**\n\n` +
          `You won't receive alerts for **${listing.card?.name || 'this card'}** ` +
          `for the next 24 hours.\n\n` +
          `_Use /alerts to manage your snooze settings._`,
          { parse_mode: 'Markdown' }
        );

        logger.info({
          userId: user.id,
          cardId: listing.cardId,
          cardName: listing.card?.name
        }, 'Card snoozed from alert');
      } catch (error) {
        logger.error({ error, listingId }, 'Failed to snooze card');
        await ctx.answerCallbackQuery({ text: 'Failed to snooze' });
      }
      break;

    case 'snoozed':
      // Card is already snoozed
      await ctx.answerCallbackQuery({ text: 'Already snoozed for 24 hours' });
      break;

    case 'confirmed':
    case 'dismissed':
      // These are just acknowledgment states
      await ctx.answerCallbackQuery({ text: 'Already processed' });
      break;

    default:
      await ctx.answerCallbackQuery({ text: 'Unknown action' });
  }
}

/**
 * Build the inline keyboard for a deal alert
 */
export function buildAlertKeyboard(listingId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔗 Open', `listing:open:${listingId}`)
    .text('✅ Bought', `listing:bought:${listingId}`)
    .row()
    .text('👀 Watch', `listing:watch:${listingId}`)
    .text('😴 Snooze', `listing:snooze:${listingId}`)
    .text('❌ Ignore', `listing:ignore:${listingId}`);
}
