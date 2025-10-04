/**
 * Comprehensive Phygitals Data Harvester
 *
 * Goal: Harvest ALL 7,261+ Pokemon cards from Phygitals marketplace
 * Previous attempt only got 1,195 cards (16.5%)
 *
 * Strategy:
 * 1. Use multiple API endpoints for complete coverage
 * 2. Try different search strategies (empty search, category filters, pagination)
 * 3. Use Next.js data endpoints as fallback
 * 4. Aggressive pagination to ensure we get everything
 *
 * Run: pnpm tsx scripts/harvest-phygitals-complete.ts
 */

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  API_BASE: 'https://api.phygitals.com/api',
  NEXTDATA_BASE: 'https://www.phygitals.com/_next/data/Orw32MMnmZuQaMUzy29Nh',
  RATE_LIMIT_MS: 1000, // 1 request per second
  MAX_RETRIES: 5,
  ITEMS_PER_PAGE: 100, // Max items per request
  MAX_PAGES: 1000, // Safety limit
  OUTPUT_FILE: 'data/phygitals/complete-harvest.json',
};

// ============================================================================
// TYPES
// ============================================================================

interface PhygitalsCard {
  id: string;
  nftAddress?: string;
  name: string;
  price: number | null;
  fmv: number | null;
  imageUrl?: string;
  set?: string;
  grader?: string;
  grade?: string | number;
  category?: string;
  language?: string;
  listedStatus?: string;
  owner?: {
    username?: string;
    wallet?: string;
  };
  metadata?: any;
}

interface HarvestStats {
  totalCards: number;
  withPricing: number;
  pokemonCards: number;
  uniqueCards: Set<string>;
  errors: number;
  pagesProcessed: number;
  endpointsUsed: string[];
}

// ============================================================================
// HARVESTER
// ============================================================================

class PhygitalsComprehensiveHarvester {
  private stats: HarvestStats;
  private cards: Map<string, PhygitalsCard>;
  private lastRequestTime: number = 0;

  constructor() {
    this.stats = {
      totalCards: 0,
      withPricing: 0,
      pokemonCards: 0,
      uniqueCards: new Set(),
      errors: 0,
      pagesProcessed: 0,
      endpointsUsed: [],
    };
    this.cards = new Map();
  }

  /**
   * Rate limiting
   */
  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < CONFIG.RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_MS - elapsed));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make API request with retries
   */
  private async request<T>(url: string, label: string): Promise<T | null> {
    await this.rateLimit();

    for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'PokeDAO/2.0 (Comprehensive Data Collection)',
            'Accept': 'application/json',
            'Referer': 'https://www.phygitals.com/',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`⚠️  ${label}: 404 Not Found`);
            return null;
          }

          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            console.log(`⏳ Rate limited. Waiting ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: any = await response.json();
        return data as T;
      } catch (error: any) {
        console.error(`❌ ${label} (attempt ${attempt + 1}/${CONFIG.MAX_RETRIES}):`, error.message);

        if (attempt < CONFIG.MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.stats.errors++;
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Strategy 1: Marketplace listings with aggressive pagination
   */
  private async harvestMarketplaceListings() {
    console.log('\n📊 Strategy 1: Marketplace Listings (Aggressive Pagination)');

    const searchTerms = [
      '',          // Empty = all items
      'pokemon',   // Pokemon specific
      'charizard', // High-value cards
      'pikachu',
      'base set',
      '1st edition',
    ];

    for (const searchTerm of searchTerms) {
      console.log(`\n🔍 Searching: "${searchTerm || 'ALL ITEMS'}"`);

      for (let page = 0; page < CONFIG.MAX_PAGES; page++) {
        const params = new URLSearchParams({
          searchTerm,
          sortBy: 'price-low-high',
          itemsPerPage: CONFIG.ITEMS_PER_PAGE.toString(),
          page: page.toString(),
          metadataConditions: '{}',
          priceRange: '[null,null]',
          fmvRange: '[null,null]',
          listedStatus: 'any',
        });

        const url = `${CONFIG.API_BASE}/marketplace/marketplace-listings?${params}`;
        const data = await this.request<any>(url, `Page ${page}`);

        if (!data || !data.data || data.data.length === 0) {
          console.log(`   ✓ Completed at page ${page} (no more results)`);
          break;
        }

        // Process cards
        for (const card of data.data) {
          this.addCard(card);
        }

        this.stats.pagesProcessed++;
        console.log(`   Page ${page}: +${data.data.length} cards (Total unique: ${this.cards.size})`);

        // If we got less than requested, we're at the end
        if (data.data.length < CONFIG.ITEMS_PER_PAGE) {
          console.log(`   ✓ Last page reached`);
          break;
        }
      }
    }

    this.stats.endpointsUsed.push('marketplace-listings');
  }

  /**
   * Strategy 2: Sales data (historical comps)
   */
  private async harvestSalesData() {
    console.log('\n💰 Strategy 2: Sales Data (Historical)');

    for (let page = 0; page < 100; page++) {
      const url = `${CONFIG.API_BASE}/marketplace/sales?limit=100&page=${page}`;
      const data = await this.request<any>(url, `Sales Page ${page}`);

      if (!data || !data.data || data.data.length === 0) {
        console.log(`   ✓ Completed at page ${page}`);
        break;
      }

      for (const sale of data.data) {
        if (sale.nftAddress) {
          // Treat sales as potential card entries
          this.addCard({
            id: sale.nftAddress || sale.id,
            name: sale.cardName || sale.name || 'Unknown',
            price: sale.price,
            listedStatus: 'sold',
          });
        }
      }

      console.log(`   Page ${page}: +${data.data.length} sales (Total unique: ${this.cards.size})`);

      if (data.data.length < 100) break;
    }

    this.stats.endpointsUsed.push('sales');
  }

  /**
   * Strategy 3: Try Next.js data endpoints
   */
  private async harvestNextDataEndpoints() {
    console.log('\n🔄 Strategy 3: Next.js Data Endpoints');

    // Try series endpoint
    try {
      const seriesUrl = `${CONFIG.NEXTDATA_BASE}/series.json`;
      const seriesData = await this.request<any>(seriesUrl, 'Series Data');

      if (seriesData) {
        console.log(`   ✓ Series data retrieved`);
        // Process any card data from series
      }
    } catch (error) {
      console.log(`   ⚠️  Series endpoint not available`);
    }

    this.stats.endpointsUsed.push('nextdata');
  }

  /**
   * Add card to collection (deduplicate by ID)
   */
  private addCard(cardData: any) {
    const id = cardData.id || cardData.nftAddress || cardData.address;
    if (!id) return;

    // Deduplicate
    if (this.stats.uniqueCards.has(id)) return;

    const card: PhygitalsCard = {
      id,
      nftAddress: cardData.nftAddress || cardData.address,
      name: cardData.name || 'Unknown',
      price: cardData.price,
      fmv: cardData.fmv,
      imageUrl: cardData.imageUrl || cardData.image,
      set: cardData.set || cardData.set_name,
      grader: cardData.grader,
      grade: cardData.grade,
      category: cardData.category,
      language: cardData.language,
      listedStatus: cardData.listedStatus || cardData.listing_status,
      owner: cardData.owner || cardData.seller,
      metadata: cardData,
    };

    this.cards.set(id, card);
    this.stats.uniqueCards.add(id);
    this.stats.totalCards++;

    if (card.price !== null && card.price !== undefined && card.price > 0) {
      this.stats.withPricing++;
    }

    // Check if Pokemon (basic heuristic)
    const name = card.name.toLowerCase();
    if (name.includes('pokemon') || name.includes('pikachu') || name.includes('charizard') || card.category?.toLowerCase().includes('pokemon')) {
      this.stats.pokemonCards++;
    }
  }

  /**
   * Run complete harvest
   */
  async harvest() {
    console.log('🚀 COMPREHENSIVE PHYGITALS HARVEST');
    console.log('🎯 Target: 7,261+ Pokemon cards\n');

    const startTime = Date.now();

    try {
      // Run all strategies
      await this.harvestMarketplaceListings();
      await this.harvestSalesData();
      await this.harvestNextDataEndpoints();

      // Results
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('\n✅ HARVEST COMPLETE!');
      console.log('='.repeat(60));
      console.log(`📊 Total Unique Cards: ${this.cards.size}`);
      console.log(`💰 With Pricing: ${this.stats.withPricing}`);
      console.log(`🎮 Pokemon Cards: ${this.stats.pokemonCards}`);
      console.log(`📄 Pages Processed: ${this.stats.pagesProcessed}`);
      console.log(`🔌 Endpoints Used: ${this.stats.endpointsUsed.join(', ')}`);
      console.log(`❌ Errors: ${this.stats.errors}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log('='.repeat(60));

      // Save results
      const output = {
        metadata: {
          harvestedAt: new Date().toISOString(),
          duration: `${duration}s`,
          stats: {
            totalCards: this.cards.size,
            withPricing: this.stats.withPricing,
            pokemonCards: this.stats.pokemonCards,
            pagesProcessed: this.stats.pagesProcessed,
            errors: this.stats.errors,
          },
          target: 7261,
          coveragePercent: ((this.cards.size / 7261) * 100).toFixed(1) + '%',
        },
        cards: Array.from(this.cards.values()),
      };

      writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(output, null, 2));
      console.log(`\n💾 Saved to: ${CONFIG.OUTPUT_FILE}`);

      // Show sample cards
      const samples = Array.from(this.cards.values()).slice(0, 3);
      console.log('\n📋 Sample Cards:');
      samples.forEach((card, i) => {
        console.log(`\n${i + 1}. ${card.name}`);
        console.log(`   Price: $${card.price || 'N/A'}`);
        console.log(`   Grader: ${card.grader || 'N/A'} ${card.grade || ''}`);
        console.log(`   Status: ${card.listedStatus || 'unknown'}`);
      });

    } catch (error: any) {
      console.error('\n❌ Harvest failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const harvester = new PhygitalsComprehensiveHarvester();
  await harvester.harvest();
}

main().catch(console.error);
