/**
 * Worker Runner - Starts all agent workers
 *
 * Workers:
 * - X Poster: Posts opportunities to X/Twitter
 * - Commentary Poster: Daily market commentary
 *
 * Note: Alert Bridge only queues to Redis - the bot consumes from the queue.
 */

import { startXPoster } from './x-poster.js';
import { startCommentaryPoster, scheduleDailyCommentary } from './commentary-poster.js';

console.log('🚀 Starting PokeDAO Agent Workers...');

// Track workers for graceful shutdown
const workers: any[] = [];

// Start X Poster
const xWorker = startXPoster();
workers.push(xWorker);
console.log('✅ X Poster started');

// Start Commentary Poster
const commentaryWorker = startCommentaryPoster();
workers.push(commentaryWorker);
console.log('✅ Commentary Poster started');

// Schedule daily commentary (runs at startup, deduped by date)
scheduleDailyCommentary().catch((err) => {
  console.warn('⚠️ Failed to schedule daily commentary:', err.message);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down workers...`);

  for (const worker of workers) {
    try {
      await worker.close();
    } catch (e) {
      console.error('Worker close error:', e);
    }
  }

  console.log('👋 Workers stopped');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('\n📋 Workers running:');
console.log(`   - X Poster: ${process.env.POSTING_ENABLED === 'true' ? 'LIVE' : 'DRY RUN'} mode`);
console.log(`   - Commentary Poster: ${process.env.POSTING_ENABLED === 'true' ? 'LIVE' : 'DRY RUN'} mode`);
console.log('\nAlerts are queued to Redis - the bot consumes from telegram:alerts queue');
console.log('Daily market commentary is auto-scheduled');
console.log('\nPress Ctrl+C to stop\n');
