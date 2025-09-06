import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

class CollectorCryptAPI {
  private baseURL = "https://api.collectorcrypt.com/marketplace"
  
  async fetchAllCards() {
    try {
      console.log("Fetching COMPLETE Collector Crypt dataset via API...")
      console.log("This will take 30-45 minutes with rate limiting...")
      
      let allCards = []
      let page = 1
      let totalPages = 179 // Will update from API response
      
      while (page <= totalPages) {
        console.log(`Fetching page ${page}/${totalPages}...`)
        
        const response = await axios.get(this.baseURL, {
          params: {
            page: page,
            step: 96,
            cardType: "Card", 
            orderBy: "listedDateDesc"
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
          }
        })
        
        // Update total pages from API response
        if (page === 1) {
          totalPages = response.data.totalPages || 179
          console.log(`API reports ${response.data.findTotal} total cards across ${totalPages} pages`)
        }
        
        const pageCards = response.data.filterNFtCard || []
        
        if (pageCards.length === 0) {
          console.log("No more cards, stopping...")
          break
        }
        
        allCards = allCards.concat(pageCards)
        
        // Progress reporting every 10 pages
        if (page % 10 === 0 || page === totalPages) {
          const progress = ((page / totalPages) * 100).toFixed(1)
          console.log(`Page ${page}/${totalPages} (${progress}%): ${pageCards.length} cards (Total: ${allCards.length})`)
        }
        
        // Rate limiting - be respectful
        await new Promise(resolve => setTimeout(resolve, 200))
        
        page++
      }
      
      console.log(`Complete! Collected ${allCards.length} total cards`)
      return this.processCards(allCards)
      
    } catch (error) {
      console.error("API Error:", error.response?.status, error.message)
      return []
    }
  }
  
  private processCards(cards: any[]) {
    return cards.map(card => {
      const listing = card.listing || {}
      const price = listing.price || 0
      const currency = listing.currency || "USDC"
      
      return {
        id: card.id,
        name: card.itemName || "Unknown Card",
        year: card.year,
        grade: card.grade,
        gradingCompany: card.gradingCompany,
        price: price,
        currency: currency,
        priceUSD: this.convertToUSD(price, currency),
        nftAddress: card.nftAddress,
        blockchain: card.blockchain,
        category: card.category,
        vault: card.vault,
        owner: card.owner?.name || "Unknown",
        ownerWallet: card.owner?.wallet,
        seller: card.owner?.name,
        url: `https://collectorcrypt.com/assets/solana/${card.nftAddress}`,
        images: card.images,
        scrapedAt: new Date().toISOString()
      }
    })
  }
  
  private convertToUSD(price: number, currency: string): number {
    if (currency === "SOL") {
      return price * 140 // Rough SOL price
    }
    return price // USDC ≈ USD
  }
}

async function main() {
  const api = new CollectorCryptAPI()
  const cards = await api.fetchAllCards()
  
  // Comprehensive analysis
  const validPrices = cards.filter(c => c.priceUSD > 0)
  const avgPrice = validPrices.reduce((sum, c) => sum + c.priceUSD, 0) / validPrices.length
  const maxPrice = Math.max(...validPrices.map(c => c.priceUSD))
  const minPrice = Math.min(...validPrices.map(c => c.priceUSD))
  
  console.log("\n=== COMPLETE COLLECTOR CRYPT DATASET ===")
  console.log(`Total Cards: ${cards.length}`)
  console.log(`Cards with Prices: ${validPrices.length}`)
  console.log(`Average Price: $${avgPrice.toFixed(2)}`)
  console.log(`Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`)
  
  // Top 20 highest value cards
  const highValue = cards
    .filter(c => c.priceUSD > 1000)
    .sort((a, b) => b.priceUSD - a.priceUSD)
    .slice(0, 20)
  
  console.log(`\nTop 20 Highest Value Cards (${highValue.length} cards over $1000):`)
  highValue.forEach((card, i) => {
    console.log(`${i + 1}. $${card.priceUSD.toFixed(0)} - ${card.name.substring(0, 80)}`)
  })
  
  // Category breakdown
  const categories = cards.reduce((acc, card) => {
    acc[card.category] = (acc[card.category] || 0) + 1
    return acc
  }, {})
  
  console.log("\nCategory Breakdown:")
  Object.entries(categories)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`)
    })
  
  // Price tier analysis
  const tiers = {
    "Under $50": cards.filter(c => c.priceUSD > 0 && c.priceUSD < 50).length,
    "$50-$100": cards.filter(c => c.priceUSD >= 50 && c.priceUSD < 100).length,
    "$100-$500": cards.filter(c => c.priceUSD >= 100 && c.priceUSD < 500).length,
    "$500-$1000": cards.filter(c => c.priceUSD >= 500 && c.priceUSD < 1000).length,
    "$1000+": cards.filter(c => c.priceUSD >= 1000).length
  }
  
  console.log("\nPrice Tier Distribution:")
  Object.entries(tiers).forEach(([tier, count]) => {
    console.log(`  ${tier}: ${count}`)
  })
  
  return cards
}

console.log("PokeDAO Complete Dataset Collector starting...")
main()
