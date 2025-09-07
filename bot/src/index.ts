import { Bot } from 'grammy';
import loadAndValidateEnv from './lib/validate-env.js';

// Validate required variables for the bot
loadAndValidateEnv(['TELEGRAM_BOT_TOKEN']);

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env file');
  process.exit(1);
}

// Create the bot
const bot = new Bot(token);

// /start command
bot.command('start', (ctx) => {
  const username = ctx.from?.first_name || 'Trainer';
  ctx.reply(`🎮 Welcome to PokeDAO, ${username}! 

I'm your Pokémon card trading assistant. Here's what I can do:

📊 Monitor card prices
💰 Find investment opportunities  
🔔 Send trading alerts

Try /ping to test if I'm working!`);
});

// /ping command
bot.command('ping', (ctx) => {
  ctx.reply('🏓 Pong! PokeDAO bot is running perfectly!');
});

// Handle any other messages
bot.on('message', (ctx) => {
  ctx.reply('👋 Hey! Try /start to get started or /ping to test me out!');
});

// Error handling
bot.catch((err) => {
  console.error('❌ Bot error:', err);
});

// Start the bot
console.log('🚀 Starting PokeDAO bot...');
bot.start()
  .then(() => {
    console.log('✅ PokeDAO bot is running!');
    console.log('📱 Go to Telegram and try /start or /ping');
  })
  .catch((error) => {
    console.error('❌ Failed to start bot:', error);
  });
