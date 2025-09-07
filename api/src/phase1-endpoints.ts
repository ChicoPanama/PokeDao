/**
 * Phase 1 API Endpoints - Simple table verification
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getTableCounts() {
  const counts = await Promise.all([
    prisma.card.count(),
    prisma.sourceCatalogItem.count(),
    prisma.listing.count(),
    prisma.priceCache.count(),
    prisma.modelInsight.count(),
    prisma.scrapeCursor.count(),
    prisma.rateBudget.count()
  ])

  return {
    cards: counts[0],
    sourceCatalogItems: counts[1],
    listings: counts[2],
    priceCache: counts[3],
    modelInsights: counts[4],
    scrapeCursors: counts[5],
    rateBudgets: counts[6],
    timestamp: new Date().toISOString()
  }
}

export async function getCardWithInsights(cardId: string) {
  return await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      catalogItems: true,
      priceCache: {
        orderBy: { windowDays: 'asc' }
      },
      modelInsights: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })
}

export async function getDeals() {
  const activeInsights = await prisma.modelInsight.findMany({
    where: {
      verdict: 'BUY',
      expiresAt: { gt: new Date() }
    },
    include: {
      card: true,
      catalogItem: true
    },
    orderBy: { confidence: 'desc' },
    take: 10
  })

  return activeInsights.map(insight => ({
    cardName: insight.card?.name,
    source: insight.catalogItem?.source,
    verdict: insight.verdict,
    fairValue: insight.fairValue,
    confidence: insight.confidence,
    risks: insight.risks,
    url: insight.catalogItem?.url,
    createdAt: insight.createdAt
  }))
}
