import { chromium } from 'playwright'

interface NetworkRequest {
  url: string
  method: string
  resourceType: string
  headers: Record<string, string>
  response?: {
    status: number
    contentType: string
    hasJsonData: boolean
  }
}

class FanaticsCollectDynamicDiscovery {
  private baseUrl = 'https://www.fanaticscollect.com'
  private pokemonAuctionUrl = 'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY'
  private requests: NetworkRequest[] = []

  async discoverAPIs() {
    console.log('🔍 Starting Fanatics Collect (Auction Platform) Dynamic API Discovery...')
    console.log('🎯 Target: Pokemon card auction APIs and marketplace data')
    console.log(`Base URL: ${this.baseUrl}`)

    const browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Track all network requests
    page.on('request', request => {
      const url = request.url()
      if (this.isAPILikeRequest(url)) {
        this.requests.push({
          url,
          method: request.method(),
          resourceType: request.resourceType(),
          headers: request.headers()
        })
        console.log(`📡 Captured: ${request.method()} ${url}`)
      }
    })

    // Track responses with special focus on auction data
    page.on('response', async response => {
      const url = response.url()
      if (this.isAPILikeRequest(url)) {
        try {
          const contentType = response.headers()['content-type'] || ''
          const isJson = contentType.includes('application/json')
          let hasJsonData = false

          if (isJson && response.status() === 200) {
            try {
              const text = await response.text()
              const data = JSON.parse(text)
              hasJsonData = data && Object.keys(data).length > 0
              
              if (hasJsonData) {
                console.log(`🎯 FOUND AUCTION API: ${url}`)
                
                // Check if this looks like auction/card data
                const dataStr = JSON.stringify(data).toLowerCase()
                const isAuctionData = dataStr.includes('auction') || 
                                    dataStr.includes('bid') || 
                                    dataStr.includes('lot') || 
                                    dataStr.includes('card') ||
                                    dataStr.includes('pokemon') ||
                                    dataStr.includes('price')

                if (isAuctionData) {
                  console.log(`🎴 POKEMON/AUCTION DATA DETECTED!`)
                }
                
                // Save sample response
                const fs = require('fs')
                const timestamp = Date.now()
                const filename = `fanaticscollect-api-${timestamp}.json`
                fs.writeFileSync(filename, JSON.stringify(data, null, 2))
                console.log(`💾 Sample saved to ${filename}`)
                
                if (isAuctionData) {
                  const auctionFilename = `fanaticscollect-AUCTION-DATA-${timestamp}.json`
                  fs.writeFileSync(auctionFilename, JSON.stringify(data, null, 2))
                  console.log(`🎴 AUCTION DATA saved to ${auctionFilename}`)
                }
              }
            } catch (e) {
              // Not valid JSON
            }
          }

          // Update request record with response info
          const requestRecord = this.requests.find(r => r.url === url)
          if (requestRecord) {
            requestRecord.response = {
              status: response.status(),
              contentType,
              hasJsonData
            }
          }
        } catch (error) {
          console.log(`Error processing response for ${url}:`, error)
        }
      }
    })

    try {
      // Navigate to main auction site
      console.log('📱 Loading Fanatics Collect homepage...')
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)

      // Navigate directly to Pokemon auctions
      console.log('🎴 Loading Pokemon Card Auctions...')
      await page.goto(this.pokemonAuctionUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(5000)

      // Scroll to load more auction items
      console.log('📜 Scrolling through auction listings...')
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000))
        await page.waitForTimeout(2000)
      }

      // Try to interact with auction items
      console.log('🔍 Looking for auction item interactions...')
      try {
        // Look for auction item links or cards
        const auctionItems = await page.$$('a[href*="lot"], .auction-item, .lot-card, [data-testid*="auction"], [data-testid*="lot"]')
        
        if (auctionItems.length > 0) {
          console.log(`Found ${auctionItems.length} auction items, clicking first few...`)
          
          // Click on first few auction items
          for (let i = 0; i < Math.min(3, auctionItems.length); i++) {
            try {
              console.log(`Clicking auction item ${i + 1}...`)
              await auctionItems[i].click()
              await page.waitForTimeout(3000)
              
              // Go back to auction list
              await page.goBack()
              await page.waitForTimeout(2000)
            } catch (e) {
              console.log(`Failed to click auction item ${i + 1}`)
              continue
            }
          }
        } else {
          console.log('No auction items found with standard selectors')
        }
      } catch (e) {
        console.log('Auction item interaction failed')
      }

      // Try weekly auction navigation
      console.log('📅 Exploring weekly auction sections...')
      try {
        await page.goto(`${this.baseUrl}/weekly-auction`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(3000)
        
        // Scroll again
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 1000))
          await page.waitForTimeout(2000)
        }
      } catch (e) {
        console.log('Weekly auction navigation failed')
      }

      // Try search functionality
      console.log('🔎 Testing search functionality...')
      try {
        const searchSelectors = [
          'input[type="search"]',
          'input[placeholder*="Search"]',
          '#search',
          '.search-input',
          '[data-testid*="search"]'
        ]

        for (const selector of searchSelectors) {
          try {
            await page.fill(selector, 'Charizard', { timeout: 2000 })
            await page.press(selector, 'Enter')
            await page.waitForTimeout(3000)
            console.log(`✅ Search executed with: ${selector}`)
            break
          } catch (e) {
            continue
          }
        }
      } catch (e) {
        console.log('Search functionality not found')
      }

    } catch (error) {
      console.error('Error during auction discovery:', error)
    } finally {
      await browser.close()
    }

    this.analyzeResults()
    return this.requests
  }

  private isAPILikeRequest(url: string): boolean {
    // Check if URL looks like an API endpoint for auction platform
    const apiPatterns = [
      /\/api\//,
      /\/graphql/,
      /\/gql/,
      /\/_api\//,
      /\/_next\/api/,
      /\/rest\//,
      /\/services\//,
      /\.json$/,
      /\/data\//,
      /\/ajax\//,
      /\/xhr\//,
      /\/auctions\//,
      /\/lots\//,
      /\/bids\//,
      /\/items\//
    ]

    const containsFanaticsCollect = url.includes('fanaticscollect.com') || url.includes('fanaticscollect')
    const matchesPattern = apiPatterns.some(pattern => pattern.test(url))
    
    return containsFanaticsCollect && matchesPattern
  }

  private analyzeResults() {
    console.log('\n📊 Fanatics Collect Dynamic Discovery Analysis:')
    console.log(`Total API-like requests captured: ${this.requests.length}`)

    const successfulAPIs = this.requests.filter(r => 
      r.response && r.response.status === 200 && r.response.hasJsonData
    )

    const authAPIs = this.requests.filter(r => 
      r.response && r.response.status === 401
    )

    if (successfulAPIs.length > 0) {
      console.log('\n✅ Working Auction APIs Found:')
      successfulAPIs.forEach(req => {
        console.log(`  ${req.method} ${req.url}`)
        console.log(`    Status: ${req.response?.status}`)
        console.log(`    Type: ${req.response?.contentType}`)
      })
    }

    if (authAPIs.length > 0) {
      console.log('\n🔐 Auth-Required APIs:')
      authAPIs.forEach(req => {
        console.log(`  ${req.method} ${req.url}`)
      })
    }

    if (successfulAPIs.length === 0 && authAPIs.length === 0) {
      console.log('\n❌ No auction API endpoints discovered')
    }

    // Save all results
    const fs = require('fs')
    fs.writeFileSync('fanaticscollect-dynamic-results.json', JSON.stringify(this.requests, null, 2))
    console.log('\n💾 Full results saved to fanaticscollect-dynamic-results.json')
    
    console.log('\n🎯 Discovery Summary for PokeDAO Integration:')
    console.log(`- APIs discovered: ${successfulAPIs.length}`)
    console.log(`- Auth-required endpoints: ${authAPIs.length}`)
    console.log('- Check saved JSON files for auction data structures')
    console.log('- Ready for PokeDAO integration if APIs found')
  }
}

async function main() {
  const discovery = new FanaticsCollectDynamicDiscovery()
  await discovery.discoverAPIs()
}

main().catch(console.error)
