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

class FanaticsDynamicDiscovery {
  private baseUrl = 'https://www.fanatics.com'
  private requests: NetworkRequest[] = []

  async discoverAPIs() {
    console.log('🔍 Starting Fanatics Collect Dynamic API Discovery...')
    console.log('This will monitor network traffic while browsing the site...')

    const browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Track all network requests
    page.on('request', request => {
      const url = request.url()
      // Look for API-like requests
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
                const filename = `fanatics-api-sample-${Date.now()}.json`
                fs.writeFileSync(filename, JSON.stringify(data, null, 2))
                console.log(`💾 Sample saved to ${filename}`)
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
      // Navigate to main site
      console.log('📱 Loading Fanatics homepage...')
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)

      // Try Pokemon/collectibles search
      console.log('🔎 Searching for Pokemon collectibles...')
      try {
        await page.fill('[data-testid="search-input"], input[type="search"], #search', 'pokemon cards')
        await page.press('[data-testid="search-input"], input[type="search"], #search', 'Enter')
        await page.waitForTimeout(5000)
      } catch (e) {
        console.log('Search method 1 failed, trying alternative...')
        try {
          await page.goto(`${this.baseUrl}/search?q=pokemon+cards`, { waitUntil: 'networkidle' })
          await page.waitForTimeout(3000)
        } catch (e2) {
          console.log('Search method 2 failed')
        }
      }

      // Look for collectibles section
      console.log('🎴 Looking for collectibles section...')
      await page.goto(`${this.baseUrl}/collectibles`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)

      // Scroll to trigger lazy loading
      console.log('📜 Scrolling to trigger more API calls...')
      await page.evaluate(() => {
        window.scrollBy(0, 1000)
      })
      await page.waitForTimeout(2000)

      await page.evaluate(() => {
        window.scrollBy(0, 1000)
      })
      await page.waitForTimeout(2000)

    } catch (error) {
      console.error('Error during discovery:', error)
    } finally {
      await browser.close()
    }

    // Analyze results
    this.analyzeResults()
    return this.requests
  }

  private isAPILikeRequest(url: string): boolean {
    // Check if URL looks like an API endpoint
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
      /\/xhr\//
    ]

    const containsFanatics = url.includes('fanatics.com') || url.includes('fanatics')
    const matchesPattern = apiPatterns.some(pattern => pattern.test(url))
    
    return containsFanatics && matchesPattern
  }

  private analyzeResults() {
    console.log('\n📊 Dynamic Discovery Analysis:')
    console.log(`Total API-like requests captured: ${this.requests.length}`)

    const successfulAPIs = this.requests.filter(r => 
      r.response && r.response.status === 200 && r.response.hasJsonData
    )

    if (successfulAPIs.length > 0) {
      console.log('\n✅ Potential Working APIs Found:')
      successfulAPIs.forEach(req => {
        console.log(`  ${req.method} ${req.url}`)
        console.log(`    Status: ${req.response?.status}`)
        console.log(`    Type: ${req.response?.contentType}`)
      })
    } else {
      console.log('\n❌ No working API endpoints discovered')
    }

    // Save all results
    const fs = require('fs')
    fs.writeFileSync('fanatics-dynamic-results.json', JSON.stringify(this.requests, null, 2))
    console.log('\n💾 Full results saved to fanatics-dynamic-results.json')
  }
}

async function main() {
  const discovery = new FanaticsDynamicDiscovery()
  await discovery.discoverAPIs()
}

main().catch(console.error)
