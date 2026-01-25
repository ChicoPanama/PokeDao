/**
 * PokeDAO Telegram Bot
 *
 * A Pokemon TCG investment assistant that:
 * - Sends deal alerts for undervalued cards
 * - Tracks user purchases and watchlists
 * - Provides investment insights
 */

// Load environment variables FIRST - before any other imports
// Config module handles loading .env from project root

import { Bot } from 'grammy';

// Import handlers
import { handleStart } from './handlers/start.js';
import { handleHelp } from './handlers/help.js';
import { handleWatch } from './handlers/watch.js';
import { handleStats } from './handlers/stats.js';
import { handleDeals, handleTestAlert } from './handlers/deals.js';
import {
  handleBoughtCallback,
  handleWatchCallback,
  handleIgnoreCallback,
} from './handlers/callbacks.js';
import { disconnect } from './lib/db.js';

// Import commands
import { alertsCommand, handleAlertsCallback } from './commands/alerts.js';
import { referralCommand, handleReferralCallback } from './commands/referral.js';
import { arbitrageCommand, handleArbitrageCallback } from './commands/arbitrage.js';
import { walletCommand, handleWalletCallback } from './commands/wallet.js';
import { portfolioCommand, handlePortfolioCallback, addHoldingCommand } from './commands/portfolio.js';
import { settingsCommand, handleSettingsCallback } from './commands/settings.js';

// Import callback handlers from other modules
import { handleListingCallback } from './callbacks/listing.js';

// Import middleware
import { rateLimitMiddleware, startRateLimitCleanup, stopRateLimitCleanup } from './middleware/rateLimit.js';
import { adminOnlyMiddleware } from './middleware/adminOnly.js';

// Validate token
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
  process.exit(1);
}

// Create bot instance
const bot = new Bot(token);

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Apply rate limiting to all updates
bot.use(rateLimitMiddleware);

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('watch', handleWatch);
bot.command('stats', handleStats);
bot.command('deals', handleDeals);

// New commands
bot.command('alerts', alertsCommand);
bot.command('referral', referralCommand);
bot.command('arbitrage', arbitrageCommand);
bot.command('wallet', walletCommand);
bot.command('portfolio', portfolioCommand);
bot.command('add_holding', addHoldingCommand);
bot.command('settings', settingsCommand);

// Admin-only commands
bot.command('test_alert', adminOnlyMiddleware, handleTestAlert);

// Simple ping for health checks
bot.command('ping', (ctx) => {
  ctx.reply('🏓 Pong! PokeDAO bot is running!');
});

// =============================================================================
// CALLBACK QUERY HANDLERS (Inline Buttons)
// =============================================================================

bot.callbackQuery(/^bought:/, handleBoughtCallback);
bot.callbackQuery(/^watch:/, handleWatchCallback);
bot.callbackQuery(/^ignore:/, handleIgnoreCallback);

// Listing callbacks (from alert buttons)
bot.callbackQuery(/^listing:(\w+):(.+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^listing:(\w+):(.+)$/);
  if (match) {
    const [, action, listingId] = match;
    await handleListingCallback(ctx as any, action, listingId);
  }
});

// Alert settings callbacks
bot.callbackQuery(/^alerts:(\w+):?(.*)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^alerts:(\w+):?(.*)$/);
  if (match) {
    const [, action, params] = match;
    await handleAlertsCallback(ctx as any, action, params || undefined);
  }
});

// Referral callbacks
bot.callbackQuery(/^referral:(\w+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^referral:(\w+)$/);
  if (match) {
    await handleReferralCallback(ctx as any, match[1]);
  }
});

// Arbitrage callbacks
bot.callbackQuery(/^arbitrage:(\w+):?(.*)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^arbitrage:(\w+):?(.*)$/);
  if (match) {
    const [, action, cardId] = match;
    await handleArbitrageCallback(ctx as any, action, cardId || undefined);
  }
});

// Wallet callbacks
bot.callbackQuery(/^wallet:(\w+):?(.*)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^wallet:(\w+):?(.*)$/);
  if (match) {
    const [, action, params] = match;
    await handleWalletCallback(ctx as any, action, params || undefined);
  }
});

// Portfolio callbacks
bot.callbackQuery(/^portfolio:(\w+):?(.*)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^portfolio:(\w+):?(.*)$/);
  if (match) {
    const [, action, params] = match;
    await handlePortfolioCallback(ctx as any, action, params || undefined);
  }
});

// Settings callbacks
bot.callbackQuery(/^settings:(\w+):?(.*)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^settings:(\w+):?(.*)$/);
  if (match) {
    const [, action, params] = match;
    await handleSettingsCallback(ctx as any, action, params || undefined);
  }
});

// Snooze callback (from any context)
bot.callbackQuery(/^snooze:(.+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^snooze:(.+)$/);
  if (match) {
    await handleListingCallback(ctx as any, 'snooze', match[1]);
  }
});

// =============================================================================
// DEFAULT HANDLERS
// =============================================================================

// Handle unknown commands
bot.on('message:text', (ctx) => {
  const text = ctx.message.text;

  if (text.startsWith('/')) {
    ctx.reply('❓ Unknown command. Try /help to see available commands.');
  } else {
    ctx.reply('👋 Hey! Use /start to get started or /help for available commands.');
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`❌ Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new updates
  bot.stop();
  console.log('📴 Stopped accepting new updates');

  // Stop rate limit cleanup interval
  stopRateLimitCleanup();

  // Wait for in-flight handlers to complete (max 5 seconds)
  console.log('⏳ Waiting for in-flight handlers to complete...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Disconnect database
  console.log('🔌 Disconnecting from database...');
  try {
    await disconnect();
    console.log('✅ Database disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting database:', error);
  }

  console.log('👋 Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// =============================================================================
// STARTUP
// =============================================================================

async function main(): Promise<void> {
  console.log('🚀 Starting PokeDAO Telegram Bot...');
  console.log('📋 Available commands:');
  console.log('   /start - Register and get welcome message');
  console.log('   /help - Show help');
  console.log('   /watch - View watchlist');
  console.log('   /stats - View purchase stats');
  console.log('   /deals - Show current top deals');
  console.log('   /alerts - Configure alert settings');
  console.log('   /arbitrage - View cross-venue arbitrage opportunities');
  console.log('   /portfolio - View portfolio and P&L');
  console.log('   /add_holding - Add card to portfolio');
  console.log('   /settings - Deep preferences');
  console.log('   /referral - Referral program and earnings');
  console.log('   /wallet - Manage connected wallet');
  console.log('   /test_alert - Send a test deal alert (admin only)');
  console.log('   /ping - Health check');
  console.log('');

  // Start background tasks
  startRateLimitCleanup();

  try {
    // Start bot
    await bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Bot started as @${botInfo.username}`);
        console.log('📱 Open Telegram and send /start to your bot');
      },
    });
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Run
main();
