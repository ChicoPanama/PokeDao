/**
 * GET /api/best-execution
 *
 * Fee-adjusted price comparison across all marketplaces.
 * Shows crypto traders the TRUE acquisition cost including fees, shipping, and redemption.
 */

import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';

// Venue Fee Configuration (from packages/core/src/types.ts)
const VENUE_FEES = {
  EBAY: {
    buyerFeeBps: 0,
    shippingUSD: 6,
    redemptionUSD: 0,
  },
  PHYGITALS: {
    buyerFeeBps: 500, // 5%
    shippingUSD: 0,
    redemptionUSD: 25,
  },
  COURTYARD: {
    buyerFeeBps: 350, // 3.5%
    shippingUSD: 0,
    redemptionUSD: 25,
  },
  COLLECTOR_CRYPT: {
    buyerFeeBps: 350, // 3.5%
    shippingUSD: 0,
    redemptionUSD: 20,
  },
  GOLDIN: {
    buyerFeeBps: 2000, // 20%
    shippingUSD: 10,
    redemptionUSD: 0,
  },
  PWCC: {
    buyerFeeBps: 2000, // 20%
    shippingUSD: 10,
    redemptionUSD: 0,
  },
};

interface BestExecutionQuery {
  cardName: string;
  setName?: string;
  gradeCompany?: 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'ACE' | 'RAW';
  grade?: number;
}

interface VenueOption {
  source: string;
  blockchain?: string | null;
  listPrice: number;
  buyerFee: number;
  shipping: number;
  redemption: number;
  totalCost: number;
  listingId: string;
  url: string | null;
  dataQuality: number;
}

export async function registerBestExecution(app: FastifyInstance) {
  app.get<{ Querystring: BestExecutionQuery }>(
    '/api/best-execution',
    {
      schema: {
        description: 'Get fee-adjusted best execution price across all marketplaces',
        tags: ['Trading', 'Price Comparison'],
        querystring: {
          type: 'object',
          required: ['cardName'],
          properties: {
            cardName: { type: 'string' },
            setName: { type: 'string' },
            gradeCompany: {
              type: 'string',
              enum: ['PSA', 'BGS', 'CGC', 'SGC', 'ACE', 'RAW'],
            },
            grade: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { cardName, setName, gradeCompany, grade } = request.query;

      // Build search criteria
      const where: any = {
        cardName: { contains: cardName, mode: 'insensitive' },
        priceCents: { gt: 0 }, // Exclude listings with $0 price
      };

      if (setName) {
        where.setName = { contains: setName, mode: 'insensitive' };
      }
      if (gradeCompany) {
        where.gradeCompany = gradeCompany;
      }
      if (grade !== undefined) {
        where.grade = grade;
      }

      // Find all matching listings
      const listings = await prisma.unifiedMarketListing.findMany({
        where,
        orderBy: { priceCents: 'asc' },
        take: 50, // Get top 50 cheapest
      });

      if (listings.length === 0) {
        return reply.code(404).send({
          ok: false,
          error: 'No listings found for this card',
        });
      }

      // Calculate fee-adjusted costs for each venue
      const venueOptions: VenueOption[] = listings.map((listing) => {
        const source = listing.source;
        const fees = VENUE_FEES[source as keyof typeof VENUE_FEES] || {
          buyerFeeBps: 0,
          shippingUSD: 0,
          redemptionUSD: 0,
        };

        const listPrice = listing.priceCents / 100;
        const buyerFee = (listPrice * fees.buyerFeeBps) / 10000;
        const shipping = fees.shippingUSD;
        const redemption = fees.redemptionUSD;
        const totalCost = listPrice + buyerFee + shipping + redemption;

        const blockchainMap: Record<string, string> = {
          PHYGITALS: 'solana',
          COLLECTOR_CRYPT: 'solana',
          COURTYARD: 'ethereum',
        };

        return {
          source,
          blockchain: blockchainMap[source] || null,
          listPrice: parseFloat(listPrice.toFixed(2)),
          buyerFee: parseFloat(buyerFee.toFixed(2)),
          shipping,
          redemption,
          totalCost: parseFloat(totalCost.toFixed(2)),
          listingId: listing.id,
          url: listing.url,
          dataQuality: listing.dataQuality || 0.85,
        };
      });

      // Sort by total cost
      venueOptions.sort((a, b) => a.totalCost - b.totalCost);

      // Best execution is the cheapest
      const bestExecution = venueOptions[0];

      return reply.code(200).send({
        ok: true,
        searchCriteria: {
          cardName,
          setName: setName || null,
          gradeCompany: gradeCompany || null,
          grade: grade || null,
        },
        bestExecution: {
          source: bestExecution.source,
          blockchain: bestExecution.blockchain,
          totalCost: bestExecution.totalCost,
          breakdown: {
            listPrice: bestExecution.listPrice,
            buyerFee: bestExecution.buyerFee,
            shipping: bestExecution.shipping,
            redemption: bestExecution.redemption,
          },
          url: bestExecution.url,
          dataQuality: bestExecution.dataQuality,
        },
        allOptions: venueOptions.slice(0, 10), // Show top 10
        totalOptionsFound: venueOptions.length,
      });
    }
  );
}
