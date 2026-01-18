import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { authMiddleware, rateLimitMiddleware, UserContext } from './middleware/auth.js';

// Commands
import { startCommand } from './commands/start.js';
import { walletCommand, handleWalletSubmission } from './commands/wallet.js';
import { referralCommand, handleReferralCallback } from './commands/referral.js';
import { alertsCommand, handleAlertsCallback } from './commands/alerts.js';
import { watchCommand, handleWatchCallback } from './commands/watch.js';

// Callbacks
import { handleListingCallback } from './callbacks/listing.js';

// Alert system
import { initAlertSender } from './alerts/sender.js';

// Create the bot
const bot = new Bot<UserContext>(config.TELEGRAM_BOT_TOKEN);

// Initialize alert sender
const alertSender = initAlertSender(bot);

// ========================
// MIDDLEWARE
// ========================

// Rate limiting (before auth to prevent spam)
bot.use(rateLimitMiddleware);

// User registration/lookup
bot.use(authMiddleware);

// ========================
// COMMANDS
// ========================

bot.command('start', startCommand);
bot.command('wallet', walletCommand);
bot.command('referral', referralCommand);
bot.command('alerts', alertsCommand);
bot.command('watch', watchCommand);

// Help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    `🎮 **PokeDAO Bot Commands**

**Getting Started:**
/start - Welcome & onboarding
/help - Show this help message

**Trading:**
/alerts - Configure deal alert settings
/watch - Manage your watchlist

**Account:**
/wallet - Connect your Solana wallet
/referral - Get your referral link & stats

**Quick Stats:**
/stats - View your activity summary

_Need help? Visit our support channel or type /support_`,
    { parse_mode: 'Markdown' }
  );
});

// Stats command
bot.command('stats', async (ctx) => {
  if (!ctx.user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.user.telegramId },
    include: {
      purchases: true,
      watchlistItems: true,
      referrals: true,
    },
  });

  if (!user) {
    await ctx.reply('Please use /start first.');
    return;
  }

  const purchaseCount = user.purchases?.length || 0;
  const watchlistCount = user.watchlistItems?.length || 0;
  const referralCount = user.referrals?.length || 0;
  const totalSpent = user.purchases?.reduce((sum, p) => sum + p.amount, 0) || 0;

  await ctx.reply(
    `📊 **Your Stats**

👤 Member since: ${user.createdAt.toLocaleDateString()}

💰 **Trading:**
• Purchases: ${purchaseCount}
• Total Spent: $${totalSpent.toFixed(2)}

👀 **Watchlist:** ${watchlistCount} cards

🔗 **Referrals:** ${referralCount} users

_Keep trading to earn more rewards!_`,
    { parse_mode: 'Markdown' }
  );
});

// Ping command (health check)
bot.command('ping', async (ctx) => {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbLatency = Date.now() - start;

  await ctx.reply(
    `🏓 **Pong!**\n\n` +
    `Bot: ✅ Online\n` +
    `Database: ✅ ${dbLatency}ms\n` +
    `Alerts: ${alertSender ? '✅ Active' : '❌ Inactive'}`,
    { parse_mode: 'Markdown' }
  );
});

// ========================
// CALLBACK QUERIES
// ========================

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');
  const category = parts[0];
  const action = parts[1];
  const params = parts.slice(2).join(':');

  logger.debug({ category, action, params }, 'Callback received');

  try {
    switch (category) {
      case 'listing':
        await handleListingCallback(ctx, action, params);
        break;

      case 'referral':
        await handleReferralCallback(ctx, action);
        break;

      case 'alerts':
        await handleAlertsCallback(ctx, action, params);
        break;

      case 'watch':
        await handleWatchCallback(ctx, action, params);
        break;

      case 'wallet':
        // Handle wallet callbacks
        if (action === 'learn') {
          await ctx.answerCallbackQuery();
          await ctx.reply(
            `💳 **What is Solana?**\n\n` +
            `Solana is a fast, low-cost blockchain.\n\n` +
            `**Getting a Wallet:**\n` +
            `1. Download Phantom (phantom.app)\n` +
            `2. Create a new wallet\n` +
            `3. Copy your address\n` +
            `4. Paste it here!\n\n` +
            `_Your wallet lets you receive rewards automatically._`,
            { parse_mode: 'Markdown' }
          );
        } else if (action === 'view') {
          await ctx.answerCallbackQuery({ text: 'Opening Solscan...' });
        } else if (action === 'disconnect') {
          await ctx.answerCallbackQuery({ text: 'Wallet disconnected' });
        }
        break;

      default:
        await ctx.answerCallbackQuery({ text: 'Unknown callback' });
    }
  } catch (error) {
    logger.error({ error, data }, 'Callback handler error');
    await ctx.answerCallbackQuery({ text: 'An error occurred' });
  }
});

// ========================
// MESSAGE HANDLERS
// ========================

// Handle potential wallet addresses
bot.on('message:text', async (ctx, next) => {
  const text = ctx.message.text.trim();

  // Check if it looks like a Solana address
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) {
    const handled = await handleWalletSubmission(ctx, text);
    if (handled) return;
  }

  return next();
});

// Default message handler
bot.on('message', async (ctx) => {
  // Only respond to direct messages, not groups
  if (ctx.chat.type === 'private') {
    await ctx.reply(
      `👋 Hey! I'm the PokeDAO trading assistant.\n\n` +
      `Try these commands:\n` +
      `/start - Get started\n` +
      `/alerts - Set up deal alerts\n` +
      `/help - See all commands`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ========================
// ERROR HANDLING
// ========================

bot.catch((err) => {
  const ctx = err.ctx;
  logger.error({ err: err.error, update: ctx.update }, 'Bot error');

  const e = err.error;

  if (e instanceof GrammyError) {
    logger.error({ code: e.error_code, description: e.description }, 'Telegram API error');
  } else if (e instanceof HttpError) {
    logger.error({ error: e }, 'HTTP error');
  } else {
    logger.error({ error: e }, 'Unknown error');
  }
});

// ========================
// STARTUP
// ========================

async function start() {
  logger.info('Starting PokeDAO bot...');

  // Test database connection
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    process.exit(1);
  }

  // Start the bot
  await bot.start({
    onStart: (botInfo) => {
      logger.info({ username: botInfo.username }, 'Bot started successfully');
      console.log(`🚀 PokeDAO bot is running!`);
      console.log(`📱 Bot: @${botInfo.username}`);
      console.log(`🔗 Link: https://t.me/${botInfo.username}`);
    },
  });
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down...');

  try {
    await bot.stop();
    logger.info('Bot stopped');

    await prisma.$disconnect();
    logger.info('Database disconnected');

    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Start the bot
start().catch((error) => {
  logger.error({ error }, 'Failed to start bot');
  process.exit(1);
});

// Export for use in alert system
export { bot, alertSender };
