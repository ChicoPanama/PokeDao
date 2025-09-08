/**
 * Fanatics Collect Direct API Client
 * Uses discovered GraphQL endpoints to fetch Pokemon card data including sold prices
 */
import fs from 'node:fs/promises'
import path from 'node:path'

interface FanaticsCard {
  __typename: string
  id: string
  integerId: number
  title: string
  slug: string
  subtitle?: string
  lotString?: string
  status: string
  listingType: string
  bidCount: number
  favoritedCount: number
  certifiedSeller: string
  currentBid?: {
    amountInCents: number
    currency: string
  }
  startingPrice?: {
    amountInCents: number
    currency: string
  }
  auction?: {
    id: string
    endsAt?: string
    startsAt?: string
    status?: string
  }
  collectSales: Array<{
    soldPrice: {
      amountInCents: number
      currency: string
    }
    soldAt: string
  }>
  imageSets: Array<{
    medium: string
    small: string
    thumbnail: string
  }>
  states: string[]
  marketplaceEyeAppeal?: number
  highestBidder?: any
  isOwner: boolean
}

interface FanaticsAPIResponse {
  data: {
    collectListings: FanaticsCard[]
  }
}

class FanaticsCollectAPI {
  private baseURL = 'https://www.fanaticscollect.com'
  private graphqlEndpoint = 'https://api.fanaticscollect.com/graphql' // Discovered from network tab
  
  // GraphQL query for Pokemon cards with sold data
  private pokemonQuery = `
    query CollectListings($filters: CollectListingFilterInput, $sort: CollectListingSortInput, $pagination: PaginationInput) {
      collectListings(filters: $filters, sort: $sort, pagination: $pagination) {
        __typename
        id
        integerId
        title
        slug
        subtitle
        lotString
        status
        listingType
        bidCount
        favoritedCount
        certifiedSeller
        currentBid {
          amountInCents
          currency
        }
        startingPrice {
          amountInCents
          currency
        }
        auction {
          id
          endsAt
          startsAt
          status
        }
        collectSales {
          soldPrice {
            amountInCents
            currency
          }
          soldAt
        }
        imageSets {
          medium
          small
          thumbnail
        }
        states
        marketplaceEyeAppeal
        highestBidder
        isOwner
      }
    }
  `

  async fetchPokemonCards(options: {
    page?: number
    pageSize?: number
    includeCompleted?: boolean
    categoryFilter?: string[]
  } = {}): Promise<FanaticsAPIResponse> {
    
    const {
      page = 1,
      pageSize = 24,
      includeCompleted = true,
      categoryFilter = [
        'Trading Card Games > Pokémon (English)',
        'Trading Card Games > Pokémon (Japanese)', 
        'Trading Card Games > Pokémon (Other Languages)'
      ]
    } = options

    const variables = {
      filters: {
        categories: categoryFilter,
        ...(includeCompleted && { status: ['ACTIVE', 'COMPLETED', 'SOLD'] })
      },
      sort: {
        field: 'ENDING_SOON',
        direction: 'ASC'
      },
      pagination: {
        page,
        pageSize
      }
    }

    try {
      console.log(`🌐 Fetching Pokemon cards - Page ${page}`)
      
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.fanaticscollect.com/',
          'Origin': 'https://www.fanaticscollect.com'
        },
        body: JSON.stringify({
          query: this.pokemonQuery,
          variables
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json() as FanaticsAPIResponse
      
      console.log(`✅ Fetched ${data.data.collectListings.length} cards`)
      
      return data
      
    } catch (error) {
      console.error(`❌ API request failed:`, error)
      throw error
    }
  }

  async fetchAllPokemonCards(maxPages = 50): Promise<{
    totalCards: number
    activeCards: number
    soldCards: number
    totalValue: number
    soldValue: number
    cards: FanaticsCard[]
  }> {
    
    console.log('🚀 Starting comprehensive Pokemon card fetch via API')
    console.log('================================================')
    
    let allCards: FanaticsCard[] = []
    let currentPage = 1
    let hasMoreData = true
    
    while (hasMoreData && currentPage <= maxPages) {
      try {
        const response = await this.fetchPokemonCards({ 
          page: currentPage,
          pageSize: 50, // Larger page size for efficiency
          includeCompleted: true 
        })
        
        const cards = response.data.collectListings
        
        if (cards.length === 0) {
          console.log(`📄 No more cards found on page ${currentPage}`)
          hasMoreData = false
          break
        }
        
        allCards.push(...cards)
        console.log(`📊 Page ${currentPage}: ${cards.length} cards (Total: ${allCards.length})`)
        
        // Check for sold cards in this batch
        const soldInBatch = cards.filter(c => 
          c.status === 'COMPLETED' || 
          c.status === 'SOLD' ||
          c.collectSales.length > 0
        ).length
        
        if (soldInBatch > 0) {
          console.log(`   💰 Found ${soldInBatch} sold/completed cards in this batch`)
        }
        
        currentPage++
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`❌ Error on page ${currentPage}:`, error)
        currentPage++
      }
    }
    
    // Calculate metrics
    const activeCards = allCards.filter(c => 
      c.status === 'ACTIVE' || c.status === 'LIVE'
    ).length
    
    const soldCards = allCards.filter(c => 
      c.status === 'COMPLETED' || 
      c.status === 'SOLD' ||
      c.collectSales.length > 0
    ).length
    
    const totalValue = allCards
      .filter(c => c.currentBid?.amountInCents)
      .reduce((sum, c) => sum + (c.currentBid?.amountInCents || 0), 0) / 100
    
    const soldValue = allCards
      .filter(c => c.collectSales.length > 0)
      .reduce((sum, c) => {
        const latestSale = c.collectSales[c.collectSales.length - 1]
        return sum + (latestSale?.soldPrice.amountInCents || 0)
      }, 0) / 100
    
    console.log('\n🎉 FANATICS COLLECT API FETCH COMPLETE!')
    console.log('=====================================')
    console.log(`📊 Total Pokemon Cards: ${allCards.length}`)
    console.log(`🟢 Active Listings: ${activeCards}`)
    console.log(`🔴 Sold/Completed: ${soldCards}`)
    console.log(`💵 Current Market Value: $${totalValue.toLocaleString()}`)
    console.log(`💰 Realized Sales Value: $${soldValue.toLocaleString()}`)
    
    return {
      totalCards: allCards.length,
      activeCards,
      soldCards,
      totalValue,
      soldValue,
      cards: allCards
    }
  }

  async savePokemonData(data: any, filename?: string) {
    const outputPath = path.join(
      process.cwd(), 
      filename || `fanatics-pokemon-api-data-${Date.now()}.json`
    )
    
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2))
    console.log(`💾 Data saved to: ${path.basename(outputPath)}`)
    
    return outputPath
  }
}

// Main execution
async function main() {
  const api = new FanaticsCollectAPI()
  
  try {
    // Test single page first
    console.log('🧪 Testing single page fetch...')
    const testResponse = await api.fetchPokemonCards({ page: 1, pageSize: 5 })
    console.log(`✅ Test successful: ${testResponse.data.collectListings.length} cards`)
    
    // If test works, fetch all data
    if (testResponse.data.collectListings.length > 0) {
      console.log('\n🚀 Proceeding with full data fetch...')
      const allData = await api.fetchAllPokemonCards(30) // Limit to 30 pages for now
      
      // Save comprehensive dataset
      await api.savePokemonData(allData, 'fanatics-pokemon-comprehensive-api-data.json')
      
      // Show top sold items
      const topSales = allData.cards
        .filter(c => c.collectSales.length > 0)
        .sort((a, b) => {
          const aPrice = a.collectSales[a.collectSales.length - 1]?.soldPrice.amountInCents || 0
          const bPrice = b.collectSales[b.collectSales.length - 1]?.soldPrice.amountInCents || 0
          return bPrice - aPrice
        })
        .slice(0, 5)
      
      if (topSales.length > 0) {
        console.log('\n💎 Top 5 Recent Sales:')
        topSales.forEach((card, index) => {
          const sale = card.collectSales[card.collectSales.length - 1]
          const price = sale.soldPrice.amountInCents / 100
          console.log(`   ${index + 1}. $${price.toLocaleString()} - ${card.title} (${sale.soldAt})`)
        })
      }
      
    } else {
      console.log('❌ Test failed - no data returned')
    }
    
  } catch (error) {
    console.error('💥 API fetch failed:', error)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { FanaticsCollectAPI }
