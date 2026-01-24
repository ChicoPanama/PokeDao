/**
 * /help command handler
 */

import { Context } from 'grammy';
import { formatHelp } from '../services/alerts.js';

export async function handleHelp(ctx: Context) {
  await ctx.reply(formatHelp(), {
    parse_mode: 'MarkdownV2',
  });
}
