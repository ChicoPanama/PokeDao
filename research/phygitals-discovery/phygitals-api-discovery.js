/**
 * Phygitals.com API Discovery Tool
 * Uses the same methodology we used for Collector Crypt to discover API endpoints
 * Investigates the actual API endpoints used by phygitals.com for Pokemon card data
 */

const { chromium } = require('playwright');

class PhygitalsAPIDiscovery {
  constructor() {
    this.apiEndpoints = new Set();
    this.networkRequests = [];
    this.pokemonData = [];
    this.graphqlQueries = [];
  }

  async initialize() {
    console.log('🔍 Initializing Phygitals.com API Discovery');
    console.log('==========================================');
    console.log('🎯 Target: Pokemon card pricing and marketplace data');
    
    this.browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Track all network requests to find API endpoints
    this.page.on('request', request => {
      const url = request.url();
      const method = request.method();
      
      // Look for API-like requests
      if (this.isAPILikeRequest(url)) {
        console.log(`📡 API Request: ${method} ${url}`);
        
        const requestData = {
          url,
          method,
          resourceType: request.resourceType(),
          headers: request.headers(),
          timestamp: new Date().toISOString()
        };

        if (request.postData()) {
          requestData.postData = request.postData();
          console.log(`📦 POST Data:`, request.postData().substring(0, 200));
        }
        
        this.networkRequests.push(requestData);
        this.apiEndpoints.add(url);
      }
    });
    
    // Track responses to capture data structures
    this.page.on('response', async (response) => {
      const url = response.url();
      
      if (this.isAPILikeRequest(url) && response.status() === 200) {
        try {
          const contentType = response.headers()['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            const responseText = await response.text();
            console.log(`📊 JSON Response from ${url}:`);
            console.log(responseText.substring(0, 300) + '...');
            
            try {
              const data = JSON.parse(responseText);
              
              // Check if this contains Pokemon-related data
              if (this.containsPokemonData(data)) {
                console.log('🎴 Found Pokemon data!');
                this.pokemonData.push({
                  url,
                  data: data,
                  timestamp: new Date().toISOString(),
                  dataStructure: this.analyzeDataStructure(data)
                });
              }
              
              // Check if it's GraphQL
              if (url.includes('graphql')) {
                this.graphqlQueries.push({
                  url,
                  data: data,
                  timestamp: new Date().toISOString()
                });
              }
              
            } catch (parseError) {
              console.log('❌ Error parsing JSON response');
            }
          }
        } catch (error) {
          console.log(`⚠️  Error processing response from ${url}:`, error.message);
        }
      }
    });

    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    });
  }

  isAPILikeRequest(url) {
    return url.includes('phygitals.com') && (
      url.includes('/api/') ||
      url.includes('/graphql') ||
      url.includes('/rest/') ||
      url.includes('/v1/') ||
      url.includes('/v2/') ||
      url.includes('.json') ||
      url.includes('/ajax/') ||
      url.includes('/data/') ||
      url.includes('marketplace') ||
      url.includes('search') ||
      url.includes('products') ||
      url.includes('cards') ||
      url.includes('pokemon') ||
      url.includes('pricing') ||
      url.includes('inventory')
    );
  }

  containsPokemonData(data) {
    const dataStr = JSON.stringify(data).toLowerCase();
    return dataStr.includes('pokemon') ||
           dataStr.includes('pikachu') ||
           dataStr.includes('charizard') ||
           dataStr.includes('tcg') ||
           dataStr.includes('trading card') ||
           dataStr.includes('booster') ||
           dataStr.includes('psa') ||
           dataStr.includes('bgs') ||
           dataStr.includes('cgc') ||
           dataStr.includes('graded');
  }

  analyzeDataStructure(data) {
    if (Array.isArray(data)) {
      return {
        type: 'array',
        length: data.length,
        sampleItem: data.length > 0 ? Object.keys(data[0]) : []
      };
    } else if (typeof data === 'object') {
      return {
        type: 'object',
        keys: Object.keys(data),
        nested: Object.keys(data).length
      };
    }
    return { type: typeof data };
  }

  async discoverAPIEndpoints() {
    console.log('🚀 Starting Phygitals.com API endpoint discovery...');
    
    // 1. Visit main site
    console.log('\n📱 Step 1: Loading main site');
    await this.page.goto('https://www.phygitals.com/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    await this.page.waitForTimeout(5000);
    
    // 2. Look for marketplace/shop sections
    console.log('\n🛒 Step 2: Finding marketplace sections');
    const marketplaceSelectors = [
      'a[href*="marketplace"]',
      'a[href*="shop"]', 
      'a[href*="store"]',
      'a[href*="cards"]',
      'a[href*="trading"]',
      'a[href*="pokemon"]',
      '.marketplace-link',
      '.shop-link',
      '[data-testid*="marketplace"]',
      '[data-testid*="shop"]'
    ];
    
    for (const selector of marketplaceSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const href = await element.getAttribute('href');
          console.log(`🎯 Found marketplace link: ${selector} -> ${href}`);
          await element.click();
          await this.page.waitForTimeout(5000);
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    // 3. Search for Pokemon specifically  
    console.log('\n🎴 Step 3: Pokemon search');
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="search"]',
      'input[placeholder*="Search"]',
      '.search-input',
      '#search',
      '[data-testid="search"]',
      'input[name="search"]',
      'input[name="q"]'
    ];
    
    let searchFound = false;
    for (const selector of searchSelectors) {
      try {
        const searchInput = await this.page.$(selector);
        if (searchInput) {
          console.log(`🔍 Found search input: ${selector}`);
          await searchInput.click();
          await searchInput.fill('pokemon');
          await this.page.press(selector, 'Enter');
          await this.page.waitForTimeout(5000);
          searchFound = true;
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    if (!searchFound) {
      console.log('⚠️  No search found, trying direct Pokemon URLs');
      const pokemonUrls = [
        'https://www.phygitals.com/pokemon',
        'https://www.phygitals.com/cards/pokemon',
        'https://www.phygitals.com/trading-cards/pokemon',
        'https://www.phygitals.com/marketplace/pokemon',
        'https://www.phygitals.com/shop/pokemon',
        'https://www.phygitals.com/products/pokemon'
      ];
      
      for (const url of pokemonUrls) {
        try {
          console.log(`🌐 Trying: ${url}`);
          await this.page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
          await this.page.waitForTimeout(3000);
          break;
        } catch (error) {
          console.log(`❌ ${url} not accessible`);
        }
      }
    }
    
    // 4. Trigger more API calls by scrolling and interacting
    console.log('\n📜 Step 4: Triggering more API calls');
    for (let i = 0; i < 5; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 1000));
      await this.page.waitForTimeout(2000);
    }
    
    // 5. Try to find product listings to click
    console.log('\n🃏 Step 5: Interacting with product listings');
    const productSelectors = [
      '.product',
      '.card',
      '.item',
      '.listing',
      '[data-testid*="product"]',
      '[data-testid*="card"]',
      'a[href*="product"]',
      'a[href*="item"]'
    ];
    
    for (const selector of productSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          console.log(`🎯 Found ${elements.length} products with selector: ${selector}`);
          // Click first few products to trigger detail API calls
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            try {
              await elements[i].click();
              await this.page.waitForTimeout(3000);
              await this.page.goBack();
              await this.page.waitForTimeout(2000);
            } catch (error) {
              // Continue with next product
            }
          }
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    // 6. Final scroll to capture any lazy-loaded content
    console.log('\n⬇️ Step 6: Final content loading');
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(3000);
    }
  }

  analyzeResults() {
    console.log('\n📊 PHYGITALS.COM API DISCOVERY ANALYSIS');
    console.log('======================================');
    
    console.log(`\n📡 Total API-like requests captured: ${this.networkRequests.length}`);
    console.log(`🌐 Unique API endpoints discovered: ${this.apiEndpoints.size}`);
    console.log(`🎴 Pokemon data responses: ${this.pokemonData.length}`);
    console.log(`📦 GraphQL queries: ${this.graphqlQueries.length}`);
    
    if (this.apiEndpoints.size > 0) {
      console.log('\n🎯 DISCOVERED API ENDPOINTS:');
      Array.from(this.apiEndpoints).forEach((endpoint, index) => {
        console.log(`  ${index + 1}. ${endpoint}`);
      });
    }
    
    if (this.pokemonData.length > 0) {
      console.log('\n🎴 POKEMON DATA STRUCTURES FOUND:');
      this.pokemonData.forEach((item, index) => {
        console.log(`\n  Pokemon Data ${index + 1}:`);
        console.log(`    URL: ${item.url}`);
        console.log(`    Structure: ${JSON.stringify(item.dataStructure)}`);
        console.log(`    Sample: ${JSON.stringify(item.data).substring(0, 200)}...`);
      });
    }
    
    if (this.graphqlQueries.length > 0) {
      console.log('\n📦 GRAPHQL QUERIES:');
      this.graphqlQueries.forEach((query, index) => {
        console.log(`\n  Query ${index + 1}:`);
        console.log(`    URL: ${query.url}`);
        console.log(`    Data: ${JSON.stringify(query.data).substring(0, 200)}...`);
      });
    }
    
    // Categorize endpoints by type
    const endpointsByType = {
      search: [],
      products: [],
      marketplace: [],
      api: [],
      graphql: [],
      other: []
    };
    
    Array.from(this.apiEndpoints).forEach(endpoint => {
      if (endpoint.includes('search')) endpointsByType.search.push(endpoint);
      else if (endpoint.includes('product') || endpoint.includes('item')) endpointsByType.products.push(endpoint);
      else if (endpoint.includes('marketplace') || endpoint.includes('shop')) endpointsByType.marketplace.push(endpoint);
      else if (endpoint.includes('/api/')) endpointsByType.api.push(endpoint);
      else if (endpoint.includes('graphql')) endpointsByType.graphql.push(endpoint);
      else endpointsByType.other.push(endpoint);
    });
    
    console.log('\n📋 ENDPOINTS BY CATEGORY:');
    Object.entries(endpointsByType).forEach(([category, endpoints]) => {
      if (endpoints.length > 0) {
        console.log(`\n  ${category.toUpperCase()}:`);
        endpoints.forEach((endpoint, index) => {
          console.log(`    ${index + 1}. ${endpoint}`);
        });
      }
    });
    
    // Save detailed results
    const fs = require('fs');
    const results = {
      discoveryTimestamp: new Date().toISOString(),
      summary: {
        totalRequests: this.networkRequests.length,
        uniqueEndpoints: this.apiEndpoints.size,
        pokemonDataFound: this.pokemonData.length,
        graphqlQueries: this.graphqlQueries.length
      },
      apiEndpoints: Array.from(this.apiEndpoints),
      endpointsByType,
      networkRequests: this.networkRequests,
      pokemonData: this.pokemonData,
      graphqlQueries: this.graphqlQueries
    };
    
    fs.writeFileSync('phygitals-api-discovery-results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Full results saved to phygitals-api-discovery-results.json');
    
    if (this.apiEndpoints.size === 0) {
      console.log('\n❌ No API endpoints discovered.');
      console.log('💡 Possible reasons:');
      console.log('   - Site uses server-side rendering');
      console.log('   - APIs are heavily obfuscated');
      console.log('   - Requires authentication first');
      console.log('   - Uses different data loading mechanism');
    } else {
      console.log('\n✅ API Discovery Complete!');
      console.log('🎯 Next steps:');
      console.log('   1. Test discovered endpoints');
      console.log('   2. Analyze data structures');
      console.log('   3. Build API client');
      console.log('   4. Extract Pokemon pricing data');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const discovery = new PhygitalsAPIDiscovery();
  
  try {
    await discovery.initialize();
    await discovery.discoverAPIEndpoints();
    discovery.analyzeResults();
  } catch (error) {
    console.error('💥 API discovery failed:', error);
  } finally {
    await discovery.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PhygitalsAPIDiscovery };
