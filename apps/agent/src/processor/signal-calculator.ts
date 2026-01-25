/**
 * SIGNAL CALCULATOR
 *
 * Calculates investment signals from collected data.
 * Pure TypeScript - no LLM calls.
 *
 * Signals computed:
 * - Fair Value (median of recent sales)
 * - Confidence (based on sample size)
 * - Trend (price direction over time)
 * - Liquidity (active listings, velocity)
 * - Sentiment (from Reddit data)
 * - Scarcity (PSA population)
 * - Arbitrage (cross-venue opportunities)
 */

import { Redis } from 'ioredis';

// Dynamic import for Prisma to work with ESM and Prisma 7.x
let prisma: any;
async function getPrisma(): Promise<any> {
  if (!prisma) {
    const prismaModule = await import('@prisma/client') as any;
    const PrismaClient = prismaModule.PrismaClient ?? prismaModule.default?.PrismaClient ?? prismaModule.default;
    prisma = new PrismaClient();
  }
  return prisma;
}
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface Signals {
  fairValue: number;
  confidence: number;
  trend: {
    direction: 'UP' | 'DOWN' | 'STABLE';
    percent: number;
    period: number;
  };
  liquidity: {
    score: number;
    activeListings: number;
    avgDaysOnMarket: number;
    velocity30d: number;
  };
  sentiment: {
    score: number;
    label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    postCount: number;
  };
  scarcity: {
    psa10Pop: number;
    totalPop: number;
    scarcityScore: number;
  };
  arbitrage: ArbitrageOpportunity[];
}

export interface ArbitrageOpportunity {
  buySource: string;
  buyPrice: number;
  sellSource: string;
  sellPrice: number;
  profitMargin: number;
}

export class SignalCalculator {
  /**
   * Calculate all signals for a card.
   */
  async calculate(cardId: string): Promise<Signals> {
    const [priceHistory, listings, sentiment, population] = await Promise.all([
      this.getPriceHistory(cardId),
      this.getActiveListings(cardId),
      this.getSentiment(cardId),
      this.getPopulation(cardId)
    ]);

    return {
      fairValue: this.calculateFairValue(priceHistory),
      confidence: this.calculateConfidence(priceHistory),
      trend: this.calculateTrend(priceHistory),
      liquidity: this.calculateLiquidity(listings, priceHistory),
      sentiment: this.aggregateSentiment(sentiment),
      scarcity: this.calculateScarcity(population),
      arbitrage: this.detectArbitrage(listings)
    };
  }

  /**
   * Calculate signals for a card by cardKey (normalized identifier).
   */
  async calculateByCardKey(cardKey: string): Promise<Signals> {
    const [priceHistory, listings, sentiment, population] = await Promise.all([
      this.getPriceHistoryByKey(cardKey),
      this.getActiveListingsByKey(cardKey),
      this.getSentimentByKey(cardKey),
      this.getPopulationByKey(cardKey)
    ]);

    return {
      fairValue: this.calculateFairValue(priceHistory),
      confidence: this.calculateConfidence(priceHistory),
      trend: this.calculateTrend(priceHistory),
      liquidity: this.calculateLiquidity(listings, priceHistory),
      sentiment: this.aggregateSentiment(sentiment),
      scarcity: this.calculateScarcity(population),
      arbitrage: this.detectArbitrage(listings)
    };
  }

  // ============================================================
  // DATA FETCHING
  // ============================================================

  private async getPriceHistory(cardId: string) {
    const db = await getPrisma();
    return db.priceHistory.findMany({
      where: { cardId },
      orderBy: { soldAt: 'desc' },
      take: 100
    });
  }

  private async getPriceHistoryByKey(cardKey: string) {
    const db = await getPrisma();
    return db.priceHistory.findMany({
      where: { cardKey },
      orderBy: { soldAt: 'desc' },
      take: 100
    });
  }

  private async getActiveListings(cardId: string) {
    const db = await getPrisma();
    return db.listing.findMany({
      where: { cardId, isActive: true }
    });
  }

  private async getActiveListingsByKey(cardKey: string) {
    const db = await getPrisma();
    // Find cards with this cardKey and get their listings
    const cards = await db.card.findMany({
      where: { cardKey },
      select: { id: true }
    });

    if (cards.length === 0) return [];

    return db.listing.findMany({
      where: {
        cardId: { in: cards.map((c: any) => c.id) },
        isActive: true
      }
    });
  }

  private async getSentiment(cardId: string) {
    const db = await getPrisma();
    // Get card name for Reddit search
    const card = await db.card.findUnique({
      where: { id: cardId },
      select: { name: true }
    });

    if (!card) return [];

    return this.getSentimentByName(card.name);
  }

  private async getSentimentByKey(cardKey: string) {
    // Extract card name from key
    const cardName = cardKey.split('-')[0];
    return this.getSentimentByName(cardName);
  }

  private async getSentimentByName(cardName: string) {
    // Fetch sentiment data from Redis (stored by Reddit worker)
    const sentimentData: Array<{ score: number; postCount: number }> = [];

    const subreddits = ['pokemontcg', 'pkmntcgtrades', 'PokeInvesting'];
    for (const sub of subreddits) {
      const stats = await redis.hgetall(`reddit:${sub}:stats`);
      if (stats.avgSentiment) {
        sentimentData.push({
          score: parseFloat(stats.avgSentiment),
          postCount: parseInt(stats.postCount || '0', 10)
        });
      }
    }

    return sentimentData;
  }

  private async getPopulation(cardId: string) {
    const data = await redis.hgetall(`card:${cardId}:meta`);
    if (!data.psaPop10) return null;

    return {
      psa10: parseInt(data.psaPop10 || '0', 10),
      total: parseInt(data.psaPopTotal || '0', 10)
    };
  }

  private async getPopulationByKey(cardKey: string) {
    const data = await redis.hgetall(`psa:pop:${cardKey}`);
    if (!data.psa10) return null;

    return {
      psa10: parseInt(data.psa10 || '0', 10),
      total: parseInt(data.total || '0', 10)
    };
  }

  // ============================================================
  // SIGNAL CALCULATIONS
  // ============================================================

  private calculateFairValue(priceHistory: any[]): number {
    if (priceHistory.length === 0) return 0;

    // Use median of last 10 sales (cents to dollars)
    const recent = priceHistory.slice(0, 10);
    const prices = recent.map(p => p.priceCents / 100).sort((a, b) => a - b);

    const mid = Math.floor(prices.length / 2);
    if (prices.length % 2 === 0) {
      return (prices[mid - 1] + prices[mid]) / 2;
    }
    return prices[mid];
  }

  private calculateConfidence(priceHistory: any[]): number {
    const count = priceHistory.length;

    if (count < 3) return 0.3;
    if (count < 10) return 0.6;
    if (count < 30) return 0.8;
    return 0.95;
  }

  private calculateTrend(priceHistory: any[]): Signals['trend'] {
    if (priceHistory.length < 5) {
      return { direction: 'STABLE', percent: 0, period: 30 };
    }

    // Compare recent 5 sales vs older 5 sales
    const recent = priceHistory.slice(0, 5);
    const older = priceHistory.slice(5, 10);

    const recentAvg = recent.reduce((sum, p) => sum + p.priceCents, 0) / recent.length;
    const olderAvg =
      older.length > 0 ? older.reduce((sum, p) => sum + p.priceCents, 0) / older.length : recentAvg;

    const change = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    return {
      direction: change > 5 ? 'UP' : change < -5 ? 'DOWN' : 'STABLE',
      percent: Math.round(change * 10) / 10,
      period: 30
    };
  }

  private calculateLiquidity(
    listings: any[],
    priceHistory: any[]
  ): Signals['liquidity'] {
    // Calculate 30-day velocity
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSales = priceHistory.filter(p => new Date(p.soldAt) >= thirtyDaysAgo);

    // Calculate average days on market (simplified)
    const avgDays = listings.length > 0 ? 7 : 30; // Placeholder

    return {
      score: Math.min(10, listings.length + recentSales.length / 3),
      activeListings: listings.length,
      avgDaysOnMarket: avgDays,
      velocity30d: recentSales.length
    };
  }

  private aggregateSentiment(sentimentData: any[]): Signals['sentiment'] {
    if (sentimentData.length === 0) {
      return { score: 0, label: 'NEUTRAL', postCount: 0 };
    }

    const totalPosts = sentimentData.reduce((sum, d) => sum + (d.postCount || 0), 0);
    const avgScore =
      sentimentData.reduce((sum, d) => sum + (d.score || 0) * (d.postCount || 1), 0) /
      Math.max(totalPosts, 1);

    return {
      score: avgScore,
      label: avgScore > 0.2 ? 'BULLISH' : avgScore < -0.2 ? 'BEARISH' : 'NEUTRAL',
      postCount: totalPosts
    };
  }

  private calculateScarcity(population: any): Signals['scarcity'] {
    if (!population) {
      return { psa10Pop: 0, totalPop: 0, scarcityScore: 5 };
    }

    // Lower population = higher scarcity score (1-10 scale)
    // Using log scale: 1 card = 10, 10 cards = 7, 100 cards = 4, 1000 cards = 1
    const scarcityScore = Math.max(1, 10 - Math.log10(population.psa10 + 1) * 3);

    return {
      psa10Pop: population.psa10,
      totalPop: population.total,
      scarcityScore: Math.round(scarcityScore * 10) / 10
    };
  }

  private detectArbitrage(listings: any[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    // Group listings by source
    const bySource: Record<string, number[]> = {};
    for (const listing of listings) {
      if (!bySource[listing.source]) {
        bySource[listing.source] = [];
      }
      bySource[listing.source].push(listing.price);
    }

    const sources = Object.keys(bySource);

    // Compare minimum prices between sources
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const sourceA = sources[i];
        const sourceB = sources[j];

        const minA = Math.min(...bySource[sourceA]);
        const minB = Math.min(...bySource[sourceB]);

        const margin = Math.abs(minA - minB) / Math.min(minA, minB) * 100;

        if (margin > 10) {
          // 10% minimum margin
          opportunities.push({
            buySource: minA < minB ? sourceA : sourceB,
            buyPrice: Math.min(minA, minB),
            sellSource: minA < minB ? sourceB : sourceA,
            sellPrice: Math.max(minA, minB),
            profitMargin: Math.round(margin * 10) / 10
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
  }
}

export const signalCalculator = new SignalCalculator();
