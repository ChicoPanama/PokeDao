/**
 * /stats command handler
 * View purchase history and stats
 */

import { Context } from 'grammy';
import { getUserByTelegramId } from '../lib/users.js';
import { db } from '../lib/db.js';

export async function handleStats(ctx: Context) {
  const from = ctx.from;

  if (!from) {
    await ctx.reply('❌ Could not identify user.');
    return;
  }

  try {
    const user = await getUserByTelegramId(String(from.id));
    
    if (!user) {
      await ctx.reply('❌ Please use /start first to register.');
      return;
    }

    // Get purchase stats
    const purchases = await db.purchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0);
    const totalFees = purchases.reduce((sum, p) => sum + p.fee, 0);

    if (purchases.length === 0) {
      await ctx.reply(
        '📊 *Your Trading Stats*\n\n' +
        'No purchases recorded yet\\.\n\n' +
        'When you tap "Bought" on deal alerts, your purchases will be tracked here\\.',
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    const recentPurchases = purchases.slice(0, 5).map((p, i) => {
      const date = p.createdAt.toLocaleDateString();
      return `${i + 1}\\. $${p.amount.toFixed(2)} on ${date}`;
    }).join('\n');

    await ctx.reply(
      `📊 *Your Trading Stats*\n\n` +
      `🛒 *Total Purchases:* ${purchases.length}\n` +
      `💵 *Total Spent:* $${totalSpent.toFixed(2)}\n` +
      `📈 *Fees Paid:* $${totalFees.toFixed(2)}\n\n` +
      `*Recent Purchases:*\n${recentPurchases}`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    console.error('❌ Error in /stats handler:', error);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}
