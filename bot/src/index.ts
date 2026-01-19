/**
 * PokeDAO Telegram Bot
 * 
 * A Pokemon TCG investment assistant that:
 * - Sends deal alerts for undervalued cards
 * - Tracks user purchases and watchlists
 * - Provides investment insights
 */

import { Bot } from 'grammy';
import { config } from 'dotenv';

// Load environment variables
config();

// Import handlers
import { handleStart } from './handlers/start.js';
import { handleHelp } from './handlers/help.js';
import { handleWatch } from './handlers/watch.js';
import { handleStats } from './handlers/stats.js';
import { handleDeals, handleTestAlert } from './handlers/deals.js';
import { 
  handleBoughtCallback, 
  handleWatchCallback, 
  handleIgnoreCallback 
} from './handlers/callbacks.js';
import { disconnect } from './lib/db.js';

// Validate token
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
  process.exit(1);
}

// Create bot instance
const bot = new Bot(token);

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('watch', handleWatch);
bot.command('stats', handleStats);
bot.command('deals', handleDeals);
bot.command('test_alert', handleTestAlert);

// Simple ping for health checks
bot.command('ping', (ctx) => {
  ctx.reply('🏓 Pong! PokeDAO bot is running!');
});

// ============================================================================
// CALLBACK QUERY HANDLERS (Inline Buttons)
// ============================================================================

bot.callbackQuery(/^bought:/, handleBoughtCallback);
bot.callbackQuery(/^watch:/, handleWatchCallback);
bot.callbackQuery(/^ignore:/, handleIgnoreCallback);

// ============================================================================
// DEFAULT HANDLERS
// ============================================================================

// Handle unknown commands
bot.on('message:text', (ctx) => {
  const text = ctx.message.text;
  
  if (text.startsWith('/')) {
    ctx.reply(
      '❓ Unknown command. Try /help to see available commands.',
    );
  } else {
    ctx.reply(
      '👋 Hey! Use /start to get started or /help for available commands.',
    );
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`❌ Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);
});

// ============================================================================
// STARTUP
// ============================================================================

async function main() {
  console.log('🚀 Starting PokeDAO Telegram Bot...');
  console.log('📋 Available commands:');
  console.log('   /start - Register and get welcome message');
  console.log('   /help - Show help');
  console.log('   /watch - View watchlist');
  console.log('   /stats - View purchase stats');
  console.log('   /deals - Show current top deals');
  console.log('   /test_alert - Send a test deal alert');
  console.log('   /ping - Health check');
  console.log('');

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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  bot.stop();
  await disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  bot.stop();
  await disconnect();
  process.exit(0);
});

// Run
main();
