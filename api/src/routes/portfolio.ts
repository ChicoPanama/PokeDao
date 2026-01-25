/**
 * Portfolio Management Routes
 *
 * CRUD operations for user portfolios with P&L tracking
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';

// Type assertions for new Prisma models (run `prisma generate` after schema update)
const db = prisma as any;

interface CreateHoldingBody {
  cardKey: string;
  cardName: string;
  setName?: string;
  grade?: string;
  quantity?: number;
  costBasisCents: number;
  purchaseDate?: string;
  purchaseVenue?: string;
  notes?: string;
}

interface UpdateHoldingBody {
  quantity?: number;
  costBasisCents?: number;
  notes?: string;
  soldAt?: string;
  soldPriceCents?: number;
}

/**
 * Register portfolio routes
 */
export async function registerPortfolio(app: FastifyInstance) {
  /**
   * GET /api/portfolio/:userId
   * Get user's portfolio with current values and P&L
   */
  app.get('/api/portfolio/:userId', async (req: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const { userId } = req.params;

    try {
      // Get or create portfolio
      let portfolio = await db.portfolio.findUnique({
        where: { userId },
        include: {
          holdings: {
            where: { soldAt: null }, // Only active holdings
            orderBy: { purchaseDate: 'desc' },
          },
        },
      });

      if (!portfolio) {
        portfolio = await db.portfolio.create({
          data: {
            userId,
            name: 'My Portfolio',
          },
          include: {
            holdings: true,
          },
        });
      }

      // Calculate current values from price cache
      const holdingsWithValues = await Promise.all(
        portfolio.holdings.map(async (holding) => {
          // Get current market value from PriceCache
          const priceCache = await db.priceCache.findFirst({
            where: { cardKey: holding.cardKey },
            orderBy: { updatedAt: 'desc' },
          });

          const currentValueCents = priceCache
            ? Number(priceCache.median) * 100 * holding.quantity
            : null;

          const gainLossCents = currentValueCents
            ? currentValueCents - holding.costBasisCents
            : null;

          const gainLossPct = currentValueCents && holding.costBasisCents > 0
            ? ((currentValueCents - holding.costBasisCents) / holding.costBasisCents) * 100
            : null;

          return {
            ...holding,
            costBasisUsd: (holding.costBasisCents / 100).toFixed(2),
            currentValueCents,
            currentValueUsd: currentValueCents ? (currentValueCents / 100).toFixed(2) : null,
            gainLossCents,
            gainLossUsd: gainLossCents ? (gainLossCents / 100).toFixed(2) : null,
            gainLossPct: gainLossPct ? gainLossPct.toFixed(2) : null,
            lastPriceUpdate: priceCache?.updatedAt || null,
          };
        })
      );

      // Calculate portfolio totals
      const totalCostBasisCents = holdingsWithValues.reduce((sum, h) => sum + h.costBasisCents, 0);
      const totalCurrentValueCents = holdingsWithValues.reduce(
        (sum, h) => sum + (h.currentValueCents || 0),
        0
      );
      const totalGainLossCents = totalCurrentValueCents - totalCostBasisCents;
      const totalGainLossPct = totalCostBasisCents > 0
        ? ((totalCurrentValueCents - totalCostBasisCents) / totalCostBasisCents) * 100
        : 0;

      return {
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
          createdAt: portfolio.createdAt,
          updatedAt: portfolio.updatedAt,
        },
        holdings: holdingsWithValues,
        summary: {
          totalHoldings: holdingsWithValues.length,
          totalCostBasisCents,
          totalCostBasisUsd: (totalCostBasisCents / 100).toFixed(2),
          totalCurrentValueCents,
          totalCurrentValueUsd: (totalCurrentValueCents / 100).toFixed(2),
          totalGainLossCents,
          totalGainLossUsd: (totalGainLossCents / 100).toFixed(2),
          totalGainLossPct: totalGainLossPct.toFixed(2),
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch portfolio',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/portfolio/:userId/holdings
   * Add a new holding to the portfolio
   */
  app.post('/api/portfolio/:userId/holdings', async (
    req: FastifyRequest<{ Params: { userId: string }; Body: CreateHoldingBody }>,
    reply: FastifyReply
  ) => {
    const { userId } = req.params;
    const body = req.body;

    try {
      // Get or create portfolio
      let portfolio = await db.portfolio.findUnique({
        where: { userId },
      });

      if (!portfolio) {
        portfolio = await db.portfolio.create({
          data: { userId, name: 'My Portfolio' },
        });
      }

      // Create holding
      const holding = await db.portfolioHolding.create({
        data: {
          portfolioId: portfolio.id,
          cardKey: body.cardKey,
          cardName: body.cardName,
          setName: body.setName,
          grade: body.grade,
          quantity: body.quantity || 1,
          costBasisCents: body.costBasisCents,
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
          purchaseVenue: body.purchaseVenue,
          notes: body.notes,
        },
      });

      return reply.code(201).send({
        ok: true,
        holding,
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to add holding',
        message: error.message,
      });
    }
  });

  /**
   * PATCH /api/portfolio/holdings/:holdingId
   * Update a holding (quantity, notes, mark as sold)
   */
  app.patch('/api/portfolio/holdings/:holdingId', async (
    req: FastifyRequest<{ Params: { holdingId: string }; Body: UpdateHoldingBody }>,
    reply: FastifyReply
  ) => {
    const { holdingId } = req.params;
    const body = req.body;

    try {
      const holding = await db.portfolioHolding.update({
        where: { id: holdingId },
        data: {
          ...(body.quantity !== undefined && { quantity: body.quantity }),
          ...(body.costBasisCents !== undefined && { costBasisCents: body.costBasisCents }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.soldAt && { soldAt: new Date(body.soldAt) }),
          ...(body.soldPriceCents !== undefined && { soldPriceCents: body.soldPriceCents }),
        },
      });

      return { ok: true, holding };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to update holding',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/portfolio/holdings/:holdingId
   * Remove a holding from the portfolio
   */
  app.delete('/api/portfolio/holdings/:holdingId', async (
    req: FastifyRequest<{ Params: { holdingId: string } }>,
    reply: FastifyReply
  ) => {
    const { holdingId } = req.params;

    try {
      await db.portfolioHolding.delete({
        where: { id: holdingId },
      });

      return { ok: true, deleted: holdingId };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to delete holding',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/portfolio/:userId/history
   * Get sold holdings (realized P&L history)
   */
  app.get('/api/portfolio/:userId/history', async (
    req: FastifyRequest<{ Params: { userId: string }; Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = req.params;
    const limit = Math.min(100, Number(req.query.limit || '50'));

    try {
      const portfolio = await db.portfolio.findUnique({
        where: { userId },
      });

      if (!portfolio) {
        return { soldHoldings: [], summary: { count: 0, totalRealizedGainCents: 0 } };
      }

      const soldHoldings = await db.portfolioHolding.findMany({
        where: {
          portfolioId: portfolio.id,
          soldAt: { not: null },
        },
        orderBy: { soldAt: 'desc' },
        take: limit,
      });

      const withPnL = soldHoldings.map((h) => {
        const realizedGainCents = (h.soldPriceCents || 0) - h.costBasisCents;
        const realizedGainPct = h.costBasisCents > 0
          ? (realizedGainCents / h.costBasisCents) * 100
          : 0;

        return {
          ...h,
          costBasisUsd: (h.costBasisCents / 100).toFixed(2),
          soldPriceUsd: h.soldPriceCents ? (h.soldPriceCents / 100).toFixed(2) : null,
          realizedGainCents,
          realizedGainUsd: (realizedGainCents / 100).toFixed(2),
          realizedGainPct: realizedGainPct.toFixed(2),
        };
      });

      const totalRealizedGainCents = withPnL.reduce((sum, h) => sum + h.realizedGainCents, 0);

      return {
        soldHoldings: withPnL,
        summary: {
          count: soldHoldings.length,
          totalRealizedGainCents,
          totalRealizedGainUsd: (totalRealizedGainCents / 100).toFixed(2),
        },
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch sold holdings',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/portfolio/:userId/performance
   * Get portfolio performance over time
   */
  app.get('/api/portfolio/:userId/performance', async (
    req: FastifyRequest<{ Params: { userId: string }; Querystring: { days?: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = req.params;
    const days = Math.min(365, Number(req.query.days || '30'));

    try {
      const portfolio = await db.portfolio.findUnique({
        where: { userId },
        include: {
          holdings: {
            orderBy: { purchaseDate: 'asc' },
          },
        },
      });

      if (!portfolio || portfolio.holdings.length === 0) {
        return { dataPoints: [], summary: {} };
      }

      // Generate daily data points
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dataPoints: Array<{
        date: string;
        costBasisCents: number;
        estimatedValueCents: number;
      }> = [];

      // For each day, calculate total cost basis of holdings owned at that point
      // This is a simplified version - in production you'd track actual price history
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const holdingsAtDate = portfolio.holdings.filter(
          (h) => new Date(h.purchaseDate) <= d && (!h.soldAt || new Date(h.soldAt) > d)
        );

        const costBasisCents = holdingsAtDate.reduce((sum, h) => sum + h.costBasisCents, 0);
        // Estimate value with some growth (simplified - in production use actual price data)
        const estimatedValueCents = costBasisCents; // Would fetch from historical prices

        dataPoints.push({
          date: d.toISOString().split('T')[0],
          costBasisCents,
          estimatedValueCents,
        });
      }

      return {
        dataPoints,
        summary: {
          startValue: dataPoints[0]?.costBasisCents || 0,
          endValue: dataPoints[dataPoints.length - 1]?.costBasisCents || 0,
          days,
        },
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch portfolio performance',
        message: error.message,
      });
    }
  });
}
