import { CommandContext } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// Referral commission rates
const TIER1_RATE = 0.30; // 30% from direct referrals
const TIER2_RATE = 0.10; // 10% from tier 2
const TIER3_RATE = 0.05; // 5% from tier 3

/**
 * Calculate referral earnings across 3 tiers
 */
async function calculateReferralEarnings(userReferralCode: string): Promise<{
  tier1: number;
  tier2: number;
  tier3: number;
  total: number;
}> {
  // Tier 1: Direct referrals (30%)
  const tier1Users = await prisma.user.findMany({
    where: { referredBy: userReferralCode },
    select: { id: true, referralCode: true },
  });

  if (tier1Users.length === 0) {
    return { tier1: 0, tier2: 0, tier3: 0, total: 0 };
  }

  const tier1Fees = await prisma.purchase.aggregate({
    where: { userId: { in: tier1Users.map((u) => u.id) } },
    _sum: { fee: true },
  });

  const tier1Earnings = ((tier1Fees._sum.fee || 0) / 100) * TIER1_RATE;

  // Tier 2: Referrals of referrals (10%)
  const tier1Codes = tier1Users.map((u) => u.referralCode).filter(Boolean) as string[];
  let tier2Earnings = 0;
  let tier3Earnings = 0;

  if (tier1Codes.length > 0) {
    const tier2Users = await prisma.user.findMany({
      where: { referredBy: { in: tier1Codes } },
      select: { id: true, referralCode: true },
    });

    if (tier2Users.length > 0) {
      const tier2Fees = await prisma.purchase.aggregate({
        where: { userId: { in: tier2Users.map((u) => u.id) } },
        _sum: { fee: true },
      });
      tier2Earnings = ((tier2Fees._sum.fee || 0) / 100) * TIER2_RATE;

      // Tier 3: Third level referrals (5%)
      const tier2Codes = tier2Users.map((u) => u.referralCode).filter(Boolean) as string[];

      if (tier2Codes.length > 0) {
        const tier3Users = await prisma.user.findMany({
          where: { referredBy: { in: tier2Codes } },
          select: { id: true },
        });

        if (tier3Users.length > 0) {
          const tier3Fees = await prisma.purchase.aggregate({
            where: { userId: { in: tier3Users.map((u) => u.id) } },
            _sum: { fee: true },
          });
          tier3Earnings = ((tier3Fees._sum.fee || 0) / 100) * TIER3_RATE;
        }
      }
    }
  }

  return {
    tier1: tier1Earnings,
    tier2: tier2Earnings,
    tier3: tier3Earnings,
    total: tier1Earnings + tier2Earnings + tier3Earnings,
  };
}

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
    // Get user data
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.user.telegramId },
    });

    if (!user) {
      await ctx.reply('Please use /start first to register.');
      return;
    }

    // Calculate referral stats - count users who were referred by this user's code
    const referralCount = await prisma.user.count({
      where: { referredBy: user.referralCode },
    });

    // Get referral events for this user's code
    const referralEvents = await prisma.referralEvent.count({
      where: { code: user.referralCode },
    });

    // Calculate actual earnings from Purchase fees
    const earnings = await calculateReferralEarnings(user.referralCode);

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

💵 **Earnings Breakdown:**
• Tier 1 (30%): $${earnings.tier1.toFixed(2)}
• Tier 2 (10%): $${earnings.tier2.toFixed(2)}
• Tier 3 (5%): $${earnings.tier3.toFixed(2)}
• **Total:** $${earnings.total.toFixed(2)}

💰 **How it works:**
• Share your link with friends
• Earn **30%** of fees from direct referrals
• Earn **10%** from their referrals (2nd tier)
• Earn **5%** from 3rd tier referrals

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
        { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } }
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
