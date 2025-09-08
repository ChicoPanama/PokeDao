#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

interface CollectorCryptCard {
  nftAddress: string;
  itemName: string;
  listing?: {
    price: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
  };
  id: string;
  category: string;
  grade?: string;
  gradingCompany?: string;
  year?: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  owner?: {
    id: string;
    wallet: string;
  };
  images?: {
    front: string;
    back?: string;
  };
}

interface HarvestState {
  lastPage: number;
  totalProcessed: number;
  lastCardId: string;
  startTime: string;
  existingCardIds: Set<string>;
  harvestId: string;
}

export class SmartCollectorCryptHarvester {
  private baseURL = 'https://api.collectorcrypt.com/marketplace';
  private cacheDir = './harvest-cache';
  private stateFile = './harvest-state.json';
  private existingDataFile = './complete-dataset.json';
  private outputFile = './collector-crypt-complete-harvest.json';
  private batchSize = 50;
  private maxRetries = 3;
  private delayBetweenRequests = 1000; // 1 second
  
  private allCards: CollectorCryptCard[] = [];
  private existingCardIds = new Set<string>();
  private state: HarvestState;

  constructor() {
    this.state = {
      lastPage: 0,
      totalProcessed: 0,
      lastCardId: '',
      startTime: new Date().toISOString(),
      existingCardIds: new Set(),
      harvestId: `harvest_${Date.now()}`
    };
  }

  async initialize(): Promise<void> {
    // Create cache directory
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    // Load existing cards to avoid duplicates
    await this.loadExistingCards();
    
    // Try to resume from previous state
    await this.loadHarvestState();
    
    console.log(`🚀 Smart Harvester initialized`);
    console.log(`📦 Found ${this.existingCardIds.size} existing cards to skip`);
    console.log(`📍 ${this.state.lastPage > 0 ? `Resuming from page ${this.state.lastPage + 1}` : 'Starting fresh harvest'}`);
  }

  private async loadExistingCards(): Promise<void> {
    try {
      const data = await fs.readFile(this.existingDataFile, 'utf-8');
      const existingCards: CollectorCryptCard[] = JSON.parse(data);
      
      for (const card of existingCards) {
        this.existingCardIds.add(card.nftAddress || card.id);
      }
      
      console.log(`✅ Loaded ${this.existingCardIds.size} existing cards for deduplication`);
    } catch (error) {
      console.log(`ℹ️  No existing dataset found, starting fresh`);
    }
  }

  private async loadHarvestState(): Promise<void> {
    try {
      const stateData = await fs.readFile(this.stateFile, 'utf-8');
      const savedState = JSON.parse(stateData);
      
      // Only resume if less than 1 hour old
      const stateAge = Date.now() - new Date(savedState.startTime).getTime();
      if (stateAge < 3600000) { // 1 hour
        this.state = savedState;
        this.state.existingCardIds = new Set(savedState.existingCardIds);
        console.log(`🔄 Resuming previous harvest from ${savedState.startTime}`);
      } else {
        console.log(`⚠️  Previous harvest state too old, starting fresh`);
      }
    } catch (error) {
      console.log(`ℹ️  No previous state found, starting fresh`);
    }
  }

  private async saveHarvestState(): Promise<void> {
    const stateToSave = {
      ...this.state,
      existingCardIds: Array.from(this.state.existingCardIds)
    };
    
    await fs.writeFile(this.stateFile, JSON.stringify(stateToSave, null, 2));
  }

  private async saveBatch(cards: CollectorCryptCard[], batchNumber: number): Promise<void> {
    const batchFile = path.join(this.cacheDir, `batch_${batchNumber.toString().padStart(4, '0')}.json`);
    await fs.writeFile(batchFile, JSON.stringify(cards, null, 2));
    console.log(`💾 Saved batch ${batchNumber} with ${cards.length} cards`);
  }

  private async fetchPage(page: number, retryCount = 0): Promise<CollectorCryptCard[]> {
    try {
      console.log(`📥 Fetching page ${page}...`);
      
      const response = await axios.get(this.baseURL, {
        params: {
          page,
          step: this.batchSize,
          cardType: 'Card',
          orderBy: 'listedDateDesc'
        },
        headers: {
          'User-Agent': 'PokeDAO-SmartHarvester/1.0.0'
        },
        timeout: 10000 // 10 second timeout
      });

      const cards = response.data.filterNFtCard || [];
      
      if (cards.length === 0) {
        console.log(`📄 Page ${page} returned no cards (end of data)`);
        return [];
      }

      console.log(`✅ Page ${page}: ${cards.length} cards received`);
      return cards;

    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`⚠️  Page ${page} failed (attempt ${retryCount + 1}/${this.maxRetries}), retrying...`);
        await this.delay(2000 * (retryCount + 1)); // Exponential backoff
        return this.fetchPage(page, retryCount + 1);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Page ${page} failed after ${this.maxRetries} attempts:`, errorMessage);
        throw error;
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private filterNewCards(cards: CollectorCryptCard[]): CollectorCryptCard[] {
    const newCards = cards.filter(card => {
      const cardId = card.nftAddress || card.id;
      if (this.existingCardIds.has(cardId)) {
        return false; // Skip duplicate
      }
      
      // Add to our tracking set
      this.existingCardIds.add(cardId);
      this.state.existingCardIds.add(cardId);
      return true;
    });

    if (newCards.length < cards.length) {
      console.log(`🔍 Filtered out ${cards.length - newCards.length} duplicate cards`);
    }

    return newCards;
  }

  async harvestAll(): Promise<void> {
    await this.initialize();
    
    let page = this.state.lastPage + 1;
    let consecutiveEmptyPages = 0;
    let batchNumber = Math.floor(this.state.totalProcessed / this.batchSize) + 1;

    console.log(`\n🎯 Starting harvest from page ${page}...`);

    try {
      while (consecutiveEmptyPages < 3) { // Stop after 3 consecutive empty pages
        try {
          const pageCards = await this.fetchPage(page);
          
          if (pageCards.length === 0) {
            consecutiveEmptyPages++;
            console.log(`📭 Empty page ${page} (${consecutiveEmptyPages}/3 consecutive empty pages)`);
            page++;
            continue;
          }

          consecutiveEmptyPages = 0; // Reset counter
          
          // Filter out duplicates
          const newCards = this.filterNewCards(pageCards);
          
          if (newCards.length > 0) {
            // Add to our collection
            this.allCards.push(...newCards);
            
            // Save batch immediately
            await this.saveBatch(newCards, batchNumber++);
            
            // Update state
            this.state.lastPage = page;
            this.state.totalProcessed += newCards.length;
            this.state.lastCardId = newCards[newCards.length - 1]?.nftAddress || newCards[newCards.length - 1]?.id;
            
            // Save progress
            await this.saveHarvestState();
            
            console.log(`📊 Progress: Page ${page}, ${this.state.totalProcessed} new cards harvested`);
          } else {
            console.log(`⏭️  Page ${page}: All cards were duplicates, skipping`);
          }

          // Rate limiting delay
          await this.delay(this.delayBetweenRequests);
          page++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`💥 Error on page ${page}:`, errorMessage);
          
          // Save current progress before failing
          await this.saveHarvestState();
          
          // Try to continue with next page
          page++;
          
          if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
            console.log(`⏸️  Network issue detected, waiting 5 seconds...`);
            await this.delay(5000);
          }
        }
      }

    } finally {
      // Always save final results
      await this.saveFinalResults();
    }
  }

  private async saveFinalResults(): Promise<void> {
    console.log(`\n💾 Saving final results...`);

    // Merge with existing data if any
    let finalCards = [...this.allCards];
    
    try {
      const existingData = await fs.readFile(this.existingDataFile, 'utf-8');
      const existingCards: CollectorCryptCard[] = JSON.parse(existingData);
      
      // Add existing cards that aren't in our new harvest
      for (const existingCard of existingCards) {
        const cardId = existingCard.nftAddress || existingCard.id;
        if (!this.state.existingCardIds.has(cardId)) {
          finalCards.push(existingCard);
        }
      }
      
      console.log(`🔗 Merged ${existingCards.length} existing cards with ${this.allCards.length} new cards`);
    } catch (error) {
      console.log(`ℹ️  No existing data to merge`);
    }

    // Sort by creation date (newest first)
    finalCards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Save complete dataset
    await fs.writeFile(this.outputFile, JSON.stringify(finalCards, null, 2));
    
    // Also update the main dataset file
    await fs.writeFile(this.existingDataFile, JSON.stringify(finalCards, null, 2));

    // Generate summary
    const summary = {
      harvestId: this.state.harvestId,
      startTime: this.state.startTime,
      endTime: new Date().toISOString(),
      totalCards: finalCards.length,
      newCardsHarvested: this.allCards.length,
      cardsWithListings: finalCards.filter(card => card.listing?.price).length,
      priceRange: this.calculatePriceRange(finalCards),
      lastPage: this.state.lastPage
    };

    await fs.writeFile('./harvest-summary.json', JSON.stringify(summary, null, 2));

    console.log(`\n🎉 Harvest Complete!`);
    console.log(`📈 Total cards: ${finalCards.length}`);
    console.log(`🆕 New cards harvested: ${this.allCards.length}`);
    console.log(`💰 Cards with listings: ${summary.cardsWithListings}`);
    console.log(`💵 Price range: $${summary.priceRange.min} - $${summary.priceRange.max}`);
    console.log(`📄 Final page reached: ${this.state.lastPage}`);

    // Clean up state file
    try {
      await fs.unlink(this.stateFile);
    } catch (error) {
      // State file doesn't exist
    }
  }

  private calculatePriceRange(cards: CollectorCryptCard[]): { min: number; max: number; average: number } {
    const prices = cards
      .map(card => card.listing?.price)
      .filter((price): price is number => typeof price === 'number' && price > 0);

    if (prices.length === 0) {
      return { min: 0, max: 0, average: 0 };
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: prices.reduce((sum, price) => sum + price, 0) / prices.length
    };
  }

  // Method to recover from interrupted harvest by combining batch files
  async recoverFromBatches(): Promise<void> {
    console.log(`🔧 Recovering data from batch files...`);

    try {
      const batchFiles = await fs.readdir(this.cacheDir);
      const jsonBatches = batchFiles.filter(file => file.endsWith('.json')).sort();

      const recoveredCards: CollectorCryptCard[] = [];
      
      for (const batchFile of jsonBatches) {
        try {
          const batchPath = path.join(this.cacheDir, batchFile);
          const batchData = await fs.readFile(batchPath, 'utf-8');
          const batchCards: CollectorCryptCard[] = JSON.parse(batchData);
          
          recoveredCards.push(...batchCards);
          console.log(`✅ Recovered ${batchCards.length} cards from ${batchFile}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed to recover ${batchFile}:`, errorMessage);
        }
      }

      if (recoveredCards.length > 0) {
        this.allCards = recoveredCards;
        await this.saveFinalResults();
        console.log(`🎉 Recovery complete! Restored ${recoveredCards.length} cards`);
      } else {
        console.log(`❌ No cards found in batch files`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`💥 Recovery failed:`, errorMessage);
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const harvester = new SmartCollectorCryptHarvester();
  
  const command = process.argv[2];
  
  if (command === '--recover') {
    harvester.recoverFromBatches();
  } else {
    harvester.harvestAll().catch(error => {
      console.error('❌ Harvest failed:', error);
      process.exit(1);
    });
  }
}
