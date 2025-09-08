import axios from 'axios'

interface DiscoveryResult {
  endpoint: string
  method: string
  status: number
  responseType: string
  hasData: boolean
  description: string
}

class FanaticsCollectStaticDiscovery {
  private baseUrl = 'https://www.fanaticscollect.com'
  private results: DiscoveryResult[] = []

  // API endpoint patterns to test for auction platform
  private commonEndpoints = [
    // Auction-specific endpoints
    '/api/auctions',
    '/api/weekly-auction',
    '/api/items',
    '/api/lots',
    '/api/bids',
    '/api/search',
    '/api/products',
    '/api/catalog',
    '/api/cards',
    '/api/pokemon',
    '/api/collectibles',
    '/api/categories',
    '/api/listings',
    '/api/marketplace',
    
    // Versioned APIs
    '/api/v1/auctions',
    '/api/v1/items',
    '/api/v1/search',
    '/api/v2/auctions',
    '/api/v2/items',
    '/api/v2/search',
    
    // GraphQL
    '/graphql',
    '/gql',
    
    // Internal APIs
    '/_api/auctions',
    '/_api/items',
    '/_next/api/auctions',
    '/_next/api/items',
    '/rest/auctions',
    '/rest/items',
    '/services/auctions',
    '/services/items',
    
    // Data endpoints
    '/data/auctions.json',
    '/data/items.json',
    '/data/categories.json',
    '/auctions.json',
    '/items.json',
    
    // AJAX endpoints
    '/ajax/auctions',
    '/ajax/search',
    '/ajax/lots',
    '/xhr/auctions',
    '/xhr/search'
  ]

  async discoverEndpoints() {
    console.log('🔍 Starting Fanatics Collect (Auction Platform) Static API Discovery...')
    console.log(`Base URL: ${this.baseUrl}`)
    console.log('Target: Pokemon card auctions and marketplace data')
    
    for (const endpoint of this.commonEndpoints) {
      await this.testEndpoint(endpoint)
      // Rate limiting for auction platform
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    console.log('\n📊 Discovery Results:')
    this.results.forEach(result => {
      console.log(`${result.method} ${result.endpoint} - ${result.status} - ${result.description}`)
    })

    // Filter and analyze results
    const successful = this.results.filter(r => r.status >= 200 && r.status < 400)
    const withData = this.results.filter(r => r.hasData)
    const authRequired = this.results.filter(r => r.status === 401)
    const forbidden = this.results.filter(r => r.status === 403)

    if (withData.length > 0) {
      console.log('\n🎯 API Endpoints with Data Found:')
      withData.forEach(result => {
        console.log(`  ${result.endpoint} (${result.responseType})`)
      })
    }

    if (authRequired.length > 0) {
      console.log('\n🔐 Auth-Required Endpoints (Potential APIs):')
      authRequired.forEach(result => {
        console.log(`  ${result.endpoint}`)
      })
    }

    if (forbidden.length > 0) {
      console.log('\n🚫 Forbidden Endpoints (Might be valid APIs):')
      forbidden.forEach(result => {
        console.log(`  ${result.endpoint}`)
      })
    }

    if (successful.length === 0 && withData.length === 0) {
      console.log('\n❌ No obvious API endpoints found.')
      console.log('💡 Recommendation: Run dynamic discovery to capture live network traffic')
    }

    return this.results
  }

  private async testEndpoint(endpoint: string) {
    const fullUrl = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await axios.get(fullUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.fanaticscollect.com/',
          'Origin': 'https://www.fanaticscollect.com'
        },
        validateStatus: () => true // Don't throw on 4xx/5xx
      })

      const contentType = response.headers['content-type'] || ''
      const isJson = contentType.includes('application/json')
      const isHtml = contentType.includes('text/html')
      
      let description = `${response.status} ${response.statusText}`
      let hasData = false

      if (isJson && response.data) {
        hasData = response.data && (
          Array.isArray(response.data) ? response.data.length > 0 : Object.keys(response.data).length > 0
        )
        description += ' (JSON)'
        if (hasData) description += ' - Contains data!'
      } else if (isHtml) {
        description += ' (HTML)'
      }

      this.results.push({
        endpoint: fullUrl,
        method: 'GET',
        status: response.status,
        responseType: contentType,
        hasData,
        description
      })

      if (response.status === 200 && isJson && hasData) {
        console.log(`🎯 FOUND: ${fullUrl} - JSON with auction/card data!`)
        
        // Save sample response
        const fs = require('fs')
        const filename = `fanaticscollect-sample-${endpoint.replace(/\//g, '_')}.json`
        fs.writeFileSync(filename, JSON.stringify(response.data, null, 2))
        console.log(`💾 Sample saved to ${filename}`)
      }

      // Log interesting status codes
      if (response.status === 401) {
        console.log(`🔐 ${fullUrl} requires authentication - might be valid API`)
      } else if (response.status === 403) {
        console.log(`🚫 ${fullUrl} forbidden - might be protected API`)
      }

    } catch (error) {
      this.results.push({
        endpoint: fullUrl,
        method: 'GET',
        status: 0,
        responseType: 'error',
        hasData: false,
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }
}

async function main() {
  const discovery = new FanaticsCollectStaticDiscovery()
  const results = await discovery.discoverEndpoints()
  
  // Save results
  const fs = require('fs')
  fs.writeFileSync('fanaticscollect-discovery-results.json', JSON.stringify(results, null, 2))
  console.log('\n💾 Results saved to fanaticscollect-discovery-results.json')
  
  console.log('\n🎯 Next Steps:')
  console.log('1. Run dynamic discovery to capture live auction data')
  console.log('2. Test the Pokemon auction URL you provided')
  console.log('3. Analyze network traffic during auction browsing')
}

main().catch(console.error)
