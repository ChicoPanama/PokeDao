/**
 * PHYGITALS TOTAL MARKETPLACE INVESTIGATION
 * Let's check if we can find the true scope of the marketplace
 */

const axios = require('axios');
const fs = require('fs');

class PhygitalsMarketplaceInvestigation {
  constructor() {
    this.baseURL = 'https://api.phygitals.com';
    this.results = {
      totalListings: 0,
      totalCategories: 0,
      apiEndpoints: [],
      marketplaceStats: {}
    };
  }

  async investigateMarketplaceSize() {
    console.log('🔍 INVESTIGATING PHYGITALS MARKETPLACE SIZE');
    console.log('==========================================');

    try {
      // 1. Check marketplace stats/summary endpoints
      await this.checkMarketplaceStats();
      
      // 2. Check total listings across all categories
      await this.checkTotalListings();
      
      // 3. Check pagination limits
      await this.checkPaginationLimits();
      
      // 4. Generate comprehensive report
      this.generateReport();
      
    } catch (error) {
      console.log('❌ Investigation failed:', error.message);
    }
  }

  async checkMarketplaceStats() {
    console.log('\n📊 CHECKING MARKETPLACE STATISTICS...');
    
    const statsEndpoints = [
      '/api/marketplace/stats',
      '/api/marketplace/summary', 
      '/api/marketplace/overview',
      '/api/stats',
      '/api/dashboard',
      '/api/marketplace/leaderboard',
      '/api/marketplace/analytics'
    ];

    for (const endpoint of statsEndpoints) {
      try {
        console.log(`   🌐 Trying: ${endpoint}`);
        const response = await this.makeRequest(`${this.baseURL}${endpoint}`);
        
        if (response && response.data) {
          console.log(`   ✅ ${endpoint}: Found data`);
          
          // Look for total counts in response
          const dataStr = JSON.stringify(response.data);
          const largeNumbers = dataStr.match(/\d{4,}/g);
          
          if (largeNumbers) {
            console.log(`   📈 Large numbers found: ${largeNumbers.join(', ')}`);
          }
          
          this.results.marketplaceStats[endpoint] = response.data;
        }
        
        await this.delay(2000);
        
      } catch (error) {
        console.log(`   ❌ ${endpoint}: ${error.response?.status || error.message}`);
      }
    }
  }

  async checkTotalListings() {
    console.log('\n🎴 CHECKING TOTAL LISTINGS...');
    
    const listingEndpoints = [
      '/api/marketplace/marketplace-listings',
      '/api/marketplace/listings', 
      '/api/marketplace/search',
      '/api/marketplace/products',
      '/api/marketplace/cards'
    ];

    for (const endpoint of listingEndpoints) {
      try {
        console.log(`   🌐 Checking: ${endpoint}`);
        
        // Try with large page size to see total available
        const params = {
          page: 1,
          limit: 1,
          size: 1,
          per_page: 1
        };
        
        const response = await this.makeRequest(`${this.baseURL}${endpoint}`, { params });
        
        if (response && response.data) {
          // Look for pagination info that shows total
          const { total, totalCount, totalItems, totalRecords, count, total_count } = response.data;
          const totalFound = total || totalCount || totalItems || totalRecords || count || total_count;
          
          if (totalFound) {
            console.log(`   ✅ ${endpoint}: Total items = ${totalFound.toLocaleString()}`);
            this.results.totalListings = Math.max(this.results.totalListings, totalFound);
          }
          
          // Check if response has pagination metadata
          if (response.data.pagination) {
            console.log(`   📄 Pagination info:`, response.data.pagination);
          }
          
          if (response.data.meta) {
            console.log(`   📄 Meta info:`, response.data.meta);
          }
        }
        
        await this.delay(2000);
        
      } catch (error) {
        console.log(`   ❌ ${endpoint}: ${error.response?.status || error.message}`);
      }
    }
  }

  async checkPaginationLimits() {
    console.log('\n📄 CHECKING PAGINATION LIMITS...');
    
    try {
      // Try to get a page far into the dataset to see total pages
      const endpoint = '/api/marketplace/marketplace-listings';
      
      for (const page of [1, 10, 50, 100, 500]) {
        try {
          console.log(`   📄 Testing page ${page}...`);
          
          const response = await this.makeRequest(`${this.baseURL}${endpoint}?page=${page}&limit=100`);
          
          if (response && response.data) {
            const items = response.data.items || response.data.data || response.data.results || [];
            console.log(`   Page ${page}: ${items.length} items`);
            
            if (items.length === 0) {
              console.log(`   🛑 Reached end at page ${page - 1}`);
              break;
            }
          }
          
          await this.delay(3000);
          
        } catch (error) {
          console.log(`   ❌ Page ${page}: ${error.response?.status || error.message}`);
          if (error.response?.status === 404) {
            console.log(`   🛑 Reached pagination limit before page ${page}`);
            break;
          }
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Pagination check failed: ${error.message}`);
    }
  }

  async makeRequest(url, config = {}) {
    return await axios.get(url, {
      ...config,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.phygitals.com/',
        ...config.headers
      },
      timeout: 30000
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateReport() {
    console.log('\n📋 PHYGITALS MARKETPLACE INVESTIGATION REPORT');
    console.log('============================================');
    
    console.log(`🎯 Maximum Total Listings Found: ${this.results.totalListings.toLocaleString()}`);
    
    if (this.results.totalListings >= 50000) {
      console.log('🎉 FOUND IT! This could be where the 50,000 number came from!');
    } else if (this.results.totalListings > 10000) {
      console.log('📊 Large marketplace detected, may contain 50K+ with all categories');
    } else {
      console.log('🤔 Need to investigate other data sources for 50K number');
    }

    // Save detailed results
    fs.writeFileSync('phygitals-marketplace-investigation.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      maxTotalListings: this.results.totalListings,
      marketplaceStats: this.results.marketplaceStats,
      summary: 'Investigation into Phygitals marketplace size to locate 50,000 listings'
    }, null, 2));

    console.log('\n📄 Detailed results saved to: phygitals-marketplace-investigation.json');
  }
}

// Run the investigation
async function main() {
  const investigation = new PhygitalsMarketplaceInvestigation();
  await investigation.investigateMarketplaceSize();
}

main().catch(console.error);
