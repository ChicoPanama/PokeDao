import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CollectorCryptCard {
  id: string
  title: string
  price: number
  currency: string
  source: string
  url: string
  seller: string
  isActive: boolean
  scrapedAt: string
  metadata: {
    nftAddress: string
    blockchain: string
    category: string
    year: number
    grade: string
    gradeNum: number
    gradingCompany: string
    gradingID: string
    insuredValue: string
    vault: string
    authenticated: boolean
    images: any
    owner: any
  }
}

export class CollectorCryptDatabaseImporter {
  
  async importFromFile(filename: string): Promise<void> {
    console.log(`🚀 Starting database import from ${filename}`)
    
    try {
      // Read the harvested data
      const data = JSON.parse(readFileSync(filename, 'utf-8')) as CollectorCryptCard[]
      console.log(`📄 Loaded ${data.length} cards from file`)
      
      // Check which cards already exist
      const existingCards = await this.checkExistingCards(data)
      const newCards = data.filter(card => !existingCards.has(card.id))
      
      console.log(`📊 Import Analysis:`)
      console.log(`   Total cards in file: ${data.length}`)
      console.log(`   Already in database: ${existingCards.size}`)
      console.log(`   New cards to import: ${newCards.length}`)
      
      if (newCards.length === 0) {
        console.log('✅ All cards already exist in database. Nothing to import.')
        return
      }
      
      // Import new cards in batches
      await this.importCardsInBatches(newCards)
      
      console.log('✅ Database import completed successfully!')
      
    } catch (error) {
      console.error('❌ Database import failed:', error)
      throw error
    } finally {
      await prisma.$disconnect()
    }
  }
  
  private async checkExistingCards(cards: CollectorCryptCard[]): Promise<Set<string>> {
    console.log('🔍 Checking for existing cards in database...')
    
    const cardIds = cards.map(card => card.id)
    const existing = await prisma.card.findMany({
      where: {
        id: {
          in: cardIds
        }
      },
      select: {
        id: true
      }
    })
    
    return new Set(existing.map(card => card.id))
  }
  
  private async importCardsInBatches(cards: CollectorCryptCard[], batchSize = 100): Promise<void> {
    console.log(`📦 Importing ${cards.length} cards in batches of ${batchSize}...`)
    
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(cards.length / batchSize)
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} cards)...`)
      
      try {
        await this.importBatch(batch)
        console.log(`✅ Batch ${batchNumber}/${totalBatches} completed successfully`)
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error)
        // Continue with next batch instead of failing completely
      }
    }
  }
  
  private async importBatch(cards: CollectorCryptCard[]): Promise<void> {
    const prismaCards = cards.map(card => ({
      id: card.id,
      title: card.title,
      price: card.price,
      currency: card.currency,
      source: card.source,
      url: card.url,
      seller: card.seller,
      isActive: card.isActive,
      scrapedAt: new Date(card.scrapedAt),
      metadata: card.metadata
    }))
    
    await prisma.card.createMany({
      data: prismaCards,
      skipDuplicates: true
    })
  }
  
  async generateImportSummary(): Promise<void> {
    console.log('\n📊 DATABASE IMPORT SUMMARY')
    console.log('==========================')
    
    // Total cards
    const totalCards = await prisma.card.count()
    console.log(`Total cards in database: ${totalCards}`)
    
    // Collector Crypt cards
    const collectorCryptCards = await prisma.card.count({
      where: {
        source: 'collector_crypt'
      }
    })
    console.log(`Collector Crypt cards: ${collectorCryptCards}`)
    
    // Active listings
    const activeListings = await prisma.card.count({
      where: {
        source: 'collector_crypt',
        isActive: true
      }
    })
    console.log(`Active Collector Crypt listings: ${activeListings}`)
    
    // Price analysis
    const priceStats = await prisma.card.aggregate({
      where: {
        source: 'collector_crypt',
        isActive: true,
        price: {
          gt: 0
        }
      },
      _min: {
        price: true
      },
      _max: {
        price: true
      },
      _avg: {
        price: true
      },
      _count: {
        price: true
      }
    })
    
    if (priceStats._count.price > 0) {
      console.log(`\n💰 Price Analysis:`)
      console.log(`   Cards with prices: ${priceStats._count.price}`)
      console.log(`   Price range: $${priceStats._min.price} - $${priceStats._max.price}`)
      console.log(`   Average price: $${priceStats._avg.price?.toFixed(2)}`)
    }
    
    // Most recent imports
    const recentImports = await prisma.card.findMany({
      where: {
        source: 'collector_crypt'
      },
      orderBy: {
        scrapedAt: 'desc'
      },
      take: 5,
      select: {
        title: true,
        price: true,
        currency: true,
        scrapedAt: true
      }
    })
    
    console.log(`\n🕒 Most Recent Imports:`)
    recentImports.forEach((card, index) => {
      console.log(`   ${index + 1}. ${card.title} - $${card.price} ${card.currency} (${card.scrapedAt.toISOString()})`)
    })
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('❌ Please provide a filename to import')
    console.log('Usage: npx tsx collector-crypt-database-importer.ts <filename>')
    console.log('Example: npx tsx collector-crypt-database-importer.ts collector-crypt-database-ready-2025-09-07T12-30-00.json')
    process.exit(1)
  }
  
  const filename = args[0]
  const importer = new CollectorCryptDatabaseImporter()
  
  try {
    await importer.importFromFile(filename)
    await importer.generateImportSummary()
  } catch (error) {
    console.error('Import failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
