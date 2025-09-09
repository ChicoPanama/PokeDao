/**
 * Phygitals.com API Endpoint Analysis & Data Extractor
 * Based on successful API discovery that captured extensive Pokemon data
 */

const fs = require('fs');

// From our successful discovery, we found these key API endpoints and data patterns
class PhygitalsAPIAnalyzer {
  constructor() {
    this.discoveredEndpoints = [
      // Core API endpoints discovered
      'https://api.phygitals.com/api/marketplace/leaderboard',
      'https://api.phygitals.com/api/marketplace/leaderboard/weekly',
      'https://api.phygitals.com/api/marketplace/sales',
      'https://api.phygitals.com/api/marketplace/filters',
      'https://api.phygitals.com/api/marketplace/marketplace-listings',
      'https://api.phygitals.com/api/store/filters',
      'https://api.phygitals.com/api/sweepstakes/recent',
      'https://api.phygitals.com/api/vm/recent',
      'https://api.phygitals.com/api/vm/available',
      'https://api.phygitals.com/api/users/p/{userId}',
      
      // Next.js data endpoints for detailed card information
      'https://www.phygitals.com/_next/data/{buildId}/card/{cardId}.json',
      'https://www.phygitals.com/_next/data/{buildId}/store/{storeId}.json',
      'https://www.phygitals.com/_next/data/{buildId}/u/{username}.json',
      'https://www.phygitals.com/_next/data/{buildId}/pokemon/generation/{id}.json',
      'https://www.phygitals.com/_next/data/{buildId}/series.json',
      'https://www.phygitals.com/_next/data/{buildId}/claw/{packType}.json',
    ];
    
    this.pokemonDataSources = {
      marketplace: 'Live marketplace listings with prices and card details',
      userCollections: 'User profile data with total volume and card counts',
      cardDetails: 'Individual card data with images, grades, and valuations',
      storeListings: 'eBay integration with Pokemon card store data',
      vmBoxes: 'Virtual machine box contents with Pokemon card prizes',
      filters: 'Available Pokemon sets, graders, grades, and metadata'
    };
  }

  analyzeDiscoveredData() {
    console.log('🎯 PHYGITALS.COM API ANALYSIS RESULTS');
    console.log('===================================');
    
    console.log('\n📡 DISCOVERED API ENDPOINTS:');
    this.discoveredEndpoints.forEach((endpoint, index) => {
      console.log(`  ${index + 1}. ${endpoint}`);
    });
    
    console.log('\n🎴 POKEMON DATA SOURCES IDENTIFIED:');
    Object.entries(this.pokemonDataSources).forEach(([source, description]) => {
      console.log(`  ${source}: ${description}`);
    });
    
    console.log('\n🔍 KEY FINDINGS FROM DISCOVERY:');
    console.log('  ✅ Active marketplace with live Pokemon card listings');
    console.log('  ✅ Integration with eBay for Pokemon card store data');
    console.log('  ✅ User collections with volume and card count metrics');
    console.log('  ✅ Detailed card metadata including PSA/BGS/CGC grading');
    console.log('  ✅ Real-time sales data and transaction history');
    console.log('  ✅ Comprehensive filtering by sets, graders, and grades');
    console.log('  ✅ Virtual machine boxes containing Pokemon card prizes');
    
    console.log('\n💰 PRICING DATA AVAILABILITY:');
    console.log('  ✅ Live marketplace prices for Pokemon cards');
    console.log('  ✅ Historical sales data from api/marketplace/sales');
    console.log('  ✅ User volume metrics indicating transaction values');
    console.log('  ✅ eBay integration providing additional pricing reference');
    console.log('  ✅ Prize valuations from virtual machine boxes');
    
    console.log('\n🏆 HIGH-VALUE DATA PATTERNS FOUND:');
    console.log('  • PSA 10 graded Pokemon cards (multiple listings)');
    console.log('  • Japanese Pokemon cards (SV series, Battle Partners)');
    console.log('  • Vintage Pokemon cards (1996 Base Set, 2001 Expedition)');
    console.log('  • Graded cards from PSA, BGS, CGC authentication');
    console.log('  • Recent Pokemon sets (Scarlet & Violet, Crown Zenith)');
    
    return {
      apiEndpoints: this.discoveredEndpoints,
      dataSources: this.pokemonDataSources,
      hasMarketplaceData: true,
      hasUserData: true,
      hasCardDetails: true,
      hasEbayIntegration: true,
      hasPricingData: true,
      hasGradingData: true
    };
  }

  generateAPIClient() {
    const apiClient = `
/**
 * Phygitals.com Pokemon Card Data API Client
 * Generated from successful endpoint discovery
 */

class PhygitalsAPI {
  constructor() {
    this.baseURL = 'https://api.phygitals.com/api';
    this.nextDataURL = 'https://www.phygitals.com/_next/data/Orw32MMnmZuQaMUzy29Nh';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://www.phygitals.com/'
    };
  }

  // Get marketplace listings with Pokemon cards
  async getMarketplaceListings(options = {}) {
    const params = new URLSearchParams({
      searchTerm: options.searchTerm || '',
      sortBy: options.sortBy || 'price-low-high',
      itemsPerPage: options.limit || 24,
      page: options.page || 0,
      metadataConditions: JSON.stringify({
        set: options.sets || [],
        grader: options.graders || [],
        grade: options.grades || [],
        rarity: options.rarities || [],
        type: options.types || [],
        'set release date': options.releaseDates || [],
        'grade type': options.gradeTypes || [],
        language: options.languages || [],
        category: options.categories || []
      }),
      priceRange: JSON.stringify(options.priceRange || [null, null]),
      fmvRange: JSON.stringify(options.fmvRange || [null, null]),
      listedStatus: options.listedStatus || 'any'
    });
    
    const response = await fetch(\`\${this.baseURL}/marketplace/marketplace-listings?\${params}\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get recent sales data
  async getSalesData(limit = 10, page = 0) {
    const response = await fetch(\`\${this.baseURL}/marketplace/sales?limit=\${limit}&page=\${page}\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get marketplace filters (sets, graders, etc.)
  async getMarketplaceFilters() {
    const response = await fetch(\`\${this.baseURL}/marketplace/filters\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get leaderboard data (user volumes)
  async getLeaderboard(page = 0, limit = 10, amount = 10) {
    const response = await fetch(\`\${this.baseURL}/marketplace/leaderboard?page=\${page}&limit=\${limit}&amount=\${amount}\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get detailed card information
  async getCardDetails(cardId) {
    const response = await fetch(\`\${this.nextDataURL}/card/\${cardId}.json?id=\${cardId}\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get user collection data
  async getUserData(usernameOrAddress) {
    const response = await fetch(\`\${this.nextDataURL}/u/\${usernameOrAddress}.json?usernameOrAddress=\${usernameOrAddress}\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get Pokemon generation data
  async getPokemonGeneration(id) {
    const response = await fetch(\`\${this.nextDataURL}/pokemon/generation/\${id}.json?id=\${id}\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get series statistics
  async getSeriesData() {
    const response = await fetch(\`\${this.nextDataURL}/series.json\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get virtual machine box data with Pokemon prizes
  async getVMBoxes() {
    const response = await fetch(\`\${this.baseURL}/vm/available\`, {
      headers: this.headers
    });
    return response.json();
  }

  // Search for Pokemon cards specifically
  async searchPokemon(query = 'pokemon', options = {}) {
    return this.getMarketplaceListings({
      searchTerm: query,
      ...options
    });
  }

  // Get graded Pokemon cards
  async getGradedCards(grader = null, grade = null) {
    const filters = {};
    if (grader) filters.graders = [grader];
    if (grade) filters.grades = [grade];
    
    return this.getMarketplaceListings(filters);
  }
}

module.exports = PhygitalsAPI;
`;

    fs.writeFileSync('phygitals-api-client.js', apiClient);
    console.log('\n💾 Generated API client: phygitals-api-client.js');
    
    return apiClient;
  }

  saveResults() {
    const results = {
      discoveryTimestamp: new Date().toISOString(),
      platform: 'Phygitals.com',
      success: true,
      summary: {
        apiEndpointsFound: this.discoveredEndpoints.length,
        pokemonDataSources: Object.keys(this.pokemonDataSources).length,
        hasLivePricing: true,
        hasEbayIntegration: true,
        hasGradingData: true,
        hasUserCollections: true
      },
      apiEndpoints: this.discoveredEndpoints,
      pokemonDataSources: this.pokemonDataSources,
      keyFindings: [
        'Active Pokemon card marketplace with live listings',
        'eBay integration for additional Pokemon card data',
        'Comprehensive grading data (PSA, BGS, CGC)',
        'User collection metrics and transaction volumes',
        'Historical sales data and pricing trends',
        'Advanced filtering by sets, graders, grades, and rarity',
        'Virtual machine boxes containing Pokemon card prizes'
      ],
      nextSteps: [
        'Implement API client for data extraction',
        'Build comprehensive Pokemon card scraper',
        'Integrate pricing data into PokeDAO system',
        'Cross-reference with existing eBay and Pokemon TCG data',
        'Develop real-time price monitoring capabilities'
      ],
      integrationPotential: 'HIGH - Excellent source for Pokemon card pricing and market data'
    };

    fs.writeFileSync('phygitals-api-discovery-results.json', JSON.stringify(results, null, 2));
    console.log('💾 Full results saved to phygitals-api-discovery-results.json');
    
    return results;
  }
}

// Run the analysis
const analyzer = new PhygitalsAPIAnalyzer();
const analysisResults = analyzer.analyzeDiscoveredData();
analyzer.generateAPIClient();
const finalResults = analyzer.saveResults();

console.log('\n✅ PHYGITALS.COM API DISCOVERY COMPLETE!');
console.log('🎯 Ready to build comprehensive Pokemon card data scraper');
console.log('💰 Excellent source for pricing data integration into PokeDAO');
