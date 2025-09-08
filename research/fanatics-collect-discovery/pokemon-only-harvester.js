/**
 * Focused Pokemon-Only Fanatics Collect Harvester
 * Uses the exact Pokemon URLs to get active and sold cards with pagination
 */
const { chromium } = require('playwright');
const fs = require('fs').promises;

class PokemonFanaticsHarvester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.allActiveCards = [];
    this.allSoldCards = [];
    this.capturedResponses = [];
    this.seenIds = new Set();
  }

  async initialize() {
    console.log('🎴 Initializing POKEMON-ONLY Fanatics Collect Harvester');
    console.log('======================================================');
    
    this.browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Intercept GraphQL responses for Pokemon cards
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('graphql') || url.includes('api')) {
        try {
          const text = await response.text();
          const data = JSON.parse(text);
          
          // Check for collectListings (active cards)
          if (data.data?.collectListings) {
            console.log(`📊 Active: Captured ${data.data.collectListings.length} cards`);
            this.processActiveCards(data.data.collectListings);
            this.capturedResponses.push({ type: 'active', url, data, timestamp: new Date().toISOString() });
          }
          
          // Check for sales history data
          if (data.data?.salesHistory || data.sales || data.results) {
            const salesData = data.data?.salesHistory || data.sales || data.results || [];
            console.log(`💰 Sold: Captured ${salesData.length} sold cards`);
            this.processSoldCards(salesData);
            this.capturedResponses.push({ type: 'sold', url, data, timestamp: new Date().toISOString() });
          }
          
        } catch (error) {
          // Not JSON, skip
        }
      }
    });

    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
  }

  processActiveCards(cards) {
    let newCards = 0;
    for (const card of cards) {
      const cardId = `active_${card.id}`;
      if (!this.seenIds.has(cardId)) {
        this.seenIds.add(cardId);
        this.allActiveCards.push({
          ...card,
          type: 'active',
          capturedAt: new Date().toISOString()
        });
        newCards++;
      }
    }
    if (newCards > 0) {
      console.log(`   ✅ Added ${newCards} new active cards (Total Active: ${this.allActiveCards.length})`);
    }
  }

  processSoldCards(cards) {
    let newCards = 0;
    for (const card of cards) {
      const cardId = `sold_${card.id || card.listingId || card.saleId}`;
      if (!this.seenIds.has(cardId)) {
        this.seenIds.add(cardId);
        this.allSoldCards.push({
          ...card,
          type: 'sold',
          capturedAt: new Date().toISOString()
        });
        newCards++;
      }
    }
    if (newCards > 0) {
      console.log(`   ✅ Added ${newCards} new sold cards (Total Sold: ${this.allSoldCards.length})`);
    }
  }

  async harvestActivePokemon() {
    console.log('\n🟢 HARVESTING ACTIVE POKEMON CARDS');
    console.log('==================================');
    
    const baseActiveUrl = 'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY&sortBy=prod_item_state_v1_price_desc';
    
    let page = 1;
    let hasMorePages = true;
    const maxPages = 50; // Safety limit
    
    while (hasMorePages && page <= maxPages) {
      try {
        const pageUrl = `${baseActiveUrl}&page=${page}`;
        console.log(`📄 Active Page ${page}: Loading...`);
        
        await this.page.goto(pageUrl, { 
          waitUntil: 'networkidle', 
          timeout: 30000 
        });
        
        // Wait for content to load
        await this.wait(3000);
        
        // Scroll to trigger any lazy loading
        await this.scrollToLoadContent();
        
        // Check if page has Pokemon card content
        const hasContent = await this.page.evaluate(() => {
          // Look for card elements
          const cards = document.querySelectorAll('[data-testid*="listing"], .listing-card, .card-item, .auction-item');
          return cards.length > 0;
        });
        
        if (!hasContent) {
          console.log(`📄 No content on page ${page}, stopping active harvest`);
          hasMorePages = false;
        } else {
          console.log(`📄 Page ${page} loaded successfully`);
          page++;
          await this.wait(2000); // Be respectful
        }
        
      } catch (error) {
        console.log(`❌ Error on active page ${page}: ${error.message}`);
        hasMorePages = false;
      }
    }
    
    console.log(`✅ Active harvest complete: ${this.allActiveCards.length} cards`);
  }

  async harvestSoldPokemon() {
    console.log('\n🔴 HARVESTING SOLD POKEMON CARDS');
    console.log('================================');
    
    const baseSoldUrl = 'https://sales-history.fanaticscollect.com/?category=Pok%C3%A9mon&sort=purchasePrice%2Cdesc';
    
    let page = 1;
    let hasMorePages = true;
    const maxPages = 50; // Safety limit
    
    while (hasMorePages && page <= maxPages) {
      try {
        const pageUrl = page === 1 ? baseSoldUrl : `${baseSoldUrl}&page=${page}`;
        console.log(`📄 Sold Page ${page}: Loading...`);
        
        await this.page.goto(pageUrl, { 
          waitUntil: 'networkidle', 
          timeout: 30000 
        });
        
        // Wait for content to load
        await this.wait(3000);
        
        // Scroll to trigger any lazy loading
        await this.scrollToLoadContent();
        
        // Check if page has sold Pokemon content
        const hasContent = await this.page.evaluate(() => {
          // Look for sales history elements
          const sales = document.querySelectorAll('[data-testid*="sale"], .sale-item, .sold-card, .history-item');
          return sales.length > 0 || document.body.innerText.includes('$');
        });
        
        if (!hasContent) {
          console.log(`📄 No content on sold page ${page}, stopping sold harvest`);
          hasMorePages = false;
        } else {
          console.log(`📄 Sold page ${page} loaded successfully`);
          page++;
          await this.wait(2000); // Be respectful
        }
        
      } catch (error) {
        console.log(`❌ Error on sold page ${page}: ${error.message}`);
        hasMorePages = false;
      }
    }
    
    console.log(`✅ Sold harvest complete: ${this.allSoldCards.length} cards`);
  }

  async scrollToLoadContent() {
    // Gentle scrolling to trigger content loading
    for (let i = 0; i < 5; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 800));
      await this.wait(1000);
    }
    
    // Scroll back to top
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.wait(1000);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateResults() {
    console.log('\n📊 GENERATING POKEMON HARVEST RESULTS');
    console.log('=====================================');
    
    // Calculate active card values
    const activeValues = this.allActiveCards
      .filter(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents)
      .map(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0);
    
    const totalActiveValue = activeValues.reduce((sum, val) => sum + val, 0) / 100;
    const avgActivePrice = activeValues.length > 0 ? totalActiveValue / activeValues.length : 0;
    
    // Calculate sold card values
    const soldValues = this.allSoldCards
      .filter(card => card.purchasePrice || card.soldPrice || card.finalPrice)
      .map(card => {
        const price = card.purchasePrice || card.soldPrice || card.finalPrice;
        return typeof price === 'number' ? price : (price?.amountInCents || 0);
      });
    
    const totalSoldValue = soldValues.reduce((sum, val) => sum + val, 0) / 100;
    const avgSoldPrice = soldValues.length > 0 ? totalSoldValue / soldValues.length : 0;
    
    const results = {
      metadata: {
        harvestedAt: new Date().toISOString(),
        totalCards: this.allActiveCards.length + this.allSoldCards.length,
        activeCards: this.allActiveCards.length,
        soldCards: this.allSoldCards.length,
        totalActiveValue: totalActiveValue,
        totalSoldValue: totalSoldValue,
        avgActivePrice: avgActivePrice,
        avgSoldPrice: avgSoldPrice,
        capturedResponses: this.capturedResponses.length
      },
      activeCards: this.allActiveCards,
      soldCards: this.allSoldCards,
      rawResponses: this.capturedResponses
    };
    
    console.log(`🎴 Total Pokemon Cards: ${results.metadata.totalCards}`);
    console.log(`🟢 Active Listings: ${results.metadata.activeCards} ($${results.metadata.totalActiveValue.toLocaleString()})`);
    console.log(`🔴 Sold Cards: ${results.metadata.soldCards} ($${results.metadata.totalSoldValue.toLocaleString()})`);
    console.log(`📊 Average Active Price: $${results.metadata.avgActivePrice.toFixed(2)}`);
    console.log(`📊 Average Sold Price: $${results.metadata.avgSoldPrice.toFixed(2)}`);
    console.log(`📡 API Responses Captured: ${results.metadata.capturedResponses}`);
    
    // Save results
    const timestamp = Date.now();
    const outputPath = `pokemon-fanatics-complete-harvest-${timestamp}.json`;
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Complete Pokemon harvest saved to: ${outputPath}`);
    
    // Show top items
    if (this.allActiveCards.length > 0) {
      console.log('\n💎 Top 5 Most Expensive Active Pokemon:');
      const topActive = this.allActiveCards
        .filter(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents)
        .sort((a, b) => {
          const aPrice = a.currentBid?.amountInCents || a.startingPrice?.amountInCents || 0;
          const bPrice = b.currentBid?.amountInCents || b.startingPrice?.amountInCents || 0;
          return bPrice - aPrice;
        })
        .slice(0, 5);
      
      topActive.forEach((card, index) => {
        const price = (card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0) / 100;
        console.log(`   ${index + 1}. $${price.toLocaleString()} - ${card.title}`);
      });
    }
    
    if (this.allSoldCards.length > 0) {
      console.log('\n🔥 Top 5 Highest Sold Pokemon:');
      const topSold = this.allSoldCards
        .filter(card => card.purchasePrice || card.soldPrice || card.finalPrice)
        .sort((a, b) => {
          const getPrice = (card) => {
            const price = card.purchasePrice || card.soldPrice || card.finalPrice;
            return typeof price === 'number' ? price : (price?.amountInCents || 0);
          };
          return getPrice(b) - getPrice(a);
        })
        .slice(0, 5);
      
      topSold.forEach((card, index) => {
        const priceData = card.purchasePrice || card.soldPrice || card.finalPrice;
        const price = typeof priceData === 'number' ? priceData : (priceData?.amountInCents || 0);
        console.log(`   ${index + 1}. $${(price / 100).toLocaleString()} - ${card.title || card.name}`);
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
  const harvester = new PokemonFanaticsHarvester();
  
  try {
    console.log('🎯 POKEMON-ONLY FANATICS COLLECT HARVEST');
    console.log('=========================================');
    console.log('🎴 Target: ONLY Pokemon cards (active + sold)');
    console.log('🔗 Using exact Pokemon URLs provided');
    console.log('');
    
    await harvester.initialize();
    
    // Harvest active Pokemon cards
    await harvester.harvestActivePokemon();
    
    // Harvest sold Pokemon cards
    await harvester.harvestSoldPokemon();
    
    // Generate comprehensive results
    const results = await harvester.generateResults();
    
    console.log('\n✅ POKEMON HARVEST COMPLETED SUCCESSFULLY!');
    console.log(`🎴 Total Pokemon cards: ${results.metadata.totalCards}`);
    console.log(`🟢 Active: ${results.metadata.activeCards}`);
    console.log(`🔴 Sold: ${results.metadata.soldCards}`);
    console.log(`💰 Ready for PokeDAO integration!`);
    
  } catch (error) {
    console.error('💥 Pokemon harvest failed:', error);
  } finally {
    await harvester.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PokemonFanaticsHarvester };
