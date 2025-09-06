import axios from "axios"
import fs from "fs"
import dotenv from "dotenv"

dotenv.config()

class CollectorCryptAPI {
  private baseURL = "https://api.collectorcrypt.com/marketplace"
  
  async fetchAndSaveAllCards() {
    try {
      console.log("Fetching and SAVING complete dataset...")
      
      let allCards = []
      let page = 1
      let totalPages = 179
      
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
        
        if (page === 1) {
          totalPages = response.data.totalPages || 179
          console.log(`API reports ${response.data.findTotal} total cards across ${totalPages} pages`)
        }
        
        const pageCards = response.data.filterNFtCard || []
        if (pageCards.length === 0) break
        
        allCards = allCards.concat(pageCards)
        
        if (page % 20 === 0) {
          console.log(`Progress: ${page}/${totalPages} (${((page/totalPages)*100).toFixed(1)}%) - ${allCards.length} cards`)
        }
        
        await new Promise(resolve => setTimeout(resolve, 200))
        page++
      }
      
      // Save raw data
      console.log(`Saving ${allCards.length} cards to file...`)
      fs.writeFileSync("complete-dataset.json", JSON.stringify(allCards, null, 2))
      console.log("Dataset saved to complete-dataset.json")
      
      return allCards
      
    } catch (error) {
      console.error("API Error:", error.response?.status, error.message)
      return []
    }
  }
}

async function main() {
  const api = new CollectorCryptAPI()
  const cards = await api.fetchAndSaveAllCards()
  console.log(`Complete! Collected and saved ${cards.length} total cards`)
}

console.log("PokeDAO Complete Dataset Saver starting...")
main()
