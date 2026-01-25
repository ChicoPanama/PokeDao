/**
 * /watch command handler
 * View and manage watchlist
 */

import { Context } from 'grammy';
import { getUserByTelegramId, getWatchlist } from '../lib/users.js';

export async function handleWatch(ctx: Context) {
  const from = ctx.from;

  if (!from) {
    await ctx.reply('Could not identify user.');
    return;
  }

  try {
    const user = await getUserByTelegramId(String(from.id));

    if (!user) {
      await ctx.reply('Please use /start first to register.');
      return;
    }

    const watchlist = await getWatchlist(user.id);

    if (watchlist.length === 0) {
      await ctx.reply(
        '*Your Watchlist is Empty*\n\n' +
          'When you see a deal alert, tap "Watch" to add cards here\\.\n\n' +
          "You'll be notified when new listings appear below fair value\\.",
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    const lines = watchlist.map((item, i) => {
      const card = item.card;
      const gradeText = card.grade ? ` \\(${escapeMarkdown(card.grade)}\\)` : '';
      return `${i + 1}\\. ${escapeMarkdown(card.name)} \\- ${escapeMarkdown(card.set)}${gradeText}`;
    });

    await ctx.reply(
      `*Your Watchlist* \\(${watchlist.length} cards\\)\n\n` +
        lines.join('\n') +
        "\n\nYou'll receive alerts for these cards\\.",
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    console.error('Error in /watch handler:', error);
    await ctx.reply('Something went wrong. Please try again.');
  }
}

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
