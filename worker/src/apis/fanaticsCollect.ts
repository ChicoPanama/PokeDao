import axios from 'axios'

interface FanaticsCollectListing {
  id: string
  title: string
  currentBid: {
    amountInCents: number
    currency: string
  }
  bidCount: number
  status: string
  auction: {
    id: string
    status: string
    name: string
    endsAt: string
  }
  images: Array<{
    medium: string
    small: string
    thumbnail: string
  }>
  certifiedSeller: string
  favoritedCount: number
}

interface FanaticsCollectAuction {
  id: string
  name: string
  shortName: string
  status: string
  startsAt: string
  endsAt: string
  integerId: number
}

export class FanaticsCollectAPI {
  private baseURL = 'https://app.fanaticscollect.com/graphql'
  private webURL = 'https://www.fanaticscollect.com'

  // GraphQL query for getting all active auctions
  private readonly globalAuctionsQuery = `
    query webGlobalAuctionsQuery {
      collectGlobalAuctions {
        __typename
        id
        integerId
        name
        shortName
        status
        startsAt
        endsAt
        ... on CollectWeeklyAuction {
          auctionIntegerId
          payoutDate
          collectListingTimer {
            auctionEndsAt
            auctionStartsAt
            windowDurationSeconds
            windowEndsAt
            windowOrdinal
          }
        }
        ... on CollectPremierAuction {
          payoutDate
          collectListingTimer {
            auctionEndsAt
            auctionStartsAt
            windowDurationSeconds
            windowEndsAt
            windowOrdinal
          }
        }
      }
    }
  `

  // GraphQL query for getting Pokemon card listings
  private readonly listingsQuery = `
    query webListingsQuery($input: CollectListingSearchInput!) {
      collectListings(input: $input) {
        __typename
        id
        title
        subtitle
        status
        bidCount
        currentBid {
          amountInCents
          currency
        }
        auction {
          id
          name
          status
          endsAt
        }
        imageSets {
          medium
          small
          thumbnail
        }
        certifiedSeller
        favoritedCount
        collectSales {
          id
          finalPrice {
            amountInCents
            currency
          }
          soldAt
        }
        states {
          isClosed
          isFanaticsAuthentic
          isGreatPrice
          userBidStatus
        }
      }
    }
  `

  async fetchAuctions(): Promise<FanaticsCollectAuction[]> {
    try {
      const response = await axios.post(
        `${this.baseURL}?webGlobalAuctionsQuery`,
        {
          query: this.globalAuctionsQuery,
          variables: {}
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'PokeDAO/1.0.0',
            'Referer': this.webURL,
            'Origin': this.webURL
          }
        }
      )

      if (response.data?.data?.collectGlobalAuctions) {
        return response.data.data.collectGlobalAuctions.map((auction: any) => ({
          id: auction.id,
          name: auction.name,
          shortName: auction.shortName,
          status: auction.status,
          startsAt: auction.startsAt,
          endsAt: auction.endsAt,
          integerId: auction.integerId
        }))
      }

      return []
    } catch (error) {
      console.error('Error fetching Fanatics Collect auctions:', error)
      return []
    }
  }

  async fetchPokemonListings(
    auctionIds?: string[],
    searchTerm: string = 'pokemon',
    limit: number = 50
  ): Promise<FanaticsCollectListing[]> {
    try {
      const variables = {
        input: {
          auctionIds: auctionIds || [],
          first: limit
        }
      }

      const response = await axios.post(
        `${this.baseURL}?webListingsQuery`,
        {
          query: this.listingsQuery,
          variables
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'PokeDAO/1.0.0',
            'Referer': this.webURL,
            'Origin': this.webURL
          }
        }
      )

      if (response.data?.data?.collectListings) {
        return response.data.data.collectListings
          .filter((item: any) => item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((item: any) => ({
            id: item.id,
            title: item.title,
            currentBid: item.currentBid,
            bidCount: item.bidCount,
            status: item.status,
            auction: item.auction,
            images: item.imageSets || [],
            certifiedSeller: item.certifiedSeller,
            favoritedCount: item.favoritedCount
          }))
      }

      return []
    } catch (error) {
      console.error('Error fetching Fanatics Collect listings:', error)
      return []
    }
  }

  async fetchLiveAuctionData(): Promise<{
    auctions: FanaticsCollectAuction[]
    listings: FanaticsCollectListing[]
  }> {
    const auctions = await this.fetchAuctions()
    const liveAuctions = auctions.filter(a => a.status === 'LIVE' || a.status === 'PREVIEW')
    const auctionIds = liveAuctions.map(a => a.id)
    
    const listings = await this.fetchPokemonListings(auctionIds, 'pokemon', 100)

    return {
      auctions: liveAuctions,
      listings
    }
  }

  // Convert to standardized format for PokeDAO
  convertToStandardFormat(listing: FanaticsCollectListing) {
    return {
      id: listing.id,
      title: listing.title,
      price: listing.currentBid.amountInCents / 100, // Convert to dollars
      currency: listing.currentBid.currency,
      source: 'fanatics_collect' as const,
      url: `https://www.fanaticscollect.com/lot/${listing.id}`,
      seller: listing.certifiedSeller,
      isActive: listing.status === 'WEEKLY_STATUS_LISTED',
      scrapedAt: new Date(),
      metadata: {
        bidCount: listing.bidCount,
        favoritedCount: listing.favoritedCount,
        auctionId: listing.auction.id,
        auctionName: listing.auction.name,
        auctionEndsAt: listing.auction.endsAt,
        images: listing.images
      }
    }
  }
}
