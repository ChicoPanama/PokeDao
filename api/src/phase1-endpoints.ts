/**
 * Phase 4 API Endpoints - Current schema verification
 */
import prisma from './lib/prisma.js';

export async function getTableCounts() {
  const counts = await Promise.all([
    prisma.card.count(),
    prisma.listing.count(),
    prisma.compSale.count(),
    prisma.evaluation.count(),
    prisma.signal.count(),
  ])

  return {
    cards: counts[0],
    listings: counts[1],
    compSales: counts[2],
    evaluations: counts[3],
    signals: counts[4],
    timestamp: new Date().toISOString()
  }
}

export async function getCardWithData(cardId: string) {
  return await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      listings: {
        where: { isActive: true },
        orderBy: { price: 'asc' }
      },
      compSales: {
        orderBy: { soldAt: 'desc' },
        take: 5
      },
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  })
}

export async function getBestDeals() {
  const evaluations = await prisma.evaluation.findMany({
    where: {
      riskLevel: 'low',
      discount: { gt: 0.2 } // 20%+ discount
    },
    include: {
      card: true,
      listing: true
    },
    orderBy: { confidence: 'desc' },
    take: 10
  })

  return evaluations.map((evaluation: typeof evaluations[number]) => ({
    cardName: evaluation.card?.name,
    listingPrice: evaluation.listing?.price,
    fairValue: evaluation.fairValue,
    discount: evaluation.discount,
    confidence: evaluation.confidence,
    riskLevel: evaluation.riskLevel,
    projectedReturn: evaluation.projectedReturn,
    url: evaluation.listing?.url,
    createdAt: evaluation.createdAt
  }))
}
