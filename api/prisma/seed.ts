/**
 * Phase 1 Seed Script - PokeDAO Core Tables
 * Creates minimal fixtures for testing and development
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding PokeDAO Phase 1 data...')

  // Test table existence first
  console.log('Testing table access...')
  try {
    await prisma.card.count()
    await prisma.sourceCatalogItem.count()
    console.log('✅ All tables accessible')
  } catch (e) {
    console.error('❌ Table access error:', e)
    throw e
  }

  // 1. Create sample Cards (removing cardKey for now since it's causing type issues)
  const charizardCard = await prisma.card.create({
    data: {
      name: 'Charizard',
      set: 'Base Set',
      number: '4',
      variant: 'Holo',
      grade: 'PSA 10',
      condition: 'Mint'
    }
  })

  const pikachuCard = await prisma.card.create({
    data: {
      name: 'Pikachu',
      set: 'Base Set',
      number: '25',
      variant: null,
      grade: 'PSA 9',
      condition: 'Near Mint'
    }
  })

  console.log('✅ Created sample Cards')

  // 2. Create SourceCatalogItems 
  const collectorCryptItem = await prisma.sourceCatalogItem.create({
    data: {
      source: 'collector_crypt',
      sourceItemId: 'cc_charizard_001',
      title: 'Charizard Base Set #4 PSA 10 Holo Rare',
      setName: 'Base Set',
      number: '4',
      grade: 'PSA 10',
      url: 'https://collectorcrypt.com/cards/charizard-001',
      cardKey: 'base-set-4-holo-psa-10',
      cardId: charizardCard.id
    }
  })

  console.log('✅ Created SourceCatalogItems')

  // 3. Create sample Listings (basic version without new fields)
  await prisma.listing.create({
    data: {
      cardId: charizardCard.id,
      source: 'collector_crypt',
      price: 8500.00,
      currency: 'USD',
      url: 'https://collectorcrypt.com/cards/charizard-001',
      seller: 'CryptoCardDealer'
    }
  })

  console.log('✅ Created sample Listings')

  // 4. Create PriceCache entries
  await prisma.priceCache.create({
    data: {
      cardKey: 'base-set-4-holo-psa-10',
      cardId: charizardCard.id,
      windowDays: 7,
      median: 8850.00,
      iqr: 750.00,
      sampleSize: 12
    }
  })

  console.log('✅ Created PriceCache entries')

  // 5. Create sample ModelInsights
  await prisma.modelInsight.create({
    data: {
      cardKey: 'base-set-4-holo-psa-10',
      cardId: charizardCard.id,
      catalogItemId: collectorCryptItem.id,
      verdict: 'BUY',
      fairValue: 9200.00,
      confidence: 0.85,
      risks: ['Market volatility', 'Authentication risk'],
      rationale: 'Listed 8% below recent comps with strong seller reputation',
      inputHash: 'hash_charizard_cc_001',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h from now
    }
  })

  console.log('✅ Created ModelInsights')

  // 6. Create operational tables
  await prisma.scrapeCursor.create({
    data: {
      source: 'collector_crypt',
      cursor: JSON.stringify({ page: 1, lastItemId: 'cc_charizard_001' })
    }
  })

  await prisma.rateBudget.create({
    data: {
      source: 'collector_crypt',
      maxPerWindow: 60,
      windowSec: 60,
      usedCount: 5
    }
  })

  console.log('✅ Created operational tables')

  // Summary
  const counts = await Promise.all([
    prisma.card.count(),
    prisma.sourceCatalogItem.count(),
    prisma.listing.count(),
    prisma.priceCache.count(),
    prisma.modelInsight.count(),
    prisma.scrapeCursor.count(),
    prisma.rateBudget.count()
  ])

  console.log('\n🎉 Phase 1 Seed Complete!')
  console.log('📊 Created:')
  console.log(`  - Cards: ${counts[0]}`)
  console.log(`  - SourceCatalogItems: ${counts[1]}`) 
  console.log(`  - Listings: ${counts[2]}`)
  console.log(`  - PriceCache: ${counts[3]}`)
  console.log(`  - ModelInsights: ${counts[4]}`)
  console.log(`  - ScrapeCursors: ${counts[5]}`)
  console.log(`  - RateBudgets: ${counts[6]}`)
  console.log('\n✅ Ready for Phase 2 (Normalization)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
