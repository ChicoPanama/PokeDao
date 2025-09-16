export type OpportunityForPost = {
  cardTitle: string;
  spreadPct: number; // net percent, e.g., 17.3
  buyUrl: string;
  sellCompUrl?: string;
  rationale: string; // short paragraph
  risks: readonly string[]; // bullet points (read-only ok)
  timeWindow: string; // e.g., "Next 24–72h"
};

// Enhanced type for professional AI agent posts
export type ProfessionalOpportunityPost = {
  cardTitle: string;
  spreadPct: number;
  confidence: number; // 0-1 scale
  expectedProfitCents: number;
  compCount30d: number;
  marketCondition: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  buyUrl: string;
  sellCompUrl?: string;
  rationale: string;
  risks: readonly string[];
  timeWindow: string;
  timestamp: Date;
  trackRecordUrl?: string;
  cardValueCents?: number; // Add card value for categorization
};

// Card value tier categorization
export function getCardValueTier(cardValueCents: number): { tier: string; emoji: string; description: string } {
  const value = cardValueCents / 100; // Convert to dollars
  
  if (value >= 500000) {
    return { tier: 'GOD', emoji: '👑', description: 'Legendary' };
  } else if (value >= 100000) {
    return { tier: 'ULTRA', emoji: '🔥', description: 'Ultra-rare' };
  } else if (value >= 10000) {
    return { tier: 'MEGA', emoji: '⚡', description: 'Elite' };
  } else if (value >= 1000) {
    return { tier: 'HIGH', emoji: '🚀', description: 'Premium' };
  } else if (value >= 100) {
    return { tier: 'MEDIUM', emoji: '💎', description: 'Solid' };
  } else {
    return { tier: 'LOW', emoji: '📦', description: 'Basic' };
  }
}

export function formatOpportunityThread(o: OpportunityForPost) {
  const head = `🧩 Pokémon arbitrage: ${o.cardTitle}\nSpread: ${o.spreadPct.toFixed(1)}% (net)\n⌛ ${o.timeWindow}`;
  const why = `Why it exists:\n${o.rationale}`;
  const how = `Plan: Buy here → ${o.buyUrl}${o.sellCompUrl ? `\nExit via comps → ${o.sellCompUrl}` : ''}`;
  const risk = `Risks:\n${o.risks.map((r) => `• ${r}`).join('\n')}\nNot financial advice.`;
  return [head, why, how, risk];
}

export function formatOpportunitySingle(o: OpportunityForPost) {
  // Truncate rationale to fit in single tweet
  const maxRationaleLength = 120;
  const truncatedRationale = o.rationale.length > maxRationaleLength 
    ? o.rationale.substring(0, maxRationaleLength - 3) + '...'
    : o.rationale;
  
  // Create compact single tweet
  const tweet = `🧩 ${o.cardTitle} - ${o.spreadPct.toFixed(1)}% spread\n${truncatedRationale}\n⌛ ${o.timeWindow}\nNot financial advice.`;
  
  return [tweet];
}

export function formatOpportunityAgent(o: OpportunityForPost) {
  // Dynamic emojis based on spread percentage
  const spreadEmoji = o.spreadPct >= 15 ? '🚀' : o.spreadPct >= 10 ? '📈' : '💎';
  
  // Urgency emoji based on time window
  const urgencyEmoji = o.timeWindow.includes('24h') ? '⚡' : '⏰';
  
  // Create strong hook with emoji and alert
  const hook = `${spreadEmoji} ARBITRAGE ALERT: ${o.spreadPct.toFixed(1)}% spread detected`;
  
  // Truncate rationale more aggressively for impact
  const maxRationaleLength = 100;
  const truncatedRationale = o.rationale.length > maxRationaleLength 
    ? o.rationale.substring(0, maxRationaleLength - 3) + '...'
    : o.rationale;
  
  // Create engaging single tweet with better visual hierarchy
  const tweet = `${hook}\n\n${o.cardTitle}\n\n${truncatedRationale}\n\n${urgencyEmoji} ${o.timeWindow}\n\n⚠️ Not financial advice`;
  
  return [tweet];
}

export function formatProfessionalAgentPost(o: ProfessionalOpportunityPost) {
  // Get card value tier - estimate from comps if not provided
  const cardValue = o.cardValueCents || (o.expectedProfitCents * 3); // Rough estimate
  const valueTier = getCardValueTier(cardValue);
  
  // Dynamic emojis based on spread percentage
  const spreadEmoji = o.spreadPct >= 15 ? '🚀' : o.spreadPct >= 10 ? '📈' : '💎';
  
  // Confidence indicator
  const confidenceEmoji = o.confidence >= 0.8 ? '🎯' : o.confidence >= 0.6 ? '📊' : '⚠️';
  const confidencePct = Math.round(o.confidence * 100);
  
  // Risk level indicator
  const riskEmoji = o.riskLevel === 'LOW' ? '🟢' : o.riskLevel === 'MEDIUM' ? '🟡' : '🔴';
  
  // Market condition emoji
  const marketEmoji = o.marketCondition.includes('bull') ? '📈' : 
                     o.marketCondition.includes('bear') ? '📉' : '📊';
  
  // Urgency emoji based on time window
  const urgencyEmoji = o.timeWindow.includes('24h') ? '⚡' : '⏰';
  
  // Format timestamp (shorter format)
  const timeStr = o.timestamp.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit'
  });
  
  // Create professional hook with value tier
  const hook = `${valueTier.emoji} ${valueTier.tier} TIER ALERT: ${o.spreadPct.toFixed(1)}% spread`;
  
  // Compact metrics line with value tier
  const metrics = `${confidenceEmoji}${confidencePct}% | ${riskEmoji}${o.riskLevel} | ${marketEmoji}${o.marketCondition.split(' ')[0]} | ${valueTier.emoji}${valueTier.tier}`;
  
  // Truncate rationale for impact
  const maxRationaleLength = 60;
  const truncatedRationale = o.rationale.length > maxRationaleLength 
    ? o.rationale.substring(0, maxRationaleLength - 3) + '...'
    : o.rationale;
  
  // Compact market context with card value
  const cardValueDollars = (cardValue / 100).toFixed(0);
  const marketContext = `${o.compCount30d} sales | $${(o.expectedProfitCents / 100).toFixed(2)} profit | $${cardValueDollars} card`;
  
  // Create optimized professional single tweet
  const tweet = `${hook}\n\n${o.cardTitle}\n\n${metrics}\n\n${truncatedRationale}\n\n${marketContext}\n${urgencyEmoji} ${o.timeWindow} | ${timeStr}\n\n⚠️ Not financial advice`;
  
  return [tweet];
}