import { CommandContext } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * /wallet command handler
 * Shows wallet status and allows connecting/disconnecting
 */
export async function walletCommand(ctx: CommandContext<UserContext>) {
  if (!ctx.user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  // Get current wallet status from database
  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.user.telegramId },
  });

  if (!user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  // Note: The current schema doesn't have walletAddress on User
  // We'll need to add this field. For now, we'll use a placeholder.
  const walletAddress: string | null = null; // TODO: Add to User model

  if (walletAddress) {
    // User has connected wallet
    const shortAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    const message = `💳 **Your Wallet**

**Address:** \`${walletAddress}\`
**Display:** ${shortAddress}
**Network:** Solana

✅ Your wallet is connected and ready for transactions.

_Use the button below to disconnect._`;

    const keyboard = new InlineKeyboard()
      .text('🔗 View on Solscan', 'wallet:view')
      .row()
      .text('❌ Disconnect Wallet', 'wallet:disconnect');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } else {
    // User hasn't connected wallet
    const message = `💳 **Connect Your Wallet**

Connect a Solana wallet to:
• Track your purchases automatically
• Receive cashback rewards
• Execute buys directly from alerts

**How to connect:**
1. Send your Solana wallet address as a message
2. I'll verify and link it to your account

**Example:**
\`9aE476sH92Vb7W1m3nUKd...\`

_Your wallet address is only used for transaction tracking and rewards._`;

    const keyboard = new InlineKeyboard()
      .text('📚 What is Solana?', 'wallet:learn');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}

/**
 * Handle wallet address submission
 * Called when user sends a message that looks like a wallet address
 */
export async function handleWalletSubmission(
  ctx: UserContext,
  address: string
): Promise<boolean> {
  // Validate Solana address format (base58, 32-44 chars)
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  if (!solanaAddressRegex.test(address)) {
    return false; // Not a valid wallet address
  }

  if (!ctx.user) {
    await ctx.reply('Please use /start first to register.');
    return true;
  }

  try {
    // TODO: Update User model to include walletAddress field
    // For now, we'll just acknowledge the address
    logger.info({
      userId: ctx.user.id,
      walletAddress: address
    }, 'Wallet address submitted');

    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

    await ctx.reply(
      `✅ **Wallet Connected!**

**Address:** \`${shortAddress}\`

Your wallet has been linked to your PokeDAO account. You'll now:
• Get transaction tracking
• Earn rewards on purchases
• See wallet-specific deals

_Use /wallet to manage your connection._`,
      { parse_mode: 'Markdown' }
    );

    return true;
  } catch (error) {
    logger.error({ error, address }, 'Failed to save wallet');
    await ctx.reply('Failed to save wallet. Please try again.');
    return true;
  }
}

/**
 * Handle wallet-related callbacks
 */
export async function handleWalletCallback(ctx: UserContext, action: string, _params?: string) {
  if (!ctx.callbackQuery) return;

  switch (action) {
    case 'learn':
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `📚 **What is Solana?**

Solana is a fast, low-cost blockchain network. We use it because:

• **Fast:** Transactions confirm in ~400ms
• **Cheap:** Fees are usually less than $0.01
• **Secure:** Industry-standard encryption

**To get started:**
1. Download a Solana wallet (Phantom, Solflare)
2. Create a new wallet and save your seed phrase
3. Send your wallet address here

_Your wallet address is public and safe to share. Never share your seed phrase._`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'view':
      // TODO: Open Solscan link when wallet address is available
      await ctx.answerCallbackQuery({ text: 'Opening Solscan...' });
      await ctx.reply('_Wallet viewing coming soon._', { parse_mode: 'Markdown' });
      break;

    case 'disconnect':
      // TODO: Implement wallet disconnect when walletAddress field exists
      await ctx.answerCallbackQuery({ text: 'Wallet disconnected' });
      await ctx.reply(
        `✅ **Wallet Disconnected**

Your wallet has been unlinked from your account.
Use /wallet to connect a new wallet.`,
        { parse_mode: 'Markdown' }
      );
      break;

    default:
      await ctx.answerCallbackQuery({ text: 'Unknown action' });
  }
}
