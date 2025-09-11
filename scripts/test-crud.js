#!/usr/bin/env node
/**
 * Phase 1 CRUD Test - Basic create/read operations
 */

// Change working directory to api for proper Prisma client access
process.chdir(require('path').join(__dirname, '..', 'api'));

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCRUD() {
  console.log('🧪 Testing Phase 1 CRUD operations...');
  
  try {
    // 1. Create a test card
    const testCard = await prisma.card.create({
      data: {
        name: 'Test Charizard',
        set: 'Base Set',
        number: '4',
        variant: 'Holo',
        grade: 'PSA 10',
        condition: 'Mint',
        cardKey: 'test-base-set-4-holo-psa-10'
      }
    });
    console.log('✅ Created Card:', testCard.name);

    // 2. Create a SourceCatalogItem
    const catalogItem = await prisma.sourceCatalogItem.create({
      data: {
        source: 'test_source',
        sourceItemId: 'test_001',
        title: 'Test Charizard Base Set #4 PSA 10',
        setName: 'Base Set',
        number: '4',
        grade: 'PSA 10',
        url: 'https://test.com/card/001',
        cardKey: 'test-base-set-4-holo-psa-10',
        cardId: testCard.id
      }
    });
    console.log('✅ Created SourceCatalogItem:', catalogItem.title);

    // 3. Create a PriceCache entry
    const priceCache = await prisma.priceCache.create({
      data: {
        cardKey: 'test-base-set-4-holo-psa-10',
        cardId: testCard.id,
        windowDays: 7,
        median: 8500.00,
        iqr: 500.00,
        sampleSize: 10
      }
    });
    console.log('✅ Created PriceCache: $', priceCache.median.toString());

    // 4. Create a ModelInsight
    const insight = await prisma.modelInsight.create({
      data: {
        cardKey: 'test-base-set-4-holo-psa-10',
        cardId: testCard.id,
        catalogItemId: catalogItem.id,
        verdict: 'BUY',
        fairValue: 9000.00,
        confidence: 0.85,
        risks: ['Test risk 1', 'Test risk 2'],
        rationale: 'Test analysis',
        inputHash: 'test_hash_123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    console.log('✅ Created ModelInsight:', insight.verdict);

    // 5. Create operational tables
    const cursor = await prisma.scrapeCursor.create({
      data: {
        source: 'test_source',
        cursor: JSON.stringify({ page: 1 })
      }
    });
    console.log('✅ Created ScrapeCursor for:', cursor.source);

    const rateBudget = await prisma.rateBudget.create({
      data: {
        source: 'test_source_2',
        maxPerWindow: 60,
        windowSec: 60,
        usedCount: 5
      }
    });
    console.log('✅ Created RateBudget for:', rateBudget.source);

    // 6. Test relations by fetching card with related data
    const cardWithRelations = await prisma.card.findUnique({
      where: { id: testCard.id },
      include: {
        catalogItems: true,
        priceCache: true,
        modelInsights: true
      }
    });
    
    console.log('\n📊 Relations Test:');
    console.log(`  - Card: ${cardWithRelations.name}`);
    console.log(`  - CatalogItems: ${cardWithRelations.catalogItems.length}`);
    console.log(`  - PriceCache entries: ${cardWithRelations.priceCache.length}`);
    console.log(`  - ModelInsights: ${cardWithRelations.modelInsights.length}`);

    console.log('\n🎉 All CRUD operations successful!');
    return true;
    
  } catch (error) {
    console.error('❌ CRUD test failed:', error);
    return false;
  }
}

testCRUD()
  .then(success => {
    if (!success) process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
