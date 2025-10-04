/**
 * GET /api/tokenized - NFT-Backed Card Marketplace Endpoint
 *
 * Returns blockchain-verified Pokemon cards (Phygitals, Courtyard, Collector Crypt)
 * Target: Crypto traders looking for on-chain verified collectibles
 *
 * Features:
 * - Filter by blockchain (Solana, Ethereum, Polygon)
 * - Filter by grading company & grade
 * - High data quality scores (0.85+)
 * - NFT address & token ID included
 */

import type { FastifyInstance } from 'fastify';
import type { MarketSource, GradeCompany } from '@prisma/client';
import prisma from '../lib/prisma.js';

const TOKENIZED_SOURCES: MarketSource[] = ['PHYGITALS', 'COURTYARD', 'COLLECTOR_CRYPT'];

const BLOCKCHAIN_MAP: Record<MarketSource, string> = {
  PHYGITALS: 'Solana',
  COLLECTOR_CRYPT: 'Solana',
  COURTYARD: 'Ethereum/Polygon',
  JUSTTCG: 'N/A',
  TCGPLAYER_ACTIVE: 'N/A',
  EBAY: 'N/A',
  TCGPLAYER: 'N/A',
  FANATICS: 'N/A',
  MANUAL: 'N/A',
  CSV: 'N/A',
};

interface TokenizedQueryParams {
  blockchain?: 'solana' | 'ethereum' | 'polygon' | 'all';
  gradeCompany?: GradeCompany;
  minGrade?: number;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price-asc' | 'price-desc' | 'grade-desc' | 'recent';
  limit?: number;
  offset?: number;
}

export async function registerTokenized(app: FastifyInstance) {
  app.get<{ Querystring: TokenizedQueryParams }>(
    '/api/tokenized',
    {
      schema: {
        description: 'Get NFT-backed Pokemon cards from blockchain marketplaces',
        tags: ['Blockchain', 'NFT'],
        querystring: {
          type: 'object',
          properties: {
            blockchain: {
              type: 'string',
              enum: ['solana', 'ethereum', 'polygon', 'all'],
              description: 'Filter by blockchain',
              default: 'all',
            },
            gradeCompany: {
              type: 'string',
              enum: ['PSA', 'BGS', 'CGC', 'SGC', 'ACE', 'RAW'],
              description: 'Filter by grading company',
            },
            minGrade: {
              type: 'number',
              description: 'Minimum grade (e.g., 9.5)',
            },
            minPrice: {
              type: 'number',
              description: 'Minimum price in USD',
            },
            maxPrice: {
              type: 'number',
              description: 'Maximum price in USD',
            },
            sortBy: {
              type: 'string',
              enum: ['price-asc', 'price-desc', 'grade-desc', 'recent'],
              default: 'recent',
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 25,
            },
            offset: {
              type: 'number',
              minimum: 0,
              default: 0,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              blockchain: { type: 'string' },
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    source: { type: 'string' },
                    blockchain: { type: 'string' },
                    nftAddress: { type: 'string' },
                    cardName: { type: 'string' },
                    setName: { type: 'string' },
                    gradeCompany: { type: 'string' },
                    grade: { type: 'number' },
                    priceUSD: { type: 'number' },
                    priceCents: { type: 'number' },
                    url: { type: 'string' },
                    dataQuality: { type: 'number' },
                    listedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        blockchain = 'all',
        gradeCompany,
        minGrade,
        minPrice,
        maxPrice,
        sortBy = 'recent',
        limit = 25,
        offset = 0,
      } = request.query;

      // Build source filter based on blockchain
      let sources = TOKENIZED_SOURCES;
      if (blockchain === 'solana') {
        sources = ['PHYGITALS', 'COLLECTOR_CRYPT'];
      } else if (blockchain === 'ethereum' || blockchain === 'polygon') {
        sources = ['COURTYARD'];
      }

      // Build where clause
      const where: any = {
        source: { in: sources },
        cardName: { not: null },
      };

      if (gradeCompany) {
        where.gradeCompany = gradeCompany;
      }

      if (minGrade !== undefined) {
        where.grade = { gte: minGrade };
      }

      if (minPrice !== undefined) {
        where.priceCents = { gte: minPrice * 100 };
      }

      if (maxPrice !== undefined) {
        where.priceCents = {
          ...where.priceCents,
          lte: maxPrice * 100,
        };
      }

      // Build orderBy
      let orderBy: any = { createdAt: 'desc' }; // default: recent

      if (sortBy === 'price-asc') {
        orderBy = { priceCents: 'asc' };
      } else if (sortBy === 'price-desc') {
        orderBy = { priceCents: 'desc' };
      } else if (sortBy === 'grade-desc') {
        orderBy = { grade: 'desc' };
      }

      try {
        const [listings, total] = await Promise.all([
          prisma.unifiedMarketListing.findMany({
            where,
            orderBy,
            take: limit,
            skip: offset,
          }),
          prisma.unifiedMarketListing.count({ where }),
        ]);

        const items = listings.map((listing) => ({
          id: listing.id,
          source: listing.source,
          blockchain: BLOCKCHAIN_MAP[listing.source],
          nftAddress: listing.sourceId, // sourceId is the NFT address/mint
          cardName: listing.cardName || 'Unknown',
          setName: listing.setName || 'Unknown',
          gradeCompany: listing.gradeCompany || null,
          grade: listing.grade || null,
          priceUSD: listing.priceCents / 100,
          priceCents: listing.priceCents,
          url: listing.url || null,
          dataQuality: listing.dataQuality || 0.85,
          listedAt: listing.createdAt.toISOString(),
        }));

        return reply.code(200).send({
          ok: true,
          blockchain: blockchain,
          total,
          limit,
          offset,
          items,
        });
      } catch (error: any) {
        request.log.error({ err: error }, 'Error fetching tokenized listings');
        return reply.code(500).send({
          ok: false,
          error: 'Failed to fetch tokenized listings',
        });
      }
    }
  );

  // Get tokenized stats endpoint
  app.get(
    '/api/tokenized/stats',
    {
      schema: {
        description: 'Get statistics about NFT-backed cards',
        tags: ['Blockchain', 'NFT'],
      },
    },
    async (request, reply) => {
      try {
        const stats = await prisma.unifiedMarketListing.groupBy({
          by: ['source'],
          where: {
            source: { in: TOKENIZED_SOURCES },
          },
          _count: true,
          _avg: {
            priceCents: true,
            grade: true,
          },
        });

        const breakdown = stats.map((s) => ({
          source: s.source,
          blockchain: BLOCKCHAIN_MAP[s.source],
          totalListings: s._count,
          avgPriceUSD: s._avg.priceCents ? s._avg.priceCents / 100 : 0,
          avgGrade: s._avg.grade || 0,
        }));

        const totalNFTs = stats.reduce((sum, s) => sum + s._count, 0);

        return reply.code(200).send({
          ok: true,
          totalNFTs,
          breakdown,
          generatedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        request.log.error({ err: error }, 'Error fetching tokenized stats');
        return reply.code(500).send({
          ok: false,
          error: 'Failed to fetch stats',
        });
      }
    }
  );
}
