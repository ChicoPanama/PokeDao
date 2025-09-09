
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
    
    const response = await fetch(`${this.baseURL}/marketplace/marketplace-listings?${params}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get recent sales data
  async getSalesData(limit = 10, page = 0) {
    const response = await fetch(`${this.baseURL}/marketplace/sales?limit=${limit}&page=${page}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get marketplace filters (sets, graders, etc.)
  async getMarketplaceFilters() {
    const response = await fetch(`${this.baseURL}/marketplace/filters`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get leaderboard data (user volumes)
  async getLeaderboard(page = 0, limit = 10, amount = 10) {
    const response = await fetch(`${this.baseURL}/marketplace/leaderboard?page=${page}&limit=${limit}&amount=${amount}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get detailed card information
  async getCardDetails(cardId) {
    const response = await fetch(`${this.nextDataURL}/card/${cardId}.json?id=${cardId}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get user collection data
  async getUserData(usernameOrAddress) {
    const response = await fetch(`${this.nextDataURL}/u/${usernameOrAddress}.json?usernameOrAddress=${usernameOrAddress}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get Pokemon generation data
  async getPokemonGeneration(id) {
    const response = await fetch(`${this.nextDataURL}/pokemon/generation/${id}.json?id=${id}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get series statistics
  async getSeriesData() {
    const response = await fetch(`${this.nextDataURL}/series.json`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get virtual machine box data with Pokemon prizes
  async getVMBoxes() {
    const response = await fetch(`${this.baseURL}/vm/available`, {
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
