import axios from 'axios'

interface DiscoveryResult {
  endpoint: string
  method: string
  status: number
  responseType: string
  hasData: boolean
  description: string
}

class FanaticsStaticDiscovery {
  private baseUrl = 'https://www.fanatics.com'
  private results: DiscoveryResult[] = []

  // Common API endpoint patterns to test
  private commonEndpoints = [
    '/api/products',
    '/api/search',
    '/api/catalog',
    '/api/inventory',
    '/api/cards',
    '/api/pokemon',
    '/api/collectibles',
    '/api/v1/products',
    '/api/v2/products',
    '/api/v1/search',
    '/api/v2/search',
    '/graphql',
    '/gql',
    '/_api/products',
    '/_next/api/products',
    '/rest/products',
    '/services/products',
    '/data/products.json',
    '/products.json',
    '/api/listings',
    '/api/marketplace'
  ]

  async discoverEndpoints() {
    console.log('🔍 Starting Fanatics Collect Static API Discovery...')
    console.log(`Base URL: ${this.baseUrl}`)
    
    for (const endpoint of this.commonEndpoints) {
      await this.testEndpoint(endpoint)
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log('\n📊 Discovery Results:')
    this.results.forEach(result => {
      console.log(`${result.method} ${result.endpoint} - ${result.status} - ${result.description}`)
    })

    // Filter successful endpoints
    const successful = this.results.filter(r => r.status >= 200 && r.status < 400)
    if (successful.length > 0) {
      console.log('\n✅ Potential API Endpoints Found:')
      successful.forEach(result => {
        console.log(`  ${result.endpoint} (${result.responseType})`)
      })
    } else {
      console.log('\n❌ No obvious API endpoints found.')
    }

    return this.results
  }

  private async testEndpoint(endpoint: string) {
    const fullUrl = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await axios.get(fullUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        validateStatus: () => true // Don't throw on 4xx/5xx
      })

      const contentType = response.headers['content-type'] || ''
      const isJson = contentType.includes('application/json')
      const isHtml = contentType.includes('text/html')
      
      let description = `${response.status} ${response.statusText}`
      let hasData = false

      if (isJson && response.data) {
        hasData = Object.keys(response.data).length > 0
        description += isJson ? ' (JSON)' : ''
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
        fs.writeFileSync(
          `fanatics-sample-${endpoint.replace(/\//g, '_')}.json`, 
          JSON.stringify(response.data, null, 2)
        )
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
  const discovery = new FanaticsStaticDiscovery()
  const results = await discovery.discoverEndpoints()
  
  // Save results
  const fs = require('fs')
  fs.writeFileSync('fanatics-discovery-results.json', JSON.stringify(results, null, 2))
  console.log('\n💾 Results saved to fanatics-discovery-results.json')
}

main().catch(console.error)
