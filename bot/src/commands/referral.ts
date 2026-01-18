import { CommandContext } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * /referral command handler
 * Shows referral code, link, and stats
 */
export async function referralCommand(ctx: CommandContext<UserContext>) {
  if (!ctx.user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  try {
    // Get user with referral data
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.user.telegramId },
      include: {
        referrals: true, // Users who used this user's referral code
      },
    });

    if (!user) {
      await ctx.reply('Please use /start first to register.');
      return;
    }

    // Calculate referral stats
    const referralCount = user.referrals?.length || 0;

    // Get referral events for this user's code
    const referralEvents = await prisma.referralEvent.count({
      where: { code: user.referralCode },
    });

    // Calculate estimated earnings (mock for now - actual would come from transactions)
    const estimatedEarnings = 0; // TODO: Calculate from Transaction model

    // Get bot username for the referral link
    const botInfo = await ctx.api.getMe();
    const referralLink = `https://t.me/${botInfo.username}?start=${user.referralCode}`;

    const message = `🔗 **Your Referral Program**

**Your Code:** \`${user.referralCode}\`
**Your Link:**
\`${referralLink}\`

📊 **Stats:**
• Total Referrals: ${referralCount}
• Link Clicks: ${referralEvents}
• Estimated Earnings: $${estimatedEarnings.toFixed(2)}

💰 **How it works:**
• Share your link with friends
• Earn **30%** of fees from direct referrals
• Earn **10%** from their referrals (2nd tier)
• Earn **5%** from 3rd tier referrals

📈 **Referral Tiers:**
1. **Direct (Tier 1):** 30% of trading fees
2. **Tier 2:** 10% of their referrals' fees
3. **Tier 3:** 5% of extended network

_Payouts are processed daily to your connected wallet._`;

    const keyboard = new InlineKeyboard()
      .text('📋 Copy Link', 'referral:copy')
      .text('📤 Share', 'referral:share')
      .row()
      .text('📊 Detailed Stats', 'referral:stats');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    logger.debug({ userId: user.id, code: user.referralCode }, 'Referral info shown');
  } catch (error) {
    logger.error({ error }, 'Failed to get referral info');
    await ctx.reply('Failed to load referral info. Please try again.');
  }
}

/**
 * Handle referral-related callbacks
 */
export async function handleReferralCallback(ctx: UserContext, action: string) {
  if (!ctx.callbackQuery) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from!.id.toString() },
  });

  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Please use /start first' });
    return;
  }

  const botInfo = await ctx.api.getMe();
  const referralLink = `https://t.me/${botInfo.username}?start=${user.referralCode}`;

  switch (action) {
    case 'copy':
      await ctx.answerCallbackQuery({ text: '📋 Link copied to clipboard!' });
      await ctx.reply(`📋 **Copy this link:**\n\n\`${referralLink}\``, {
        parse_mode: 'Markdown',
      });
      break;

    case 'share':
      const shareText = encodeURIComponent(
        `🎮 Join me on PokeDAO - the AI-powered Pokémon card trading assistant!\n\n` +
        `Get real-time alerts on undervalued cards.\n\n${referralLink}`
      );
      await ctx.answerCallbackQuery({ text: 'Opening share...' });
      await ctx.reply(
        `📤 **Share on:**\n\n` +
        `• [Twitter](https://twitter.com/intent/tweet?text=${shareText})\n` +
        `• [Telegram](https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join PokeDAO!')})\n`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
      break;

    case 'stats':
      const referrals = await prisma.user.count({
        where: { referredBy: user.referralCode },
      });
      const events = await prisma.referralEvent.count({
        where: { code: user.referralCode },
      });

      await ctx.answerCallbackQuery();
      await ctx.reply(
        `📊 **Detailed Referral Stats**\n\n` +
        `**Code:** ${user.referralCode}\n` +
        `**Total Signups:** ${referrals}\n` +
        `**Link Visits:** ${events}\n` +
        `**Conversion Rate:** ${events > 0 ? ((referrals / events) * 100).toFixed(1) : 0}%\n\n` +
        `_Stats updated in real-time._`,
        { parse_mode: 'Markdown' }
      );
      break;

    default:
      await ctx.answerCallbackQuery({ text: 'Unknown action' });
  }
}
