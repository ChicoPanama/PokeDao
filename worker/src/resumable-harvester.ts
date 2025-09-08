import axios from 'axios'
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

interface CollectorCryptCard {
  nftAddress: string
  itemName: string
  listing?: {
    price: number
    currency: string
  }
  createdAt: string
  updatedAt: string
  status: string
}

interface HarvestState {
  lastPage: number
  totalProcessed: number
  lastUpdate: string
  existingIds: string[]
}

export class ResumableCollectorCryptHarvester {
  private baseURL = 'https://api.collectorcrypt.com/marketplace'
  private batchSize = 100
  private delayMs = 500
  private maxRetries = 3
  
  private stateFile = join(process.cwd(), 'harvest-state.json')
  private batchDir = join(process.cwd(), 'harvest-batches')

  constructor() {
    if (!existsSync(this.batchDir)) {
      mkdirSync(this.batchDir, { recursive: true })
    }
  }

  private loadState(): HarvestState {
    if (existsSync(this.stateFile)) {
      return JSON.parse(readFileSync(this.stateFile, 'utf8'))
    }
    return {
      lastPage: 0,
      totalProcessed: 0,
      lastUpdate: new Date().toISOString(),
      existingIds: []
    }
  }

  private saveState(state: HarvestState): void {
    writeFileSync(this.stateFile, JSON.stringify(state, null, 2))
  }

  private loadExistingData(): Set<string> {
    const existingIds = new Set<string>()
    
    // Load from complete-dataset.json
    const completeDataFile = join(process.cwd(), 'complete-dataset.json')
    if (existsSync(completeDataFile)) {
      try {
        const data = JSON.parse(readFileSync(completeDataFile, 'utf8'))
        data.forEach((card: any) => {
          if (card.nftAddress) existingIds.add(card.nftAddress)
        })
        console.log(`📦 Loaded ${existingIds.size} existing cards from complete-dataset.json`)
      } catch (error) {
        console.warn('⚠️ Error loading complete-dataset.json:', error)
      }
    }

    // Load from previous batches
    if (existsSync(this.batchDir)) {
      const batchFiles = readdirSync(this.batchDir).filter(f => f.endsWith('.json'))
      for (const batchFile of batchFiles) {
        try {
          const batchData = JSON.parse(readFileSync(join(this.batchDir, batchFile), 'utf8'))
          batchData.forEach((card: any) => {
            if (card.nftAddress) existingIds.add(card.nftAddress)
          })
        } catch (error) {
          console.warn(`⚠️ Error loading batch ${batchFile}:`, error)
        }
      }
    }

    return existingIds
  }

  private async fetchPage(page: number): Promise<CollectorCryptCard[]> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Fetching page ${page} (attempt ${attempt})...`)
        
        const response = await axios.get(this.baseURL, {
          params: {
            page,
            step: this.batchSize,
            cardType: 'Card',
            orderBy: 'listedDateDesc'
          },
          headers: {
            'User-Agent': 'PokeDAO/1.0.0'
          },
          timeout: 10000
        })

        return response.data.filterNFtCard || []
      } catch (error: any) {
        console.warn(`⚠️ Page ${page} attempt ${attempt} failed:`, error.message)
        if (attempt === this.maxRetries) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
    return []
  }

  private saveBatch(batchNumber: number, cards: CollectorCryptCard[]): void {
    const batchFile = join(this.batchDir, `batch-${batchNumber.toString().padStart(4, '0')}.json`)
    writeFileSync(batchFile, JSON.stringify(cards, null, 2))
    console.log(`💾 Saved batch ${batchNumber} (${cards.length} cards)`)
  }

  public async harvest(): Promise<void> {
    console.log('🚀 Starting Resumable Collector Crypt Harvester...')
    
    const state = this.loadState()
    const existingIds = this.loadExistingData()
    
    console.log(`📊 Resuming from page ${state.lastPage + 1}`)
    console.log(`📊 Already have ${existingIds.size} unique cards`)

    let currentPage = state.lastPage + 1
    let newCardsFound = 0
    let duplicatesSkipped = 0
    let batchNumber = Math.floor(state.totalProcessed / this.batchSize) + 1
    let consecutiveEmptyPages = 0

    try {
      while (consecutiveEmptyPages < 5) {
        const cards = await this.fetchPage(currentPage)
        
        if (cards.length === 0) {
          consecutiveEmptyPages++
          console.log(`📭 Empty page ${currentPage} (${consecutiveEmptyPages}/5)`)
          currentPage++
          continue
        }

        // Filter duplicates
        const newCards = cards.filter(card => {
          if (existingIds.has(card.nftAddress)) {
            duplicatesSkipped++
            return false
          }
          existingIds.add(card.nftAddress)
          return true
        })

        if (newCards.length > 0) {
          this.saveBatch(batchNumber, newCards)
          newCardsFound += newCards.length
          batchNumber++
          consecutiveEmptyPages = 0 // Reset counter when we find new cards
        } else {
          consecutiveEmptyPages++
        }

        // Update state
        state.lastPage = currentPage
        state.totalProcessed += cards.length
        state.lastUpdate = new Date().toISOString()
        state.existingIds = Array.from(existingIds)
        this.saveState(state)

        console.log(`📈 Page ${currentPage}: ${newCards.length} new cards (${duplicatesSkipped} duplicates total)`)

        await new Promise(resolve => setTimeout(resolve, this.delayMs))
        currentPage++
      }

      // Consolidate batches
      await this.consolidateBatches()
      
      console.log('🎉 Harvest completed!')
      console.log(`📊 Found ${newCardsFound} new cards`)
      console.log(`📊 Skipped ${duplicatesSkipped} duplicates`)

    } catch (error: any) {
      console.error('❌ Harvest interrupted:', error.message)
      console.log('💾 Progress saved. Run again to resume.')
      throw error
    }
  }

  private async consolidateBatches(): Promise<void> {
    console.log('🔄 Consolidating harvest batches...')
    
    const allNewCards: CollectorCryptCard[] = []
    const batchFiles = readdirSync(this.batchDir)
      .filter(file => file.startsWith('batch-') && file.endsWith('.json'))
      .sort()

    for (const batchFile of batchFiles) {
      const batchData = JSON.parse(readFileSync(join(this.batchDir, batchFile), 'utf8'))
      allNewCards.push(...batchData)
    }

    if (allNewCards.length > 0) {
      const date = new Date().toISOString().split('T')[0]
      const consolidatedFile = join(process.cwd(), `new-harvest-${date}.json`)
      writeFileSync(consolidatedFile, JSON.stringify(allNewCards, null, 2))
      console.log(`💾 Saved ${allNewCards.length} new cards to ${consolidatedFile}`)
    }
  }

  public reset(): void {
    if (existsSync(this.stateFile)) unlinkSync(this.stateFile)
    if (existsSync(this.batchDir)) {
      const files = readdirSync(this.batchDir)
      files.forEach(file => unlinkSync(join(this.batchDir, file)))
    }
    console.log('🗑️ Harvest state reset!')
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const harvester = new ResumableCollectorCryptHarvester()
  
  if (process.argv[2] === 'reset') {
    harvester.reset()
  } else {
    harvester.harvest()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  }
}
