import { InlineKeyboard } from 'grammy';
import { buildAlertKeyboard } from '../callbacks/listing.js';

export interface DealAlertData {
  listingId: string;
  cardId?: string;
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
  // New fields for enhanced alerts
  sentiment?: {
    overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    score: number;
    discussionVolume: number;
  };
  liquidity?: {
    nhiScore: number;
    level: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  pricingTier?: {
    tier: 'Direct Price' | 'Exact Comps' | 'Similar Cards' | 'Estimated';
    confidence: number;
  };
  variants?: string[]; // ['1st Ed', 'Holo', etc.]
}

export interface ArbitrageAlertData {
  cardId: string;
  cardName: string;
  setName: string;
  grade?: string;
  buyVenue: string;
  buyPrice: number;
  sellVenue: string;
  sellPrice: number;
  spreadPct: number;
  netProfitUsd: number;
  buyUrl?: string;
  sellUrl?: string;
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

  // Build variant string
  const variantStr = data.variants && data.variants.length > 0
    ? ` (${data.variants.join(', ')})`
    : '';

  let text = `${discountEmoji} **DEAL ALERT**

📦 **${data.cardName}**${variantStr}
📚 ${data.setName}${data.number ? ` #${data.number}` : ''}${data.grade ? ` • ${data.grade}` : ''}
🏪 ${data.source}

💰 **Listed:** $${formatPrice(data.priceUsd)}
📊 **Fair Value:** $${formatPrice(data.fairValueUsd)}
📉 **Discount:** ${data.discountPct.toFixed(1)}%
⭐ **Confidence:** ${confidenceBars} ${(data.confidence * 100).toFixed(0)}%`;

  // Add pricing tier info
  if (data.pricingTier) {
    text += `\n📊 **Pricing:** ${data.pricingTier.tier} (${(data.pricingTier.confidence * 100).toFixed(0)}% conf)`;
  }

  // Add liquidity info
  if (data.liquidity) {
    const liquidityEmoji = {
      HIGH: '💧💧💧',
      MEDIUM: '💧💧',
      LOW: '💧',
    }[data.liquidity.level];
    text += `\n${liquidityEmoji} **Liquidity:** ${data.liquidity.level}`;
  }

  // Add sentiment info
  if (data.sentiment) {
    const sentimentEmoji = {
      BULLISH: '📈',
      BEARISH: '📉',
      NEUTRAL: '➡️',
    }[data.sentiment.overall];
    text += `\n${sentimentEmoji} **Reddit:** ${data.sentiment.overall} (${data.sentiment.discussionVolume} posts)`;
  }

  text += `

${ratingEmoji} **${data.thesis.rating}**
💡 ${data.thesis.reasoning}`;

  if (data.thesis.riskFactors && data.thesis.riskFactors.length > 0) {
    text += `\n\n⚠️ _Risks: ${data.thesis.riskFactors.join(', ')}_`;
  }

  const keyboard = buildAlertKeyboard(data.listingId);

  return { text, keyboard };
}

/**
 * Format an arbitrage alert for cross-venue opportunities
 */
export function formatArbitrageAlert(data: ArbitrageAlertData): {
  text: string;
  keyboard: InlineKeyboard;
} {
  const formatPrice = (n: number) => n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const text = `⚡ **ARBITRAGE OPPORTUNITY**

📦 **${data.cardName}**
📚 ${data.setName}${data.grade ? ` • ${data.grade}` : ''}

🛒 **Buy on ${data.buyVenue}:** $${formatPrice(data.buyPrice)}
💵 **Sell on ${data.sellVenue}:** $${formatPrice(data.sellPrice)}

📊 **Spread:** +${data.spreadPct.toFixed(1)}%
💰 **Est. Profit:** $${formatPrice(data.netProfitUsd)}

_Note: Fees and shipping not included in estimate._`;

  const keyboard = new InlineKeyboard();
  if (data.buyUrl) {
    keyboard.url('🛒 Buy Link', data.buyUrl);
  }
  if (data.sellUrl) {
    keyboard.url('💵 Sell Link', data.sellUrl);
  }
  keyboard.row().text('😴 Snooze', `snooze:${data.cardId}`);

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
  arbitrageOpportunities?: number;
}): string {
  const topDealsText = data.topDeals
    .map((d, i) => `${i + 1}. ${d.cardName} - ${d.discountPct.toFixed(0)}% off (${d.rating})`)
    .join('\n');

  let text = `📊 **Daily Summary**

🔍 **Deals Found:** ${data.dealsFound}
📉 **Avg Discount:** ${data.avgDiscount.toFixed(1)}%`;

  if (data.arbitrageOpportunities !== undefined && data.arbitrageOpportunities > 0) {
    text += `\n⚡ **Arbitrage Opportunities:** ${data.arbitrageOpportunities}`;
  }

  text += `

🔥 **Top Deals Today:**
${topDealsText || '_No significant deals today_'}

_Configure alerts with /alerts_`;

  return text;
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
