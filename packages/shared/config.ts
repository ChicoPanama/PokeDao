/**
 * Centralized Configuration
 *
 * All environment variables and magic numbers should be defined here.
 * Import from @pokedao/shared for consistent config access across packages.
 */

/**
 * Get environment variable with type safety
 */
function env(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function envNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = Number(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envBoolean(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val.toLowerCase() === 'true' || val === '1';
}

/**
 * Centralized config object
 */
export const CONFIG = {
  // Alert System
  alerts: {
    minEdgeBp: envNumber('ALERT_MIN_EDGE_BP', 500), // 5% minimum edge (basis points)
    minConfidence: envNumber('ALERT_MIN_CONFIDENCE', 0.5),
    minPriceUsd: envNumber('ALERT_MIN_PRICE_USD', 50),
    maxPerHour: envNumber('ALERT_MAX_PER_HOUR', 10),
    cooldownMinutes: envNumber('ALERT_COOLDOWN_MINUTES', 15),
    watchlistDropPct: envNumber('ALERT_WATCHLIST_DROP_PCT', 15), // Min price drop % for watchlist alerts
  },

  // Cache Settings
  cache: {
    searchTtlSeconds: envNumber('CACHE_TTL_SEARCH', 900), // 15 minutes
    dealCacheTtlMs: envNumber('DEAL_CACHE_TTL_MS', 24 * 60 * 60 * 1000), // 24 hours
    preferencesTtlMs: envNumber('PREFERENCES_CACHE_TTL_MS', 5 * 60 * 1000), // 5 minutes
    cleanupIntervalMs: envNumber('CACHE_CLEANUP_INTERVAL_MS', 60 * 60 * 1000), // 1 hour
    maxCacheSize: envNumber('CACHE_MAX_SIZE', 10000),
  },

  // Rate Limiting
  rateLimit: {
    anonPerHour: envNumber('RATE_LIMIT_ANON', 10),
    authPerHour: envNumber('RATE_LIMIT_AUTH', 100),
    proPerHour: envNumber('RATE_LIMIT_PRO', 1000),
    windowMs: envNumber('RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000), // 1 hour
  },

  // Telegram Bot
  telegram: {
    token: env('TELEGRAM_BOT_TOKEN', ''),
    alertsEnabled: envBoolean('TELEGRAM_ALERTS_ENABLED', false),
    sendDelayMs: envNumber('TELEGRAM_SEND_DELAY_MS', 50), // Rate limit delay between sends
    broadcastDelayMs: envNumber('TELEGRAM_BROADCAST_DELAY_MS', 100), // Slower for broadcasts
  },

  // Pricing & Fees
  pricing: {
    minConfidence: envNumber('PRICING_MIN_CONFIDENCE', 0.7),
    purchaseFeeRate: envNumber('PURCHASE_FEE_RATE', 0.01), // 1% fee
  },

  // Referral System
  referral: {
    tier1Rate: envNumber('REFERRAL_TIER1_RATE', 0.30), // 30%
    tier2Rate: envNumber('REFERRAL_TIER2_RATE', 0.10), // 10%
    tier3Rate: envNumber('REFERRAL_TIER3_RATE', 0.05), // 5%
  },

  // Arbitrage
  arbitrage: {
    minSpreadPct: envNumber('ARBITRAGE_MIN_SPREAD_PCT', 10),
    minNetProfitUsd: envNumber('ARBITRAGE_MIN_NET_PROFIT_USD', 10),
  },

  // ML/Signal Processing
  ml: {
    nhiMinScore: envNumber('NHI_MIN_SCORE', 50), // Minimum liquidity health score
    signalExpiryHours: envNumber('SIGNAL_EXPIRY_HOURS', 24),
  },

  // Reddit Scraper
  reddit: {
    maxRetries: envNumber('REDDIT_MAX_RETRIES', 3),
    retryBackoffMs: envNumber('REDDIT_RETRY_BACKOFF_MS', 1000),
    requestTimeoutMs: envNumber('REDDIT_REQUEST_TIMEOUT_MS', 10000),
    userAgent: env('REDDIT_USER_AGENT', 'PokeDAO/1.0 (Card Price Tracker)'),
    subreddits: ['PokeInvesting', 'PokemonTCG'],
  },

  // Database
  database: {
    url: env('DATABASE_URL', ''),
    maxConnections: envNumber('DATABASE_MAX_CONNECTIONS', 10),
  },

  // Redis
  redis: {
    url: env('REDIS_URL', ''),
    keyPrefix: env('REDIS_KEY_PREFIX', 'pokedao:'),
  },

  // Agent
  agent: {
    tickIntervalMs: envNumber('AGENT_TICK_INTERVAL_MS', 5 * 60 * 1000), // 5 minutes
    smokeOnly: envBoolean('AGENT_SMOKE_ONLY', false),
  },

  // Feature Flags
  features: {
    arbitrageAlerts: envBoolean('FEATURE_ARBITRAGE_ALERTS', true),
    watchlistAlerts: envBoolean('FEATURE_WATCHLIST_ALERTS', true),
    redditSentiment: envBoolean('FEATURE_REDDIT_SENTIMENT', true),
    nhiScoring: envBoolean('FEATURE_NHI_SCORING', true),
  },
} as const;

export type Config = typeof CONFIG;
