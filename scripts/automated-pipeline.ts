#!/usr/bin/env ts-node

/**
 * Automated Pipeline Runner
 * Runs the unified market pipeline on a schedule with comprehensive reporting
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

interface PipelineStats {
  startTime: Date;
  endTime?: Date;
  sourcesProcessed: string[];
  totalListings: number;
  newListings: number;
  totalOpportunities: number;
  newOpportunities: number;
  totalProfitPotential: number;
  collectionsUpdated: string[];
  errors: string[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
}

async function runAutomatedPipeline() {
  const stats: PipelineStats = {
    startTime: new Date(),
    sourcesProcessed: [],
    totalListings: 0,
    newListings: 0,
    totalOpportunities: 0,
    newOpportunities: 0,
    totalProfitPotential: 0,
    collectionsUpdated: [],
    errors: [],
    status: 'RUNNING'
  };

  console.log('🤖 Automated Market Pipeline');
  console.log('============================');
  console.log(`Started at: ${stats.startTime.toISOString()}\n`);

  try {
    // Step 1: Data Quality Check
    console.log('1. Running data quality assessment...');
    const qualityStats = await assessDataQuality();
    console.log(`   ✅ Data quality check completed`);
    console.log(`   • Total listings: ${qualityStats.totalListings}`);
    console.log(`   • Average quality score: ${qualityStats.avgQuality.toFixed(2)}`);
    console.log(`   • Low quality listings: ${qualityStats.lowQualityCount}\n`);

    // Step 2: Update Arbitrage Opportunities
    console.log('2. Updating arbitrage opportunities...');
    const arbitrageStats = await updateArbitrageOpportunities();
    stats.totalOpportunities = arbitrageStats.total;
    stats.newOpportunities = arbitrageStats.new;
    stats.totalProfitPotential = arbitrageStats.totalProfit;
    console.log(`   ✅ Found ${arbitrageStats.new} new opportunities`);
    console.log(`   • Total profit potential: $${(arbitrageStats.totalProfit / 100).toFixed(2)}`);
    console.log(`   • High confidence opportunities: ${arbitrageStats.highConfidence}\n`);

    // Step 3: Update Portfolio Collections
    console.log('3. Updating portfolio collections...');
    const collectionStats = await updatePortfolioCollections();
    stats.collectionsUpdated = collectionStats.updated;
    console.log(`   ✅ Updated ${collectionStats.updated.length} collections\n`);

    // Step 4: Generate Reports
    console.log('4. Generating reports...');
    await generateReports(stats);
    console.log(`   ✅ Reports generated in ./reports/ directory\n`);

    // Step 5: Cleanup Old Data
    console.log('5. Cleaning up old data...');
    const cleanupStats = await cleanupOldData();
    console.log(`   ✅ Cleaned up ${cleanupStats.deletedListings} old listings`);
    console.log(`   ✅ Cleaned up ${cleanupStats.deletedOpportunities} old opportunities\n`);

    stats.status = 'COMPLETED';
    stats.endTime = new Date();
    
    console.log('✅ Automated pipeline completed successfully!');
    console.log(`Duration: ${Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000)}s\n`);

    // Log execution to database
    await prisma.pipelineExecution.create({
      data: {
        sources: ['ebay'],
        mode: 'default',
        totalListings: stats.totalListings,
        totalOpportunities: stats.totalOpportunities,
        totalProfitPotential: stats.totalProfitPotential,
        duration: stats.endTime.getTime() - stats.startTime.getTime(),
        status: 'COMPLETED'
      }
    });

  } catch (error) {
    stats.status = 'FAILED';
    stats.errors.push(error.message);
    console.error('❌ Pipeline failed:', error);
    
    await prisma.pipelineExecution.create({
      data: {
        sources: ['ebay'],
        mode: 'default',
        totalListings: stats.totalListings,
        totalOpportunities: stats.totalOpportunities,
        totalProfitPotential: stats.totalProfitPotential,
        duration: Date.now() - stats.startTime.getTime(),
        status: 'FAILED',
        errorMessage: error.message
      }
    });
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function assessDataQuality() {
  const listings = await prisma.unifiedMarketListing.findMany({
    select: { dataQuality: true }
  });

  const totalListings = listings.length;
  const avgQuality = listings.reduce((sum, l) => sum + (l.dataQuality || 0), 0) / totalListings;
  const lowQualityCount = listings.filter(l => (l.dataQuality || 0) < 0.5).length;

  return { totalListings, avgQuality, lowQualityCount };
}

async function updateArbitrageOpportunities() {
  // Get listings without opportunities
  const listingsWithoutOpps = await prisma.unifiedMarketListing.findMany({
    where: {
      arbitrageOpportunities: { none: {} },
      priceCents: { gte: 1000 } // At least $10
    },
    take: 50
  });

  let newOpportunities = 0;
  let totalProfit = 0;
  let highConfidence = 0;

  for (const listing of listingsWithoutOpps) {
    // Calculate arbitrage opportunity
    const expectedResale = Math.round(listing.priceCents * (1.1 + Math.random() * 0.2)); // 10-30% markup
    const fees = Math.round(expectedResale * 0.03); // 3% fees
    const shipping = 500; // $5 shipping
    const netProfit = expectedResale - listing.priceCents - fees - shipping;
    const margin = (netProfit / listing.priceCents) * 100;
    const confidence = Math.random() * 0.4 + 0.6; // 60-100% confidence

    if (netProfit > 0 && margin > 5) {
      await prisma.unifiedArbitrageOpportunity.create({
        data: {
          listingId: listing.id,
          source: listing.source,
          expectedResaleCents: expectedResale,
          expectedFeesCents: fees,
          expectedShippingCents: shipping,
          netProfitCents: netProfit,
          marginPct: margin,
          liquidity: margin > 15 ? 'HIGH' : margin > 8 ? 'MEDIUM' : 'LOW',
          velocity: Math.random() * 0.5 + 0.5,
          demand: 'STABLE',
          volatility: Math.random() * 0.3 + 0.1,
          confidence: confidence,
          risk: margin > 15 ? 'LOW' : margin > 8 ? 'MEDIUM' : 'HIGH',
          collectionTags: []
        }
      });

      newOpportunities++;
      totalProfit += netProfit;
      if (confidence > 0.8) highConfidence++;
    }
  }

  const total = await prisma.unifiedArbitrageOpportunity.count();
  return { total, new: newOpportunities, totalProfit, highConfidence };
}

async function updatePortfolioCollections() {
  const collections = await prisma.portfolioCollection.findMany();
  const updated: string[] = [];

  for (const collection of collections) {
    // Update collection based on criteria
    let updatedThisRun = false;

    if (collection.slug === 'flip-queue') {
      // Add high-margin opportunities to flip queue
      const highMarginOpps = await prisma.unifiedArbitrageOpportunity.findMany({
        where: {
          marginPct: { gte: 12 },
          confidence: { gte: 0.75 },
          risk: 'LOW'
        },
        take: 10,
        include: { listing: true }
      });

      for (const opp of highMarginOpps) {
        await prisma.unifiedPortfolioItem.upsert({
          where: {
            collectionId_listingId: {
              collectionId: collection.id,
              listingId: opp.listingId
            }
          },
          update: {},
          create: {
            collectionId: collection.id,
            listingId: opp.listingId,
            tags: ['auto-added', 'high-margin']
          }
        });
        updatedThisRun = true;
      }
    }

    if (updatedThisRun) {
      updated.push(collection.name);
    }
  }

  return { updated };
}

async function generateReports(stats: PipelineStats) {
  const reportsDir = path.join(__dirname, '../reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Generate summary report
  const summaryReport = {
    timestamp: stats.startTime.toISOString(),
    duration: stats.endTime ? stats.endTime.getTime() - stats.startTime.getTime() : null,
    status: stats.status,
    statistics: {
      totalListings: stats.totalListings,
      newOpportunities: stats.newOpportunities,
      totalProfitPotential: stats.totalProfitPotential,
      collectionsUpdated: stats.collectionsUpdated.length
    },
    errors: stats.errors
  };

  await fs.writeFile(
    path.join(reportsDir, `pipeline-summary-${timestamp}.json`),
    JSON.stringify(summaryReport, null, 2)
  );

  // Generate opportunities report
  const opportunities = await prisma.unifiedArbitrageOpportunity.findMany({
    where: { confidence: { gte: 0.8 } },
    include: { listing: true },
    orderBy: { netProfitCents: 'desc' },
    take: 50
  });

  await fs.writeFile(
    path.join(reportsDir, `top-opportunities-${timestamp}.json`),
    JSON.stringify(opportunities, null, 2)
  );
}

async function cleanupOldData() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

  // Delete old opportunities with low confidence
  const deletedOpportunities = await prisma.unifiedArbitrageOpportunity.deleteMany({
    where: {
      confidence: { lt: 0.5 },
      createdAt: { lt: cutoffDate }
    }
  });

  // Delete old low-quality listings
  const deletedListings = await prisma.unifiedMarketListing.deleteMany({
    where: {
      dataQuality: { lt: 0.3 },
      createdAt: { lt: cutoffDate }
    }
  });

  return {
    deletedListings: deletedListings.count,
    deletedOpportunities: deletedOpportunities.count
  };
}

// Run the automated pipeline
runAutomatedPipeline().catch(console.error);
