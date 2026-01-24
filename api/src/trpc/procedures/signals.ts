/**
 * Signal Procedures
 *
 * tRPC procedures for managing trading signals.
 */

import { z } from 'zod';
import { router, loggedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

// ============================================================================
// Input Schemas
// ============================================================================

const SignalFilterSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'RETRACTED']).optional(),
  minEdgeBp: z.number().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  cardId: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const SignalIdSchema = z.string().min(1);

// ============================================================================
// Router
// ============================================================================

export const signalsRouter = router({
  /**
   * List signals with optional filters
   */
  list: loggedProcedure
    .input(SignalFilterSchema)
    .query(async ({ input, ctx }) => {
      const where: any = {};

      if (input.status) {
        where.status = input.status;
      }

      if (input.minEdgeBp !== undefined) {
        where.edgeBp = { gte: input.minEdgeBp };
      }

      if (input.minConfidence !== undefined) {
        where.confidence = { gte: input.minConfidence };
      }

      if (input.cardId) {
        where.cardId = input.cardId;
      }

      const [signals, total] = await Promise.all([
        ctx.prisma.signal.findMany({
          where,
          take: input.limit,
          skip: input.offset,
          orderBy: { createdAt: 'desc' },
          include: {
            card: {
              select: {
                id: true,
                name: true,
                set: true,
                number: true,
                grade: true,
              },
            },
          },
        }),
        ctx.prisma.signal.count({ where }),
      ]);

      return {
        signals,
        total,
        hasMore: input.offset + signals.length < total,
      };
    }),

  /**
   * Get a single signal by ID
   */
  getById: loggedProcedure
    .input(SignalIdSchema)
    .query(async ({ input, ctx }) => {
      const signal = await ctx.prisma.signal.findUnique({
        where: { id: input },
        include: {
          card: true,
          marketListing: true,
        },
      });

      if (!signal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Signal ${input} not found`,
        });
      }

      return signal;
    }),

  /**
   * Get active signals for a specific card
   */
  getByCard: loggedProcedure
    .input(z.object({
      cardId: z.string(),
      activeOnly: z.boolean().default(true),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = { cardId: input.cardId };

      if (input.activeOnly) {
        where.status = 'ACTIVE';
      }

      return ctx.prisma.signal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          marketListing: {
            select: {
              id: true,
              title: true,
              priceCents: true,
              source: true,
              sourceUrl: true,
            },
          },
        },
      });
    }),

  /**
   * Get top signals by edge or confidence
   */
  getTop: loggedProcedure
    .input(z.object({
      sortBy: z.enum(['edgeBp', 'confidence']).default('edgeBp'),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.signal.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { [input.sortBy]: 'desc' },
        take: input.limit,
        include: {
          card: {
            select: {
              id: true,
              name: true,
              set: true,
              grade: true,
            },
          },
        },
      });
    }),

  /**
   * Get signal statistics
   */
  stats: loggedProcedure.query(async ({ ctx }) => {
    const [total, active, avgEdge, avgConfidence] = await Promise.all([
      ctx.prisma.signal.count(),
      ctx.prisma.signal.count({ where: { status: 'ACTIVE' } }),
      ctx.prisma.signal.aggregate({
        _avg: { edgeBp: true },
        where: { status: 'ACTIVE' },
      }),
      ctx.prisma.signal.aggregate({
        _avg: { confidence: true },
        where: { status: 'ACTIVE' },
      }),
    ]);

    return {
      total,
      active,
      avgEdgeBp: avgEdge._avg.edgeBp ?? 0,
      avgConfidence: avgConfidence._avg.confidence ?? 0,
    };
  }),
});

export type SignalsRouter = typeof signalsRouter;
