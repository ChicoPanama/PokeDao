#!/usr/bin/env node
/**
 * Phase 1 Table Test - Verify all new tables work
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTables() {
  console.log('🧪 Testing Phase 1 tables...');
  
  try {
    // Test each table count (should work even with empty tables)
    const counts = await Promise.all([
      prisma.card.count(),
      prisma.sourceCatalogItem.count(),
      prisma.listing.count(),
      prisma.priceCache.count(),
      prisma.modelInsight.count(),
      prisma.scrapeCursor.count(),
      prisma.rateBudget.count()
    ]);
    
    console.log('✅ All tables accessible:');
    console.log(`  - Cards: ${counts[0]}`);
    console.log(`  - SourceCatalogItems: ${counts[1]}`);
    console.log(`  - Listings: ${counts[2]}`);
    console.log(`  - PriceCache: ${counts[3]}`);
    console.log(`  - ModelInsights: ${counts[4]}`);
    console.log(`  - ScrapeCursors: ${counts[5]}`);
    console.log(`  - RateBudgets: ${counts[6]}`);
    
    console.log('\n🎉 Phase 1 tables working correctly!');
    return true;
  } catch (error) {
    console.error('❌ Table test failed:', error.message);
    return false;
  }
}

testTables()
  .then(success => {
    if (!success) process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
