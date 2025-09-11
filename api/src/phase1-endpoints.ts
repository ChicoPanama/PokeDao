/**
 * Phase 4 API Endpoints - Current schema verification
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getTableCounts() {
  const counts = await Promise.all([
    prisma.card.count(),
    prisma.listing.count(),
    prisma.compSale.count(),
    prisma.marketData.count(),
    prisma.priceSnapshot.count(),
    prisma.dataSource.count(),
    prisma.processingJob.count()
  ])

  return {
    cards: counts[0],
    listings: counts[1],
    compSales: counts[2],
    marketData: counts[3],
    priceSnapshots: counts[4],
    dataSources: counts[5],
    processingJobs: counts[6],
    timestamp: new Date().toISOString()
  }
}

export async function getCardWithData(cardId: string) {
  return await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      listings: {
        where: { isActive: true },
        orderBy: { normalizedPrice: 'asc' }
      },
      priceHistory: {
        orderBy: { timestamp: 'desc' },
        take: 10
      },
      marketData: true,
      compSales: {
        where: { verified: true },
        orderBy: { saleDate: 'desc' },
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

  return evaluations.map(evaluation => ({
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
