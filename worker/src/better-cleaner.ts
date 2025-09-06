import axios from "axios"

class BetterDataCleaner {
  
  async getMoreRealisticSample() {
    try {
      console.log("Getting broader sample of realistic cards...")
      
      // Get multiple pages to see better price distribution
      let allCards = []
      
      for (let page = 1; page <= 10; page++) {
        const response = await axios.get("https://api.collectorcrypt.com/marketplace", {
          params: { 
            page: page, 
            step: 96, 
            cardType: "Card", 
            orderBy: "listedPriceAsc" // Start with lowest prices
          },
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
        })
        
        const pageCards = response.data.filterNFtCard || []
        allCards = allCards.concat(pageCards)
        console.log(`Page ${page}: ${pageCards.length} cards`)
      }
      
      console.log(`Total sample: ${allCards.length} cards`)
      
      // More realistic filtering
      const realisticCards = allCards.filter(card => {
        const listing = card.listing || {}
        const price = listing.price || 0
        const currency = listing.currency || "USDC"
        const priceUSD = currency === "SOL" ? price * 140 : price
        
        return (
          price > 0 &&                    // Has a price
          priceUSD >= 15 &&               // Minimum $15 (more realistic)
          priceUSD <= 10000 &&            // Maximum $10K (remove extreme outliers)
          card.category === "Pokemon" &&  // Pokemon only
          card.itemName &&               // Has a name
          !card.itemName.includes("ENERGY REMOVAL") // Remove obvious meme cards
        )
      })
      
      console.log(`Realistic cards: ${realisticCards.length}`)
      
      // Analyze price distribution
      const prices = realisticCards.map(card => {
        const listing = card.listing || {}
        const price = listing.price || 0
        const currency = listing.currency || "USDC"
        return currency === "SOL" ? price * 140 : price
      }).sort((a, b) => a - b)
      
      console.log("\nPrice Distribution:")
      console.log(`Min: $${prices[0]?.toFixed(2)}`)
      console.log(`25th percentile: $${prices[Math.floor(prices.length * 0.25)]?.toFixed(2)}`)
      console.log(`Median: $${prices[Math.floor(prices.length * 0.5)]?.toFixed(2)}`)
      console.log(`75th percentile: $${prices[Math.floor(prices.length * 0.75)]?.toFixed(2)}`)
      console.log(`Max: $${prices[prices.length - 1]?.toFixed(2)}`)
      
      // Better investment tiers
      const tiers = {
        "Budget ($15-$50)": prices.filter(p => p >= 15 && p < 50).length,
        "Entry ($50-$150)": prices.filter(p => p >= 50 && p < 150).length,
        "Mid ($150-$400)": prices.filter(p => p >= 150 && p < 400).length,
        "High ($400-$1000)": prices.filter(p => p >= 400 && p < 1000).length,
        "Premium ($1000+)": prices.filter(p => p >= 1000).length
      }
      
      console.log("\nBetter Investment Tiers:")
      Object.entries(tiers).forEach(([tier, count]) => {
        console.log(`  ${tier}: ${count}`)
      })
      
      // Show sample from each tier
      console.log("\nSample cards from each tier:")
      const budget = realisticCards.filter(c => {
        const listing = c.listing || {}
        const price = listing.price || 0
        const currency = listing.currency || "USDC"
        const priceUSD = currency === "SOL" ? price * 140 : price
        return priceUSD >= 15 && priceUSD < 50
      }).slice(0, 3)
      
      budget.forEach(card => {
        const listing = card.listing || {}
        const price = listing.price || 0
        const currency = listing.currency || "USDC"
        const priceUSD = currency === "SOL" ? price * 140 : price
        console.log(`Budget: $${priceUSD.toFixed(0)} - ${card.itemName.substring(0, 60)}`)
      })
      
      return realisticCards
      
    } catch (error) {
      console.error("Error:", error)
      return []
    }
  }
}

const cleaner = new BetterDataCleaner()
cleaner.getMoreRealisticSample()
