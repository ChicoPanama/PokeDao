import axios from 'axios'

interface TCGPlayerProduct {
  productId: number
  name: string
  category: string
  groupId: number
  imageUrl?: string
  url?: string
}

interface TCGPlayerPrice {
  productId: number
  lowPrice?: number
  midPrice?: number
  highPrice?: number
  marketPrice?: number
  directLowPrice?: number
  subTypeName?: string
}

export class TCGPlayerAPI {
  private baseURL = 'https://api.tcgplayer.com'
  private webURL = 'https://www.tcgplayer.com'
  private marketplaceURL = 'https://homepage.marketplace.tcgplayer.com'
  private navigationURL = 'https://marketplace-navigation.tcgplayer.com'

  // For authenticated endpoints (when we have API keys)
  private apiKey?: string
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  async fetchMarketplaceData(): Promise<any> {
    try {
      const response = await axios.get(`${this.marketplaceURL}/default.json`, {
        headers: {
          'User-Agent': 'PokeDAO/1.0.0',
          'Referer': this.webURL
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching TCGPlayer marketplace data:', error)
      return null
    }
  }

  async fetchNavigationData(): Promise<any> {
    try {
      const response = await axios.get(`${this.navigationURL}/marketplace-navigation-search-feature.json`, {
        headers: {
          'User-Agent': 'PokeDAO/1.0.0',
          'Referer': this.webURL
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching TCGPlayer navigation data:', error)
      return null
    }
  }

  // Test authenticated endpoints (requires API key)
  async fetchCategories(): Promise<any[]> {
    if (!this.apiKey) {
      console.warn('TCGPlayer API key required for catalog access')
      return []
    }

    try {
      const response = await axios.get(`${this.baseURL}/catalog/categories`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'PokeDAO/1.0.0'
        }
      })
      return response.data?.results || []
    } catch (error) {
      console.error('Error fetching TCGPlayer categories:', error)
      return []
    }
  }

  async searchProducts(searchTerm: string = 'pokemon'): Promise<TCGPlayerProduct[]> {
    if (!this.apiKey) {
      console.warn('TCGPlayer API key required for product search')
      return []
    }

    try {
      const response = await axios.get(`${this.baseURL}/catalog/products`, {
        params: {
          categoryName: 'Pokemon',
          productName: searchTerm,
          limit: 50
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'PokeDAO/1.0.0'
        }
      })

      if (response.data?.results) {
        return response.data.results.map((product: any) => ({
          productId: product.productId,
          name: product.name,
          category: product.categoryName,
          groupId: product.groupId,
          imageUrl: product.imageUrl,
          url: product.url
        }))
      }

      return []
    } catch (error) {
      console.error('Error searching TCGPlayer products:', error)
      return []
    }
  }

  async fetchPricing(productIds: number[]): Promise<TCGPlayerPrice[]> {
    if (!this.apiKey) {
      console.warn('TCGPlayer API key required for pricing data')
      return []
    }

    try {
      const response = await axios.get(`${this.baseURL}/pricing/product/${productIds.join(',')}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'PokeDAO/1.0.0'
        }
      })

      if (response.data?.results) {
        return response.data.results.map((price: any) => ({
          productId: price.productId,
          lowPrice: price.lowPrice,
          midPrice: price.midPrice,
          highPrice: price.highPrice,
          marketPrice: price.marketPrice,
          directLowPrice: price.directLowPrice,
          subTypeName: price.subTypeName
        }))
      }

      return []
    } catch (error) {
      console.error('Error fetching TCGPlayer pricing:', error)
      return []
    }
  }

  // Web scraping approach for public data (no API key needed)
  async scrapePokemonSearch(searchTerm: string = 'charizard'): Promise<any> {
    try {
      // This would require playwright for full scraping
      const searchUrl = `${this.webURL}/search/pokemon/product?q=${encodeURIComponent(searchTerm)}&view=grid`
      console.log(`TCGPlayer search URL: ${searchUrl}`)
      
      // For now, return the URL for manual testing
      return {
        searchUrl,
        note: 'Web scraping integration can be added with Playwright'
      }
    } catch (error) {
      console.error('Error scraping TCGPlayer:', error)
      return null
    }
  }

  // Convert to standardized format for PokeDAO
  convertProductToStandardFormat(product: TCGPlayerProduct, price?: TCGPlayerPrice) {
    const marketPrice = price?.marketPrice || price?.midPrice || price?.lowPrice || 0
    
    return {
      id: `tcgplayer_${product.productId}`,
      title: product.name,
      price: marketPrice,
      currency: 'USD',
      source: 'tcgplayer' as const,
      url: product.url || `${this.webURL}/product/${product.productId}`,
      seller: 'TCGPlayer Marketplace',
      isActive: true,
      scrapedAt: new Date(),
      metadata: {
        productId: product.productId,
        category: product.category,
        groupId: product.groupId,
        imageUrl: product.imageUrl,
        pricing: price
      }
    }
  }

  // Get comprehensive Pokemon data
  async fetchPokemonData(searchTerm: string = 'pokemon'): Promise<{
    marketplace: any
    navigation: any
    products: TCGPlayerProduct[]
    pricing: TCGPlayerPrice[]
  }> {
    const [marketplace, navigation, products] = await Promise.all([
      this.fetchMarketplaceData(),
      this.fetchNavigationData(),
      this.searchProducts(searchTerm)
    ])

    let pricing: TCGPlayerPrice[] = []
    if (products.length > 0) {
      const productIds = products.map(p => p.productId).slice(0, 10) // Limit to first 10 for pricing
      pricing = await this.fetchPricing(productIds)
    }

    return {
      marketplace,
      navigation,
      products,
      pricing
    }
  }
}
