/**
 * Token Gate Middleware
 *
 * Verifies user wallet holdings before allowing premium bot features.
 * Uses Solana RPC to check token balances.
 */

import { Context, MiddlewareFn } from 'grammy';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// Configuration
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const POKEDAO_TOKEN_MINT = process.env.POKEDAO_TOKEN_MINT || '';
const MIN_TOKEN_BALANCE = parseInt(process.env.MIN_TOKEN_BALANCE || '100', 10);

// Feature tiers based on token holdings
export const TOKEN_TIERS: Record<string, { min: number; features: string[] }> = {
  FREE: { min: 0, features: ['basic_alerts', 'watch', 'arbitrage'] },
  BRONZE: { min: 100, features: ['priority_alerts', 'portfolio', 'settings'] },
  SILVER: { min: 500, features: ['unlimited_alerts', 'api_access', 'webhooks'] },
  GOLD: { min: 1000, features: ['early_access', 'ai_insights', 'custom_alerts'] },
};

export type TokenTier = 'FREE' | 'BRONZE' | 'SILVER' | 'GOLD';

export interface TokenGateContext extends Context {
  tokenBalance?: number;
  tokenTier?: TokenTier;
  hasFeature?: (feature: string) => boolean;
}

// Cache token balances to avoid excessive RPC calls (TTL: 5 minutes)
const balanceCache = new Map<string, { balance: number; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get token balance for a wallet address
 */
async function getTokenBalance(walletAddress: string): Promise<number> {
  // Check cache first
  const cached = balanceCache.get(walletAddress);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.balance;
  }

  if (!POKEDAO_TOKEN_MINT) {
    logger.warn('POKEDAO_TOKEN_MINT not configured, returning 0 balance');
    return 0;
  }

  try {
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(POKEDAO_TOKEN_MINT);

    // Get token accounts for this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint });

    let balance = 0;
    for (const account of tokenAccounts.value) {
      const amount = account.account.data.parsed?.info?.tokenAmount?.uiAmount || 0;
      balance += amount;
    }

    // Cache the result
    balanceCache.set(walletAddress, {
      balance,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return balance;
  } catch (error) {
    logger.error({ error, walletAddress }, 'Failed to get token balance');
    return 0;
  }
}

/**
 * Determine token tier based on balance
 */
function getTierFromBalance(balance: number): TokenTier {
  if (balance >= TOKEN_TIERS.GOLD.min) return 'GOLD';
  if (balance >= TOKEN_TIERS.SILVER.min) return 'SILVER';
  if (balance >= TOKEN_TIERS.BRONZE.min) return 'BRONZE';
  return 'FREE';
}

/**
 * Get all features available for a tier
 */
function getFeaturesForTier(tier: TokenTier): string[] {
  const features: string[] = [];
  const tierOrder: TokenTier[] = ['FREE', 'BRONZE', 'SILVER', 'GOLD'];
  const tierIndex = tierOrder.indexOf(tier);

  for (let i = 0; i <= tierIndex; i++) {
    const tierConfig = TOKEN_TIERS[tierOrder[i]];
    if (tierConfig) {
      features.push(...tierConfig.features);
    }
  }

  return features;
}

/**
 * Token gate middleware - checks wallet balance and attaches tier info
 */
export const tokenGateMiddleware: MiddlewareFn<TokenGateContext> = async (ctx, next) => {
  if (!ctx.from) {
    return next();
  }

  const telegramId = ctx.from.id.toString();

  try {
    // Get user's wallet address
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { walletAddress: true },
    });

    let balance = 0;
    let tier: TokenTier = 'FREE';

    if (user?.walletAddress) {
      balance = await getTokenBalance(user.walletAddress);
      tier = getTierFromBalance(balance);
    }

    // Attach to context
    ctx.tokenBalance = balance;
    ctx.tokenTier = tier;
    ctx.hasFeature = (feature: string) => getFeaturesForTier(tier).includes(feature);

    logger.debug({ telegramId, balance, tier }, 'Token gate check');
  } catch (error) {
    logger.error({ error, telegramId }, 'Token gate middleware error');
    // Default to free tier on error
    ctx.tokenBalance = 0;
    ctx.tokenTier = 'FREE';
    ctx.hasFeature = (feature: string) => TOKEN_TIERS.FREE.features.includes(feature);
  }

  return next();
};

/**
 * Create a middleware that requires a specific feature
 */
export function requireFeature(feature: string): MiddlewareFn<TokenGateContext> {
  return async (ctx, next) => {
    if (!ctx.hasFeature || !ctx.hasFeature(feature)) {
      const requiredTier = Object.entries(TOKEN_TIERS).find(([_, config]) =>
        config.features.includes(feature)
      )?.[0] || 'GOLD';

      await ctx.reply(
        `**Premium Feature**\n\n` +
        `This feature requires ${requiredTier} tier access.\n\n` +
        `Your current tier: ${ctx.tokenTier || 'FREE'}\n` +
        `Token balance: ${ctx.tokenBalance || 0} PKDAO\n\n` +
        `_Connect your wallet with /wallet and hold more tokens to unlock._`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    return next();
  };
}

/**
 * Check if user has premium access (BRONZE or higher)
 */
export function isPremium(ctx: TokenGateContext): boolean {
  return ctx.tokenTier !== 'FREE';
}

/**
 * Format tier display for user
 */
export function formatTierDisplay(tier: TokenTier, balance: number): string {
  const tierEmoji: Record<TokenTier, string> = {
    FREE: '',
    BRONZE: '',
    SILVER: '',
    GOLD: '',
  };

  const nextTierMap: Record<TokenTier, { name: string; min: number } | null> = {
    FREE: { name: 'BRONZE', min: TOKEN_TIERS.BRONZE?.min || 100 },
    BRONZE: { name: 'SILVER', min: TOKEN_TIERS.SILVER?.min || 500 },
    SILVER: { name: 'GOLD', min: TOKEN_TIERS.GOLD?.min || 1000 },
    GOLD: null,
  };

  const nextTier = nextTierMap[tier];

  let display = `${tierEmoji[tier]} **${tier} Tier**\n`;
  display += `Balance: ${balance.toLocaleString()} PKDAO\n`;

  if (nextTier) {
    const needed = nextTier.min - balance;
    display += `\n_${needed.toLocaleString()} more tokens for ${nextTier.name}_`;
  } else {
    display += `\n_You have unlocked all features!_`;
  }

  return display;
}

/**
 * Clear balance cache (call when user updates wallet)
 */
export function clearBalanceCache(walletAddress: string): void {
  balanceCache.delete(walletAddress);
}
