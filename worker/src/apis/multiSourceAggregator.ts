import { FanaticsCollectAPI } from './fanaticsCollect.js'
import { TCGPlayerAPI } from './tcgPlayer.js'
import axios from 'axios'

// Import existing Collector Crypt functionality
interface CollectorCryptCard {
  nftAddress: string
  title: string
  price: number
  currency: string
}

interface StandardizedListing {
  id: string
  title: string
  price: number
  currency: string
  source: 'fanatics_collect' | 'tcgplayer' | 'collector_crypt'
  url: string
  seller: string
  isActive: boolean
  scrapedAt: Date
  metadata: any
}

export class MultiSourceCardAggregator {
  private fanaticsAPI: FanaticsCollectAPI
  private tcgPlayerAPI: TCGPlayerAPI
  private collectorCryptURL = 'https://api.collectorcrypt.com/marketplace'

  constructor(tcgPlayerAPIKey?: string) {
    this.fanaticsAPI = new FanaticsCollectAPI()
    this.tcgPlayerAPI = new TCGPlayerAPI(tcgPlayerAPIKey)
  }

  async fetchCollectorCryptData(): Promise<CollectorCryptCard[]> {
    try {
      const response = await axios.get(this.collectorCryptURL, {
        params: {
          page: 1,
          step: 96,
          cardType: 'Card',
          orderBy: 'listedDateDesc'
        },
        headers: {
          'User-Agent': 'PokeDAO/1.0.0'
        }
      })

      const cards = response.data.filterNFtCard || []
      return cards.map((card: any) => ({
        nftAddress: card.nftAddress,
        title: card.itemName || 'Unknown Card',
        price: card.listing?.price || 0,
        currency: card.listing?.currency || 'SOL'
      }))
    } catch (error) {
      console.error('Error fetching Collector Crypt data:', error)
      return []
    }
  }

  async aggregateAllSources(searchTerm: string = 'pokemon'): Promise<{
    listings: StandardizedListing[]
    summary: {
      totalListings: number
      sourceBreakdown: Record<string, number>
      priceRanges: Record<string, { min: number; max: number; avg: number }>
    }
  }> {
    console.log(`🔍 Aggregating Pokemon card data from all sources for: "${searchTerm}"`)

    // Fetch data from all sources in parallel
    const [
      fanaticsData,
      tcgPlayerData,
      collectorCryptCards
    ] = await Promise.all([
      this.fanaticsAPI.fetchLiveAuctionData(),
      this.tcgPlayerAPI.fetchPokemonData(searchTerm),
      this.fetchCollectorCryptData()
    ])

    const allListings: StandardizedListing[] = []

    // Convert Fanatics Collect data
    console.log(`📊 Fanatics Collect: ${fanaticsData.listings.length} auction listings`)
    fanaticsData.listings.forEach(listing => {
      allListings.push(this.fanaticsAPI.convertToStandardFormat(listing))
    })

    // Convert TCGPlayer data
    console.log(`📊 TCGPlayer: ${tcgPlayerData.products.length} products`)
    tcgPlayerData.products.forEach(product => {
      const pricing = tcgPlayerData.pricing.find(p => p.productId === product.productId)
      allListings.push(this.tcgPlayerAPI.convertProductToStandardFormat(product, pricing))
    })

    // Convert Collector Crypt data
    console.log(`📊 Collector Crypt: ${collectorCryptCards.length} NFT cards`)
    collectorCryptCards.forEach(card => {
      allListings.push({
        id: `collector_crypt_${card.nftAddress}`,
        title: card.title,
        price: card.price,
        currency: card.currency,
        source: 'collector_crypt',
        url: `https://collectorcrypt.com/assets/solana/${card.nftAddress}`,
        seller: 'Collector Crypt',
        isActive: true,
        scrapedAt: new Date(),
        metadata: {
          nftAddress: card.nftAddress,
          blockchain: 'solana'
        }
      })
    })

    // Calculate summary statistics
    const sourceBreakdown = allListings.reduce((acc, listing) => {
      acc[listing.source] = (acc[listing.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const priceRanges = this.calculatePriceRanges(allListings)

    console.log(`✅ Total listings aggregated: ${allListings.length}`)
    console.log(`📊 Source breakdown:`, sourceBreakdown)

    return {
      listings: allListings,
      summary: {
        totalListings: allListings.length,
        sourceBreakdown,
        priceRanges
      }
    }
  }

  private calculatePriceRanges(listings: StandardizedListing[]): Record<string, { min: number; max: number; avg: number }> {
    const pricesBySource = listings.reduce((acc, listing) => {
      if (!acc[listing.source]) acc[listing.source] = []
      if (listing.price > 0) acc[listing.source].push(listing.price)
      return acc
    }, {} as Record<string, number[]>)

    const ranges: Record<string, { min: number; max: number; avg: number }> = {}

    for (const [source, prices] of Object.entries(pricesBySource)) {
      if (prices.length > 0) {
        ranges[source] = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: prices.reduce((sum, price) => sum + price, 0) / prices.length
        }
      }
    }

    return ranges
  }

  // Filter listings by criteria
  filterListings(
    listings: StandardizedListing[],
    criteria: {
      minPrice?: number
      maxPrice?: number
      sources?: string[]
      searchTerm?: string
    }
  ): StandardizedListing[] {
    return listings.filter(listing => {
      if (criteria.minPrice && listing.price < criteria.minPrice) return false
      if (criteria.maxPrice && listing.price > criteria.maxPrice) return false
      if (criteria.sources && !criteria.sources.includes(listing.source)) return false
      if (criteria.searchTerm && !listing.title.toLowerCase().includes(criteria.searchTerm.toLowerCase())) return false
      return true
    })
  }

  // Get top listings by various criteria
  getTopListings(listings: StandardizedListing[], criteria: 'price_asc' | 'price_desc' | 'recent', limit: number = 10): StandardizedListing[] {
    let sorted = [...listings]

    switch (criteria) {
      case 'price_asc':
        sorted.sort((a, b) => a.price - b.price)
        break
      case 'price_desc':
        sorted.sort((a, b) => b.price - a.price)
        break
      case 'recent':
        sorted.sort((a, b) => b.scrapedAt.getTime() - a.scrapedAt.getTime())
        break
    }

    return sorted.slice(0, limit)
  }
}
