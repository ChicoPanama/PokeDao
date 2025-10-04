/**
 * GET /api/confidence/:id
 *
 * Returns trust scores and data quality metrics for a specific listing.
 * Helps crypto traders assess reliability before purchase.
 */

import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';

interface ConfidenceScore {
  overall: number;
  breakdown: {
    dataQuality: number;
    priceConfidence: number;
    sourceReliability: number;
    blockchainVerification: number;
  };
  flags: string[];
  recommendation: 'high' | 'medium' | 'low' | 'avoid';
}

// Source reliability scores (0-1)
const SOURCE_RELIABILITY: Record<string, number> = {
  COURTYARD: 0.95, // Ethereum-backed, vault verified
  COLLECTOR_CRYPT: 0.90, // Solana-backed, established marketplace
  PHYGITALS: 0.85, // Solana-backed, newer platform
  EBAY: 0.70, // Traditional marketplace, less verification
  TCGPLAYER: 0.75,
  GOLDIN: 0.80,
  PWCC: 0.80,
};

// Blockchain verification bonus
const BLOCKCHAIN_VERIFIED_SOURCES = ['COURTYARD', 'COLLECTOR_CRYPT', 'PHYGITALS'];

function calculatePriceConfidence(listing: any, comparableCount: number): number {
  // Price confidence based on:
  // 1. Number of comparable sales
  // 2. Price not being outlier
  // 3. Recent pricing data

  let score = 0.5; // Base score

  // Comparable sales boost
  if (comparableCount > 10) score += 0.2;
  else if (comparableCount > 5) score += 0.1;
  else if (comparableCount > 0) score += 0.05;

  // Price range check (if price is reasonable)
  if (listing.priceCents > 0 && listing.priceCents < 100000000) {
    score += 0.2;
  }

  // Recency check
  const ageInDays = (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 7) score += 0.1;
  else if (ageInDays < 30) score += 0.05;

  return Math.min(1, score);
}

export async function registerConfidence(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/api/confidence/:id',
    {
      schema: {
        description: 'Get trust score and data quality metrics for a listing',
        tags: ['Trust', 'Data Quality'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Find the listing
      const listing = await prisma.unifiedMarketListing.findUnique({
        where: { id },
      });

      if (!listing) {
        return reply.code(404).send({
          ok: false,
          error: 'Listing not found',
        });
      }

      // Find comparable listings for price confidence
      const comparables = await prisma.unifiedMarketListing.count({
        where: {
          cardName: listing.cardName,
          gradeCompany: listing.gradeCompany,
          grade: listing.grade,
          priceCents: {
            gte: listing.priceCents * 0.8,
            lte: listing.priceCents * 1.2,
          },
          id: { not: id },
        },
      });

      // Calculate confidence scores
      const dataQuality = listing.dataQuality || 0.5;
      const sourceReliability = SOURCE_RELIABILITY[listing.source] || 0.5;
      const priceConfidence = calculatePriceConfidence(listing, comparables);
      const blockchainVerification = BLOCKCHAIN_VERIFIED_SOURCES.includes(listing.source)
        ? 1.0
        : 0.0;

      // Overall confidence (weighted average)
      const overall =
        dataQuality * 0.3 +
        sourceReliability * 0.25 +
        priceConfidence * 0.25 +
        blockchainVerification * 0.2;

      // Generate flags
      const flags: string[] = [];

      if (listing.priceCents === 0) {
        flags.push('PRICE_MISSING');
      }

      if (!listing.cardName || listing.cardName === 'Unknown') {
        flags.push('CARD_NAME_UNKNOWN');
      }

      if (!listing.gradeCompany) {
        flags.push('UNGRADED_RAW');
      }

      if (comparables === 0) {
        flags.push('NO_COMPARABLES');
      }

      if (listing.dataQuality && listing.dataQuality < 0.6) {
        flags.push('LOW_DATA_QUALITY');
      }

      if (!BLOCKCHAIN_VERIFIED_SOURCES.includes(listing.source)) {
        flags.push('NOT_BLOCKCHAIN_VERIFIED');
      }

      const ageInDays = (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays > 30) {
        flags.push('STALE_DATA');
      }

      // Recommendation
      let recommendation: 'high' | 'medium' | 'low' | 'avoid';
      if (overall >= 0.8 && flags.length === 0) {
        recommendation = 'high';
      } else if (overall >= 0.6 && flags.length <= 2) {
        recommendation = 'medium';
      } else if (overall >= 0.4) {
        recommendation = 'low';
      } else {
        recommendation = 'avoid';
      }

      const confidenceScore: ConfidenceScore = {
        overall: parseFloat(overall.toFixed(2)),
        breakdown: {
          dataQuality: parseFloat(dataQuality.toFixed(2)),
          priceConfidence: parseFloat(priceConfidence.toFixed(2)),
          sourceReliability: parseFloat(sourceReliability.toFixed(2)),
          blockchainVerification: parseFloat(blockchainVerification.toFixed(2)),
        },
        flags,
        recommendation,
      };

      return reply.code(200).send({
        ok: true,
        listingId: id,
        listing: {
          source: listing.source,
          cardName: listing.cardName || 'Unknown',
          setName: listing.setName || 'Unknown',
          gradeCompany: listing.gradeCompany || null,
          grade: listing.grade || null,
          priceUSD: listing.priceCents / 100,
          url: listing.url || null,
          createdAt: listing.createdAt.toISOString(),
        },
        confidence: confidenceScore,
        comparables: {
          count: comparables,
          note: 'Listings within ±20% price range with matching card/grade',
        },
      });
    }
  );
}
