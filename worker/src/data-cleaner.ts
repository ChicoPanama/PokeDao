import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

interface CleanCard {
  id: string
  name: string
  year: number
  grade: string
  gradingCompany: string
  price: number
  currency: string
  priceUSD: number
  category: string
  nftAddress: string
  url: string
}

class DataCleaner {
  
  cleanDataset(rawCards: any[]): CleanCard[] {
    console.log("Cleaning dataset...")
    console.log(`Starting with ${rawCards.length} total cards`)
    
    // Step 1: Filter cards with valid prices
    const cardsWithPrices = rawCards.filter(card => {
      const listing = card.listing || {}
      const price = listing.price || 0
      return price > 0
    })
    
    console.log(`Cards with prices: ${cardsWithPrices.length}`)
    
    // Step 2: Remove obvious meme/joke pricing
    const realisticCards = cardsWithPrices.filter(card => {
      const listing = card.listing || {}
      const price = listing.price || 0
      const currency = listing.currency || "USDC"
      const priceUSD = currency === "SOL" ? price * 140 : price
      
      // Filter criteria for realistic investment cards
      return (
        priceUSD >= 10 &&           // Minimum $10
        priceUSD <= 50000 &&        // Maximum $50K (filters meme pricing)
        card.category === "Pokemon" && // Focus on Pokemon for now
        card.grade &&              // Must have grade
        card.gradingCompany         // Must be graded
      )
    })
    
    console.log(`Realistic Pokemon cards: ${realisticCards.length}`)
    
    // Step 3: Process into clean format
    const cleanCards = realisticCards.map(card => {
      const listing = card.listing || {}
      const price = listing.price || 0
      const currency = listing.currency || "USDC"
      
      return {
        id: card.id,
        name: card.itemName || "Unknown Card",
        year: card.year || 2000,
        grade: card.grade,
        gradingCompany: card.gradingCompany,
        price: price,
        currency: currency,
        priceUSD: currency === "SOL" ? price * 140 : price,
        category: card.category,
        nftAddress: card.nftAddress,
        url: `https://collectorcrypt.com/assets/solana/${card.nftAddress}`
      }
    })
    
    return cleanCards.sort((a, b) => b.priceUSD - a.priceUSD)
  }
  
  analyzeCleanData(cards: CleanCard[]) {
    console.log("\n=== CLEAN DATASET ANALYSIS ===")
    
    // Price analysis
    const prices = cards.map(c => c.priceUSD)
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
    const medianPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    const maxPrice = Math.max(...prices)
    const minPrice = Math.min(...prices)
    
    console.log(`Total Clean Cards: ${cards.length}`)
    console.log(`Average Price: $${avgPrice.toFixed(2)}`)
    console.log(`Median Price: $${medianPrice.toFixed(2)}`)
    console.log(`Price Range: $${minPrice} - $${maxPrice}`)
    
    // Grade distribution
    const grades = cards.reduce((acc, card) => {
      const grade = card.grade || "Unknown"
      acc[grade] = (acc[grade] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log("\nGrade Distribution:")
    Object.entries(grades)
      .sort(([,a], [,b]) => b - a)
      .forEach(([grade, count]) => {
        console.log(`  ${grade}: ${count}`)
      })
    
    // Grading company distribution
    const companies = cards.reduce((acc, card) => {
      const company = card.gradingCompany || "Unknown"
      acc[company] = (acc[company] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log("\nGrading Company Distribution:")
    Object.entries(companies)
      .sort(([,a], [,b]) => b - a)
      .forEach(([company, count]) => {
        console.log(`  ${company}: ${count}`)
      })
    
    // Price tiers for investment targeting
    const tiers = {
      "Budget ($10-$50)": cards.filter(c => c.priceUSD >= 10 && c.priceUSD < 50).length,
      "Entry ($50-$200)": cards.filter(c => c.priceUSD >= 50 && c.priceUSD < 200).length,
      "Mid-tier ($200-$500)": cards.filter(c => c.priceUSD >= 200 && c.priceUSD < 500).length,
      "High-end ($500-$2K)": cards.filter(c => c.priceUSD >= 500 && c.priceUSD < 2000).length,
      "Premium ($2K+)": cards.filter(c => c.priceUSD >= 2000).length
    }
    
    console.log("\nInvestment Tiers:")
    Object.entries(tiers).forEach(([tier, count]) => {
      console.log(`  ${tier}: ${count}`)
    })
    
    // Top 20 investment candidates
    console.log("\nTop 20 Investment Candidates:")
    cards.slice(0, 20).forEach((card, i) => {
      console.log(`${i + 1}. $${card.priceUSD.toFixed(0)} - ${card.name.substring(0, 70)}`)
    })
    
    return cards
  }
}

// Load the data (assuming we have it from previous scraping)
async function loadAndCleanData() {
  try {
    // If you saved the raw data, load it here
    // For now, lets run a quick API call to get current data
    const response = await axios.get("https://api.collectorcrypt.com/marketplace", {
      params: { page: 1, step: 96, cardType: "Card", orderBy: "listedPriceDesc" },
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
    })
    
    const rawCards = response.data.filterNFtCard || []
    
    const cleaner = new DataCleaner()
    const cleanCards = cleaner.cleanDataset(rawCards)
    const analysis = cleaner.analyzeCleanData(cleanCards)
    
    return cleanCards
    
  } catch (error) {
    console.error("Error loading data:", error)
    return []
  }
}

console.log("PokeDAO Data Cleaner starting...")
loadAndCleanData()
