/**
 * Comprehensive Fanatics Collect Pokemon Data Scraper
 * Scrapes ALL Pokemon cards from both auction and buy-now listings across all pages
 */
import { chromium, Page, Browser } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

interface ScrapedCard {
  id: string
  title: string
  slug: string
  currentBid?: {
    amountInCents: number
    currency: string
  }
  startingPrice?: {
    amountInCents: number
    currency: string
  }
  buyNowPrice?: {
    amountInCents: number
    currency: string
  }
  finalSalePrice?: {
    amountInCents: number
    currency: string
  }
  soldAt?: string
  bidCount: number
  favoritedCount: number
  certifiedSeller: string
  lotString?: string
  status: string
  listingType: string
  imageSets: Array<{
    medium: string
    small: string
    thumbnail: string
  }>
  auction?: {
    id: string
    endsAt?: string
    startsAt?: string
    status?: string
  }
  collectSales?: Array<{
    soldPrice: {
      amountInCents: number
      currency: string
    }
    soldAt: string
  }>
  scrapedAt: string
  sourceUrl: string
  pageNumber?: number
  isCompleted?: boolean
  isSold?: boolean
}

interface ScrapingResults {
  totalCards: number
  auctionCards: number
  buyNowCards: number
  soldCards: number
  totalPages: number
  totalBidVolume: number
  totalSalesVolume: number
  avgPrice: number
  avgSalePrice: number
  cards: ScrapedCard[]
  errors: Array<{ page: number, error: string }>
  capturedAt: string
}

class ComprehensiveFanaticsCollectScraper {
  private browser!: Browser
  private page!: Page
  private results: ScrapingResults = {
    totalCards: 0,
    auctionCards: 0,
    buyNowCards: 0,
    soldCards: 0,
    totalPages: 0,
    totalBidVolume: 0,
    totalSalesVolume: 0,
    avgPrice: 0,
    avgSalePrice: 0,
    cards: [],
    errors: [],
    capturedAt: new Date().toISOString()
  }
  
  private seenCardIds = new Set<string>()
  
  // Pokemon category filter for both auction and buy-now
  private pokemonCategories = [
    'Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
    'Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese)', 
    'Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)'
  ].join(',')

  async initialize() {
    console.log('🚀 Initializing Comprehensive Fanatics Collect Pokemon Scraper')
    console.log('================================================================')
    
    this.browser = await chromium.launch({ 
      headless: false, // Keep visible to monitor progress
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    this.page = await this.browser.newPage()
    
    // Set up network interceptors to capture GraphQL responses
    this.page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('graphql') && url.includes('collectListings')) {
        try {
          const data = await response.json()
          if (data.data?.collectListings) {
            this.processGraphQLListings(data.data.collectListings, url)
          }
        } catch (error) {
          console.log('Error processing GraphQL response:', error)
        }
      }
    })

    // Set viewport and user agent
    await this.page.setViewportSize({ width: 1920, height: 1080 })
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    })
  }

  async scrapeAllPokemonCards() {
    console.log('🎴 Starting comprehensive Pokemon card scraping...')
    
    // 1. Scrape Weekly Auction Pokemon Cards
    console.log('\n📅 PHASE 1: Weekly Auction Pokemon Cards')
    await this.scrapeAuctionPages()
    
    // 2. Scrape Buy Now Pokemon Cards  
    console.log('\n🛒 PHASE 2: Buy Now Pokemon Cards')
    await this.scrapeBuyNowPages()
    
    // 3. Scrape Sold/Completed Pokemon Cards for price trends
    console.log('\n💰 PHASE 3: Sold/Completed Pokemon Cards')
    await this.scrapeSoldPages()
    
    // 4. Final processing and save
    console.log('\n📊 PHASE 4: Processing Results')
    await this.finalizeResults()
  }

  async scrapeAuctionPages() {
    const baseUrl = `https://www.fanaticscollect.com/weekly-auction?category=${this.pokemonCategories}&type=WEEKLY`
    
    console.log(`🔗 Base auction URL: ${baseUrl}`)
    
    // Start with page 1
    let currentPage = 1
    let hasMorePages = true
    
    while (hasMorePages && currentPage <= 50) { // Cap at 50 pages for safety
      console.log(`\n📄 Scraping auction page ${currentPage}...`)
      
      try {
        const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`
        await this.page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 })
        
        // Wait for listings to load
        await this.page.waitForTimeout(3000)
        
        // Scroll to trigger lazy loading
        await this.scrollPageToLoadCards()
        
        // Check if there are cards on this page
        const cardCount = await this.countCardsOnPage()
        console.log(`   Found ${cardCount} cards on page ${currentPage}`)
        
        if (cardCount === 0) {
          console.log(`   No cards found on page ${currentPage}, stopping auction scraping`)
          hasMorePages = false
          break
        }
        
        // Check for next page button/link
        hasMorePages = await this.hasNextPage()
        console.log(`   Has next page: ${hasMorePages}`)
        
        currentPage++
        
        // Add delay between pages to be respectful
        await this.page.waitForTimeout(2000)
        
      } catch (error) {
        console.log(`❌ Error on auction page ${currentPage}:`, error)
        this.results.errors.push({
          page: currentPage,
          error: `Auction page error: ${error instanceof Error ? error.message : String(error)}`
        })
        currentPage++
      }
    }
    
    this.results.auctionCards = this.results.cards.filter(c => c.listingType === 'WEEKLY').length
    console.log(`✅ Auction scraping complete: ${this.results.auctionCards} cards found`)
  }

  async scrapeBuyNowPages() {
    const baseUrl = `https://www.fanaticscollect.com/buy-now?category=${this.pokemonCategories}`
    
    console.log(`🔗 Base buy-now URL: ${baseUrl}`)
    
    let currentPage = 1
    let hasMorePages = true
    
    while (hasMorePages && currentPage <= 50) {
      console.log(`\n📄 Scraping buy-now page ${currentPage}...`)
      
      try {
        const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`
        await this.page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 })
        
        await this.page.waitForTimeout(3000)
        await this.scrollPageToLoadCards()
        
        const cardCount = await this.countCardsOnPage()
        console.log(`   Found ${cardCount} cards on page ${currentPage}`)
        
        if (cardCount === 0) {
          console.log(`   No cards found on page ${currentPage}, stopping buy-now scraping`)
          hasMorePages = false
          break
        }
        
        hasMorePages = await this.hasNextPage()
        console.log(`   Has next page: ${hasMorePages}`)
        
        currentPage++
        await this.page.waitForTimeout(2000)
        
      } catch (error) {
        console.log(`❌ Error on buy-now page ${currentPage}:`, error)
        this.results.errors.push({
          page: currentPage,
          error: `Buy-now page error: ${error instanceof Error ? error.message : String(error)}`
        })
        currentPage++
      }
    }
    
    this.results.buyNowCards = this.results.cards.filter(c => c.listingType !== 'WEEKLY').length
    console.log(`✅ Buy-now scraping complete: ${this.results.buyNowCards} cards found`)
  }

  async scrapeSoldPages() {
    // Check if Fanatics has a sold/completed section
    const soldUrls = [
      `https://www.fanaticscollect.com/sold?category=${this.pokemonCategories}`,
      `https://www.fanaticscollect.com/completed?category=${this.pokemonCategories}`,
      `https://www.fanaticscollect.com/past-auctions?category=${this.pokemonCategories}`,
      `https://www.fanaticscollect.com/auction-results?category=${this.pokemonCategories}`
    ]
    
    console.log(`🔍 Searching for sold/completed Pokemon cards...`)
    
    for (const baseUrl of soldUrls) {
      console.log(`🔗 Trying sold URL: ${baseUrl}`)
      
      try {
        await this.page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 })
        await this.page.waitForTimeout(3000)
        
        // Check if page exists and has content
        const pageExists = await this.page.evaluate(() => {
          return !document.body.innerText.toLowerCase().includes('404') &&
                 !document.body.innerText.toLowerCase().includes('not found') &&
                 !document.body.innerText.toLowerCase().includes('page not found')
        })
        
        if (!pageExists) {
          console.log(`   Page not found, trying next URL...`)
          continue
        }
        
        let currentPage = 1
        let hasMorePages = true
        
        while (hasMorePages && currentPage <= 30) { // Limit sold pages
          console.log(`\n📄 Scraping sold page ${currentPage}...`)
          
          try {
            const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`
            await this.page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 })
            
            await this.page.waitForTimeout(3000)
            await this.scrollPageToLoadCards()
            
            const cardCount = await this.countCardsOnPage()
            console.log(`   Found ${cardCount} sold cards on page ${currentPage}`)
            
            if (cardCount === 0) {
              console.log(`   No sold cards found on page ${currentPage}`)
              hasMorePages = false
              break
            }
            
            hasMorePages = await this.hasNextPage()
            currentPage++
            await this.page.waitForTimeout(2000)
            
          } catch (error) {
            console.log(`❌ Error on sold page ${currentPage}:`, error)
            this.results.errors.push({
              page: currentPage,
              error: `Sold page error: ${error instanceof Error ? error.message : String(error)}`
            })
            currentPage++
          }
        }
        
        // If we found data, break out of URL loop
        if (this.results.cards.some(c => c.isSold)) {
          break
        }
        
      } catch (error) {
        console.log(`❌ Error accessing ${baseUrl}:`, error)
        continue
      }
    }
    
    this.results.soldCards = this.results.cards.filter(c => c.isSold || c.isCompleted).length
    console.log(`✅ Sold scraping complete: ${this.results.soldCards} completed sales found`)
  }

  async scrollPageToLoadCards() {
    // Scroll down multiple times to trigger lazy loading
    for (let i = 0; i < 10; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 800))
      await this.page.waitForTimeout(1000)
    }
    
    // Scroll back to top
    await this.page.evaluate(() => window.scrollTo(0, 0))
    await this.page.waitForTimeout(1000)
  }

  async countCardsOnPage(): Promise<number> {
    try {
      // Try different selectors for card counting
      const selectors = [
        '[data-testid*="listing"]',
        '.listing-card',
        '.auction-item',
        '.card-item',
        'a[href*="/lot/"]',
        'a[href*="/buy-now/"]'
      ]
      
      for (const selector of selectors) {
        const count = await this.page.$$eval(selector, (elements) => elements.length)
        if (count > 0) {
          return count
        }
      }
      
      return 0
    } catch (error) {
      return 0
    }
  }

  async hasNextPage(): Promise<boolean> {
    try {
      // Look for pagination indicators
      const nextButtonSelectors = [
        'button[aria-label="Next page"]',
        'a[aria-label="Next page"]',
        '.pagination-next',
        '.next-page',
        'button:has-text("Next")',
        'a:has-text("Next")'
      ]
      
      for (const selector of nextButtonSelectors) {
        const button = await this.page.$(selector)
        if (button) {
          const isDisabled = await button.evaluate(el => 
            el.hasAttribute('disabled') || 
            el.classList.contains('disabled') ||
            el.getAttribute('aria-disabled') === 'true'
          )
          return !isDisabled
        }
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  processGraphQLListings(listings: any[], sourceUrl: string) {
    for (const listing of listings) {
      // Skip if we've already seen this card
      if (this.seenCardIds.has(listing.id)) continue
      this.seenCardIds.add(listing.id)
      
      // Determine if this is a sold/completed item
      const isSold = listing.status === 'SOLD' || 
                    listing.status === 'COMPLETED' ||
                    listing.status === 'ENDED'
      
      const isCompleted = isSold || listing.auction?.status === 'ENDED'
      
      // Get final sale price for sold items
      let finalSalePrice = null
      if (isSold && listing.currentBid?.amountInCents) {
        finalSalePrice = {
          amountInCents: listing.currentBid.amountInCents,
          currency: listing.currentBid.currency || 'USD'
        }
      }
      
      // Get sold date
      let soldAt = null
      if (isSold && listing.auction?.endsAt) {
        soldAt = listing.auction.endsAt
      }
      
      // Collect sales data if available
      let collectSales: Array<{
        soldPrice: { amountInCents: number; currency: string }
        soldAt: string
      }> = []
      
      if (isSold && finalSalePrice && soldAt) {
        collectSales.push({
          soldPrice: finalSalePrice,
          soldAt: soldAt
        })
      }
      
      const card: ScrapedCard = {
        id: listing.id,
        title: listing.title || 'Unknown Title',
        slug: listing.slug || '',
        currentBid: listing.currentBid,
        startingPrice: listing.startingPrice,
        buyNowPrice: listing.buyNowPrice,
        finalSalePrice,
        soldAt,
        bidCount: listing.bidCount || 0,
        favoritedCount: listing.favoritedCount || 0,
        certifiedSeller: listing.certifiedSeller || 'Unknown',
        lotString: listing.lotString,
        status: listing.status || 'UNKNOWN',
        listingType: listing.listingType || 'UNKNOWN',
        imageSets: listing.imageSets || [],
        auction: listing.auction,
        collectSales,
        scrapedAt: new Date().toISOString(),
        sourceUrl: sourceUrl,
        isCompleted,
        isSold
      }
      
      this.results.cards.push(card)
      
      // Add to sales volume if sold
      if (isSold && finalSalePrice) {
        this.results.totalSalesVolume += finalSalePrice.amountInCents / 100
      }
      
      // Real-time progress update
      if (this.results.cards.length % 50 === 0) {
        console.log(`   📈 Progress: ${this.results.cards.length} cards collected...`)
      }
    }
  }

  async finalizeResults() {
    this.results.totalCards = this.results.cards.length
    this.results.soldCards = this.results.cards.filter(c => c.isSold || c.isCompleted).length
    this.results.totalPages = Math.ceil(this.results.totalCards / 24) // Approximate
    
    // Calculate current market metrics
    const currentPrices = this.results.cards
      .map(c => (c.currentBid?.amountInCents || c.buyNowPrice?.amountInCents || 0))
      .filter(p => p > 0)
    
    this.results.totalBidVolume = currentPrices.reduce((sum, price) => sum + price, 0) / 100
    this.results.avgPrice = currentPrices.length > 0 ? (currentPrices.reduce((sum, price) => sum + price, 0) / currentPrices.length / 100) : 0
    
    // Calculate sold price metrics
    const soldPrices = this.results.cards
      .filter(c => c.isSold && c.finalSalePrice)
      .map(c => c.finalSalePrice!.amountInCents)
    
    if (soldPrices.length > 0) {
      this.results.totalSalesVolume = soldPrices.reduce((sum, price) => sum + price, 0) / 100
      this.results.avgSalePrice = soldPrices.reduce((sum, price) => sum + price, 0) / soldPrices.length / 100
    } else {
      this.results.totalSalesVolume = 0
      this.results.avgSalePrice = 0
    }
    
    // Save the comprehensive dataset
    const outputPath = path.join(process.cwd(), `fanatics-collect-comprehensive-dataset-${Date.now()}.json`)
    await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2))
    
    console.log('\n🎉 COMPREHENSIVE SCRAPING COMPLETE!')
    console.log('====================================')
    console.log(`📊 Total Pokemon Cards: ${this.results.totalCards}`)
    console.log(`📅 Auction Cards: ${this.results.auctionCards}`)
    console.log(`🛒 Buy Now Cards: ${this.results.buyNowCards}`)
    console.log(`💰 Sold Cards: ${this.results.soldCards}`)
    console.log(`💵 Current Market Value: $${this.results.totalBidVolume.toLocaleString()}`)
    console.log(`💸 Total Sales Volume: $${this.results.totalSalesVolume.toLocaleString()}`)
    console.log(`� Average Current Price: $${this.results.avgPrice.toFixed(2)}`)
    console.log(`📉 Average Sale Price: $${this.results.avgSalePrice.toFixed(2)}`)
    console.log(`❌ Errors: ${this.results.errors.length}`)
    console.log(`💾 Saved to: ${path.basename(outputPath)}`)
    
    if (this.results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:')
      this.results.errors.forEach(error => {
        console.log(`   Page ${error.page}: ${error.error}`)
      })
    }
    
    // Show top 10 most valuable current listings
    const topCurrentCards = this.results.cards
      .filter(c => !c.isSold && (c.currentBid?.amountInCents || c.buyNowPrice?.amountInCents || 0) > 0)
      .sort((a, b) => {
        const aPrice = a.currentBid?.amountInCents || a.buyNowPrice?.amountInCents || 0
        const bPrice = b.currentBid?.amountInCents || b.buyNowPrice?.amountInCents || 0
        return bPrice - aPrice
      })
      .slice(0, 10)
    
    console.log('\n💎 Top 10 Most Valuable Current Listings:')
    topCurrentCards.forEach((card, index) => {
      const price = (card.currentBid?.amountInCents || card.buyNowPrice?.amountInCents || 0) / 100
      console.log(`   ${index + 1}. $${price.toLocaleString()} - ${card.title}`)
    })
    
    // Show top 10 recent sales if available
    const topSales = this.results.cards
      .filter(c => c.isSold && c.finalSalePrice)
      .sort((a, b) => (b.finalSalePrice!.amountInCents || 0) - (a.finalSalePrice!.amountInCents || 0))
      .slice(0, 10)
    
    if (topSales.length > 0) {
      console.log('\n🔥 Top 10 Recent Sales:')
      topSales.forEach((card, index) => {
        const price = card.finalSalePrice!.amountInCents / 100
        console.log(`   ${index + 1}. $${price.toLocaleString()} - ${card.title} (${card.soldAt})`)
      })
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close()
    }
  }
}

// Main execution
async function main() {
  const scraper = new ComprehensiveFanaticsCollectScraper()
  
  try {
    await scraper.initialize()
    await scraper.scrapeAllPokemonCards()
  } catch (error) {
    console.error('💥 Scraping failed:', error)
  } finally {
    await scraper.cleanup()
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { ComprehensiveFanaticsCollectScraper }
