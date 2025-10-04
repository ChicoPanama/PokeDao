import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PriceHistoryQuery {
  cardName?: string;
  setName?: string;
  grade?: string;
  gradeCompany?: string;
  source?: string;
  days?: string;
  limit?: string;
}

interface PriceTrendQuery {
  cardName: string;
  setName?: string;
  grade?: string;
  gradeCompany?: string;
}

/**
 * Register price history routes
 */
export async function registerPriceHistory(app: FastifyInstance) {
  /**
   * GET /api/price-history
   * Get historical sold prices for cards
   */
  app.get('/api/price-history', async (req: FastifyRequest<{ Querystring: PriceHistoryQuery }>, reply: FastifyReply) => {
    const {
      cardName,
      setName,
      grade,
      gradeCompany,
      source = 'EBAY',
      days = '90',
      limit = '1000',
    } = req.query;

    try {
      // Build where clause
      const where: any = {
        source: source.toUpperCase(),
      };

      // Time range filter
      const daysAgo = parseInt(days);
      if (daysAgo > 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        where.soldAt = {
          gte: startDate,
        };
      }

      // Card filters - join with Card table
      const cardFilters: any = {};
      if (cardName) {
        cardFilters.name = {
          contains: cardName,
          mode: 'insensitive' as const,
        };
      }
      if (setName) {
        cardFilters.CardSet = {
          name: {
            contains: setName,
            mode: 'insensitive' as const,
          },
        };
      }

      // Grade filters
      if (grade) {
        where.grade = grade;
      }
      if (gradeCompany) {
        cardFilters.grade = {
          contains: gradeCompany,
          mode: 'insensitive' as const,
        };
      }

      // Execute query
      const sales = await prisma.compSale.findMany({
        where: {
          ...where,
          Card: cardFilters,
        },
        include: {
          Card: {
            include: {
              CardSet: true,
            },
          },
        },
        orderBy: {
          soldAt: 'desc',
        },
        take: parseInt(limit),
      });

      // Calculate statistics
      const prices = sales.map(s => s.priceCents);
      const stats = {
        count: sales.length,
        avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        medianPrice: prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0,
      };

      // Calculate trend (compare first half vs second half)
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (sales.length >= 10) {
        const mid = Math.floor(sales.length / 2);
        const recentAvg = sales.slice(0, mid).reduce((sum, s) => sum + s.priceCents, 0) / mid;
        const olderAvg = sales.slice(mid).reduce((sum, s) => sum + s.priceCents, 0) / (sales.length - mid);
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (change > 5) trend = 'up';
        else if (change < -5) trend = 'down';
      }

      return {
        sales: sales.map(sale => ({
          id: sale.id,
          cardName: sale.Card.name,
          setName: sale.Card.CardSet.name,
          grade: sale.grade,
          condition: sale.condition,
          priceCents: sale.priceCents,
          priceUsd: (sale.priceCents / 100).toFixed(2),
          soldAt: sale.soldAt,
          source: sale.source,
          isVerified: sale.isVerified,
        })),
        stats: {
          ...stats,
          avgPriceUsd: (stats.avgPrice / 100).toFixed(2),
          minPriceUsd: (stats.minPrice / 100).toFixed(2),
          maxPriceUsd: (stats.maxPrice / 100).toFixed(2),
          medianPriceUsd: (stats.medianPrice / 100).toFixed(2),
        },
        trend,
        query: {
          cardName,
          setName,
          grade,
          gradeCompany,
          source,
          days: daysAgo,
        },
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch price history',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/price-history/trend
   * Get price trend analysis for a specific card
   */
  app.get('/api/price-history/trend', async (req: FastifyRequest<{ Querystring: PriceTrendQuery }>, reply: FastifyReply) => {
    const { cardName, setName, grade, gradeCompany } = req.query;

    if (!cardName) {
      return reply.code(400).send({
        error: 'Missing required parameter: cardName',
      });
    }

    try {
      // Get last 90 days of sales
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const cardFilters: any = {
        name: {
          contains: cardName,
          mode: 'insensitive' as const,
        },
      };

      if (setName) {
        cardFilters.CardSet = {
          name: {
            contains: setName,
            mode: 'insensitive' as const,
          },
        };
      }

      const where: any = {
        source: 'EBAY',
        soldAt: {
          gte: startDate,
        },
        Card: cardFilters,
      };

      if (grade) {
        where.grade = grade;
      }

      const sales = await prisma.compSale.findMany({
        where,
        include: {
          Card: {
            include: {
              CardSet: true,
            },
          },
        },
        orderBy: {
          soldAt: 'asc',
        },
      });

      if (sales.length === 0) {
        return {
          message: 'No sales data found for this card',
          query: { cardName, setName, grade, gradeCompany },
        };
      }

      // Group by week for trend analysis
      const weeklyData: Record<string, { prices: number[]; count: number }> = {};
      sales.forEach(sale => {
        const weekKey = getWeekKey(new Date(sale.soldAt));
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { prices: [], count: 0 };
        }
        weeklyData[weekKey].prices.push(sale.priceCents);
        weeklyData[weekKey].count++;
      });

      const weeks = Object.keys(weeklyData).sort();
      const trendData = weeks.map(week => {
        const data = weeklyData[week];
        const avg = data.prices.reduce((a, b) => a + b, 0) / data.count;
        return {
          week,
          avgPrice: Math.round(avg),
          avgPriceUsd: (avg / 100).toFixed(2),
          saleCount: data.count,
          minPrice: Math.min(...data.prices),
          maxPrice: Math.max(...data.prices),
        };
      });

      // Calculate overall trend
      let trendDirection: 'up' | 'down' | 'stable' = 'stable';
      let trendStrength = 0;

      if (weeks.length >= 2) {
        const firstWeekAvg = trendData[0].avgPrice;
        const lastWeekAvg = trendData[trendData.length - 1].avgPrice;
        const change = ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;
        trendStrength = Math.abs(change);

        if (change > 5) trendDirection = 'up';
        else if (change < -5) trendDirection = 'down';
      }

      // Price prediction (simple linear regression)
      let nextWeekPrediction = null;
      if (weeks.length >= 3) {
        const prices = trendData.map(d => d.avgPrice);
        const n = prices.length;
        const sumX = (n * (n + 1)) / 2;
        const sumY = prices.reduce((a, b) => a + b, 0);
        const sumXY = prices.reduce((sum, price, i) => sum + price * (i + 1), 0);
        const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        nextWeekPrediction = Math.round(slope * (n + 1) + intercept);
      }

      return {
        card: {
          name: sales[0].Card.name,
          set: sales[0].Card.CardSet.name,
          grade: grade || 'Any',
          gradeCompany: gradeCompany || 'Any',
        },
        stats: {
          totalSales: sales.length,
          dataPoints: weeks.length,
          dateRange: {
            from: sales[0].soldAt,
            to: sales[sales.length - 1].soldAt,
          },
        },
        trend: {
          direction: trendDirection,
          strength: trendStrength.toFixed(1) + '%',
          prediction: nextWeekPrediction ? {
            nextWeekAvgPrice: nextWeekPrediction,
            nextWeekAvgPriceUsd: (nextWeekPrediction / 100).toFixed(2),
            confidence: weeks.length >= 8 ? 'high' : weeks.length >= 4 ? 'medium' : 'low',
          } : null,
        },
        weeklyData: trendData,
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to analyze price trend',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/price-history/top-movers
   * Get cards with the biggest price changes
   */
  app.get('/api/price-history/top-movers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get sales from last 90 days, grouped by card
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const sales = await prisma.compSale.findMany({
        where: {
          source: 'EBAY',
          soldAt: {
            gte: startDate,
          },
        },
        include: {
          Card: {
            include: {
              CardSet: true,
            },
          },
        },
        orderBy: {
          soldAt: 'asc',
        },
      });

      // Group by cardId
      const cardData: Record<string, any[]> = {};
      sales.forEach(sale => {
        if (!cardData[sale.cardId]) {
          cardData[sale.cardId] = [];
        }
        cardData[sale.cardId].push(sale);
      });

      // Calculate price changes for each card
      const movers = Object.entries(cardData)
        .filter(([_, sales]) => sales.length >= 5) // Need at least 5 sales
        .map(([cardId, sales]) => {
          const mid = Math.floor(sales.length / 2);
          const recentAvg = sales.slice(0, mid).reduce((sum, s) => sum + s.priceCents, 0) / mid;
          const olderAvg = sales.slice(mid).reduce((sum, s) => sum + s.priceCents, 0) / (sales.length - mid);
          const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

          return {
            cardId,
            cardName: sales[0].Card.name,
            setName: sales[0].Card.CardSet.name,
            salesCount: sales.length,
            oldAvgPrice: Math.round(olderAvg),
            newAvgPrice: Math.round(recentAvg),
            changePercent: Math.round(changePercent * 10) / 10,
            changeAmount: Math.round(recentAvg - olderAvg),
          };
        })
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 20);

      return {
        topGainers: movers.filter(m => m.changePercent > 0).slice(0, 10).map(m => ({
          ...m,
          oldAvgPriceUsd: (m.oldAvgPrice / 100).toFixed(2),
          newAvgPriceUsd: (m.newAvgPrice / 100).toFixed(2),
          changeAmountUsd: (m.changeAmount / 100).toFixed(2),
        })),
        topLosers: movers.filter(m => m.changePercent < 0).slice(0, 10).map(m => ({
          ...m,
          oldAvgPriceUsd: (m.oldAvgPrice / 100).toFixed(2),
          newAvgPriceUsd: (m.newAvgPrice / 100).toFixed(2),
          changeAmountUsd: (m.changeAmount / 100).toFixed(2),
        })),
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch top movers',
        message: error.message,
      });
    }
  });
}

/**
 * Helper: Get ISO week key (YYYY-WW) for a date
 */
function getWeekKey(date: Date): string {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}
