/**
 * eBay Marketplace Account Deletion (MAD) Webhook
 *
 * Required for eBay Developer Account compliance.
 * Handles two types of notifications:
 * 1. Verification Challenge (one-time setup)
 * 2. User Deletion Requests (ongoing compliance)
 *
 * Documentation: https://developer.ebay.com/marketplace-account-deletion
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import prisma from '../../lib/prisma.js';

/**
 * eBay MAD Notification Schema
 */
interface EbayMADNotification {
  // Phase 1: Verification Challenge
  challengeCode?: string;

  // Phase 2: User Deletion Request
  notificationId?: string;
  publishedDate?: string;
  attemptNumber?: number;
  metadata?: {
    userId: string;       // eBay user ID to delete
    username?: string;    // eBay username (may not be provided)
    eiasToken?: string;   // User identity token
  };
}

/**
 * Calculate SHA256 hash for verification challenge
 */
function calculateChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpointUrl: string
): string {
  const payload = challengeCode + verificationToken + endpointUrl;
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Delete all eBay user data from database (GDPR compliance)
 */
async function deleteEbayUserData(ebayUserId: string, logger: any): Promise<void> {
  const startTime = Date.now();

  logger.info({ ebayUserId }, 'Starting eBay user data deletion');

  try {
    // Track what we delete for audit log
    const deletionSummary = {
      ebayUserId,
      timestamp: new Date().toISOString(),
      deletedRecords: {
        // Add counts as we delete
      } as Record<string, number>,
    };

    // TODO: Delete eBay-specific user data based on your schema
    // Currently, PokeDAO doesn't store eBay user accounts directly,
    // but if you add OAuth login or user profiles in the future, delete them here.

    // Example deletions (uncomment and adapt when you have these tables):

    // Delete OAuth tokens if you store them
    // const tokensDeleted = await prisma.ebayOAuthToken.deleteMany({
    //   where: { ebayUserId }
    // });
    // deletionSummary.deletedRecords.oauthTokens = tokensDeleted.count;

    // Delete user profile if stored
    // const profileDeleted = await prisma.ebayUserProfile.deleteMany({
    //   where: { ebayUserId }
    // });
    // deletionSummary.deletedRecords.userProfiles = profileDeleted.count;

    // Anonymize activity logs (keep for audit, but remove PII)
    // await prisma.activityLog.updateMany({
    //   where: { ebayUserId },
    //   data: {
    //     ebayUserId: 'DELETED',
    //     ebayUsername: 'DELETED',
    //     anonymized: true,
    //     anonymizedAt: new Date(),
    //   }
    // });

    // Create audit log entry for deletion
    // await prisma.dataD eletionAudit.create({
    //   data: {
    //     platform: 'EBAY',
    //     userId: ebayUserId,
    //     deletionRequest: 'EBAY_MAD',
    //     summary: deletionSummary,
    //     completedAt: new Date(),
    //   }
    // });

    const duration = Date.now() - startTime;
    logger.info(
      { ebayUserId, duration, summary: deletionSummary },
      'eBay user data deletion completed'
    );
  } catch (error) {
    logger.error(
      { ebayUserId, error },
      'eBay user data deletion failed'
    );
    throw error;
  }
}

/**
 * Register eBay MAD webhook route
 */
export async function registerEbayMADWebhook(app: FastifyInstance) {
  // GET endpoint for eBay to verify endpoint exists
  app.get('/webhooks/ebay/mad', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      status: 'eBay MAD endpoint ready',
      methods: ['POST'],
    });
  });

  app.post('/webhooks/ebay/mad', async (request: FastifyRequest, reply: FastifyReply) => {
    const notification = request.body as EbayMADNotification;

    // Get configuration from environment
    const verificationToken = process.env.EBAY_MAD_VERIFICATION_TOKEN;
    const endpointUrl = process.env.EBAY_MAD_ENDPOINT_URL;

    if (!verificationToken || !endpointUrl) {
      request.log.error('eBay MAD endpoint not configured properly');
      return reply.code(500).send({
        error: 'Server configuration error',
      });
    }

    // =====================================================================
    // Phase 1: Verification Challenge (one-time setup)
    // =====================================================================
    if (notification.challengeCode) {
      request.log.info({ challengeCode: notification.challengeCode }, 'eBay MAD verification challenge received');

      const challengeResponse = calculateChallengeResponse(
        notification.challengeCode,
        verificationToken,
        endpointUrl
      );

      request.log.info('eBay MAD verification challenge passed');

      return reply
        .code(200)
        .header('Content-Type', 'application/json')
        .send({
          challengeResponse,
        });
    }

    // =====================================================================
    // Phase 2: User Deletion Request (ongoing compliance)
    // =====================================================================
    if (notification.notificationId && notification.metadata?.userId) {
      const { notificationId, metadata } = notification;
      const ebayUserId = metadata.userId;

      request.log.info(
        { notificationId, ebayUserId, attemptNumber: notification.attemptNumber },
        'eBay MAD deletion request received'
      );

      try {
        // Delete all user data
        await deleteEbayUserData(ebayUserId, request.log);

        // Acknowledge successful deletion
        return reply.code(200).send({
          ack: 'success',
        });
      } catch (error) {
        request.log.error(
          { notificationId, ebayUserId, error },
          'eBay MAD deletion failed'
        );

        // Return 500 so eBay retries the request
        return reply.code(500).send({
          ack: 'failure',
          error: 'Data deletion failed',
        });
      }
    }

    // =====================================================================
    // Unknown notification format
    // =====================================================================
    request.log.warn({ notification }, 'Unknown eBay MAD notification format');

    return reply.code(400).send({
      error: 'Invalid notification format',
    });
  });

  app.log.info('eBay MAD webhook registered at /webhooks/ebay/mad');
}
