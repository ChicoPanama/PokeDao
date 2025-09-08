#!/usr/bin/env node

/**
 * TCGPlayer Harvest Cache Exporter
 * Exports current database to JSON for caching and future use
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./tcgplayer.db'
    }
  }
})

async function exportHarvestCache() {
  console.log('🗄️  Exporting TCGPlayer harvest cache...')
  
  try {
    // Get all products
    const products = await prisma.tcgplayer_products.findMany({
      orderBy: { created_at: 'desc' }
    })
    
    console.log(`📦 Found ${products.length} total products`)
    
    // Get sets summary
    const setSummary = await prisma.tcgplayer_products.groupBy({
      by: ['set_name'],
      _count: {
        set_name: true
      },
      where: {
        set_name: {
          not: null
        }
      },
      orderBy: {
        _count: {
          set_name: 'desc'
        }
      }
    })
    
    console.log(`🎴 Found ${setSummary.length} unique sets`)
    
    // Create cache export
    const cacheData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalProducts: products.length,
        uniqueSets: setSummary.length,
        source: 'tcgplayer-mega-harvester',
        description: 'Complete Pokemon card harvest from TCGPlayer with removed duplicate thresholds'
      },
      setSummary: setSummary.map(s => ({
        setName: s.set_name,
        cardCount: s._count.set_name
      })),
      products: products
    }
    
    // Export to JSON
    const filename = `tcgplayer-harvest-cache-${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(cacheData, null, 2))
    
    console.log(`✅ Cache exported to: ${filename}`)
    console.log(`📊 Cache Summary:`)
    console.log(`   Total Products: ${cacheData.metadata.totalProducts}`)
    console.log(`   Unique Sets: ${cacheData.metadata.uniqueSets}`)
    
    // Show top 10 sets by card count
    console.log(`\n🏆 Top 10 Sets by Card Count:`)
    cacheData.setSummary.slice(0, 10).forEach((set, index) => {
      console.log(`   ${index + 1}. ${set.setName}: ${set.cardCount} cards`)
    })
    
    // Show price ranges
    const prices = products
      .filter(p => p.price && p.price > 0)
      .map(p => parseFloat(p.price))
      .sort((a, b) => a - b)
    
    if (prices.length > 0) {
      console.log(`\n💰 Price Analysis:`)
      console.log(`   Cards with prices: ${prices.length}`)
      console.log(`   Cheapest: $${prices[0].toFixed(2)}`)
      console.log(`   Most expensive: $${prices[prices.length - 1].toFixed(2)}`)
      console.log(`   Average: $${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}`)
    }
    
    // Create compressed cache for integration
    const compressedCache = {
      metadata: cacheData.metadata,
      cardSummary: {
        totalCards: products.length,
        setsCount: setSummary.length,
        priceRange: prices.length > 0 ? {
          min: prices[0],
          max: prices[prices.length - 1],
          avg: prices.reduce((a, b) => a + b, 0) / prices.length
        } : null
      },
      topSets: cacheData.setSummary.slice(0, 20),
      sampleCards: products.slice(0, 100) // First 100 cards for preview
    }
    
    const compressedFilename = `tcgplayer-cache-summary-${Date.now()}.json`
    fs.writeFileSync(compressedFilename, JSON.stringify(compressedCache, null, 2))
    console.log(`📋 Compressed cache created: ${compressedFilename}`)
    
  } catch (error) {
    console.error('❌ Cache export failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

exportHarvestCache().catch(console.error)
