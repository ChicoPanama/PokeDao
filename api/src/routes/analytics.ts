/**
 * ANALYTICS API
 *
 * Endpoints for querying aggregated data:
 * - Card price history
 * - Signal history
 * - Market overview
 * - Thesis performance
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';

export default async function analyticsRoutes(fastify: FastifyInstance) {

  /**
   * GET /api/analytics/card/:id/history
   * Get price history for a card
   */
  fastify.get(
    '/card/:id/history',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { days?: string; source?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const days = parseInt(request.query.days || '30', 10);
      const source = request.query.source;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const where: Record<string, unknown> = {
        cardId: id,
        timestamp: { gte: startDate }
      };

      if (source) {
        where.source = source;
      }

      const snapshots = await prisma.priceSnapshot.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          timestamp: true,
          priceCents: true,
          source: true,
          listingType: true,
          condition: true,
          grade: true
        }
      });

      // Group by day for chart data
      const dailyData = new Map<string, { prices: number[]; count: number }>();
      for (const snap of snapshots) {
        const dateKey = snap.timestamp.toISOString().split('T')[0];
        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, { prices: [], count: 0 });
        }
        const day = dailyData.get(dateKey)!;
        day.prices.push(snap.priceCents);
        day.count++;
      }

      const chartData = Array.from(dailyData.entries()).map(([date, data]) => ({
        date,
        avgPrice: data.prices.reduce((a, b) => a + b, 0) / data.prices.length / 100,
        minPrice: Math.min(...data.prices) / 100,
        maxPrice: Math.max(...data.prices) / 100,
        count: data.count
      }));

      return reply.send({
        cardId: id,
        days,
        source: source || 'all',
        totalSnapshots: snapshots.length,
        chartData,
        snapshots: snapshots.slice(-100).map(s => ({
          ...s,
          price: s.priceCents / 100
        }))
      });
    }
  );

  /**
   * GET /api/analytics/card/:id/signals
   * Get signal history for a card
   */
  fastify.get(
    '/card/:id/signals',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { days?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const days = parseInt(request.query.days || '7', 10);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const signals = await prisma.signalSnapshot.findMany({
        where: {
          cardId: id,
          timestamp: { gte: startDate }
        },
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          timestamp: true,
          fairValueCents: true,
          confidenceScore: true,
          trendDirection: true,
          trendPct: true,
          liquidityScore: true,
          sentimentLabel: true,
          sentimentScore: true,
          scarcityScore: true,
          activeListings: true,
          velocity30d: true
        }
      });

      return reply.send({
        cardId: id,
        days,
        totalSignals: signals.length,
        signals: signals.map(s => ({
          ...s,
          fairValue: s.fairValueCents / 100
        }))
      });
    }
  );

  /**
   * GET /api/analytics/card/:id/stats
   * Get latest daily stats and summary for a card
   */
  fastify.get(
    '/card/:id/stats',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      // Get latest daily stats
      const latestStats = await prisma.dailyCardStats.findFirst({
        where: { cardId: id },
        orderBy: { date: 'desc' }
      });

      // Get last 7 days for trend
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const weekStats = await prisma.dailyCardStats.findMany({
        where: {
          cardId: id,
          date: { gte: weekAgo }
        },
        orderBy: { date: 'asc' }
      });

      // Get card info
      const card = await prisma.card.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          set: true,
          cardKey: true,
          grade: true
        }
      });

      // Calculate summary
      let weeklyChange = 0;
      if (weekStats.length >= 2) {
        const firstPrice = weekStats[0].avgPriceCents;
        const lastPrice = weekStats[weekStats.length - 1].avgPriceCents;
        weeklyChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
      }

      return reply.send({
        card,
        latestStats: latestStats
          ? {
              ...latestStats,
              openPrice: latestStats.openPriceCents / 100,
              closePrice: latestStats.closePriceCents / 100,
              highPrice: latestStats.highPriceCents / 100,
              lowPrice: latestStats.lowPriceCents / 100,
              avgPrice: latestStats.avgPriceCents / 100,
              medianPrice: latestStats.medianPriceCents / 100
            }
          : null,
        summary: {
          weeklyChangePct: Math.round(weeklyChange * 10) / 10,
          totalVolume7d: weekStats.reduce((sum, s) => sum + s.volume, 0),
          avgDailyVolume: weekStats.length > 0
            ? Math.round(weekStats.reduce((sum, s) => sum + s.volume, 0) / weekStats.length)
            : 0
        },
        trend: weekStats.map(s => ({
          date: s.date,
          avgPrice: s.avgPriceCents / 100,
          volume: s.volume
        }))
      });
    }
  );

  /**
   * GET /api/analytics/market/overview
   * Get latest market overview
   */
  fastify.get('/market/overview', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Get latest market stats
    const latestStats = await prisma.dailyMarketStats.findFirst({
      orderBy: { date: 'desc' }
    });

    // Get last 7 days for trend
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekStats = await prisma.dailyMarketStats.findMany({
      where: { date: { gte: weekAgo } },
      orderBy: { date: 'asc' }
    });

    // Get source breakdown
    const latestSourceStats = await prisma.dailySourceStats.findMany({
      where: { date: latestStats?.date || new Date() },
      orderBy: { snapshotCount: 'desc' }
    });

    return reply.send({
      date: latestStats?.date,
      overview: latestStats
        ? {
            totalVolume: latestStats.totalVolume,
            totalSales: latestStats.totalSaleCount,
            totalListings: latestStats.totalListingCount,
            activeCards: latestStats.activeCardCount,
            avgPriceChange: latestStats.avgPriceChangePct,
            sentimentAvg: latestStats.sentimentAvg
          }
        : null,
      topGainers: latestStats?.topGainers || [],
      topLosers: latestStats?.topLosers || [],
      sourceBreakdown: latestSourceStats.map(s => ({
        source: s.source,
        snapshots: s.snapshotCount,
        uniqueCards: s.uniqueCardCount,
        sales: s.saleCount,
        listings: s.listingCount,
        avgPrice: s.avgPriceCents / 100
      })),
      trend: weekStats.map(s => ({
        date: s.date,
        volume: s.totalVolume,
        sales: s.totalSaleCount,
        avgChange: s.avgPriceChangePct
      }))
    });
  });

  /**
   * GET /api/analytics/market/movers
   * Get top gainers and losers
   */
  fastify.get(
    '/market/movers',
    async (
      request: FastifyRequest<{
        Querystring: { limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const limit = parseInt(request.query.limit || '10', 10);

      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Get top gainers
      const gainers = await prisma.dailyCardStats.findMany({
        where: {
          date: yesterday,
          openPriceCents: { gt: 0 }
        },
        orderBy: {
          closePriceCents: 'desc'
        },
        take: limit * 2,
        include: {
          card: {
            select: {
              id: true,
              name: true,
              set: true,
              grade: true
            }
          }
        }
      });

      // Calculate change percentages and sort
      const withChange = gainers
        .map(g => ({
          ...g,
          changePct: ((g.closePriceCents - g.openPriceCents) / g.openPriceCents) * 100
        }))
        .sort((a, b) => b.changePct - a.changePct);

      const topGainers = withChange.slice(0, limit).map(g => ({
        card: g.card,
        openPrice: g.openPriceCents / 100,
        closePrice: g.closePriceCents / 100,
        changePct: Math.round(g.changePct * 10) / 10,
        volume: g.volume
      }));

      const topLosers = withChange
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, limit)
        .map(l => ({
          card: l.card,
          openPrice: l.openPriceCents / 100,
          closePrice: l.closePriceCents / 100,
          changePct: Math.round(l.changePct * 10) / 10,
          volume: l.volume
        }));

      return reply.send({
        date: yesterday,
        gainers: topGainers,
        losers: topLosers
      });
    }
  );

  /**
   * GET /api/analytics/thesis/performance
   * Get thesis accuracy metrics
   */
  fastify.get('/thesis/performance', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Group by recommendation type
    const byRecommendation = await prisma.thesisRecord.groupBy({
      by: ['recommendation'],
      _count: true
    });

    const performance = byRecommendation.map(rec => ({
      recommendation: rec.recommendation,
      totalPredictions: rec._count,
      profitableCount: 0, // Would need user outcomes data
      winRate: 0,
      avgReturnPct: 0
    }));

    // Group by thesis type (LLM vs Template)
    const byType = await prisma.thesisRecord.groupBy({
      by: ['usedLLM'],
      _count: true
    });

    const totalTheses = await prisma.thesisRecord.count();

    return reply.send({
      byRecommendation: performance,
      byType: byType.map(t => ({
        type: t.usedLLM ? 'LLM' : 'Template',
        count: t._count
      })),
      totalTheses
    });
  });
}
