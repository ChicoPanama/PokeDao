import { CommandContext } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * /start command handler
 * Handles initial onboarding and referral tracking
 */
export async function startCommand(ctx: CommandContext<UserContext>) {
  const username = ctx.from?.first_name || 'Trainer';

  // Check for referral code in deep link
  const payload = ctx.match; // Deep link payload after /start
  if (payload && typeof payload === 'string') {
    await handleReferral(ctx, payload);
  }

  const welcomeMessage = `🎮 **Welcome to PokeDAO, ${username}!**

I'm your AI-powered Pokémon card trading assistant. I monitor marketplaces 24/7 to find undervalued cards and send you alerts when I spot a deal.

📊 **What I can do:**
• Monitor 9+ marketplaces in real-time
• Calculate fair value using AI analysis
• Send deal alerts when cards are underpriced
• Track your watchlist and preferences

🚀 **Get started:**
/alerts - Configure your alert settings
/watch - Add cards to your watchlist
/referral - Get your referral link & earn rewards
/wallet - Connect your Solana wallet

📈 **Quick Stats:**
• Cards tracked: 21,600+
• Data sources: eBay, TCGPlayer, Collector Crypt, JustTCG
• AI model: Mew-1A (custom-trained on TCG data)

_Start by configuring your /alerts to receive deal notifications!_`;

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
}

/**
 * Handle referral code from deep link
 */
async function handleReferral(ctx: CommandContext<UserContext>, referralCode: string) {
  if (!ctx.user || !referralCode) return;

  try {
    // Find referrer by their referral code
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
    });

    if (!referrer) {
      logger.debug({ referralCode }, 'Invalid referral code');
      return;
    }

    // Don't allow self-referral
    if (referrer.telegramId === ctx.user.telegramId) {
      return;
    }

    // Check if user already has a referrer
    const currentUser = await prisma.user.findUnique({
      where: { telegramId: ctx.user.telegramId },
    });

    if (currentUser?.referredBy) {
      // Already has a referrer, don't override
      return;
    }

    // Update user with referrer
    await prisma.user.update({
      where: { telegramId: ctx.user.telegramId },
      data: { referredBy: referrer.referralCode },
    });

    // Log referral event
    await prisma.referralEvent.create({
      data: {
        userId: currentUser!.id,
        code: referralCode.toUpperCase(),
        path: '/start',
      },
    });

    await ctx.reply(`🎉 You were referred by a friend! You'll both earn rewards on your trades.`);
    logger.info({
      referrer: referrer.telegramId,
      referred: ctx.user.telegramId,
      code: referralCode
    }, 'Referral tracked');
  } catch (error) {
    logger.error({ error, referralCode }, 'Failed to process referral');
  }
}
