/**
 * Fanatics Collect API Discovery Tool
 * Investigates the actual API endpoints used by fanaticscollect.com
 */
import { chromium, Page, Browser } from 'playwright'

class FanaticsAPIDiscovery {
  private browser!: Browser
  private page!: Page
  private apiEndpoints: Set<string> = new Set()
  private graphqlQueries: any[] = []

  async initialize() {
    console.log('🔍 Initializing Fanatics Collect API Discovery')
    console.log('=============================================')
    
    this.browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    this.page = await this.browser.newPage()
    
    // Intercept all network requests to find API endpoints
    await this.page.route('**/*', async (route) => {
      const request = route.request()
      const url = request.url()
      
      // Log all API-related requests
      if (url.includes('api') || url.includes('graphql') || url.includes('collect')) {
        console.log(`🌐 API Request: ${request.method()} ${url}`)
        
        if (request.postData()) {
          console.log(`📦 POST Data:`, request.postData()?.substring(0, 200))
        }
        
        this.apiEndpoints.add(url)
      }
      
      await route.continue()
    })
    
    // Intercept responses to capture GraphQL schemas
    this.page.on('response', async (response) => {
      const url = response.url()
      
      if (url.includes('graphql')) {
        try {
          const responseText = await response.text()
          console.log(`📊 GraphQL Response from ${url}:`)
          console.log(responseText.substring(0, 500) + '...')
          
          const data = JSON.parse(responseText)
          this.graphqlQueries.push({
            url,
            data: data,
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.log(`❌ Error parsing GraphQL response:`, error)
        }
      }
    })

    await this.page.setViewportSize({ width: 1920, height: 1080 })
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    })
  }

  async discoverAPIEndpoints() {
    console.log('🚀 Starting API endpoint discovery...')
    
    // 1. Visit main marketplace page
    console.log('\n📱 Step 1: Main marketplace page')
    await this.page.goto('https://www.fanaticscollect.com/', { waitUntil: 'networkidle' })
    await this.page.waitForTimeout(3000)
    
    // 2. Search for Pokemon specifically  
    console.log('\n🎴 Step 2: Pokemon search')
    try {
      // Look for search box
      await this.page.click('input[type="search"], input[placeholder*="search"], .search-input', { timeout: 5000 })
      await this.page.fill('input[type="search"], input[placeholder*="search"], .search-input', 'pokemon')
      await this.page.press('input[type="search"], input[placeholder*="search"], .search-input', 'Enter')
      await this.page.waitForTimeout(5000)
    } catch (error) {
      console.log('⚠️  Could not find search - trying navigation')
      
      // Try direct navigation to Pokemon category
      const pokemonUrls = [
        'https://www.fanaticscollect.com/marketplace/pokemon',
        'https://www.fanaticscollect.com/pokemon',
        'https://www.fanaticscollect.com/trading-cards/pokemon',
        'https://www.fanaticscollect.com/cards/pokemon',
        'https://www.fanaticscollect.com/category/pokemon'
      ]
      
      for (const url of pokemonUrls) {
        try {
          console.log(`🔗 Trying: ${url}`)
          await this.page.goto(url, { waitUntil: 'networkidle', timeout: 10000 })
          await this.page.waitForTimeout(3000)
          break
        } catch (error) {
          console.log(`❌ Failed: ${url}`)
        }
      }
    }
    
    // 3. Look for auction/marketplace sections
    console.log('\n📅 Step 3: Auction sections')
    const auctionSelectors = [
      'a[href*="auction"]',
      'a[href*="weekly"]', 
      'a[href*="bidding"]',
      '.auction-link',
      '[data-testid*="auction"]'
    ]
    
    for (const selector of auctionSelectors) {
      try {
        const element = await this.page.$(selector)
        if (element) {
          console.log(`🎯 Found auction link: ${selector}`)
          await element.click()
          await this.page.waitForTimeout(3000)
          break
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    // 4. Scroll to trigger lazy loading and more API calls
    console.log('\n📜 Step 4: Triggering lazy loading')
    for (let i = 0; i < 5; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 1000))
      await this.page.waitForTimeout(2000)
    }
  }

  async analyzeAPIStructure() {
    console.log('\n🔬 ANALYZING DISCOVERED API STRUCTURE')
    console.log('=====================================')
    
    console.log(`\n📊 Total API endpoints discovered: ${this.apiEndpoints.size}`)
    
    if (this.apiEndpoints.size > 0) {
      console.log('\n🌐 API Endpoints:')
      Array.from(this.apiEndpoints).forEach((endpoint, index) => {
        console.log(`  ${index + 1}. ${endpoint}`)
      })
    }
    
    console.log(`\n📦 GraphQL queries captured: ${this.graphqlQueries.length}`)
    
    if (this.graphqlQueries.length > 0) {
      console.log('\n📋 GraphQL Query Analysis:')
      this.graphqlQueries.forEach((query, index) => {
        console.log(`\n  Query ${index + 1}:`)
        console.log(`    URL: ${query.url}`)
        console.log(`    Data: ${JSON.stringify(query.data, null, 2).substring(0, 300)}...`)
      })
    }
    
    // Extract potential direct API endpoints
    const directAPIs = Array.from(this.apiEndpoints).filter(url => 
      url.includes('/api/') || 
      url.includes('/graphql') ||
      url.includes('/rest/')
    )
    
    if (directAPIs.length > 0) {
      console.log('\n🎯 Direct API Endpoints:')
      directAPIs.forEach((api, index) => {
        console.log(`  ${index + 1}. ${api}`)
      })
    }
    
    return {
      totalEndpoints: this.apiEndpoints.size,
      endpoints: Array.from(this.apiEndpoints),
      graphqlQueries: this.graphqlQueries,
      directAPIs
    }
  }

  async generateAPIClient() {
    const analysis = await this.analyzeAPIStructure()
    
    if (analysis.directAPIs.length > 0) {
      console.log('\n🛠️  GENERATING API CLIENT CODE')
      console.log('==============================')
      
      const apiClientCode = `
/**
 * Generated Fanatics Collect API Client
 * Based on discovered endpoints
 */

class FanaticsCollectAPI {
  private baseURL = '${analysis.directAPIs[0].split('/api')[0]}'
  
  async searchPokemon(query: string) {
    // Implementation based on discovered endpoints
    ${analysis.directAPIs.map(api => `
    // Endpoint: ${api}
    `).join('')}
  }
  
  async getAuctions() {
    // Implementation for auction data
  }
  
  async getSoldItems() {
    // Implementation for sold items
  }
}
      `
      
      console.log(apiClientCode)
    }
    
    return analysis
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close()
    }
  }
}

// Main execution
async function main() {
  const discovery = new FanaticsAPIDiscovery()
  
  try {
    await discovery.initialize()
    await discovery.discoverAPIEndpoints()
    await discovery.generateAPIClient()
  } catch (error) {
    console.error('💥 API discovery failed:', error)
  } finally {
    await discovery.cleanup()
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { FanaticsAPIDiscovery }
