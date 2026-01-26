/**
 * WORKER RUNNER - Production Grade
 *
 * Manages all agent workers with:
 * - Registry-based worker management
 * - Health endpoint for Kubernetes probes
 * - Graceful shutdown handling
 * - Environment-based enabling/disabling
 *
 * DATA COLLECTION WORKERS (Layer 1):
 * - eBay Worker: Collects sold listings (every 15 min)
 * - Crypto Worker: Magic Eden, Courtyard (every 5 min)
 * - Reddit Worker: Sentiment from subreddits (every hour)
 * - PSA Worker: Population data (daily at 6 AM)
 *
 * OUTPUT WORKERS (BullMQ):
 * - X Poster: Posts opportunities to X/Twitter
 * - Commentary Poster: Daily market commentary
 */

import 'dotenv/config';
import pino from 'pino';

import { registry } from './registry.js';
import { startHealthServer } from './health.js';

// Data collection workers
import { ebayWorker } from './ebay-worker.js';
import { cryptoWorker } from './crypto-worker.js';
import { redditWorker } from './reddit-worker.js';
import { psaWorker } from './psa-worker.js';
import { web2Worker } from './web2-worker.js';
import { pokemonPriceTrackerWorker } from './pokemon-price-tracker-worker.js';

// BullMQ workers
import { startXPoster } from './x-poster.js';
import { startCommentaryPoster, scheduleDailyCommentary } from './commentary-poster.js';

const logger = pino({ name: 'worker-runner' });

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const config = {
  healthPort: parseInt(process.env.WORKER_HEALTH_PORT || '3001', 10),
  dataWorkersEnabled: process.env.DATA_WORKERS_ENABLED !== 'false',
  ebayEnabled: process.env.EBAY_WORKER_ENABLED !== 'false',
  cryptoEnabled: process.env.CRYPTO_WORKER_ENABLED !== 'false',
  redditEnabled: process.env.REDDIT_WORKER_ENABLED !== 'false',
  psaEnabled: process.env.PSA_WORKER_ENABLED !== 'false',
  web2Enabled: process.env.WEB2_WORKER_ENABLED !== 'false',
  pokemonPriceTrackerEnabled: process.env.POKEMON_PRICE_TRACKER_ENABLED === 'true', // Multi-source pricing aggregator
  xPosterEnabled: process.env.X_POSTER_ENABLED !== 'false',
  commentaryEnabled: process.env.COMMENTARY_ENABLED !== 'false',
};

// ═══════════════════════════════════════════════════════════════════
// WORKER REGISTRATION
// ═══════════════════════════════════════════════════════════════════

function registerWorkers(): void {
  logger.info('Registering workers...');

  // Data Collection Workers (cron-based, using BaseWorker)
  if (config.dataWorkersEnabled) {
    registry.register(ebayWorker, config.ebayEnabled);
    registry.register(cryptoWorker, config.cryptoEnabled);
    registry.register(redditWorker, config.redditEnabled);
    registry.register(psaWorker, config.psaEnabled);
    registry.register(web2Worker, config.web2Enabled);
    registry.register(pokemonPriceTrackerWorker, config.pokemonPriceTrackerEnabled);
  }

  logger.info({
    dataWorkers: config.dataWorkersEnabled,
    ebay: config.ebayEnabled,
    crypto: config.cryptoEnabled,
    reddit: config.redditEnabled,
    psa: config.psaEnabled,
    web2: config.web2Enabled,
    pokemonPriceTracker: config.pokemonPriceTrackerEnabled,
  }, 'Data collection workers registered');
}

// ═══════════════════════════════════════════════════════════════════
// BULLMQ WORKERS
// ═══════════════════════════════════════════════════════════════════

const bullmqWorkers: any[] = [];

function startBullMQWorkers(): void {
  // X Poster
  if (config.xPosterEnabled) {
    const xWorker = startXPoster();
    bullmqWorkers.push(xWorker);
    logger.info({
      mode: process.env.POSTING_ENABLED === 'true' ? 'LIVE' : 'DRY RUN',
    }, 'X Poster started');
  }

  // Commentary Poster
  if (config.commentaryEnabled) {
    const commentaryWorker = startCommentaryPoster();
    bullmqWorkers.push(commentaryWorker);
    logger.info({
      mode: process.env.POSTING_ENABLED === 'true' ? 'LIVE' : 'DRY RUN',
    }, 'Commentary Poster started');

    // Schedule daily commentary
    scheduleDailyCommentary().catch((err) => {
      logger.warn({ error: err.message }, 'Failed to schedule daily commentary');
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  logger.info('🚀 Starting PokeDAO Agent Workers...');

  // Register and start workers
  registerWorkers();
  registry.startAll();

  // Start BullMQ workers
  startBullMQWorkers();

  // Start health server
  startHealthServer(config.healthPort);

  // Print status
  const status = registry.getStatus();
  logger.info({
    totalWorkers: status.totalWorkers,
    enabledWorkers: status.workers.filter(w => w.enabled).length,
    healthPort: config.healthPort,
  }, 'Workers initialized');

  console.log('\n📋 Worker Status:');
  console.log('');
  console.log('  DATA COLLECTION (Cron-based):');
  for (const worker of status.workers) {
    const state = worker.enabled ? 'ACTIVE' : 'DISABLED';
    console.log(`   - ${worker.name}: ${state}`);
  }
  console.log('');
  console.log('  OUTPUT (BullMQ-based):');
  console.log(`   - X Poster: ${config.xPosterEnabled ? 'ACTIVE' : 'DISABLED'}`);
  console.log(`   - Commentary Poster: ${config.commentaryEnabled ? 'ACTIVE' : 'DISABLED'}`);
  console.log('');
  console.log(`  Health endpoint: http://localhost:${config.healthPort}/health`);
  console.log('');
  console.log('Press Ctrl+C to stop\n');
}

// ═══════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, '🛑 Shutdown signal received');

  // Stop cron-based workers
  await registry.shutdownAll();

  // Stop BullMQ workers
  for (const worker of bullmqWorkers) {
    try {
      await worker.close();
    } catch (e) {
      logger.error({ error: (e as Error).message }, 'BullMQ worker close error');
    }
  }

  logger.info('👋 All workers stopped');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

// Start
main().catch((error) => {
  logger.fatal({ error: error.message }, 'Failed to start workers');
  process.exit(1);
});
