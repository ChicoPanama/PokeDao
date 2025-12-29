import { InlineKeyboard } from 'grammy';
import { buildAlertKeyboard } from '../callbacks/listing.js';

export interface DealAlertData {
  listingId: string;
  cardName: string;
  setName: string;
  number?: string;
  grade?: string;
  source: string;
  priceUsd: number;
  fairValueUsd: number;
  discountPct: number;
  confidence: number;
  thesis: {
    rating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'PASS';
    reasoning: string;
    riskFactors?: string[];
  };
  listingUrl: string;
  imageUrl?: string;
}

/**
 * Format a deal alert message for Telegram
 */
export function formatDealAlert(data: DealAlertData): {
  text: string;
  keyboard: InlineKeyboard;
} {
  const ratingEmoji = {
    STRONG_BUY: '🔥',
    BUY: '✅',
    HOLD: '⏸️',
    PASS: '⏭️',
  }[data.thesis.rating];

  const discountEmoji = data.discountPct >= 20 ? '🚨' : data.discountPct >= 15 ? '📉' : '📊';

  // Confidence visualization
  const confidenceBars = '█'.repeat(Math.round(data.confidence * 5)) +
    '░'.repeat(5 - Math.round(data.confidence * 5));

  // Format price with commas
  const formatPrice = (n: number) => n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const text = `${discountEmoji} **DEAL ALERT**

📦 **${data.cardName}**
📚 ${data.setName}${data.number ? ` #${data.number}` : ''}${data.grade ? ` • ${data.grade}` : ''}
🏪 ${data.source}

💰 **Listed:** $${formatPrice(data.priceUsd)}
📊 **Fair Value:** $${formatPrice(data.fairValueUsd)}
📉 **Discount:** ${data.discountPct.toFixed(1)}%
⭐ **Confidence:** ${confidenceBars} ${(data.confidence * 100).toFixed(0)}%

${ratingEmoji} **${data.thesis.rating}**
💡 ${data.thesis.reasoning}${data.thesis.riskFactors && data.thesis.riskFactors.length > 0
      ? `\n\n⚠️ _Risks: ${data.thesis.riskFactors.join(', ')}_`
      : ''
    }`;

  const keyboard = buildAlertKeyboard(data.listingId);

  return { text, keyboard };
}

/**
 * Format a price drop alert for watched cards
 */
export function formatPriceDropAlert(data: {
  cardName: string;
  setName: string;
  grade?: string;
  oldPrice: number;
  newPrice: number;
  dropPct: number;
  listingUrl: string;
  listingId: string;
}): { text: string; keyboard: InlineKeyboard } {
  const text = `👀 **WATCHLIST ALERT**

📦 **${data.cardName}**
📚 ${data.setName}${data.grade ? ` • ${data.grade}` : ''}

💰 **Price Drop Detected!**
~~$${data.oldPrice.toFixed(2)}~~ → **$${data.newPrice.toFixed(2)}**
📉 Down ${data.dropPct.toFixed(1)}%

_This card is on your watchlist._`;

  const keyboard = buildAlertKeyboard(data.listingId);

  return { text, keyboard };
}

/**
 * Format a daily summary message
 */
export function formatDailySummary(data: {
  dealsFound: number;
  avgDiscount: number;
  topDeals: Array<{
    cardName: string;
    discountPct: number;
    rating: string;
  }>;
}): string {
  const topDealsText = data.topDeals
    .map((d, i) => `${i + 1}. ${d.cardName} - ${d.discountPct.toFixed(0)}% off (${d.rating})`)
    .join('\n');

  return `📊 **Daily Summary**

🔍 **Deals Found:** ${data.dealsFound}
📉 **Avg Discount:** ${data.avgDiscount.toFixed(1)}%

🔥 **Top Deals Today:**
${topDealsText || '_No significant deals today_'}

_Configure alerts with /alerts_`;
}

/**
 * Format an error/info message
 */
export function formatInfoMessage(type: 'error' | 'info' | 'success', message: string): string {
  const emoji = {
    error: '❌',
    info: 'ℹ️',
    success: '✅',
  }[type];

  return `${emoji} ${message}`;
}
