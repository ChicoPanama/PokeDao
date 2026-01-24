/**
 * /start command handler
 * Registers new users and shows welcome message
 */

import { Context } from 'grammy';
import { findOrCreateUser } from '../lib/users.js';
import { formatWelcome } from '../services/alerts.js';

export async function handleStart(ctx: Context) {
  const from = ctx.from;
  
  if (!from) {
    await ctx.reply('❌ Could not identify user. Please try again.');
    return;
  }

  try {
    const user = await findOrCreateUser({
      id: from.id,
      first_name: from.first_name,
      last_name: from.last_name,
      username: from.username,
    });

    const firstName = from.first_name || 'Trainer';
    
    await ctx.reply(formatWelcome(firstName, user.referralCode), {
      parse_mode: 'MarkdownV2',
    });

    console.log(`✅ User registered/welcomed: ${from.id} (@${from.username || 'no-username'})`);
  } catch (error) {
    console.error('❌ Error in /start handler:', error);
    await ctx.reply('❌ Something went wrong. Please try again later.');
  }
}
