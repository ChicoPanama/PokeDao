/**
 * DATA COLLECTION API
 *
 * Endpoints for collecting user interaction data:
 * - User queries
 * - User actions
 * - User outcomes
 * - Alert deliveries
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';

// Validation schemas
const userQuerySchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(['TELEGRAM', 'DISCORD', 'WEB', 'API']),
  rawText: z.string().max(5000),
  intentType: z.string().optional(),
  entities: z.record(z.unknown()).optional(),
  responseTimeMs: z.number().int().min(0).optional()
});

const userActionSchema = z.object({
  userId: z.string().min(1),
  opportunityId: z.string().optional(),
  action: z.enum(['VIEW', 'CLICK_LINK', 'DISMISS', 'SAVE', 'BUY', 'SELL', 'WATCH']),
  platform: z.enum(['TELEGRAM', 'DISCORD', 'WEB', 'API']),
  source: z.string().optional(),
  timeToActionMs: z.number().int().min(0).optional()
});

const userOutcomeSchema = z.object({
  userId: z.string().min(1),
  opportunityId: z.string().optional(),
  cardId: z.string().min(1),
  purchasePrice: z.number().positive(),
  purchaseDate: z.string().datetime().optional(),
  grade: z.string().optional()
});

const alertDeliverySchema = z.object({
  userId: z.string().min(1),
  opportunityId: z.string().min(1),
  platform: z.enum(['TELEGRAM', 'DISCORD', 'WEB', 'EMAIL']),
  status: z.enum(['SENT', 'DELIVERED', 'READ', 'CLICKED', 'FAILED']),
  messageId: z.string().optional()
});

export default async function collectRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/collect/query
   * Record a user query
   */
  fastify.post(
    '/query',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof userQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const body = userQuerySchema.parse(request.body);

        const userQuery = await prisma.userQuery.create({
          data: {
            userId: body.userId,
            platform: body.platform,
            rawText: body.rawText,
            intentType: body.intentType,
            entities: (body.entities || {}) as object,
            responseTimeMs: body.responseTimeMs,
            timestamp: new Date()
          }
        });

        return reply.status(201).send({
          success: true,
          id: userQuery.id
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.errors
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /api/collect/action
   * Record a user action
   */
  fastify.post(
    '/action',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof userActionSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const body = userActionSchema.parse(request.body);

        const userAction = await prisma.userAction.create({
          data: {
            userId: body.userId,
            opportunityId: body.opportunityId,
            action: body.action,
            platform: body.platform,
            source: body.source,
            timeToActionMs: body.timeToActionMs,
            timestamp: new Date()
          }
        });

        return reply.status(201).send({
          success: true,
          id: userAction.id
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.errors
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /api/collect/outcome
   * Record a user outcome (purchase/sale)
   */
  fastify.post(
    '/outcome',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof userOutcomeSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const body = userOutcomeSchema.parse(request.body);

        const userOutcome = await prisma.userOutcome.create({
          data: {
            userId: body.userId,
            opportunityId: body.opportunityId,
            cardId: body.cardId,
            purchasePriceCents: Math.round(body.purchasePrice * 100),
            purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
            grade: body.grade,
            status: 'HOLDING',
            createdAt: new Date()
          }
        });

        return reply.status(201).send({
          success: true,
          id: userOutcome.id
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.errors
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /api/collect/alert-delivery
   * Record an alert delivery status
   */
  fastify.post(
    '/alert-delivery',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof alertDeliverySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const body = alertDeliverySchema.parse(request.body);

        const alertDelivery = await prisma.alertDelivery.create({
          data: {
            userId: body.userId,
            opportunityId: body.opportunityId,
            platform: body.platform,
            status: body.status,
            messageId: body.messageId,
            sentAt: new Date()
          }
        });

        return reply.status(201).send({
          success: true,
          id: alertDelivery.id
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.errors
          });
        }
        throw error;
      }
    }
  );

  /**
   * PATCH /api/collect/alert-delivery/:id
   * Update alert delivery status
   */
  fastify.patch(
    '/alert-delivery/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { status: string; readAt?: string; clickedAt?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { status, readAt, clickedAt } = request.body;

      const updates: Record<string, unknown> = { status };
      if (readAt) updates.readAt = new Date(readAt);
      if (clickedAt) updates.clickedAt = new Date(clickedAt);

      const alertDelivery = await prisma.alertDelivery.update({
        where: { id },
        data: updates
      });

      return reply.send({
        success: true,
        id: alertDelivery.id
      });
    }
  );
}
