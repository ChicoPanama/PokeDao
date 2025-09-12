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
    for (const cardData of cards) {
      try {
        // Parse card metadata to extract name, set, number
        const { name, set, number, variant, grade, condition } = this.parseCardTitle(cardData.title)
        
        // Create or find the card record
        const card = await prisma.card.upsert({
          where: {
            id: cardData.id
          },
          create: {
            id: cardData.id,
            name,
            set: set || 'Unknown',
            number: number || 'Unknown', 
            variant,
            grade,
            condition,
            cardKey: this.generateCardKey(name, set, number, variant, grade)
          },
          update: {
            name,
            set: set || 'Unknown',
            number: number || 'Unknown',
            variant,
            grade, 
            condition,
            cardKey: this.generateCardKey(name, set, number, variant, grade)
          }
        })

        // Create the listing record (check if exists first)
        const existingListing = await prisma.listing.findFirst({
          where: {
            source: 'collector_crypt',
            sourceItemId: cardData.id
          }
        })
        
        if (existingListing) {
          await prisma.listing.update({
            where: { id: existingListing.id },
            data: {
              price: cardData.price,
              currency: cardData.currency,
              url: cardData.url,
              seller: cardData.seller,
              isActive: cardData.isActive,
              raw: cardData.metadata,
              scrapedAt: new Date(cardData.scrapedAt)
            }
          })
        } else {
          await prisma.listing.create({
            data: {
              cardId: card.id,
              source: 'collector_crypt',
              sourceItemId: cardData.id,
              price: cardData.price,
              currency: cardData.currency,
              url: cardData.url,
              seller: cardData.seller,
              isActive: cardData.isActive,
              raw: cardData.metadata,
              scrapedAt: new Date(cardData.scrapedAt)
            }
          })
        }
      } catch (error) {
        console.error(`Failed to import card ${cardData.id}:`, error)
        // Continue with next card
      }
    }
  }

  private parseCardTitle(title: string): {
    name: string
    set: string | null
    number: string | null  
    variant: string | null
    grade: string | null
    condition: string | null
  } {
    // Basic parsing - could be enhanced with more sophisticated logic
    // For now, just use the title as the name
    return {
      name: title,
      set: null,
      number: null,
      variant: null,
      grade: null,
      condition: null
    }
  }

  private generateCardKey(name: string, set: string | null, number: string | null, variant: string | null, grade: string | null): string {
    const parts = [name, set, number, variant, grade].filter(Boolean)
    return parts.join('|').toLowerCase().replace(/\s+/g, '-')
  }
  
  async generateImportSummary(): Promise<void> {
    console.log('\n📊 DATABASE IMPORT SUMMARY')
    console.log('==========================')
    
    // Total cards
    const totalCards = await prisma.card.count()
    console.log(`Total cards in database: ${totalCards}`)
    
    // Total listings
    const totalListings = await prisma.listing.count()
    console.log(`Total listings in database: ${totalListings}`)
    
    // Collector Crypt listings
    const collectorCryptListings = await prisma.listing.count({
      where: {
        source: 'collector_crypt'
      }
    })
    console.log(`Collector Crypt listings: ${collectorCryptListings}`)
    
    // Active listings
    const activeListings = await prisma.listing.count({
      where: {
        source: 'collector_crypt',
        isActive: true
      }
    })
    console.log(`Active Collector Crypt listings: ${activeListings}`)
    
    // Price analysis
    const priceStats = await prisma.listing.aggregate({
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
    
    if (priceStats._count && priceStats._count.price && priceStats._count.price > 0) {
      console.log(`\n💰 Price Analysis:`)
      console.log(`   Listings with prices: ${priceStats._count.price}`)
      if (priceStats._min?.price && priceStats._max?.price) {
        console.log(`   Price range: $${priceStats._min.price} - $${priceStats._max.price}`)
      }
      if (priceStats._avg?.price) {
        console.log(`   Average price: $${priceStats._avg.price.toFixed(2)}`)
      }
    }
    
    // Most recent imports
    const recentImports = await prisma.listing.findMany({
      where: {
        source: 'collector_crypt'
      },
      orderBy: {
        scrapedAt: 'desc'
      },
      take: 5,
      include: {
        card: {
          select: {
            name: true
          }
        }
      }
    })
    
    console.log(`\n🕒 Most Recent Imports:`)
    recentImports.forEach((listing, index) => {
      console.log(`   ${index + 1}. ${listing.card.name} - $${listing.price} ${listing.currency} (${listing.scrapedAt.toISOString()})`)
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
