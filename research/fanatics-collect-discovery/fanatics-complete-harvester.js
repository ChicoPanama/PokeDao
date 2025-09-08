/**
 * Fanatics Collect Complete Harvester
 * Based on successful GraphQL captures - will harvest ALL Pokemon cards including sold data
 */
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class FanaticsCollectHarvester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.allCards = [];
    this.capturedResponses = [];
    this.seenIds = new Set();
  }
  
  async initialize() {
    console.log('🚀 Initializing Fanatics Collect Complete Harvester');
    console.log('==================================================');
    
    this.browser = await chromium.launch({ 
      headless: false, // Keep visible to monitor
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Set up GraphQL response interception (this is what worked before!)
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('graphql') && url.includes('collectListings')) {
        try {
          const data = await response.json();
          if (data.data?.collectListings) {
            console.log(`📊 Captured GraphQL response with ${data.data.collectListings.length} cards`);
            this.capturedResponses.push({
              url,
              data,
              timestamp: new Date().toISOString()
            });
            this.processGraphQLResponse(data.data.collectListings);
          }
        } catch (error) {
          console.log('❌ Error processing GraphQL response:', error);
        }
      }
    });

    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    });
  }

  processGraphQLResponse(cards) {
    let newCards = 0;
    for (const card of cards) {
      if (!this.seenIds.has(card.id)) {
        this.seenIds.add(card.id);
        this.allCards.push(card);
        newCards++;
      }
    }
    if (newCards > 0) {
      console.log(`   ✅ Added ${newCards} new cards (Total: ${this.allCards.length})`);
    }
  }

  async harvestAllPokemonCards() {
    console.log('🎴 Starting comprehensive Pokemon card harvest...');
    
    // Strategy: Visit multiple sections to trigger different GraphQL queries
    const sections = [
      {
        name: 'Weekly Auctions',
        urls: [
          'https://www.fanaticscollect.com/weekly-auction',
          'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games',
          'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
          'https://www.fanaticscollect.com/weekly-auction?sort=ending_soon',
          'https://www.fanaticscollect.com/weekly-auction?sort=highest_bid'
        ]
      },
      {
        name: 'Buy Now',
        urls: [
          'https://www.fanaticscollect.com/buy-now',
          'https://www.fanaticscollect.com/buy-now?category=Trading+Card+Games',
          'https://www.fanaticscollect.com/buy-now?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
          'https://www.fanaticscollect.com/buy-now?sort=price_low_to_high',
          'https://www.fanaticscollect.com/buy-now?sort=price_high_to_low'
        ]
      },
      {
        name: 'Search Pokemon',
        urls: [
          'https://www.fanaticscollect.com/search?q=pokemon',
          'https://www.fanaticscollect.com/search?q=charizard',
          'https://www.fanaticscollect.com/search?q=pikachu',
          'https://www.fanaticscollect.com/search?q=base+set',
          'https://www.fanaticscollect.com/search?q=PSA+10'
        ]
      },
      {
        name: 'Categories',
        urls: [
          'https://www.fanaticscollect.com/category/trading-card-games',
          'https://www.fanaticscollect.com/marketplace',
          'https://www.fanaticscollect.com/all-listings'
        ]
      }
    ];

    for (const section of sections) {
      console.log(`\n📂 Harvesting ${section.name}...`);
      
      for (const url of section.urls) {
        await this.harvestSection(url, section.name);
        await this.wait(2000); // Be respectful
      }
    }

    // Now systematically paginate through the main sections
    await this.paginateThroughAllPages();
  }

  async harvestSection(url, sectionName) {
    try {
      console.log(`🌐 Visiting: ${url}`);
      
      await this.page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      
      // Wait for initial load
      await this.wait(3000);
      
      // Scroll to trigger lazy loading and more GraphQL requests
      await this.triggerLazyLoading();
      
      // Try to load more pages/items if pagination exists
      await this.triggerPagination();
      
    } catch (error) {
      console.log(`   ❌ Error harvesting ${url}: ${error}`);
    }
  }

  async triggerLazyLoading() {
    // Scroll down multiple times to trigger lazy loading
    for (let i = 0; i < 10; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 1000));
      await this.wait(1000);
    }
    
    // Scroll back to top
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.wait(1000);
  }

  async triggerPagination() {
    // Look for pagination controls and click through pages
    const paginationSelectors = [
      'button[aria-label="Next page"]',
      'a[aria-label="Next page"]',
      '.pagination-next',
      '.next-page',
      'button:has-text("Next")',
      'a:has-text("Next")',
      '[data-testid="next-page"]'
    ];

    let currentPage = 1;
    let maxPages = 20; // Reasonable limit per section
    
    while (currentPage < maxPages) {
      let nextButton = null;
      
      // Try to find next button
      for (const selector of paginationSelectors) {
        try {
          nextButton = await this.page.$(selector);
          if (nextButton) {
            const isDisabled = await nextButton.evaluate((el) => 
              el.hasAttribute('disabled') || 
              el.classList.contains('disabled') ||
              el.getAttribute('aria-disabled') === 'true'
            );
            
            if (!isDisabled) break;
            nextButton = null;
          }
        } catch (error) {
          // Continue trying other selectors
        }
      }
      
      if (!nextButton) {
        console.log(`   📄 No more pages found at page ${currentPage}`);
        break;
      }
      
      try {
        console.log(`   📄 Going to page ${currentPage + 1}...`);
        await nextButton.click();
        await this.wait(3000);
        await this.triggerLazyLoading();
        currentPage++;
      } catch (error) {
        console.log(`   ❌ Error clicking to next page: ${error}`);
        break;
      }
    }
  }

  async paginateThroughAllPages() {
    console.log('\n🔄 Systematic pagination through main sections...');
    
    // Main sections to paginate through systematically
    const mainSections = [
      'https://www.fanaticscollect.com/weekly-auction',
      'https://www.fanaticscollect.com/buy-now'
    ];

    for (const baseUrl of mainSections) {
      console.log(`\n📑 Paginating through: ${baseUrl}`);
      
      let page = 1;
      let hasMorePages = true;
      let maxPages = 100; // Reasonable safety limit
      
      while (hasMorePages && page <= maxPages) {
        try {
          const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
          console.log(`   📄 Page ${page}: ${pageUrl}`);
          
          await this.page.goto(pageUrl, { 
            waitUntil: 'networkidle', 
            timeout: 30000 
          });
          
          await this.wait(3000);
          await this.triggerLazyLoading();
          
          // Check if this page has content
          const hasContent = await this.page.evaluate(() => {
            const cards = document.querySelectorAll('[data-testid*="listing"], .listing-card, .card-item');
            return cards.length > 0;
          });
          
          if (!hasContent) {
            console.log(`   📄 No content on page ${page}, stopping pagination`);
            hasMorePages = false;
          } else {
            console.log(`   ✅ Page ${page} loaded successfully`);
            page++;
            await this.wait(2000);
          }
          
        } catch (error) {
          console.log(`   ❌ Error on page ${page}: ${error}`);
          hasMorePages = false;
        }
      }
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateResults() {
    console.log('\n📊 HARVEST COMPLETE - GENERATING RESULTS');
    console.log('=======================================');
    
    // Analyze captured data
    const activeCards = this.allCards.filter(card => 
      card.status === 'ACTIVE' || card.status === 'LIVE'
    );
    
    const soldCards = this.allCards.filter(card => 
      card.status === 'COMPLETED' || 
      card.status === 'SOLD' ||
      card.collectSales.length > 0
    );
    
    const cardsWithSales = this.allCards.filter(card => 
      card.collectSales.length > 0
    );
    
    // Calculate values
    const totalValue = this.allCards
      .filter(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents)
      .reduce((sum, card) => sum + (card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0), 0) / 100;
    
    const salesValue = this.allCards
      .flatMap(card => card.collectSales)
      .reduce((sum, sale) => sum + sale.soldPrice.amountInCents, 0) / 100;
    
    const results = {
      metadata: {
        harvestedAt: new Date().toISOString(),
        totalCards: this.allCards.length,
        activeCards: activeCards.length,
        soldCards: soldCards.length,
        cardsWithSalesHistory: cardsWithSales.length,
        totalCurrentValue: totalValue,
        totalSalesValue: salesValue,
        capturedResponses: this.capturedResponses.length
      },
      cards: this.allCards,
      rawResponses: this.capturedResponses
    };
    
    console.log(`📈 Total Pokemon Cards: ${results.metadata.totalCards}`);
    console.log(`🟢 Active Listings: ${results.metadata.activeCards}`);
    console.log(`🔴 Sold/Completed: ${results.metadata.soldCards}`);
    console.log(`💰 Cards with Sales History: ${results.metadata.cardsWithSalesHistory}`);
    console.log(`💵 Current Market Value: $${results.metadata.totalCurrentValue.toLocaleString()}`);
    console.log(`💸 Historical Sales Value: $${results.metadata.totalSalesValue.toLocaleString()}`);
    console.log(`📊 GraphQL Responses Captured: ${results.metadata.capturedResponses}`);
    
    // Save comprehensive results
    const timestamp = Date.now();
    const outputPath = `fanatics-complete-harvest-${timestamp}.json`;
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Complete harvest saved to: ${outputPath}`);
    
    // Show top items
    if (soldCards.length > 0) {
      console.log('\n🔥 Top 5 Recent Sales:');
      const topSales = this.allCards
        .filter(card => card.collectSales.length > 0)
        .flatMap(card => card.collectSales.map(sale => ({
          title: card.title,
          price: sale.soldPrice.amountInCents / 100,
          date: sale.soldAt
        })))
        .sort((a, b) => b.price - a.price)
        .slice(0, 5);
      
      topSales.forEach((sale, index) => {
        console.log(`   ${index + 1}. $${sale.price.toLocaleString()} - ${sale.title}`);
      });
    }
    
    return results;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const harvester = new FanaticsCollectHarvester();
  
  try {
    console.log('🎯 FANATICS COLLECT COMPLETE POKEMON HARVEST');
    console.log('============================================');
    console.log('🎴 Target: ALL Pokemon cards (active + sold)');
    console.log('📊 Method: GraphQL response interception + pagination');
    console.log('');
    
    await harvester.initialize();
    await harvester.harvestAllPokemonCards();
    const results = await harvester.generateResults();
    
    console.log('\n✅ HARVEST COMPLETED SUCCESSFULLY!');
    console.log(`📊 Total Pokemon cards collected: ${results.metadata.totalCards}`);
    console.log(`💰 Including ${results.metadata.cardsWithSalesHistory} cards with sold price data`);
    
  } catch (error) {
    console.error('💥 Harvest failed:', error);
  } finally {
    await harvester.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FanaticsCollectHarvester };
