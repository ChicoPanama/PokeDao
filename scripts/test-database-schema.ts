/**
 * DATABASE SCHEMA VALIDATION TEST
 * Verifies the Prisma schema matches the actual database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabaseSchema() {
  console.log('🔍 DATABASE SCHEMA VALIDATION TEST');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test 1: CanonicalCard model
    console.log('Test 1: CanonicalCard model');
    const cardCount = await prisma.canonicalCard.count();
    console.log(`✅ Found ${cardCount.toLocaleString()} canonical cards`);

    const sampleCard = await prisma.canonicalCard.findFirst({
      include: { officialCard: true },
    });
    if (sampleCard) {
      console.log(`   Sample: ${sampleCard.canonicalName} - ${sampleCard.canonicalSet}`);
      console.log(`   Rarity: ${sampleCard.rarity || 'Unknown'}`);
    }
    console.log('');

    // Test 2: UnifiedMarketListing model
    console.log('Test 2: UnifiedMarketListing model');
    const listingCount = await prisma.unifiedMarketListing.count({
      where: { priceCents: { gt: 0 } },
    });
    console.log(`✅ Found ${listingCount.toLocaleString()} market listings`);

    const sampleListing = await prisma.unifiedMarketListing.findFirst({
      where: {
        priceCents: { gte: 5000 },
        cardName: { not: null },
      },
    });
    if (sampleListing) {
      console.log(`   Sample: ${sampleListing.cardName} - $${(sampleListing.priceCents! / 100).toFixed(2)}`);
      console.log(`   Source: ${sampleListing.source}`);
    }
    console.log('');

    // Test 3: SaleRecord model
    console.log('Test 3: SaleRecord model');
    const saleCount = await prisma.saleRecord.count();
    console.log(`✅ Found ${saleCount.toLocaleString()} sale records`);
    if (saleCount === 0) {
      console.log('   ⚠️  No sale records found - comps will need to be populated');
    }
    console.log('');

    // Test 4: OfficialPokemonCard model
    console.log('Test 4: OfficialPokemonCard model');
    const officialCount = await prisma.officialPokemonCard.count();
    console.log(`✅ Found ${officialCount.toLocaleString()} official Pokemon cards (TCGdex data)`);

    const sampleOfficial = await prisma.officialPokemonCard.findFirst({
      where: { rarity: { not: null } },
    });
    if (sampleOfficial) {
      console.log(`   Sample: ${sampleOfficial.name} - ${sampleOfficial.setName}`);
      console.log(`   Rarity: ${sampleOfficial.rarity}`);
    }
    console.log('');

    // Test 5: MarketListing model
    console.log('Test 5: MarketListing model');
    const marketListingCount = await prisma.marketListing.count();
    console.log(`✅ Found ${marketListingCount.toLocaleString()} market_listings records`);
    console.log('');

    // Test 6: CardSignal model
    console.log('Test 6: CardSignal model');
    const signalCount = await prisma.cardSignal.count();
    console.log(`✅ Found ${signalCount.toLocaleString()} card signals`);
    if (signalCount > 0) {
      const topSignal = await prisma.cardSignal.findFirst({
        orderBy: { opportunityScore: 'desc' },
        include: { canonicalCard: true },
      });
      if (topSignal) {
        console.log(`   Top Signal: ${topSignal.canonicalCard.canonicalName}`);
        console.log(`   Opportunity Score: ${topSignal.opportunityScore.toFixed(1)}`);
      }
    }
    console.log('');

    // Test 7: ConsensusPricing model
    console.log('Test 7: ConsensusPricing model');
    const consensusCount = await prisma.consensusPricing.count();
    console.log(`✅ Found ${consensusCount.toLocaleString()} consensus pricing records`);
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('✅ DATABASE SCHEMA VALIDATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Schema Status:');
    console.log('  ✅ All Prisma models successfully queried');
    console.log('  ✅ Schema matches actual database tables');
    console.log('  ✅ Foreign key relationships working');
    console.log('');
    console.log('Data Availability:');
    console.log(`  ✅ Canonical Cards: ${cardCount.toLocaleString()}`);
    console.log(`  ✅ Listings: ${listingCount.toLocaleString()}`);
    console.log(`  ${saleCount === 0 ? '⚠️ ' : '✅'} Sale Records: ${saleCount.toLocaleString()}`);
    console.log(`  ✅ Official Cards: ${officialCount.toLocaleString()}`);
    console.log('');

    if (saleCount === 0) {
      console.log('⚠️  NOTE: No sale records found.');
      console.log('   To test the full pipeline, you need to populate sale_records.');
      console.log('   For now, you can test with mock data or use existing market_listings.');
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ Schema validation failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseSchema();
