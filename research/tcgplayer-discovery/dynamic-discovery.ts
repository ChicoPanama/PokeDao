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

class TCGPlayerDynamicDiscovery {
  private baseUrl = 'https://www.tcgplayer.com'
  private requests: NetworkRequest[] = []

  async discoverAPIs() {
    console.log('🔍 Starting TCGPlayer Dynamic API Discovery...')
    console.log('This will monitor network traffic while browsing TCGPlayer...')

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

    // Track responses
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
                console.log(`🎯 FOUND API: ${url} - JSON response with data!`)
                
                // Save sample response
                const fs = require('fs')
                const filename = `tcgplayer-api-sample-${Date.now()}.json`
                fs.writeFileSync(filename, JSON.stringify(data, null, 2))
                console.log(`💾 Sample saved to ${filename}`)
              }
            } catch (e) {
              // Not valid JSON
            }
          }

          // Update request record
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
      // Navigate to main site
      console.log('📱 Loading TCGPlayer homepage...')
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)

      // Search for Pokemon cards
      console.log('🔎 Searching for Pokemon cards...')
      try {
        // Try multiple search approaches
        const searchSelectors = [
          '[data-testid="search-input"]',
          'input[type="search"]',
          'input[placeholder*="Search"]',
          '#search',
          '.search-input'
        ]

        let searchFound = false
        for (const selector of searchSelectors) {
          try {
            await page.fill(selector, 'pokemon charizard', { timeout: 2000 })
            await page.press(selector, 'Enter')
            searchFound = true
            console.log(`✅ Search executed with selector: ${selector}`)
            break
          } catch (e) {
            continue
          }
        }

        if (!searchFound) {
          console.log('Direct search failed, trying URL navigation...')
          await page.goto(`${this.baseUrl}/search/pokemon/product?q=charizard`, { waitUntil: 'networkidle' })
        }

        await page.waitForTimeout(5000)
      } catch (e) {
        console.log('Search failed, continuing with other methods...')
      }

      // Navigate to Pokemon category
      console.log('🎴 Navigating to Pokemon section...')
      await page.goto(`${this.baseUrl}/categories/pokemon`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)

      // Try to access specific product page
      console.log('📄 Loading a specific product page...')
      await page.goto(`${this.baseUrl}/product/221823/pokemon-base-set-charizard-4-102`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)

      // Scroll to trigger lazy loading
      console.log('📜 Scrolling to trigger more API calls...')
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000))
        await page.waitForTimeout(2000)
      }

      // Try to interact with pricing/marketplace features
      console.log('💰 Looking for pricing/marketplace interactions...')
      try {
        // Look for "View All Listings" or similar buttons
        const buttons = await page.$$('button, a')
        for (const button of buttons.slice(0, 10)) {
          try {
            const text = await button.textContent()
            if (text && (
              text.includes('View') || 
              text.includes('More') || 
              text.includes('Listings') ||
              text.includes('Prices')
            )) {
              console.log(`Clicking: ${text}`)
              await button.click()
              await page.waitForTimeout(2000)
              break
            }
          } catch (e) {
            continue
          }
        }
      } catch (e) {
        console.log('Button interaction failed')
      }

    } catch (error) {
      console.error('Error during discovery:', error)
    } finally {
      await browser.close()
    }

    this.analyzeResults()
    return this.requests
  }

  private isAPILikeRequest(url: string): boolean {
    const apiPatterns = [
      /\/api\//,
      /\/graphql/,
      /\/gql/,
      /\/_api\//,
      /\/rest\//,
      /\/services\//,
      /\.json$/,
      /\/data\//,
      /\/ajax\//,
      /\/xhr\//,
      /\/catalog\//,
      /\/pricing\//,
      /\/inventory\//,
      /\/massentry\//
    ]

    const containsTCGPlayer = url.includes('tcgplayer.com') || url.includes('tcgplayer')
    const matchesPattern = apiPatterns.some(pattern => pattern.test(url))
    
    return containsTCGPlayer && matchesPattern
  }

  private analyzeResults() {
    console.log('\n📊 Dynamic Discovery Analysis:')
    console.log(`Total API-like requests captured: ${this.requests.length}`)

    const successfulAPIs = this.requests.filter(r => 
      r.response && r.response.status === 200 && r.response.hasJsonData
    )

    const authAPIs = this.requests.filter(r => 
      r.response && r.response.status === 401
    )

    if (successfulAPIs.length > 0) {
      console.log('\n✅ Working APIs Found:')
      successfulAPIs.forEach(req => {
        console.log(`  ${req.method} ${req.url}`)
        console.log(`    Status: ${req.response?.status}`)
        console.log(`    Type: ${req.response?.contentType}`)
      })
    }

    if (authAPIs.length > 0) {
      console.log('\n🔐 Auth-Required APIs Found:')
      authAPIs.forEach(req => {
        console.log(`  ${req.method} ${req.url}`)
      })
    }

    if (successfulAPIs.length === 0 && authAPIs.length === 0) {
      console.log('\n❌ No API endpoints discovered')
    }

    // Save results
    const fs = require('fs')
    fs.writeFileSync('tcgplayer-dynamic-results.json', JSON.stringify(this.requests, null, 2))
    console.log('\n💾 Full results saved to tcgplayer-dynamic-results.json')
  }
}

async function main() {
  const discovery = new TCGPlayerDynamicDiscovery()
  await discovery.discoverAPIs()
}

main().catch(console.error)
