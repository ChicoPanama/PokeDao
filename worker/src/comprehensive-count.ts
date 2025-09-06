import { chromium } from "playwright"

async function comprehensiveCardCount() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    // Test different sorting options to see total available
    const sortOptions = [
      "", // default
      "?orderBy=listedPriceAsc", // lowest first  
      "?orderBy=listedPriceDesc", // highest first
      "?orderBy=createdAtDesc", // newest first
      "?orderBy=createdAtAsc" // oldest first
    ]
    
    for (const sortParam of sortOptions) {
      console.log(`Testing sort: ${sortParam || "default"}`)
      
      await page.goto(`https://collectorcrypt.com/marketplace/cards${sortParam}`, {
        waitUntil: "networkidle"
      })
      
      await page.waitForSelector(".link-card", { timeout: 10000 })
      await page.waitForTimeout(3000)
      
      // Aggressive scrolling to load everything
      let previousCount = 0
      let currentCount = 0
      let attempts = 0
      const maxAttempts = 20 // More aggressive
      
      do {
        previousCount = currentCount
        
        // Multiple scroll strategies
        await page.evaluate(() => {
          // @ts-ignore: window/document are available in browser context
          window.scrollTo(0, document.body.scrollHeight)
        })
        await page.waitForTimeout(2000)
        
        await page.evaluate(() => {
          // @ts-ignore: window is available in browser context
          window.scrollBy(0, 1000)
        })
        await page.waitForTimeout(1000)
        
        currentCount = await page.evaluate(() => {
          // @ts-ignore: document is available in browser context
          return document.querySelectorAll("a.link-card").length
        })
        
        console.log(`  Cards loaded: ${currentCount}`)
        attempts++
        
      } while (currentCount > previousCount && attempts < maxAttempts)
      
      // Sample price range for this sort
      const priceRange = await page.evaluate(() => {
        // @ts-ignore: document is available in browser context
        const cards = document.querySelectorAll("a.link-card")
        const prices: number[] = []
        
        Array.from(cards).slice(0, 10).forEach((card: any) => {
          // @ts-ignore: card is HTMLElement
          const priceEl = card.querySelector(".card__details__insurance-value__insurance")
          const price = parseFloat(priceEl?.textContent?.trim() || "0")
          if (price > 0) prices.push(price)
        })
        
        return {
          min: Math.min(...prices),
          max: Math.max(...prices),
          count: prices.length
        }
      })
      
      console.log(`  Final count: ${currentCount}, Price range: $${priceRange.min} - $${priceRange.max}`)
      console.log("---")
    }
    
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await browser.close()
  }
}

comprehensiveCardCount()
