/**
 * Card Procedures
 *
 * tRPC procedures for querying cards and pricing data.
 */

import { z } from 'zod';
import { router, loggedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

// ============================================================================
// Input Schemas
// ============================================================================

const CardSearchSchema = z.object({
  query: z.string().min(1).max(200),
  set: z.string().optional(),
  grade: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

const CardIdSchema = z.string().min(1);

const PriceHistorySchema = z.object({
  cardId: z.string(),
  days: z.number().min(1).max(365).default(30),
  source: z.string().optional(),
});

// ============================================================================
// Router
// ============================================================================

export const cardsRouter = router({
  /**
   * Search cards by name
   */
  search: loggedProcedure
    .input(CardSearchSchema)
    .query(async ({ input, ctx }) => {
      const where: any = {
        OR: [
          { name: { contains: input.query, mode: 'insensitive' } },
          { normalizedName: { contains: input.query, mode: 'insensitive' } },
        ],
      };

      if (input.set) {
        where.set = input.set;
      }

      if (input.grade) {
        where.grade = input.grade;
      }

      return ctx.prisma.card.findMany({
        where,
        take: input.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          set: true,
          number: true,
          variant: true,
          grade: true,
          condition: true,
        },
      });
    }),

  /**
   * Get card by ID with full details
   */
  getById: loggedProcedure
    .input(CardIdSchema)
    .query(async ({ input, ctx }) => {
      const card = await ctx.prisma.card.findUnique({
        where: { id: input },
        include: {
          compSales: {
            orderBy: { soldAt: 'desc' },
            take: 10,
          },
          listings: {
            where: { isActive: true },
            orderBy: { price: 'asc' },
            take: 10,
          },
          signals: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Card ${input} not found`,
        });
      }

      return card;
    }),

  /**
   * Get price history for a card
   */
  priceHistory: loggedProcedure
    .input(PriceHistorySchema)
    .query(async ({ input, ctx }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const where: any = {
        cardId: input.cardId,
        soldAt: { gte: since },
      };

      if (input.source) {
        where.source = input.source;
      }

      const sales = await ctx.prisma.compSale.findMany({
        where,
        orderBy: { soldAt: 'asc' },
        select: {
          priceCents: true,
          soldAt: true,
          source: true,
          condition: true,
          grade: true,
        },
      });

      // Calculate aggregates
      const prices = sales.map((s) => s.priceCents);
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      return {
        sales,
        stats: {
          count: sales.length,
          avgPriceCents: Math.round(avgPrice),
          minPriceCents: minPrice,
          maxPriceCents: maxPrice,
        },
      };
    }),

  /**
   * Get canonical card with consensus pricing
   */
  getCanonical: loggedProcedure
    .input(CardIdSchema)
    .query(async ({ input, ctx }) => {
      const card = await ctx.prisma.canonicalCard.findUnique({
        where: { id: input },
        include: {
          consensusPricing: {
            orderBy: { lastUpdated: 'desc' },
            take: 5,
          },
          cardSignals: true,
          officialCard: true,
        },
      });

      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Canonical card ${input} not found`,
        });
      }

      return card;
    }),

  /**
   * Get market listings for a card
   */
  getListings: loggedProcedure
    .input(z.object({
      cardId: z.string(),
      activeOnly: z.boolean().default(true),
      source: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = { cardId: input.cardId };

      if (input.activeOnly) {
        where.isActive = true;
      }

      if (input.source) {
        where.source = input.source;
      }

      return ctx.prisma.listing.findMany({
        where,
        orderBy: { price: 'asc' },
        take: input.limit,
      });
    }),

  /**
   * Get available sets
   */
  getSets: loggedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.cardSet.findMany({
      where: { isActive: true },
      orderBy: { year: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        year: true,
        totalCards: true,
      },
    });
  }),
});

export type CardsRouter = typeof cardsRouter;
