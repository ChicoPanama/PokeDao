/**
 * Alert formatting and sending service
 */

import { InlineKeyboard } from 'grammy';

export interface DealAlert {
  listingId: string;
  cardId: string;
  cardName: string;
  setName: string;
  grade?: string;
  source: string;
  listingUrl: string;
  priceCents: number;
  fairValueCents: number;
  discountPct: number;
  confidence: number;
}

/**
 * Format a deal alert message
 */
export function formatDealAlert(deal: DealAlert): string {
  const priceUsd = (deal.priceCents / 100).toFixed(2);
  const fairValueUsd = (deal.fairValueCents / 100).toFixed(2);
  const discountFormatted = deal.discountPct.toFixed(1);
  const confidencePct = (deal.confidence * 100).toFixed(0);
  
  const gradeText = deal.grade ? ` | ${deal.grade}` : '';
  
  return `🔥 *DEAL ALERT* 🔥

📦 *${escapeMarkdown(deal.cardName)}*
🎴 ${escapeMarkdown(deal.setName)}${gradeText}
🏷️ Source: ${escapeMarkdown(deal.source)}

💵 *Listed:* $${priceUsd}
📈 *Fair Value:* $${fairValueUsd}
🎯 *${discountFormatted}% BELOW FV*
⭐ Confidence: ${confidencePct}%`;
}

/**
 * Create inline keyboard for deal alert
 */
export function createDealKeyboard(deal: DealAlert): InlineKeyboard {
  return new InlineKeyboard()
    .url('🔗 Open Listing', deal.listingUrl)
    .row()
    .text('✅ Bought', `bought:${deal.listingId}`)
    .text('👁️ Watch', `watch:${deal.cardId}`)
    .text('🔕 Ignore', `ignore:${deal.listingId}`);
}

/**
 * Format a simple card info message
 */
export function formatCardInfo(card: {
  name: string;
  set: string;
  number?: string;
  grade?: string;
}): string {
  const numberText = card.number ? ` #${card.number}` : '';
  const gradeText = card.grade ? ` (${card.grade})` : '';
  return `${card.name}${numberText} - ${card.set}${gradeText}`;
}

/**
 * Format purchase confirmation
 */
export function formatPurchaseConfirmation(deal: DealAlert): string {
  const priceUsd = (deal.priceCents / 100).toFixed(2);
  return `✅ *Purchase Recorded!*

📦 ${escapeMarkdown(deal.cardName)}
💵 $${priceUsd}
🏷️ ${escapeMarkdown(deal.source)}

Good luck with your investment! 🍀`;
}

/**
 * Format watchlist add confirmation
 */
export function formatWatchlistAdded(cardName: string): string {
  return `👁️ *Added to Watchlist*

📦 ${escapeMarkdown(cardName)}

You'll receive alerts when new listings appear below fair value.`;
}

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Format welcome message for new users
 */
export function formatWelcome(firstName: string, referralCode: string): string {
  return `🎮 *Welcome to PokeDAO, ${escapeMarkdown(firstName)}\\!*

I'm your Pokémon TCG investment assistant\\. Here's what I can do:

📊 *Monitor* card prices across 9 marketplaces
💰 *Find* undervalued investment opportunities
🔔 *Alert* you when deals match your criteria
📈 *Track* your purchases and returns

*Your Commands:*
/alerts \\- Configure alert preferences
/watch \\- Manage your watchlist
/stats \\- View your trading stats
/help \\- Show all commands

*Your Referral Code:* \`${referralCode}\`
Share it to earn rewards\\!`;
}

/**
 * Format help message
 */
export function formatHelp(): string {
  return `📚 *PokeDAO Commands*

*Getting Started*
/start \\- Register and get your referral code
/help \\- Show this help message

*Alerts & Watchlist*
/alerts \\- Configure your alert preferences
/watch \\- View and manage your watchlist
/unwatch \\<card\\> \\- Remove a card from watchlist

*Trading*
/stats \\- View your purchase history
/deals \\- Show current top deals

*Settings*
/settings \\- Configure notification preferences

Need help? Contact @ChicoPanama`;
}
