/**
 * Market Commentary Routes
 *
 * AI-generated market insights and daily roundups
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';

// Type assertions for new Prisma models (run `prisma generate` after schema update)
const db = prisma as any;

const redis = getRedis();
const COMMENTARY_CACHE_KEY = 'market:commentary:latest';
const COMMENTARY_CACHE_TTL = 3600; // 1 hour

/**
 * Register market commentary routes
 */
export async function registerMarketCommentary(app: FastifyInstance) {
  /**
   * GET /api/market/commentary
   * Get latest market commentary
   */
  app.get('/api/market/commentary', async (req: FastifyRequest<{ Querystring: { type?: string } }>, reply: FastifyReply) => {
    const type = req.query.type || 'daily';

    try {
      // Check cache first
      const cached = await redis.get(`${COMMENTARY_CACHE_KEY}:${type}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get latest commentary from DB
      const commentary = await db.marketCommentary.findFirst({
        where: { type },
        orderBy: { createdAt: 'desc' },
      });

      if (!commentary) {
        return {
          message: 'No commentary available',
          type,
          generatedAt: new Date().toISOString(),
        };
      }

      const response = {
        id: commentary.id,
        type: commentary.type,
        title: commentary.title,
        content: commentary.content,
        highlights: commentary.highlights,
        topCards: commentary.topCards,
        sentiment: commentary.sentiment,
        publishedAt: commentary.publishedAt,
        createdAt: commentary.createdAt,
      };

      // Cache result
      await redis.set(`${COMMENTARY_CACHE_KEY}:${type}`, JSON.stringify(response), { EX: COMMENTARY_CACHE_TTL });

      return response;
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch market commentary',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/market/summary
   * Get quick market summary with top movers and activity
   */
  app.get('/api/market/summary', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get recent activity counts
      const last24h = new Date();
      last24h.setHours(last24h.getHours() - 24);

      const [
        recentListings,
        activeOpportunities,
        totalCards,
        topSources,
      ] = await Promise.all([
        db.listing.count({
          where: { scrapedAt: { gte: last24h } },
        }),
        db.modelInsight.count({
          where: {
            verdict: 'BUY',
            expiresAt: { gte: new Date() },
          },
        }),
        prisma.card.count(),
        db.listing.groupBy({
          by: ['source'],
          _count: { id: true },
          where: { isActive: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
      ]);

      // Get top arbitrage opportunities
      const opportunities = await prisma.$queryRaw<Array<{
        cardId: string;
        cardName: string;
        spreadPct: number;
      }>>`
        SELECT DISTINCT ON (l1.cardId)
          l1."cardId",
          c.name as "cardName",
          ROUND(((l2.price - l1.price) / l1.price * 100)::numeric, 1) as "spreadPct"
        FROM "Listing" l1
        JOIN "Listing" l2 ON l1."cardId" = l2."cardId" AND l1.id != l2.id
        JOIN "Card" c ON l1."cardId" = c.id
        WHERE l1."isActive" = true AND l2."isActive" = true
          AND l2.price > l1.price * 1.15
        ORDER BY l1."cardId", "spreadPct" DESC
        LIMIT 5
      ` as any[];

      return {
        summary: {
          newListings24h: recentListings,
          activeOpportunities,
          totalCards,
          lastUpdated: new Date().toISOString(),
        },
        topSources: topSources.map((s) => ({
          source: s.source,
          activeListings: s._count.id,
        })),
        topOpportunities: opportunities || [],
        marketSentiment: activeOpportunities > 10 ? 'active' : activeOpportunities > 5 ? 'moderate' : 'quiet',
      };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch market summary',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/market/commentary/generate
   * Generate new market commentary (internal/admin)
   */
  app.post('/api/market/commentary/generate', async (
    req: FastifyRequest<{ Body: { type?: string } }>,
    reply: FastifyReply
  ) => {
    const type = req.body.type || 'daily';

    try {
      // Get market data for commentary
      const last7d = new Date();
      last7d.setDate(last7d.getDate() - 7);

      const [
        recentOpportunities,
        topMovers,
        totalActivity,
      ] = await Promise.all([
        db.modelInsight.findMany({
          where: {
            verdict: 'BUY',
            createdAt: { gte: last7d },
          },
          orderBy: { confidence: 'desc' },
          take: 10,
        }),
        db.compSale.groupBy({
          by: ['cardId'],
          _count: { id: true },
          where: { soldAt: { gte: last7d } },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
        db.listing.count({
          where: { scrapedAt: { gte: last7d } },
        }),
      ]);

      // Generate commentary (simplified - in production use AI)
      const highlights = [
        `${totalActivity} new listings tracked this week`,
        `${recentOpportunities.length} BUY signals generated`,
        topMovers.length > 0 ? `Most active: ${topMovers.length} cards with 5+ sales` : null,
      ].filter(Boolean) as string[];

      const sentiment = recentOpportunities.length > 20 ? 'bullish' :
        recentOpportunities.length > 10 ? 'neutral' : 'cautious';

      const content = generateCommentaryContent({
        opportunities: recentOpportunities.length,
        activity: totalActivity,
        sentiment,
        type,
      });

      // Save commentary
      const commentary = await db.marketCommentary.create({
        data: {
          type,
          title: type === 'daily' ? `Daily Market Roundup - ${new Date().toLocaleDateString()}` : `Weekly Market Analysis`,
          content,
          highlights,
          topCards: topMovers.map((m) => m.cardId),
          sentiment,
          model: 'rule-based', // Would be 'deepseek' or 'mew1a' in production
        },
      });

      // Clear cache
      await redis.del(`${COMMENTARY_CACHE_KEY}:${type}`);

      return reply.code(201).send({
        ok: true,
        commentary,
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to generate commentary',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/market/commentary/history
   * Get historical commentaries
   */
  app.get('/api/market/commentary/history', async (
    req: FastifyRequest<{ Querystring: { type?: string; limit?: string } }>,
    reply: FastifyReply
  ) => {
    const type = req.query.type;
    const limit = Math.min(50, Number(req.query.limit || '10'));

    try {
      const commentaries = await db.marketCommentary.findMany({
        where: type ? { type } : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          highlights: true,
          sentiment: true,
          publishedAt: true,
          createdAt: true,
        },
      });

      return { commentaries, count: commentaries.length };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch commentary history',
        message: error.message,
      });
    }
  });
}

/**
 * Generate commentary content (template-based)
 */
function generateCommentaryContent(data: {
  opportunities: number;
  activity: number;
  sentiment: string;
  type: string;
}): string {
  const sentimentEmoji = data.sentiment === 'bullish' ? '📈' :
    data.sentiment === 'cautious' ? '📉' : '➡️';

  if (data.type === 'daily') {
    return `${sentimentEmoji} **Daily Market Update**

Today's Pokemon TCG market shows ${data.sentiment} activity with ${data.opportunities} identified opportunities.

**Key Highlights:**
- ${data.activity} new listings tracked
- ${data.opportunities} cards meeting our BUY criteria
- Market sentiment: ${data.sentiment.toUpperCase()}

${data.sentiment === 'bullish'
    ? 'Strong buying signals suggest favorable entry points for collectors and investors.'
    : data.sentiment === 'cautious'
      ? 'Mixed signals suggest patience may be prudent. Wait for clearer trends.'
      : 'Stable market conditions with moderate opportunities available.'}

_This analysis is generated automatically and should not be considered financial advice._`;
  }

  return `${sentimentEmoji} **Weekly Market Analysis**

This week in Pokemon TCG markets: ${data.sentiment} conditions prevail.

**Weekly Summary:**
- Total activity: ${data.activity} listings
- BUY signals: ${data.opportunities}
- Overall sentiment: ${data.sentiment}

${data.sentiment === 'bullish'
    ? 'Weekly trends indicate strengthening prices across multiple sets.'
    : 'Monitor closely for trend changes in the coming week.'}

_Analysis generated ${new Date().toISOString()}_`;
}
