/**
 * Price Analysis & Arbitrage Detection
 *
 * Analyzes price discrepancies across marketplaces to identify:
 * - Undervalued listings (below market average)
 * - Arbitrage opportunities (buy low on one marketplace, sell high on another)
 * - Price trends and market inefficiencies
 */

import type { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import type { UnifiedMarketListingWhereInput } from '../../prisma/generated/client/models.js';

interface ArbitrageOpportunity {
  cardName: string;
  setName: string;
  cardNumber: string;
  gradeCompany: string;
  grade: number;

  // Cheapest listing
  buySource: string;
  buyPrice: number;
  buyUrl: string;

  // Most expensive listing
  sellSource: string;
  sellPrice: number;
  sellUrl: string;

  // Analysis
  spread: number;
  spreadPercent: number;
  marketAverage: number;
  sampleSize: number;
  confidence: number;
}

export async function registerArbitrage(app: FastifyInstance) {
  /**
   * GET /api/arbitrage - Find arbitrage opportunities across marketplaces
   *
   * Query params:
   *   minSpread: Minimum price spread in cents (default: 500 = $5)
   *   minSpreadPercent: Minimum spread percentage (default: 15%)
   *   gradeCompany: Filter by grade company (PSA, BGS, CGC, etc.)
   *   minGrade: Minimum grade (e.g., 9)
   *   minSampleSize: Minimum number of listings for confidence (default: 2)
   *   limit: Max results (default: 25, max: 100)
   *
   * Example:
   *   /api/arbitrage?minSpread=1000&minSpreadPercent=20&gradeCompany=PSA&minGrade=9
   */
  app.get('/api/arbitrage', async (req, reply) => {
    try {
      const query = req.query as Record<string, string | undefined>;

      const minSpread = parseInt(query.minSpread || '500');
      const minSpreadPercent = parseFloat(query.minSpreadPercent || '15');
      const minGrade = query.minGrade ? parseFloat(query.minGrade) : undefined;
      const gradeCompany = query.gradeCompany?.toUpperCase();
      const minSampleSize = parseInt(query.minSampleSize || '2');
      const limit = Math.min(100, Math.max(1, Number(query.limit || '25')));

      // Find cards that appear on multiple marketplaces
      const cardGroups = await prisma.unifiedMarketListing.groupBy({
        by: ['cardName', 'setName', 'cardNumber', 'gradeCompany', 'grade'],
        where: {
          cardName: { not: 'Unknown' },
          setName: { not: 'Unknown' },
          priceCents: { gt: 0 },
          ...(gradeCompany ? { gradeCompany: gradeCompany as any } : {}),
          ...(minGrade ? { grade: { gte: minGrade } } : {}),
        },
        _count: { source: true },
        having: {
          source: { _count: { gte: minSampleSize } },
        },
      });

      const opportunities: ArbitrageOpportunity[] = [];

      // Analyze each card group for arbitrage opportunities
      for (const group of cardGroups) {
        // Get all listings for this card
        const listings = await prisma.unifiedMarketListing.findMany({
          where: {
            cardName: group.cardName,
            setName: group.setName,
            cardNumber: group.cardNumber || undefined,
            gradeCompany: group.gradeCompany || undefined,
            grade: group.grade || undefined,
            priceCents: { gt: 0 },
          },
          orderBy: { priceCents: 'asc' },
        });

        if (listings.length < minSampleSize) continue;

        // Calculate price statistics
        type Listing = typeof listings[number];
        const prices = listings.map((l: Listing) => l.priceCents);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
        const spread = max - min;
        const spreadPercent = (spread / min) * 100;

        // Check if this meets arbitrage criteria
        if (spread < minSpread || spreadPercent < minSpreadPercent) {
          continue;
        }

        // Find cheapest and most expensive listings
        const cheapest = listings[0];
        const mostExpensive = listings[listings.length - 1];

        // Ensure they're from different sources
        if (cheapest.source === mostExpensive.source) {
          continue;
        }

        // Calculate confidence score (0-1)
        const sampleSizeScore = Math.min(listings.length / 10, 1);
        const recencyScore = listings.filter((l: Listing) => {
          const age = Date.now() - l.updatedAt.getTime();
          return age < 7 * 24 * 60 * 60 * 1000; // Within 7 days
        }).length / listings.length;
        const confidence = (sampleSizeScore * 0.5) + (recencyScore * 0.5);

        opportunities.push({
          cardName: group.cardName || 'Unknown',
          setName: group.setName || 'Unknown',
          cardNumber: group.cardNumber || '',
          gradeCompany: group.gradeCompany || 'RAW',
          grade: group.grade || 0,
          buySource: cheapest.source,
          buyPrice: cheapest.priceCents,
          buyUrl: cheapest.url || '',
          sellSource: mostExpensive.source,
          sellPrice: mostExpensive.priceCents,
          sellUrl: mostExpensive.url || '',
          spread,
          spreadPercent: Math.round(spreadPercent * 10) / 10,
          marketAverage: Math.round(avg),
          sampleSize: listings.length,
          confidence: Math.round(confidence * 100) / 100,
        });
      }

      // Sort by spread (highest first)
      opportunities.sort((a, b) => b.spread - a.spread);

      // Apply limit
      const results = opportunities.slice(0, limit);

      return {
        ok: true,
        opportunities: results.map(opp => ({
          ...opp,
          buyPriceUsd: (opp.buyPrice / 100).toFixed(2),
          sellPriceUsd: (opp.sellPrice / 100).toFixed(2),
          spreadUsd: (opp.spread / 100).toFixed(2),
          marketAverageUsd: (opp.marketAverage / 100).toFixed(2),
        })),
        summary: {
          totalOpportunities: opportunities.length,
          displayedCount: results.length,
          totalPotentialProfit: opportunities.reduce((sum, opp) => sum + opp.spread, 0),
          totalPotentialProfitUsd: (opportunities.reduce((sum, opp) => sum + opp.spread, 0) / 100).toFixed(2),
        },
        filters: {
          minSpread,
          minSpreadPercent,
          minGrade,
          gradeCompany,
          minSampleSize,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      (app.log as any).error({ err }, 'arbitrage route error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  /**
   * GET /api/arbitrage/analyze - Detailed price analysis for a specific card
   *
   * Query params:
   *   cardName: Card name (required)
   *   setName: Set name (optional but recommended)
   *   cardNumber: Card number (optional)
   *   gradeCompany: Grade company (optional)
   *   grade: Grade value (optional)
   *
   * Example:
   *   /api/arbitrage/analyze?cardName=Charizard&setName=Base%20Set&gradeCompany=PSA&grade=9
   */
  app.get('/api/arbitrage/analyze', async (req, reply) => {
    try {
      const query = req.query as Record<string, string | undefined>;

      if (!query.cardName) {
        reply.code(400);
        return { ok: false, error: 'cardName is required' };
      }

      const where: UnifiedMarketListingWhereInput = {
        cardName: { contains: query.cardName, mode: 'insensitive' },
        priceCents: { gt: 0 },
      };

      if (query.setName) {
        where.setName = { contains: query.setName, mode: 'insensitive' };
      }

      if (query.cardNumber) {
        where.cardNumber = query.cardNumber;
      }

      if (query.gradeCompany) {
        where.gradeCompany = query.gradeCompany.toUpperCase() as any;
      }

      if (query.grade) {
        where.grade = parseFloat(query.grade);
      }

      // Get all listings matching criteria
      const listings = await prisma.unifiedMarketListing.findMany({
        where,
        orderBy: { priceCents: 'asc' },
      });

      if (listings.length === 0) {
        return {
          ok: true,
          found: false,
          message: 'No listings found matching criteria',
          query,
        };
      }

      // Calculate statistics
      type AnalyzeListing = typeof listings[number];
      const prices = listings.map((l: AnalyzeListing) => l.priceCents);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const sum = prices.reduce((a: number, b: number) => a + b, 0);
      const avg = sum / prices.length;

      // Calculate median
      const sortedPrices = [...prices].sort((a: number, b: number) => a - b);
      const median = sortedPrices.length % 2 === 0
        ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
        : sortedPrices[Math.floor(sortedPrices.length / 2)];

      // Calculate standard deviation
      const variance = prices.reduce((sum: number, price: number) => sum + Math.pow(price - avg, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);

      // Group by source
      const bySource = listings.reduce((acc: Record<string, typeof listings>, listing: AnalyzeListing) => {
        if (!acc[listing.source]) {
          acc[listing.source] = [];
        }
        acc[listing.source].push(listing);
        return acc;
      }, {} as Record<string, typeof listings>);

      // Find arbitrage opportunity
      const cheapest = listings[0];
      const mostExpensive = listings[listings.length - 1];
      let arbitrage = undefined;

      if (cheapest.source !== mostExpensive.source) {
        const profit = mostExpensive.priceCents - cheapest.priceCents;
        const profitPercent = (profit / cheapest.priceCents) * 100;

        arbitrage = {
          buyFrom: cheapest.source,
          buyPrice: cheapest.priceCents,
          buyPriceUsd: (cheapest.priceCents / 100).toFixed(2),
          buyUrl: cheapest.url,
          sellTo: mostExpensive.source,
          sellPrice: mostExpensive.priceCents,
          sellPriceUsd: (mostExpensive.priceCents / 100).toFixed(2),
          sellUrl: mostExpensive.url,
          profit,
          profitUsd: (profit / 100).toFixed(2),
          profitPercent: Math.round(profitPercent * 10) / 10,
        };
      }

      return {
        ok: true,
        found: true,
        analysis: {
          cardName: listings[0].cardName || 'Unknown',
          setName: listings[0].setName || 'Unknown',
          cardNumber: listings[0].cardNumber || undefined,
          gradeCompany: listings[0].gradeCompany || undefined,
          grade: listings[0].grade || undefined,
          listings: listings.map(l => ({
            source: l.source,
            price: l.priceCents,
            priceUsd: (l.priceCents / 100).toFixed(2),
            url: l.url || '',
            updatedAt: l.updatedAt,
          })),
          stats: {
            min,
            max,
            avg: Math.round(avg),
            median: Math.round(median),
            stdDev: Math.round(stdDev),
            count: listings.length,
            minUsd: (min / 100).toFixed(2),
            maxUsd: (max / 100).toFixed(2),
            avgUsd: (avg / 100).toFixed(2),
            medianUsd: (median / 100).toFixed(2),
            stdDevUsd: (stdDev / 100).toFixed(2),
          },
          bySource: Object.entries(bySource).map(([source, items]: [string, AnalyzeListing[]]) => ({
            source,
            count: items.length,
            avgPrice: Math.round(items.reduce((sum: number, i: AnalyzeListing) => sum + i.priceCents, 0) / items.length),
            avgPriceUsd: ((items.reduce((sum: number, i: AnalyzeListing) => sum + i.priceCents, 0) / items.length) / 100).toFixed(2),
            minPrice: Math.min(...items.map((i: AnalyzeListing) => i.priceCents)),
            minPriceUsd: (Math.min(...items.map((i: AnalyzeListing) => i.priceCents)) / 100).toFixed(2),
            maxPrice: Math.max(...items.map((i: AnalyzeListing) => i.priceCents)),
            maxPriceUsd: (Math.max(...items.map((i: AnalyzeListing) => i.priceCents)) / 100).toFixed(2),
          })),
          arbitrage,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      (app.log as any).error({ err }, 'price analysis route error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  /**
   * GET /api/arbitrage/trending - Find cards with recent price movements
   */
  app.get('/api/arbitrage/trending', async (req, reply) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const limit = Math.min(100, Math.max(1, Number(query.limit || '25')));
      const minVolatility = parseFloat(query.minVolatility || '20');

      const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const cardGroups = await prisma.unifiedMarketListing.groupBy({
        by: ['cardName', 'setName'],
        where: {
          cardName: { not: 'Unknown' },
          setName: { not: 'Unknown' },
          priceCents: { gt: 0 },
          updatedAt: { gte: recentCutoff },
        },
        _count: { id: true },
        _avg: { priceCents: true },
        _min: { priceCents: true },
        _max: { priceCents: true },
        having: {
          id: { _count: { gte: 3 } },
        },
      });

      const trending = cardGroups
        .map(group => {
          const min = group._min.priceCents || 0;
          const max = group._max.priceCents || 0;
          const avg = group._avg.priceCents || 0;

          if (min === 0 || avg === 0) return null;

          const volatility = ((max - min) / avg) * 100;

          return {
            cardName: group.cardName,
            setName: group.setName,
            listingCount: group._count.id,
            avgPrice: Math.round(avg),
            avgPriceUsd: (avg / 100).toFixed(2),
            minPrice: min,
            minPriceUsd: (min / 100).toFixed(2),
            maxPrice: max,
            maxPriceUsd: (max / 100).toFixed(2),
            volatility: Math.round(volatility * 10) / 10,
          };
        })
        .filter(Boolean)
        .filter(item => item!.volatility >= minVolatility)
        .sort((a, b) => b!.volatility - a!.volatility)
        .slice(0, limit);

      return {
        ok: true,
        trending,
        count: trending.length,
        filters: {
          minVolatility,
          lookbackDays: 7,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      (app.log as any).error({ err }, 'trending route error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });
}
