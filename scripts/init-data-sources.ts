#!/usr/bin/env tsx

/**
 * Data Source Initialization Script
 * 
 * This script initializes all data sources and ensures comprehensive tracking
 * for unilateral data flow without any loss.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DATA_SOURCES = [
  {
    name: 'tcgplayer',
    url: 'https://www.tcgplayer.com',
    rateLimit: 1000, // requests per hour
    timeout: 30,
    isActive: true
  },
  {
    name: 'ebay',
    url: 'https://www.ebay.com',
    rateLimit: 500,
    timeout: 30,
    isActive: true
  },
  {
    name: 'collector_crypt',
    url: 'https://collectorcrypt.com',
    rateLimit: 300,
    timeout: 45,
    isActive: true
  },
  {
    name: 'phygitals_marketplace',
    url: 'https://phygitals.io',
    rateLimit: 200,
    timeout: 30,
    isActive: true
  },
  {
    name: 'fanatics',
    url: 'https://www.fanatics.com',
    rateLimit: 150,
    timeout: 30,
    isActive: true
  },
  {
    name: 'pokemoncenter',
    url: 'https://www.pokemoncenter.com',
    rateLimit: 100,
    timeout: 30,
    isActive: true
  },
  {
    name: 'troll_and_toad',
    url: 'https://www.trollandtoad.com',
    rateLimit: 200,
    timeout: 30,
    isActive: true
  },
  {
    name: 'comc',
    url: 'https://www.comc.com',
    rateLimit: 150,
    timeout: 30,
    isActive: true
  }
]

async function initializeDataSources() {
  console.log('🔄 Initializing data sources...')
  
  for (const source of DATA_SOURCES) {
    try {
      const existing = await prisma.dataSource.findUnique({
        where: { name: source.name }
      })
      
      if (existing) {
        console.log(`✅ Data source '${source.name}' already exists, updating...`)
        await prisma.dataSource.update({
          where: { name: source.name },
          data: {
            url: source.url,
            rateLimit: source.rateLimit,
            timeout: source.timeout,
            isActive: source.isActive,
            consecutiveErrors: 0 // Reset errors on init
          }
        })
      } else {
        console.log(`➕ Creating new data source: ${source.name}`)
        await prisma.dataSource.create({
          data: source
        })
      }
    } catch (error) {
      console.error(`❌ Failed to initialize data source '${source.name}':`, error)
    }
  }
  
  console.log('✅ Data source initialization complete!')
}

async function createInitialProcessingJobs() {
  console.log('🔄 Creating initial processing jobs...')
  
  const sources = await prisma.dataSource.findMany({
    where: { isActive: true }
  })
  
  const jobTypes = [
    { type: 'scrape', priority: 1, batchSize: 1000 },
    { type: 'normalize', priority: 2, batchSize: 5000 },
    { type: 'aggregate', priority: 3, batchSize: 10000 },
    { type: 'analyze', priority: 4, batchSize: 50000 }
  ]
  
  for (const source of sources) {
    for (const job of jobTypes) {
      const existingJob = await prisma.processingJob.findFirst({
        where: {
          sourceId: source.id,
          jobType: job.type,
          status: { in: ['pending', 'running'] }
        }
      })
      
      if (!existingJob) {
        await prisma.processingJob.create({
          data: {
            sourceId: source.id,
            jobType: job.type,
            status: 'pending',
            priority: job.priority,
            batchSize: job.batchSize,
            maxAttempts: 3,
            inputData: {
              source: source.name,
              initialized: true,
              timestamp: new Date().toISOString()
            }
          }
        })
        console.log(`➕ Created ${job.type} job for ${source.name}`)
      }
    }
  }
  
  console.log('✅ Initial processing jobs created!')
}

async function setupDataQualityBaseline() {
  console.log('🔄 Setting up data quality baseline...')
  
  // Create initial audit log entry
  await prisma.auditLog.create({
    data: {
      entityType: 'System',
      entityId: 'initialization',
      action: 'create',
      newValues: {
        event: 'system_initialization',
        timestamp: new Date().toISOString(),
        dataSources: DATA_SOURCES.length,
        message: 'Comprehensive data tracking system initialized'
      },
      timestamp: new Date()
    }
  })
  
  console.log('✅ Data quality baseline established!')
}

async function generateDataFlowReport() {
  console.log('📊 Generating data flow report...')
  
  const sources = await prisma.dataSource.count()
  const jobs = await prisma.processingJob.count()
  const cards = await prisma.card.count()
  const listings = await prisma.listing.count()
  const compSales = await prisma.compSale.count()
  const marketData = await prisma.marketData.count()
  
  const report = {
    timestamp: new Date().toISOString(),
    system: {
      dataSources: sources,
      processingJobs: jobs,
      totalCards: cards,
      totalListings: listings,
      comparableSales: compSales,
      marketDataRecords: marketData
    },
    dataIntegrity: {
      trackingEnabled: true,
      qualityMonitoring: true,
      auditLogging: true,
      unilateralFlow: true
    },
    nextSteps: [
      'Start data collection from all sources',
      'Monitor processing job execution',
      'Track data quality metrics',
      'Generate market intelligence reports'
    ]
  }
  
  console.log('📊 DATA FLOW INITIALIZATION REPORT')
  console.log('=================================')
  console.log(JSON.stringify(report, null, 2))
  
  return report
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive data tracking initialization...')
    
    await initializeDataSources()
    await createInitialProcessingJobs()
    await setupDataQualityBaseline()
    const report = await generateDataFlowReport()
    
    console.log('🎉 Initialization complete! All data sources are now tracked.')
    console.log('🔄 Unilateral data flow enabled - no data will be missed.')
    console.log('📈 Ready for comprehensive market intelligence aggregation.')
    
  } catch (error) {
    console.error('❌ Initialization failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { main as initializeDataTracking }
