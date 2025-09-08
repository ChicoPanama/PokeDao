import axios from 'axios'
import { writeFileSync } from 'fs'

interface CollectorCryptCard {
  nftAddress: string
  itemName: string
  category: string
  year: number
  grade: string
  gradeNum: number
  gradingCompany: string
  gradingID: string
  insuredValue: string
  blockchain: string
  vault: string
  vaultId: string
  status: string
  authenticated: boolean
  frontImage: string
  backImage: string
  images: {
    front: string
    frontM: string
    frontS: string
    back: string
    backM: string
    backS: string
  }
  listing?: {
    price: number
    currency: string
    sellerId: string
    createdAt: string
  }
  owner: {
    id: string
    name: string | null
    wallet: string
  }
}

export class CollectorCryptHarvester {
  private baseURL = 'https://api.collectorcrypt.com/marketplace'
  private allCards: CollectorCryptCard[] = []
  private delay = 500 // ms between requests to be respectful

  async harvestAllCards(): Promise<CollectorCryptCard[]> {
    console.log('🚀 Starting complete Collector Crypt marketplace harvest...')
    console.log('📊 This will download ALL Pokemon cards from the marketplace')
    
    let page = 1
    let totalPages = 1
    let totalCards = 0
    
    try {
      // First request to get total pages
      console.log('\n📡 Getting marketplace overview...')
      const firstResponse = await this.fetchPage(1)
      
      if (!firstResponse.success) {
        throw new Error('Failed to fetch first page')
      }
      
      totalPages = firstResponse.totalPages
      totalCards = firstResponse.totalCards
      this.allCards = this.allCards.concat(firstResponse.cards)
      
      console.log(`✅ Found ${totalCards} total cards across ${totalPages} pages`)
      console.log(`📄 Page 1/${totalPages} completed (${firstResponse.cards.length} cards)`)
      
      // Fetch remaining pages
      for (page = 2; page <= totalPages; page++) {
        console.log(`📄 Fetching page ${page}/${totalPages}...`)
        
        const response = await this.fetchPage(page)
        
        if (response.success) {
          this.allCards = this.allCards.concat(response.cards)
          const progress = ((page / totalPages) * 100).toFixed(1)
          console.log(`✅ Page ${page}/${totalPages} completed (${response.cards.length} cards) - ${progress}%`)
        } else {
          console.warn(`⚠️  Failed to fetch page ${page}, skipping...`)
        }
        
        // Rate limiting - be respectful to the API
        await this.sleep(this.delay)
        
        // Progress update every 10 pages
        if (page % 10 === 0) {
          console.log(`\n📊 Progress Update:`)
          console.log(`   Pages completed: ${page}/${totalPages}`)
          console.log(`   Cards collected: ${this.allCards.length}`)
          console.log(`   Estimated remaining: ${totalCards - this.allCards.length}`)
        }
      }
      
      console.log(`\n🎉 Harvest Complete!`)
      console.log(`📊 Final Statistics:`)
      console.log(`   Total pages processed: ${totalPages}`)
      console.log(`   Total cards collected: ${this.allCards.length}`)
      console.log(`   Expected vs Actual: ${totalCards} vs ${this.allCards.length}`)
      
      return this.allCards
      
    } catch (error) {
      console.error('❌ Harvest failed:', error)
      console.log(`📊 Partial results: ${this.allCards.length} cards collected before failure`)
      return this.allCards
    }
  }

  private async fetchPage(page: number): Promise<{
    success: boolean
    cards: CollectorCryptCard[]
    totalPages: number
    totalCards: number
  }> {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          page: page,
          step: 96, // Maximum cards per page
          cardType: 'Card',
          orderBy: 'listedDateDesc'
        },
        headers: {
          'User-Agent': 'PokeDAO/1.0.0 - Complete Marketplace Harvest',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      })

      const data = response.data
      const cards: CollectorCryptCard[] = (data.filterNFtCard || []).map((card: any) => ({
        nftAddress: card.nftAddress,
        itemName: card.itemName || 'Unknown Card',
        category: card.category || 'Unknown',
        year: card.year || 0,
        grade: card.grade || 'Ungraded',
        gradeNum: card.gradeNum || 0,
        gradingCompany: card.gradingCompany || 'None',
        gradingID: card.gradingID || '',
        insuredValue: card.insuredValue || '0',
        blockchain: card.blockchain || 'Solana',
        vault: card.vault || '',
        vaultId: card.vaultId || '',
        status: card.status || 'Unknown',
        authenticated: card.authenticated || false,
        frontImage: card.frontImage || '',
        backImage: card.backImage || '',
        images: card.images || {},
        listing: card.listing ? {
          price: card.listing.price || 0,
          currency: card.listing.currency || 'SOL',
          sellerId: card.listing.sellerId || '',
          createdAt: card.listing.createdAt || ''
        } : undefined,
        owner: card.owner || { id: '', name: null, wallet: '' }
      }))

      return {
        success: true,
        cards,
        totalPages: data.totalPages || 1,
        totalCards: data.findTotal || cards.length
      }
      
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error instanceof Error ? error.message : error)
      return {
        success: false,
        cards: [],
        totalPages: 1,
        totalCards: 0
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Save data in multiple formats for different uses
  async saveHarvestedData(): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    
    // Save complete raw data
    const completeFilename = `collector-crypt-complete-${timestamp}.json`
    writeFileSync(completeFilename, JSON.stringify(this.allCards, null, 2))
    console.log(`💾 Complete data saved to ${completeFilename}`)
    
    // Save Pokemon-only filtered data
    const pokemonCards = this.allCards.filter(card => 
      card.category?.toLowerCase().includes('pokemon') ||
      card.itemName?.toLowerCase().includes('pokemon')
    )
    const pokemonFilename = `collector-crypt-pokemon-${timestamp}.json`
    writeFileSync(pokemonFilename, JSON.stringify(pokemonCards, null, 2))
    console.log(`🎴 Pokemon cards (${pokemonCards.length}) saved to ${pokemonFilename}`)
    
    // Save database-ready format
    const dbFormat = this.allCards.map(card => ({
      id: `collector_crypt_${card.nftAddress}`,
      title: card.itemName,
      price: card.listing?.price || 0,
      currency: card.listing?.currency || 'SOL',
      source: 'collector_crypt',
      url: `https://collectorcrypt.com/assets/solana/${card.nftAddress}`,
      seller: 'Collector Crypt',
      isActive: !!card.listing,
      scrapedAt: new Date().toISOString(),
      metadata: {
        nftAddress: card.nftAddress,
        blockchain: card.blockchain,
        category: card.category,
        year: card.year,
        grade: card.grade,
        gradeNum: card.gradeNum,
        gradingCompany: card.gradingCompany,
        gradingID: card.gradingID,
        insuredValue: card.insuredValue,
        vault: card.vault,
        authenticated: card.authenticated,
        images: card.images,
        owner: card.owner
      }
    }))
    
    const dbFilename = `collector-crypt-database-ready-${timestamp}.json`
    writeFileSync(dbFilename, JSON.stringify(dbFormat, null, 2))
    console.log(`🗄️ Database-ready format saved to ${dbFilename}`)
    
    // Generate summary statistics
    this.generateSummaryStats()
  }

  private generateSummaryStats(): void {
    console.log(`\n📈 COLLECTOR CRYPT MARKETPLACE ANALYSIS`)
    console.log(`==========================================`)
    
    // Basic stats
    console.log(`Total cards: ${this.allCards.length}`)
    
    // Pokemon cards
    const pokemonCards = this.allCards.filter(card => 
      card.category?.toLowerCase().includes('pokemon') ||
      card.itemName?.toLowerCase().includes('pokemon')
    )
    console.log(`Pokemon cards: ${pokemonCards.length} (${(pokemonCards.length / this.allCards.length * 100).toFixed(1)}%)`)
    
    // Listings vs non-listings
    const listedCards = this.allCards.filter(card => card.listing)
    console.log(`Cards with active listings: ${listedCards.length}`)
    
    // Price analysis for listed cards
    if (listedCards.length > 0) {
      const prices = listedCards.map(card => card.listing!.price).filter(price => price > 0)
      if (prices.length > 0) {
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)
        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
        
        console.log(`\n💰 Price Analysis:`)
        console.log(`   Cards with prices: ${prices.length}`)
        console.log(`   Price range: $${minPrice} - $${maxPrice}`)
        console.log(`   Average price: $${avgPrice.toFixed(2)}`)
      }
    }
    
    // Grading company breakdown
    const gradingCompanies = this.allCards.reduce((acc, card) => {
      const company = card.gradingCompany || 'Ungraded'
      acc[company] = (acc[company] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(`\n🏆 Grading Companies:`)
    Object.entries(gradingCompanies)
      .sort(([,a], [,b]) => b - a)
      .forEach(([company, count]) => {
        console.log(`   ${company}: ${count} cards`)
      })
    
    // Year distribution
    const years = this.allCards.reduce((acc, card) => {
      const year = card.year || 0
      if (year > 1990) { // Only count realistic years
        acc[year] = (acc[year] || 0) + 1
      }
      return acc
    }, {} as Record<number, number>)
    
    console.log(`\n📅 Year Distribution (Top 10):`)
    Object.entries(years)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([year, count]) => {
        console.log(`   ${year}: ${count} cards`)
      })
  }
}

// Main execution function
async function main() {
  const harvester = new CollectorCryptHarvester()
  
  console.log('🎯 PokeDAO Complete Collector Crypt Marketplace Harvest')
  console.log('=======================================================')
  
  try {
    const cards = await harvester.harvestAllCards()
    await harvester.saveHarvestedData()
    
    console.log('\n✅ HARVEST COMPLETED SUCCESSFULLY!')
    console.log(`📊 Total cards collected: ${cards.length}`)
    console.log('🗄️ Data saved in multiple formats for database import')
    
  } catch (error) {
    console.error('❌ Harvest failed:', error)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
