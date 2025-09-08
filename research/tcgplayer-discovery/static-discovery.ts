import axios from 'axios'

interface DiscoveryResult {
  endpoint: string
  method: string
  status: number
  responseType: string
  hasData: boolean
  description: string
}

class TCGPlayerStaticDiscovery {
  private baseUrl = 'https://www.tcgplayer.com'
  private apiUrl = 'https://api.tcgplayer.com'
  private results: DiscoveryResult[] = []

  // Known and potential API endpoints
  private endpoints = [
    // Known API endpoints
    '/catalog/categories',
    '/catalog/products',
    '/pricing/product',
    '/pricing/group',
    '/pricing/sku',
    '/inventory/products',
    '/v1/catalog/categories',
    '/v1/catalog/products',
    '/v1/pricing/product',
    '/v2/catalog/categories',
    '/v2/catalog/products',
    '/v2/pricing/product',
    
    // Potential endpoints
    '/api/products',
    '/api/search',
    '/api/cards',
    '/api/pokemon',
    '/api/listings',
    '/api/marketplace',
    '/api/inventory',
    '/api/pricing',
    '/graphql',
    '/gql',
    '/_api/products',
    '/rest/products',
    '/services/products',
    '/data/products.json',
    '/products.json',
    
    // Website endpoints that might return JSON
    '/massentry/getproducts',
    '/massentry/search',
    '/product/search',
    '/catalog/search',
    '/pricing/search'
  ]

  async discoverEndpoints() {
    console.log('🔍 Starting TCGPlayer Static API Discovery...')
    console.log(`Testing main site: ${this.baseUrl}`)
    console.log(`Testing API domain: ${this.apiUrl}`)
    
    // Test main website endpoints
    console.log('\n📱 Testing main website endpoints...')
    for (const endpoint of this.endpoints) {
      await this.testEndpoint(this.baseUrl + endpoint, 'website')
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Test API domain endpoints
    console.log('\n🔌 Testing API domain endpoints...')
    for (const endpoint of this.endpoints) {
      await this.testEndpoint(this.apiUrl + endpoint, 'api')
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    this.analyzeResults()
    return this.results
  }

  private async testEndpoint(fullUrl: string, source: string) {
    try {
      const response = await axios.get(fullUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          // TCGPlayer might require these
          'Referer': 'https://www.tcgplayer.com/',
          'Origin': 'https://www.tcgplayer.com'
        },
        validateStatus: () => true
      })

      const contentType = response.headers['content-type'] || ''
      const isJson = contentType.includes('application/json')
      const isHtml = contentType.includes('text/html')
      
      let description = `${response.status} ${response.statusText} (${source})`
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
        console.log(`🎯 FOUND: ${fullUrl} - JSON with data!`)
        
        // Save sample response
        const fs = require('fs')
        const filename = `tcgplayer-sample-${source}-${fullUrl.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown'}.json`
        fs.writeFileSync(filename, JSON.stringify(response.data, null, 2))
        console.log(`💾 Sample saved to ${filename}`)
      }

      // Special handling for specific status codes
      if (response.status === 401) {
        console.log(`🔐 ${fullUrl} requires authentication`)
      } else if (response.status === 403) {
        console.log(`🚫 ${fullUrl} access forbidden (might be valid API)`)
      }

    } catch (error) {
      let errorMsg = 'Unknown error'
      if (error instanceof Error) {
        errorMsg = error.message
      }

      this.results.push({
        endpoint: fullUrl,
        method: 'GET',
        status: 0,
        responseType: 'error',
        hasData: false,
        description: `Error (${source}): ${errorMsg}`
      })
    }
  }

  private analyzeResults() {
    console.log('\n📊 Static Discovery Results:')
    console.log(`Total endpoints tested: ${this.results.length}`)

    // Categorize results
    const successful = this.results.filter(r => r.status >= 200 && r.status < 300)
    const auth_required = this.results.filter(r => r.status === 401)
    const forbidden = this.results.filter(r => r.status === 403)
    const with_data = this.results.filter(r => r.hasData)

    console.log(`✅ Successful (2xx): ${successful.length}`)
    console.log(`🔐 Auth Required (401): ${auth_required.length}`)
    console.log(`🚫 Forbidden (403): ${forbidden.length}`)
    console.log(`📊 With Data: ${with_data.length}`)

    if (with_data.length > 0) {
      console.log('\n🎯 Endpoints with data:')
      with_data.forEach(result => {
        console.log(`  ${result.endpoint}`)
      })
    }

    if (auth_required.length > 0) {
      console.log('\n🔐 Endpoints requiring authentication (potential APIs):')
      auth_required.forEach(result => {
        console.log(`  ${result.endpoint}`)
      })
    }

    // Save results
    const fs = require('fs')
    fs.writeFileSync('tcgplayer-discovery-results.json', JSON.stringify(this.results, null, 2))
    console.log('\n💾 Results saved to tcgplayer-discovery-results.json')
  }
}

async function main() {
  const discovery = new TCGPlayerStaticDiscovery()
  await discovery.discoverEndpoints()
}

main().catch(console.error)
