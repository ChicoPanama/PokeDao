/**
 * GET /api/ai-analysis
 *
 * Multi-model AI ensemble for institutional-grade TCG analysis
 * - Ollama Plutus: Fast local sentiment analysis
 * - DeepSeek R1: Deep quantitative investment thesis
 * - Ensemble voting with conviction scoring
 */

import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { AIEnsembleEngine, MarketSignal } from '../lib/ai-ensemble.js';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

interface AIAnalysisQuery {
  cardId: string;
}

export async function registerAIAnalysis(app: FastifyInstance) {
  const aiEngine = new AIEnsembleEngine({
    deepseekApiKey: DEEPSEEK_API_KEY,
    ollamaURL: OLLAMA_URL,
  });

  app.get<{ Querystring: AIAnalysisQuery }>(
    '/api/ai-analysis',
    {
      schema: {
        description: 'Get multi-model AI investment analysis for a card listing',
        tags: ['AI', 'Analysis'],
        querystring: {
          type: 'object',
          required: ['cardId'],
          properties: {
            cardId: { type: 'string', description: 'UnifiedMarketListing ID' },
          },
        },
      },
    },
    async (request, reply) => {
      const { cardId } = request.query;

      // Get the listing
      const listing = await prisma.unifiedMarketListing.findUnique({
        where: { id: cardId },
      });

      if (!listing || !listing.cardName) {
        return reply.code(404).send({
          ok: false,
          error: 'Listing not found',
        });
      }

      // Get market data: comparable sales and trends
      const comparables = await prisma.unifiedMarketListing.findMany({
        where: {
          cardName: listing.cardName,
          setName: listing.setName || undefined,
          gradeCompany: listing.gradeCompany || undefined,
          grade: listing.grade || undefined,
          priceCents: { gt: 0 },
          id: { not: cardId },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      if (comparables.length === 0) {
        return reply.code(400).send({
          ok: false,
          error: 'Insufficient market data for AI analysis (need at least 1 comparable)',
        });
      }

      // Calculate fair value (trimmed mean)
      const prices = comparables.map(c => c.priceCents / 100).sort((a, b) => a - b);
      const trimCount = Math.floor(prices.length * 0.1);
      const trimmedPrices = prices.slice(trimCount, prices.length - trimCount);
      const fairValue = trimmedPrices.reduce((sum, p) => sum + p, 0) / trimmedPrices.length;

      // Calculate 30-day volume
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recent30d = comparables.filter(c => c.createdAt >= thirtyDaysAgo);
      const avgVolume30d = recent30d.length;

      // Calculate price trends
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recent7d = comparables.filter(c => c.createdAt >= sevenDaysAgo);
      const recentOlder = comparables.filter(c => c.createdAt < sevenDaysAgo);

      const avg7d = recent7d.length > 0 ?
        recent7d.reduce((sum, c) => sum + (c.priceCents / 100), 0) / recent7d.length :
        fairValue;
      const avgOlder = recentOlder.length > 0 ?
        recentOlder.reduce((sum, c) => sum + (c.priceCents / 100), 0) / recentOlder.length :
        fairValue;

      const priceChange7d = avgOlder > 0 ? ((avg7d - avgOlder) / avgOlder) * 100 : 0;
      const priceChange30d = fairValue > 0 ? ((avg7d - fairValue) / fairValue) * 100 : 0;

      // Find lowest available
      const lowestAvailable = Math.min(...comparables.map(c => c.priceCents / 100));

      // Build market signal
      const signal: MarketSignal = {
        cardName: listing.cardName,
        setName: listing.setName || undefined,
        grade: listing.grade?.toString() || undefined,
        gradeCompany: listing.gradeCompany || undefined,
        listedPrice: listing.priceCents / 100,
        marketData: {
          fairValue,
          salesCount: comparables.length,
          avgVolume30d,
          priceChange7d,
          priceChange30d,
          lowestAvailable,
        },
      };

      // Run AI ensemble analysis
      const analysis = await aiEngine.analyzeCard(signal);

      return reply.code(200).send({
        ok: true,
        listing: {
          id: listing.id,
          cardName: listing.cardName,
          setName: listing.setName,
          grade: listing.grade,
          gradeCompany: listing.gradeCompany,
          listedPrice: listing.priceCents / 100,
          source: listing.source,
          url: listing.url,
        },
        marketData: signal.marketData,
        aiAnalysis: {
          recommendation: analysis.recommendation,
          convictionScore: analysis.convictionScore,
          alphaSignalStrength: analysis.alphaSignalStrength,

          // Ollama (Fast Layer)
          quickTake: {
            model: analysis.quickAnalysis.model,
            sentiment: analysis.quickAnalysis.sentiment,
            keyPoints: analysis.quickAnalysis.keyPoints,
            confidence: analysis.quickAnalysis.confidence,
            responseTimeMs: analysis.quickAnalysis.responseTime,
          },

          // DeepSeek (Deep Layer)
          deepDive: {
            model: analysis.deepAnalysis.model,
            investmentThesis: analysis.deepAnalysis.investmentThesis,
            riskFactors: analysis.deepAnalysis.riskFactors,
            catalysts: analysis.deepAnalysis.catalysts,
            priceTarget: analysis.deepAnalysis.priceTarget,
            timeHorizon: analysis.deepAnalysis.timeHorizon,
            confidence: analysis.deepAnalysis.confidence,
            responseTimeMs: analysis.deepAnalysis.responseTime,
          },

          // Ensemble Verdict
          ensemble: {
            modelAgreement: analysis.ensemble.agreementLevel,
            conflictingSignals: analysis.ensemble.conflictingSignals,
            finalVerdict: analysis.ensemble.finalVerdict,
          },

          // Unique Metrics
          advancedMetrics: {
            liquidityAdjustedFairValue: analysis.liquidityAdjustedFV,
            sellProbability: analysis.sellProbability,
            expectedDaysToSell: analysis.daysToSell,
            whaleActivityDetected: analysis.whaleActivity,
          },
        },
      });
    }
  );

  // Batch analysis endpoint for portfolio optimization
  app.post(
    '/api/ai-analysis/batch',
    {
      schema: {
        description: 'Analyze multiple cards in parallel for portfolio optimization',
        tags: ['AI', 'Analysis'],
        body: {
          type: 'object',
          required: ['cardIds'],
          properties: {
            cardIds: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 10,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { cardIds } = request.body as { cardIds: string[] };

      if (!cardIds || cardIds.length === 0) {
        return reply.code(400).send({
          ok: false,
          error: 'cardIds array required',
        });
      }

      // Analyze all cards in parallel
      const results = await Promise.allSettled(
        cardIds.map(async cardId => {
          // Reuse single-card logic
          const response = await app.inject({
            method: 'GET',
            url: `/api/ai-analysis?cardId=${cardId}`,
          });

          return response.json();
        })
      );

      const successful = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      const failed = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r, i) => ({ cardId: cardIds[i], error: r.reason }));

      // Portfolio-level insights
      const strongBuys = successful.filter(r => r.aiAnalysis?.recommendation === 'STRONG_BUY');
      const avgConviction = successful.reduce((sum, r) => sum + (r.aiAnalysis?.convictionScore || 0), 0) / successful.length;

      return reply.code(200).send({
        ok: true,
        analyzed: successful.length,
        failed: failed.length,
        results: successful,
        errors: failed,
        portfolioInsights: {
          strongBuyCount: strongBuys.length,
          avgConvictionScore: avgConviction,
          totalAlphaOpportunities: successful.filter(r => (r.aiAnalysis?.alphaSignalStrength || 0) > 50).length,
        },
      });
    }
  );
}
