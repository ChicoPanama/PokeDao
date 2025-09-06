import fs from "fs"

function analyzeCompleteDataset() {
  try {
    console.log("Loading complete dataset...")
    const rawData = fs.readFileSync("complete-dataset.json", "utf8")
  const allCards: any[] = JSON.parse(rawData)
    
    console.log(`Total cards in dataset: ${allCards.length}`)
    
    // Filter for cards with realistic prices
    const cardsWithPrices = allCards.filter((card: any) => {
      const listing = card.listing || {}
      const price = listing.price || 0
      return price > 0
    })
    
    console.log(`Cards with prices: ${cardsWithPrices.length}`)
    
    // Focus on Pokemon cards with reasonable pricing
    const investmentCandidates = cardsWithPrices.filter((card: any) => {
      const listing = card.listing || {}
      const price = listing.price || 0
      const currency = listing.currency || "USDC"
      const priceUSD = currency === "SOL" ? price * 140 : price
      
      return (
        card.category === "Pokemon" &&
        priceUSD >= 15 &&
        priceUSD <= 50000 &&
        card.itemName &&
        !card.itemName.toLowerCase().includes("energy removal")
      )
    })
    
    console.log(`Pokemon investment candidates: ${investmentCandidates.length}`)
    
    // Price distribution
    const prices = investmentCandidates.map((card: any) => {
      const listing = card.listing || {}
      const price = listing.price || 0
      const currency = listing.currency || "USDC"
      return currency === "SOL" ? price * 140 : price
    }).sort((a: number, b: number) => a - b)
    
    console.log("\nPrice Distribution:")
    console.log(`Min: $${prices[0]?.toFixed(2)}`)
    console.log(`Median: $${prices[Math.floor(prices.length * 0.5)]?.toFixed(2)}`)
    console.log(`75th percentile: $${prices[Math.floor(prices.length * 0.75)]?.toFixed(2)}`)
    console.log(`Max: $${prices[prices.length - 1]?.toFixed(2)}`)
    
    // Investment tiers
    const tiers = {
      "Budget ($15-$100)": prices.filter((p: number) => p >= 15 && p < 100).length,
      "Entry ($100-$300)": prices.filter((p: number) => p >= 100 && p < 300).length,
      "Mid ($300-$1000)": prices.filter((p: number) => p >= 300 && p < 1000).length,
      "High ($1000-$5000)": prices.filter((p: number) => p >= 1000 && p < 5000).length,
      "Premium ($5000+)": prices.filter((p: number) => p >= 5000).length
    }
    
    console.log("\nInvestment Opportunity Tiers:")
    Object.entries(tiers).forEach(([tier, count]) => {
      console.log(`  ${tier}: ${count}`)
    })
    
    return investmentCandidates
    
  } catch (error) {
    console.error("Error reading dataset:", error)
    return []
  }
}

analyzeCompleteDataset()
