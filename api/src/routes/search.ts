/**
 * Cross-Marketplace Search Endpoints
 *
 * Search across all integrated marketplaces:
 * - Collector Crypt
 * - Phygitals
 * - eBay
 * - TCGPlayer
 * - Courtyard (when available)
 */

import type { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

interface SearchQuery {
  q?: string;              // Free text search
  cardName?: string;       // Exact/fuzzy card name
  setName?: string;        // Set name
  cardNumber?: string;     // Card number
  gradeCompany?: string;   // PSA, BGS, CGC, etc.
  minGrade?: string;       // Minimum grade (e.g., "9")
  maxGrade?: string;       // Maximum grade
  minPrice?: string;       // Minimum price in cents
  maxPrice?: string;       // Maximum price in cents
  source?: string;         // Filter by marketplace
  limit?: string;          // Results per page (max 100)
  cursor?: string;         // Pagination cursor
  sortBy?: string;         // price_asc, price_desc, grade_desc, recent
}

export async function registerSearch(app: FastifyInstance) {
  /**
   * GET /api/search - Cross-marketplace card search
   *
   * Examples:
   *   /api/search?q=Charizard
   *   /api/search?cardName=Pikachu&setName=Base%20Set
   *   /api/search?gradeCompany=PSA&minGrade=9&maxPrice=10000
   *   /api/search?source=COLLECTOR_CRYPT&sortBy=price_asc
   */
  app.get('/api/search', async (req, reply) => {
    try {
      const query = req.query as SearchQuery;

      // Validate and parse parameters
      const limit = Math.min(100, Math.max(1, Number(query.limit || '25')));
      const cursor = query.cursor ? { id: query.cursor } : undefined;

      // Build WHERE clause
      const where: Prisma.UnifiedMarketListingWhereInput = {};
      const conditions: Prisma.UnifiedMarketListingWhereInput[] = [];

      // Free text search across title, cardName, setName
      if (query.q && query.q.trim()) {
        const searchTerm = query.q.trim();
        conditions.push({
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { cardName: { contains: searchTerm, mode: 'insensitive' } },
            { setName: { contains: searchTerm, mode: 'insensitive' } },
          ],
        });
      }

      // Specific field searches
      if (query.cardName && query.cardName.trim()) {
        conditions.push({
          cardName: { contains: query.cardName.trim(), mode: 'insensitive' },
        });
      }

      if (query.setName && query.setName.trim()) {
        conditions.push({
          setName: { contains: query.setName.trim(), mode: 'insensitive' },
        });
      }

      if (query.cardNumber && query.cardNumber.trim()) {
        conditions.push({
          cardNumber: { equals: query.cardNumber.trim() },
        });
      }

      // Grading filters
      if (query.gradeCompany) {
        const validGraders = ['PSA', 'BGS', 'CGC', 'SGC', 'ACE', 'RAW', 'OTHER'];
        if (validGraders.includes(query.gradeCompany.toUpperCase())) {
          conditions.push({
            gradeCompany: query.gradeCompany.toUpperCase() as any,
          });
        }
      }

      if (query.minGrade) {
        const minGrade = parseFloat(query.minGrade);
        if (!isNaN(minGrade)) {
          conditions.push({ grade: { gte: minGrade } });
        }
      }

      if (query.maxGrade) {
        const maxGrade = parseFloat(query.maxGrade);
        if (!isNaN(maxGrade)) {
          conditions.push({ grade: { lte: maxGrade } });
        }
      }

      // Price filters
      if (query.minPrice) {
        const minPrice = parseInt(query.minPrice);
        if (!isNaN(minPrice) && minPrice > 0) {
          conditions.push({ priceCents: { gte: minPrice } });
        }
      }

      if (query.maxPrice) {
        const maxPrice = parseInt(query.maxPrice);
        if (!isNaN(maxPrice) && maxPrice > 0) {
          conditions.push({ priceCents: { lte: maxPrice } });
        }
      }

      // Marketplace source filter
      if (query.source) {
        const validSources = ['COLLECTOR_CRYPT', 'PHYGITALS', 'EBAY', 'TCGPLAYER', 'COURTYARD'];
        if (validSources.includes(query.source.toUpperCase())) {
          conditions.push({
            source: query.source.toUpperCase() as any,
          });
        }
      }

      // Combine all conditions with AND
      if (conditions.length > 0) {
        where.AND = conditions;
      }

      // Build ORDER BY clause
      const orderBy: Prisma.UnifiedMarketListingOrderByWithRelationInput[] = [];

      switch (query.sortBy) {
        case 'price_asc':
          orderBy.push({ priceCents: 'asc' });
          break;
        case 'price_desc':
          orderBy.push({ priceCents: 'desc' });
          break;
        case 'grade_desc':
          orderBy.push({ grade: 'desc' });
          orderBy.push({ priceCents: 'asc' }); // Secondary sort by price
          break;
        case 'recent':
          orderBy.push({ createdAt: 'desc' });
          break;
        default:
          // Default: sort by data quality (best matches first), then price
          orderBy.push({ dataQuality: 'desc' });
          orderBy.push({ priceCents: 'asc' });
      }

      // Always add ID for stable pagination
      orderBy.push({ id: 'asc' });

      // Execute query
      const listings = await prisma.unifiedMarketListing.findMany({
        where,
        orderBy,
        ...(cursor ? { cursor, skip: 1 } : {}),
        take: limit + 1, // Fetch one extra to check if there are more results
      });

      // Check if there are more results
      const hasMore = listings.length > limit;
      if (hasMore) {
        listings.pop(); // Remove the extra item
      }

      // Get total count for this query (expensive, so only do it on first page)
      let totalCount: number | undefined;
      if (!cursor) {
        totalCount = await prisma.unifiedMarketListing.count({ where });
      }

      return {
        ok: true,
        results: listings.map(listing => ({
          id: listing.id,
          source: listing.source,
          title: listing.title,
          cardName: listing.cardName,
          setName: listing.setName,
          cardNumber: listing.cardNumber,
          variant: listing.variant,
          gradeCompany: listing.gradeCompany,
          grade: listing.grade,
          priceCents: listing.priceCents,
          priceUsd: (listing.priceCents / 100).toFixed(2),
          currency: listing.currency,
          url: listing.url,
          dataQuality: listing.dataQuality,
          updatedAt: listing.updatedAt,
        })),
        pagination: {
          count: listings.length,
          hasMore,
          nextCursor: hasMore ? listings[listings.length - 1].id : null,
          ...(totalCount !== undefined ? { totalCount } : {}),
        },
        query: {
          ...query,
          limit,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      app.log.error({ err }, 'search route error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  /**
   * GET /api/search/autocomplete - Autocomplete suggestions for search
   *
   * Examples:
   *   /api/search/autocomplete?q=Char
   *   /api/search/autocomplete?q=Char&type=cardName
   */
  app.get('/api/search/autocomplete', async (req, reply) => {
    try {
      const query = req.query as { q?: string; type?: string; limit?: string };

      if (!query.q || query.q.trim().length < 2) {
        return {
          ok: true,
          suggestions: [],
          query: query.q || '',
        };
      }

      const searchTerm = query.q.trim();
      const limit = Math.min(20, Math.max(1, Number(query.limit || '10')));
      const type = query.type || 'cardName';

      let suggestions: string[] = [];

      if (type === 'cardName') {
        // Get distinct card names matching the search term
        const results = await prisma.unifiedMarketListing.findMany({
          where: {
            cardName: {
              contains: searchTerm,
              mode: 'insensitive',
            },
            NOT: {
              cardName: 'Unknown',
            },
          },
          select: {
            cardName: true,
          },
          distinct: ['cardName'],
          take: limit,
        });
        suggestions = results.map(r => r.cardName || '').filter(Boolean);
      } else if (type === 'setName') {
        // Get distinct set names matching the search term
        const results = await prisma.unifiedMarketListing.findMany({
          where: {
            setName: {
              contains: searchTerm,
              mode: 'insensitive',
            },
            NOT: {
              setName: 'Unknown',
            },
          },
          select: {
            setName: true,
          },
          distinct: ['setName'],
          take: limit,
        });
        suggestions = results.map(r => r.setName || '').filter(Boolean);
      }

      return {
        ok: true,
        suggestions,
        query: searchTerm,
        type,
      };
    } catch (err: any) {
      app.log.error({ err }, 'autocomplete route error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });

  /**
   * GET /api/search/filters - Get available filter options
   *
   * Returns counts and available values for each filter dimension
   */
  app.get('/api/search/filters', async (req, reply) => {
    try {
      // Get available sources with counts
      const sources = await prisma.unifiedMarketListing.groupBy({
        by: ['source'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      // Get available grade companies with counts
      const gradeCompanies = await prisma.unifiedMarketListing.groupBy({
        by: ['gradeCompany'],
        _count: { id: true },
        where: {
          gradeCompany: { not: null },
        },
        orderBy: { _count: { id: 'desc' } },
      });

      // Get price ranges
      const priceStats = await prisma.unifiedMarketListing.aggregate({
        _min: { priceCents: true },
        _max: { priceCents: true },
        _avg: { priceCents: true },
        where: {
          priceCents: { gt: 0 },
        },
      });

      // Get grade ranges
      const gradeStats = await prisma.unifiedMarketListing.aggregate({
        _min: { grade: true },
        _max: { grade: true },
        where: {
          grade: { not: null },
        },
      });

      return {
        ok: true,
        filters: {
          sources: sources.map(s => ({
            value: s.source,
            count: s._count.id,
          })),
          gradeCompanies: gradeCompanies.map(g => ({
            value: g.gradeCompany,
            count: g._count.id,
          })),
          priceRange: {
            minCents: priceStats._min.priceCents || 0,
            maxCents: priceStats._max.priceCents || 0,
            avgCents: Math.round(priceStats._avg.priceCents || 0),
            minUsd: ((priceStats._min.priceCents || 0) / 100).toFixed(2),
            maxUsd: ((priceStats._max.priceCents || 0) / 100).toFixed(2),
            avgUsd: (Math.round(priceStats._avg.priceCents || 0) / 100).toFixed(2),
          },
          gradeRange: {
            min: gradeStats._min.grade || 0,
            max: gradeStats._max.grade || 0,
          },
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      app.log.error({ err }, 'filters route error');
      reply.code(500);
      return { ok: false, error: 'Internal error' };
    }
  });
}
