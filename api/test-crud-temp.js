#!/usr/bin/env node
/**
 * Phase 1 CRUD Test - Basic create/read operations
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCRUD() {
  console.log('🧪 Testing Phase 1 CRUD operations...');
  
  try {
    // 1. Create or find a test card
    const testCard = await prisma.card.upsert({
      where: {
        set_number_variant_grade: {
          set: 'Base Set',
          number: '4',
          variant: 'Holo',
          grade: 'PSA 10'
        }
      },
      update: {},
      create: {
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

    // 2. Create or update a SourceCatalogItem
    const catalogItem = await prisma.sourceCatalogItem.upsert({
      where: {
        sourceType_externalId: {
          sourceType: 'test_source',
          externalId: 'test_001'
        }
      },
      update: {
        confidence: 1.0,
        isVerified: true
      },
      create: {
        sourceType: 'test_source',
        externalId: 'test_001',
        sourceName: 'Test Charizard Base Set #4 PSA 10',
        sourceSet: 'Base Set',
        sourceNumber: '4',
        cardKey: 'test-base-set-4-holo-psa-10',
        cardId: testCard.id,
        confidence: 1.0,
        isVerified: true,
        notes: 'Test catalog item created by CRUD test'
      }
    });
    console.log('✅ Created SourceCatalogItem:', catalogItem.sourceName);

    // 3. Create a PriceCache entry
    const priceCache = await prisma.priceCache.create({
      data: {
        cardId: testCard.id,
        sourceType: 'tcgplayer',
        priceType: 'market',
        price: 8500.00,
        currency: 'USD',
        confidence: 0.95,
        sampleSize: 10
      }
    });
    console.log('✅ Created PriceCache: $', priceCache.price.toString());

    // 4. Create a ModelInsight
    const insight = await prisma.modelInsight.create({
      data: {
        cardId: testCard.id,
        modelType: 'price_prediction',
        insight: {
          verdict: 'BUY',
          fairValue: 9000.00,
          risks: ['Test risk 1', 'Test risk 2'],
          rationale: 'Test analysis based on market data'
        },
        confidence: 0.85,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    console.log('✅ Created ModelInsight:', insight.modelType);
    console.log('✅ Created ModelInsight:', insight.modelType);

    // 5. Read back all data
    const cards = await prisma.card.findMany({
      include: {
        catalogItems: true,
        priceCache: true,
        modelInsights: true
      }
    });
    console.log(`✅ Found ${cards.length} cards with relations`);

    // 6. Test queries
    const priceData = await prisma.priceCache.findMany({
      where: { cardId: testCard.id }
    });
    console.log(`✅ Found ${priceData.length} price cache entries`);

    console.log('\n🎉 All unified schema CRUD operations completed successfully!');

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
