#!/usr/bin/env tsx

/**
 * Data Integrity Verification Script
 * 
 * This script continuously monitors all data sources and processing pipelines
 * to ensure complete data capture and no loss during processing.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DataFlowMetrics {
  sources: {
    total: number
    active: number
    lastScraped: string[]
    errorSources: string[]
  }
  processing: {
    totalJobs: number
    pendingJobs: number
    runningJobs: number
    completedJobs: number
    failedJobs: number
  }
  dataVolume: {
    cards: number
    listings: number
    compSales: number
    marketData: number
    qualityReports: number
  }
  integrity: {
    orphanedListings: number
    missingMarketData: number
    qualityIssues: number
    duplicateCards: number
  }
}

async function checkSourceHealth(): Promise<DataFlowMetrics['sources']> {
  const sources = await prisma.dataSource.findMany({
    select: {
      name: true,
      isActive: true,
      lastScrapedAt: true,
      consecutiveErrors: true,
      lastErrorMsg: true
    }
  })
  
  const total = sources.length
  const active = sources.filter(s => s.isActive).length
  const lastScraped = sources
    .filter(s => s.lastScrapedAt)
    .map(s => `${s.name}: ${s.lastScrapedAt?.toISOString()}`)
  
  const errorSources = sources
    .filter(s => s.consecutiveErrors > 0)
    .map(s => `${s.name}: ${s.consecutiveErrors} errors - ${s.lastErrorMsg}`)
  
  return {
    total,
    active,
    lastScraped,
    errorSources
  }
}

async function checkProcessingStatus(): Promise<DataFlowMetrics['processing']> {
  const [totalJobs, pendingJobs, runningJobs, completedJobs, failedJobs] = await Promise.all([
    prisma.processingJob.count(),
    prisma.processingJob.count({ where: { status: 'pending' } }),
    prisma.processingJob.count({ where: { status: 'running' } }),
    prisma.processingJob.count({ where: { status: 'completed' } }),
    prisma.processingJob.count({ where: { status: 'failed' } })
  ])
  
  return {
    totalJobs,
    pendingJobs,
    runningJobs,
    completedJobs,
    failedJobs
  }
}

async function checkDataVolume(): Promise<DataFlowMetrics['dataVolume']> {
  const [cards, listings, compSales, marketData, qualityReports] = await Promise.all([
    prisma.card.count(),
    prisma.listing.count(),
    prisma.compSale.count(),
    prisma.marketData.count(),
    prisma.dataQuality.count()
  ])
  
  return {
    cards,
    listings,
    compSales,
    marketData,
    qualityReports
  }
}

async function checkDataIntegrity(): Promise<DataFlowMetrics['integrity']> {
  // Check for orphaned listings (listings with invalid card references)
  // Since card is a required relation, we'll check for listings where the card doesn't exist
  const orphanedListings = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*) as count 
    FROM "Listing" l 
    LEFT JOIN "Card" c ON l."cardId" = c.id 
    WHERE c.id IS NULL
  `
  
  // Check for cards missing market data
  const missingMarketData = await prisma.card.count({
    where: {
      marketData: { is: null }
    }
  })
  
  // Check for quality issues
  const qualityIssues = await prisma.dataQuality.count({
    where: {
      resolved: false,
      severity: { in: ['high', 'critical'] }
    }
  })
  
  // Check for duplicate cards (same normalized name, set, number)
  const duplicateCards = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "normalizedName", "setCode", "number", COUNT(*) as duplicates
      FROM "Card" 
      WHERE "normalizedName" IS NOT NULL 
        AND "setCode" IS NOT NULL 
        AND "number" IS NOT NULL
      GROUP BY "normalizedName", "setCode", "number"
      HAVING COUNT(*) > 1
    ) as dups
  `
  
  return {
    orphanedListings: Number(orphanedListings[0]?.count || 0),
    missingMarketData,
    qualityIssues,
    duplicateCards: Number(duplicateCards[0]?.count || 0)
  }
}

async function generateIntegrityReport(): Promise<DataFlowMetrics> {
  console.log('🔍 Checking data flow integrity...')
  
  const [sources, processing, dataVolume, integrity] = await Promise.all([
    checkSourceHealth(),
    checkProcessingStatus(),
    checkDataVolume(),
    checkDataIntegrity()
  ])
  
  return {
    sources,
    processing,
    dataVolume,
    integrity
  }
}

async function identifyDataGaps() {
  console.log('🔍 Identifying potential data gaps...')
  
  // Find sources that haven't been scraped recently
  const staleSources = await prisma.dataSource.findMany({
    where: {
      OR: [
        { lastScrapedAt: null },
        {
          lastScrapedAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
          }
        }
      ]
    },
    select: { name: true, lastScrapedAt: true }
  })
  
  // Find failed jobs that need retry
  const stuckJobs = await prisma.processingJob.findMany({
    where: {
      status: 'failed',
      attempts: { lt: 3 }
    },
    include: {
      source: { select: { name: true } }
    }
  })
  
  // Find cards with no recent listings
  const cardsWithoutRecentListings = await prisma.card.count({
    where: {
      listings: {
        none: {
          scrapedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
          }
        }
      }
    }
  })
  
  return {
    staleSources,
    stuckJobs,
    cardsWithoutRecentListings
  }
}

async function suggestDataFlowImprovements(metrics: DataFlowMetrics) {
  const suggestions: string[] = []
  
  // Source health suggestions
  if (metrics.sources.errorSources.length > 0) {
    suggestions.push(`🚨 ${metrics.sources.errorSources.length} sources have errors - investigate and resolve`)
  }
  
  if (metrics.sources.active < metrics.sources.total) {
    suggestions.push(`⚠️ ${metrics.sources.total - metrics.sources.active} sources are inactive - reactivate if needed`)
  }
  
  // Processing suggestions
  if (metrics.processing.failedJobs > 0) {
    suggestions.push(`🔄 ${metrics.processing.failedJobs} failed jobs need retry or investigation`)
  }
  
  if (metrics.processing.pendingJobs > 100) {
    suggestions.push(`⏳ ${metrics.processing.pendingJobs} pending jobs - consider increasing processing capacity`)
  }
  
  // Data integrity suggestions
  if (metrics.integrity.orphanedListings > 0) {
    suggestions.push(`🔗 ${metrics.integrity.orphanedListings} orphaned listings need card linking`)
  }
  
  if (metrics.integrity.missingMarketData > metrics.dataVolume.cards * 0.1) {
    suggestions.push(`📊 ${metrics.integrity.missingMarketData} cards missing market data - run aggregation`)
  }
  
  if (metrics.integrity.qualityIssues > 0) {
    suggestions.push(`⚠️ ${metrics.integrity.qualityIssues} critical quality issues need resolution`)
  }
  
  if (metrics.integrity.duplicateCards > 0) {
    suggestions.push(`🔄 ${metrics.integrity.duplicateCards} duplicate cards found - run deduplication`)
  }
  
  return suggestions
}

async function main() {
  try {
    console.log('🔍 DATA INTEGRITY VERIFICATION')
    console.log('==============================')
    
    const metrics = await generateIntegrityReport()
    const gaps = await identifyDataGaps()
    const suggestions = await suggestDataFlowImprovements(metrics)
    
    console.log('\n📊 CURRENT METRICS:')
    console.log(`• Data Sources: ${metrics.sources.active}/${metrics.sources.total} active`)
    console.log(`• Processing Jobs: ${metrics.processing.totalJobs} total, ${metrics.processing.runningJobs} running`)
    console.log(`• Data Volume: ${metrics.dataVolume.cards} cards, ${metrics.dataVolume.listings} listings`)
    console.log(`• Market Intelligence: ${metrics.dataVolume.compSales} sales, ${metrics.dataVolume.marketData} market records`)
    
    console.log('\n🔍 INTEGRITY STATUS:')
    if (metrics.integrity.orphanedListings === 0 && 
        metrics.integrity.qualityIssues === 0 && 
        metrics.integrity.duplicateCards === 0) {
      console.log('✅ Data integrity is excellent - no issues found!')
    } else {
      console.log(`⚠️ Found integrity issues:`)
      if (metrics.integrity.orphanedListings > 0) console.log(`  • ${metrics.integrity.orphanedListings} orphaned listings`)
      if (metrics.integrity.qualityIssues > 0) console.log(`  • ${metrics.integrity.qualityIssues} quality issues`)
      if (metrics.integrity.duplicateCards > 0) console.log(`  • ${metrics.integrity.duplicateCards} duplicate cards`)
    }
    
    if (gaps.staleSources.length > 0) {
      console.log('\n⏰ STALE DATA SOURCES:')
      gaps.staleSources.forEach(source => {
        const lastScrape = source.lastScrapedAt ? source.lastScrapedAt.toISOString() : 'Never'
        console.log(`  • ${source.name}: Last scraped ${lastScrape}`)
      })
    }
    
    if (gaps.stuckJobs.length > 0) {
      console.log('\n🔄 STUCK PROCESSING JOBS:')
      gaps.stuckJobs.forEach(job => {
        console.log(`  • ${job.source.name} - ${job.jobType}: ${job.errorMessage || 'Unknown error'}`)
      })
    }
    
    if (gaps.cardsWithoutRecentListings > 0) {
      console.log(`\n📊 ${gaps.cardsWithoutRecentListings} cards have no recent listings (7+ days old)`)
    }
    
    console.log('\n💡 RECOMMENDATIONS:')
    if (suggestions.length === 0) {
      console.log('✅ Data flow is optimal - no improvements needed!')
    } else {
      suggestions.forEach(suggestion => console.log(`  ${suggestion}`))
    }
    
    console.log('\n🎯 UNILATERAL DATA FLOW STATUS:')
    const flowEfficiency = (metrics.processing.completedJobs / Math.max(metrics.processing.totalJobs, 1)) * 100
    const integrityScore = 100 - (
      (metrics.integrity.orphanedListings + metrics.integrity.qualityIssues + metrics.integrity.duplicateCards) / 
      Math.max(metrics.dataVolume.cards + metrics.dataVolume.listings, 1) * 100
    )
    
    console.log(`• Flow Efficiency: ${flowEfficiency.toFixed(1)}%`)
    console.log(`• Data Integrity Score: ${Math.max(0, integrityScore).toFixed(1)}%`)
    console.log(`• Sources Online: ${metrics.sources.active}/${metrics.sources.total}`)
    console.log(`• Processing Status: ${metrics.processing.runningJobs} active jobs`)
    
    if (flowEfficiency > 90 && integrityScore > 95) {
      console.log('\n🚀 EXCELLENT: Unilateral data flow is operating optimally!')
    } else if (flowEfficiency > 70 && integrityScore > 85) {
      console.log('\n✅ GOOD: Data flow is functioning well with minor issues.')
    } else {
      console.log('\n⚠️ ATTENTION: Data flow needs improvement - review recommendations.')
    }
    
  } catch (error) {
    console.error('❌ Integrity check failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { main as verifyDataIntegrity }
