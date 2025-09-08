/**
 * Focused Pokemon-Only Fanatics Collect Harvester
 * Uses the exact successful pathways and focuses ONLY on Pokemon cards
 */
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class PokemonFanaticsHarvester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.pokemonCards = [];
    this.capturedResponses = [];
    this.seenIds = new Set();
  }

  async initialize() {
    console.log('🎴 Initializing Pokemon-Only Fanatics Collect Harvester');
    console.log('======================================================');
    
    this.browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Intercept ONLY Pokemon-related GraphQL responses
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('graphql') && url.includes('collectListings')) {
        try {
          const data = await response.json();
          if (data.data?.collectListings) {
            // Filter for Pokemon cards only
            const pokemonCards = data.data.collectListings.filter(card => 
              this.isPokemonCard(card)
            );
            
            if (pokemonCards.length > 0) {
              console.log(`🎴 Captured ${pokemonCards.length} Pokemon cards from GraphQL`);
              this.capturedResponses.push({
                url,
                data: { data: { collectListings: pokemonCards } },
                timestamp: new Date().toISOString()
              });
              this.processPokemonCards(pokemonCards);
            }
          }
        } catch (error) {
          console.log('❌ Error processing GraphQL response:', error);
        }
      }
    });

    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
  }

  isPokemonCard(card) {
    const title = (card.title || '').toLowerCase();
    const subtitle = (card.subtitle || '').toLowerCase();
    const combined = title + ' ' + subtitle;
    
    // Pokemon-specific keywords
    const pokemonKeywords = [
      'pokemon', 'pokémon', 'pikachu', 'charizard', 'blastoise', 'venusaur',
      'base set', 'team rocket', 'jungle', 'fossil', 'neo', 'gym',
      'e-card', 'ex', 'dp', 'platinum', 'hgss', 'bw', 'xy', 'sm', 'swsh',
      'psa', 'bgs', 'cgc', 'trading card game', 'tcg'
    ];
    
    return pokemonKeywords.some(keyword => combined.includes(keyword));
  }

  processPokemonCards(cards) {
    let newCards = 0;
    for (const card of cards) {
      if (!this.seenIds.has(card.id)) {
        this.seenIds.add(card.id);
        this.pokemonCards.push(card);
        newCards++;
      }
    }
    if (newCards > 0) {
      console.log(`   ✅ Added ${newCards} new Pokemon cards (Total: ${this.pokemonCards.length})`);
    }
  }

  async harvestPokemonCards() {
    console.log('🎴 Starting focused Pokemon card harvest...');
    
    // Use the exact URLs that worked before + Pokemon-specific filters
    const pokemonUrls = [
      // Direct Pokemon category URLs
      'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
      'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese)',
      'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)',
      
      'https://www.fanaticscollect.com/buy-now?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
      'https://www.fanaticscollect.com/buy-now?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese)',
      'https://www.fanaticscollect.com/buy-now?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)',
      
      // Pokemon search terms
      'https://www.fanaticscollect.com/search?q=pokemon',
      'https://www.fanaticscollect.com/search?q=charizard',
      'https://www.fanaticscollect.com/search?q=pikachu',
      'https://www.fanaticscollect.com/search?q=base+set',
      'https://www.fanaticscollect.com/search?q=PSA+pokemon',
      'https://www.fanaticscollect.com/search?q=BGS+pokemon'
    ];

    for (const url of pokemonUrls) {
      console.log(`\n🌐 Harvesting: ${url}`);
      await this.harvestPokemonSection(url);
    }

    // Systematic pagination through Pokemon categories
    await this.paginatePokemonSections();
  }

  async harvestPokemonSection(url) {
    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded', // Faster than networkidle
        timeout: 15000 // Shorter timeout
      });
      
      await this.wait(2000);
      
      // Quick scroll to trigger GraphQL
      await this.quickScroll();
      
      await this.wait(2000);
      
    } catch (error) {
      console.log(`   ⚠️  Timeout/error on ${url} - continuing...`);
    }
  }

  async quickScroll() {
    // Quick scroll to trigger lazy loading
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 1000));
      await this.wait(500);
    }
  }

  async paginatePokemonSections() {
    console.log('\n📄 Systematic pagination through Pokemon sections...');
    
    const baseSections = [
      'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)',
      'https://www.fanaticscollect.com/buy-now?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)'
    ];

    for (const baseUrl of baseSections) {
      console.log(`\n📑 Paginating: ${baseUrl}`);
      
      let page = 1;
      let maxPages = 50; // Reasonable limit
      
      while (page <= maxPages) {
        try {
          const pageUrl = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;
          console.log(`   📄 Page ${page}...`);
          
          await this.page.goto(pageUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
          });
          
          await this.wait(1500);
          await this.quickScroll();
          
          // Check if page has Pokemon content
          const hasContent = await this.page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('pokemon') || text.includes('pokémon') || 
                   text.includes('charizard') || text.includes('pikachu');
          });
          
          if (!hasContent) {
            console.log(`   📄 No Pokemon content on page ${page}, stopping this section`);
            break;
          }
          
          page++;
          await this.wait(1000);
          
        } catch (error) {
          console.log(`   ⚠️  Error on page ${page}, continuing...`);
          page++;
        }
      }
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateResults() {
    console.log('\n🎴 POKEMON HARVEST COMPLETE - GENERATING RESULTS');
    console.log('===============================================');
    
    // Analyze Pokemon data
    const activeCards = this.pokemonCards.filter(card => 
      card.status === 'ACTIVE' || card.status === 'LIVE'
    );
    
    const soldCards = this.pokemonCards.filter(card => 
      card.status === 'COMPLETED' || 
      card.status === 'SOLD' ||
      card.collectSales.length > 0
    );
    
    const cardsWithSales = this.pokemonCards.filter(card => 
      card.collectSales.length > 0
    );
    
    // Calculate values
    const totalValue = this.pokemonCards
      .filter(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents)
      .reduce((sum, card) => sum + (card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0), 0) / 100;
    
    const salesValue = this.pokemonCards
      .flatMap(card => card.collectSales)
      .reduce((sum, sale) => sum + sale.soldPrice.amountInCents, 0) / 100;
    
    const results = {
      metadata: {
        harvestedAt: new Date().toISOString(),
        totalPokemonCards: this.pokemonCards.length,
        activeCards: activeCards.length,
        soldCards: soldCards.length,
        cardsWithSalesHistory: cardsWithSales.length,
        totalCurrentValue: totalValue,
        totalSalesValue: salesValue,
        capturedResponses: this.capturedResponses.length
      },
      pokemonCards: this.pokemonCards,
      rawResponses: this.capturedResponses
    };
    
    console.log(`🎴 Total Pokemon Cards: ${results.metadata.totalPokemonCards}`);
    console.log(`🟢 Active Listings: ${results.metadata.activeCards}`);
    console.log(`🔴 Sold/Completed: ${results.metadata.soldCards}`);
    console.log(`💰 Cards with Sales History: ${results.metadata.cardsWithSalesHistory}`);
    console.log(`💵 Current Market Value: $${results.metadata.totalCurrentValue.toLocaleString()}`);
    console.log(`💸 Historical Sales Value: $${results.metadata.totalSalesValue.toLocaleString()}`);
    
    // Save Pokemon-only results
    const timestamp = Date.now();
    const outputPath = `fanatics-pokemon-only-harvest-${timestamp}.json`;
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Pokemon harvest saved to: ${outputPath}`);
    
    // Show top Pokemon items
    if (this.pokemonCards.length > 0) {
      console.log('\n💎 Top 5 Most Valuable Pokemon Cards:');
      const topCards = this.pokemonCards
        .filter(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents)
        .sort((a, b) => {
          const aPrice = a.currentBid?.amountInCents || a.startingPrice?.amountInCents || 0;
          const bPrice = b.currentBid?.amountInCents || b.startingPrice?.amountInCents || 0;
          return bPrice - aPrice;
        })
        .slice(0, 5);
      
      topCards.forEach((card, index) => {
        const price = (card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0) / 100;
        console.log(`   ${index + 1}. $${price.toLocaleString()} - ${card.title}`);
      });
    }
    
    if (cardsWithSales.length > 0) {
      console.log('\n🔥 Recent Pokemon Sales:');
      const recentSales = this.pokemonCards
        .filter(card => card.collectSales.length > 0)
        .flatMap(card => card.collectSales.map(sale => ({
          title: card.title,
          price: sale.soldPrice.amountInCents / 100,
          date: sale.soldAt
        })))
        .sort((a, b) => b.price - a.price)
        .slice(0, 5);
      
      recentSales.forEach((sale, index) => {
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
  const harvester = new PokemonFanaticsHarvester();
  
  try {
    console.log('🎴 FOCUSED POKEMON-ONLY FANATICS COLLECT HARVEST');
    console.log('===============================================');
    console.log('🎯 Target: Pokemon cards ONLY (filtered)');
    console.log('⚡ Method: Fast pagination + Pokemon filtering');
    console.log('');
    
    await harvester.initialize();
    await harvester.harvestPokemonCards();
    const results = await harvester.generateResults();
    
    console.log('\n✅ POKEMON HARVEST COMPLETED!');
    console.log(`🎴 Total Pokemon cards: ${results.metadata.totalPokemonCards}`);
    console.log(`💰 Including ${results.metadata.cardsWithSalesHistory} with sold price data`);
    
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
